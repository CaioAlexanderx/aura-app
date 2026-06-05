// ============================================================
// AURA STUDIO · PDV — hook do checkout (Fase 6 + paridade Negócio 05/06)
//
// finalizeSale: POST /pdv/sale → PATCH customization (só itens
// personalizáveis) → monta wa.me. Invariantes preservados do caixa.tsx
// (sale_payments via POST, sync sale_date no backend).
//
// 05/06/2026 — porta do PDV Negócio (frontend only; backend já aceita):
//   - Desconto manual %/R$ (teto 50%) → discount_pct / discount_amount
//   - Cupom do Financeiro (couponsApi.validate) → coupon_code
//   - Split de pagamento → payments[] (valida balanceamento antes do POST)
//   - Lápis de preço por item → unit_price (tabela) + item_discount (diff)
// ============================================================
import { useState, useCallback } from "react";
import { pdvApi } from "@/services/pdvApi";
import { request } from "@/services/api";
import { couponsApi } from "@/services/couponsApi";
import type { CartLine, SaleDone, PaymentEntry } from "./types";
import {
  round2,
  manualDiscountAmount,
  totalAfter,
  lineListPrice,
  lineDiscount,
  splitRemaining,
  splitIsBalanced,
  MAX_DISCOUNT_PCT,
} from "./checkoutMath";

