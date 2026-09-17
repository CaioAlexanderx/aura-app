// ============================================================
// clinicHours — funções puras para o horário de funcionamento
// da clínica Odonto (Aura-backend#725, GET/PUT /companies/:cid/dental/hours).
//
// Semana: weekday 1=segunda … 7=domingo (igual ao backend).
// Horas: "HH:MM" em passos de 15 min; "24:00" só é válido como fim de turno.
//
// Usado por: components/verticals/odonto/ClinicHoursCard.tsx,
// hooks/useClinicHours.ts, app/dental/book/[slug].tsx e a grade da Agenda
// (AgendaDental*, AgendaGridParts, OdontoClinicTabs).
// ============================================================

export type ClinicShift = { start: string; end: string };
export type ClinicDayHours = { weekday: number; open: boolean; shifts: ClinicShift[] };
export type ClinicHours = ClinicDayHours[];

export type ClinicHoursFieldError = {
  weekday: number;
  shift: number;
  field: "start" | "end";
  message: string;
};

export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Segunda", 2: "Terça", 3: "Quarta", 4: "Quinta", 5: "Sexta", 6: "Sábado", 7: "Domingo",
};
export const WEEKDAY_SHORT: Record<number, string> = {
  1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb", 7: "Dom",
};

// "dias úteis" para o botão "copiar para os dias úteis" (seg–sex)
export const WEEKDAYS_UTEIS = [1, 2, 3, 4, 5];

export const INTERVAL_OPTIONS: Array<15 | 20 | 30 | 45 | 60 | null> = [null, 15, 20, 30, 45, 60];

export function timeToMinutes(t: string): number {
  if (!t) return 0;
  const parts = t.split(":");
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  return h * 60 + m;
}

