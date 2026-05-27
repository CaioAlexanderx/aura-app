// ============================================================
// usePdvState — ViewModel hook do PDV (Caixa)
//
// Extrai todo estado, queries, handlers e dados derivados de
// CaixaScreenInner. O componente pdv.tsx fica responsável
// apenas pela camada de layout/renderização.
//
// 14/05/2026: interceptação do crediário parcelado em
// handleFinalize() — showCrediario + handleCrediarioConfirm.
// handleOpenCrediario() — atalho direto via botão ActCrediario (F6).
//
// 26/05/2026 (crediario fase 1): handleCrediarioConfirm agora
// recebe { installments, first_due_date } do modal e repassa
// para finalizeSale(), que inclui os campos no POST /pdv/sale.
// O backend cria as credit_installments inline (best-effort).
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/stores/auth";
import { useProducts } from "@/hooks/useProducts";
import { useCart, PAYMENTS } from "@/hooks/useCart";
import { useCustomers } from "@/hooks/useCustomers";
import { usePdvSettings, validateSaleAgainstSettings } from "@/hooks/usePdvSettings";
import { usePagination } from "@/hooks/usePagination";
import { useGlobalBarcodeScanner } from "@/hooks/useGlobalBarcodeScanner";
import { useViewport, productColumnsFor, cartWidthFor } from "@/hooks/useViewport";
import { useCaixa } from "@/hooks/useCaixa";

import { couponsApi, employeesApi, pdvApi } from "@/services/api";
import { nfceApi } from "@/services/nfceApi";

import { toast } from "@/components/Toast";
import { flyToCart } from "@/components/screens/pdv/flyToCart";
import { IS_WEB, fmtCurrency } from "@/components/screens/pdv/types";
import type { CartDisplayItem, PayChip } from "@/components/screens/pdv/CartPanel";
import type { Product } from "@/components/screens/estoque/types";
import type { CrediarioConfirmPayload } from "@/components/screens/pdv/PdvModals";

import { openQuotePdf, type QuoteItem } from "@/utils/quotePdf";
import { normalizeText, buildProductHaystack, matchesQuery } from "@/utils/productSearch";

const PAGE_SIZE = 12;

