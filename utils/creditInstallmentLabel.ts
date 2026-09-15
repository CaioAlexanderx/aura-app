/**
 * Rótulo de uma parcela afetada por um pagamento do crediário (15/09/2026).
 *
 * "Parcela 1" era ambíguo: a 1/1 de uma venda e a 1/3 de outra saíam iguais
 * no painel "Pagamento registrado" e na prévia "Como o valor vai ser aplicado".
 * Com o total e o vencimento vindos da API: "Parcela 1/3 · vence 15/10/26".
 *
 * Puro e sem imports: os helpers da ficha puxam componentes que não carregam
 * no Jest.
 */

export type InstallmentLabelInput = {
  number?: number | null;
  total_installments?: number | null;
  due_date?: string | null;
};

// Data pura é dia de calendário: sem conversão de fuso. Aceita "AAAA-MM-DD"
// e a meia-noite UTC que o driver do Postgres produz (ver fichaHelpers, D-1).
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/;

export function calendarDateBr(value?: string | null): string {
  if (!value) return "";
  const m = String(value).match(CALENDAR_DATE);
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : "";
}

export function installmentLabel(line: InstallmentLabelInput): string {
  const n = line.number ?? null;
  const total = line.total_installments ?? null;
  let label = "Parcela";
  if (n != null) label = total ? `Parcela ${n}/${total}` : `Parcela ${n}`;
  const due = calendarDateBr(line.due_date);
  return due ? `${label} · vence ${due}` : label;
}
