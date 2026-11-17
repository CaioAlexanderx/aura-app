// ============================================================
// AURA. — Enter na busca coloca o produto destacado (p-156, 17/11/2026)
//
// Antes o Enter com um nome na busca ia ao servidor (/pdv/scan/<texto>),
// o campo esvaziava e o texto voltava: nada entrava na venda. Agora, com
// resultado na grade, o primeiro fica destacado; ↑ ↓ trocam o destaque
// (só entre os resultados da página visível) e Enter coloca ele na venda.
//
// Continua indo ao servidor o que parece código: só dígitos com 8 ou mais
// (o leitor manda em rajada, mas quem digita um código de barras à mão
// espera o mesmo resultado do bipe, inclusive a variante do código) e o
// texto sem resultado local (vale-troca AURA-TROCA:, código de outra loja).
// ============================================================

export function pareceCodigo(texto: string): boolean {
  return /^\d{8,}$/.test((texto || "").trim());
}

/** Índice do destaque dentro da página (0 = o primeiro). */
export function indiceDoDestaque(indice: number, total: number): number {
  if (total <= 0) return -1;
  if (!isFinite(indice) || indice < 0) return 0;
  return Math.min(Math.floor(indice), total - 1);
}

export function moverDestaque(indice: number, passo: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, indiceDoDestaque(indice, total) + passo));
}

/** O que o Enter faz: "adicionar" o destacado ou "servidor" (caminho de sempre). */
export function decisaoDoEnter(texto: string, query: string, totalNaPagina: number): "adicionar" | "servidor" | "nada" {
  const t = (texto || "").trim();
  if (!t) return "nada";
  if (pareceCodigo(t)) return "servidor";
  if (t !== (query || "").trim()) return "servidor";
  return totalNaPagina > 0 ? "adicionar" : "servidor";
}
