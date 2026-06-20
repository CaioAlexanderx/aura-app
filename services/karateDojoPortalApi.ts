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
