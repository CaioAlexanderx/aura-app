// ============================================================
// AURA. — abcCategoryUtils (Fase 1 ABC por categoria, 16/09/2026)
//
// Pedido do Caio (16/09): levar as categorias do estoque pra curva ABC do
// Financeiro. O backend em /companies/:id/products/categories já devolve
// {category, total_products, total_revenue, total_qty, share_pct} orde-
// nado por receita — mas SEM classe A/B/C (só o /products/ranking, por
// produto, classifica). Este módulo replica a classificação no cliente.
//
// REGRA REPLICADA — aura-backend src/services/productsRanking.js,
// função classifyABC (lida via `git show origin/main:...`, não alterada):
//
//   function classifyABC(products, totalRevenue) {
//     let accumulated = 0;
//     return products.map(product => {
//       accumulated += product.total_revenue;
//       const pct = totalRevenue > 0 ? (accumulated / totalRevenue) * 100 : 0;
//       const abc = pct <= 80 ? 'A' : pct <= 95 ? 'B' : 'C';
//       return { ...product, accumulated_pct: parseFloat(pct.toFixed(1)), abc };
//     });
//   }
//
// Pontos finos da réplica (testados em abcCategoryClassification.test.ts):
//   - Acumula na ORDEM em que os itens chegam. O backend nunca ordena
//     dentro de classifyABC — quem ordena é o SQL (`ORDER BY total_revenue
//     DESC`), tanto em getProductsRanking quanto em getCategories. Este
//     módulo espera a lista JÁ ordenada por total_revenue DESC (é o que
//     a API devolve) e NÃO reordena — reordenar aqui mascararia uma
//     eventual regressão de ordenação no backend em vez de estourar o teste.
//   - Corte usa o `pct` CRU (sem arredondar) contra 80/95 — só o
//     accumulated_pct exibido é arredondado (parseFloat(toFixed(1))).
//     Arredondar antes de comparar mudaria o corte perto de 79,96% etc.
//   - totalRevenue <= 0 (todas as categorias com receita zero) faz todo
//     mundo cair em 'A' (pct fica 0, e 0 <= 80) — mesmo comportamento do
//     backend, não um caso especial daqui.
// ============================================================
import type { ProductCategoryRanking } from "@/services/companiesApi";
import type { Grade } from "./abcShared";
import type { FlatCategory } from "@/hooks/useCategories";

export type Classifiable = { total_revenue: number };

export function classifyABC<T extends Classifiable>(
  items: T[],
  totalRevenue: number
): (T & { accumulated_pct: number; abc: Grade })[] {
  let accumulated = 0;
  return items.map((item) => {
    accumulated += item.total_revenue;
    const pct = totalRevenue > 0 ? (accumulated / totalRevenue) * 100 : 0;
    const abc: Grade = pct <= 80 ? "A" : pct <= 95 ? "B" : "C";
    return { ...item, accumulated_pct: parseFloat(pct.toFixed(1)), abc };
  });
}

export type ClassifiedCategory = ProductCategoryRanking & { accumulated_pct: number; abc: Grade };

// A soma das receitas da própria lista — o backend usa a mesma soma (das
// linhas que ele mesmo devolveu) como denominador, não um total "geral"
// separado. Replicar isso aqui evita um total_revenue de fonte diferente
// (ex.: de sales/analytics) divergir do que a tabela realmente soma.
export function sumRevenue(items: Classifiable[]): number {
  return items.reduce((sum, it) => sum + (it.total_revenue || 0), 0);
}

// ── Frase de leitura ────────────────────────────────────────
// "3 categorias fazem 80% da receita: Calçados, Blusas e Bolsas"
// É literalmente "quantas categorias caíram em A" — por definição da
// classificação, A é quem soma até 80% acumulado. Não é um cálculo
// paralelo: reaproveita o `abc` que já saiu de classifyABC.
const MAX_NAMES_NA_FRASE = 5;

export function buildReadingSentence(classified: ClassifiedCategory[]): string {
  const gradeA = classified.filter((c) => c.abc === "A");
  if (gradeA.length === 0) {
    return "Nenhuma categoria concentra 80% da receita sozinha.";
  }
  const n = gradeA.length;
  const shown = gradeA.slice(0, MAX_NAMES_NA_FRASE).map((c) => c.category);
  const extra = n - shown.length;
  let list: string;
  if (shown.length === 1) list = shown[0];
  else list = shown.slice(0, -1).join(", ") + " e " + shown[shown.length - 1];
  if (extra > 0) list += ` (+${extra})`;
  const categoriaTxt = n === 1 ? "categoria faz" : "categorias fazem";
  return `${n} ${categoriaTxt} 80% da receita: ${list}`;
}

