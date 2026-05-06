// ============================================================
// AURA. -- Caixa (PDV) — Claude Design redesign
//
// Mai/2026: PDV agora coleta CPF na nota (NFC-e) via input no
// CartPanel. SaleComplete ganhou fluxo completo de emissão de NFC-e.
// Auto-emit toggle: lê nfce_config.auto_emit_nfce e dispara emissão
// automática ao finalizar venda (sem botão idle).
// Multi-pagamento: useCart expõe splitMode + splitPayments[] que
// CartPanel renderiza como SplitPaymentList. NFC-e mapeia cada
// entrada pra detPag SEFAZ (vDesc preserva soma=total).
// 05/05: Crediário disponível como chip + edição inline do preço
// (setUnitPrice -> onPriceChange) + lixeira com confirm 2-cliques.
// 05/05 fix: ícone do crediário trocado pra `clock` (credit_card
// não existe no Icon set). Sidebar 400px (380 era apertado).
// 06/05: layout responsivo — colunas do grid e sidebar do CartPanel
// escalam com viewport (4/400 em 1440, 5/440 em 1500, 6/480 em 1900+).
// actBar e banner ganham maxWidth pra não esticar demais.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, Dimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useProducts } from "@/hooks/useProducts";
import { useCart, PAYMENTS } from "@/hooks/useCart";
import { useCustomers } from "@/hooks/useCustomers";
import { usePdvSettings, validateSaleAgainstSettings } from "@/hooks/usePdvSettings";
import { usePagination } from "@/hooks/usePagination";

import { couponsApi, employeesApi, pdvApi } from "@/services/api";
import { nfceApi } from "@/services/nfceApi";

import { toast } from "@/components/Toast";
import { Pagination } from "@/components/Pagination";
import { EmptyState } from "@/components/EmptyState";
import { QuickCustomerModal } from "@/components/QuickCustomerModal";
import { VariantPickerModal } from "@/components/VariantPickerModal";
import { RequireCompanyScope } from "@/components/RequireCompanyScope";

import { SaleComplete } from "@/components/screens/pdv/SaleComplete";
import { CaixaBackdrop } from "@/components/screens/pdv/CaixaBackdrop";
import { CaixaDesignStyle, IS_WEB, accentForProduct, productLetter, fmtCurrency } from "@/components/screens/pdv/types";
import { SearchBox } from "@/components/screens/pdv/SearchBox";
import { MerchantBanner } from "@/components/screens/pdv/MerchantBanner";
import { ActBarcode, ActPerson, ActCoupon } from "@/components/screens/pdv/ActionToolbar";
import { CategoryChips } from "@/components/screens/pdv/CategoryChips";
import { ProductGrid } from "@/components/screens/pdv/ProductGrid";
import { CartPanel, type CartDisplayItem, type PayChip } from "@/components/screens/pdv/CartPanel";
import { flyToCart } from "@/components/screens/pdv/flyToCart";

import type { Product } from "@/components/screens/estoque/types";
import { openQuotePdf, type QuoteItem } from "@/utils/quotePdf";

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

function normalizeText(s: any): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function buildProductHaystack(p: any): string {
  return normalizeText(
    [p?.name, p?.barcode, p?.sku, p?.code, p?.category, p?.color, p?.size]
      .filter(Boolean)
      .join(" ")
  );
}

function matchesQuery(haystack: string, query: string): boolean {
  if (!query) return true;
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  for (const t of terms) {
    if (!haystack.includes(t)) return false;
  }
  return true;
}

const PAY_ICONS: Record<string, string> = {
  pix: "dollar",
  dinheiro: "wallet",
  cartao: "receipt",
  debito: "trending_up",
  crediario: "clock", // "a prazo" — credit_card não existe no Icon
};
const PAY_METHODS: PayChip[] = PAYMENTS.map(p => ({
  key: p.key,
  label: p.label,
  icon: PAY_ICONS[p.key] || "dollar",
}));

// Hook que expõe largura da viewport + breakpoints úteis. Web only escuta
// resize; mobile usa Dimensions inicial. Substitui useIsWide.
function useViewport() {
  const initial = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) || 1024;
  const [w, setW] = useState(initial);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return {
    width: w,
    wide: w > 860,           // sidebar lateral ativa
    xl:   w >= 1500,         // ganha 1 coluna extra
    xxl:  w >= 1900,         // ganha mais 1 coluna (6 total)
  };
}

