// ============================================================
// AURA. — Devolução do crediário: aviso da parte paga fora do crediário
// (18/11/2026, Aura-backend#1081). Venda de 40 no dinheiro + 60 no crediário:
// a devolução credita 60 na ficha; os 40 não voltam sozinhos.
// ============================================================
/** Aviso da devolução com parte paga fora do crediário (null = sem aviso). */
export function avisoDoPagoFora(result: { pago_fora_do_crediario?: number } | null | undefined): string | null {
  const v = Number(result?.pago_fora_do_crediario) || 0;
  if (!(v > 0.005)) return null;
  const reais = "R$ " + v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return reais + " foram pagos em dinheiro: devolva pela Troca, em dinheiro ou crédito.";
}
