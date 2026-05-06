import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pdvApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

export type CartItem = { productId: string; name: string; price: number; qty: number };

// Multi-pagamento: cada entrada vira uma `detPag` no SEFAZ NFC-e (tPag = method, vPag = value).
// O backend mapeia method PDV → tPag SEFAZ (dinheiro→01, cartao→03, debito→04, pix→17,
// crediario→01 — fiado declarado como dinheiro pra evitar 391/442).
export type PaymentEntry = {
  method: string;        // chave do PDV: "dinheiro" | "pix" | "debito" | "cartao" | "crediario"
  value: number;         // valor em R$
  change?: number;       // troco (só faz sentido em dinheiro)
};

export type SaleResult = {
  id: string;
  total: number;
  payment: string;       // método "primário" — primeira entrada quando split, ou o único quando single
  payments?: PaymentEntry[]; // populado quando splitMode foi usado (length >= 1)
  items: CartItem[];
  date: string;
  customerName?: string;
  customerPhone?: string;   // pra wa.me share da NFC-e
  employeeName?: string;
  sellerName?: string;
  couponCode?: string;
  couponDiscount?: number;
  manualDiscount?: number;
  cpfNaNota?: string;       // CPF do consumidor (opcional, pra NFC-e)
};

// Crediário (mai/2026): operação interna do lojista — venda fica como "a receber"
// no cliente, registrada em customer_credit_transactions (migration 099). Backend
// exige customer_id quando crediario aparece em payment_method ou em algum split.
export const PAYMENTS = [
  { key: "dinheiro",  label: "Dinheiro" },
  { key: "pix",       label: "PIX" },
  { key: "debito",    label: "Débito" },
  { key: "cartao",    label: "Crédito" },
  { key: "crediario", label: "Crediário" },
];

const MAX_DISCOUNT_PCT = 50;

