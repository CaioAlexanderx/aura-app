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

// ── Motivo oculto na loja (LJ-17, QA rodada 2, 28/09/2026) ───────────────
// O Configurador marcava tudo como "Visível: aparece na vitrine pública",
// mas a vitrine tem regras próprias (estoque, categoria inativa, etc.) que
// escondem a peça mesmo com o interruptor ligado. `motivo_oculto_na_loja`
// é o motivo que a VITRINE calculou — quando vier, ele conta mais que o
// texto genérico de "visível".

/** O motivo (recortado), ou null quando o campo não veio ou é vazio. */
export function motivoOcultoNaLoja(p: { motivo_oculto_na_loja?: string | null }): string | null {
  const m = (p.motivo_oculto_na_loja || "").trim();
  return m || null;
}

/** O backend novo manda o campo (mesmo que vazio) em pelo menos uma peça? Sem isso, nada muda. */
export function temMotivoDeOcultacao(products: Array<{ motivo_oculto_na_loja?: string | null }>): boolean {
  return products.some((p) => p.motivo_oculto_na_loja !== undefined);
}

/** "N peças visíveis na loja" (+ "· M ocultas" quando M > 0). */
export function textoDeVisibilidade(visiveis: number, ocultas: number): string {
  const base = visiveis === 1 ? "1 peça visível na loja" : `${visiveis} peças visíveis na loja`;
  if (ocultas <= 0) return base;
  return `${base} · ${ocultas} ${ocultas === 1 ? "oculta" : "ocultas"}`;
}

/** "1 peça sem categoria" / "3 peças sem categoria" */
export function textoSemCategoria(n: number): string {
  return n === 1 ? "1 peça sem categoria" : `${n} peças sem categoria`;
}

/**
 * Mostra o aviso de "sem categoria" no cartão da peça?
 *
 * QA fix (LJ-17, 28/09/2026): quando a peça já tem um `motivoOculto` mais
 * específico ("Não aparece na loja: Sem campos de personalização"), o
 * aviso de categoria fica redundante — a categoria não importa pra uma
 * peça que já não aparece por outro motivo, e mostrar os dois confunde.
 */
export function deveAvisarSemCategoria(orfa: boolean, motivoOculto: string | null): boolean {
  return orfa && !motivoOculto;
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
