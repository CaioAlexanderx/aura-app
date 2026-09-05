// ============================================================
// components/studio/storefront/precoNoPix.ts
//
// "ou R$ 35,91 no Pix" — no cartão do produto.
//
// As duas referências do mercado (Aqui Tem Caneca, DNA Presentes) mostram
// o preço no Pix em 100% dos cartões. Nós só mostrávamos no total do
// checkout: a cliente descobria o desconto depois de decidir, quando ele
// já não decidia nada.
//
// A conta é a MESMA do checkout (useStorefront: `Math.round(subtotal *
// pct) / 100`), aplicada a uma unidade. Duas contas diferentes para o
// mesmo desconto é a divergência que este produto já pagou caro.
// ============================================================

/** O preço de uma unidade no Pix, ou `null` quando não há desconto. */
export function precoNoPix(preco: number, pct: number | null | undefined): number | null {
  const p = Number(preco);
  const d = Number(pct);
  if (!Number.isFinite(p) || p <= 0) return null;
  if (!Number.isFinite(d) || d <= 0) return null;
  return Math.round(p * (100 - d)) / 100;
}
