// ============================================================
// AURA. — Textos do cupom no checkout (11/09/2026)
//
// O cupom tem tres formas, e cada uma precisa dizer ao cliente uma coisa
// diferente sobre o que ele paga HOJE e DEPOIS:
//
//   trial      → dias gratis; nada hoje, cartao salvo
//   first      → desconto so na 1a mensalidade (percentual ou reais)
//   recurring  → desconto nas N primeiras mensalidades
//                ("R$ 50,00 nas 3 primeiras mensalidades")
//
// Fica fora da tela para ser testado sem renderizar: e aqui que um "R$ 119
// hoje" pode virar, por engano, "R$ 119 para sempre".
// ============================================================
import type { BillingDiscount, BillingInvoice, ValidateCouponResponse } from "@/services/billingApi";

export function fmtBRL(v: number) {
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDateBR(iso?: string | null) {
  if (!iso) return "—";
  var p = String(iso).slice(0, 10).split("-");
  return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : String(iso);
}

export type CouponKind = "trial" | "first" | "recurring";

export type CouponView = {
  kind: CouponKind;
  toast: string;
  title: string;           // linha do cupom aplicado
  subtitle: string;
  summaryLabel: string | null; // linha de abatimento no resumo (null = nao mostra)
  savings: number;         // quanto abate de cada mensalidade com desconto
  chargedNow: number;      // o que o botao cobra hoje
  afterNote: string;       // texto sob o total
};

export function couponKind(c: ValidateCouponResponse): CouponKind {
  if ((c.trial_days || 0) > 0) return "trial";
  if ((c.discount_months || 1) > 1) return "recurring";
  return "first";
}

function offLabel(c: ValidateCouponResponse, savings: number) {
  if ((c.discount_pct || 0) > 0) return c.discount_pct + "%";
  return fmtBRL(c.discount_value || savings);
}

/**
 * @param totalPrice valor cheio calculado na tela (plano + acessos extras);
 *   usado so quando o backend nao devolveu recurring_value.
 */
export function describeCoupon(c: ValidateCouponResponse, totalPrice: number): CouponView {
  var kind = couponKind(c);
  var code = c.code || "";
  var recurring = c.recurring_value ?? totalPrice;
  var mo = function (v: number) { return fmtBRL(v) + "/mês"; };

  if (kind === "trial") {
    var days = c.trial_days || 0;
    return {
      kind: kind,
      toast: days + " dias grátis aplicados!",
      title: days + " dias grátis · " + code,
      subtitle: "Cartão fica salvo. 1ª cobrança em " + fmtDateBR(c.first_charge_date),
      summaryLabel: null,
      savings: 0,
      chargedNow: 0,
      afterNote: "Depois: " + mo(recurring) + " a partir de " + fmtDateBR(c.first_charge_date),
    };
  }

  var chargedNow = c.first_charge_value ?? recurring;
  var savings = Math.round((recurring - chargedNow) * 100) / 100;
  var off = offLabel(c, savings);

  if (kind === "recurring") {
    var n = c.discount_months || 1;
    return {
      kind: kind,
      toast: "Cupom aplicado: " + off + " de desconto por " + n + " meses!",
      title: code + " · " + off + " nas " + n + " primeiras mensalidades",
      subtitle: "Você paga " + fmtBRL(c.discounted_value ?? chargedNow) + " por " + n + " meses",
      summaryLabel: "Cupom " + code + " (-" + off + " no plano, " + n + " meses)",
      savings: savings,
      chargedNow: chargedNow,
      afterNote: "A partir da " + (n + 1) + "ª mensalidade" +
        (c.first_full_charge_date ? " (" + fmtDateBR(c.first_full_charge_date) + ")" : "") +
        ": " + mo(recurring),
    };
  }

  return {
    kind: kind,
    toast: "Cupom de " + off + " aplicado!",
    title: code + " · " + off + " na 1ª mensalidade",
    subtitle: "Você economiza " + fmtBRL(savings) + " hoje",
    summaryLabel: "Cupom " + code + " (-" + off + " no plano)",
    savings: savings,
    chargedNow: chargedNow,
    afterNote: "Mensalidades seguintes: " + mo(recurring),
  };
}

/** Texto do aviso para quem tem desconto em andamento e esta no checkout. */
export function discountInEffectText(d: BillingDiscount) {
  return "Seu cupom " + d.code + " dá " + fmtBRL(d.discount_amount) +
    " de desconto em cada mensalidade que vence antes de " + fmtDateBR(d.first_full_due_date) + ".";
}

export var DISCOUNT_LOSS_TEXT =
  "Assinar de novo (trocar de plano, de ciclo ou de forma de pagamento) encerra o desconto: " +
  "as próximas mensalidades passam a ser cobradas no valor cheio, e o cupom não pode ser usado outra vez.";

var OPEN_STATUSES = ["PENDING", "OVERDUE"];

/**
 * Mensalidade em aberto mais antiga, com link de pagamento. E o que o cliente
 * com desconto deve pagar em vez de assinar de novo (que perderia o desconto).
 */
export function pickOpenInvoice(invoices: BillingInvoice[] | null | undefined): BillingInvoice | null {
  var open = (invoices || []).filter(function (i) {
    return OPEN_STATUSES.indexOf(String(i.status).toUpperCase()) >= 0 && !!i.invoice_url;
  });
  open.sort(function (a, b) { return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0; });
  return open[0] || null;
}
