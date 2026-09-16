// ============================================================
// Checkout — o que a tela diz sobre o cupom (11/09/2026)
//
// Prova que:
//  - "R$ 50 nas 3 primeiras mensalidades" mostra 119 por 3 meses e diz
//    quando o valor cheio (169) comeca — nunca "Mensalidades seguintes: 169"
//    como se o desconto fosse so hoje
//  - cupom de 1 mes (percentual ou reais) e de dias gratis seguem como antes
//  - o aviso de desconto em andamento diz ate quando ele vale
//  - "pagar mensalidade em aberto" escolhe a cobranca certa
// ============================================================
import {
  describeCoupon,
  couponKind,
  discountInEffectText,
  pickOpenInvoice,
} from "@/components/billing/couponText";
import type { BillingInvoice } from "@/services/billingApi";

describe("describeCoupon", () => {
  test("R$ 50 nas 3 primeiras mensalidades do Negócio", () => {
    var v = describeCoupon({
      valid: true, code: "NEGOCIO50", discount_pct: 0, discount_value: 50, discount_months: 3, trial_days: 0,
      first_charge_value: 119, recurring_value: 169, discounted_value: 119, discounted_months: 3,
      first_full_charge_date: "2026-12-16",
    }, 169);
    expect(v.kind).toBe("recurring");
    expect(v.title).toBe("NEGOCIO50 · R$ 50,00 nas 3 primeiras mensalidades");
    expect(v.subtitle).toBe("Você paga R$ 119,00 por 3 meses");
    expect(v.summaryLabel).toBe("Cupom NEGOCIO50 (-R$ 50,00 no plano, 3 meses)");
    expect(v.savings).toBe(50);
    expect(v.chargedNow).toBe(119);
    expect(v.afterNote).toBe("A partir da 4ª mensalidade (16/12/2026): R$ 169,00/mês");
    expect(v.toast).toBe("Cupom aplicado: R$ 50,00 de desconto por 3 meses!");
  });

  test("com acesso extra o valor cheio vem do backend (188), não do cálculo da tela", () => {
    var v = describeCoupon({
      valid: true, code: "NEGOCIO50", discount_value: 50, discount_months: 3,
      first_charge_value: 138, recurring_value: 188, discounted_value: 138,
    }, 169);
    expect(v.subtitle).toBe("Você paga R$ 138,00 por 3 meses");
    expect(v.afterNote).toBe("A partir da 4ª mensalidade: R$ 188,00/mês");
  });

  test("50% só na 1ª mensalidade (como sempre foi)", () => {
    var v = describeCoupon({
      valid: true, code: "SHEID50", discount_pct: 50, trial_days: 0, first_charge_value: 84.5, recurring_value: 169,
    }, 169);
    expect(v.kind).toBe("first");
    expect(v.title).toBe("SHEID50 · 50% na 1ª mensalidade");
    expect(v.subtitle).toBe("Você economiza R$ 84,50 hoje");
    expect(v.summaryLabel).toBe("Cupom SHEID50 (-50% no plano)");
    expect(v.afterNote).toBe("Mensalidades seguintes: R$ 169,00/mês");
    expect(v.toast).toBe("Cupom de 50% aplicado!");
  });

  test("backend antigo (sem os campos novos) cai no cupom de 1 mês", () => {
    var v = describeCoupon({ valid: true, code: "REF-X", discount_pct: 20, first_charge_value: 71.2 }, 89);
    expect(v.kind).toBe("first");
    expect(v.savings).toBe(17.8);
    expect(v.afterNote).toBe("Mensalidades seguintes: R$ 89,00/mês");
  });

  test("dias grátis: nada hoje, sem linha de abatimento", () => {
    var v = describeCoupon({
      valid: true, code: "SHEIDMANIA", trial_days: 15, first_charge_value: 0, recurring_value: 169, first_charge_date: "2026-09-26",
    }, 169);
    expect(v.kind).toBe("trial");
    expect(v.chargedNow).toBe(0);
    expect(v.summaryLabel).toBeNull();
    expect(v.subtitle).toBe("Cartão fica salvo. 1ª cobrança em 26/09/2026");
    expect(v.afterNote).toBe("Depois: R$ 169,00/mês a partir de 26/09/2026");
  });

  test("couponKind: dias grátis vence os outros campos", () => {
    expect(couponKind({ valid: true, trial_days: 7, discount_months: 3 })).toBe("trial");
    expect(couponKind({ valid: true, discount_months: 2 })).toBe("recurring");
    expect(couponKind({ valid: true })).toBe("first");
  });
});

test("discountInEffectText diz até quando vale", () => {
  expect(discountInEffectText({ code: "NEGOCIO50", discount_amount: 50, months: 3, first_full_due_date: "2026-12-16" }))
    .toBe("Seu cupom NEGOCIO50 dá R$ 50,00 de desconto em cada mensalidade que vence antes de 16/12/2026.");
});

describe("pickOpenInvoice", () => {
  var inv = function (id: string, status: string, due: string, url: string | null = "https://asaas/i/" + id): BillingInvoice {
    return { id: id, value: 119, status: status, due_date: due, payment_date: null, billing_type: "PIX", invoice_url: url, bank_slip_url: null };
  };

  test("a mensalidade em aberto mais antiga, com link", () => {
    var got = pickOpenInvoice([
      inv("p3", "PENDING", "2026-11-16"),
      inv("p1", "RECEIVED", "2026-09-16"),
      inv("p2", "OVERDUE", "2026-10-16"),
    ]);
    expect(got?.id).toBe("p2");
  });

  test("ignora cobrança sem link e devolve null quando não há o que pagar", () => {
    expect(pickOpenInvoice([inv("p2", "OVERDUE", "2026-10-16", null)])).toBeNull();
    expect(pickOpenInvoice([inv("p1", "CONFIRMED", "2026-09-16")])).toBeNull();
    expect(pickOpenInvoice(undefined)).toBeNull();
  });
});
