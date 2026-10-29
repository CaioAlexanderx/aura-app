// tq-57: a aba Vitrine grava "ocultar" (hidden_product_ids) em vez de
// montar a lista de inclusão. A regra tem que ser a MESMA do backend
// (NA_VITRINE): oculto some, lista cheia ainda filtra, oculto ganha da lista.
import {
  alternar, apareceNaLoja, contagens, mostrar, mostrarTodos, ocultar, paraSalvar, usaListaDeInclusao,
  type Visibilidade,
} from "../components/screens/canal/vitrineVisibilidade";

const vis = (featured: string[] = [], hidden: string[] = []): Visibilidade => ({
  featured: new Set(featured), hidden: new Set(hidden),
});

describe("quem aparece na loja", () => {
  test("sem listas, tudo aparece — inclusive produto que ainda nem existe", () => {
    const v = vis();
    expect(apareceNaLoja(v, "p1")).toBe(true);
    expect(apareceNaLoja(v, "produto-de-amanha")).toBe(true);
    expect(usaListaDeInclusao(v)).toBe(false);
  });

  test("oculto some", () => {
    expect(apareceNaLoja(vis([], ["p1"]), "p1")).toBe(false);
  });

  test("lista de inclusão antiga segue filtrando, e o oculto ganha dela", () => {
    const v = vis(["p1", "p2"], ["p2"]);
    expect(apareceNaLoja(v, "p1")).toBe(true);
    expect(apareceNaLoja(v, "p2")).toBe(false);
    expect(apareceNaLoja(v, "p3")).toBe(false);
  });
});

describe("o que o switch grava", () => {
  test("desligar numa loja sem lista grava só o oculto, nunca a lista de inclusão", () => {
    const depois = alternar(vis(), "p1");
    expect(paraSalvar(depois)).toEqual({ featured_product_ids: [], hidden_product_ids: ["p1"] });
    // Produto novo continua entrando sozinho.
    expect(apareceNaLoja(depois, "p-novo")).toBe(true);
  });

  test("ligar tira dos ocultos", () => {
    expect(paraSalvar(alternar(vis([], ["p1", "p2"]), "p1"))).toEqual({
      featured_product_ids: [], hidden_product_ids: ["p2"],
    });
  });

  test("na loja com lista antiga, ligar um produto de fora põe ele na lista", () => {
    const depois = alternar(vis(["p1"]), "p9");
    expect(apareceNaLoja(depois, "p9")).toBe(true);
    expect(paraSalvar(depois).featured_product_ids).toEqual(["p1", "p9"]);
  });

  test("na loja com lista antiga, desligar oculta e não mexe na lista", () => {
    const depois = alternar(vis(["p1", "p2"]), "p1");
    expect(paraSalvar(depois)).toEqual({ featured_product_ids: ["p1", "p2"], hidden_product_ids: ["p1"] });
  });

  test("em lote: ocultar e mostrar vários", () => {
    const ocultos = ocultar(vis(), ["a", "b"]);
    expect(paraSalvar(ocultos).hidden_product_ids).toEqual(["a", "b"]);
    expect(paraSalvar(mostrar(ocultos, new Set(["a"]))).hidden_product_ids).toEqual(["b"]);
  });

  test("mostrar todos novamente zera as duas listas", () => {
    expect(paraSalvar(mostrarTodos())).toEqual({ featured_product_ids: [], hidden_product_ids: [] });
  });
});

describe("números do topo", () => {
  test("sem lista: total menos ocultos", () => {
    expect(contagens(vis([], ["a", "b"]), 10)).toEqual({ naLoja: 8, ocultos: 2 });
  });
  test("com lista: o que está nela e não está oculto", () => {
    expect(contagens(vis(["a", "b", "c"], ["c"]), 10)).toEqual({ naLoja: 2, ocultos: 8 });
  });
  test("oculto de produto apagado não deixa número negativo", () => {
    expect(contagens(vis([], ["a", "b", "c"]), 2)).toEqual({ naLoja: 0, ocultos: 2 });
  });
});
