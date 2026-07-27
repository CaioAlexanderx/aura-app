// ============================================================
// AURA DOJÔ — F5b: certificados reais, inscrição em lote em eventos e
// candidatos a exame de faixa (Aura-backend#426, base /federation/:id/dojo)
//
// REGRA DE OURO: só aluno FEDERADO participa. O backend recusa item por
// item (nunca a chamada inteira) e devolve o motivo em `skipped[].reason`
// — este service só tipa e chama; o mapeamento pt-BR fica em
// components/karate/dojoFederativo/helpers.ts (mapSkipReason).
//
// GET /aptos: a unidade é a GRADUAÇÃO (belt_history), não o aluno — um
// aluno pode aparecer 2x se tiver 2 graduações sem pedido de certificado
// ainda. Por isso toda seleção de "aptos" usa belt_history_id como chave,
// nunca student_id.
//
// Todas as rotas exigem dojô conectado (409 DOJO_NAO_CONECTADO); escrita
// só Canal A (403 PORTAL_READ_ONLY) — mesmos códigos já mapeados em
// dojoAlunos/helpers.ts (mapFederationError) e karateAffiliationApi.ts.
//
// Vive num service PRÓPRIO e pequeno — mesma regra da casa de
// karateDojoStudentsApi.ts/karateAffiliationApi.ts: services/karateApi.ts
// já tem 125 KB e não é tocado por feature nova.
//
// Normalização DEFENSIVA (mesmo racional de karateAffiliationApi.ts):
// campo ausente vira null/[] em vez de quebrar a UI.
// ============================================================
import { request } from "@/services/api";

// ── Praticantes aptos a certificado (GET /aptos) ────────────────────────

export interface AptoRow {
  student_id: string;
  practitioner_id: string;
  name: string;
  fpkt_number: string | null;
  belt_history_id: string;
  belt_level: string | null;
  belt_label: string | null;
  belt_order: number | null;
  /** 'YYYY-MM-DD' — data da graduação (parse manual, tz-safe). */
  graduated_at: string | null;
  exam_id: string | null;
  exam_name: string | null;
}

export interface AptosResponse {
  data: AptoRow[];
  count: number;
}

// ── Razões de skip (mesmo vocabulário nas 3 rotas de lote) ──────────────

export type SkipReasonCode =
  | "ALUNO_NAO_FEDERADO"
  | "ALUNO_NAO_ENCONTRADO"
  | "JA_INSCRITO"
  | "JA_SOLICITADO"
  | "SEM_GRADUACAO"
  | "GRADUACAO_NAO_ENCONTRADA"
  | "EVENTO_FECHADO"
  | "COMPETICAO_NAO_SUPORTADA"
  | "ID_INVALIDO"
  | string;

export interface SkippedItem {
  student_id: string | null;
  name: string | null;
  reason: SkipReasonCode;
  /** Mensagem crua do backend (fallback) — a UI prefere mapSkipReason(). */
  message?: string | null;
}

// ── Pedidos de certificado (POST/GET /cert-orders) ──────────────────────

export type DojoCertOrderStatus =
  | "requested" | "in_production" | "printed" | "shipped" | "refused";

export interface CreateCertOrderItem {
  student_id: string;
  /** Qual graduação específica (aluno pode ter mais de uma apta). */
  belt_history_id?: string;
}

export type CertDeliveryType = "pickup" | "mail";

export interface CreateCertOrdersBody {
  items: CreateCertOrderItem[];
  delivery_type?: CertDeliveryType;
  addr_zip_code?: string;
  addr_street?: string;
  addr_number?: string;
  addr_neighborhood?: string;
  addr_city?: string;
  addr_state?: string;
}

