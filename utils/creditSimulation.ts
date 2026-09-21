/**
 * Simulação de parcelas do crediário no PDV (15/09/2026).
 *
 * Bug: com 1º vencimento 15/10/2026 a tabela SIMULAÇÃO mostrava 14/10, 14/11,
 * 14/12 — as parcelas gravadas saíam certas. `new Date("2026-10-15")` é
 * meia-noite UTC, que em America/Sao_Paulo (UTC-3) ainda é o dia 14. O backend
 * tem a mesma armadilha anotada em src/services/credit/ledger.js.
 *
 * Aqui a data 'YYYY-MM-DD' vira data LOCAL ao meio-dia, e volta para ISO pelos
 * componentes locais (nunca `toISOString`, que converte para UTC).
 *
 * Funções puras, fora do componente, para serem testadas sem render — ver a
 * nota sobre `components/Icon.tsx`: quase todo componente de tela não carrega
 * no Jest.
 */

export type SimInstallment = { num: number; amount: number; date: string | null; dateBr: string };

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 'YYYY-MM-DD' (com ou sem hora depois) → Date local ao meio-dia; inválida → null. */
export function isoDateToLocal(iso: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const out = new Date(y, mo - 1, d, 12, 0, 0, 0);
  if (Number.isNaN(out.getTime())) return null;
  // 2026-02-31 rolaria para março: é data inválida, não outra data.
  if (out.getFullYear() !== y || out.getMonth() !== mo - 1 || out.getDate() !== d) return null;
  return out;
}

/** Date → 'YYYY-MM-DD' pelo calendário local. */
export function localDateToIso(d: Date): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Date local → 'dd/mm/aa', o formato das tabelas de simulação. */
export function formatShortBrDate(d: Date): string {
  if (!d || Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${pad2(d.getFullYear() % 100)}`;
}

/**
 * Data de vencimento para exibição. String só-data ('YYYY-MM-DD', como o
 * backend devolve due_date) é lida no calendário local; Date e timestamps
 * completos seguem o fuso normal.
 */
export function formatDueDateBr(input: Date | string | null | undefined): string {
  if (!input) return "—";
  if (input instanceof Date) return formatShortBrDate(input);
  const s = String(input);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = isoDateToLocal(s);
    return d ? formatShortBrDate(d) : "—";
  }
  return formatShortBrDate(new Date(s));
}

/**
 * Parcelas da simulação. Mesma regra do backend (ledger.js + terms.js
 * dueDateForIndex): valor base truncado em centavos, a sobra vai na última;
 * vencimento i = 1º vencimento + i meses via setMonth (31/01 + 1 mês = 03/03).
 */
export function simulateInstallments(
  total: number,
  count: number,
  firstDueDateIso: string | null | undefined,
): SimInstallment[] {
  const totalNum = Number(total) || 0;
  const n = Math.floor(Number(count) || 0);
  if (!totalNum || n < 1) return [];
  const firstDate = isoDateToLocal(firstDueDateIso);
  if (!firstDate) return [];
  const base = Math.floor(totalNum / n * 100) / 100;
  const remainder = Math.round((totalNum - base * n) * 100) / 100;
  return Array.from({ length: n }, (_, i) => {
    const amount = i === n - 1 ? base + remainder : base;
    const d = new Date(firstDate);
    d.setMonth(d.getMonth() + i);
    return { num: i + 1, amount, date: localDateToIso(d), dateBr: formatShortBrDate(d) };
  });
}