// ── Hierarquia de categoria-mãe (melhor esforço) ────────────
// products.category grava só o NOME DA FOLHA, não o caminho completo —
// confirmado em aura-backend src/routes/productCategories.js:
//   `p.category = c.name` (rename em cascata usa o mesmo join por nome).
// Não há coluna "path"/"parent" no produto: pra descobrir a categoria-mãe
// de uma linha do ranking, cruzamos o NOME com a árvore de
// useCategories().flattened (que carrega o breadcrumb completo).
//
// Isso é inerentemente melhor esforço, não uma junção por id:
//   - nomes duplicados em ramos diferentes (ex. "Outros" embaixo de duas
//     categorias-mãe) colapsam no primeiro encontrado — mesma ambiguidade
//     que o backend já aceita hoje no COUNT por nome de productCategories.js;
//   - uma categoria apagada da árvore mas ainda presente em vendas antigas
//     (products.category preservado por histórico) não acha nada e vira
//     linha solta, sem mãe — comportamento correto, não bug.
export function buildCategoryLookup(flattened: FlatCategory[]): Map<string, FlatCategory> {
  const map = new Map<string, FlatCategory>();
  for (const f of flattened) {
    if (!map.has(f.category.name)) map.set(f.category.name, f);
  }
  return map;
}

export function parentNameOf(categoryName: string, lookup: Map<string, FlatCategory>): string | null {
  const found = lookup.get(categoryName);
  if (!found) return null;
  const breadcrumb = found.breadcrumb;
  return breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2].name : null;
}

export type CategoryDisplayRow =
  | { kind: "leaf"; item: ClassifiedCategory }
  | {
      kind: "group";
      parentName: string;
      children: ClassifiedCategory[];
      total_products: number;
      total_revenue: number;
      total_qty: number;
      share_pct: number;
      grades: Grade[];
    };

// Agrupa linhas cuja categoria-mãe também está presente (com 2+ filhas)
// no próprio ranking — só assim "mostrar a mãe expansível" faz sentido.
// Uma única filha no período não vira grupo (nada pra expandir).
export function buildCategoryDisplayRows(
  classified: ClassifiedCategory[],
  lookup: Map<string, FlatCategory>
): CategoryDisplayRow[] {
  const parentOf = new Map<string, string | null>();
  for (const c of classified) parentOf.set(c.category, parentNameOf(c.category, lookup));

  const childCountByParent = new Map<string, number>();
  parentOf.forEach((parent) => {
    if (!parent) return;
    childCountByParent.set(parent, (childCountByParent.get(parent) || 0) + 1);
  });

  const emittedParents = new Set<string>();
  const rows: CategoryDisplayRow[] = [];
  for (const item of classified) {
    const parent = parentOf.get(item.category) || null;
    const grouped = !!parent && (childCountByParent.get(parent) || 0) >= 2;
    if (!grouped) {
      rows.push({ kind: "leaf", item });
      continue;
    }
    if (emittedParents.has(parent as string)) continue; // já emitido — a filha entra dentro do grupo
    emittedParents.add(parent as string);
    const children = classified.filter((c) => parentOf.get(c.category) === parent);
    rows.push({
      kind: "group",
      parentName: parent as string,
      children,
      total_products: children.reduce((s, c) => s + c.total_products, 0),
      total_revenue: children.reduce((s, c) => s + c.total_revenue, 0),
      total_qty: children.reduce((s, c) => s + c.total_qty, 0),
      share_pct: children.reduce((s, c) => s + (c.share_pct || 0), 0),
      grades: Array.from(new Set(children.map((c) => c.abc))).sort(),
    });
  }
  return rows;
}

// ── CSV ──────────────────────────────────────────────────────
// Exporta sempre a lista FOLHA (não agrupada) — é o dado bruto, sem a
// decisão visual de agrupamento por mãe, que existe só pra leitura na tela.
export const CATEGORY_CSV_HEADERS = [
  "#", "Categoria", "Classe", "Produtos vendidos", "Quantidade", "Receita (R$)", "% da receita", "% acumulado",
];

export function categoryCsvRows(classified: ClassifiedCategory[]): string[][] {
  return classified.map((c, i) => [
    String(i + 1),
    (c.category || "").replace(/"/g, '""'),
    c.abc,
    String(c.total_products),
    String(c.total_qty),
    c.total_revenue.toFixed(2).replace(".", ","),
    c.share_pct != null ? String(c.share_pct).replace(".", ",") : "",
    String(c.accumulated_pct).replace(".", ","),
  ]);
}

// ── Seletor de visão lembrado por usuário ───────────────────
// Mesmo padrão de components/screens/financeiro/CollapsibleSection.tsx
// (STORAGE_PREFIX + try/catch em volta de toda leitura/escrita).
export type AbcViewMode = "produto" | "categoria";
const VIEW_MODE_KEY = "aura.financeiro.abc.viewMode";

export function getInitialViewMode(): AbcViewMode {
  if (typeof window === "undefined" || !window.localStorage) return "produto";
  try {
    const raw = window.localStorage.getItem(VIEW_MODE_KEY);
    return raw === "categoria" ? "categoria" : "produto";
  } catch {
    return "produto";
  }
}

export function persistViewMode(mode: AbcViewMode) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    // storage cheio ou desabilitado — silencioso, mesma postura do CollapsibleSection
  }
}
