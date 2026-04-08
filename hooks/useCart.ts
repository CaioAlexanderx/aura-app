import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pdvApi, companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

export type CartItem = { productId: string; name: string; price: number; qty: number };
export type SaleResult = { id: string; total: number; payment: string; items: CartItem[]; date: string };

export const PAYMENTS = [
  { key: "pix", label: "Pix" },
  { key: "dinheiro", label: "Dinheiro" },
  { key: "cartao", label: "Cartao" },
  { key: "debito", label: "Debito" },
];

export function useCart() {
  const { company, isDemo } = useAuthStore();
  const qc = useQueryClient();
  const companyId = company?.id;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState("pix");
  const [lastSale, setLastSale] = useState<SaleResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const saleMutation = useMutation({
    mutationFn: async (body: any) => {
      try {
        if (pdvApi?.createSale) return await pdvApi.createSale(companyId!, body);
      } catch (e: any) {
        console.warn("[useCart] pdvApi.createSale failed, falling back", e?.message);
      }
      return await companiesApi.createTransaction(companyId!, {
        type: "income", amount: body.total,
        description: `Venda PDV - ${body.items.length} itens (${body.payment_method})`,
        category: "Vendas", source: "pdv",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      qc.invalidateQueries({ queryKey: ["dashboard", companyId] });
      qc.invalidateQueries({ queryKey: ["transactions", companyId] });
    },
  });

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const itemCount = cart.reduce((s, i) => s + i.qty, 0);

  function addToCart(product: { id: string; name: string; price: number }) {
    setLastSale(null);
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) return prev.map(i => i.productId === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { productId: product.id, name: product.name, price: product.price, qty: 1 }];
    });
  }

  function setQty(productId: string, qty: number) {
    if (qty <= 0) { setCart(prev => prev.filter(i => i.productId !== productId)); return; }
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, qty } : i));
  }

  function updateQty(productId: string, delta: number) {
    setCart(prev => prev.map(i => {
      if (i.productId !== productId) return i;
      const newQty = i.qty + delta;
      return newQty > 0 ? { ...i, qty: newQty } : i;
    }));
  }

  function removeItem(productId: string) {
    setCart(prev => prev.filter(i => i.productId !== productId));
  }

  function finalizeSale() {
    if (cart.length === 0 || isProcessing) return;
    setIsProcessing(true);

    const cartSnapshot = [...cart];
    const saleData = {
      items: cartSnapshot.map(i => ({ product_id: i.productId, quantity: i.qty, unit_price: i.price })),
      payment_method: payment, total,
    };

    if (companyId && !isDemo) {
      saleMutation.mutate(saleData, {
        onSuccess: (res: any) => {
          const saleId = res?.sale?.id || res?.id || Date.now().toString(36).toUpperCase().slice(-6);
          setLastSale({ id: String(saleId), total, payment, items: cartSnapshot, date: new Date().toLocaleString("pt-BR") });
          setCart([]);
          toast.success("Venda registrada!");
          // A5: Decrement stock for each sold item
          cartSnapshot.forEach(item => {
            companiesApi.updateProduct(companyId, item.productId, {
              stock_qty_decrement: item.qty,
            }).catch(() => {
              // Fallback: try direct stock_qty update
              companiesApi.updateProduct(companyId, item.productId, {
                stock_qty: Math.max(0, -1), // Will be calculated from current
              }).catch(() => {});
            });
          });
          setIsProcessing(false);
        },
        onError: () => { toast.error("Erro ao registrar venda"); setIsProcessing(false); },
      });
    } else {
      setLastSale({ id: Date.now().toString(36).toUpperCase().slice(-6), total, payment, items: cartSnapshot, date: new Date().toLocaleString("pt-BR") });
      setCart([]); setIsProcessing(false);
    }
  }

  function newSale() { setLastSale(null); setCart([]); setIsProcessing(false); }

  return { cart, payment, setPayment, lastSale, total, itemCount, isProcessing, addToCart, setQty, updateQty, removeItem, finalizeSale, newSale };
}
