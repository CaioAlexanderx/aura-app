// ============================================================
// Fase 1 — Curva ABC por categoria (16/09/2026)
//
// Prova que a classificação replicada em
// components/screens/financeiro/v2/abcCategoryUtils.ts produz EXATAMENTE
// o mesmo resultado que a função original do backend, nos mesmos casos
// (corte 80/95, empate exatamente no corte, receita zero). A função
// `backendClassifyABC` abaixo é uma cópia fiel, lida com
// `git show origin/main:src/services/productsRanking.js` em
// aura-backend (NÃO alterado, só lido) — serve de oráculo pro teste.
//
// Também cobre a frase de leitura e o agrupamento por categoria-mãe.
// ============================================================
import {
  classifyABC,
  sumRevenue,
  buildReadingSentence,
  buildCategoryLookup,
  buildCategoryDisplayRows,
  categoryCsvRows,
  CATEGORY_CSV_HEADERS,
  getInitialViewMode,
  persistViewMode,
  type ClassifiedCategory,
} from "@/components/screens/financeiro/v2/abcCategoryUtils";
import type { FlatCategory } from "@/hooks/useCategories";

// Cópia fiel de classifyABC em aura-backend/src/services/productsRanking.js
// (função `classifyABC(products, totalRevenue)`). Usada só como oráculo
// neste teste — não é importada de lugar nenhum do app.
function backendClassifyABC<T extends { total_revenue: number }>(products: T[], totalRevenue: number) {
  let accumulated = 0;
  return products.map((product) => {
    accumulated += product.total_revenue;
    const pct = totalRevenue > 0 ? (accumulated / totalRevenue) * 100 : 0;
    const abc = pct <= 80 ? "A" : pct <= 95 ? "B" : "C";
    return { ...product, accumulated_pct: parseFloat(pct.toFixed(1)), abc };
  });
}

function cat(name: string, revenue: number) {
  return { category: name, total_products: 1, total_revenue: revenue, total_qty: 1, share_pct: 0 };
}

describe("classifyABC — equivalência com o backend", () => {
  it("caso normal (a mesma tabela do exemplo do pedido)", () => {
    const items = [cat("Calçados", 4000), cat("Blusas", 2500), cat("Bolsas", 1500), cat("Fones", 600), cat("Carregadores", 500), cat("Meias", 500), cat("Outros", 400)];
    const total = sumRevenue(items);
    const mine = classifyABC(items, total);
    const oracle = backendClassifyABC(items, total);
    expect(mine.map((m) => ({ category: m.category, abc: m.abc, accumulated_pct: m.accumulated_pct }))).toEqual(
      oracle.map((o) => ({ category: o.category, abc: o.abc, accumulated_pct: o.accumulated_pct }))
    );
    expect(mine.map((m) => m.abc)).toEqual(["A", "A", "A", "B", "B", "C", "C"]);
  });

  it("empate EXATO no corte de 80% cai em A (pct <= 80, não < 80)", () => {
    const items = [cat("X", 80), cat("Y", 20)];
    const total = 100;
    const mine = classifyABC(items, total);
    const oracle = backendClassifyABC(items, total);
    expect(mine[0].abc).toBe("A"); // acumulado 80% exato
    expect(mine[0].accumulated_pct).toBe(80);
    expect(mine).toEqual(oracle);
  });

  it("empate EXATO no corte de 95% cai em B (pct <= 95, não < 95)", () => {
    const items = [cat("X", 80), cat("Y", 15), cat("Z", 5)];
    const total = 100;
    const mine = classifyABC(items, total);
    const oracle = backendClassifyABC(items, total);
    expect(mine[1].abc).toBe("B"); // acumulado 95% exato
    expect(mine[1].accumulated_pct).toBe(95);
    expect(mine[2].abc).toBe("C"); // acumulado 100%
    expect(mine).toEqual(oracle);
  });

  it("receita total zero: tudo cai em A (pct fica 0, e 0 <= 80) — não é caso especial, é a mesma fórmula", () => {
    const items = [cat("X", 0), cat("Y", 0)];
    const mine = classifyABC(items, 0);
    const oracle = backendClassifyABC(items, 0);
    expect(mine.every((m) => m.abc === "A")).toBe(true);
    expect(mine).toEqual(oracle);
  });

  it("categoria única: 100% acumulado cai em C (não é caso especial — mesma fórmula, 100 > 95)", () => {
    const items = [cat("Única", 50)];
    const mine = classifyABC(items, 50); // total = a própria receita → cum 100%
    expect(mine[0].abc).toBe("C");
    expect(mine[0].accumulated_pct).toBe(100);

    // Mesmo item, mas com um total maior (ex.: essa categoria é uma entre
    // várias que somam 1000) — cum vira 5%, cai em A.
    const mineSubset = classifyABC(items, 1000);
    expect(mineSubset[0].abc).toBe("A");
  });

  it("não reordena — espera a lista já ordenada por receita DESC (mesma responsabilidade do SQL do backend)", () => {
    // Fora de ordem de propósito: a função NÃO deve corrigir isso.
    const items = [cat("Pequena", 100), cat("Grande", 900)];
    const mine = classifyABC(items, 1000);
    expect(mine[0].category).toBe("Pequena");
    expect(mine[0].accumulated_pct).toBe(10); // acumula na ordem dada, não na de receita
  });

  it("lista vazia não quebra", () => {
    expect(classifyABC([], 0)).toEqual([]);
  });
});

