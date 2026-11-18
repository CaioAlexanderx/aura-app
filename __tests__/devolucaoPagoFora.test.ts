// 18/11/2026 (Aura-backend#1081): a devolução do crediário avisa a parte da
// venda paga fora do crediário (ex.: 40 no dinheiro + 60 no crediário).
import { avisoDoPagoFora } from "@/components/crediario/avisoDoPagoFora";

describe("aviso da parte paga fora do crediário", () => {
  test("com valor: o texto para devolver pela Troca", () => {
    expect(avisoDoPagoFora({ pago_fora_do_crediario: 40 }))
      .toBe("R$ 40,00 foram pagos em dinheiro: devolva pela Troca, em dinheiro ou crédito.");
    expect(avisoDoPagoFora({ pago_fora_do_crediario: 1234.5 }))
      .toBe("R$ 1.234,50 foram pagos em dinheiro: devolva pela Troca, em dinheiro ou crédito.");
  });

  test("sem o campo (backend antigo, venda toda no crediário): sem aviso", () => {
    expect(avisoDoPagoFora({})).toBeNull();
    expect(avisoDoPagoFora({ pago_fora_do_crediario: 0 })).toBeNull();
    expect(avisoDoPagoFora(null)).toBeNull();
  });
});
