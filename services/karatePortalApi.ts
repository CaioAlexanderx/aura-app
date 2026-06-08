// ============================================================
// KARATE PORTAL API — Aura Karatê (Track D / Fase 3)
//
// Endpoints PÚBLICOS do Portal do Praticante (OTP) e da Inscrição pública.
// Contrato: docs/karate-fase3-openapi.yaml v0.3.3 (Aura-backend #162).
//
// Nenhum desses usa o JWT de empresa (auth store). O portal usa um token
// próprio (JWT type:'portal', 30 min) obtido via OTP e mantido em memória
// pela tela. Por isso usamos fetch direto (não o request() core).
// ============================================================

function apiBase(): string {
  return (
    (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
    "https://aura-backend-production-f805.up.railway.app/api/v1"
  );
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
  data?: any;
}

async function pub<T>(
  path: string,
  opts?: { method?: string; body?: any; token?: string; allowStatuses?: number[] }
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts?.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts?.token) headers["Authorization"] = `Bearer ${opts.token}`;
  const res = await fetch(`${apiBase()}${path}`, {
    method: opts?.method || "GET",
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* sem corpo */ }
  if (!res.ok && !(opts?.allowStatuses || []).includes(res.status)) {
    const e: ApiError = new Error(data?.error || `Erro ${res.status}`);
    e.status = res.status;
    e.code = data?.code;
    e.data = data;
    throw e;
  }
  return data as T;
}

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────
export interface OtpRequestResult {
  ok: boolean;
  message: string;
  channel_hint?: string | null;
}

export interface OtpVerifyResult {
  ok: boolean;
  token?: string;
  expires_in?: number;
  practitioner?: { id: string; name: string; karate_registration_number: string | null };
  error?: string;
}

export interface BeltHistoryItem {
  belt_level: string;
  belt_name: string;
  belt_schema: "legacy" | "fpkt_shotokan" | string;
  graduated_at: string;
  notes: string | null;
}
export interface PortalExam {
  target_belt: string | null;
  target_belt_name: string | null;
  status: string;
  event_date: string | null;
  location: string | null;
}
export interface PortalCertificate {
  target_belt: string | null;
  status: string;
  certificate_url: string | null;
  issued_at: string | null;
}
export interface PortalData {
  practitioner: {
    id: string;
    name: string;
    karate_registration_number: string | null;
    dojo_id: string | null;
    dojo_name: string | null;
    photo_url: string | null;
    current_belt: string | null;
    current_belt_name: string | null;
  };
  belt_history: BeltHistoryItem[];
  exams: PortalExam[];
  certificates: PortalCertificate[];
  card: {
    card_number: string | null;
    belt: string | null;
    belt_name: string | null;
    dojo_name: string | null;
    is_minor: boolean;
    verify_token: string;
    status: "active" | "revoked";
  } | null;
  public_portal: { opt_in: boolean; public_token: string | null };
}

export interface PublicProfile {
  federation: { name: string; logo: string | null };
  name: string;
  registration: string | null;
  dojo_name: string | null;
  current_belt_name: string | null;
  belt_path: Array<{ belt_name: string; year: number }>;
}

export interface PublicEvent {
  federation: { name: string; logo: string | null };
  event: {
    id: string;
    name: string;
    kind: "exam" | "course";
    type: string | null;
    event_date: string | null;
    location: string | null;
    fee_amount: number | null;
    capacity: { max: number | null; filled: number } | null;
  };
  requires: string[];
}

export interface LookupResult {
  found: boolean;
  already_enrolled: boolean;
  practitioner: { id: string; name: string; current_belt: string | null; current_belt_name: string | null };
  event: { id: string; name: string; kind: string; fee_amount: number | null; requires: string[] };
}

export interface InscricaoPayment {
  payment_intent_id?: string;
  payload?: string;
  qr_image?: string | null;
  expires_at?: string | null;
  provider?: string;
  amount?: number;
  error?: string;
}
export interface InscricaoResult {
  ok: boolean;
  inscription: { type: "exam" | "course"; id: string };
  practitioner: { id: string; name: string };
  fee_amount: number;
  payment: InscricaoPayment | null;
}

export interface AgendaEvent {
  id: string;
  name: string;
  kind: "exam" | "course";
  event_date: string | null;
  location: string | null;
  fee_amount: number | null;
}

const enc = encodeURIComponent;

// ─────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────
export const karatePortalApi = {
  // ── Login OTP ──
  requestOtp: (slug: string, cpf: string): Promise<OtpRequestResult> =>
    pub(`/public/karate/${enc(slug)}/portal/request-otp`, { method: "POST", body: { cpf } }),

  /** verify-otp devolve 401 {ok:false} em código inválido — tratamos sem throw. */
  verifyOtp: (slug: string, cpf: string, code: string): Promise<OtpVerifyResult> =>
    pub(`/public/karate/${enc(slug)}/portal/verify-otp`, {
      method: "POST",
      body: { cpf, code },
      allowStatuses: [401],
    }),

  // ── Portal autenticado (Bearer portal token) ──
  getPortal: (token: string): Promise<PortalData> =>
    pub(`/public/karate/portal/me`, { token }),

  setOptIn: (token: string, optIn: boolean): Promise<{ ok: boolean; opt_in: boolean; public_token: string | null }> =>
    pub(`/public/karate/portal/opt-in`, { method: "POST", body: { opt_in: optIn }, token }),

  // ── Perfil público reduzido ──
  getPublicProfile: (slug: string, publicToken: string): Promise<PublicProfile> =>
    pub(`/public/karate/${enc(slug)}/p/${enc(publicToken)}`),

  // ── Agenda pública (para o botão "Inscrever-me no próximo exame") ──
  getEvents: (slug: string): Promise<{ federation: { name: string; logo: string | null }; events: AgendaEvent[] }> =>
    pub(`/public/karate/${enc(slug)}/events`),

  // ── Inscrição ──
  getEvent: (slug: string, eventId: string): Promise<PublicEvent> =>
    pub(`/public/karate/${enc(slug)}/inscricao/${enc(eventId)}`),

  lookup: (slug: string, eventId: string, cpf: string): Promise<LookupResult> =>
    pub(`/public/karate/${enc(slug)}/inscricao/${enc(eventId)}/lookup`, { method: "POST", body: { cpf } }),

  submitInscricao: (slug: string, eventId: string, cpf: string): Promise<InscricaoResult> =>
    pub(`/public/karate/${enc(slug)}/inscricao/${enc(eventId)}`, { method: "POST", body: { cpf } }),
};
