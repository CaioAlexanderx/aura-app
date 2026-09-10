// ============================================================
// Fila de pedidos da loja online (10/09/2026)
//
// A tela antiga pintava status com cores claras fixas (ilegíveis no tema
// escuro), escondia o Cancelar em Pix pendente e não sabia de "Expirado".
// Aqui ficam as regras que o card e o detalhe precisam repetir iguais.
// ============================================================
import {
  situacaoDoPedido, podeConfirmarPagamento, podeCancelar, podeExcluir,
  filtrarPorGrupo, contagemDosGrupos, resumoDosItens, tempoDesde,
  formatarReais, rotuloDaEntrega, rotuloDoPagamento, ehExpirado, PedidoDaFila,
} from "@/utils/filaDePedidos";

const AGORA = new Date("2026-09-10T15:00:00Z").getTime();
const p = (over: Partial<PedidoDaFila>): PedidoDaFila => ({
  id: over.id || "o1",
  order_number: over.order_number || "00001",
  status: over.status || "pending_payment",
  created_at: over.created_at || new Date(AGORA - 3600_000).toISOString(),
  payment_method: over.payment_method === undefined ? "pix" : over.payment_method,
  ...over,
});

describe("situação do pedido", () => {
  test("Pix pendente pede ação e é âmbar", () => {
    expect(situacaoDoPedido(p({}))).toEqual({ rotulo: "Aguardando Pix", tom: "ambar", precisaAgir: true });
  });
  test("cartão pendente não pede nada da lojista", () => {
    expect(situacaoDoPedido(p({ payment_method: "card" }))).toMatchObject({ rotulo: "Aguardando cartão", precisaAgir: false });
  });
  test("comprovante enviado pede ação e é vermelho", () => {
    expect(situacaoDoPedido(p({ status: "awaiting_approval" }))).toMatchObject({ tom: "vermelho", precisaAgir: true });
  });
  test("Pix vencido cancelado pelo backend aparece como Expirado", () => {
    const o = p({ status: "cancelled", payment_status: "expired" });
    expect(ehExpirado(o)).toBe(true);
    expect(situacaoDoPedido(o).rotulo).toBe("Expirado");
    expect(situacaoDoPedido(p({ status: "cancelled", payment_status: "cancelled" })).rotulo).toBe("Cancelado");
  });
  test("andamento em violeta e verde; fim em neutro", () => {
    expect(situacaoDoPedido(p({ status: "confirmed" })).tom).toBe("violeta");
    expect(situacaoDoPedido(p({ status: "ready" })).tom).toBe("verde");
    expect(situacaoDoPedido(p({ status: "delivered" })).tom).toBe("neutro");
  });
});

describe("ações", () => {
  test("confirmar pagamento: Pix pendente ou comprovante; cartão nunca", () => {
    expect(podeConfirmarPagamento(p({}))).toBe(true);
    expect(podeConfirmarPagamento(p({ status: "awaiting_approval" }))).toBe(true);
    expect(podeConfirmarPagamento(p({ payment_method: "card" }))).toBe(false);
    expect(podeConfirmarPagamento(p({ status: "confirmed" }))).toBe(false);
    expect(podeConfirmarPagamento(null)).toBe(false);
  });

  test("cancelar: tudo que não terminou — inclusive Pix pendente", () => {
    expect(podeCancelar(p({}))).toBe(true);
    expect(podeCancelar(p({ status: "preparing" }))).toBe(true);
    expect(podeCancelar(p({ status: "delivered" }))).toBe(false);
    expect(podeCancelar(p({ status: "cancelled" }))).toBe(false);
  });

  test("excluir: só pendente ou cancelado que nunca movimentou nada", () => {
    expect(podeExcluir(p({}))).toBe(true);
    expect(podeExcluir(p({ status: "cancelled" }))).toBe(true);
    expect(podeExcluir(p({ status: "confirmed" }))).toBe(false);
    expect(podeExcluir(p({ status: "cancelled", confirmed_at: "2026-09-01" }))).toBe(false);
    expect(podeExcluir(p({ transaction_id: "t1" }))).toBe(false);
    expect(podeExcluir(p({ stock_deducted: true }))).toBe(false);
    expect(podeExcluir(p({ nfce_id: "n1" }))).toBe(false);
  });
});

describe("grupos e contagens", () => {
  const lista = [
    p({ id: "a", status: "pending_payment" }),
    p({ id: "b", status: "awaiting_approval" }),
    p({ id: "c", status: "preparing" }),
    p({ id: "d", status: "delivered" }),
    p({ id: "e", status: "cancelled", payment_status: "expired" }),
  ];
  test("cada chip filtra seus status", () => {
    expect(filtrarPorGrupo(lista, "all")).toHaveLength(5);
    expect(filtrarPorGrupo(lista, "precisa-agir").map((o) => o.id)).toEqual(["a", "b"]);
    expect(filtrarPorGrupo(lista, "em-curso").map((o) => o.id)).toEqual(["c"]);
    expect(filtrarPorGrupo(lista, "concluidos").map((o) => o.id)).toEqual(["d"]);
    expect(filtrarPorGrupo(lista, "cancelados").map((o) => o.id)).toEqual(["e"]);
  });
  test("os cartões de cima somam o banco inteiro", () => {
    expect(contagemDosGrupos({ pending_payment: 3, awaiting_approval: 1, confirmed: 2, preparing: 1, ready: 0, expired: 4 }))
      .toEqual({ precisaAgir: 4, emCurso: 3, expirados: 4 });
    expect(contagemDosGrupos(null)).toEqual({ precisaAgir: 0, emCurso: 0, expirados: 0 });
  });
});

describe("textos do card", () => {
  test("primeiro item com o restante contado", () => {
    expect(resumoDosItens(p({ first_item_name: "Conjunto luka (Cor: Ferrugem / Tamanho: G)", item_count: 1 })))
      .toBe("Conjunto luka (Cor: Ferrugem / Tamanho: G)");
    expect(resumoDosItens(p({ first_item_name: "Vestido", item_count: 3 }))).toBe("Vestido +2");
    expect(resumoDosItens(p({ first_item_name: null, item_count: 2 }))).toBe("2 itens");
    expect(resumoDosItens(p({ first_item_name: null, item_count: 0 }))).toBe("");
  });
  test("tempo em português por extenso curto", () => {
    const antes = (ms: number) => new Date(AGORA - ms).toISOString();
    expect(tempoDesde(antes(10_000), AGORA)).toBe("agora");
    expect(tempoDesde(antes(5 * 60_000), AGORA)).toBe("5 min");
    expect(tempoDesde(antes(3 * 3600_000), AGORA)).toBe("3 h");
    expect(tempoDesde(antes(26 * 3600_000), AGORA)).toBe("1 dia");
    expect(tempoDesde(antes(112 * 24 * 3600_000), AGORA)).toBe("112 dias");
  });
  test("valores, pagamento e entrega", () => {
    expect(formatarReais("129.9")).toBe("R$ 129,90");
    expect(formatarReais(undefined)).toBe("R$ —");
    expect(rotuloDoPagamento("card")).toBe("Cartão");
    expect(rotuloDoPagamento("pix")).toBe("Pix");
    expect(rotuloDaEntrega("courier")).toBe("Retirada por app");
    expect(rotuloDaEntrega("pickup")).toBe("Retirada");
  });
});
