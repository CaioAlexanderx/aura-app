// ============================================================
// INC-2026-11-18-01 — loja dona do produto no grupo (utils/lojaDona).
// Lojista com matriz e filial: a lista mistura as duas lojas; o filtro
// "Loja" e o selo só existem nesse caso. Fora dele, nada muda.
// ============================================================
import {
  contextoDeLojas, filtrarPorLoja, nomeDaLojaDona, lojaValida, lojaDonaDoProduto,
  lerLojaEscolhida, salvarLojaEscolhida, chaveDaLojaEscolhida,
  TODAS_AS_LOJAS, TEXTO_OUTRA_LOJA,
} from "@/utils/lojaDona";

const EMPRESAS = [
  { id: "filial", trade_name: "Loja Filial", name: "filial ltda" },
  { id: "matriz", trade_name: "", name: "Loja Matriz" },
];
const P = [
  { id: "a", lojaDonaId: "filial" },
  { id: "b", lojaDonaId: "matriz" },
  { id: "c", lojaDonaId: "filial" },
];

describe("contextoDeLojas", () => {
  test("lista que mistura lojas: a empresa aberta primeiro, nomes do switcher", () => {
    const ctx = contextoDeLojas(EMPRESAS, "filial", P.map(lojaDonaDoProduto));
    expect(ctx).not.toBeNull();
    expect(ctx!.lojas).toEqual([{ id: "filial", nome: "Loja Filial" }, { id: "matriz", nome: "Loja Matriz" }]);
  });

  test("fora de grupo (todos os produtos da própria loja): null", () => {
    expect(contextoDeLojas(EMPRESAS, "filial", ["filial", "filial"])).toBeNull();
    expect(contextoDeLojas([], "x", ["x"])).toBeNull();
  });

  test("backend antigo (sem a loja dona): null", () => {
    expect(contextoDeLojas(EMPRESAS, "filial", [null, undefined, null])).toBeNull();
  });

  test("lista vazia: null", () => {
    expect(contextoDeLojas(EMPRESAS, "filial", [])).toBeNull();
  });

  test("loja dona que o usuário não acessa: nome conhecido ou 'Outra loja do grupo'", () => {
    const ctx = contextoDeLojas([{ id: "filial", trade_name: "Loja Filial" }], "filial", ["filial", "matriz"]);
    expect(nomeDaLojaDona(ctx, "matriz")).toBe(TEXTO_OUTRA_LOJA);
    const comNome = contextoDeLojas(null, null, ["filial", "matriz"], { matriz: "Matriz do consolidado", filial: "Filial" });
    expect(nomeDaLojaDona(comNome, "matriz")).toBe("Matriz do consolidado");
  });

  test("consolidado (sem empresa aberta): ordem alfabética", () => {
    const ctx = contextoDeLojas(EMPRESAS, null, ["matriz", "filial"]);
    expect(ctx!.lojas.map((l) => l.id)).toEqual(["filial", "matriz"]);
  });
});

describe("filtrarPorLoja", () => {
  const ctx = contextoDeLojas(EMPRESAS, "filial", P.map(lojaDonaDoProduto));
  const dona = (p: any) => p.lojaDonaId;

  test("'Todas as lojas' devolve a MESMA lista (sem copiar)", () => {
    expect(filtrarPorLoja(P, ctx, TODAS_AS_LOJAS, dona)).toBe(P);
  });

  test("sem contexto, qualquer escolha devolve a mesma lista", () => {
    expect(filtrarPorLoja(P, null, "matriz", dona)).toBe(P);
  });

  test("uma loja: só os produtos dela", () => {
    expect(filtrarPorLoja(P, ctx, "matriz", dona).map((p) => p.id)).toEqual(["b"]);
    expect(filtrarPorLoja(P, ctx, "filial", dona).map((p) => p.id)).toEqual(["a", "c"]);
  });

  test("loja que saiu da lista volta a 'Todas as lojas'", () => {
    expect(lojaValida(ctx, "loja-apagada")).toBe(TODAS_AS_LOJAS);
    expect(filtrarPorLoja(P, ctx, "loja-apagada", dona)).toBe(P);
  });
});

describe("escolha lembrada por tela e por empresa", () => {
  beforeEach(() => window.localStorage.clear());

  test("sem nada guardado: Todas as lojas", () => {
    expect(lerLojaEscolhida("etiquetas", "filial")).toBe(TODAS_AS_LOJAS);
  });

  test("guarda por empresa e por tela", () => {
    salvarLojaEscolhida("etiquetas", "filial", "matriz");
    expect(lerLojaEscolhida("etiquetas", "filial")).toBe("matriz");
    expect(lerLojaEscolhida("etiquetas", "matriz")).toBe(TODAS_AS_LOJAS);
    expect(lerLojaEscolhida("estoque", "filial")).toBe(TODAS_AS_LOJAS);
  });

  test("voltar para Todas apaga a chave", () => {
    salvarLojaEscolhida("estoque", "filial", "matriz");
    salvarLojaEscolhida("estoque", "filial", TODAS_AS_LOJAS);
    expect(window.localStorage.getItem(chaveDaLojaEscolhida("estoque", "filial"))).toBeNull();
  });

  test("storage que joga erro não derruba a tela", () => {
    const get = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
    const set = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("bloqueado"); });
    expect(lerLojaEscolhida("etiquetas", "filial")).toBe(TODAS_AS_LOJAS);
    expect(() => salvarLojaEscolhida("etiquetas", "filial", "matriz")).not.toThrow();
    get.mockRestore(); set.mockRestore();
  });
});
