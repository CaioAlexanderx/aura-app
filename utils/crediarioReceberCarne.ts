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

/** Aviso quando o valor passa do que falta no carnê escolhido. */
export function avisoPassaDoCarne(
  nomeDoCarne: string, faltaDoCarne: number, fmt: (n: number) => string,
): string {
  return `O valor passa do que falta em ${nomeDoCarne} (${fmt(faltaDoCarne)}). Ele vai para todas as compras, da parcela mais antiga para a mais nova.`;
}
