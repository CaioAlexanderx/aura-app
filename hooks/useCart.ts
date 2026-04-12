import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pdvApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

export type CartItem = { productId: string; name: string; price: number; qty: number };
export type SaleResult = { id: string; total: number; payment: string; items: CartItem[]; date: string; customerName?: string; employeeName?: string };

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

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string | null>(null);

  // BUGFIX P1 #1+#2: Use pdvApi.createSale directly (no fallback).
  // Backend POST /pdv/sale handles: sale + items + stock decrement + customer metrics + employee metrics.
  // No redundant stock decrement call needed.
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

  function selectCustomer(id: string | null, name: string | null) {
    setSelectedCustomerId(id);
    setSelectedCustomerName(name);
  }

  function selectEmployee(id: string | null, name: string | null) {
    setSelectedEmployeeId(id);
    setSelectedEmployeeName(name);
  }

  function finalizeSale() {
    if (cart.length === 0 || isProcessing) return;
    setIsProcessing(true);

    const cartSnapshot = [...cart];
    const saleData = {
      items: cartSnapshot.map(i => ({
        product_id: i.productId,
        quantity: i.qty,
        unit_price: i.price,
        product_name_snapshot: i.name,
      })),
      payment_method: payment,
      customer_id: selectedCustomerId || undefined,
      employee_id: selectedEmployeeId || undefined,
    };

    if (companyId && !isDemo) {
      saleMutation.mutate(saleData, {
        onSuccess: (res: any) => {
          const saleId = res?.sale?.id || res?.id || Date.now().toString(36).toUpperCase().slice(-6);
          setLastSale({
            id: String(saleId), total, payment, items: cartSnapshot,
            date: new Date().toLocaleString("pt-BR"),
            customerName: selectedCustomerName || undefined,
            employeeName: selectedEmployeeName || undefined,
          });
          setCart([]);
          toast.success("Venda registrada!");
          // Stock decrement is handled by backend inside the sale transaction.
          // DO NOT call companiesApi.updateProduct here (would cause double decrement).
          setIsProcessing(false);
        },
        onError: (err: any) => {
          toast.error(err?.message || "Erro ao registrar venda");
          setIsProcessing(false);
        },
      });
    } else {
      setLastSale({
        id: Date.now().toString(36).toUpperCase().slice(-6), total, payment, items: cartSnapshot,
        date: new Date().toLocaleString("pt-BR"),
        customerName: selectedCustomerName || undefined,
        employeeName: selectedEmployeeName || undefined,
      });
      setCart([]); setIsProcessing(false);
    }
  }

  function newSale() {
    setLastSale(null);
    setCart([]);
    setIsProcessing(false);
    setSelectedCustomerId(null);
    setSelectedCustomerName(null);
    setSelectedEmployeeId(null);
    setSelectedEmployeeName(null);
  }

  return {
    cart, payment, setPayment, lastSale, total, itemCount, isProcessing,
    addToCart, setQty, updateQty, removeItem, finalizeSale, newSale,
    selectedCustomerId, selectedCustomerName, selectCustomer,
    selectedEmployeeId, selectedEmployeeName, selectEmployee,
  };
}