describe("buildReadingSentence", () => {
  it("reproduz o exemplo do pedido: '3 categorias fazem 80% da receita: Calçados, Blusas e Bolsas'", () => {
    const items = [cat("Calçados", 4000), cat("Blusas", 2500), cat("Bolsas", 1500), cat("Fones", 600), cat("Carregadores", 500), cat("Meias", 500), cat("Outros", 400)];
    const total = sumRevenue(items);
    const classified = classifyABC(items, total) as ClassifiedCategory[];
    expect(buildReadingSentence(classified)).toBe("3 categorias fazem 80% da receita: Calçados, Blusas e Bolsas");
  });

  it("singular quando só 1 categoria é A", () => {
    const items = [cat("Tudo", 80), cat("Resto", 20)];
    const classified = classifyABC(items, 100) as ClassifiedCategory[];
    expect(buildReadingSentence(classified)).toBe("1 categoria faz 80% da receita: Tudo");
  });

  it("mensagem alternativa quando nenhuma categoria é A (não deveria acontecer na prática, mas não pode quebrar)", () => {
    const classified: ClassifiedCategory[] = [];
    expect(buildReadingSentence(classified)).toBe("Nenhuma categoria concentra 80% da receita sozinha.");
  });

  it("trunca nomes além do limite com contador (+N)", () => {
    const items = Array.from({ length: 8 }, (_, i) => cat("Cat" + i, 10));
    const classified = classifyABC(items, 80) as ClassifiedCategory[]; // acumulado exato 100% no fim, todas A até 80%
    const sentence = buildReadingSentence(classified);
    expect(sentence).toContain("(+");
  });
});