export interface DojoCertOrderRow {
  id: string;
  student_id: string | null;
  student_name: string;
  belt_history_id: string | null;
  belt_label: string | null;
  status: DojoCertOrderStatus;
  delivery_type: CertDeliveryType | null;
  tracking_code: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateCertOrdersResult {
  created: number;
  orders: DojoCertOrderRow[];
  skipped: SkippedItem[];
}

export interface ListCertOrdersResponse {
  data: DojoCertOrderRow[];
  count: number;
  page: number;
  pageSize: number;
}

// ── Inscrição em eventos (POST/GET /events/:eventId/enroll) ─────────────

export interface EnrollmentRow {
  id: string;
  student_id: string;
  student_name: string;
  created_at: string | null;
}

export interface EnrollEventRef {
  id: string;
  name: string;
}

export interface EnrollResult {
  enrolled: number;
  enrollments: EnrollmentRow[];
  event: EnrollEventRef | null;
  skipped: SkippedItem[];
}

export interface ListEnrollmentsResponse {
  event: EnrollEventRef | null;
  data: EnrollmentRow[];
  count: number;
}

// ── Candidatos a exame de faixa (POST/GET /belt-exams/:examId/candidates)

export interface CandidateRow {
  id: string;
  student_id: string;
  student_name: string;
  created_at: string | null;
}

export interface SubmitCandidatesResult {
  submitted: number;
  candidates: CandidateRow[];
  event: EnrollEventRef | null;
  skipped: SkippedItem[];
}

export interface ListCandidatesResponse {
  event: EnrollEventRef | null;
  data: CandidateRow[];
  count: number;
}

// ── Normalização defensiva (schema pode variar; ausente ≠ pendência) ────

function str(v: any): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function num(v: any): number | null {
  const n = typeof v === "string" ? parseInt(v, 10) : v;
  return typeof n === "number" && isFinite(n) ? n : null;
}

function normalizeApto(raw: any): AptoRow {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    student_id: String(r.student_id ?? ""),
    practitioner_id: String(r.practitioner_id ?? ""),
    name: str(r.name) || "Sem nome",
    fpkt_number: str(r.fpkt_number),
    belt_history_id: String(r.belt_history_id ?? ""),
    belt_level: str(r.belt_level),
    belt_label: str(r.belt_label),
    belt_order: num(r.belt_order),
    graduated_at: str(r.graduated_at),
    exam_id: str(r.exam_id),
    exam_name: str(r.exam_name),
  };
}

function normalizeSkipped(raw: any): SkippedItem {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    student_id: str(r.student_id),
    name: str(r.name),
    reason: str(r.reason) || "ID_INVALIDO",
    message: str(r.message),
  };
}

function normalizeCertOrder(raw: any): DojoCertOrderRow {
  const r = raw && typeof raw === "object" ? raw : {};
  const validStatus: DojoCertOrderStatus[] = ["requested", "in_production", "printed", "shipped", "refused"];
  const deliveryType: CertDeliveryType | null =
    r.delivery_type === "mail" ? "mail" : r.delivery_type === "pickup" ? "pickup" : null;
  return {
    id: String(r.id ?? ""),
    student_id: str(r.student_id),
    student_name: str(r.student_name) || str(r.nome_impresso) || str(r.name) || "Sem nome",
    belt_history_id: str(r.belt_history_id),
    belt_label: str(r.belt_label) || str(r.belt_name),
    status: validStatus.includes(r.status) ? r.status : "requested",
    delivery_type: deliveryType,
    tracking_code: str(r.tracking_code),
    notes: str(r.notes),
    created_at: str(r.created_at),
    updated_at: str(r.updated_at),
  };
}

function normalizeEnrollment(raw: any): EnrollmentRow {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    id: String(r.id ?? ""),
    student_id: String(r.student_id ?? ""),
    student_name: str(r.student_name) || str(r.name) || "Sem nome",
    created_at: str(r.created_at),
  };
}

function normalizeCandidate(raw: any): CandidateRow {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    id: String(r.id ?? ""),
    student_id: String(r.student_id ?? ""),
    student_name: str(r.student_name) || str(r.name) || "Sem nome",
    created_at: str(r.created_at),
  };
}