function getProductStock(p: any): number {
  const v = p?.stock ?? p?.stock_qty ?? 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function isProductInStock(p: any): boolean {
  if (p?.has_variants === true) return true;
  return getProductStock(p) > 0;
}

const PAY_ICONS: Record<string, string> = {
  pix:       "dollar",
  dinheiro:  "wallet",
  cartao:    "receipt",
  debito:    "trending_up",
  crediario: "clock",
};

export const PAY_METHODS: PayChip[] = PAYMENTS.map(p => ({
  key:   p.key,
  label: p.label,
  icon:  PAY_ICONS[p.key] || "dollar",
}));

export function usePdvState() {
  const { company, isDemo } = useAuthStore();
  const { products } = useProducts();
  const { customers } = useCustomers();
  const { settings: pdvSettings } = usePdvSettings();

  // ── Plano / módulos ──────────────────────────────────────────
  const plan = (company?.plan || "essencial").toLowerCase();
  const isNegocioPlus = plan === "negocio" || plan === "expansao" || plan === "personalizado";
  const moduleOverrides = ((company as any)?.module_overrides ?? {}) as Record<string, boolean>;
  const isModuleEnabled = (key: string, planDefault: boolean) =>
    moduleOverrides[key] === true ? true
    : moduleOverrides[key] === false ? false
    : planDefault;
  const clientesEnabled = isModuleEnabled("clientes", isNegocioPlus);

  // ── Toggles PDV settings ──────────────────────────────────────
  const caixaEnabled      = !!(pdvSettings as any)?.caixa_enabled;
  const cashTenderEnabled = (pdvSettings as any)?.cash_tender_modal_enabled !== false;
  const crediarioEnabled  = !!(pdvSettings as any)?.crediario_enabled;

  // ── Caixa ─────────────────────────────────────────────────────
  const { sessaoAtiva, isAberto, isLoading: caixaLoading, invalidate: invalidateCaixa } = useCaixa();
  const [showCaixaModal, setShowCaixaModal] = useState(false);

  // ── Modal de troco ────────────────────────────────────────────
  const [showChangeModal,  setShowChangeModal]  = useState(false);
  const [cashModalAmount,  setCashModalAmount]  = useState(0);
  const [cashModalIsSplit, setCashModalIsSplit] = useState(false);

  // ── Crediário parcelado ───────────────────────────────────────
  const [showCrediario, setShowCrediario] = useState(false);

  // ── Scanner ───────────────────────────────────────────────────
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  // ── Employees ─────────────────────────────────────────────────
  const { data: empData } = useQuery({
    queryKey:  ["employees", company?.id],
    queryFn:   () => employeesApi.list(company!.id),
    enabled:   !!company?.id && isNegocioPlus,
    staleTime: 60_000,
  });
  const employees = useMemo(
    () => ((empData?.employees || []) as any[]).map(e => ({
      id: e.id, name: e.name || "", subtitle: e.role || undefined,
    })),
    [empData],
  );

  // ── NFC-e config ──────────────────────────────────────────────
  const { data: nfceConfigData } = useQuery({
    queryKey:  ["nfce-config", company?.id],
    queryFn:   () => nfceApi.getConfig(company!.id),
    enabled:   !!company?.id && !isDemo,
    staleTime: 5 * 60_000,
  });
  const autoEmitNfce =
    !!nfceConfigData?.config?.auto_emit_nfce && nfceConfigData?.config?.is_active;

  // ── Cart ──────────────────────────────────────────────────────
  const {
    cart, payment, setPayment, lastSale, total: totalRaw, totalAfterCoupon,
    itemCount, isProcessing,
    addToCart, setQty, updateQty, setUnitPrice, removeItem, finalizeSale, newSale,
    selectedCustomerId, selectedCustomerName, selectCustomer,
    selectedEmployeeId, selectedEmployeeName, selectEmployee,
    sellerName, setSellerName,
    couponCode, setCouponCode, couponApplied, setCouponApplied, clearCoupon,
    discountType, discountValue, manualDiscountAmount,
    cpfNaNota, setCpfNaNota,
    splitMode, toggleSplitMode,
    splitPayments, addSplitPayment, updateSplitPayment, removeSplitPayment,
    splitRemaining, splitIsBalanced,
  } = useCart();

  // ── Viewport ──────────────────────────────────────────────────
  const vp         = useViewport();
  const wide        = vp.wide;
  const productCols = productColumnsFor(vp);
  const cartWidth   = cartWidthFor(vp);

  // ── Ref do CartPanel (flyToCart) ──────────────────────────────
  const cartHeadRef = useRef<any>(null);

  // ── Filtros / busca ───────────────────────────────────────────
  const [query,          setQuery]          = useState("");
  const [cat,            setCat]            = useState<string>("all");
  const [showOutOfStock, setShowOutOfStock] = useState(false);

  // ── Estados de modais ─────────────────────────────────────────
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [pendingProduct,  setPendingProduct]  = useState<Product | null>(null);
  const [showTroca,       setShowTroca]       = useState(false);

  // ── Categorias ────────────────────────────────────────────────
  const categories = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of products) {
      const k = p.category || "Produtos";
      map[k] = (map[k] || 0) + 1;
    }
    return [
      { id: "all", label: "Todos", count: products.length },
      ...Object.keys(map).sort().map(k => ({ id: k, label: k, count: map[k] })),
    ];
  }, [products]);

  const outOfStockCount = useMemo(
    () => products.reduce((acc, p) => acc + (isProductInStock(p) ? 0 : 1), 0),
    [products],
  );

  // ── Índice de busca ───────────────────────────────────────────
  const productIndex = useMemo(() => {
    const idx = new Map<string, string>();
    for (const p of products) idx.set((p as any).id, buildProductHaystack(p));
    return idx;
  }, [products]);

  const filtered = useMemo(() => {
    const normQuery = normalizeText(query);
    return products.filter(p => {
      const haystack = productIndex.get((p as any).id) ?? buildProductHaystack(p);
      return (
        matchesQuery(haystack, normQuery) &&
        (cat === "all" || p.category === cat) &&
        (showOutOfStock || isProductInStock(p))
      );
    });
  }, [products, productIndex, query, cat, showOutOfStock]);

  const { paginated, page, totalPages, total: filteredTotal, goTo } =
    usePagination(filtered, PAGE_SIZE, query + cat + (showOutOfStock ? "1" : "0"));

  const qtyById = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of cart) {
      const base = it.productId.split("__")[0];
      m[base] = (m[base] || 0) + it.qty;
    }
    return m;
  }, [cart]);

  // ── Handlers ──────────────────────────────────────────────────

  function pickCustomerWithPhone(v: { id: string; name: string } | null) {
    if (!v) { selectCustomer(null, null, null); return; }
    const c = customers.find(c => c.id === v.id);
    selectCustomer(v.id, v.name, c?.phone || null);
  }

  const scanFeedbackTimerRef = useRef<any>(null);
  function flashScanFeedback(code: string) {
    setLastScannedCode(code);
    if (scanFeedbackTimerRef.current) clearTimeout(scanFeedbackTimerRef.current);
    scanFeedbackTimerRef.current = setTimeout(() => {
      setLastScannedCode(null);
      scanFeedbackTimerRef.current = null;
    }, 800);
  }
  useEffect(
    () => () => { if (scanFeedbackTimerRef.current) clearTimeout(scanFeedbackTimerRef.current); },
    [],
  );

  async function handleScan(code: string) {
    const cleaned = (code || "").trim();
    if (!cleaned) return;
    flashScanFeedback(cleaned);

    const localProduct = products.find(p => p.barcode === cleaned);
    if (localProduct) { handleAddProduct(localProduct); return; }
    if (!company?.id || isDemo) { setQuery(cleaned); return; }

    try {
      const result = await pdvApi.scan(company.id, cleaned);
      if (result.match === "exact" && result.source === "variant_barcode" && result.product && result.variant_id) {
        const parentLocal  = products.find(p => p.id === result.product.id);
        const suffix       = (result.product as any).sku_suffix || "Variante";
        const parentName   = parentLocal?.name || (result.product as any).name || "Produto";
        const parentPrice  = parentLocal?.price ?? (result.product as any).price ?? 0;
        const price        = result.effective_price || parentPrice;
        const parent: any  = parentLocal || { id: result.product.id, name: parentName, price: parentPrice };
        addToCart(parent, { id: result.variant_id, label: suffix, price });
        toast.success(parentName + " · " + suffix);
        return;
      }
      if (result.match === "exact" && result.product) {
        const full = products.find(p => p.id === result.product.id);
        if (full) { handleAddProduct(full); return; }
        const bp: any = {
          id:    result.product.id,
          name:  (result.product as any).name || "Produto",
          price: result.effective_price || (result.product as any).price || 0,
        };
        addToCart(bp);
        toast.success(bp.name);
        return;
      }
      setQuery(cleaned);
    } catch {
      setQuery(cleaned);
    }
  }

  function handleAddProduct(
    p: Product,
    evt?: { x: number; y: number; accent: string; letter: string },
  ) {
    if (p.has_variants) { setPendingProduct(p); return; }
    addToCart(p);
    if (evt && cartHeadRef.current && IS_WEB) {
      const target = cartHeadRef.current.getBoundingClientRect?.();
      if (target) {
        flyToCart(
          { x: evt.x, y: evt.y },
          { x: target.left + target.width / 2 - 22, y: target.top + 30 },
          evt.accent,
          evt.letter,
        );
      }
    }
  }

  function handleVariantSelected(variant: { id: string; label: string; price: number; stock: number }) {
    if (!pendingProduct) return;
    if (!variant.id) { addToCart(pendingProduct); }
    else             { addToCart(pendingProduct, variant); }
    setPendingProduct(null);
  }

  function handleFinalize() {
    if (caixaEnabled && !isAberto) {
      toast.error("Abra o caixa antes de finalizar a venda");
      setShowCaixaModal(true);
      return;
    }
    const v = validateSaleAgainstSettings(pdvSettings, {
      customerId: selectedCustomerId,
      sellerId:   selectedEmployeeId,
      sellerName,
    });
    if (!v.ok) {
      toast.error("Selecione " + v.missing.join(" e ") + " antes de finalizar a venda");
      return;
    }

    // Crediário Parcelado — intercepta antes do modal de troco.
    // Abre CreditInstallmentModal; finalizeSale é chamado em
    // handleCrediarioConfirm após a confirmação das parcelas.
    if (payment === "crediario" && !splitMode) {
      if (!selectedCustomerId) {
        toast.error("Selecione um cliente para usar o crediário parcelado");
        return;
      }
      setShowCrediario(true);
      return;
    }

    // Modal de troco — single ou split com parcelas em dinheiro
    const splitOk    = !splitMode || splitIsBalanced;
    const cashAmount = splitMode
      ? splitPayments
          .filter(p => p.method === "dinheiro")
          .reduce((s, p) => s + (Number(p.value) || 0), 0)
      : (payment === "dinheiro" ? totalAfterCoupon : 0);
    if (cashTenderEnabled && cashAmount > 0 && splitOk) {
      setCashModalAmount(cashAmount);
      setCashModalIsSplit(splitMode);
      setShowChangeModal(true);
      return;
    }
    finalizeSale();
  }

  function handleConfirmCashChange() {
    setShowChangeModal(false);
    finalizeSale();
  }

  // Parcelas configuradas no modal — fecha e conclui a venda com os parâmetros.
  // 26/05/2026 (fase 1): recebe payload do CreditInstallmentModal e passa
  // para finalizeSale, que os inclui no body do POST /pdv/sale.
  function handleCrediarioConfirm(payload: CrediarioConfirmPayload) {
    setShowCrediario(false);
    finalizeSale(undefined, payload);
  }

  // Atalho direto do botão ActCrediario (F6) — não passa por handleFinalize.
  // Valida pré-condições, seta payment='crediario' e abre a modal.
  function handleOpenCrediario() {
    if (cart.length === 0) {
      toast.info("Adicione produtos ao carrinho antes de usar o crediário");
      return;
    }
    if (!selectedCustomerId) {
      toast.error("Selecione um cliente para usar o crediário parcelado");
      return;
    }
    setPayment("crediario");
    setShowCrediario(true);
  }

  async function handleValidateCoupon(code: string) {
    if (!company?.id) return { ok: false, error: "Empresa não identificada" };
    try {
      const res = await couponsApi.validate(company.id, code, totalRaw);
      if (res.valid && res.code) {
        setCouponApplied({ code: res.code, discount: res.discount_amount || 0 });
        setCouponCode(res.code);
        toast.success("Cupom " + res.code + " aplicado! −" + fmtCurrency(res.discount_amount || 0));
        return { ok: true, code: res.code, discount: res.discount_amount };
      }
      return { ok: false, error: res.error || "Cupom inválido" };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Erro ao validar cupom" };
    }
  }

  function handleGenerateQuote() {
    if (cart.length === 0) {
      toast.info("Adicione produtos ao carrinho antes de gerar orçamento");
      return;
    }
    const items: QuoteItem[] = cart.map(i => ({ name: i.name, qty: i.qty, unitPrice: i.price }));
    const discount      = couponApplied ? couponApplied.discount : (manualDiscountAmount || 0);
    const afterDiscount = totalRaw - discount;
    const profile       = (company as any)?.profile || {};
    openQuotePdf({
      items,
      customerName:       selectedCustomerName,
      sellerName:         selectedEmployeeName || sellerName || null,
      total:              totalRaw,
      totalAfterDiscount: discount > 0 ? afterDiscount : undefined,
      discount:           discount > 0 ? discount : undefined,
      companyName:        company?.name || "Sua empresa",
      companyLogoUrl:     profile.logo_url || null,
      companyPhone:       profile.phone || null,
      companyAddress:     profile.address || null,
    });
    toast.success("Orçamento gerado");
  }

  // ── Scanner gate ──────────────────────────────────────────────
  const scannerListening =
    !lastSale &&
    !pendingProduct &&
    !showCaixaModal &&
    !showTroca &&
    !showChangeModal &&
    !showNewCustomer &&
    !showCrediario;
  useGlobalBarcodeScanner({ onScan: handleScan, enabled: scannerListening });

  // ── Dados derivados para renderização ─────────────────────────
  const displayItems: CartDisplayItem[] = cart.map(it => {
    const base = it.productId.split("__")[0];
    return { productId: it.productId, productBaseId: base, name: it.name, price: it.price, qty: it.qty };
  });

  const subtotal       = totalRaw;
  const couponDiscount = couponApplied?.discount || 0;
  const discountAmount = couponDiscount + (manualDiscountAmount || 0);
  const totalFinal     = totalAfterCoupon;
  const discountLabel  = couponApplied?.code
    ? couponApplied.code
    : manualDiscountAmount > 0
      ? discountType === "%" ? (discountValue + "%") : "manual"
      : null;

  const requiredHints: string[] = [];
  if (pdvSettings.require_customer && !selectedCustomerId) requiredHints.push("Cliente obrigatório");
  if (pdvSettings.require_seller && !selectedEmployeeId && !(sellerName || "").trim()) requiredHints.push("Vendedora obrigatória");
  if (caixaEnabled && !isAberto) requiredHints.push("Caixa fechado");

  const activeSellerValue = selectedEmployeeId
    ? { id: selectedEmployeeId, name: selectedEmployeeName || "Vendedora" }
    : sellerName?.trim()
      ? { id: "__free__" + sellerName.trim(), name: sellerName.trim() }
      : null;

  const activeCustomerValue = selectedCustomerId
    ? {
        id:       selectedCustomerId,
        name:     selectedCustomerName || "Cliente",
        subtitle: customers.find(c => c.id === selectedCustomerId)?.phone || undefined,
      }
    : null;

  const customerOptions = customers.map(c => ({
    id: c.id, name: c.name, subtitle: c.phone || c.email,
  }));

  const orderSuffix = "#" + ((Date.now() % 100000).toString().padStart(5, "0"));

  const cartProps = {
    orderNumber:       orderSuffix,
    items:             displayItems,
    subtotal,
    discountAmount,
    total:             totalFinal,
    itemCount,
    payMethods:        PAY_METHODS,
    activePay:         payment,
    onPay:             setPayment,
    onInc:             (id: string) => updateQty(id, 1),
    onDec:             (id: string) => updateQty(id, -1),
    onSetQty:          setQty,
    onPriceChange:     setUnitPrice,
    onRemove:          removeItem,
    onClear:           () => { cart.forEach(i => removeItem(i.productId)); clearCoupon(); },
    onFinalize:        handleFinalize,
    onGenerateQuote:   handleGenerateQuote,
    showOrcamento:     true,
    discountLabel,
    isProcessing,
    requiredHints,
    cpfNaNota,
    onCpfNaNotaChange: setCpfNaNota,
    splitMode,
    splitPayments,
    splitRemaining,
    splitIsBalanced,
    onToggleSplit:        toggleSplitMode,
    onAddSplitPayment:    () => addSplitPayment(),
    onUpdateSplitPayment: updateSplitPayment,
    onRemoveSplitPayment: removeSplitPayment,
  };

  return {
    // Company / auth
    company, isDemo, plan, isNegocioPlus, clientesEnabled, crediarioEnabled,
    // Caixa
    caixaEnabled, sessaoAtiva, isAberto, caixaLoading, invalidateCaixa,
    showCaixaModal,
    openCaixaModal:  () => setShowCaixaModal(true),
    closeCaixaModal: () => setShowCaixaModal(false),
    // Change modal
    showChangeModal, cashModalAmount, cashModalIsSplit,
    handleConfirmCashChange,
    cancelChange: () => setShowChangeModal(false),
    // Crediário parcelado
    showCrediario,
    handleCrediarioConfirm,
    handleOpenCrediario,
    closeCrediario: () => setShowCrediario(false),
    // Scanner
    lastScannedCode, scannerListening,
    // Employees / NFC-e
    employees, autoEmitNfce,
    // Cart
    payment, setPayment, lastSale, newSale, isProcessing,
    selectedCustomerId, selectedCustomerName, selectCustomer,
    selectedEmployeeId, selectedEmployeeName, selectEmployee,
    sellerName, setSellerName,
    couponApplied, setCouponApplied, clearCoupon, setCouponCode,
    cpfNaNota, setCpfNaNota,
    splitMode, splitPayments, splitRemaining, splitIsBalanced,
    toggleSplitMode, addSplitPayment, updateSplitPayment, removeSplitPayment,
    // Viewport
    vp, wide, productCols, cartWidth,
    // Produtos / busca
    products, query, setQuery, cat, setCat, showOutOfStock, setShowOutOfStock,
    categories, outOfStockCount, paginated, page, totalPages, filteredTotal, goTo, qtyById,
    // Modais (openers/closers nomeados)
    pendingProduct,
    closePendingProduct: () => setPendingProduct(null),
    showNewCustomer,
    openNewCustomer:  () => setShowNewCustomer(true),
    closeNewCustomer: () => setShowNewCustomer(false),
    customers, customerOptions,
    showTroca,
    openTroca:  () => setShowTroca(true),
    closeTroca: () => setShowTroca(false),
    // Handlers
    handleScan, handleAddProduct, handleVariantSelected, handleFinalize,
    handleValidateCoupon, handleGenerateQuote,
    pickCustomerWithPhone,
    // Dados derivados
    cartHeadRef, cartProps, orderSuffix,
    subtotal, discountAmount, totalFinal, discountLabel,
    requiredHints, activeSellerValue, activeCustomerValue, displayItems,
  };
}
