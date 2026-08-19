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
//
// 20/07/2026 — paridade fiscal com o Negócio:
//   - Lê nfce_config (getConfig) → fiscalEnabled (is_active) e autoEmitNfce
//     (auto_emit_nfce && is_active), expostos no SaleDone p/ o StageDone.
//   - CPF/CNPJ na nota (opcional) → customer_cpf.
//   - SaleDone carrega items/cliente/pagamento p/ alimentar <NfceActions/>.
// ============================================================
import { useState, useEffect, useCallback } from "react";
import { pdvApi } from "@/services/pdvApi";
import { request } from "@/services/api";
import { couponsApi } from "@/services/couponsApi";
import { nfceApi } from "@/services/nfceApi";
import type { CartLine, SaleDone, PaymentEntry } from "./types";
import {
  round2,
  manualDiscountAmount,
  totalAfter,
  lineListPrice,
  lineSalePrice,
  lineDiscount,
  splitRemaining,
  splitIsBalanced,
  signalBalance,
  signalError,
  prazoSugerido,
  MAX_DISCOUNT_PCT,
} from "./checkoutMath";

/** 'YYYY-MM-DD' → 'DD/MM' pro texto do WhatsApp (sem passar por Date: a
 *  string é data pura e new Date() a interpretaria como UTC). */
function fmtBR(iso: string): string {
  const [, m, d] = String(iso || "").slice(0, 10).split("-");
  return d && m ? `${d}/${m}` : String(iso || "");
}