// Decide número de colunas do grid de produtos baseado na viewport.
// Em 1440 cabia bem em 4 (~250px cada). Em 2560 com 4 ficava ~470px
// (cards gigantes). Escala progressiva.
function productColumnsFor(vp: { xl: boolean; xxl: boolean }) {
  if (vp.xxl) return 6;
  if (vp.xl)  return 5;
  return 4;
}

// CartPanel cresce levemente em telas grandes pra não parecer espremido.
function cartWidthFor(vp: { xl: boolean; xxl: boolean }) {
  if (vp.xxl) return 480;
  if (vp.xl)  return 440;
  return 400;
}

function CaixaScreenInner() {
  const { company, isDemo } = useAuthStore();
  const { products } = useProducts();
  const { customers } = useCustomers();
  const { settings: pdvSettings } = usePdvSettings();

  const plan = (company?.plan || "essencial").toLowerCase();
  const isNegocioPlus = plan === "negocio" || plan === "expansao" || plan === "personalizado";

  const moduleOverrides = ((company as any)?.module_overrides ?? {}) as Record<string, boolean>;
  const isModuleEnabled = (key: string, planDefault: boolean) =>
    moduleOverrides[key] === true ? true
    : moduleOverrides[key] === false ? false
    : planDefault;
  const clientesEnabled = isModuleEnabled("clientes", isNegocioPlus);

  const { data: empData } = useQuery({
    queryKey: ["employees", company?.id],
    queryFn: () => employeesApi.list(company!.id),
    enabled: !!company?.id && isNegocioPlus,
    staleTime: 60000,
  });
  const employees = useMemo(
    () => ((empData?.employees || []) as any[]).map(e => ({ id: e.id, name: e.name || "", subtitle: e.role || undefined })),
    [empData]
  );

  // Lê config NFC-e da empresa pra saber se auto-emit está ativo. Cache 5min
  // (config muda raramente). Se config não existe, autoEmit = false.
  const { data: nfceConfigData } = useQuery({
    queryKey: ["nfce-config", company?.id],
    queryFn: () => nfceApi.getConfig(company!.id),
    enabled: !!company?.id && !isDemo,
    staleTime: 5 * 60 * 1000,
  });
  const autoEmitNfce = !!nfceConfigData?.config?.auto_emit_nfce && nfceConfigData?.config?.is_active;

  const {
    cart, payment, setPayment, lastSale, total: totalRaw, totalAfterCoupon, itemCount, isProcessing,
    addToCart, setQty, updateQty, setUnitPrice, removeItem, finalizeSale, newSale,
    selectedCustomerId, selectedCustomerName, selectCustomer,
    selectedEmployeeId, selectedEmployeeName, selectEmployee,
    sellerName, setSellerName,
    couponCode, setCouponCode, couponApplied, setCouponApplied, clearCoupon,
    discountType, discountValue, manualDiscountAmount,
    cpfNaNota, setCpfNaNota,
    // Multi-pagamento
    splitMode, toggleSplitMode,
    splitPayments, addSplitPayment, updateSplitPayment, removeSplitPayment,
    splitRemaining, splitIsBalanced,
  } = useCart();

  const vp = useViewport();
  const wide = vp.wide;
  const productCols = productColumnsFor(vp);
  const cartWidth = cartWidthFor(vp);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [showOutOfStock, setShowOutOfStock] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);

  const cartHeadRef = useRef<any>(null);

  const categories = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of products) {
      const k = p.category || "Produtos";
      map[k] = (map[k] || 0) + 1;
    }
    const keys = Object.keys(map).sort();
    return [
      { id: "all", label: "Todos", count: products.length },
      ...keys.map(k => ({ id: k, label: k, count: map[k] })),
    ];
  }, [products]);

  const outOfStockCount = useMemo(() => {
    return products.reduce((acc, p) => acc + (isProductInStock(p) ? 0 : 1), 0);
  }, [products]);

  const productIndex = useMemo(() => {
    const idx = new Map<string, string>();
    for (const p of products) idx.set((p as any).id, buildProductHaystack(p));
    return idx;
  }, [products]);

  const filtered = useMemo(() => {
    const normQuery = normalizeText(query);
    return products.filter(p => {
      const haystack = productIndex.get((p as any).id) ?? buildProductHaystack(p);
      const matchSearch = matchesQuery(haystack, normQuery);
      const matchCat = cat === "all" || p.category === cat;
      const matchStock = showOutOfStock || isProductInStock(p);
      return matchSearch && matchCat && matchStock;
    });
  }, [products, productIndex, query, cat, showOutOfStock]);

  const { paginated, page, totalPages, total: filteredTotal, goTo } = usePagination(filtered, PAGE_SIZE, query + cat + (showOutOfStock ? "1" : "0"));

  const qtyById = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of cart) {
      const base = it.productId.split("__")[0];
      m[base] = (m[base] || 0) + it.qty;
    }
    return m;
  }, [cart]);

  function pickCustomerWithPhone(v: { id: string; name: string } | null) {
    if (!v) { selectCustomer(null, null, null); return; }
    const c = customers.find(c => c.id === v.id);
    selectCustomer(v.id, v.name, c?.phone || null);
  }

  async function handleScan(code: string) {
    const cleaned = (code || "").trim();
    if (!cleaned) return;
    const localProduct = products.find(p => p.barcode === cleaned);
    if (localProduct) { handleAddProduct(localProduct); return; }

    if (!company?.id || isDemo) { setQuery(cleaned); return; }
    try {
      const result = await pdvApi.scan(company.id, cleaned);
      if (result.match === "exact" && result.source === "variant_barcode" && result.product && result.variant_id) {
        const parent = products.find(p => p.id === result.product.id);
        if (parent) {
          const suffix = (result.product as any).sku_suffix || "Variante";
          const price = result.effective_price || parent.price;
          addToCart(parent, { id: result.variant_id, label: suffix, price });
          toast.success(parent.name + " · " + suffix);
          return;
        }
      }
      if (result.match === "exact" && result.product) {
        const full = products.find(p => p.id === result.product.id);
        if (full) { handleAddProduct(full); return; }
      }
      setQuery(cleaned);
    } catch {
      setQuery(cleaned);
    }
  }

  function handleAddProduct(p: Product, evt?: { x: number; y: number; accent: string; letter: string }) {
    if (p.has_variants) { setPendingProduct(p); return; }
    addToCart(p);
    if (evt && cartHeadRef.current && IS_WEB) {
      const target = cartHeadRef.current.getBoundingClientRect?.();
      if (target) {
        flyToCart(
          { x: evt.x, y: evt.y },
          { x: target.left + target.width / 2 - 22, y: target.top + 30 },
          evt.accent,
          evt.letter
        );
      }
    }
  }

  function handleVariantSelected(variant: { id: string; label: string; price: number; stock: number }) {
    if (!pendingProduct) return;
    addToCart(pendingProduct, variant);
    setPendingProduct(null);
  }

  function handleFinalize() {
    const v = validateSaleAgainstSettings(pdvSettings, {
      customerId: selectedCustomerId,
      sellerId: selectedEmployeeId,
      sellerName,
    });
    if (!v.ok) {
      toast.error("Selecione " + v.missing.join(" e ") + " antes de finalizar a venda");
      return;
    }
    finalizeSale();
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
    const discount = couponApplied ? couponApplied.discount : (manualDiscountAmount || 0);
    const afterDiscount = totalRaw - discount;
    const profile = (company as any)?.profile || {};
    openQuotePdf({
      items,
      customerName: selectedCustomerName,
      sellerName: selectedEmployeeName || sellerName || null,
      total: totalRaw,
      totalAfterDiscount: discount > 0 ? afterDiscount : undefined,
      discount: discount > 0 ? discount : undefined,
      companyName: company?.name || "Sua empresa",
      companyLogoUrl: profile.logo_url || null,
      companyPhone: profile.phone || null,
      companyAddress: profile.address || null,
    });
    toast.success("Orçamento gerado");
  }

  const displayItems: CartDisplayItem[] = cart.map(it => {
    const base = it.productId.split("__")[0];
    return {
      productId: it.productId,
      productBaseId: base,
      name: it.name,
      price: it.price,
      qty: it.qty,
    };
  });
  const subtotal = totalRaw;
  const couponDiscount = couponApplied?.discount || 0;
  const discountAmount = couponDiscount + (manualDiscountAmount || 0);
  const totalFinal = totalAfterCoupon;
  const discountLabel = couponApplied?.code
    ? couponApplied.code
    : manualDiscountAmount > 0
      ? discountType === "%" ? (discountValue + "%") : "manual"
      : null;

  const requiredHints: string[] = [];
  if (pdvSettings.require_customer && !selectedCustomerId) requiredHints.push("Cliente obrigatório");
  if (pdvSettings.require_seller && !selectedEmployeeId && !(sellerName || "").trim()) requiredHints.push("Vendedora obrigatória");

  const activeSellerValue = selectedEmployeeId
    ? { id: selectedEmployeeId, name: selectedEmployeeName || "Vendedora" }
    : sellerName?.trim()
      ? { id: "__free__" + sellerName.trim(), name: sellerName.trim() }
      : null;

  const activeCustomerValue = selectedCustomerId
    ? { id: selectedCustomerId, name: selectedCustomerName || "Cliente", subtitle: customers.find(c => c.id === selectedCustomerId)?.phone || undefined }
    : null;

  const customerOptions = customers.map(c => ({ id: c.id, name: c.name, subtitle: c.phone || c.email }));

  const orderSuffix = "#" + ((Date.now() % 100000).toString().padStart(5, "0"));

  // Props comuns aos dois renders (wide e narrow) — DRY pra evitar drift entre os dois.
  const cartProps = {
    orderNumber: orderSuffix,
    items: displayItems,
    subtotal,
    discountAmount,
    total: totalFinal,
    itemCount,
    payMethods: PAY_METHODS,
    activePay: payment,
    onPay: setPayment,
    onInc: (id: string) => updateQty(id, 1),
    onDec: (id: string) => updateQty(id, -1),
    onSetQty: setQty,
    onPriceChange: setUnitPrice,
    onRemove: removeItem,
    onClear: () => { cart.forEach(i => removeItem(i.productId)); clearCoupon(); },
    onFinalize: handleFinalize,
    onGenerateQuote: handleGenerateQuote,
    showOrcamento: true,
    discountLabel,
    isProcessing,
    requiredHints,
    cpfNaNota,
    onCpfNaNotaChange: setCpfNaNota,
    // Multi-pagamento
    splitMode,
    splitPayments,
    splitRemaining,
    splitIsBalanced,
    onToggleSplit: toggleSplitMode,
    onAddSplitPayment: () => addSplitPayment(),
    onUpdateSplitPayment: updateSplitPayment,
    onRemoveSplitPayment: removeSplitPayment,
  };

  function StockToggle() {
    if (outOfStockCount === 0) return null;
    return (
      <Pressable
        onPress={() => setShowOutOfStock(v => !v)}
        style={[
          stockToggleStyles.btn,
          showOutOfStock && stockToggleStyles.btnActive,
        ]}
      >
        <Text style={[
          stockToggleStyles.txt,
          showOutOfStock && stockToggleStyles.txtActive,
        ]}>
          {showOutOfStock
            ? "Ocultar zerados (" + outOfStockCount + ")"
            : "Mostrar zerados (" + outOfStockCount + ")"}
        </Text>
      </Pressable>
    );
  }

  if (lastSale) {
    if (wide) {
      return (
        <View style={s.root}>
          <CaixaDesignStyle />
          <CaixaBackdrop />
          <SaleComplete sale={lastSale} onNewSale={newSale} autoEmit={autoEmitNfce} />
        </View>
      );
    }
    return <SaleComplete sale={lastSale} onNewSale={newSale} autoEmit={autoEmitNfce} />;
  }

  if (wide) {
    return (
      <View style={s.root}>
        <CaixaDesignStyle />
        <CaixaBackdrop />

        <View style={[s.main, IS_WEB && ({ display: "grid", gridTemplateColumns: `1fr ${cartWidth}px` } as any)]}>
          <ScrollView
            style={[s.catalog, IS_WEB && ({ maxHeight: "100vh", overflow: "auto" } as any)]}
            contentContainerStyle={{ padding: 28, paddingBottom: 48 }}
            className={IS_WEB ? "caixa-scrollable" : undefined}
          >
            {/* Em telas muito grandes, limitamos a largura do conteúdo principal
                pra cards não esticarem (look comprido demais) e linhas de leitura
                continuarem confortáveis. 1600 deixa respiro. */}
            <View style={IS_WEB && vp.xxl ? ({ maxWidth: 1700, alignSelf: "center", width: "100%" } as any) : null}>
            <View style={s.topRow}>
              <View>
                <Text style={s.title}>Caixa</Text>
                <View style={s.titleSub}>
                  {IS_WEB && (
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: "#34d399",
                        boxShadow: "0 0 6px #34d399",
                        display: "inline-block",
                        animation: "caixaPulse 1.8s ease-in-out infinite",
                      } as any}
                    />
                  )}
                  <Text style={s.titleSubTxt}>
                    {(company?.name || "Sua loja") + " · venda " + orderSuffix}
                    {autoEmitNfce ? " · NFC-e auto" : ""}
                  </Text>
                </View>
              </View>
              <SearchBox value={query} onChange={setQuery} />
            </View>

            <MerchantBanner height={200} />

            <View style={[s.actBar, IS_WEB && ({ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, position: "relative", zIndex: 50 } as any)]}>
              <ActBarcode onScan={handleScan} />
              <ActPerson
                kind="vendedora"
                shortcut="F2"
                value={activeSellerValue}
                onChange={v => {
                  if (!v) { selectEmployee(null, null); setSellerName(""); return; }
                  if (v.id.startsWith("__free__")) {
                    selectEmployee(null, null);
                    setSellerName(v.name);
                  } else {
                    selectEmployee(v.id, v.name);
                    setSellerName(v.name);
                  }
                }}
                options={employees}
                searchable={employees.length > 5}
                disabled={!isNegocioPlus && employees.length === 0 && false}
              />
              <ActPerson
                kind="cliente"
                shortcut="F3"
                value={activeCustomerValue}
                onChange={pickCustomerWithPhone}
                options={customerOptions}
                searchable
                addable={clientesEnabled}
                onAddNew={() => setShowNewCustomer(true)}
                disabled={!clientesEnabled}
                disabledHint="Disponível no plano Negócio"
              />
              <ActCoupon
                value={couponApplied}
                onChange={v => { if (v) setCouponApplied(v); else clearCoupon(); }}
                onValidate={handleValidateCoupon}
              />
            </View>

            <View style={s.catRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <CategoryChips items={categories} active={cat} onSelect={setCat} />
              </View>
              <StockToggle />
            </View>

            {products.length === 0 ? (
              <EmptyState
                icon="package"
                iconColor={Colors.amber}
                title="Nenhum produto cadastrado"
                subtitle="Cadastre produtos no Estoque para eles aparecerem aqui no Caixa."
              />
            ) : filtered.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ fontSize: 13, color: Colors.ink3 }}>
                  {!showOutOfStock && outOfStockCount > 0
                    ? "Nenhum produto encontrado com estoque. Tente \"Mostrar zerados\" acima."
                    : "Nenhum produto encontrado"}
                </Text>
              </View>
            ) : (
              <>
                <ProductGrid
                  products={paginated}
                  qtyById={qtyById}
                  onAdd={(p, e) => handleAddProduct(p as Product, e)}
                  columns={productCols}
                />
                <Pagination page={page} totalPages={totalPages} total={filteredTotal} pageSize={PAGE_SIZE} onPage={goTo} />
              </>
            )}

            {isDemo && (
              <View style={s.demoBanner}>
                <Text style={s.demoTxt}>Modo demonstrativo</Text>
              </View>
            )}
            </View>
          </ScrollView>

          <View style={[s.cartWrap, { width: cartWidth }, IS_WEB && ({ position: "sticky" as any, top: 0, height: "100vh" } as any)]}>
            <CartPanel ref={cartHeadRef} {...cartProps} />
          </View>
        </View>

        <QuickCustomerModal
          visible={showNewCustomer}
          onClose={() => setShowNewCustomer(false)}
          onCustomerCreated={c => selectCustomer(c.id, c.name, (c as any).phone || null)}
        />
        <VariantPickerModal
          visible={!!pendingProduct}
          product={pendingProduct}
          onSelect={handleVariantSelected}
          onClose={() => setPendingProduct(null)}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CaixaDesignStyle />
      <CaixaBackdrop />
      <ScrollView style={{ flex: 1, backgroundColor: "transparent" }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Text style={s.title}>Caixa</Text>
        <View style={{ marginBottom: 12 }}>
          <SearchBox value={query} onChange={setQuery} />
        </View>

        <MerchantBanner height={160} />

        <View style={[{ gap: 10, marginBottom: 16 }, IS_WEB && ({ position: "relative", zIndex: 50 } as any)]}>
          <ActBarcode onScan={handleScan} />
          <ActPerson
            kind="vendedora"
            shortcut="F2"
            value={activeSellerValue}
            onChange={v => {
              if (!v) { selectEmployee(null, null); setSellerName(""); return; }
              if (v.id.startsWith("__free__")) { selectEmployee(null, null); setSellerName(v.name); }
              else { selectEmployee(v.id, v.name); setSellerName(v.name); }
            }}
            options={employees}
            searchable={employees.length > 5}
          />
          <ActPerson
            kind="cliente"
            shortcut="F3"
            value={activeCustomerValue}
            onChange={pickCustomerWithPhone}
            options={customerOptions}
            searchable
            addable={clientesEnabled}
            onAddNew={() => setShowNewCustomer(true)}
            disabled={!clientesEnabled}
            disabledHint="Disponível no plano Negócio"
          />
          <ActCoupon
            value={couponApplied}
            onChange={v => { if (v) setCouponApplied(v); else clearCoupon(); }}
            onValidate={handleValidateCoupon}
          />
        </View>

        <View style={s.catRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <CategoryChips items={categories} active={cat} onSelect={setCat} />
          </View>
          <StockToggle />
        </View>

        {products.length === 0 ? (
          <EmptyState
            icon="package"
            iconColor={Colors.amber}
            title="Nenhum produto cadastrado"
            subtitle="Cadastre produtos no Estoque para eles aparecerem aqui no Caixa."
          />
        ) : filtered.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Text style={{ fontSize: 13, color: Colors.ink3 }}>
              {!showOutOfStock && outOfStockCount > 0
                ? "Nenhum produto encontrado com estoque. Tente \"Mostrar zerados\" acima."
                : "Nenhum produto encontrado"}
            </Text>
          </View>
        ) : (
          <>
            <ProductGrid
              products={paginated}
              qtyById={qtyById}
              onAdd={p => handleAddProduct(p as Product)}
              columns={2}
            />
            <Pagination page={page} totalPages={totalPages} total={filteredTotal} pageSize={PAGE_SIZE} onPage={goTo} />
          </>
        )}

        <View style={{ marginTop: 20 }}>
          <CartPanel ref={cartHeadRef} {...cartProps} />
        </View>
      </ScrollView>

      <QuickCustomerModal
        visible={showNewCustomer}
        onClose={() => setShowNewCustomer(false)}
        onCustomerCreated={c => selectCustomer(c.id, c.name, (c as any).phone || null)}
      />
      <VariantPickerModal
        visible={!!pendingProduct}
        product={pendingProduct}
        onSelect={handleVariantSelected}
        onClose={() => setPendingProduct(null)}
      />
    </View>
  );
}