export function minutesToTime(min: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(min)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Converte Date.getDay() (0=domingo) para o weekday da API (7=domingo).
export function jsDayToWeekday(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

export function findDayHours(hours: ClinicHours, weekday: number): ClinicDayHours | undefined {
  return hours.find((d) => d.weekday === weekday);
}

// Garante 7 dias (1..7), preenchendo os que faltarem como fechados.
export function normalizeClinicHours(hours: ClinicHours | null | undefined): ClinicHours {
  const byWeekday = new Map<number, ClinicDayHours>();
  (hours || []).forEach((d) => byWeekday.set(d.weekday, d));
  const out: ClinicHours = [];
  for (let w = 1; w <= 7; w++) {
    const existing = byWeekday.get(w);
    out.push(
      existing
        ? { weekday: w, open: !!existing.open, shifts: (existing.shifts || []).map((s) => ({ ...s })) }
        : { weekday: w, open: false, shifts: [] }
    );
  }
  return out;
}

// Erros de um dia: fim precisa ser depois do início; turnos não podem se
// sobrepor. Mesma regra do backend — mostrada na linha do turno.
export function validateDayShifts(
  shifts: ClinicShift[]
): Array<{ shift: number; field: "start" | "end"; message: string }> {
  const errors: Array<{ shift: number; field: "start" | "end"; message: string }> = [];
  const withIdx = shifts.map((s, i) => ({ i, a: timeToMinutes(s.start), b: timeToMinutes(s.end) }));
  const sorted = [...withIdx].sort((x, y) => x.a - y.a);
  sorted.forEach((cur, k) => {
    if (cur.b <= cur.a) {
      errors.push({ shift: cur.i, field: "end", message: "O fim precisa ser depois do início." });
      return;
    }
    if (k > 0 && cur.a < sorted[k - 1].b) {
      errors.push({ shift: cur.i, field: "start", message: "Este turno se sobrepõe ao anterior." });
    }
  });
  return errors;
}

export function validateClinicHours(hours: ClinicHours): ClinicHoursFieldError[] {
  const out: ClinicHoursFieldError[] = [];
  for (const day of hours) {
    if (!day.open || day.shifts.length === 0) continue;
    for (const e of validateDayShifts(day.shifts)) {
      out.push({ weekday: day.weekday, shift: e.shift, field: e.field, message: e.message });
    }
  }
  return out;
}

export function hasClinicHoursErrors(hours: ClinicHours): boolean {
  return validateClinicHours(hours).length > 0;
}

// Copia o dia `fromWeekday` para os demais dias úteis (seg–sex).
export function copyDayToWeekdays(hours: ClinicHours, fromWeekday: number): ClinicHours {
  const source = findDayHours(hours, fromWeekday);
  if (!source) return hours;
  return hours.map((d) => {
    if (d.weekday === fromWeekday || !WEEKDAYS_UTEIS.includes(d.weekday)) return d;
    return { weekday: d.weekday, open: source.open, shifts: source.shifts.map((s) => ({ ...s })) };
  });
}

export function weeklyHoursTotal(hours: ClinicHours): number {
  let totalMin = 0;
  for (const day of hours) {
    if (!day.open) continue;
    for (const s of day.shifts) {
      const diff = timeToMinutes(s.end) - timeToMinutes(s.start);
      if (diff > 0) totalMin += diff;
    }
  }
  return Math.round((totalMin / 60) * 10) / 10;
}

export function formatWeeklyHours(hours: ClinicHours): string {
  return String(weeklyHoursTotal(hours)).replace(".", ",") + "h";
}

// Grade da agenda = horário real ±1h; sem horário configurado (ou nenhum
// dia aberto), cai no fallback 07–19h.
export function clinicGridRange(hours: ClinicHours, configured: boolean): { startHour: number; endHour: number } {
  if (!configured) return { startHour: 7, endHour: 19 };
  let a = 24 * 60;
  let b = 0;
  for (const day of hours) {
    if (!day.open) continue;
    for (const s of day.shifts) {
      a = Math.min(a, timeToMinutes(s.start));
      b = Math.max(b, timeToMinutes(s.end));
    }
  }
  if (a >= b) return { startHour: 7, endHour: 19 };
  const startHour = Math.max(0, Math.floor((a - 60) / 60));
  const endHour = Math.min(24, Math.ceil((b + 60) / 60));
  return { startHour, endHour };
}

// `date` cabe inteiro (início + duração) dentro de algum turno aberto do dia?
export function isWithinClinicHours(hours: ClinicHours, date: Date, durationMin: number): boolean {
  const weekday = jsDayToWeekday(date.getDay());
  const day = findDayHours(hours, weekday);
  if (!day || !day.open) return false;
  const startMin = date.getHours() * 60 + date.getMinutes();
  const endMin = startMin + Math.max(0, durationMin || 0);
  return day.shifts.some((s) => {
    const a = timeToMinutes(s.start);
    const b = timeToMinutes(s.end);
    return startMin >= a && endMin <= b;
  });
}

// Recorta turnos a uma janela [fromMin,toMin) — usado pela prévia do
// agendamento online (item 2) e por sua geração de slots (item 3).
export function clipShiftsToWindow(shifts: ClinicShift[], fromMin: number, toMin: number): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  for (const s of shifts) {
    const a = Math.max(timeToMinutes(s.start), fromMin);
    const b = Math.min(timeToMinutes(s.end), toMin);
    if (b > a) out.push({ start: a, end: b });
  }
  return out;
}

// Gera os horários "HH:MM" de um turno em passos de `stepMin`, só os que
// cabem inteiros (o almoço — vão entre turnos — nunca aparece).
export function generateSlotsForShift(shift: ClinicShift, stepMin: number): string[] {
  if (!stepMin || stepMin <= 0) return [];
  const a = timeToMinutes(shift.start);
  const b = timeToMinutes(shift.end);
  const out: string[] = [];
  for (let t = a; t + stepMin <= b; t += stepMin) {
    out.push(minutesToTime(t));
  }
  return out;
}

export function generateSlotsForShifts(shifts: ClinicShift[], stepMin: number): string[] {
  const out: string[] = [];
  for (const s of shifts) out.push(...generateSlotsForShift(s, stepMin));
  return out;
}

// ─── Efeito na Agenda (mockup do horário, parte 2) ──────────
//
// Cada minuto de um dia cai em uma faixa: turno aberto, intervalo entre
// turnos (almoço), antes de abrir, depois de fechar ou dia fechado. A grade
// pinta o fundo por faixa e pergunta antes de agendar fora do turno — nunca
// bloqueia.

export type ClinicMinuteStatus =
  | { kind: "open" }
  | { kind: "before"; opensAt: number }
  | { kind: "after"; closesAt: number }
  | { kind: "lunch"; from: number; to: number }
  | { kind: "closedDay" };

/** Turnos válidos do dia, em minutos, ordenados (fim > início). */
export function sortedShiftMinutes(day: ClinicDayHours | undefined): Array<{ start: number; end: number }> {
  if (!day || !day.open) return [];
  return day.shifts
    .map((s) => ({ start: timeToMinutes(s.start), end: timeToMinutes(s.end) }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);
}

/**
 * Faixa do minuto `min` (minutos do dia) no dia `weekday` (1=seg … 7=dom).
 * Dia aberto sem nenhum turno válido conta como fechado.
 */
export function clinicMinuteStatus(hours: ClinicHours, weekday: number, min: number): ClinicMinuteStatus {
  const shifts = sortedShiftMinutes(findDayHours(hours, weekday));
  if (!shifts.length) return { kind: "closedDay" };
  if (shifts.some((s) => min >= s.start && min < s.end)) return { kind: "open" };
  for (let i = 1; i < shifts.length; i++) {
    const from = shifts[i - 1].end;
    const to = shifts[i].start;
    if (min >= from && min < to) return { kind: "lunch", from, to };
  }
  if (min < shifts[0].start) return { kind: "before", opensAt: shifts[0].start };
  return { kind: "after", closesAt: shifts[shifts.length - 1].end };
}

export function isClinicDayClosed(hours: ClinicHours, weekday: number): boolean {
  return sortedShiftMinutes(findDayHours(hours, weekday)).length === 0;
}

export type ClinicDayBands = {
  closed: boolean;
  /** Turnos (fundo "Atendimento"). */
  open: Array<{ start: number; end: number }>;
  /** Vãos entre turnos (fundo cinza); `label` só quando o vão tem 60 min ou mais. */
  lunch: Array<{ start: number; end: number; label: boolean }>;
};

/** Fundo de uma coluna do dia: o que não é turno nem almoço fica hachurado. */
export function clinicDayBands(hours: ClinicHours, weekday: number): ClinicDayBands {
  const open = sortedShiftMinutes(findDayHours(hours, weekday));
  const lunch: ClinicDayBands["lunch"] = [];
  for (let i = 1; i < open.length; i++) {
    const start = open[i - 1].end;
    const end = open[i].start;
    if (end > start) lunch.push({ start, end, label: end - start >= 60 });
  }
  return { closed: open.length === 0, open, lunch };
}

const DOW_BY_JS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/**
 * Confirmação antes de agendar fora do horário (null = dentro do turno).
 * Ex.: "Fora do horário de funcionamento (18:00). Agendar mesmo assim?"
 */
export function outsideHoursPrompt(hours: ClinicHours, date: Date): { title: string; message: string } | null {
  const weekday = jsDayToWeekday(date.getDay());
  const min = date.getHours() * 60 + date.getMinutes();
  const st = clinicMinuteStatus(hours, weekday, min);
  if (st.kind === "open") return null;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const when = `${DOW_BY_JS[date.getDay()]}, ${dd}/${mm} às ${minutesToTime(min)}.`;
  const tail = " O horário fica marcado como encaixe na agenda.";
  switch (st.kind) {
    case "after":
      return {
        title: `Fora do horário de funcionamento (${minutesToTime(st.closesAt)}). Agendar mesmo assim?`,
        message: `${when} A clínica fecha às ${minutesToTime(st.closesAt)} neste dia.${tail}`,
      };
    case "before":
      return {
        title: `Fora do horário de funcionamento (${minutesToTime(st.opensAt)}). Agendar mesmo assim?`,
        message: `${when} A clínica abre às ${minutesToTime(st.opensAt)} neste dia.${tail}`,
      };
    case "lunch":
      return {
        title: `Intervalo entre turnos (${minutesToTime(st.from)}–${minutesToTime(st.to)}). Agendar mesmo assim?`,
        message: `${when}${tail}`,
      };
    default:
      return {
        title: `Fora do horário de funcionamento (${WEEKDAY_LABELS[weekday].toLowerCase()} fechado). Agendar mesmo assim?`,
        message: `${when}${tail}`,
      };
  }
}
