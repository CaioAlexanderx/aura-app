// ============================================================
// components/studio/storefront/categoryGrouping.ts
// S1 (19/08/2026) — uma página por CATEGORIA, não por SKU.
//
// A Sheid tem 9 canecas que são o mesmo produto com modelos diferentes.
// Nove cartões na vitrine é ruim para o cliente (escolher entre nove
// páginas quase iguais) e ruim para a lojista (nove cadastros para manter
// alinhados). A F0 já dá a árvore; aqui ela vira navegação.
//
// Duas funções puras, testáveis fora do hook:
//   agruparVitrine   — produtos + árvore → entradas da vitrine
//   transportarValores — o que o cliente já preencheu sobrevive à troca
//                        de modelo
// ============================================================
import type { StudioStoreProduct, CustomizationConfig } from "./types";

export type StoreCategory = {
  id: string;
  name: string;
  slug: string;
  path: string;
  depth: number;
  parent_id: string | null;
};

/** Uma linha da vitrine: uma categoria com N modelos, ou um produto solto. */
export type VitrineEntry =
  | { kind: "category"; category: StoreCategory; products: StudioStoreProduct[] }
  | { kind: "product"; product: StudioStoreProduct };

/**
 * Agrupa os produtos pela categoria PRIMÁRIA.
 *
 * Regras que valem a pena dizer em voz alta:
 *
 * - Categoria com UM produto só não vira grupo. Um cartão "Canecas" que
 *   abre e mostra uma única opção é um passo a mais sem informação nenhuma.
 * - Produto sem `category_id` continua aparecendo sozinho. A F1 não pode
 *   depender de a taxonomia estar 100% preenchida — hoje a Sheid tem 36
 *   dos 74 produtos sem categoria.
 * - A ordem da vitrine segue a ordem dos produtos como vieram do backend:
 *   o grupo ocupa a posição do seu primeiro produto. Assim ligar a
 *   taxonomia não embaralha uma vitrine que a lojista já organizou.
 * - Categoria sem produto visível não aparece. A árvore é do catálogo
 *   inteiro; a vitrine só mostra o que tem o que vender.
 */
export function agruparVitrine(
  products: StudioStoreProduct[],
  categories: StoreCategory[]
): VitrineEntry[] {
  const catById = new Map<string, StoreCategory>();
  for (const c of categories || []) catById.set(c.id, c);

  const porCategoria = new Map<string, StudioStoreProduct[]>();
  for (const p of products) {
    const cid = p.category_id;
    if (!cid || !catById.has(cid)) continue;
    const lista = porCategoria.get(cid);
    if (lista) lista.push(p);
    else porCategoria.set(cid, [p]);
  }

  const entries: VitrineEntry[] = [];
  const jaEmitido = new Set<string>();

  for (const p of products) {
    const cid = p.category_id;
    const grupo = cid ? porCategoria.get(cid) : undefined;

    // Grupo de verdade = 2 ou mais modelos.
    if (cid && grupo && grupo.length > 1) {
      if (jaEmitido.has(cid)) continue;
      jaEmitido.add(cid);
      entries.push({ kind: "category", category: catById.get(cid)!, products: grupo });
      continue;
    }
    entries.push({ kind: "product", product: p });
  }

  return entries;
}

/** Menor preço do grupo — é o "a partir de" do cartão. */
export function precoMinimo(products: StudioStoreProduct[]): number {
  return products.reduce(
    (min, p) => (Number(p.price) < min ? Number(p.price) : min),
    Number(products[0]?.price ?? 0)
  );
}

/** Primeira imagem disponível no grupo, para o cartão da categoria. */
export function imagemDoGrupo(products: StudioStoreProduct[]): string | null {
  for (const p of products) if (p.image_url) return p.image_url;
  return null;
}

/**
 * Carrega os valores já preenchidos de um modelo para outro.
 *
 * POR QUE POR TIPO, E NÃO POR ID: os ids dos campos não são estáveis
 * entre produtos. O painel de personalização gera `f_<timestamp>`, então
 * o campo "Texto" da CANECA BRANCA e o da CANECA CHOPP têm ids
 * diferentes. Casar por id perderia tudo a cada troca de modelo, que é
 * justamente a ação que a página por categoria torna comum.
 *
 * O casamento é por `type`, na ordem em que os campos aparecem, e cada
 * campo de origem é consumido uma vez só — dois campos de texto no
 * destino recebem o primeiro e o segundo texto da origem, não o mesmo
 * duas vezes.
 *
 * Valor que não tem para onde ir é descartado. Trocar de um modelo com
 * verso para um sem verso não pode levar junto a arte do verso.
 */
export function transportarValores(
  origem: CustomizationConfig | null | undefined,
  destino: CustomizationConfig | null | undefined,
  values: Record<string, any>
): Record<string, any> {
  const fromFields = origem?.fields || [];
  const toFields = destino?.fields || [];
  if (!fromFields.length || !toFields.length) return {};

  const disponiveis = fromFields.filter(
    (f) => values[f.id] !== undefined && values[f.id] !== null && values[f.id] !== ""
  );
  const usados = new Set<string>();
  const out: Record<string, any> = {};

  for (const alvo of toFields) {
    const casa = disponiveis.find((f) => f.type === alvo.type && !usados.has(f.id));
    if (!casa) continue;
    usados.add(casa.id);
    out[alvo.id] = values[casa.id];
  }

  // has_back_selected não é campo, é bandeira — só sobrevive se o modelo
  // de destino também tiver verso.
  if (values.has_back_selected === true && destino?.has_back === true) {
    out.has_back_selected = true;
  }

  return out;
}
