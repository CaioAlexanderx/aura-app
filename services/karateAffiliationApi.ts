// ============================================================
// AURA KARATÊ — Filiação do dojô à federação (F6)
//
// Duas pontas do MESMO fluxo (Aura-backend#424 + migration 252):
//   • Lado DOJÔ (JWT do dojô)       — GET/POST /federation/:id/dojo/connection
//   • Lado FEDERAÇÃO (JWT federação) — GET /federation/:id/affiliation-requests[/metrics]
//                                       POST .../:requestId/approve|reject
//
// Vive num service PRÓPRIO e pequeno: services/karateApi.ts já tem 125 KB
// e a regra da casa é edição cirúrgica — nada de tocar nele por uma
// feature nova (mesmo racional de karateDojoInfoApi.ts/karateConnectionsApi.ts).
//
// Normalização DEFENSIVA nas duas pontas: campos ausentes viram null/[]
// em vez de quebrar a UI — mesmo racional de karateDojoInfoApi.ts.
// ============================================================
import { request } from "@/services/api";

// ── Lado dojô ────────────────────────────────────────────────
export type DojoConnectionStatus = "none" | "pending" | "approved" | "rejected";

export interface DojoConnectionRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

export interface DojoConnectionFederationInfo {
  name: string;
  slug: string;
}

export interface DojoConnectionInfo {
  status: DojoConnectionStatus;
  linked: boolean;
  linked_at: string | null;
  request: DojoConnectionRequest | null;
  federation: DojoConnectionFederationInfo | null;
  /** Migration 252 ainda não aplicada nesse ambiente — degradar, não quebrar. */
  schema_pending: boolean;
}

export interface DojoConnectionRequestBody {
  contact_name: string;
  contact_phone: string;
  contact_email?: string;
  cnpj?: string;
  cpf?: string;
  address?: string;
  city?: string;
  state?: string;
  students_count?: number;
  notes?: string;
}

export interface DojoConnectionCreateResult {
  id: string;
  status: "pending";
  created_at: string;
  already_pending: boolean;
}

// ── Lado federação ───────────────────────────────────────────
export type AffiliationRequestStatus = "pending" | "approved" | "rejected";

export interface AffiliationRequestDojo {
  id: string;
  name: string;
}

export type AffiliationRequestOrigin = "dojo" | "federation";

