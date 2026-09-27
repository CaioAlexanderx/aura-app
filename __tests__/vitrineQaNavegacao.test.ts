// ============================================================
// QA 27/09 · a navegação da vitrine nova
//
// P1: a barra de categorias sumia com UMA categoria com peça — e é assim
// que as lojas reais estão (aura-qa: 10 em Canecas e 21 sem categoria;
// Sheid: 9 e 1). Regra nova para barra, gaveta e rodapé: "Todas as
// peças", as categorias com peça e "Outras peças" (as sem categoria).
//
// P1: voltar da peça caía no topo da home/categoria. A posição é guardada
// com a entrada do histórico e só volta no voltar do navegador.
//
// P1: link direto de peça que saiu da loja abre a home com o recado.
// ============================================================
import {
  navegacaoDaLoja, grupoDasOutrasPecas, chaveDasOutrasPecas, pecasSemCategoria, ehOutrasPecas,
  entradaAtiva, alvoDaCategoria, menuDaLoja, NOME_DAS_OUTRAS_PECAS, NOME_DE_TODAS_AS_PECAS, ID_DAS_OUTRAS_PECAS,
} from "@/components/studio/storefront/home/regrasDaHome";
import { resolverTela, AVISO_PECA_FORA } from "@/components/studio/storefront/rotasDaVitrine";
import { agruparVitrine } from "@/components/studio/storefront/categoryGrouping";
import { navegacaoDoRodapeNovo, MAXIMO_NA_NAVEGACAO } from "@/components/studio/storefront/conteudoDoRodape";
import {
  chaveDaRolagem, deveRestaurar, guardarRolagem, rolagemParaRestaurar, VALIDADE_DA_ROLAGEM_MS,
  pedirAGradeNaHome, consumirPedidoDaGrade,
} from "@/components/studio/storefront/home/rolagemDaVitrine";

const cat = (id: string, name: string, parent: string | null = null) => ({
  id, name, slug: id, path: "/" + id, depth: parent ? 1 : 0, parent_id: parent,
});

function peca(id: string, category_id: string | null = null) {
  return {
    id, name: "Peça " + id, description: null, price: 49.9, image_url: null,
    category: null, category_id, stock_qty: 1, pedidos: 0, visual_kind: null,
    customization_config: null, templates: [],
  } as any;
}

function loja(categories: any[], products: any[]): any {
  return { categories, products, site: { name: "Loja" }, payment: {}, delivery: {} };
}

// A aura-qa como está: 3 categorias, só Canecas com peça (10), 21 sem categoria.
const CATS_QA = [cat("cartao-de-visita", "Cartão de visita"), cat("foto-colorida", "Foto Colorida"), cat("canecas", "Canecas")];
const QA = loja(CATS_QA, [
  ...Array.from({ length: 10 }, (_, i) => peca("c" + i, "canecas")),
  ...Array.from({ length: 21 }, (_, i) => peca("s" + i)),
]);

