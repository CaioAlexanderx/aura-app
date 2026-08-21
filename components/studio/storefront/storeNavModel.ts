// ============================================================
// AURA STUDIO · vitrine — modelo da barra de navegação
//
// A parte pura da navegação: monta a árvore, conta produtos e decide o que
// cabe na barra. Fica separada do componente porque é aqui que moram as
// regras que precisam de teste — o resto é layout.
//
// O QUE OS DADOS REAIS DIZEM (19/08/2026, produção):
//
//   Finesse           28 categorias, 0 subcategorias
//   Encanto Presentes 25 categorias, 0 subcategorias
//   Sheid Mania        3 categorias, 0 subcategorias
//
// Ninguém tem árvore. As colunas `parent_id`/`depth` existem desde a F0 e
// nunca foram usadas — inclusive por lojistas que TÊM o seletor de árvore
// no painel do varejo. Ou seja: o formato real a resolver é PLANO E
// NUMEROSO, e a hierarquia é o caso raro, não o comum.
//
// Por isso a barra não é um mega-menu à espera de árvore: ela funciona com
// 3 categorias planas, funciona com 28, e ABRE em colunas quando (e se) a
// hierarquia existir.
// ============================================================
import type { StoreCategory } from "./categoryGrouping";
import type { StudioStoreProduct } from "./types";

export type ItemMenu = {
  id: string;
  name: string;
  slug: string;
  /** Produtos visíveis nesta categoria, somando as filhas. */
  total: number;
  filhas: ItemMenu[];
};

export type Menu = {
  itens: ItemMenu[];
  /** Itens que não couberam na barra e vão para "Mais". */
  extras: ItemMenu[];
  /** Produtos sem categoria — a barra não some por causa deles. */
  soltos: number;
  /** true quando não há o que navegar e a barra não deve aparecer. */
  vazio: boolean;
};

/** Conta produtos por categoria, incluindo o que está nas filhas. */
function contar(
  cat: StoreCategory,
  porCategoria: Map<string, number>,
  filhasDe: Map<string, StoreCategory[]>,
): number {
  const proprios = porCategoria.get(cat.id) || 0;
  const filhas = filhasDe.get(cat.id) || [];
  return filhas.reduce((soma, f) => soma + contar(f, porCategoria, filhasDe), proprios);
}

function montarItem(
  cat: StoreCategory,
  porCategoria: Map<string, number>,
  filhasDe: Map<string, StoreCategory[]>,
): ItemMenu {
  const filhas = (filhasDe.get(cat.id) || [])
    .map((f) => montarItem(f, porCategoria, filhasDe))
    // Categoria sem produto não vira item de menu: a vitrine só navega
    // para onde há o que vender.
    .filter((f) => f.total > 0);

  return {
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    total: contar(cat, porCategoria, filhasDe),
    filhas,
  };
}

/**
 * Monta o menu a partir do que a vitrine já recebe.
 *
 * `maxNaBarra` é quantos itens cabem antes de sobrar para "Mais" — quem
 * mede a tela é o componente; aqui só dividimos.
 */
export function montarMenu(
  categorias: StoreCategory[] | undefined | null,
  produtos: StudioStoreProduct[],
  maxNaBarra = 7,
): Menu {
  const cats = Array.isArray(categorias) ? categorias : [];

  const porCategoria = new Map<string, number>();
  let soltos = 0;
  for (const p of produtos) {
    const cid = (p as any).category_id as string | null | undefined;
    if (cid) porCategoria.set(cid, (porCategoria.get(cid) || 0) + 1);
    else soltos++;
  }

  const filhasDe = new Map<string, StoreCategory[]>();
  for (const c of cats) {
    if (!c.parent_id) continue;
    const lista = filhasDe.get(c.parent_id) || [];
    lista.push(c);
    filhasDe.set(c.parent_id, lista);
  }

  // Raiz é quem não tem pai — ou cujo pai não veio no payload. Sem esse
  // segundo caso, uma categoria órfã sumiria da navegação inteira.
  const idsConhecidos = new Set(cats.map((c) => c.id));
  const raizes = cats.filter((c) => !c.parent_id || !idsConhecidos.has(c.parent_id));

  const itens = raizes
    .map((c) => montarItem(c, porCategoria, filhasDe))
    .filter((i) => i.total > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-BR"));

  // Com uma categoria só, navegar não significa nada: tudo que existe já
  // está na tela. A barra não aparece.
  const temOndeNavegar = itens.length >= 2;

  return {
    itens: itens.slice(0, maxNaBarra),
    extras: itens.slice(maxNaBarra),
    soltos,
    vazio: !temOndeNavegar,
  };
}

/**
 * Quantos itens cabem na barra nesta largura.
 *
 * Estimativa deliberadamente conservadora: é melhor mandar um item a mais
 * para "Mais" do que deixar a barra quebrar em duas linhas — o Oscar tem
 * 8 itens numa barra de 1440px, e é isso que a conta persegue.
 */
export function cabemNaBarra(larguraTela: number): number {
  // No celular a barra ROLA na horizontal: tudo fica inline e não existe
  // "Mais". Devolver 0 aqui esconderia as categorias todas atrás de um
  // botão — o oposto do que a barra existe para fazer.
  if (larguraTela < 720) return Number.MAX_SAFE_INTEGER;
  if (larguraTela < 1000) return 4;
  if (larguraTela < 1280) return 6;
  return 8;
}

/** Filtra os produtos da categoria escolhida, incluindo as filhas dela. */
export function produtosDaCategoria(
  produtos: StudioStoreProduct[],
  item: ItemMenu | null,
): StudioStoreProduct[] {
  if (!item) return produtos;
  const ids = new Set<string>();
  const empilhar = (i: ItemMenu) => { ids.add(i.id); i.filhas.forEach(empilhar); };
  empilhar(item);
  return produtos.filter((p) => {
    const cid = (p as any).category_id as string | null | undefined;
    return !!cid && ids.has(cid);
  });
}