export interface AffiliationRequestRow {
  id: string;
  dojo: AffiliationRequestDojo | null;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  cnpj: string | null;
  cpf: string | null;
  city: string | null;
  state: string | null;
  students_count: number | null;
  notes: string | null;
  status: AffiliationRequestStatus;
  /** migration 255: quem abriu o pedido — 'dojo' (self-serve, POST
   *  /dojo/connection) | 'federation' (a federação abriu pelo dojô, POST
   *  /affiliation-requests). Mesmo inbox, mesmo approve/reject. */
  origin: AffiliationRequestOrigin;
  /** id do usuário da federação que abriu (origin==='federation'); null
   *  quando origin==='dojo' (o próprio dojô abriu, sem "requested_by"). */
  requested_by: string | null;
  created_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

export interface AffiliationRequestsList {
  data: AffiliationRequestRow[];
  count: number;
}

export interface AffiliationOldestPending {
  criada_em: string;
  dias: number;
}

export interface AffiliationRequestsMetrics {
  pending: number;
  approved: number;
  rejected: number;
  mais_antiga: AffiliationOldestPending | null;
  /** migration 255: quebra do pendente por quem abriu o pedido. */
  pending_by_origin: { dojo: number; federation: number };
}

export interface AffiliationApproveResult {
  ok: boolean;
  dojo_id: string;
  fpkt_affiliation_id: string;
  linked_at: string;
}

export interface AffiliationRejectResult {
  ok: boolean;
}

// ── POST /affiliation-requests (lado federação abre pelo dojô) ──────
// migration 255: mesmo corpo aceito por POST /dojo/connection — só o
// dojo_id (obrigatório) muda quem está falando. Ver
// AffiliationOpenRequestResult para o formato de resposta.
export interface AffiliationOpenRequestBody {
  dojo_id: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  cnpj?: string;
  cpf?: string;
  address?: string;
  city?: string;
  state?: string;
  students_count?: number;
  notes?: string;
}

export interface AffiliationOpenRequestResult {
  id: string;
  status: "pending";
  origin: AffiliationRequestOrigin;
  created_at: string;
  already_pending: boolean;
}

function num(v: any): number | null {
  const n = typeof v === "string" ? parseInt(v, 10) : v;
  return typeof n === "number" && isFinite(n) ? n : null;
}
function str(v: any): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function normalizeDojoConnection(raw: any): DojoConnectionInfo {
  const r = raw && typeof raw === "object" ? raw : {};
  const validStatus: DojoConnectionStatus[] = ["none", "pending", "approved", "rejected"];
  const status: DojoConnectionStatus = validStatus.includes(r.status) ? r.status : "none";
  return {
    status,
    linked: !!r.linked,
    linked_at: str(r.linked_at),
    request: r.request && typeof r.request === "object"
      ? {
          id: String(r.request.id),
          status: r.request.status,
          created_at: r.request.created_at,
          reviewed_at: str(r.request.reviewed_at),
          rejection_reason: str(r.request.rejection_reason),
        }
      : null,
    federation: r.federation && typeof r.federation === "object"
      ? { name: str(r.federation.name) || "", slug: str(r.federation.slug) || "" }
      : null,
    schema_pending: !!r.schema_pending,
  };
}

function normalizeAffiliationRow(raw: any): AffiliationRequestRow {
  const r = raw && typeof raw === "object" ? raw : {};
  const validStatus: AffiliationRequestStatus[] = ["pending", "approved", "rejected"];
  const validOrigin: AffiliationRequestOrigin[] = ["dojo", "federation"];
  return {
    id: String(r.id),
    dojo: r.dojo && typeof r.dojo === "object"
      ? { id: String(r.dojo.id), name: str(r.dojo.name) || "Dojô sem nome" }
      : null,
    contact_name: str(r.contact_name) || "",
    contact_phone: str(r.contact_phone) || "",
    contact_email: str(r.contact_email),
    cnpj: str(r.cnpj),
    cpf: str(r.cpf),
    city: str(r.city),
    state: str(r.state),
    students_count: num(r.students_count),
    notes: str(r.notes),
    status: validStatus.includes(r.status) ? r.status : "pending",
    // origin ausente (backend antigo/schema pendente) → 'dojo': é o
    // comportamento histórico (só existia o self-serve).
    origin: validOrigin.includes(r.origin) ? r.origin : "dojo",
    requested_by: str(r.requested_by),
    created_at: r.created_at,
    reviewed_at: str(r.reviewed_at),
    rejection_reason: str(r.rejection_reason),
  };
}

export const karateAffiliationApi = {
  // ── Lado dojô ──────────────────────────────────────────────
  getConnection: async (federationId: string): Promise<DojoConnectionInfo> =>
    normalizeDojoConnection(await request<any>(`/federation/${federationId}/dojo/connection`)),

  requestConnection: (
    federationId: string,
    body: DojoConnectionRequestBody
  ): Promise<DojoConnectionCreateResult> =>
    request(`/federation/${federationId}/dojo/connection`, { method: "POST", body }),

  // ── Lado federação ─────────────────────────────────────────
  listRequests: async (
    federationId: string,
    status?: AffiliationRequestStatus
  ): Promise<AffiliationRequestsList> => {
    const qs = status ? `?status=${status}` : "";
    const res = await request<any>(`/federation/${federationId}/affiliation-requests${qs}`);
    const data = Array.isArray(res?.data) ? res.data.map(normalizeAffiliationRow) : [];
    return { data, count: typeof res?.count === "number" ? res.count : data.length };
  },

  getMetrics: async (federationId: string): Promise<AffiliationRequestsMetrics> => {
    const res = await request<any>(`/federation/${federationId}/affiliation-requests/metrics`);
    const r = res && typeof res === "object" ? res : {};
    const byOrigin = r.pending_by_origin && typeof r.pending_by_origin === "object" ? r.pending_by_origin : {};
    return {
      pending: num(r.pending) ?? 0,
      approved: num(r.approved) ?? 0,
      rejected: num(r.rejected) ?? 0,
      mais_antiga: r.mais_antiga ?? null,
      pending_by_origin: {
        dojo: num(byOrigin.dojo) ?? 0,
        federation: num(byOrigin.federation) ?? 0,
      },
    };
  },

  /**
   * A FEDERAÇÃO abre o pedido de filiação pelo dojô (migration 255) —
   * mesmo inbox do self-serve, só que `origin:'federation'`. O dojô
   * precisa já estar tecnicamente roteado a esta federação
   * (companies.federation_id) e ainda não linkado.
   * 201 { id, status:'pending', origin:'federation' } — pedido novo
   * 200 { ..., already_pending:true }                 — já havia pendente
   * Erros (o caller trata via ApiError): 404 DOJO_NOT_FOUND |
   * 422 DOJO_NAO_ROTEADO | 422 VALIDATION_ERROR | 409 JA_CONECTADO.
   */
  openRequest: (
    federationId: string,
    body: AffiliationOpenRequestBody
  ): Promise<AffiliationOpenRequestResult> =>
    request(`/federation/${federationId}/affiliation-requests`, { method: "POST", body }),

  approve: (
    federationId: string,
    requestId: string,
    fpktNumber: string
  ): Promise<AffiliationApproveResult> =>
    request(`/federation/${federationId}/affiliation-requests/${requestId}/approve`, {
      method: "POST",
      body: { fpkt_number: fpktNumber },
    }),

  reject: (
    federationId: string,
    requestId: string,
    reason: string
  ): Promise<AffiliationRejectResult> =>
    request(`/federation/${federationId}/affiliation-requests/${requestId}/reject`, {
      method: "POST",
      body: { reason },
    }),
};