export function useStudioCheckout(cid: string | undefined) {
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [pay, setPay] = useState("pix");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<SaleDone | null>(null);

  // ── Desconto manual ──
  const [discountType, setDiscountType] = useState<"%" | "R$">("%");
  const [discountValue, setDiscountValue] = useState("");

  // ── Cupom (Financeiro) ──
  const [couponInput, setCouponInput] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number } | null>(null);
  const [couponValidating, setCouponValidating] = useState(false);

  // ── Split de pagamento ──
  const [splitMode, setSplitMode] = useState(false);
  const [splitPayments, setSplitPayments] = useState<PaymentEntry[]>([]);

  const clearDiscount = useCallback(() => setDiscountValue(""), []);
  const clearCoupon = useCallback(() => {
    setCouponApplied(null);
    setCouponInput("");
  }, []);

  /** Valida o cupom digitado contra o Financeiro (subtotal atual). */
  const validateCoupon = useCallback(
    async (subtotal: number) => {
      const code = (couponInput || "").trim();
      if (!cid || !code) return;
      setCouponValidating(true);
      setError(null);
      try {
        const res = await couponsApi.validate(cid, code, subtotal);
        if (res.valid && res.code) {
          setCouponApplied({ code: res.code, discount: res.discount_amount || 0 });
          setCouponInput("");
        } else {
          setError(res.error || "Cupom inválido");
        }
      } catch (e: any) {
        setError(e?.message || "Erro ao validar cupom");
      } finally {
        setCouponValidating(false);
      }
    },
    [cid, couponInput],
  );

  // ── Split helpers — recebem o total (subtotal − descontos) do orquestrador ──
  const toggleSplit = useCallback(
    (total: number) => {
      setSplitMode((prev) => {
        const next = !prev;
        setSplitPayments(next ? [{ method: pay, value: round2(total) }] : []);
        return next;
      });
    },
    [pay],
  );

  const addSplit = useCallback((total: number) => {
    setSplitPayments((prev) => {
      const used = prev.reduce((s, p) => s + (Number(p.value) || 0), 0);
      return [...prev, { method: "dinheiro", value: round2(Math.max(0, total - used)) }];
    });
  }, []);

  const updateSplit = useCallback((idx: number, patch: Partial<PaymentEntry>) => {
    setSplitPayments((prev) =>
      prev.map((p, i) =>
        i === idx
          ? {
              ...p,
              ...(patch.method !== undefined ? { method: patch.method } : {}),
              ...(patch.value !== undefined ? { value: round2(patch.value) } : {}),
            }
          : p,
      ),
    );
  }, []);

  const removeSplit = useCallback((idx: number) => {
    setSplitPayments((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const finalizeSale = useCallback(
    async (cart: CartLine[], subtotal: number): Promise<boolean> => {
      if (!cid || cart.length === 0) {
        setError("Carrinho vazio");
        return false;
      }

      const manual = manualDiscountAmount(subtotal, discountType, discountValue);
      const couponDiscount = couponApplied?.discount || 0;
      const total = totalAfter(subtotal, manual, couponDiscount);

      // Split precisa fechar com o total antes de enviar.
      if (splitMode) {
        if (!splitIsBalanced(total, splitPayments)) {
          const rem = splitRemaining(total, splitPayments);
          setError(
            rem > 0
              ? `Faltam R$ ${rem.toFixed(2)} pra fechar`
              : `Sobrando R$ ${Math.abs(rem).toFixed(2)} nos pagamentos`,
          );
          return false;
        }
      }

      setSending(true);
      setError(null);
      try {
        const primaryPayment =
          splitMode && splitPayments.length > 0 ? splitPayments[0].method : pay;
        const payments =
          splitMode && splitPayments.length > 0
            ? splitPayments.map((p) => ({ method: p.method, value: round2(p.value) }))
            : undefined;

        const saleBody: any = {
          items: cart.map((l) => {
            const listPrice = lineListPrice(l);
            const disc = lineDiscount(l);
            return {
              product_id: l.product.id,
              quantity: l.qty,
              unit_price: listPrice,
              item_discount: disc > 0 ? disc : undefined,
              product_name_snapshot: l.product.name,
            };
          }),
          payment_method: primaryPayment,
          notes: notes.trim() || null,
          seller_name: customer.trim() || null,
        };
        if (payments) saleBody.payments = payments;
        if (couponApplied?.code) saleBody.coupon_code = couponApplied.code;
        if (manual > 0) {
          if (discountType === "%") {
            const raw = parseFloat((discountValue || "").replace(",", ".")) || 0;
            saleBody.discount_pct = Math.min(raw, MAX_DISCOUNT_PCT);
          } else {
            saleBody.discount_amount = manual;
          }
        }

        const saleRes = await pdvApi.createSale(cid, saleBody);
        const saleId = saleRes?.sale?.id;
        const saleItems: any[] = saleRes?.sale?.items || [];

        // PATCH customization — só itens personalizáveis (inalterado da Fase 6)
        const patches: Promise<any>[] = [];
        for (let i = 0; i < cart.length; i++) {
          const line = cart[i];
          const si = saleItems[i];
          if (!si?.id) continue;
          if (!line.product.is_personalizable) continue;
          patches.push(
            request<any>("/companies/" + cid + "/studio/sale-items/" + si.id + "/customization", {
              method: "PATCH",
              body: { customization: line.values },
            }).catch((err) => console.warn("[studio-pdv] patch customization fail:", err?.message)),
          );
        }
        await Promise.allSettled(patches);

        let waLink: string | null = null;
        if (phone.trim()) {
          const digits = phone.replace(/\D/g, "");
          const ph = digits.startsWith("55") ? digits : "55" + digits;
          const first = customer.split(" ")[0] || "tudo bem";
          const msg = encodeURIComponent(
            `Oi ${first}! Sua arte personalizada já está na produção\n` +
              `Pedido #${String(saleId).slice(0, 8)} · R$ ${total.toFixed(2)}\n\n` +
              `Em breve te mando o mockup pra aprovação.`,
          );
          waLink = `https://wa.me/${ph}?text=${msg}`;
        }

        setDone({
          sale_id: saleId,
          total: parseFloat(saleRes?.sale?.total_amount || String(total)),
          wa_link: waLink,
        });
        return true;
      } catch (e: any) {
        setError(e?.message || "Erro ao fechar venda");
        return false;
      } finally {
        setSending(false);
      }
    },
    [cid, pay, notes, customer, phone, discountType, discountValue, couponApplied, splitMode, splitPayments],
  );

  const reset = useCallback(() => {
    setCustomer("");
    setPhone("");
    setNotes("");
    setDone(null);
    setError(null);
    setDiscountValue("");
    setDiscountType("%");
    setCouponInput("");
    setCouponApplied(null);
    setSplitMode(false);
    setSplitPayments([]);
    setPay("pix");
  }, []);

  return {
    customer, setCustomer, phone, setPhone, pay, setPay, notes, setNotes,
    sending, error, setError, done, finalizeSale, reset,
    // desconto
    discountType, setDiscountType, discountValue, setDiscountValue, clearDiscount,
    // cupom
    couponInput, setCouponInput, couponApplied, couponValidating, validateCoupon, clearCoupon,
    // split
    splitMode, splitPayments, toggleSplit, addSplit, updateSplit, removeSplit,
  };
}
