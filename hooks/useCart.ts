import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pdvApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

export type CartItem = { productId: string; name: string; price: number; qty: number };
export type SaleResult = { id: string; total: number; payment: string; items: CartItem[]; date: string; customerName?: string; employeeName?: string; sellerName?: string; couponCode?: string; couponDiscount?: number; manualDiscount?: number };

export const PAYMENTS = [
  { key: "pix", label: "Pix" },
  { key: "dinheiro", label: "Dinheiro" },
  { key: "cartao", label: "Cartao" },
  { key: "debito", label: "Debito" },
];

const MAX_DISCOUNT_PCT = 50;

function decomposeCartKey(cartKey: string): { pid: string; vid: string | null } {
  var idx = cartKey.indexOf("__");
  if (idx < 0) return { pid: cartKey, vid: null };
  return { pid: cartKey.slice(0, idx), vid: cartKey.slice(idx + 2) };
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
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string | null>(null);

  // Seller name (free text) — used by all plans
  const [sellerName, setSellerName] = useState<string>("");

  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number } | null>(null);

  const [discountType, setDiscountType] = useState<"%" | "R$">("%");
  const [discountValue, setDiscountValue] = useState("");

  const saleMutation = useMutation({
    mutationFn: (body: any) => pdvApi.createSale(companyId!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      qc.invalidateQueries({ queryKey: ["dashboard", companyId] });
      qc.invalidateQueries({ queryKey: ["transactions", companyId] });
      qc.invalidateQueries({ queryKey: ["customers", companyId] });
      qc.invalidateQueries({ queryKey: ["employees", companyId] });
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

  function updateQty(productId: string, delta: number) {
    setCart(function(prev) { return prev.map(function(i) {
      if (i.productId !== productId) return i;
      var newQty = i.qty + delta;
      return newQty > 0 ? { ...i, qty: newQty } : i;
    }); });
    if (couponApplied) setCouponApplied(null);
  }

  function removeItem(productId: string) {
    setCart(function(prev) { return prev.filter(function(i) { return i.productId !== productId; }); });
    if (couponApplied) setCouponApplied(null);
  }

  function selectCustomer(id: string | null, name: string | null) { setSelectedCustomerId(id); setSelectedCustomerName(name); }
  function selectEmployee(id: string | null, name: string | null) { setSelectedEmployeeId(id); setSelectedEmployeeName(name); }
  function clearCoupon() { setCouponCode(""); setCouponApplied(null); }
  function clearDiscount() { setDiscountValue(""); }

  function finalizeSale(saleDate?: string) {
    if (cart.length === 0 || isProcessing) return;
    setIsProcessing(true);

    var cartSnapshot = [...cart];
    var effectiveSellerName = sellerName.trim() || selectedEmployeeName || null;
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
      payment_method: payment,
      customer_id: selectedCustomerId || undefined,
      employee_id: selectedEmployeeId || undefined,
      seller_name: effectiveSellerName || undefined,
    };

    if (saleDate) saleData.sale_date = saleDate;
    if (couponApplied?.code) saleData.coupon_code = couponApplied.code;

    if (manualDiscountAmount > 0) {
      if (discountType === "%") {
        saleData.discount_pct = Math.min(parsedDiscount, MAX_DISCOUNT_PCT);
      } else {
        saleData.discount_amount = manualDiscountAmount;
      }
    }

    if (companyId && !isDemo) {
      saleMutation.mutate(saleData, {
        onSuccess: function(res: any) {
          var saleId = res?.sale?.id || res?.id || Date.now().toString(36).toUpperCase().slice(-6);
          setLastSale({ id: String(saleId), total: totalAfterCoupon, payment: payment, items: cartSnapshot, date: new Date().toLocaleString("pt-BR"), customerName: selectedCustomerName || undefined, employeeName: selectedEmployeeName || undefined, sellerName: effectiveSellerName || undefined, couponCode: couponApplied?.code, couponDiscount: couponApplied?.discount, manualDiscount: manualDiscountAmount || undefined });
          setCart([]); toast.success("Venda registrada!"); setIsProcessing(false); clearCoupon(); clearDiscount();
          setSellerName("");
        },
        onError: function(err: any) { toast.error(err?.message || "Erro ao registrar venda"); setIsProcessing(false); },
      });
    } else {
      setLastSale({ id: Date.now().toString(36).toUpperCase().slice(-6), total: totalAfterCoupon, payment: payment, items: cartSnapshot, date: new Date().toLocaleString("pt-BR"), customerName: selectedCustomerName || undefined, employeeName: selectedEmployeeName || undefined, sellerName: effectiveSellerName || undefined });
      setCart([]); setIsProcessing(false);
    }
  }

  function newSale() {
    setLastSale(null); setCart([]); setIsProcessing(false);
    setSelectedCustomerId(null); setSelectedCustomerName(null);
    setSelectedEmployeeId(null); setSelectedEmployeeName(null);
    setSellerName("");
    clearCoupon(); clearDiscount();
  }

  return {
    cart, payment, setPayment, lastSale, total, totalAfterCoupon, itemCount, isProcessing,
    addToCart, setQty, updateQty, removeItem, finalizeSale, newSale,
    selectedCustomerId, selectedCustomerName, selectCustomer,
    selectedEmployeeId, selectedEmployeeName, selectEmployee,
    sellerName, setSellerName,
    couponCode, setCouponCode, couponApplied, setCouponApplied, clearCoupon,
    discountType, setDiscountType, discountValue, setDiscountValue, manualDiscountAmount, clearDiscount,
  };
}
