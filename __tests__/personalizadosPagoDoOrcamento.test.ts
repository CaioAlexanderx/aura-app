// A2 do QA de Personalizados (26/11/2026): pedido de orçamento aprovado
// ("confirmed") não é pedido pago. Vale o que entrou (sinal e saldo).
import { situacaoDoPagamento, situacaoDoPixNoCartao, avisoDoCancelamento } from "@/components/studio/pagamentoDoPedido";

const orc = (extra: Record<string, any> = {}) => ({
  id: "o1", source: "digital", status: "confirmed", payment_method: "pix", payment_status: "pending",
  total: 111.7, orcamento_recebido: 0, orcamento_falta_receber: 111.7,
  orcamento_pagamentos_pendentes: [{ id: "p1", kind: "deposit", amount: 55.85 }], ...extra,
});

describe("pedido de orçamento aprovado", () => {
  test("nada recebido: A receber, não Pago", () => {
    const s = situacaoDoPagamento(orc());
    expect(s.rotulo).toBe("A receber");
    expect(s.chave).toBe("a_receber");
    expect(situacaoDoPixNoCartao(orc())).toEqual({ rotulo: "A receber", tom: "atencao" });
  });
  test("sinal recebido: mostra o que falta", () => {
    const p = orc({ orcamento_recebido: 55.85, orcamento_falta_receber: 55.85 });
    expect(situacaoDoPagamento(p).rotulo).toBe("Sinal recebido · falta R$ 55,85");
    expect(situacaoDoPixNoCartao(p)?.rotulo).toBe("Sinal recebido");
  });
  test("quitado: Pago", () => {
    const p = orc({ orcamento_recebido: 111.7, orcamento_falta_receber: 0, orcamento_pagamentos_pendentes: [] });
    expect(situacaoDoPagamento(p).chave).toBe("pago");
    expect(situacaoDoPixNoCartao(p)?.rotulo).toBe("Pix recebido");
  });
  test("payment_status pago continua Pago", () => {
    expect(situacaoDoPagamento(orc({ payment_status: "paid" })).chave).toBe("pago");
  });
  test("aviso de cancelamento só fala em valor que entrou quando entrou", () => {
    expect(avisoDoCancelamento(orc())).not.toMatch(/já entrou/);
    expect(avisoDoCancelamento(orc({ orcamento_recebido: 55.85 }))).toMatch(/já entrou/);
  });
});

describe("pedido comum da loja online (regressão)", () => {
  test("status confirmed sem campos de orçamento segue Pago", () => {
    const p = { id: "o2", source: "digital", status: "confirmed", payment_method: "pix", payment_status: "pending", total: 49.9 };
    expect(situacaoDoPagamento(p).chave).toBe("pago");
    expect(situacaoDoPixNoCartao(p)?.rotulo).toBe("Pix recebido");
  });
});
