// ============================================================
// AURA. — Agenda odonto: regras puras dos modais (mockup 16/09/2026)
//
// Botão principal por status, conflito de horário (mesma regra do backend
// services/dentalSchedule.js#findConflicts), próximo horário livre,
// validação do cancelamento e progresso do "Confirmar amanhã".
// Sem React nem rede: os modais e os testes usam as mesmas funções.
// ============================================================
import { toDateOnlyString } from "@/utils/dateOnly";
import type { CancelReasonKey } from "@/utils/whatsapp";

// ── Botão principal ─────────────────────────────────────────

export type PrimaryAction =
  | { kind: "status"; to: string; label: string; icon: string; openConsulta?: boolean }
  | { kind: "conclude"; to: "concluido"; label: string; icon: string }
  | { kind: "return"; label: string; icon: string }
  | { kind: "reschedule"; label: string; icon: string };

/**
 * Um único botão principal que muda com o status:
 * Confirmar presença → Iniciar atendimento → Concluir atendimento → Agendar retorno;
 * faltou/justificada/cancelado → Remarcar (e o "Editar / remarcar" some).
 */
export function primaryActionFor(status: string | null | undefined): PrimaryAction {
  switch (status || "agendado") {
    case "agendado":
      return { kind: "status", to: "confirmado", label: "Confirmar presença", icon: "check" };
    case "avaliacao": // legado do funil: avaliação só segue para aprovado
      return { kind: "status", to: "aprovado", label: "Marcar aprovado", icon: "check" };
    case "confirmado":
    case "paciente_consultorio":
    case "aprovado":
      return { kind: "status", to: "em_atendimento", label: "Iniciar atendimento", icon: "play_circle", openConsulta: true };
    case "em_atendimento":
      return { kind: "conclude", to: "concluido", label: "Concluir atendimento", icon: "check_circle" };
    case "concluido":
      return { kind: "return", label: "Agendar retorno", icon: "calendar" };
    default:
      return { kind: "reschedule", label: "Remarcar", icon: "calendar" };
  }
}

/** "Editar / remarcar" aparece do lado oposto, exceto quando o principal já é "Remarcar". */
export function showEditButton(status: string | null | undefined): boolean {
  return primaryActionFor(status).kind !== "reschedule";
}

// ── Conflito e próximo livre ────────────────────────────────

/** Status que não ocupam o horário (espelho de NON_BLOCKING_STATUSES do backend). */
export const NON_BLOCKING_STATUSES = new Set(["cancelado", "faltou", "falta_justificada"]);

export interface SlotTarget {
  id?: string | null;
  scheduled_at: string | Date;
  duration_min: number;
  practitioner_id?: string | null;
}

export interface SlotCandidate {
  id: string;
  scheduled_at: string;
  duration_min?: number | null;
  practitioner_id?: string | null;
  status?: string | null;
  patient_name?: string | null;
}

const ms = (v: string | Date) => (v instanceof Date ? v.getTime() : new Date(v).getTime());

/** Intervalos semiabertos: encostar (fim == início) não conta. */
function overlaps(a0: number, aMin: number, b0: number, bMin: number): boolean {
  return a0 < b0 + bMin * 60000 && b0 < a0 + aMin * 60000;
}

/** Mesma regra do backend: mesmo dentista (null só com null), ignora o próprio e os que não ocupam horário. */
export function findConflicts(target: SlotTarget, candidates: SlotCandidate[] | null | undefined): SlotCandidate[] {
  const prac = target.practitioner_id || null;
  const t0 = ms(target.scheduled_at);
  if (isNaN(t0)) return [];
  return (candidates || [])
    .filter((c) => !(target.id && c.id === target.id))
    .filter((c) => (c.practitioner_id || null) === prac)
    .filter((c) => !NON_BLOCKING_STATUSES.has(c.status || "agendado"))
    .filter((c) => overlaps(t0, target.duration_min, ms(c.scheduled_at), c.duration_min || 60))
    .sort((a, b) => ms(a.scheduled_at) - ms(b.scheduled_at));
}

export interface DayWindow {
  /** Hora de abertura (padrão 7, igual à grade). */
  startHour?: number;
  /** Hora de fechamento (padrão 19, igual à grade). */
  endHour?: number;
  /** Passo em minutos (padrão 15). */
  stepMin?: number;
}

/**
 * Próximo horário livre no MESMO dia: primeiro para frente (de 15 em 15 min
 * a partir do horário pedido), depois para trás. null se o dia está cheio.
 */
export function nextFreeSlot(
  target: SlotTarget,
  candidates: SlotCandidate[] | null | undefined,
  { startHour = 7, endHour = 19, stepMin = 15 }: DayWindow = {},
): Date | null {
  const base = target.scheduled_at instanceof Date ? new Date(target.scheduled_at) : new Date(target.scheduled_at);
  if (isNaN(base.getTime())) return null;
  const dayStart = new Date(base); dayStart.setHours(startHour, 0, 0, 0);
  const dayEnd = new Date(base); dayEnd.setHours(endHour, 0, 0, 0);
  const durMs = target.duration_min * 60000;
  const stepMs = stepMin * 60000;
  const free = (t: number) => !findConflicts({ ...target, scheduled_at: new Date(t) }, candidates).length;
  for (let t = base.getTime() + stepMs; t + durMs <= dayEnd.getTime(); t += stepMs) {
    if (free(t)) return new Date(t);
  }
  for (let t = base.getTime() - stepMs; t >= dayStart.getTime(); t -= stepMs) {
    if (t + durMs <= dayEnd.getTime() && free(t)) return new Date(t);
  }
  return null;
}

