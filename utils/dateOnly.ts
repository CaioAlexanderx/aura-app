// ============================================================
// Datas "só-dia" (colunas DATE) sem erro de fuso.
//
// A API devolve colunas DATE (birth_date, preferred_date, due_date,
// exam_date...) como "1990-03-10" ou "1990-03-10T00:00:00.000Z".
// `new Date(x)` lê as duas como meia-noite UTC; formatada no fuso do
// Brasil (UTC-3) a data vira o dia anterior (09/03/1990) e a idade
// sai errada. Aqui a data é lida pelos componentes como vieram, sem
// conversão de fuso.
//
// O caminho inverso também tem armadilha: `date.toISOString().slice(0, 10)`
// devolve o dia UTC, então depois das 21h em São Paulo "hoje" vira amanhã.
// Para datas locais use `toDateOnlyString` / `localDayKey` / `todayLocalString`.
//
// Timestamps de verdade (scheduled_at, created_at) NÃO passam por aqui:
// continuam com `new Date(x)` e conversão local normal.
// ============================================================

import { daysInMonth } from "./mask";

export interface DateOnlyParts {
  y: number;
  /** 1-12 */
  m: number;
  d: number;
}

export type DateOnlyInput = string | Date | null | undefined;

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Lê uma data só-dia.
 * - "YYYY-MM-DD" e ISO com hora ("YYYY-MM-DDT00:00:00.000Z"): usa os
 *   componentes da data como vieram, sem conversão de fuso.
 * - Date: usa o dia local do objeto.
 * Devolve null para vazio, formato desconhecido ou dia inexistente (31/04).
 */
export function parseDateOnly(v: DateOnlyInput): DateOnlyParts | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return { y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate() };
  }
  const match = String(v).trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

/** "1990-03-10T00:00:00.000Z" → "10/03/1990". Inválido/vazio → fallback. */
export function formatDateOnlyBR(v: DateOnlyInput, fallback = ""): string {
  const p = parseDateOnly(v);
  if (!p) return fallback;
  return `${pad2(p.d)}/${pad2(p.m)}/${p.y}`;
}

/**
 * Data só-dia como Date à meia-noite LOCAL — para comparar com outras
 * datas locais ou formatar com toLocaleDateString sem deslocar o dia.
 */
export function dateOnlyToLocalDate(v: DateOnlyInput): Date | null {
  const p = parseDateOnly(v);
  if (!p) return null;
  return new Date(p.y, p.m - 1, p.d);
}

/**
 * Idade completa em anos na data `today` (dia local). Nascido em 29/02
 * faz aniversário em 01/03 nos anos não bissextos. Data inválida ou
 * futura → null.
 */
export function ageFromDateOnly(v: DateOnlyInput, today: Date = new Date()): number | null {
  const b = parseDateOnly(v);
  if (!b) return null;
  const t = { y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() };
  let age = t.y - b.y;
  if (t.m < b.m || (t.m === b.m && t.d < b.d)) age--;
  return age < 0 ? null : age;
}

/** Date → "YYYY-MM-DD" do dia LOCAL (nunca via toISOString). */
export function toDateOnlyString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * Chave "YYYY-MM-DD" do dia local de um timestamp (Date, ISO ou epoch ms),
 * para agrupar agendamentos por dia. Inválido → "".
 */
export function localDayKey(ts: Date | string | number): string {
  const d = ts instanceof Date ? ts : new Date(ts);
  if (isNaN(d.getTime())) return "";
  return toDateOnlyString(d);
}

/** "YYYY-MM-DD" de hoje no fuso local. */
export function todayLocalString(): string {
  return toDateOnlyString(new Date());
}