function normalizeEventRef(raw: any): EnrollEventRef | null {
  if (!raw || typeof raw !== "object") return null;
  return { id: String(raw.id ?? ""), name: str(raw.name) || "Evento" };
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

export const karateDojoFederativoApi = {
  getAptos: async (federationId: string): Promise<AptosResponse> => {
    const res = await request<any>(`${base(federationId)}/aptos`);
    const data = Array.isArray(res?.data) ? res.data.map(normalizeApto) : [];
    return { data, count: typeof res?.count === "number" ? res.count : data.length };
  },

  createCertOrders: async (
    federationId: string,
    body: CreateCertOrdersBody
  ): Promise<CreateCertOrdersResult> => {
    const res = await request<any>(`${base(federationId)}/cert-orders`, { method: "POST", body });
    return {
      created: typeof res?.created === "number" ? res.created : 0,
      orders: Array.isArray(res?.orders) ? res.orders.map(normalizeCertOrder) : [],
      skipped: Array.isArray(res?.skipped) ? res.skipped.map(normalizeSkipped) : [],
    };
  },

  listCertOrders: async (
    federationId: string,
    opts: { status?: DojoCertOrderStatus; page?: number; pageSize?: number } = {}
  ): Promise<ListCertOrdersResponse> => {
    const res = await request<any>(
      `${base(federationId)}/cert-orders${qs({
        status: opts.status,
        page: opts.page != null ? String(opts.page) : undefined,
        pageSize: opts.pageSize != null ? String(opts.pageSize) : undefined,
      })}`
    );
    const data = Array.isArray(res?.data) ? res.data.map(normalizeCertOrder) : [];
    return {
      data,
      count: typeof res?.count === "number" ? res.count : data.length,
      page: typeof res?.page === "number" ? res.page : 1,
      pageSize: typeof res?.pageSize === "number" ? res.pageSize : data.length,
    };
  },

  enrollInEvent: async (
    federationId: string,
    eventId: string,
    studentIds: string[]
  ): Promise<EnrollResult> => {
    const res = await request<any>(`${base(federationId)}/events/${eventId}/enroll`, {
      method: "POST",
      body: { student_ids: studentIds },
    });
    return {
      enrolled: typeof res?.enrolled === "number" ? res.enrolled : 0,
      enrollments: Array.isArray(res?.enrollments) ? res.enrollments.map(normalizeEnrollment) : [],
      event: normalizeEventRef(res?.event),
      skipped: Array.isArray(res?.skipped) ? res.skipped.map(normalizeSkipped) : [],
    };
  },

  listEventEnrollments: async (federationId: string, eventId: string): Promise<ListEnrollmentsResponse> => {
    const res = await request<any>(`${base(federationId)}/events/${eventId}/enrollments`);
    const data = Array.isArray(res?.data) ? res.data.map(normalizeEnrollment) : [];
    return {
      event: normalizeEventRef(res?.event),
      data,
      count: typeof res?.count === "number" ? res.count : data.length,
    };
  },

  submitExamCandidates: async (
    federationId: string,
    examId: string,
    studentIds: string[]
  ): Promise<SubmitCandidatesResult> => {
    const res = await request<any>(`${base(federationId)}/belt-exams/${examId}/candidates`, {
      method: "POST",
      body: { student_ids: studentIds },
    });
    return {
      submitted: typeof res?.submitted === "number" ? res.submitted : 0,
      candidates: Array.isArray(res?.candidates) ? res.candidates.map(normalizeCandidate) : [],
      event: normalizeEventRef(res?.event),
      skipped: Array.isArray(res?.skipped) ? res.skipped.map(normalizeSkipped) : [],
    };
  },

  listExamCandidates: async (federationId: string, examId: string): Promise<ListCandidatesResponse> => {
    const res = await request<any>(`${base(federationId)}/belt-exams/${examId}/candidates`);
    const data = Array.isArray(res?.data) ? res.data.map(normalizeCandidate) : [];
    return {
      event: normalizeEventRef(res?.event),
      data,
      count: typeof res?.count === "number" ? res.count : data.length,
    };
  },
};