export function useStudioCheckout(cid: string | undefined) {
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [pay, setPay] = useState("pix");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<SaleDone | null>(null);

  // ── Config fiscal (nfce_config) — gate de exibição + auto-emissão ──
  const [fiscalEnabled, setFiscalEnabled] = useState(false);
  const [autoEmitNfce, setAutoEmitNfce] = useState(false);

  useEffect(() => {
    if (!cid) {
      setFiscalEnabled(false);
      setAutoEmitNfce(false);
      return;
    }
    let alive = true;
    nfceApi
      .getConfig(cid)
      .then((r) => {
        if (!alive) return;
        const cfg = r?.config;
        const active = !!cfg?.is_active;
        setFiscalEnabled(active);
        setAutoEmitNfce(active && !!cfg?.auto_emit_nfce);
      })
      .catch(() => {
        if (!alive) return;
        setFiscalEnabled(false);
        setAutoEmitNfce(false);
      });
    return () => {
      alive = false;
    };
  }, [cid]);

  // ── Desconto manual ──
  const [discountType, setDiscountType] = useState<"%" | "R$">("%");
  const [discountValue, setDiscountValue] = useState("");

  // ── Cupom (Financeiro) ──
  const [couponInput, setCouponInput] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number } | null>(null);
  const [couponValidating, setCouponValidating] = useState(false);
  // Erro do cupom É PRÓPRIO — não usa o `error` geral do finalizeSale, que
  // só aparece lá embaixo do scroll no StageCheckout. Separado, dá pra
  // mostrar inline ao lado do campo (achado de UX/QA).
  const [couponError, setCouponError] = useState<string | null>(null);

  // ── Split de pagamento ──
  const [splitMode, setSplitMode] = useState(false);
  const [splitPayments, setSplitPayments] = useState<PaymentEntry[]>([]);

  // ── Prazo prometido de entrega (K1) ──
  // Já nasce preenchido com uma data plausível: ferramenta fácil de usar não
  // começa com campo vazio. Opcional — limpar o campo é válido e a venda passa.
  const [promisedDate, setPromisedDate] = useState<string>(prazoSugerido);

  // ── Venda com sinal (F3) ──
  // Exclusiva do split: sinal não é split, é forma de pagamento própria em
  // que `sinal + saldo = total` por construção.
  const [signalMode, setSignalMode] = useState(false);
  const [signalValue, setSignalValue] = useState("");
  const [signalMethod, setSignalMethod] = useState("pix");
  const [signalDueDate, setSignalDueDate] = useState("");

  const toggleSignal = useCallback(() => {
    setSignalMode((prev) => {
      const next = !prev;
      if (next) { setSplitMode(false); setSplitPayments([]); }
      return next;
    });
  }, []);

  const clearDiscount = useCallback(() => setDiscountValue(""), []);
  const clearCoupon = useCallback(() => {
    setCouponApplied(null);
    setCouponInput("");
    setCouponError(null);
  }, []);

  /** Valida o cupom digitado contra o Financeiro (subtotal atual). */
  const validateCoupon = useCallback(
    async (subtotal: number) => {
      const code = (couponInput || "").trim();
      if (!cid || !code) return;
      setCouponValidating(true);
      setCouponError(null);
      try {
        const res = await couponsApi.validate(cid, code, subtotal);
        if (res.valid && res.code) {
          setCouponApplied({ code: res.code, discount: res.discount_amount || 0 });
          setCouponInput("");
        } else {
          setCouponError(res.error || "Cupom inválido");
        }
      } catch (e: any) {
        setCouponError(e?.message || "Erro ao validar cupom");
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
        if (next) setSignalMode(false); // split e sinal são exclusivos
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

      // Venda com sinal: validação espelha o backend, que recalcula o total
      // a partir dos itens e manda de verdade.
      const sinalNum = round2(parseFloat((signalValue || "").replace(",", ".")) || 0);
      if (signalMode) {
        const err = signalError(total, sinalNum);
        if (err) { setError(err); return false; }
        if (!signalDueDate) {
          setError("Escolha a data combinada pro saldo.");
          return false;
        }
        // O saldo é de ALGUÉM. Sem nada que identifique, o backend recusa —
        // melhor dizer isso aqui do que voltar 422 depois de tentar.
        if (!customer.trim() && !phone.trim() && !cpf.trim()) {
          setError("Pra vender com sinal, informe ao menos o nome ou o WhatsApp do cliente.");
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
          // 17/08/2026 (F5): o nome do cliente ia em `seller_name` — o campo
          // do VENDEDOR. Na tela de Vendas a venda saía como "Consumidor" e o
          // nome do cliente aparecia na posição de quem vendeu, e o cliente
          // nunca passava a existir no cadastro. Agora vai em `customer`, e o
          // backend resolve ou cria dentro da própria transação da venda.
          customer: {
            name:     customer.trim() || null,
            phone:    phone.trim() ? phone.replace(/\D/g, "") : null,
            cpf_cnpj: cpf.trim() ? cpf.replace(/\D/g, "") : null,
          },
        };
        // K1: prazo combinado. Vazio é legítimo — aí o card do Kanban usa a
        // idade do pedido, como sempre fez, e nada trava.
        if (promisedDate) saleBody.promised_date = promisedDate;
        if (payments) saleBody.payments = payments;
        if (cpf.trim()) saleBody.customer_cpf = cpf.replace(/\D/g, "");

        // Venda com sinal: o endpoint próprio recebe o sinal e a data do
        // saldo, e resolve (ou cria) o cliente na mesma transação da venda.
        // Aqui o cliente vai no campo CERTO — `customer`, não `seller_name` —
        // então a venda com sinal nasce com customer_id preenchido, e o saldo
        // fica atrelado a alguém de verdade.
        if (signalMode) {
          saleBody.sinal = { method: signalMethod, amount: sinalNum };
          saleBody.saldo_due_date = signalDueDate;
          delete saleBody.payments;
          delete saleBody.payment_method;
        }
        if (couponApplied?.code) saleBody.coupon_code = couponApplied.code;
        if (manual > 0) {
          if (discountType === "%") {
            const raw = parseFloat((discountValue || "").replace(",", ".")) || 0;
            saleBody.discount_pct = Math.min(raw, MAX_DISCOUNT_PCT);
          } else {
            saleBody.discount_amount = manual;
          }
        }

        const saleRes = signalMode
          ? await pdvApi.createSaleComSinal(cid, saleBody)
          : await pdvApi.createSale(cid, saleBody);
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
          // Com sinal, o comprovante que ela manda precisa deixar claro o que
          // entrou e o que ficou combinado — é o registro do acerto.
          const corpo = signalMode
            ? `Pedido #${String(saleId).slice(0, 8)} · total R$ ${total.toFixed(2)}\n` +
              `Sinal recebido: R$ ${sinalNum.toFixed(2)}\n` +
              `Saldo de R$ ${signalBalance(total, sinalNum).toFixed(2)} pra ${fmtBR(signalDueDate)}\n\n` +
              `Em breve te mando o mockup pra aprovação.`
            : `Pedido #${String(saleId).slice(0, 8)} · R$ ${total.toFixed(2)}\n\n` +
              `Em breve te mando o mockup pra aprovação.`;
          // K3: o link de acompanhamento viaja AQUI, na mensagem que a venda
          // já gerava. A lojista não copia, não gera e não ativa nada — e o
          // cliente para de perguntar "cadê meu pedido?" porque tem onde ver.
          const track = saleRes?.track_url ? `\n\nAcompanhe por aqui: ${saleRes.track_url}` : "";
          const msg = encodeURIComponent(`Oi ${first}! Sua arte personalizada já está na produção\n` + corpo + track);
          waLink = `https://wa.me/${ph}?text=${msg}`;
        }

        // Itens enxutos p/ NFC-e (preço de venda efetivo por unidade).
        const fiscalItems = cart.map((l) => ({
          product_id: l.product.id,
          product_name: l.product.name,
          quantity: l.qty,
          unit_price: round2(lineSalePrice(l)),
        }));

        setDone({
          sale_id: saleId,
          total: parseFloat(saleRes?.sale?.total_amount || String(total)),
          wa_link: waLink,
          items: fiscalItems,
          customer_name: customer.trim() || null,
          customer_cpf: cpf.trim() ? cpf.replace(/\D/g, "") : null,
          customer_phone: phone.trim() || null,
          payment_method: signalMode ? signalMethod : primaryPayment,
          payments,
          auto_emit: autoEmitNfce,
          fiscal_enabled: fiscalEnabled,
          // Vem do backend, que é quem calcula o saldo a partir do total real.
          track_url: saleRes?.track_url || null,
          signal: signalMode
            ? {
                amount:           Number(saleRes?.signal?.amount ?? sinalNum),
                method:           String(saleRes?.signal?.method ?? signalMethod),
                balance:          Number(saleRes?.signal?.balance ?? signalBalance(total, sinalNum)),
                balance_due_date: String(saleRes?.signal?.balance_due_date ?? signalDueDate),
              }
            : null,
        });
        return true;
      } catch (e: any) {
        setError(e?.message || "Erro ao fechar venda");
        return false;
      } finally {
        setSending(false);
      }
    },
    [cid, pay, notes, customer, phone, cpf, discountType, discountValue, couponApplied, splitMode, splitPayments, autoEmitNfce, fiscalEnabled, signalMode, signalValue, signalMethod, signalDueDate, promisedDate],
  );

  const reset = useCallback(() => {
    setCustomer("");
    setPhone("");
    setCpf("");
    setNotes("");
    setDone(null);
    setError(null);
    setDiscountValue("");
    setDiscountType("%");
    setCouponInput("");
    setCouponApplied(null);
    setCouponError(null);
    setSplitMode(false);
    setSplitPayments([]);
    setPay("pix");
    setPromisedDate(prazoSugerido());
    setSignalMode(false);
    setSignalValue("");
    setSignalMethod("pix");
    setSignalDueDate("");
  }, []);

  return {
    customer, setCustomer, phone, setPhone, cpf, setCpf, pay, setPay, notes, setNotes,
    sending, error, setError, done, finalizeSale, reset,
    // fiscal
    fiscalEnabled, autoEmitNfce,
    // desconto
    discountType, setDiscountType, discountValue, setDiscountValue, clearDiscount,
    // cupom
    couponInput, setCouponInput, couponApplied, couponValidating, couponError, validateCoupon, clearCoupon,
    // split
    splitMode, splitPayments, toggleSplit, addSplit, updateSplit, removeSplit,
    // prazo prometido (K1)
    promisedDate, setPromisedDate,
    // venda com sinal (F3)
    signalMode, toggleSignal,
    signalValue, setSignalValue,
    signalMethod, setSignalMethod,
    signalDueDate, setSignalDueDate,
  };
}
