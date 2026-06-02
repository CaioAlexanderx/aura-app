// ============================================================
// AURA STUDIO · PDV — hook do checkout (Fase 6)
// finalizeSale: POST /pdv/sale → PATCH customization (só itens
// personalizáveis) → monta wa.me. Invariantes preservados do
// caixa.tsx atual (sale_payments via POST, sync sale_date no backend).
// ============================================================
import { useState, useCallback } from "react";
import { pdvApi } from "@/services/pdvApi";
import { request } from "@/services/api";
import type { CartLine, SaleDone } from "./types";

export function useStudioCheckout(cid: string | undefined) {
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [pay, setPay] = useState("pix");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<SaleDone | null>(null);

  const finalizeSale = useCallback(
    async (cart: CartLine[], subtotal: number): Promise<boolean> => {
      if (!cid || cart.length === 0) { setError("Carrinho vazio"); return false; }
      setSending(true); setError(null);
      try {
        const saleBody: any = {
          items: cart.map((l) => ({
            product_id: l.product.id,
            quantity: l.qty,
            unit_price: l.product.price,
            product_name_snapshot: l.product.name,
          })),
          payment_method: pay,
          notes: notes.trim() || null,
          seller_name: customer.trim() || null,
        };
        const saleRes = await pdvApi.createSale(cid, saleBody);
        const saleId = saleRes?.sale?.id;
        const saleItems: any[] = saleRes?.sale?.items || [];

        // PATCH customization — só itens personalizáveis
        const patches: Promise<any>[] = [];
        for (let i = 0; i < cart.length; i++) {
          const line = cart[i];
          const si = saleItems[i];
          if (!si?.id) continue;
          if (!line.product.is_personalizable) continue;
          patches.push(
            request<any>("/companies/" + cid + "/studio/sale-items/" + si.id + "/customization", {
              method: "PATCH", body: { customization: line.values },
            }).catch((err) => console.warn("[studio-pdv] patch customization fail:", err?.message))
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
            `Pedido #${String(saleId).slice(0, 8)} · R$ ${subtotal.toFixed(2)}\n\n` +
            `Em breve te mando o mockup pra aprovação.`
          );
          waLink = `https://wa.me/${ph}?text=${msg}`;
        }

        setDone({ sale_id: saleId, total: parseFloat(saleRes?.sale?.total_amount || subtotal), wa_link: waLink });
        return true;
      } catch (e: any) {
        setError(e?.message || "Erro ao fechar venda");
        return false;
      } finally {
        setSending(false);
      }
    },
    [cid, pay, notes, customer, phone]
  );

  const reset = useCallback(() => {
    setCustomer(""); setPhone(""); setNotes(""); setDone(null); setError(null);
  }, []);

  return {
    customer, setCustomer, phone, setPhone, pay, setPay, notes, setNotes,
    sending, error, setError, done, finalizeSale, reset,
  };
}
