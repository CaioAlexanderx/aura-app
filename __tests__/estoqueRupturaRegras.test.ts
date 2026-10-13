// ============================================================
// "O que vai faltar" — regras puras (13/10/2026)
//
// Datas-alvo, ordenação, busca e o texto da lista de compra. Os números
// (ritmo, data prevista, sugestão) vêm do backend e estão nas fixtures
// copiadas de Aura-backend tests/fixtures/estoque: aqui só se confere o
// que o app decide em cima delas.
// ============================================================
import {
  dataAlvoPadrao, dataBR, diaMes, filtrarPorBusca, itensQueVaoFaltar, lerDataAlvo,
  ordenarPorDataPrevista, presetsDeData, ritmoPorDia, somaDias, textoListaDeCompra, urgencia,
} from "@/utils/rupturaEstoque";

const LOJA = require("./__fixtures__/estoque/ruptura.json");
const GRUPO = require("./__fixtures__/estoque/ruptura.grupo.json");

describe("data-alvo", () => {
  it("o padrão é a Black Friday (30/11) enquanto ela não passou", () => {
    expect(dataAlvoPadrao("2026-10-13")).toBe("2026-11-30");
    expect(dataAlvoPadrao("2026-11-30")).toBe("2026-11-30");
  });

  it("depois de 30/11 o padrão é hoje + 30 dias, como no backend", () => {
    expect(dataAlvoPadrao("2026-12-01")).toBe("2026-12-31");
    expect(dataAlvoPadrao("2026-12-30")).toBe("2027-01-29");
  });

  it("os atalhos: Black Friday e Natal; depois do Natal, só +30 dias", () => {
    expect(presetsDeData("2026-10-13").map((p) => [p.key, p.ate])).toEqual([
      ["black-friday", "2026-11-30"],
      ["natal", "2026-12-24"],
    ]);
    expect(presetsDeData("2026-12-05").map((p) => p.key)).toEqual(["natal"]);
    expect(presetsDeData("2026-12-26").map((p) => [p.key, p.ate])).toEqual([["30-dias", "2027-01-25"]]);
  });

  it("lê dd/mm/aaaa, dd/mm e ano com dois dígitos", () => {
    expect(lerDataAlvo("30/11/2026", "2026-10-13")).toBe("2026-11-30");
    expect(lerDataAlvo("24/12", "2026-10-13")).toBe("2026-12-24");
    expect(lerDataAlvo("5/1/27", "2026-10-13")).toBe("2027-01-05");
    expect(lerDataAlvo(" 01/11/2026 ", "2026-10-13")).toBe("2026-11-01");
  });

  it("dd/mm que já passou neste ano vale para o ano seguinte", () => {
    expect(lerDataAlvo("05/10", "2026-10-13")).toBe("2027-10-05");
  });

  it("recusa data inexistente, passada, além de 1 ano ou texto solto", () => {
    expect(lerDataAlvo("31/04/2026", "2026-03-01")).toBeNull();
    expect(lerDataAlvo("12/10/2026", "2026-10-13")).toBeNull();
    expect(lerDataAlvo("14/10/2027", "2026-10-13")).toBeNull();
    expect(lerDataAlvo("amanhã", "2026-10-13")).toBeNull();
    expect(lerDataAlvo("", "2026-10-13")).toBeNull();
  });

  it("formata sem passar por fuso", () => {
    expect(diaMes("2026-10-17")).toBe("17/10");
    expect(dataBR("2026-11-30")).toBe("30/11/2026");
    expect(diaMes(null)).toBe("");
    expect(somaDias("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("lista", () => {
  it("só lista quem vai faltar, na ordem da data prevista (e não na do backend)", () => {
    const embaralhado = { itens: [...LOJA.itens].reverse() };
    const nomes = itensQueVaoFaltar(embaralhado).map((i) => i.nome);
    expect(nomes).toEqual(["Vestido Midi Canelado", "Meia Cano Curto Kit 3 Pares", "Cinto Couro Fivela Dourada"]);
    expect(nomes).not.toContain("Calça Jeans Wide Leg"); // faltara: false
  });

  it("no empate de data, quem mais pesa no caixa vem primeiro", () => {
    const base = LOJA.itens[0];
    const a = { ...base, nome: "A", data_prevista: "2026-10-20", valor_em_risco: 100 };
    const b = { ...base, nome: "B", data_prevista: "2026-10-20", valor_em_risco: 900 };
    const c = { ...base, nome: "C", data_prevista: "2026-10-19", valor_em_risco: 1 };
    expect(ordenarPorDataPrevista([a, b, c]).map((i) => i.nome)).toEqual(["C", "B", "A"]);
  });

  it("a busca acha por nome, variante, código e loja — sem acento e em qualquer ordem", () => {
    const todos = [...GRUPO.itens, ...GRUPO.zerados];
    expect(filtrarPorBusca(todos, "vestido").map((i: any) => i.nome)).toEqual(["Vestido Midi Canelado"]);
    expect(filtrarPorBusca(todos, "preto vestido")).toHaveLength(1);
    expect(filtrarPorBusca(todos, "calca")).toHaveLength(1); // Calça, sem acento
    expect(filtrarPorBusca(todos, "BBA-BRANCO")).toHaveLength(1);
    expect(filtrarPorBusca(todos, "filial").map((i: any) => i.nome).sort()).toEqual([
      "Bolsa Tiracolo Caramelo", "Meia Cano Curto Kit 3 Pares",
    ]);
    expect(filtrarPorBusca(todos, "  ")).toHaveLength(todos.length);
    expect(filtrarPorBusca(todos, "inexistente")).toHaveLength(0);
  });

  it("urgência: vermelho até 7 dias, âmbar até 21", () => {
    expect(urgencia(0)).toBe("alta");
    expect(urgencia(7)).toBe("alta");
    expect(urgencia(8)).toBe("media");
    expect(urgencia(21)).toBe("media");
    expect(urgencia(22)).toBe("baixa");
  });

  it("ritmo em pt-BR", () => {
    expect(ritmoPorDia(2)).toBe("2/dia");
    expect(ritmoPorDia(1.14)).toBe("1,14/dia");
    expect(ritmoPorDia(0.5)).toBe("0,5/dia");
  });
});

describe("texto da lista de compra", () => {
  it("uma linha por item: nome, variante e sugestão; zerados primeiro", () => {
    expect(textoListaDeCompra(LOJA)).toBe([
      "Lista de compra (até 30/11)",
      "Blusa Básica Algodão (Branco / P): 51 un",
      "Vestido Midi Canelado (Preto / M): 91 un",
      "Meia Cano Curto Kit 3 Pares: 38 un",
      "Cinto Couro Fivela Dourada: 41 un",
    ].join("\n"));
  });

  it("no consolidado a loja dona vai entre colchetes", () => {
    const texto = textoListaDeCompra(GRUPO, { mostrarLoja: true });
    expect(texto).toContain("Bolsa Tiracolo Caramelo: 25 un [Boutique Aurora — Filial]");
    expect(texto).toContain("Vestido Midi Canelado (Preto / M): 91 un [Boutique Aurora — Matriz]");
  });

  it("item sem sugestão não vira linha, e lista vazia vira texto vazio", () => {
    const comZero = { ...LOJA, itens: LOJA.itens.map((i: any) => ({ ...i, sugestao_compra: 0 })), zerados: [] };
    expect(textoListaDeCompra(comZero)).toBe("");
  });

  it("quantidade fracionada sai em pt-BR, na unidade do item", () => {
    const item = { ...LOJA.itens[0], unidade: "m²", sugestao_compra: 12.5, variante: null };
    const t = textoListaDeCompra({ itens: [item], zerados: [], ate: "2026-11-30" });
    expect(t.split("\n")[1]).toBe("Vestido Midi Canelado: 12,5 m²");
  });
});
