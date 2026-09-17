// ============================================================
// AGENDA ODONTO — geometria e regras puras da grade (Semana e Dia)
//
// Mockup "Agenda Odonto" (16/09/2026), abas A e B. Sem React aqui: tudo que
// a grade calcula (faixas lado a lado, altura do bloco, alvo do arraste,
// conflito) fica testável em __tests__/agendaGrid.test.ts.
// Minutos são "minutos do dia" no fuso local (09:30 → 570).
// ============================================================

export const SNAP_MIN = 15;
export const MIN_DURATION = 15;
/** Distância (px) que o ponteiro precisa andar para virar arraste; abaixo disso é clique. */
export const DRAG_THRESHOLD_PX = 4;

/** Status que não ocupam horário (mesma lista do backend, NON_BLOCKING_STATUSES). */
export const NON_BLOCKING_STATUSES = ["cancelado", "faltou", "falta_justificada"];

export const pad2 = (n: number) => String(n).padStart(2, "0");

/** 570 → "09:30" */
export function hm(min: number): string {
  const m = Math.max(0, Math.round(min));
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Mesmo dia local de `day`, no minuto `min`. */
export function atMinute(day: Date, min: number): Date {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(min);
  return d;
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// ─── Faixas lado a lado (sobreposição) ──────────────────────

export interface LaneInput {
  id: string;
  start: number;
  dur: number;
}
export interface LaneOutput<T extends LaneInput> {
  item: T;
  /** Faixa (0..n-1) dentro do grupo de sobreposição. */
  col: number;
  /** Quantas faixas o grupo tem: largura = 100% / n. */
  n: number;
}

/**
 * Distribui blocos sobrepostos em faixas. O denominador é por GRUPO de
 * sobreposição (não pelo dia todo): um encaixe às 10h não estreita o bloco
 * das 15h. Encostar (fim == início) não sobrepõe.
 */
export function layoutLanes<T extends LaneInput>(items: T[]): LaneOutput<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.dur - a.dur);
  const out: LaneOutput<T>[] = [];
  let cluster: LaneOutput<T>[] = [];
  let cols: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    for (const it of cluster) it.n = cols.length;
    cluster = [];
    cols = [];
    clusterEnd = -Infinity;
  };
  for (const item of sorted) {
    if (cluster.length && item.start >= clusterEnd) flush();
    let col = cols.findIndex(end => end <= item.start);
    if (col < 0) {
      col = cols.length;
      cols.push(0);
    }
    cols[col] = item.start + item.dur;
    const it: LaneOutput<T> = { item, col, n: 1 };
    cluster.push(it);
    out.push(it);
    clusterEnd = Math.max(clusterEnd, item.start + item.dur);
  }
  if (cluster.length) flush();
  return out;
}

// ─── Altura do bloco ────────────────────────────────────────

export type BlockTier = "t1" | "t2" | "t3";

/**
 * t1: uma linha ("09:00 Ana Teste"), t2: hora + nome, t3: + procedimento/etiquetas.
 * Na visão Dia (coluna larga) o t1 vai até 50px, porque a linha única já leva o procedimento.
 */
export function blockTier(heightPx: number, wide: boolean): BlockTier {
  if (heightPx < (wide ? 50 : 36)) return "t1";
  if (heightPx < 64) return "t2";
  return "t3";
}

export interface BlockBox {
  top: number;
  height: number;
}

/** Posição vertical do bloco na coluna (2px de respiro embaixo). */
export function blockBox(startMin: number, durMin: number, startHour: number, hourPx: number): BlockBox {
  return {
    top: ((startMin - startHour * 60) / 60) * hourPx,
    height: Math.max(14, (durMin / 60) * hourPx - 2),
  };
}

// ─── Faixa de horas ─────────────────────────────────────────

/**
 * Faixa visível: a padrão (startHour–endHour) esticada para caber a primeira
 * e a última consulta do período. Antes, consultas fora de 07–19h sumiam.
 */
export function gridHourRange(
  spans: Array<{ start: number; dur: number }>,
  startHour: number,
  endHour: number,
): { startHour: number; endHour: number } {
  let s = startHour;
  let e = endHour;
  for (const sp of spans) {
    s = Math.min(s, Math.floor(sp.start / 60));
    e = Math.max(e, Math.ceil(Math.min(24 * 60, sp.start + sp.dur) / 60));
  }
  return { startHour: Math.max(0, s), endHour: Math.min(24, Math.max(e, s + 1)) };
}

// ─── Alvo do arraste ────────────────────────────────────────

export interface ColumnRect {
  left: number;
  right: number;
  top: number;
}

export function snap(min: number, step = SNAP_MIN): number {
  return Math.round(min / step) * step;
}

/** Coluna sob o ponteiro; fora da grade, a mais próxima. */
export function columnAt(clientX: number, rects: ColumnRect[]): number {
  if (!rects.length) return -1;
  const i = rects.findIndex(r => clientX >= r.left && clientX < r.right);
  if (i >= 0) return i;
  return clientX < rects[0].left ? 0 : rects.length - 1;
}