/** Limites [início, fim) do dia local de uma data "AAAA-MM-DD", em ISO, para GET /dental/agenda. */
export function localDayBoundsISO(ymd: string): { start: string; end: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || "");
  if (!m) return null;
  const start = new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
  const end = new Date(+m[1], +m[2] - 1, +m[3] + 1, 0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

// ── Remarcar ────────────────────────────────────────────────

/**
 * Status a enviar junto com a remarcação. Falta/justificada voltam para
 * agendado quando a data/hora muda. Cancelado é terminal no backend: a
 * remarcação vira um agendamento NOVO (o cancelado fica no histórico).
 */
export function rescheduleMode(status: string | null | undefined, moved: boolean):
  { mode: "patch"; status?: "agendado" } | { mode: "create" } {
  if (status === "cancelado") return { mode: "create" };
  if (moved && (status === "faltou" || status === "falta_justificada")) return { mode: "patch", status: "agendado" };
  return { mode: "patch" };
}

// ── Cancelamento ────────────────────────────────────────────

export const CANCEL_REASONS: Array<{ key: CancelReasonKey; label: string }> = [
  { key: "desmarcou", label: "Paciente desmarcou" },
  { key: "sem_resposta", label: "Paciente não respondeu" },
  { key: "remarcada", label: "Remarcada" },
  { key: "outro", label: "Outro" },
];

/** Botão vermelho só liga com motivo; "Outro" exige ao menos 2 letras. */
export function isCancelValid(reason: CancelReasonKey | null | undefined, other: string): boolean {
  if (!reason) return false;
  if (reason === "outro") return other.trim().length > 1;
  return true;
}

/** Texto gravado em cancel_reason. */
export function cancelReasonText(reason: CancelReasonKey, other: string): string {
  if (reason === "outro") return other.trim();
  return CANCEL_REASONS.find((r) => r.key === reason)?.label || reason;
}

// ── Confirmar amanhã ────────────────────────────────────────

/** "AAAA-MM-DD" de amanhã no fuso local. */
export function tomorrowLocalString(now: Date = new Date()): string {
  return toDateOnlyString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
}

export interface TomorrowItem {
  id: string;
  scheduled_at: string;
  status?: string | null;
}

/**
 * Separa os de amanhã: "A confirmar" (agendado) no topo e os demais
 * (confirmados, no consultório etc.) embaixo. Cancelados ficam de fora.
 */
export function splitTomorrow<T extends TomorrowItem>(list: T[] | null | undefined): {
  pending: T[]; done: T[]; total: number; confirmed: number; pct: number; label: string;
} {
  const active = (list || []).filter((a) => a.status !== "cancelado");
  const byTime = (a: T, b: T) => ms(a.scheduled_at) - ms(b.scheduled_at);
  const pending = active.filter((a) => (a.status || "agendado") === "agendado").sort(byTime);
  const done = active.filter((a) => (a.status || "agendado") !== "agendado").sort(byTime);
  const total = active.length;
  const confirmed = done.length;
  const pct = total ? Math.round((confirmed / total) * 100) : 0;
  return { pending, done, total, confirmed, pct, label: `${confirmed} de ${total} confirmado${total === 1 ? "" : "s"}` };
}

/** Contador do atalho "Confirmar amanhã". */
export function pendingTomorrowCount(list: TomorrowItem[] | null | undefined): number {
  return (list || []).filter((a) => (a.status || "agendado") === "agendado").length;
}

// ── Formatação ──────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "Hoje, qua 16/09" / "Amanhã, qui 17/09" / "Sex 18/09". */
export function dayLabel(d: Date, now: Date = new Date()): string {
  const key = toDateOnlyString(d);
  const short = `${DOW[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  if (key === toDateOnlyString(now)) return `Hoje, ${short.toLowerCase()}`;
  if (key === tomorrowLocalString(now)) return `Amanhã, ${short.toLowerCase()}`;
  return short;
}

/** "Hoje, qua 16/09 · 15:00–16:00". */
export function whenLine(scheduledAt: string | Date, durationMin: number, now: Date = new Date()): string {
  const d = new Date(scheduledAt);
  if (isNaN(d.getTime())) return "";
  const end = new Date(d.getTime() + (durationMin || 60) * 60000);
  return `${dayLabel(d, now)} · ${hhmm(d)}–${hhmm(end)}`;
}

/** "Qui 17 · 14:00 · 60 min" — linha do "antes → agora". */
export function slotSummary(d: Date, durationMin: number): string {
  return `${DOW[d.getDay()]} ${pad(d.getDate())} · ${hhmm(d)} · ${durationMin} min`;
}

/** "Ana Paula (14:00–14:30)" para o aviso de conflito. */
export function conflictLabel(c: SlotCandidate): string {
  const d = new Date(c.scheduled_at);
  const end = new Date(d.getTime() + (c.duration_min || 60) * 60000);
  return `${c.patient_name || "outro paciente"} (${hhmm(d)}–${hhmm(end)})`;
}
