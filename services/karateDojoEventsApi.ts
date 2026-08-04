// ============================================================
// AURA DOJÔ — F9: eventos PRÓPRIOS do dojô (curso + seminário) — cliente
//
// Base /federation/:id/dojo/own-events e /federation/:id/dojo/events-hub
// (Aura-backend, src/routes/karateDojoEvents.js — migration 269, JÁ
// aplicada em produção). NÃO confundir com karateDojoFederativoApi.ts:
// aquele cobre eventos ABERTOS DA FEDERAÇÃO em que o dojô inscreve
// alunos (/federation/:id/dojo/events, 1 segmento — vitrine read-only da
// federação); este cobre eventos que o PRÓPRIO dojô cria e organiza
// ("/dojo/own-events", 2 segmentos — prefixo distinto de propósito, ver
// cabeçalho de karateDojoEvents.js no backend).
//
// O exame de kyu (karate_dojo_belt_exams) NÃO tem client aqui — este
// service cobre só o modelo novo (curso/seminário). O hub (events-hub)
// devolve os dois juntos com o discriminador `source`
// ('dojo_event' | 'belt_exam') — a UNION é feita no backend
// (karateDojoEventService.listEventsHub), aqui só se tipa a saída.
//
// SEM GATE DE CONEXÃO: curso/seminário são atos internos do dojô — as
// rotas não exigem `linked` (mesma razão do backend). O aluno inscrito
// NÃO precisa ser federado (a inscrição é ancorada no aluno do dojô,
// karate_dojo_students — por isso SelecionarAlunosModal aceita
// `requireFederated={false}` quando usado a partir daqui).
//
// Vive num service PRÓPRIO e pequeno — mesma regra da casa de
// karateDojoStudentsApi.ts/karateDojoFederativoApi.ts: karateApi.ts já
// tem 140+ KB e não é tocado por feature nova.
//
// Normalização DEFENSIVA (mesmo racional dos irmãos): campo ausente vira
// null em vez de quebrar a UI ("dado faltante ≠ pendência").
// ============================================================
import { request } from "@/services/api";

export type DojoEventKind = "curso" | "seminario";
export type DojoEventStatus = "scheduled" | "completed" | "cancelled";

export interface DojoOwnEvent {
  id: string;
  dojo_id: string | null;
  federation_id: string | null;
  kind: DojoEventKind;
  name: string;
  /** 'YYYY-MM-DD' — data pura (parse manual, tz-safe; ver utils/eventDate.ts). */
  event_date: string | null;
  location: string | null;
  fee_amount: number | null;
  max_participants: number | null;
  hours: number | null;
  description: string | null;
  status: DojoEventStatus;
  created_by_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** Ausente na resposta do POST /enroll (o backend não recalcula ali) — trate como opcional. */
  participants_count?: number;
}

export interface CreateDojoEventPayload {
  kind: DojoEventKind;
  name: string;
  /** 'YYYY-MM-DD'. */
  event_date: string;
  location?: string | null;
  fee_amount?: number | null;
  max_participants?: number | null;
  hours?: number | null;
  description?: string | null;
}

// ── Hub unificado (curso/seminário + exame de kyu) ──────────────────────

export type EventsHubSource = "dojo_event" | "belt_exam";
export type EventsHubKind = DojoEventKind | "exame_kyu";

export interface EventsHubItem {
  id: string;
  source: EventsHubSource;
  kind: EventsHubKind;
  name: string;
  event_date: string | null;
  location: string | null;
  /** Normalizado ('scheduled'|'completed'|'cancelled') — igual pros dois `source`. */
  status: DojoEventStatus;
  /** Valor cru da tabela de origem (ex.: 'draft' no exame de kyu vira 'scheduled' aqui). */
  native_status: string;
  participants_count: number;
}

export interface EventsHubResponse {
  data: EventsHubItem[];
  count: number;
  page: number;
  pageSize: number;
  /** true quando alguma migration de origem ainda não rodou neste ambiente — lista degrada pra vazia, nunca quebra. */
  schema_pending?: boolean;
}

// ── Inscrição em lote ────────────────────────────────────────────────────
// Mesmo vocabulário de skip de karateDojoFederativoApi.SkippedItem — reason
// aqui NUNCA é "ALUNO_NAO_FEDERADO" (o backend de own-events não filtra por
// federação), mas os demais códigos (ID_INVALIDO/ALUNO_NAO_ENCONTRADO/
// JA_INSCRITO) já têm tradução pt-BR pronta em dojoFederativo/helpers.ts.

export interface DojoEventSkippedItem {
  student_id: string | null;
  name: string | null;
  reason: string;
  message?: string | null;
}

export interface DojoEventEnrollmentRow {
  student_id: string;
  name: string | null;
  practitioner_id: string | null;
  enrollment_id: string;
}

export interface EnrollBatchResult {
  enrolled: number;
  enrollments: DojoEventEnrollmentRow[];
  event: DojoOwnEvent | null;
  skipped: DojoEventSkippedItem[];
}

export interface EnrollmentListRow {
  id: string;
  student_id: string;
  name: string | null;
  belt_label: string | null;
  practitioner_id: string | null;
  /** true quando o aluno também é federado — informativo apenas; não filtra a inscrição. */
  federated: boolean;
  status: string;
  fee_paid: boolean;
  notes: string | null;
  created_at: string | null;
}

export interface ListEnrollmentsResponse {
  event: DojoOwnEvent | null;
  data: EnrollmentListRow[];
  count: number;
}

// ── Normalização defensiva ───────────────────────────────────────────────

function str(v: any): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function num(v: any): number | null {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && isFinite(n) ? n : null;
}
function bool(v: any): boolean {
  return v === true;
}

