// ============================================================
// Painel Studio · situação do pagamento do pedido da vitrine (A1, 26/09/2026)
//
// P0 do QA da lojista: o pedido pago pela chave Pix ficava sem baixa no
// painel Studio e o job de 72 h o cancelava. Aqui trava a leitura que o
// bloco "Pagamento" do detalhe e o selo da fila fazem do pedido.
// ============================================================
import {
  situacaoDoPagamento, acoesDoPagamento, formaDoPagamento, reais, temBlocoDePagamento,
  comprovanteEhPdf, seloDoPagamentoNaFila, totalDoPedido,
} from "@/components/studio/pagamentoDoPedido";

const pix = (extra: Record<string, any> = {}) => ({
  id: "o1", source: "digital", status: "pending_payment", payment_method: "pix",
  payment_status: "pending", total: 49.9, order_number: 42, ...extra,
});

describe("reais", () => {
  test("vírgula nos centavos e ponto no milhar, nunca 49.90", () => {
    expect(reais(49.9)).toBe("R$ 49,90");
    expect(reais("89.82")).toBe("R$ 89,82");
    expect(reais(1234.5)).toBe("R$ 1.234,50");
    expect(reais(1234567)).toBe("R$ 1.234.567,00");
    expect(reais(0)).toBe("R$ 0,00");
  });
  test("sem valor não vira R$ NaN", () => {
    expect(reais(null)).toBe("R$ —");
    expect(reais(undefined)).toBe("R$ —");
    expect(reais("abc")).toBe("R$ —");
  });
});

describe("formaDoPagamento", () => {
  test("rótulos em português", () => {
    expect(formaDoPagamento("pix")).toBe("Pix");
    expect(formaDoPagamento("card")).toBe("Cartão");
    expect(formaDoPagamento("on_delivery")).toBe("Na retirada/entrega");
  });
});

describe("situacaoDoPagamento", () => {
  test("Pix sem aviso: aguardando, pede ação", () => {
    expect(situacaoDoPagamento(pix())).toMatchObject({ chave: "aguardando", rotulo: "Aguardando pagamento", tom: "atencao", precisaAgir: true });
  });

  test("cliente tocou em Já paguei: cliente disse que pagou", () => {
    expect(situacaoDoPagamento(pix({ status: "awaiting_approval" })))
      .toMatchObject({ rotulo: "Cliente disse que pagou", precisaAgir: true });
  });

  test("comprovante anexado vence o Já paguei, e também sem ele (status continua pending_payment)", () => {
    const url = "https://cdn/x/proof.jpg?v=1";
    expect(situacaoDoPagamento(pix({ payment_proof_url: url })).rotulo).toBe("Comprovante enviado");
    expect(situacaoDoPagamento(pix({ status: "awaiting_approval", payment_proof_url: url })).rotulo).toBe("Comprovante enviado");
  });

  test("pago: pela baixa (payment_status) ou pelo pedido já andando", () => {
    expect(situacaoDoPagamento(pix({ status: "confirmed", payment_status: "confirmed" }))).toMatchObject({ rotulo: "Pago", tom: "sucesso", precisaAgir: false });
    expect(situacaoDoPagamento(pix({ status: "preparing", payment_status: "pending" })).rotulo).toBe("Pago");
  });

  test("vencido pelo job de 72 h x cancelado pela lojista", () => {
    expect(situacaoDoPagamento(pix({ status: "cancelled", payment_status: "expired" }))).toMatchObject({ rotulo: "Vencido", precisaAgir: false });
    expect(situacaoDoPagamento(pix({ status: "cancelled", payment_status: "cancelled" })).rotulo).toBe("Cancelado");
  });

  test("cartão pendente não pede ação (o Mercado Pago confirma)", () => {
    expect(situacaoDoPagamento(pix({ payment_method: "card" }))).toMatchObject({ chave: "aguardando_cartao", precisaAgir: false });
  });

  test("na retirada/entrega: a receber até entregar", () => {
    expect(situacaoDoPagamento(pix({ payment_method: "on_delivery", status: "confirmed" })).rotulo).toBe("A receber na retirada/entrega");
    expect(situacaoDoPagamento(pix({ payment_method: "on_delivery", status: "delivered" })).rotulo).toBe("Pago");
  });
});

describe("acoesDoPagamento", () => {
  test("Pix pendente: Confirmar pagamento recebido", () => {
    expect(acoesDoPagamento(pix())).toEqual({ podeAgir: true, rotuloConfirmar: "Confirmar pagamento recebido" });
  });
  test("aguardando aprovação: Aprovar pagamento", () => {
    expect(acoesDoPagamento(pix({ status: "awaiting_approval" }))).toEqual({ podeAgir: true, rotuloConfirmar: "Aprovar pagamento" });
  });
  test("sem ação: cartão, pago, cancelado", () => {
    expect(acoesDoPagamento(pix({ payment_method: "card" })).podeAgir).toBe(false);
    expect(acoesDoPagamento(pix({ status: "confirmed" })).podeAgir).toBe(false);
    expect(acoesDoPagamento(pix({ status: "cancelled" })).podeAgir).toBe(false);
  });
});

describe("temBlocoDePagamento", () => {
  test("só pedido da vitrine com os campos do backend novo", () => {
    expect(temBlocoDePagamento(pix())).toBe(true);
    expect(temBlocoDePagamento(pix({ payment_method: undefined }))).toBe(false);
    expect(temBlocoDePagamento(pix({ source: "pdv" }))).toBe(false);
    expect(temBlocoDePagamento(null)).toBe(false);
  });
  test("total: prefere o de digital_orders, cai no da view", () => {
    expect(totalDoPedido({ total: 10, total_amount: 9 })).toBe(10);
    expect(totalDoPedido({ total_amount: 9 })).toBe(9);
  });
});

describe("comprovanteEhPdf", () => {
  test("reconhece o PDF com ?v= do R2", () => {
    expect(comprovanteEhPdf("https://cdn/c/orders/o/proof.pdf?v=123")).toBe(true);
    expect(comprovanteEhPdf("https://cdn/c/orders/o/proof.jpg?v=123")).toBe(false);
    expect(comprovanteEhPdf(null)).toBe(false);
  });
});

describe("seloDoPagamentoNaFila", () => {
  test("hub: a etapa fica em status, a situação em order_status", () => {
    expect(seloDoPagamentoNaFila({ status: "pending_art", order_status: "awaiting_approval", payment_method: "pix" }))
      .toEqual({ rotulo: "Pagamento a conferir", tom: "atencao" });
    expect(seloDoPagamentoNaFila({ status: "pending_art", order_status: "pending_payment", payment_method: "pix", has_payment_proof: true }))
      .toEqual({ rotulo: "Pagamento a conferir", tom: "atencao" });
    expect(seloDoPagamentoNaFila({ status: "pending_art", order_status: "pending_payment", payment_method: "pix" }))
      .toEqual({ rotulo: "Aguardando Pix", tom: "neutro" });
  });
  test("nada a dizer: pago, cartão, na entrega, backend antigo no hub", () => {
    expect(seloDoPagamentoNaFila({ status: "pending_art", order_status: "confirmed", payment_method: "pix" })).toBeNull();
    expect(seloDoPagamentoNaFila({ order_status: "pending_payment", payment_method: "card" })).toBeNull();
    expect(seloDoPagamentoNaFila({ order_status: "confirmed", payment_method: "on_delivery" })).toBeNull();
    expect(seloDoPagamentoNaFila({ status: "pending_art" })).toBeNull();
  });
});
