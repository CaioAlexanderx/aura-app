// ============================================================
// Loja Digital do Studio · aba Configurador — regras puras (QA 26/09)
// ============================================================

/** O aviso de cada peça personalizável sem categoria. */
export const AVISO_SEM_CATEGORIA =
  "Sem categoria: na loja ela aparece só em 'Outras peças'. Defina a categoria em Editar produto.";

/**
 * A peça está sem categoria na vitrine?
 *
 * A vitrine agrupa pela categoria PRIMÁRIA (categoryGrouping.ts): peça
 * sem categoria — ou com uma que não existe mais na árvore da loja — cai
 * em "Outras peças". O painel lê isso de dois jeitos:
 *   - quando o produto traz `category_id` (null inclusive), vale ele,
 *     conferido contra as categorias existentes se a lista vier;
 *   - senão, pela lista de produtos sem categoria do servidor
 *     (`/products/unclassified`). Sem essa lista (falhou), não acusa
 *     nada: aviso falso é pior que nenhum.
 */
export function pecaSemCategoria(
  p: { id: string; category_id?: string | null },
  ctx: { semCategoria?: Set<string> | null; categorias?: Set<string> | null },
): boolean {
  if (p.category_id !== undefined) {
    if (!p.category_id) return true;
    return ctx.categorias ? !ctx.categorias.has(String(p.category_id)) : false;
  }
  return ctx.semCategoria ? ctx.semCategoria.has(String(p.id)) : false;
}

/** "1 produto disponível…" / "35 produtos disponíveis…" */
export function textoDoTotal(n: number): string {
  return n === 1
    ? "1 produto disponível para o configurador"
    : `${n} produtos disponíveis para o configurador`;
}

/** "1 peça sem categoria" / "3 peças sem categoria" */
export function textoSemCategoria(n: number): string {
  return n === 1 ? "1 peça sem categoria" : `${n} peças sem categoria`;
}

const POSICOES: Record<string, string> = {
  center: "Centro",
  left: "Esquerda",
  right: "Direita",
};

/** A posição da área de impressão como a lojista lê. */
export function rotuloDaPosicao(pos: string | null | undefined): string | null {
  if (!pos) return null;
  return POSICOES[String(pos).toLowerCase()] || null;
}
