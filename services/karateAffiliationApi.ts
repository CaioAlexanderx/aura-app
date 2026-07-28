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
//
// DECISÃO (27/07/2026): a federação NUNCA abre filiação pelo dojô — é
// sempre o dojô self-serve que se filia. `origin`/`requested_by` (migration
// 255), `pending_by_origin` e `openRequest()` (POST /affiliation-requests)
// foram REMOVIDOS daqui — o backend também está revertendo esses campos.
// Contrato self-serve puro: list, metrics, approve, reject.
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
    return {
      pending: num(r.pending) ?? 0,
      approved: num(r.approved) ?? 0,
      rejected: num(r.rejected) ?? 0,
      mais_antiga: r.mais_antiga ?? null,
    };
  },

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
