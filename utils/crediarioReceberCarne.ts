// ============================================================
// Receber pagamento com um carnê escolhido (QA 23/11/2026, P1-4)
//
// O backend (applyPayment com account_id) cobre primeiro as parcelas do
// carnê e manda a SOBRA para as outras parcelas abertas da cliente (t3-08);
// o que passar de tudo vira crédito. A prévia com account_id só enxerga o
// carnê e chamava a sobra de "crédito gerado" — a lojista via "crédito de
// R$ 219,90" e o servidor quitava os dois carnês.
//
// Regra da tela, para a prévia e o envio baterem com o servidor:
//  - "Quitar" com um carnê escolhido vale o que falta NAQUELE carnê;
//  - valor até o que falta no carnê: vai para o carnê (account_id);
//  - valor acima disso: vai como "todas as compras" (sem account_id), a
//    mesma conta na prévia e no servidor, e a tela avisa.
// ============================================================

/** Quanto o "Quitar" preenche: o que falta no carnê escolhido, ou tudo. */
export function valorDeQuitar(saldoTotal: number, faltaDoCarne: number | null): number {
  if (faltaDoCarne != null && faltaDoCarne > 0.009) return +faltaDoCarne.toFixed(2);
  return +Math.max(0, saldoTotal).toFixed(2);
}

/** O carnê que vai na prévia e no envio para este valor. */
export function contaParaOValor(
  accountId: string | null | undefined, valor: number, faltaDoCarne: number | null,
): string | null | undefined {
  if (!accountId) return accountId;
  if (faltaDoCarne != null && valor > faltaDoCarne + 0.009) return undefined;
  return accountId;
}

type ParcelaComEncargos = {
  remaining?: number; amount_due?: number; covered_amount?: number;
  charges_total?: number; total_due?: number;
};

/**
 * Quanto receber para deixar uma parcela do carnê em dia (revisão #1360),
 * na ordem do backend (ledger.applyPayment com account_id): primeiro os
 * encargos (multa e juros) de TODAS as abertas atrasadas do carnê, depois o
 * principal da mais antiga em diante, até esta.
 */
export function valorParaQuitarAte<P extends ParcelaComEncargos>(
  todasDoCarne: P[], ateEsta: P[], atrasada: (p: P) => boolean,
): number {
  const principal = (p: P) => Number(p.remaining ?? (Number(p.amount_due || 0) - Number(p.covered_amount || 0))) || 0;
  const encargos = todasDoCarne.filter(atrasada).reduce((s, p) => s + (Number(p.charges_total) || 0), 0);
  return +(encargos + ateEsta.reduce((s, p) => s + principal(p), 0)).toFixed(2);
}

/** Chave da prévia: valor e carnê que ela calculou (revisão #1360). */
export function chaveDaPrevia(valor: number, conta: string | null | undefined): string {
  return `${(+valor || 0).toFixed(2)}|${conta ?? ""}`;
}

/**
 * Crédito que o pagamento gera de verdade (revisão #1360). O credit_generated
 * da prévia é "o que sobrou depois das parcelas abertas" — o fiado sem
 * parcela absorve esse valor. Só há crédito com o saldo novo negativo, e no
 * máximo o quanto ele fica negativo.
 */
export function creditoDeVerdade(plano: { new_balance: number; credit_generated: number } | null | undefined): number {
  if (!plano) return 0;
  const nb = Number(plano.new_balance);
  const cg = Number(plano.credit_generated) || 0;
  if (!(nb < -0.009) || cg <= 0.009) return 0;
  return +Math.min(cg, -nb).toFixed(2);
}

/** Aviso quando o valor passa do que falta no carnê escolhido. */
export function avisoPassaDoCarne(
  nomeDoCarne: string, faltaDoCarne: number, fmt: (n: number) => string,
): string {
  return `O valor passa do que falta em ${nomeDoCarne} (${fmt(faltaDoCarne)}). Ele vai para todas as compras, da parcela mais antiga para a mais nova.`;
}
