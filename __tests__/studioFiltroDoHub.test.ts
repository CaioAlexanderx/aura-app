// ============================================================
// __tests__/studioFiltroDoHub.test.ts
//
// QA do Hub de Pedidos (26/09/2026, achado 3a): busca por nome, telefone
// ou número do pedido, local sobre o feed já carregado (a API do Hub não
// tem parâmetro de busca — ver studioBulkHubApi.hubFeed).
// ============================================================
import { filtrarPedidosDoHub } from "@/components/studio/filtroDoHub";

const itens = [
  { id: "aaa11111", name: "Marina Souza", customer_phone: "34988887777" },
  { id: "bbb22222", name: "João Pedro", customer_phone: "34999996666" },
  { id: "ccc33333", name: null, customer_phone: null },
];

describe("filtrarPedidosDoHub", () => {
  it("sem busca, devolve tudo", () => {
    expect(filtrarPedidosDoHub(itens, "")).toHaveLength(3);
  });

  it("busca por nome, sem diferenciar maiúsculas/acentos", () => {
    expect(filtrarPedidosDoHub(itens, "joao").map((i) => i.id)).toEqual(["bbb22222"]);
    expect(filtrarPedidosDoHub(itens, "MARINA").map((i) => i.id)).toEqual(["aaa11111"]);
  });

  it("busca por telefone, só os dígitos importam", () => {
    expect(filtrarPedidosDoHub(itens, "(34) 98888-7777").map((i) => i.id)).toEqual(["aaa11111"]);
  });

  it("busca por trecho do id (fallback de \"número do pedido\")", () => {
    expect(filtrarPedidosDoHub(itens, "bbb2").map((i) => i.id)).toEqual(["bbb22222"]);
  });

  it("sem bater com nada, devolve lista vazia (não quebra com name/phone ausentes)", () => {
    expect(filtrarPedidosDoHub(itens, "ninguem com esse nome")).toEqual([]);
  });
});