// FIX 06/05/2026: pid estava retornando cartKey inteiro (incluía __variantId),
// causando "invalid input syntax for type uuid" no backend ao finalizar split.
function decomposeCartKey(cartKey: string): { pid: string; vid: string | null } {
  var idx = cartKey.indexOf("__");
  if (idx < 0) return { pid: cartKey, vid: null };
  return { pid: cartKey.slice(0, idx), vid: cartKey.slice(idx + 2) };
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function useCart() {
  const { company, isDemo } = useAuthStore();
  const qc = useQueryClient();
  const companyId = company?.id;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState("pix");
  const [lastSale, setLastSale] = useState<SaleResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string | null>(null);
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string | null>(null);

  // Seller name (free text) — used by all plans
  const [sellerName, setSellerName] = useState<string>("");

  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number } | null>(null);

  const [discountType, setDiscountType] = useState<"%" | "R$">("%");
  const [discountValue, setDiscountValue] = useState("");

  // CPF na nota (NFC-e) — caixa digita ou cliente fala. Independente de
  // selectedCustomer, mas o front pode pre-preencher quando aplicavel.
  const [cpfNaNota, setCpfNaNota] = useState<string>("");

  // ── Multi-pagamento ─────────────────────────────────────────
  // splitMode=false → comportamento legado, único `payment` chip
  // splitMode=true → soma dos splitPayments deve fechar com totalAfterCoupon
  const [splitMode, setSplitMode] = useState(false);
  const [splitPayments, setSplitPayments] = useState<PaymentEntry[]>([]);

  const saleMutation = useMutation({
    mutationFn: (body: any) => pdvApi.createSale(companyId!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      qc.invalidateQueries({ queryKey: ["dashboard", companyId] });
      qc.invalidateQueries({ queryKey: ["transactions", companyId] });
      qc.invalidateQueries({ queryKey: ["customers", companyId] });
      qc.invalidateQueries({ queryKey: ["employees", companyId] });
      // Crediário: invalida saldos pra UI de /clientes refletir o novo debit.
      qc.invalidateQueries({ queryKey: ["credit-balances", companyId] });
    },
  });

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const itemCount = cart.reduce((s, i) => s + i.qty, 0);

  const parsedDiscount = parseFloat(discountValue.replace(",", ".")) || 0;
  let manualDiscountAmount = 0;
  if (parsedDiscount > 0 && total > 0) {
    if (discountType === "%") {
      const cappedPct = Math.min(parsedDiscount, MAX_DISCOUNT_PCT);
      manualDiscountAmount = Math.round(total * cappedPct / 100 * 100) / 100;
    } else {
      const maxAbsolute = total * MAX_DISCOUNT_PCT / 100;
      manualDiscountAmount = Math.min(parsedDiscount, maxAbsolute);
    }
  }

  const couponDiscount = couponApplied?.discount || 0;
  const totalAfterCoupon = Math.max(0, total - manualDiscountAmount - couponDiscount);

  // Splits — derivados puros
  const splitTotal = useMemo(
    () => round2(splitPayments.reduce((s, p) => s + (Number(p.value) || 0), 0)),
    [splitPayments],
  );
  // Restante = totalAfterCoupon − soma dos splits. Pode ser negativo (overpay).
  const splitRemaining = useMemo(
    () => round2(totalAfterCoupon - splitTotal),
    [totalAfterCoupon, splitTotal],
  );
  // Tolerância: 1 centavo (mesma do backend validatePayments).
  const splitIsBalanced = Math.abs(splitRemaining) < 0.01;

  function addSplitPayment(entry?: Partial<PaymentEntry>) {
    setSplitPayments(prev => [
      ...prev,
      {
        method: entry?.method || (prev.length === 0 ? payment : "dinheiro"),
        // Se nada informado, sugere o restante (até 0).
        value: entry?.value !== undefined
          ? round2(entry.value)
          : round2(Math.max(0, totalAfterCoupon - prev.reduce((s, p) => s + p.value, 0))),
        change: entry?.change,
      },
    ]);
  }

  function updateSplitPayment(idx: number, patch: Partial<PaymentEntry>) {
    setSplitPayments(prev => prev.map((p, i) => i === idx ? {
      ...p,
      ...(patch.method !== undefined ? { method: patch.method } : {}),
      ...(patch.value !== undefined ? { value: round2(patch.value) } : {}),
      ...(patch.change !== undefined ? { change: round2(patch.change) } : {}),
    } : p));
  }

  function removeSplitPayment(idx: number) {
    setSplitPayments(prev => prev.filter((_, i) => i !== idx));
  }

  function clearSplitPayments() {
    setSplitPayments([]);
  }

  function toggleSplitMode() {
    setSplitMode(prev => {
      const next = !prev;
      if (next) {
        // Inicia com 1 entrada cobrindo total no chip atual
        setSplitPayments([{ method: payment, value: round2(totalAfterCoupon) }]);
      } else {
        setSplitPayments([]);
      }
      return next;
    });
  }

  // ── Cart ops ────────────────────────────────────────────────

  function addToCart(product: { id: string; name: string; price: number }, variant?: { id: string; label: string; price?: number }) {
    setLastSale(null);
    var cartKey = variant ? product.id + "__" + variant.id : product.id;
    var displayName = variant ? product.name + " (" + variant.label + ")" : product.name;
    var effectivePrice = (variant?.price != null && variant.price > 0) ? variant.price : product.price;

    setCart(function(prev) {
      var existing = prev.find(function(i) { return i.productId === cartKey; });
      if (existing) return prev.map(function(i) { return i.productId === cartKey ? { ...i, qty: i.qty + 1 } : i; });
      return [...prev, { productId: cartKey, name: displayName, price: effectivePrice, qty: 1 }];
    });
    if (couponApplied) setCouponApplied(null);
  }

  function setQty(productId: string, qty: number) {
    if (qty <= 0) { setCart(function(prev) { return prev.filter(function(i) { return i.productId !== productId; }); }); return; }
    setCart(function(prev) { return prev.map(function(i) { return i.productId === productId ? { ...i, qty: qty } : i; }); });
    if (couponApplied) setCouponApplied(null);
  }

  // FIX 05/05/2026: `-` no qty=1 remove o item (fluxo natural do PDV).
  // Antes mantinha em 1 e o usuário precisava usar a lixeira separada.
  function updateQty(productId: string, delta: number) {
    setCart(function(prev) {
      // Calcula primeiro pra decidir se filtra (remove) ou mapeia (atualiza)
      var item = prev.find(function(i) { return i.productId === productId; });
      if (!item) return prev;
      var newQty = item.qty + delta;
      if (newQty <= 0) {
        return prev.filter(function(i) { return i.productId !== productId; });
      }
      return prev.map(function(i) { return i.productId === productId ? { ...i, qty: newQty } : i; });
    });
    if (couponApplied) setCouponApplied(null);
  }

  // Mai/2026: alteração livre do preço unitário do item no carrinho.
  // Caixa pode descontar/promover sem cap. Limpa cupom (precisa revalidar).
  // Round 2 casas pra evitar artefatos de digitação tipo 99.99000001.
  function setUnitPrice(productId: string, price: number) {
    if (!isFinite(price) || price < 0) return;
    const rounded = Math.round(price * 100) / 100;
    setCart(function(prev) {
      return prev.map(function(i) {
        return i.productId === productId ? { ...i, price: rounded } : i;
      });
    });
    if (couponApplied) setCouponApplied(null);
  }

  function removeItem(productId: string) {
    setCart(function(prev) { return prev.filter(function(i) { return i.productId !== productId; }); });
    if (couponApplied) setCouponApplied(null);
  }

  function selectCustomer(id: string | null, name: string | null, phone?: string | null) {
    setSelectedCustomerId(id);
    setSelectedCustomerName(name);
    setSelectedCustomerPhone(phone || null);
  }
  function selectEmployee(id: string | null, name: string | null) { setSelectedEmployeeId(id); setSelectedEmployeeName(name); }
  function clearCoupon() { setCouponCode(""); setCouponApplied(null); }
  function clearDiscount() { setDiscountValue(""); }

  function finalizeSale(saleDate?: string) {
    if (cart.length === 0 || isProcessing) return;
    // Bloqueio só quando split está ativo e não fecha
    if (splitMode && !splitIsBalanced) {
      toast.error(splitRemaining > 0
        ? `Faltam R$ ${splitRemaining.toFixed(2)} pra fechar`
        : `Sobrando R$ ${Math.abs(splitRemaining).toFixed(2)} nos pagamentos`);
      return;
    }

    // FEAT 05/05/2026: crediário exige cliente identificado.
    // Backend faz a mesma checagem e retorna 400, mas validar aqui dá
    // feedback imediato sem network round-trip.
    const usingCrediarioSingle = !splitMode && payment === "crediario";
    const usingCrediarioSplit  = splitMode && splitPayments.some(p => p.method === "crediario");
    if ((usingCrediarioSingle || usingCrediarioSplit) && !selectedCustomerId) {
      toast.error("Crediário exige um cliente. Selecione o cliente antes de finalizar.");
      return;
    }

    setIsProcessing(true);

    var cartSnapshot = [...cart];
    var effectiveSellerName = sellerName.trim() || selectedEmployeeName || null;
    var cleanCpf = cpfNaNota.replace(/\D/g, "");

    // Pagamento "primário" (o que vai no campo singular tanto na sale quanto no resumo)
    var primaryPayment = splitMode && splitPayments.length > 0 ? splitPayments[0].method : payment;
    var paymentsSnapshot: PaymentEntry[] | undefined = splitMode && splitPayments.length > 0
      ? splitPayments.map(p => ({ method: p.method, value: round2(p.value), change: p.change ? round2(p.change) : undefined }))
      : undefined;

    var saleData: any = {
      items: cartSnapshot.map(function(i) {
        var decomposed = decomposeCartKey(i.productId);
        return {
          product_id: decomposed.pid,
          variant_id: decomposed.vid || undefined,
          quantity: i.qty,
          unit_price: i.price,
          product_name_snapshot: i.name,
        };
      }),
      payment_method: primaryPayment,
      customer_id: selectedCustomerId || undefined,
      employee_id: selectedEmployeeId || undefined,
      seller_name: effectiveSellerName || undefined,
    };

    if (paymentsSnapshot) saleData.payments = paymentsSnapshot;
    if (saleDate) saleData.sale_date = saleDate;
    if (couponApplied?.code) saleData.coupon_code = couponApplied.code;

    if (manualDiscountAmount > 0) {
      if (discountType === "%") {
        saleData.discount_pct = Math.min(parsedDiscount, MAX_DISCOUNT_PCT);
      } else {
        saleData.discount_amount = manualDiscountAmount;
      }
    }

    function buildLastSale(saleId: string): SaleResult {
      return {
        id: String(saleId),
        total: totalAfterCoupon,
        payment: primaryPayment,
        payments: paymentsSnapshot,
        items: cartSnapshot,
        date: new Date().toLocaleString("pt-BR"),
        customerName: selectedCustomerName || undefined,
        customerPhone: selectedCustomerPhone || undefined,
        employeeName: selectedEmployeeName || undefined,
        sellerName: effectiveSellerName || undefined,
        couponCode: couponApplied?.code,
        couponDiscount: couponApplied?.discount,
        manualDiscount: manualDiscountAmount || undefined,
        cpfNaNota: cleanCpf || undefined,
      };
    }

    if (companyId && !isDemo) {
      saleMutation.mutate(saleData, {
        onSuccess: function(res: any) {
          var saleId = res?.sale?.id || res?.id || Date.now().toString(36).toUpperCase().slice(-6);
          setLastSale(buildLastSale(String(saleId)));
          setCart([]); toast.success("Venda registrada!"); setIsProcessing(false); clearCoupon(); clearDiscount();
          setSellerName("");
          setCpfNaNota("");
          // Não desativa splitMode automaticamente — usuário decide se mantém
          if (splitMode) setSplitPayments([]);
        },
        onError: function(err: any) { toast.error(err?.message || "Erro ao registrar venda"); setIsProcessing(false); },
      });
    } else {
      setLastSale(buildLastSale(Date.now().toString(36).toUpperCase().slice(-6)));
      setCart([]); setIsProcessing(false);
      if (splitMode) setSplitPayments([]);
    }
  }

  function newSale() {
    setLastSale(null); setCart([]); setIsProcessing(false);
    setSelectedCustomerId(null); setSelectedCustomerName(null); setSelectedCustomerPhone(null);
    setSelectedEmployeeId(null); setSelectedEmployeeName(null);
    setSellerName("");
    setCpfNaNota("");
    clearCoupon(); clearDiscount();
    // mantém splitMode entre vendas (workflow de loja)
    setSplitPayments([]);
  }

  return {
    cart, payment, setPayment, lastSale, total, totalAfterCoupon, itemCount, isProcessing,
    addToCart, setQty, updateQty, setUnitPrice, removeItem, finalizeSale, newSale,
    selectedCustomerId, selectedCustomerName, selectedCustomerPhone, selectCustomer,
    selectedEmployeeId, selectedEmployeeName, selectEmployee,
    sellerName, setSellerName,
    couponCode, setCouponCode, couponApplied, setCouponApplied, clearCoupon,
    discountType, setDiscountType, discountValue, setDiscountValue, manualDiscountAmount, clearDiscount,
    cpfNaNota, setCpfNaNota,
    // Multi-pagamento
    splitMode, toggleSplitMode,
    splitPayments, addSplitPayment, updateSplitPayment, removeSplitPayment, clearSplitPayments,
    splitTotal, splitRemaining, splitIsBalanced,
  };
}