describe("a barra, a gaveta e o rodapé: a mesma lista", () => {
  test("aura-qa: Todas as peças, Canecas e Outras peças, nessa ordem", () => {
    const n = navegacaoDaLoja(QA);
    expect(n.map((e) => [e.tipo, e.rotulo, e.total])).toEqual([
      ["todas", NOME_DE_TODAS_AS_PECAS, 31],
      ["categoria", "Canecas", 10],
      ["outras", NOME_DAS_OUTRAS_PECAS, 21],
    ]);
  });

  test("Sheid (9 e 1): a barra existe com uma categoria só", () => {
    const sheid = loja([cat("canecas", "Canecas")], [...Array.from({ length: 9 }, (_, i) => peca("c" + i, "canecas")), peca("solta")]);
    expect(navegacaoDaLoja(sheid).map((e) => e.tipo)).toEqual(["todas", "categoria", "outras"]);
    // Uma peça solta: o grupo abre a peça direto (a vitrine não mostra grade de um item).
    const outras = grupoDasOutrasPecas(sheid)!;
    expect(alvoDaCategoria(outras.categoria, sheid)).toMatchObject({ tipo: "produto", produto: { id: "solta" } });
  });

  test("sem nenhuma categoria com peça: só Todas as peças", () => {
    const semCategoria = loja(CATS_QA, [peca("1"), peca("2"), peca("3")]);
    expect(navegacaoDaLoja(semCategoria).map((e) => e.tipo)).toEqual(["todas"]);
    expect(grupoDasOutrasPecas(semCategoria)).toBeNull();
  });

  test("sem peça solta: sem Outras peças", () => {
    const tudoCategorizado = loja([cat("a", "A"), cat("b", "B")], [peca("1", "a"), peca("2", "b"), peca("3", "b")]);
    expect(navegacaoDaLoja(tudoCategorizado).map((e) => e.rotulo)).toEqual([NOME_DE_TODAS_AS_PECAS, "B", "A"]);
  });

  test("menos de 2 peças: nada para navegar", () => {
    expect(navegacaoDaLoja(loja([cat("a", "A")], [peca("1", "a")]))).toEqual([]);
    expect(navegacaoDaLoja(loja([], []))).toEqual([]);
    expect(navegacaoDaLoja(null)).toEqual([]);
  });

  test("categoria desconhecida conta como sem categoria", () => {
    const l = loja([cat("a", "A")], [peca("1", "a"), peca("2", "sumiu"), peca("3")]);
    expect(pecasSemCategoria(l).map((p) => p.id)).toEqual(["2", "3"]);
  });

  test("as categorias são as do menu de sempre (menuDaLoja)", () => {
    const n = navegacaoDaLoja(QA).filter((e) => e.tipo === "categoria");
    expect(n.map((e) => e.rotulo)).toEqual(menuDaLoja(QA).map((i) => i.categoria.name));
  });

  test("o rodapé usa a mesma lista, com o teto nas categorias", () => {
    const cats = Array.from({ length: 9 }, (_, i) => cat("k" + i, "Cat " + i));
    const l = loja(cats, [...cats.map((c) => peca("p" + c.id, c.id)), peca("solta")]);
    const r = navegacaoDoRodapeNovo(l);
    expect(r[0].tipo).toBe("todas");
    expect(r.filter((e) => e.tipo === "categoria")).toHaveLength(MAXIMO_NA_NAVEGACAO);
    expect(r[r.length - 1].tipo).toBe("outras");
    expect(navegacaoDoRodapeNovo(QA).map((e) => e.rotulo)).toEqual(navegacaoDaLoja(QA).map((e) => e.rotulo));
  });
});

describe("o grupo Outras peças", () => {
  test("tem cara de categoria de primeiro nível, com a chave /c/outras", () => {
    const g = grupoDasOutrasPecas(QA)!;
    expect(g.categoria).toMatchObject({ id: ID_DAS_OUTRAS_PECAS, name: "Outras peças", slug: "outras", parent_id: null });
    expect(g.produtos).toHaveLength(21);
    expect(ehOutrasPecas(g.categoria)).toBe(true);
    expect(ehOutrasPecas(CATS_QA[2])).toBe(false);
    expect(alvoDaCategoria(g.categoria, QA)).toMatchObject({ tipo: "grupo" });
  });

  test("categoria de verdade com o slug 'outras' vence: o grupo pega a próxima chave", () => {
    expect(chaveDasOutrasPecas([cat("outras", "Outras")] as any)).toBe("outras-pecas");
    expect(chaveDasOutrasPecas([cat("outras", "O"), cat("outras-pecas", "OP")] as any)).toBe("mais-pecas");
    expect(chaveDasOutrasPecas([])).toBe("outras");
  });

  test("a rota /c/outras abre a página com as peças sem categoria", () => {
    const r = resolverTela({ tipo: "categoria", categoria: "outras" }, QA, agruparVitrine(QA.products, QA.categories));
    expect(r.acao).toBe("categoria");
    if (r.acao !== "categoria") return;
    expect(r.categoria.name).toBe("Outras peças");
    expect(r.produtos).toHaveLength(21);
  });

  test("/c/outras numa loja sem peça solta volta para a home", () => {
    const l = loja([cat("a", "A")], [peca("1", "a"), peca("2", "a")]);
    expect(resolverTela({ tipo: "categoria", categoria: "outras" }, l, agruparVitrine(l.products, l.categories)))
      .toEqual({ acao: "redirecionar", para: { tipo: "home" } });
  });

  test("o sublinhado: a entrada da página aberta fica ativa; Todas as peças nunca", () => {
    const [todas, canecas, outras] = navegacaoDaLoja(QA);
    expect(entradaAtiva(canecas, "canecas")).toBe(true);
    expect(entradaAtiva(outras, "outras")).toBe(true);
    expect(entradaAtiva(outras, "canecas")).toBe(false);
    expect(entradaAtiva(todas, "todas")).toBe(false);
    expect(entradaAtiva(canecas, null)).toBe(false);
  });
});

