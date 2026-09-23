// ============================================================
// AURA. -- Testes: ordem alfabética do Estoque (A–Z / Z–A) e a escolha
// lembrada no navegador (utils/productSort.ts, 23/09/2026).
// "Últimos adicionados" (compareByRecent) tem seu próprio teste em
// __tests__/ultimosAdicionados.test.ts.
// ============================================================
import {
  compareByName,
  compareByNameDesc,
  ordenarProdutos,
  lerOrdemSalva,
  salvarOrdem,
  CHAVE_ORDEM_ESTOQUE,
  ORDEM_PADRAO,
} from "@/utils/productSort";

const p = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  created_at: "2026-09-01T10:00:00Z",
  ...extra,
});
const nomes = (arr: Array<{ name: string }>) => arr.map((x) => x.name);

describe("compareByName (A–Z)", () => {
  test("ordem alfabética simples", () => {
    const arr = [p("1", "Tinta"), p("2", "Argamassa"), p("3", "Cimento")].sort(compareByName);
    expect(nomes(arr)).toEqual(["Argamassa", "Cimento", "Tinta"]);
  });

  test("acento não joga o produto para o fim da lista", () => {
    const arr = [p("1", "Zinco"), p("2", "Óleo"), p("3", "Água sanitária"), p("4", "Esponja"), p("5", "Éter")].sort(compareByName);
    expect(nomes(arr)).toEqual(["Água sanitária", "Esponja", "Éter", "Óleo", "Zinco"]);
  });

  test("maiúscula e minúscula ficam juntas", () => {
    const arr = [p("1", "banana"), p("2", "Abacaxi"), p("3", "CAJU")].sort(compareByName);
    expect(nomes(arr)).toEqual(["Abacaxi", "banana", "CAJU"]);
  });

  test('números em ordem de número: "Piso 10" depois de "Piso 9"', () => {
    const arr = [p("1", "Piso 10"), p("2", "Piso 2"), p("3", "Piso 9"), p("4", "Piso 100")].sort(compareByName);
    expect(nomes(arr)).toEqual(["Piso 2", "Piso 9", "Piso 10", "Piso 100"]);
  });

  test("espaço sobrando no começo do nome não muda a posição", () => {
    const arr = [p("1", "Cimento"), p("2", "  Areia")].sort(compareByName);
    expect(nomes(arr)).toEqual(["  Areia", "Cimento"]);
  });

  test("empate de nome (inclusive só com acento diferente): mais recente primeiro", () => {
    const antigo = p("a", "Cafe", { created_at: "2026-01-01T10:00:00Z" });
    const recente = p("b", "Café", { created_at: "2026-09-23T10:00:00Z" });
    expect([antigo, recente].sort(compareByName).map((x) => x.id)).toEqual(["b", "a"]);
    expect([recente, antigo].sort(compareByName).map((x) => x.id)).toEqual(["b", "a"]);
  });

  test("nome vazio não quebra", () => {
    const arr = [p("1", "Bota"), { id: "2", name: null as any }, p("3", "Anel")].sort(compareByName);
    expect(arr.map((x) => x.id)).toEqual(["2", "3", "1"]);
  });
});

describe("compareByNameDesc (Z–A)", () => {
  test("inverte o nome, com acento e número", () => {
    const arr = [p("1", "Piso 9"), p("2", "Água"), p("3", "Piso 10"), p("4", "Zinco")].sort(compareByNameDesc);
    expect(nomes(arr)).toEqual(["Zinco", "Piso 10", "Piso 9", "Água"]);
  });

  test("no empate continua o mais recente primeiro (não inverte a data)", () => {
    const antigo = p("a", "Cal", { created_at: "2026-01-01T10:00:00Z" });
    const recente = p("b", "Cal", { created_at: "2026-09-23T10:00:00Z" });
    expect([antigo, recente].sort(compareByNameDesc).map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("ordenarProdutos", () => {
  const lista = [
    p("1", "Cimento", { price: 30, stock: 5, created_at: "2026-09-10T10:00:00Z" }),
    p("2", "Areia", { price: 90, stock: 1, created_at: "2026-09-20T10:00:00Z" }),
    p("3", "Brita", { price: 60, stock: 9, created_at: "2026-09-01T10:00:00Z" }),
  ];

  test("não mexe na lista original", () => {
    const antes = nomes(lista);
    ordenarProdutos(lista, "name_asc");
    expect(nomes(lista)).toEqual(antes);
  });

  test.each([
    ["recent", ["Areia", "Cimento", "Brita"]],
    ["name_asc", ["Areia", "Brita", "Cimento"]],
    ["name_desc", ["Cimento", "Brita", "Areia"]],
    ["price_desc", ["Areia", "Brita", "Cimento"]],
    ["price_asc", ["Cimento", "Brita", "Areia"]],
    ["low_stock", ["Areia", "Cimento", "Brita"]],
  ] as const)("%s", (ordem, esperado) => {
    expect(nomes(ordenarProdutos(lista, ordem))).toEqual(esperado);
  });

  test("consolidado multi-CNPJ: traduz os campos do grupo (avg_price, total_stock)", () => {
    const grupos = [
      { group_key: "g1", name: "Piso 10", avg_price: 50, total_stock: 3 },
      { group_key: "g2", name: "Piso 9", avg_price: 40, total_stock: 8 },
    ];
    const campos = (g: (typeof grupos)[number]) => ({ id: g.group_key, name: g.name, price: g.avg_price, stock: g.total_stock });
    expect(ordenarProdutos(grupos, "name_asc", campos).map((g) => g.group_key)).toEqual(["g2", "g1"]);
    expect(ordenarProdutos(grupos, "price_desc", campos).map((g) => g.group_key)).toEqual(["g1", "g2"]);
    expect(ordenarProdutos(grupos, "low_stock", campos).map((g) => g.group_key)).toEqual(["g1", "g2"]);
  });
});

describe("escolha lembrada (localStorage)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  test('sem nada salvo: "Últimos adicionados"', () => {
    expect(ORDEM_PADRAO).toBe("recent");
    expect(lerOrdemSalva()).toBe("recent");
  });

  test("salva e lê de volta", () => {
    salvarOrdem("name_asc");
    expect(window.localStorage.getItem(CHAVE_ORDEM_ESTOQUE)).toBe("name_asc");
    expect(lerOrdemSalva()).toBe("name_asc");
  });

  test("valor estranho no armazenamento cai no padrão", () => {
    window.localStorage.setItem(CHAVE_ORDEM_ESTOQUE, "qualquer_coisa");
    expect(lerOrdemSalva()).toBe("recent");
  });

  test("navegador que bloqueia o armazenamento não quebra a tela", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("SecurityError"); });
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("QuotaExceeded"); });
    expect(() => salvarOrdem("name_desc")).not.toThrow();
    expect(lerOrdemSalva()).toBe("recent");
  });
});