const VALID_KINDS: DojoEventKind[] = ["curso", "seminario"];
const VALID_STATUSES: DojoEventStatus[] = ["scheduled", "completed", "cancelled"];

function normalizeEvent(raw: any): DojoOwnEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw;
  return {
    id: String(r.id ?? ""),
    dojo_id: str(r.dojo_id),
    federation_id: str(r.federation_id),
    kind: VALID_KINDS.includes(r.kind) ? r.kind : "curso",
    name: str(r.name) || "Evento",
    event_date: str(r.event_date),
    location: str(r.location),
    fee_amount: num(r.fee_amount),
    max_participants: num(r.max_participants),
    hours: num(r.hours),
    description: str(r.description),
    status: VALID_STATUSES.includes(r.status) ? r.status : "scheduled",
    created_by_name: str(r.created_by_name),
    created_at: str(r.created_at),
    updated_at: str(r.updated_at),
    participants_count: typeof r.participants_count === "number" ? r.participants_count : undefined,
  };
}

function normalizeHubItem(raw: any): EventsHubItem {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    id: String(r.id ?? ""),
    source: r.source === "belt_exam" ? "belt_exam" : "dojo_event",
    kind: r.kind === "seminario" || r.kind === "exame_kyu" ? r.kind : "curso",
    name: str(r.name) || "Evento",
    event_date: str(r.event_date),
    location: str(r.location),
    status: VALID_STATUSES.includes(r.status) ? r.status : "scheduled",
    native_status: str(r.native_status) || r.status || "scheduled",
    participants_count: typeof r.participants_count === "number" ? r.participants_count : 0,
  };
}

function normalizeSkipped(raw: any): DojoEventSkippedItem {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    student_id: str(r.student_id),
    name: str(r.name),
    reason: str(r.reason) || "ID_INVALIDO",
    message: str(r.message),
  };
}

function normalizeEnrollmentRow(raw: any): DojoEventEnrollmentRow {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    student_id: String(r.student_id ?? ""),
    name: str(r.name),
    practitioner_id: str(r.practitioner_id),
    enrollment_id: String(r.enrollment_id ?? ""),
  };
}

function normalizeEnrollmentListRow(raw: any): EnrollmentListRow {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    id: String(r.id ?? ""),
    student_id: String(r.student_id ?? ""),
    name: str(r.name),
    belt_label: str(r.belt_label),
    practitioner_id: str(r.practitioner_id),
    federated: bool(r.federated),
    status: str(r.status) || "enrolled",
    fee_paid: bool(r.fee_paid),
    notes: str(r.notes),
    created_at: str(r.created_at),
  };
}

function qs(params: Record<string, string | undefined>): string {
  const parts: string[] = [];
  for (const k of Object.keys(params)) {
    const v = params[k];
    if (v != null && v !== "") parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

const base = (federationId: string) => `/federation/${federationId}/dojo`;

export const karateDojoEventsApi = {
  /**
   * Listagem UNIFICADA (curso/seminário + exame de kyu). Fonte única do
   * hub "Meus eventos" — degrada pra `{data:[], schema_pending:true}` em
   * vez de estourar quando alguma migration de origem ainda não rodou.
   */
  listEventsHub: async (
    federationId: string,
    opts: { kind?: EventsHubKind; page?: number; pageSize?: number } = {}
  ): Promise<EventsHubResponse> => {
    const res = await request<any>(
      `${base(federationId)}/events-hub${qs({
        kind: opts.kind,
        page: opts.page != null ? String(opts.page) : undefined,
        pageSize: opts.pageSize != null ? String(opts.pageSize) : undefined,
      })}`
    );
    const data = Array.isArray(res?.data) ? res.data.map(normalizeHubItem) : [];
    return {
      data,
      count: typeof res?.count === "number" ? res.count : data.length,
      page: typeof res?.page === "number" ? res.page : 1,
      pageSize: typeof res?.pageSize === "number" ? res.pageSize : data.length,
      schema_pending: res?.schema_pending === true,
    };
  },

  /** Cria curso OU seminário — NUNCA exame de kyu (tela própria, backend separado). */
  createOwnEvent: async (
    federationId: string,
    payload: CreateDojoEventPayload
  ): Promise<DojoOwnEvent> => {
    const res = await request<any>(`${base(federationId)}/own-events`, {
      method: "POST",
      body: payload,
    });
    const event = normalizeEvent(res?.event);
    if (!event) throw new Error("Resposta inesperada do servidor ao criar o evento.");
    return event;
  },

  /**
   * Inscrição em lote — o backend NÃO filtra por federação (aluno do
   * dojô, federado ou não, pode participar de curso/seminário próprio).
   */
  enrollBatch: async (
    federationId: string,
    eventId: string,
    studentIds: string[]
  ): Promise<EnrollBatchResult> => {
    const res = await request<any>(`${base(federationId)}/own-events/${eventId}/enroll`, {
      method: "POST",
      body: { student_ids: studentIds },
    });
    return {
      enrolled: typeof res?.enrolled === "number" ? res.enrolled : 0,
      enrollments: Array.isArray(res?.enrollments) ? res.enrollments.map(normalizeEnrollmentRow) : [],
      event: normalizeEvent(res?.event),
      skipped: Array.isArray(res?.skipped) ? res.skipped.map(normalizeSkipped) : [],
    };
  },

  listEnrollments: async (federationId: string, eventId: string): Promise<ListEnrollmentsResponse> => {
    const res = await request<any>(`${base(federationId)}/own-events/${eventId}/enrollments`);
    const data = Array.isArray(res?.data) ? res.data.map(normalizeEnrollmentListRow) : [];
    return {
      event: normalizeEvent(res?.event),
      data,
      count: typeof res?.count === "number" ? res.count : data.length,
    };
  },
};
