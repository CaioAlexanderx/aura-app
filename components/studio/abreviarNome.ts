// ============================================================
// AURA STUDIO · Nome de cliente em tela pública (K2)
//
// Mora fora da tela de propósito: a vitrine é pública (TV da loja, fundo de
// story) e esta é a regra de privacidade da fase. Módulo próprio pra ser
// testável de verdade — um teste que reimplementa a regra não protege nada,
// porque continua passando quando a tela muda.
// ============================================================

/**
 * "Maria Fernanda Souza" → "Maria S."
 *
 * Primeiro nome inteiro (é como a lojista reconhece o pedido de longe) e só
 * a inicial do último sobrenome. Nome único passa inteiro: não há sobrenome
 * a proteger. Sem nome, devolve um rótulo neutro em vez de deixar um vão.
 */
export function abreviarNome(nome: string | null | undefined): string {
  const limpo = String(nome || "").trim();
  if (!limpo) return "Encomenda";
  const partes = limpo.split(/\s+/);
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1].charAt(0).toUpperCase()}.`;
}
