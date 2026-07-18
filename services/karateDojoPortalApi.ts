// ============================================================
// AURA KARATÊ — API do Portal do Dojô (Canal B / link fixo)
//
// O dojô SEM Aura entra por um LINK FIXO não-expirável; o token vai no
// header Authorization. As rotas são token-only (o servidor deriva
// dojo_id + federation_id do token), montadas em /public/karate/dojo/*.
//
//   GET  /public/karate/dojo/me
//   GET  /public/karate/dojo/practitioners
//   GET  /public/karate/dojo/annuity
//   POST /public/karate/dojo/annuity/pix
//   GET  /public/karate/dojo/certificates
// ============================================================
import { request } from "@/services/api";

const API = process.env.EXPO_PUBLIC_API_URL ?? "";
const BASE = `${API}/api/v1/public/karate/dojo`;

export interface DojoMe {
  id: string;
  name: string;
  cnpj: string | null;
  sensei_cpf: string | null;
  region: string | null;
  fpkt_affiliation_id: string | null;
  affiliation_model: string | null;
  affiliation_since: string | null;
  dojo_founded_year: number | null;
  phone: string | null;
  email: string | null;
  karate_logo_url: string | null;
  status: "active" | "pending" | "inactive";
  practitioner_count: number;
}

export interface DojoPractitioner {
  practitioner_id: string;
  name: string;
  belt_level: string | null;
  belt_name: string | null;
}

export interface AnnuityRow {
  annuity_history_id: string;
  reference_period: string;
  amount: number;
  status: string;
  paid_at?: string | null;
  due_date?: string | null;
}

export interface AnnuityStatus {
  pending: AnnuityRow | null;
  history: AnnuityRow[];
}

export interface PixIntent {
  intent_id: string;
  payment_intent_id: string;
  payload: string;
  qr_image: string | null;
  status: string;
  expires_at: string | null;
  provider: string;
}

export interface DojoCertificate {
  id: string;
  practitioner_id: string;
  practitioner_name: string | null;
  belt_level: string;
  belt_name: string;
  status: string;
  created_at: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function handle<T>(r: Response): Promise<T> {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (data && (data.error || data.message)) || `Erro ${r.status}`;
    const err = new Error(msg) as Error & { status?: number; code?: string };
    err.status = r.status;
    err.code = data?.code;
    throw err;
  }
  return data as T;
}

export const karateDojoPortalApi = {
  getMe: (token: string) =>
    fetch(`${BASE}/me`, { headers: authHeaders(token) }).then(handle<DojoMe>),

  getPractitioners: (token: string) =>
    fetch(`${BASE}/practitioners`, { headers: authHeaders(token) })
      .then(handle<{ practitioners: DojoPractitioner[]; count: number }>),

  getAnnuity: (token: string) =>
    fetch(`${BASE}/annuity`, { headers: authHeaders(token) }).then(handle<AnnuityStatus>),

  createAnnuityPix: (token: string, annuityHistoryId: string) =>
    fetch(`${BASE}/annuity/pix`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ annuity_history_id: annuityHistoryId }),
    }).then(handle<PixIntent>),

  getCertificates: (token: string) =>
    fetch(`${BASE}/certificates`, { headers: authHeaders(token) })
      .then(handle<{ orders: DojoCertificate[]; count: number }>),
};

// ─────────────────────────────────────────────────────────────
// Lado FEDERAÇÃO (autenticado, staff) — gestão do link fixo do portal.
// Contrato do Aura-backend #398 (F0):
//   POST   /federation/:id/dojos/:dojoId/portal-link → { url, token, created_at }
//          (o token/URL completos são exibidos UMA única vez — não há GET do valor)
//   GET    /federation/:id/dojos/:dojoId/portal-link → { active, created_at, revoked_at }
//   DELETE /federation/:id/dojos/:dojoId/portal-link → revoga imediatamente
// Usa o request() core de services/api.ts (Bearer JWT auto), mesmo padrão dos
// métodos de federação do karateApi — fica NESTE arquivo (e não no karateApi.ts,
// 125 KB) para manter a edição cirúrgica: é o outro lado do MESMO Canal B acima.
// ─────────────────────────────────────────────────────────────

export interface DojoPortalLinkStatus {
  active: boolean;
  created_at: string | null;
  revoked_at: string | null;
}

export interface DojoPortalLinkCreated {
  url: string;
  token: string;
  created_at: string;
}

export const karateDojoPortalAdminApi = {
  /** Estado atual do link (nunca devolve o token em si). */
  getPortalLink: (federationId: string, dojoId: string): Promise<DojoPortalLinkStatus> =>
    request(`/federation/${federationId}/dojos/${dojoId}/portal-link`),

  /** Gera (ou regenera, invalidando o anterior) o link fixo do portal. */
  createPortalLink: (federationId: string, dojoId: string): Promise<DojoPortalLinkCreated> =>
    request(`/federation/${federationId}/dojos/${dojoId}/portal-link`, { method: "POST" }),

  /** Revoga o link ativo — o dojô perde o acesso na hora. */
  revokePortalLink: (federationId: string, dojoId: string): Promise<{ revoked: boolean }> =>
    request(`/federation/${federationId}/dojos/${dojoId}/portal-link`, { method: "DELETE" }),
};
