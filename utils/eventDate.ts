// ============================================================
// Formatação tz-safe de datas de evento/exame (YYYY-MM-DD).
//
// `event_date`/`exam_date` chegam do backend como DATA pura
// (ex.: "2026-09-20"), sem horário. Usar `new Date("2026-09-20")`
// interpreta a string como UTC meia-noite; ao exibir em horário
// do Brasil (UTC-3) o dia "vira" o anterior (bug de -1 dia).
//
// Solução: parse manual da string YYYY-MM-DD (sem passar por
// `new Date`), aceitando também timestamps ISO com hora
// (ex.: "2026-09-20T00:00:00.000Z") ao fatiar os 10 primeiros
// caracteres. Padrão espelhado de `fmtDataLonga` em
// app/karate/sensei/eventos.tsx.
// ============================================================

const MESES_LONGOS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const MESES_ABREV = [
  "jan.", "fev.", "mar.", "abr.", "mai.", "jun.",
  "jul.", "ago.", "set.", "out.", "nov.", "dez.",
];

function parseDateParts(iso: string): { y: string; mo: string; d: string } | null {
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const mi = parseInt(mo, 10) - 1;
  if (mi < 0 || mi > 11) return null;
  return { y, mo, d };
}

// "20 de setembro de 2026"
export function formatEventDateLong(iso?: string | null, fallback = "—"): string {
  if (!iso) return fallback;
  const parts = parseDateParts(iso);
  if (!parts) return String(iso);
  const mi = parseInt(parts.mo, 10) - 1;
  return `${parseInt(parts.d, 10)} de ${MESES_LONGOS[mi]} de ${parts.y}`;
}

// "20 de set. de 2026" (equivalente tz-safe de toLocaleDateString com month: "short")
export function formatEventDateShort(iso?: string | null, fallback = "—"): string {
  if (!iso) return fallback;
  const parts = parseDateParts(iso);
  if (!parts) return String(iso);
  const mi = parseInt(parts.mo, 10) - 1;
  return `${parseInt(parts.d, 10)} de ${MESES_ABREV[mi]} de ${parts.y}`;
}

// "20/09/2026" (equivalente tz-safe de toLocaleDateString("pt-BR"))
export function formatEventDateNumeric(iso?: string | null, fallback = "—"): string {
  if (!iso) return fallback;
  const parts = parseDateParts(iso);
  if (!parts) return String(iso);
  return `${parts.d}/${parts.mo}/${parts.y}`;
}

// "20 de set." (sem ano — equivalente tz-safe de toLocaleDateString com
// { day: "2-digit", month: "short" }, para exibições compactas como o
// dateBox de "próximo evento" no painel da federação)
export function formatEventDateCompact(iso?: string | null, fallback = "—"): string {
  if (!iso) return fallback;
  const parts = parseDateParts(iso);
  if (!parts) return String(iso);
  const mi = parseInt(parts.mo, 10) - 1;
  return `${parseInt(parts.d, 10)} de ${MESES_ABREV[mi]}`;
}
