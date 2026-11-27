// ============================================================
// waAbas — a fila de abas do celular: esmaecido nas bordas e aba ativa no centro
//
// A fila rola na horizontal. Só o lado em que há mais conteúdo ganha o esmaecido
// (mask-image com gradiente): sem sinal de que rola, a aba cortada parece defeito.
// Ao abrir, a aba ativa vai para o centro da fila (limitada às pontas).
// ============================================================
const FADE = 28;

/** CSS `mask-image` da fila: esmaece a esquerda se já rolou, a direita se ainda tem mais. null = sem máscara. */
export function mascaraDasBordas(x: number, larguraVisivel: number, larguraTotal: number): string | null {
  if (!(larguraVisivel > 0) || !(larguraTotal > 0)) return null;
  const esq = x > 4;
  const dir = x + larguraVisivel < larguraTotal - 4;
  if (esq && dir) return `linear-gradient(90deg,transparent 0,#000 ${FADE}px,#000 calc(100% - ${FADE}px),transparent 100%)`;
  if (esq) return `linear-gradient(90deg,transparent 0,#000 ${FADE}px)`;
  if (dir) return `linear-gradient(90deg,#000 calc(100% - ${FADE}px),transparent 100%)`;
  return null;
}

/** x para rolar a fila de modo que a aba (x e largura dentro da fila) fique no centro; limitado às pontas. */
export function xParaCentralizar(abaX: number, abaLargura: number, larguraVisivel: number, larguraTotal: number): number {
  const alvo = abaX - (larguraVisivel - abaLargura) / 2;
  const max = Math.max(0, larguraTotal - larguraVisivel);
  return Math.min(Math.max(0, alvo), max);
}
