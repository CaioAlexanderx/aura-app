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

// Bloco A — formulário de inscrição configurável por evento (migration 200).
// Espelha o tipo equivalente em services/karateApi.ts (lado admin).
export type RegistrationFieldType = "text" | "number" | "select" | "checkbox" | "date" | "phone";

export interface RegistrationField {
  key: string;
  label: string;
  type: RegistrationFieldType;
  required: boolean;
  options?: string[];
}

// Track E / P0-0.4 — categoria de campeonato, usada na etapa de inscrição
// pública quando o evento é kind==='competition' (em vez de
// registration_fields, o praticante escolhe uma destas).
export interface CompetitionCategory {
  id: string;
  name: string;
  modality: "kata" | "kumite" | "kihon_ippon" | "team_kata" | "team_kumite";
  min_age: number | null;
  max_age: number | null;
  belt_min: string | null;
  belt_max: string | null;
  sex: "M" | "F" | "mixed";
  weight_class: string | null;
  max_entries: number | null;
  fee_amount: number | null;
  entry_count: number;
}

export interface PublicEvent {
  federation: { name: string; logo: string | null };
  event: {
    id: string;
    name: string;
    kind: "exam" | "course" | "competition";
    type: string | null;
    event_date: string | null;
    location: string | null;
    fee_amount: number | null;
    /** Menor preço positivo entre o evento e suas categorias — usado quando `fee_amount` é null/0 mas há categorias pagas (competição) ou o preço "a partir de" faz mais sentido. */
    from_price: number | null;
    capacity: { max: number | null; filled: number } | null;
    /** Bloco A — campos extras do formulário de inscrição (migration 200). Vazio = sem campos extras. */
    registration_fields: RegistrationField[];
    /** Track E / P0-0.4 — só presente quando kind==='competition'. */
    categories?: CompetitionCategory[];
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
  inscription: { type: "exam" | "course" | "competition"; id: string; category_id?: string; category_name?: string };
  practitioner: { id: string; name: string };
  fee_amount: number;
  payment: InscricaoPayment | null;
}

/**
 * Corpo do 422 quando faltam campos obrigatórios do formulário de inscrição
 * (registration_fields). `missingFields` traz os LABELS dos campos faltantes
 * (o backend já resolve key -> label antes de responder).
 */
export interface MissingFieldsError {
  error: string;
  code: "VALIDATION_ERROR";
  missingFields: string[];
}

export interface AgendaEvent {
  id: string;
  name: string;
  kind: "exam" | "course";
  event_date: string | null;
  location: string | null;
  fee_amount: number | null;
}

/**
 * Bloco B — eventos ABERTOS para o hub público. UNION de karate_belt_exams
 * (status='open', kind='exam') com karate_competitions (status='open',
 * kind='competition') — Track E / P0-0.4. exam_type é sempre null para
 * campeonato (competição não tem essa coluna).
 */
export interface OpenEvent {
  id: string;
  name: string;
  exam_type: string | null;
  event_date: string | null;
  location: string | null;
  fee_amount: number | null;
  /** Menor preço positivo entre o evento e suas categorias. */
  from_price: number | null;
  kind: "exam" | "competition";
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

  // ── Bloco B — eventos ABERTOS (karate_belt_exams status='open') para os
  // cards do hub público e o seletor de evento do admin de banners. ──
  getOpenEvents: (slug: string): Promise<{ federation: { name: string; logo: string | null }; events: OpenEvent[] }> =>
    pub(`/public/karate/${enc(slug)}/eventos`),

  // ── Inscrição ──
  getEvent: (slug: string, eventId: string): Promise<PublicEvent> =>
    pub(`/public/karate/${enc(slug)}/inscricao/${enc(eventId)}`),

  /**
   * `identifier` aceita CPF, e-mail ou nº de registro FPKT (contrato novo do
   * backend). Mantemos `cpf` no corpo por compatibilidade (backend antigo
   * ainda lê esse campo), mas o valor enviado em ambos é o mesmo — quem
   * chama não precisa mais validar formato de CPF.
   * `categoryId` é obrigatório quando o evento é kind==='competition' (Track E / P0-0.4).
   */
  lookup: (slug: string, eventId: string, identifier: string, categoryId?: string): Promise<LookupResult> =>
    pub(`/public/karate/${enc(slug)}/inscricao/${enc(eventId)}/lookup`, {
      method: "POST",
      body: { identifier, cpf: identifier, ...(categoryId ? { category_id: categoryId } : {}) },
    }),

  /**
   * `identifier` aceita CPF, e-mail ou nº de registro FPKT (mesmo contrato do
   * `lookup` acima). `responses` é opcional — só é exigido quando o evento tem
   * registration_fields obrigatórios (exame/curso). `categoryId` é obrigatório
   * quando kind==='competition' (Track E / P0-0.4) — o praticante escolhe a
   * categoria em vez de preencher formulário.
   */
  submitInscricao: (
    slug: string,
    eventId: string,
    identifier: string,
    responses?: Record<string, unknown>,
    categoryId?: string
  ): Promise<InscricaoResult> =>
    pub(`/public/karate/${enc(slug)}/inscricao/${enc(eventId)}`, {
      method: "POST",
      body: { identifier, cpf: identifier, ...(responses ? { responses } : {}), ...(categoryId ? { category_id: categoryId } : {}) },
    }),
};
