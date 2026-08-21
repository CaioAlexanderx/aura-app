// ============================================================
// Barra de navegação da vitrine — regras
//
// Os casos aqui são os formatos REAIS de produção (19/08/2026): planos e
// numerosos, sem hierarquia nenhuma. A árvore é testada porque o modelo
// suporta, não porque alguém use.
// ============================================================
import {
  montarMenu, cabemNaBarra, produtosDaCategoria,
} from "@/components/studio/storefront/storeNavModel";

const cat = (id: string, name: string, parent_id: string | null = null) => ({
  id, name, slug: name.toLowerCase().replace(/\s+/g, "-"),
  path: name, depth: parent_id ? 1 : 0, parent_id,
});
const prod = (id: string, category_id: string | null) =>
  ({ id, name: "Produto " + id, price: 10, category_id } as any);

describe("montarMenu — formato plano, que é o real", () => {
  test("Sheid Mania: 3 categorias planas viram 3 itens", () => {
    const cats = [cat("a", "Canecas"), cat("b", "Camisetas"), cat("c", "Adesivos")];
    const prods = [prod("1", "a"), prod("2", "a"), prod("3", "b"), prod("4", "c")];
    const menu = montarMenu(cats, prods);
    expect(menu.vazio).toBe(false);
    expect(menu.itens.map((i) => i.name)).toEqual(["Canecas", "Adesivos", "Camisetas"]);
    expect(menu.itens[0].total).toBe(2);
  });

  test("Finesse: 28 categorias planas sobram para 'Mais'", () => {
    const cats = Array.from({ length: 28 }, (_, i) => cat("c" + i, "Cat " + i));
    const prods = cats.map((c, i) => prod("p" + i, c.id));
    const menu = montarMenu(cats, prods, 8);
    expect(menu.itens).toHaveLength(8);
    expect(menu.extras).toHaveLength(20);
  });

  test("ordena por volume — o que mais vende aparece primeiro", () => {
    const cats = [cat("a", "Pouco"), cat("b", "Muito")];
    const prods = [prod("1", "a"), prod("2", "b"), prod("3", "b"), prod("4", "b")];
    expect(montarMenu(cats, prods).itens[0].name).toBe("Muito");
  });

  test("empate no volume desempata por nome, em pt-BR", () => {
    const cats = [cat("a", "Ônibus"), cat("b", "Adesivos")];
    const prods = [prod("1", "a"), prod("2", "b")];
    expect(montarMenu(cats, prods).itens.map((i) => i.name)).toEqual(["Adesivos", "Ônibus"]);
  });
});

describe("montarMenu — quando a barra NÃO deve aparecer", () => {
  test("sem categorias", () => {
    expect(montarMenu([], [prod("1", null)]).vazio).toBe(true);
  });

  test("payload sem o campo categories (base sem as migrations)", () => {
    expect(montarMenu(undefined, [prod("1", null)]).vazio).toBe(true);
    expect(montarMenu(null, [prod("1", null)]).vazio).toBe(true);
  });

  test("uma categoria só — navegar não significa nada", () => {
    const menu = montarMenu([cat("a", "Canecas")], [prod("1", "a"), prod("2", "a")]);
    expect(menu.vazio).toBe(true);
  });

  test("categorias existem mas nenhuma tem produto visível", () => {
    const cats = [cat("a", "Canecas"), cat("b", "Camisetas")];
    expect(montarMenu(cats, [prod("1", null)]).vazio).toBe(true);
  });
});

describe("montarMenu — produtos sem categoria", () => {
  test("são contados e não derrubam a barra", () => {
    const cats = [cat("a", "Canecas"), cat("b", "Camisetas")];
    // Caso real: a Sheid tinha 36 de 74 produtos sem categoria.
    const prods = [prod("1", "a"), prod("2", "b"), prod("3", null), prod("4", null)];
    const menu = montarMenu(cats, prods);
    expect(menu.vazio).toBe(false);
    expect(menu.soltos).toBe(2);
  });
});

describe("montarMenu — hierarquia, quando existir", () => {
  test("filha conta para a mãe", () => {
    const cats = [cat("mae", "Canecas"), cat("f1", "Cerâmica", "mae"), cat("f2", "Vidro", "mae"), cat("outra", "Camisetas")];
    const prods = [prod("1", "f1"), prod("2", "f1"), prod("3", "f2"), prod("4", "outra")];
    const menu = montarMenu(cats, prods);
    const canecas = menu.itens.find((i) => i.name === "Canecas")!;
    expect(canecas.total).toBe(3);
    expect(canecas.filhas.map((f) => f.name)).toEqual(["Cerâmica", "Vidro"]);
  });

  test("filha sem produto não vira item de menu", () => {
    const cats = [cat("mae", "Canecas"), cat("f1", "Cerâmica", "mae"), cat("f2", "Vazia", "mae"), cat("o", "Outra")];
    const prods = [prod("1", "f1"), prod("2", "o")];
    const canecas = montarMenu(cats, prods).itens.find((i) => i.name === "Canecas")!;
    expect(canecas.filhas.map((f) => f.name)).toEqual(["Cerâmica"]);
  });

  test("categoria órfã (pai ausente no payload) vira raiz em vez de sumir", () => {
    const cats = [cat("orfa", "Órfã", "pai-que-nao-veio"), cat("b", "Outra")];
    const prods = [prod("1", "orfa"), prod("2", "b")];
    expect(montarMenu(cats, prods).itens.map((i) => i.name)).toContain("Órfã");
  });
});

describe("cabemNaBarra", () => {
  test("no celular tudo fica inline — a barra rola, nada vai pro 'Mais'", () => {
    const cats = Array.from({ length: 28 }, (_, i) => cat("c" + i, "Cat " + i));
    const prods = cats.map((c, i) => prod("p" + i, c.id));
    const menu = montarMenu(cats, prods, cabemNaBarra(390));
    expect(menu.itens).toHaveLength(28);
    expect(menu.extras).toHaveLength(0);
  });

  test("cresce com a tela e para de crescer", () => {
    expect(cabemNaBarra(900)).toBe(4);
    expect(cabemNaBarra(1100)).toBe(6);
    expect(cabemNaBarra(1440)).toBe(8);
    expect(cabemNaBarra(2560)).toBe(8);
  });
});

describe("produtosDaCategoria", () => {
  const cats = [cat("mae", "Canecas"), cat("f1", "Cerâmica", "mae"), cat("o", "Outra")];
  const prods = [prod("1", "f1"), prod("2", "mae"), prod("3", "o"), prod("4", null)];

  test("sem categoria escolhida, devolve tudo", () => {
    expect(produtosDaCategoria(prods, null)).toHaveLength(4);
  });

  test("escolher a mãe traz os produtos das filhas junto", () => {
    const canecas = montarMenu(cats, prods).itens.find((i) => i.name === "Canecas")!;
    expect(produtosDaCategoria(prods, canecas).map((p) => p.id).sort()).toEqual(["1", "2"]);
  });

  test("produto sem categoria não entra em filtro nenhum", () => {
    const outra = montarMenu(cats, prods).itens.find((i) => i.name === "Outra")!;
    expect(produtosDaCategoria(prods, outra).map((p) => p.id)).toEqual(["3"]);
  });
});
