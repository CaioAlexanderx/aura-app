// ============================================================
// Valor pago e data do pagamento (28/09/2026)
//
// Feedback de lojista com boletos atrasados: a data do pagamento não é a do
// vencimento, e ela quer digitar o valor que pagou (com juros) sem calcular
// juros nem porcentagem. No backend (migration 362), amount vira o valor pago
// e original_amount guarda o valor do boleto. Aqui ficam as regras que o
// modal e o quadro compartilham.
// ============================================================

export type Situacao = "pago" | "aberto";

/** Campos extras do POST conforme a situação escolhida no cadastro. */
export function camposDaSituacao(p: { situacao: Situacao; valor: number; pagoEm?: string | null; valorPago?: number | null }): Record<string, any> {
  if (p.situacao === "aberto") return { status: "pending" };
  const campos: Record<string, any> = { status: "confirmed" };
  if (p.pagoEm) campos.paid_at = p.pagoEm;
  if (p.valorPago && p.valorPago > 0 && Math.abs(p.valorPago - p.valor) >= 0.005) campos.paid_amount = p.valorPago;
  return campos;
}

/** Diferença entre o que foi pago e o valor original (null = pagou o valor original). */
export function diferencaPaga(pago: number, original: number | null | undefined): { valor: number; sentido: "mais" | "menos" } | null {
  if (original == null || !(original > 0)) return null;
  const d = Math.round((pago - original) * 100) / 100;
  if (Math.abs(d) < 0.005) return null;
  return { valor: Math.abs(d), sentido: d > 0 ? "mais" : "menos" };
}

/** "R$ 6,40 a mais (juros ou multa)" · "R$ 5,00 a menos (desconto)". */
export function textoDaDiferenca(dif: { valor: number; sentido: "mais" | "menos" }, tipo: "income" | "expense", fmt: (n: number) => string): string {
  if (dif.sentido === "menos") return fmt(dif.valor) + " a menos (desconto)";
  return fmt(dif.valor) + (tipo === "expense" ? " a mais (juros ou multa)" : " a mais");
}

/** Rótulos da escolha no cadastro. */
export function rotulosDaSituacao(tipo: "income" | "expense") {
  return tipo === "expense"
    ? { pago: "Já paguei", aberto: "Vou pagar", data: "Pago em", valor: "Valor pago" }
    : { pago: "Já recebi", aberto: "Vou receber", data: "Recebido em", valor: "Valor recebido" };
}
