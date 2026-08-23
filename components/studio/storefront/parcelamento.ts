// ============================================================
// AURA STUDIO · vitrine — parcelamento mostrado na loja (espelho)
//
// FONTE DE VERDADE: aura-backend `src/services/parcelamento.js`.
// Espelho porque app e backend são repositórios separados, como
// storefrontTypography / constants/fonts. Ao mexer num, mexer no outro.
//
// A loja mostrava só o preço à vista. "3x de R$ 53,30" é uma frase
// diferente de "R$ 159,90" para quem está decidindo, e é a frase que todo
// e-commerce grande mostra.
//
// O teto vem da lojista (`payment.card_max_installments`), não do
// gateway: a tabela de gateway guarda credencial e nada mais, e o Mercado
// Pago só decide parcelas no checkout. Melhor a lojista declarar a
// política dela do que a loja inventar um número.
// ============================================================

/**
 * Piso por parcela.
 *
 * Sem piso, uma caneca de R$ 30 anunciaria "12x de R$ 2,50" — que nenhuma
 * operadora aceita e que faz a loja parecer desonesta.
 */
export const PARCELA_MINIMA = 5;

export type Parcelamento = { vezes: number; valor: number };

/** Em quantas vezes ESTE preço cabe, respeitando teto e piso. */
export function parcelasDoPreco(
  preco: unknown,
  teto: unknown,
): Parcelamento | null {
  const p = Number(preco);
  const t = Number(teto);
  if (!Number.isFinite(p) || p <= 0) return null;
  if (!Number.isFinite(t) || t < 2) return null;

  const cabe = Math.floor(p / PARCELA_MINIMA);
  const n = Math.min(Math.floor(t), cabe, 12);
  // 1x não é parcelamento: é o preço à vista com outro nome.
  if (n < 2) return null;

  return { vezes: n, valor: p / n };
}

/** A frase pronta, em pt-BR. Null quando não há o que mostrar. */
export function textoDeParcelamento(preco: unknown, teto: unknown): string | null {
  const r = parcelasDoPreco(preco, teto);
  if (!r) return null;
  return `ou ${r.vezes}x de R$ ${r.valor.toFixed(2).replace(".", ",")} sem juros`;
}