describe("buildCategoryDisplayRows — agrupamento por categoria-mãe", () => {
  function flat(name: string, breadcrumbNames: string[]): FlatCategory {
    const breadcrumb = breadcrumbNames.map((n, i) => ({
      id: n, company_id: "c1", type: "product" as const, parent_id: i === 0 ? null : breadcrumbNames[i - 1],
      name: n, slug: n.toLowerCase(), path: "/" + breadcrumbNames.slice(0, i + 1).join("/").toLowerCase(),
      depth: i as 0 | 1 | 2, sort_order: 0, color: null, image_url: null, banner_url: null,
      is_visible_storefront: true, seo_title: null, seo_description: null, product_count: 0,
    }));
    return { category: breadcrumb[breadcrumb.length - 1], breadcrumb };
  }

  it("agrupa 2+ filhas presentes no ranking sob a mãe; filha única não vira grupo", () => {
    const items = [cat("Fones", 600), cat("Carregadores", 500), cat("Calçados", 4000), cat("Bolsas", 1500)];
    const total = sumRevenue(items);
    const classified = classifyABC(items, total) as ClassifiedCategory[];

    const lookup = buildCategoryLookup([
      flat("Fones", ["Eletrônicos", "Fones"]),
      flat("Carregadores", ["Eletrônicos", "Carregadores"]),
      flat("Calçados", ["Calçados"]), // top-level, sem mãe
      // "Bolsas" nem aparece na árvore (categoria deletada/antiga) — vira linha solta
    ]);

    const rows = buildCategoryDisplayRows(classified, lookup);
    const groupRow = rows.find((r) => r.kind === "group");
    expect(groupRow).toBeDefined();
    if (groupRow && groupRow.kind === "group") {
      expect(groupRow.parentName).toBe("Eletrônicos");
      expect(groupRow.children.map((c) => c.category).sort()).toEqual(["Carregadores", "Fones"]);
      expect(groupRow.total_revenue).toBe(1100);
    }
    // Fones/Carregadores não aparecem soltos (foram consumidos pelo grupo)
    expect(rows.some((r) => r.kind === "leaf" && r.item.category === "Fones")).toBe(false);
    // Calçados e Bolsas seguem soltos (sem mãe / sem 2+ irmãs no ranking)
    expect(rows.some((r) => r.kind === "leaf" && r.item.category === "Calçados")).toBe(true);
    expect(rows.some((r) => r.kind === "leaf" && r.item.category === "Bolsas")).toBe(true);
  });

  it("categoria ausente da árvore (histórico antigo) vira linha solta, sem quebrar", () => {
    const items = [cat("Categoria Sumida", 100)];
    const classified = classifyABC(items, 100) as ClassifiedCategory[];
    const rows = buildCategoryDisplayRows(classified, buildCategoryLookup([]));
    expect(rows).toEqual([{ kind: "leaf", item: classified[0] }]);
  });
});

describe("categoryCsvRows", () => {
  it("gera header e linhas na ordem #, Categoria, Classe, Produtos, Quantidade, Receita, % receita, % acumulado", () => {
    expect(CATEGORY_CSV_HEADERS).toEqual([
      "#", "Categoria", "Classe", "Produtos vendidos", "Quantidade", "Receita (R$)", "% da receita", "% acumulado",
    ]);
    const items = [{ ...cat("Calçados", 4000), total_products: 18, total_qty: 210, share_pct: 40 }];
    // total=10000 simula o denominador real (a categoria é uma entre várias
    // que somam 10000) — cum = 4000/10000 = 40%, abc 'A' (<=80).
    const classified = classifyABC(items, 10000) as ClassifiedCategory[];
    const rows = categoryCsvRows(classified);
    expect(rows).toEqual([["1", "Calçados", "A", "18", "210", "4000,00", "40", "40"]]);
  });
});

describe("seletor de visão lembrado (localStorage)", () => {
  const KEY = "aura.financeiro.abc.viewMode";

  it("default é 'produto' sem nada salvo", () => {
    window.localStorage.clear();
    expect(getInitialViewMode()).toBe("produto");
  });

  it("persiste e relê 'categoria'", () => {
    window.localStorage.clear();
    persistViewMode("categoria");
    expect(window.localStorage.getItem(KEY)).toBe("categoria");
    expect(getInitialViewMode()).toBe("categoria");
  });

  it("valor lixo no storage cai no default em vez de quebrar", () => {
    window.localStorage.setItem(KEY, "lixo-qualquer");
    expect(getInitialViewMode()).toBe("produto");
  });

  it("não quebra se localStorage lançar (modo privado/desabilitado)", () => {
    const original = window.localStorage.setItem;
    window.localStorage.setItem = () => { throw new Error("storage indisponível"); };
    expect(() => persistViewMode("produto")).not.toThrow();
    window.localStorage.setItem = original;
  });
});