describe("voltar da peça devolve a rolagem", () => {
  const agora = 1_000_000;
  test("a chave é da loja e da tela", () => {
    expect(chaveDaRolagem(" Aura-QA ", "home")).toBe("aura-qa|home");
    expect(chaveDaRolagem("aura-qa", "c:canecas")).toBe("aura-qa|c:canecas");
  });

  test("só restaura na mesma entrada do histórico (o voltar), dentro da validade", () => {
    const salva = { y: 1200, entrada: "abc", ts: agora };
    expect(deveRestaurar(salva, "abc", agora + 1000)).toBe(true);
    // Tela aberta de novo por um toque: entrada nova, começa no topo.
    expect(deveRestaurar(salva, "xyz", agora + 1000)).toBe(false);
    expect(deveRestaurar(salva, "", agora)).toBe(false);
    expect(deveRestaurar(salva, "abc", agora + VALIDADE_DA_ROLAGEM_MS + 1)).toBe(false);
    expect(deveRestaurar({ ...salva, y: 0 }, "abc", agora)).toBe(false);
    expect(deveRestaurar(null, "abc", agora)).toBe(false);
  });

  test("guardar e ler: lida uma vez, depois some", () => {
    const k = chaveDaRolagem("loja", "home");
    guardarRolagem(k, 850.4, "e1", agora);
    expect(rolagemParaRestaurar(k, "e1", agora + 10)).toBe(850);
    expect(rolagemParaRestaurar(k, "e1", agora + 20)).toBeNull();
  });

  test("sem entrada conhecida não guarda; no topo apaga o que havia", () => {
    const k = chaveDaRolagem("loja", "c:x");
    guardarRolagem(k, 500, "", agora);
    expect(rolagemParaRestaurar(k, "", agora)).toBeNull();
    guardarRolagem(k, 500, "e2", agora);
    guardarRolagem(k, 0, "e2", agora);
    expect(rolagemParaRestaurar(k, "e2", agora)).toBeNull();
  });

  test("Todas as peças de fora da home: o pedido vale para a próxima home, uma vez", () => {
    expect(consumirPedidoDaGrade()).toBe(false);
    pedirAGradeNaHome();
    expect(consumirPedidoDaGrade()).toBe(true);
    expect(consumirPedidoDaGrade()).toBe(false);
  });
});

describe("peça fora da loja por link direto", () => {
  test("volta para a home com o recado na voz da loja", () => {
    const r = resolverTela({ tipo: "produto", id: "oculta" }, QA, agruparVitrine(QA.products, QA.categories));
    expect(r).toEqual({ acao: "redirecionar", para: { tipo: "home" }, aviso: AVISO_PECA_FORA });
    expect(AVISO_PECA_FORA).toBe("Essa peça não está mais na loja. Escolha outra: as artes continuam suas.");
  });
});
