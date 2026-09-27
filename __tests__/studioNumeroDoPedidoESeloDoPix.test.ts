// ============================================================
// __tests__/studioNumeroDoPedidoESeloDoPix.test.ts
//
// QA do painel Studio (26/09/2026):
//   - achado 2h — o mesmo pedido mostrava três identificadores
//     diferentes ("00001" no título, o uuid fatiado na trilha e no
//     cartão da Produção). `numeroDoPedido` é a fonte única.
//   - achado 4b — o cartão da fila de Produção não dizia se o Pix da
//     encomenda da vitrine já tinha caído. `situacaoDoPixNoCartao` usa
//     os mesmos campos que o Hub usa pro selo "Aguardando Pix"
//     (seloDoPagamentoNaFila), com o caso "pago" a mais.
// ============================================================
import { numeroDoPedido, situacaoDoPixNoCartao } from "@/components/studio/pagamentoDoPedido";

describe("numeroDoPedido", () => {
  it("usa order_number quando existe (detalhe do pedido)", () => {
    expect(numeroDoPedido({ order_number: "00001", id: "baa22b9d-0000-0000-0000-000000000000" }))
      .toBe("Pedido 00001");
  });

  it("sem order_number, usa display_name (Hub e Produção — a view já devolve o número puro pros digitais)", () => {
    expect(numeroDoPedido({ display_name: "00001" })).toBe("Pedido 00001");
  });

  it("PDV e marketplace: o prefixo da view vira o número (melhor que o uuid cru)", () => {
    expect(numeroDoPedido({ display_name: "PDV-A1B2C3D4" })).toBe("Pedido PDV-A1B2C3D4");
  });

  it("sem nenhum dos dois, cai no uuid fatiado em caixa alta", () => {
    expect(numeroDoPedido({ id: "baa22b9d-1111-2222-3333-444444444444" })).toBe("Pedido BAA22B9D");
  });

  it("nada disponível não quebra", () => {
    expect(numeroDoPedido(null)).toBe("Pedido");
    expect(numeroDoPedido({})).toBe("Pedido");
  });
});

describe("situacaoDoPixNoCartao", () => {
  it("Pix pendente sem comprovante: âmbar, 'Aguardando Pix'", () => {
    expect(situacaoDoPixNoCartao({ status: "pending_payment", payment_method: "pix", has_payment_proof: false }))
      .toEqual({ rotulo: "Aguardando Pix", tom: "atencao" });
  });

  it("comprovante enviado ou aviso da cliente: 'Pagamento a conferir'", () => {
    expect(situacaoDoPixNoCartao({ status: "pending_payment", payment_method: "pix", has_payment_proof: true })?.rotulo)
      .toBe("Pagamento a conferir");
    expect(situacaoDoPixNoCartao({ status: "awaiting_approval", payment_method: "pix" })?.rotulo)
      .toBe("Pagamento a conferir");
  });

  it("pago: verde, 'Pix recebido'", () => {
    expect(situacaoDoPixNoCartao({ status: "confirmed", payment_method: "pix", payment_status: "paid" }))
      .toEqual({ rotulo: "Pix recebido", tom: "sucesso" });
    expect(situacaoDoPixNoCartao({ status: "confirmed", payment_method: "pix" })?.rotulo).toBe("Pix recebido");
  });

  it("cartão e retirada nunca mostram selo de Pix (quem confirma é outro fluxo)", () => {
    expect(situacaoDoPixNoCartao({ status: "pending_payment", payment_method: "card" })).toBeNull();
    expect(situacaoDoPixNoCartao({ status: "pending_payment", payment_method: "on_delivery" })).toBeNull();
  });

  it("pedido de PDV/marketplace (sem payment_method) não ganha selo", () => {
    expect(situacaoDoPixNoCartao({ status: "completed" })).toBeNull();
  });
});
