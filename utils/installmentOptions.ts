/**
 * Seletor do nº de parcelas do crediário no PDV (15/09/2026).
 *
 * Funções puras, fora do componente, para serem testadas sem render — ver
 * a nota sobre `components/Icon.tsx` no aura-app: quase todo componente de
 * tela não carrega no Jest.
 */

export type InstallmentOption = { value: number; label: string };

/** Normaliza o que veio do select ou do campo numérico para 1..max. */
export function clampInstallments(raw: unknown, max: number): number {
  const top = Math.max(1, Math.floor(Number(max) || 1));
  const digits = String(raw ?? "").replace(/\D/g, "").slice(0, 3);
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(top, n);
}

/**
 * Uma opção por quantidade de parcelas, de 1 até o teto da loja.
 * Com total informado, o rótulo mostra o valor de cada parcela ("3x de R$ 33,33"),
 * no mesmo arredondamento que os antigos botões usavam.
 */
export function buildInstallmentOptions(
  max: number,
  total: number,
  formatMoney: (v: number) => string,
): InstallmentOption[] {
  const top = Math.max(1, Math.floor(Number(max) || 1));
  const amount = Number(total) || 0;
  const out: InstallmentOption[] = [];
  for (let i = 1; i <= top; i++) {
    const per = Math.round((amount / i) * 100) / 100;
    out.push({ value: i, label: amount > 0 ? `${i}x de ${formatMoney(per)}` : `${i}x` });
  }
  return out;
}
