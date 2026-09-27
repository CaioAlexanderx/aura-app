// ============================================================
// __tests__/studioFiltroDoHub.test.ts
//
// QA do Hub de Pedidos (26/09/2026, achado 3a): busca por nome, telefone
// ou número do pedido, local sobre o feed já carregado (a API do Hub não
// tem parâmetro de busca — ver studioBulkHubApi.hubFeed).
// ============================================================
import { filtrarPedidosDoHub } from "@/components/studio/filtroDoHub";

const itens = [
  { id: "aaa11111", name: "Marina Souza", customer_phone: "34988887777", order_number: "00042" },
  { id: "bbb22222", name: "João Pedro", customer_phone: "34999996666", order_number: 7 },
  { id: "ccc33333", name: null, customer_phone: null, order_number: null },
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
    expect(filtrarPedidosDoHub(itens, "7777").map((i) => i.id)).toEqual(["aaa11111"]);
  });

  it("telefone e id só entram com 4+ caracteres (senão \"7\" bate em todo telefone com um 7)", () => {
    // "7" é o pedido nº 7, não o telefone 34988887777
    expect(filtrarPedidosDoHub(itens, "7").map((i) => i.id)).toEqual(["bbb22222"]);
    // "aaa" tem 3 letras: não vale como trecho do id
    expect(filtrarPedidosDoHub(itens, "aaa")).toEqual([]);
  });

  it("busca pelo número do pedido que a cliente vê (order_number, backend#760)", () => {
    expect(filtrarPedidosDoHub(itens, "42").map((i) => i.id)).toEqual(["aaa11111"]);
    expect(filtrarPedidosDoHub(itens, "00042").map((i) => i.id)).toEqual(["aaa11111"]);
    // número vindo como number do backend, e com o prefixo que a tela mostra
    expect(filtrarPedidosDoHub(itens, "7").map((i) => i.id)).toEqual(["bbb22222"]);
    expect(filtrarPedidosDoHub(itens, "Pedido 42").map((i) => i.id)).toEqual(["aaa11111"]);
    expect(filtrarPedidosDoHub(itens, "#42").map((i) => i.id)).toEqual(["aaa11111"]);
  });

  it("busca por trecho do id (atalho, e fallback enquanto o feed vem sem order_number)", () => {
    expect(filtrarPedidosDoHub(itens, "bbb2").map((i) => i.id)).toEqual(["bbb22222"]);
    const semNumero = itens.map(({ order_number: _n, ...resto }) => resto);
    expect(filtrarPedidosDoHub(semNumero, "ccc3").map((i) => i.id)).toEqual(["ccc33333"]);
  });

  it("sem bater com nada, devolve lista vazia (não quebra com name/phone ausentes)", () => {
    expect(filtrarPedidosDoHub(itens, "ninguem com esse nome")).toEqual([]);
  });
});
