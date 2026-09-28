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
  cpfCnpjFormatado, linhaDeEntrega, linhasDePagamentoEEntrega, motivoDoPixVencido,
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

// ── Pagamento e entrega (LJ-32, QA rodada 2, 28/09/2026) ─────────────────
describe("cpfCnpjFormatado", () => {
  test("CPF (11 dígitos) e CNPJ (14) mascarados; o resto passa como veio", () => {
    expect(cpfCnpjFormatado("52998224725")).toBe("529.982.247-25");
    expect(cpfCnpjFormatado("12345678000190")).toBe("12.345.678/0001-90");
    expect(cpfCnpjFormatado("  529.982.247-25  ")).toBe("529.982.247-25");
    expect(cpfCnpjFormatado(null)).toBeNull();
    expect(cpfCnpjFormatado("")).toBeNull();
  });
});

describe("linhaDeEntrega", () => {
  test("sem delivery_type (backend antigo): null", () => {
    expect(linhaDeEntrega({})).toBeNull();
  });
  test("pickup com e sem endereço da loja", () => {
    expect(linhaDeEntrega({ delivery_type: "pickup", retirada_endereco: "Av Napoleão, 123" }))
      .toBe("Retirada na loja · Av Napoleão, 123");
    expect(linhaDeEntrega({ delivery_type: "pickup" })).toBe("Retirada na loja");
  });
  test("delivery com endereço completo, ou composto de bairro/cidade", () => {
    expect(linhaDeEntrega({ delivery_type: "delivery", delivery_address: "Rua X, 1 - Centro" }))
      .toBe("Receber em casa · Rua X, 1 - Centro");
    expect(linhaDeEntrega({ delivery_type: "delivery", address_neighborhood: "Centro", address_city: "SJC" }))
      .toBe("Receber em casa · Centro, SJC");
    expect(linhaDeEntrega({ delivery_type: "delivery" })).toBe("Receber em casa");
  });
  test("courier: nome e placa, só nome, ou 'a cliente informa'", () => {
    expect(linhaDeEntrega({ delivery_type: "courier", courier_name: "João", courier_plate: "ABC1D23" }))
      .toBe("Retirada por app · João · ABC1D23");
    expect(linhaDeEntrega({ delivery_type: "courier", courier_name: "João" }))
      .toBe("Retirada por app · João");
    expect(linhaDeEntrega({ delivery_type: "courier", courier_a_informar: true }))
      .toBe("Retirada por app · a cliente informa quem busca");
    expect(linhaDeEntrega({ delivery_type: "courier" }))
      .toBe("Retirada por app · a cliente informa quem busca");
  });
});

describe("linhasDePagamentoEEntrega", () => {
  test("CPF só quando request_nfce E o CPF vieram", () => {
    expect(linhasDePagamentoEEntrega({ customer_cpf_cnpj: "52998224725" })).toEqual([]);
    expect(linhasDePagamentoEEntrega({ request_nfce: true })).toEqual([]);
    expect(linhasDePagamentoEEntrega({ request_nfce: true, customer_cpf_cnpj: "52998224725" }))
      .toEqual([{ rotulo: "CPF/CNPJ na nota", valor: "529.982.247-25" }]);
  });
  test("frete e desconto do Pix só quando > 0", () => {
    expect(linhasDePagamentoEEntrega({ shipping_fee: 0, pix_discount: 0 })).toEqual([]);
    expect(linhasDePagamentoEEntrega({ shipping_fee: 12.5 }))
      .toEqual([{ rotulo: "Frete", valor: "R$ 12,50" }]);
    expect(linhasDePagamentoEEntrega({ pix_discount: 4.48 }))
      .toEqual([{ rotulo: "Desconto do Pix", valor: "− R$ 4,48" }]);
  });
  test("tudo junto, na ordem CPF → Entrega → Frete → Desconto", () => {
    const linhas = linhasDePagamentoEEntrega({
      request_nfce: true, customer_cpf_cnpj: "52998224725",
      delivery_type: "delivery", delivery_address: "Rua X, 1",
      shipping_fee: 10, pix_discount: 5,
    });
    expect(linhas.map((l) => l.rotulo)).toEqual(["CPF/CNPJ na nota", "Entrega", "Frete", "Desconto do Pix"]);
  });
  test("sem nenhum campo novo: lista vazia (a tela não desenha o bloco)", () => {
    expect(linhasDePagamentoEEntrega({ id: "o1", status: "pending_payment" })).toEqual([]);
  });
});

describe("motivoDoPixVencido", () => {
  test("os quatro motivos reconhecidos", () => {
    expect(motivoDoPixVencido({ pix_cancelamento: { vencido: true, motivo: "producao" } }))
      .toBe("Este pedido não cancela sozinho porque a produção já começou.");
    expect(motivoDoPixVencido({ pix_cancelamento: { vencido: true, motivo: "comprovante" } }))
      .toBe("Este pedido não cancela sozinho porque a cliente mandou comprovante.");
    expect(motivoDoPixVencido({ pix_cancelamento: { vencido: true, motivo: "ja_paguei" } }))
      .toBe("Este pedido não cancela sozinho porque a cliente disse que pagou.");
    expect(motivoDoPixVencido({ pix_cancelamento: { vencido: true, motivo: "sinal" } }))
      .toBe("Este pedido não cancela sozinho porque você registrou o sinal.");
  });
  test("sem o campo, não vencido, ou motivo desconhecido: null (nada muda)", () => {
    expect(motivoDoPixVencido({})).toBeNull();
    expect(motivoDoPixVencido({ pix_cancelamento: { vencido: false, motivo: "producao" } })).toBeNull();
    expect(motivoDoPixVencido({ pix_cancelamento: { vencido: true, motivo: null } })).toBeNull();
    expect(motivoDoPixVencido(null)).toBeNull();
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