export default function CaixaScreen() {
  return (
    <RequireCompanyScope context="pdv" actionLabel="abrir o caixa">
      <CaixaScreenInner />
    </RequireCompanyScope>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  main: { flex: 1, flexDirection: "row", minWidth: 0 },
  catalog: { flex: 1, minWidth: 0 },
  // Sidebar dinâmica via width inline (cartWidth) — 400 padrão, 440 em xl, 480 em xxl.
  cartWrap: { overflow: "hidden" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 20, marginBottom: 22 },
  title: { fontSize: 26, color: Colors.ink, letterSpacing: -0.4, fontWeight: "700" },
  titleSub: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  titleSubTxt: { fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace", fontSize: 11, color: Colors.ink3, letterSpacing: 0.6, textTransform: "uppercase" },
  actBar: { flexDirection: "row", gap: 10, marginBottom: 18, flexWrap: "wrap" },
  catRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 16 },
  demoTxt: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
});

const stockToggleStyles = StyleSheet.create({
  btn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: "rgba(124,58,237,0.06)", borderWidth: 1, borderColor: "rgba(124,58,237,0.25)", flexShrink: 0 },
  btnActive: { backgroundColor: "rgba(124,58,237,0.18)", borderColor: "rgba(124,58,237,0.55)" },
  txt: { fontSize: 11, color: Colors.ink3, fontWeight: "600" },
  txtActive: { color: "#a78bfa" },
});