export interface Geometry {
  hourPx: number;
  startHour: number;
  endHour: number;
}

/**
 * Novo início ao mover: topo do bloco (ponteiro − onde o bloco foi pego)
 * convertido em minutos, arredondado para 15 e preso dentro da grade.
 */
export function moveStart(
  pointerYInColumn: number,
  grabOffsetY: number,
  durMin: number,
  g: Geometry,
): number {
  const top = pointerYInColumn - grabOffsetY;
  const raw = g.startHour * 60 + snap((top / g.hourPx) * 60);
  const max = g.endHour * 60 - durMin;
  return Math.max(g.startHour * 60, Math.min(Math.max(g.startHour * 60, max), raw));
}

/** Nova duração ao puxar a borda de baixo: fim arredondado para 15, mínimo 15 min. */
export function resizeDuration(pointerYInColumn: number, startMin: number, g: Geometry): number {
  const end = g.startHour * 60 + snap((pointerYInColumn / g.hourPx) * 60);
  const maxDur = g.endHour * 60 - startMin;
  return Math.max(MIN_DURATION, Math.min(maxDur, end - startMin));
}

// ─── Conflito (espelho de findConflicts do backend) ─────────

export interface ConflictCandidate {
  id: string;
  scheduled_at: string;
  duration_min?: number | null;
  practitioner_id?: string | null;
  status?: string | null;
  patient_name?: string | null;
}

export interface ConflictTarget {
  id?: string;
  scheduled_at: string;
  duration_min: number;
  practitioner_id?: string | null;
}

export interface ScheduleConflict {
  id: string;
  patient_name: string | null;
  scheduled_at: string;
  duration_min: number;
}

/**
 * Mesma regra do backend (services/dentalSchedule.js): mesmo dentista
 * (sem dentista só conflita com sem dentista), status que ocupa horário,
 * outro agendamento, intervalos semiabertos (encostar não conta).
 */
export function findConflicts(target: ConflictTarget, candidates: ConflictCandidate[]): ScheduleConflict[] {
  const t0 = new Date(target.scheduled_at).getTime();
  const t1 = t0 + target.duration_min * 60000;
  const tPrac = target.practitioner_id || null;
  return candidates
    .filter(c => !(target.id && c.id === target.id))
    .filter(c => (c.practitioner_id || null) === tPrac)
    .filter(c => !NON_BLOCKING_STATUSES.includes(String(c.status || "")))
    .filter(c => {
      const c0 = new Date(c.scheduled_at).getTime();
      const c1 = c0 + Number(c.duration_min || 60) * 60000;
      return t0 < c1 && c0 < t1;
    })
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .map(c => ({
      id: c.id,
      patient_name: c.patient_name ?? null,
      scheduled_at: c.scheduled_at,
      duration_min: Number(c.duration_min || 60),
    }));
}

// ─── Atualização otimista ───────────────────────────────────

export interface ReschedulePatch {
  scheduled_at?: string;
  duration_min?: number;
  practitioner_id?: string | null;
}

/**
 * Aplica o patch no cache de ["dental-agenda", ...] ({ appointments: [...] })
 * para o bloco ficar no lugar novo antes da resposta do servidor.
 */
export function applyAppointmentPatch<T extends { appointments?: any[] }>(
  data: T | undefined,
  id: string,
  patch: ReschedulePatch,
): T | undefined {
  if (!data || !Array.isArray(data.appointments)) return data;
  let hit = false;
  const appointments = data.appointments.map(a => {
    if (!a || a.id !== id) return a;
    hit = true;
    return { ...a, ...patch };
  });
  return hit ? { ...data, appointments } : data;
}

/** Valores atuais dos mesmos campos do patch (para o Desfazer). */
export function inversePatch(
  appt: { scheduled_at: string; duration_min?: number | null; practitioner_id?: string | null },
  patch: ReschedulePatch,
): ReschedulePatch {
  const inv: ReschedulePatch = {};
  if (patch.scheduled_at !== undefined) inv.scheduled_at = appt.scheduled_at;
  if (patch.duration_min !== undefined) inv.duration_min = Number(appt.duration_min || 60);
  if (patch.practitioner_id !== undefined) inv.practitioner_id = appt.practitioner_id ?? null;
  return inv;
}

/** "Ana Paula Ribeiro" → "Ana" (texto de toast e aviso). */
export function firstName(name: string | null | undefined): string {
  return (name || "Paciente").trim().split(/\s+/)[0] || "Paciente";
}

const DOW_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "Qui 17" */
export function dayShortLabel(d: Date): string {
  return `${DOW_SHORT[d.getDay()]} ${d.getDate()}`;
}

/** Rótulo da faixa-alvo: "Qui 17 · 14:30" ao mover, "45 min · 14:00–14:45" ao redimensionar. */
export function dropLabel(mode: "move" | "resize", day: Date, startMin: number, durMin: number): string {
  return mode === "resize"
    ? `${durMin} min · ${hm(startMin)}–${hm(startMin + durMin)}`
    : `${dayShortLabel(day)} · ${hm(startMin)}`;
}
