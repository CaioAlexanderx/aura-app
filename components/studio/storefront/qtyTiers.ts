// ============================================================
// components/studio/storefront/qtyTiers.ts
// S6 — desconto progressivo por quantidade, lado do cliente.
//
// O backend manda a escada JÁ CALCULADA em `product.qty_tiers`: uma linha
// por faixa, com o preço unitário resultante e o percentual. Ele não
// manda `unit_multiplier` nem nada de custo — a conta de custo fica no
// servidor e não atravessa para o público (ver services/studioQtyTiers.js).
//
// Aqui só se escolhe a faixa. Mas ESCOLHER É OBRIGATÓRIO: se o app
// exibisse a escada sem aplicá-la, o cliente veria um total e o servidor
// cobraria outro. Mesma classe de divergência que o S0 corrigiu na
// validação e o S2 no frete.
//
// A regra de casamento é a mesma dos dois lados: vence a faixa de maior
// `min_qty` que couber — quem compra mais nunca paga mais.
// ============================================================

export type QtyTier = {
  min_qty: number;
  max_qty: number | null;
  unit_price: number;
  discount_pct: number;
};

/** Faixa aplicável a uma quantidade, ou null quando nenhuma cobre. */
export function matchTier(tiers: QtyTier[] | null | undefined, qty: number): QtyTier | null {
  if (!Array.isArray(tiers) || !tiers.length) return null;
  const q = Math.floor(Number(qty));
  if (!Number.isFinite(q) || q < 1) return null;

  let escolhida: QtyTier | null = null;
  for (const t of tiers) {
    const min = Number(t?.min_qty);
    if (!Number.isFinite(min) || q < min) continue;
    const max = t.max_qty == null ? null : Number(t.max_qty);
    if (max != null && q > max) continue;
    if (!escolhida || min > escolhida.min_qty) escolhida = t;
  }
  return escolhida;
}

/**
 * Preço unitário BASE para a quantidade — antes dos deltas de
 * personalização, que somam depois. É a mesma ordem do backend: a faixa
 * incide sobre o preço de tabela, e cor/verso/serviço de arte são
 * adicionais sobre o resultado.
 */
export function basePriceForQty(
  listPrice: number,
  tiers: QtyTier[] | null | undefined,
  qty: number
): number {
  const base = Number(listPrice) || 0;
  const t = matchTier(tiers, qty);
  const unit = t ? Number(t.unit_price) : NaN;
  // `unit <= 0` cobre preço ausente ou corrompido: `Number(null)` é 0, e
  // sem esta guarda uma faixa quebrada entregaria o produto de graça.
  // Faixa gratuita de verdade não existe no configurador da lojista.
  if (!Number.isFinite(unit) || unit <= 0) return base;
  // Escada que encarece é erro de cadastro; o servidor já a ignora, e o
  // app não pode mostrar um valor que o servidor não vai cobrar.
  return unit > base ? base : unit;
}

/** Próxima faixa ainda não alcançada — vira o empurrão "leve N e pague menos". */
export function proximaFaixa(
  tiers: QtyTier[] | null | undefined,
  qty: number
): QtyTier | null {
  if (!Array.isArray(tiers) || !tiers.length) return null;
  const q = Math.floor(Number(qty)) || 0;
  const acima = tiers
    .filter((t) => Number(t?.min_qty) > q)
    .sort((a, b) => Number(a.min_qty) - Number(b.min_qty));
  return acima[0] || null;
}

/** Rótulo da faixa: "10 a 49 un" / "50 un ou mais". */
export function faixaLabel(t: QtyTier): string {
  return t.max_qty == null
    ? `${t.min_qty} un ou mais`
    : `${t.min_qty} a ${t.max_qty} un`;
}
