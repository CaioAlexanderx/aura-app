// ============================================================
// KARATE PUBLIC PORTAL API — Aura Karatê
//
// Endpoints públicos para o portal redesenhado:
//   - POST /public/karate/:slug/lookup  → perfil + inscrições
//   - GET  /public/karate/:slug/banners → banners do hub
//
// Usa fetch direto (sem auth JWT de empresa), igual karatePortalApi.
// NÃO tocar em services/karateApi.ts (agente admin).
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
  opts?: { method?: string; body?: any }
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts?.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${apiBase()}${path}`, {
    method: opts?.method || "GET",
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* sem corpo */ }
  if (!res.ok) {
    const e: ApiError = new Error(data?.error || `Erro ${res.status}`);
    e.status = res.status;
    e.code = data?.code;
    e.data = data;
    throw e;
  }
  return data as T;
}

const enc = encodeURIComponent;

// ─────────────────────────────────────────────────────────────
// Tipos — Lookup
// ─────────────────────────────────────────────────────────────
/**
 * Uma inscrição do praticante (exame, campeonato ou curso), como retornada
 * por POST /:slug/lookup. `category_name` só é preenchido quando
 * kind==='competition' e o praticante escolheu uma categoria; caso
 * contrário vem null. `payment_status` também pode ser null quando o
 * evento é gratuito (sem cobrança associada).
 */
export interface LookupRegistration {
  kind: "exam" | "competition" | "course";
  event_id: string;
  event_name: string;
  category_name: string | null;
  status: string;
  payment_status: string | null;
  created_at: string;
}

export interface LookupPractitioner {
  id: string;
  name: string;
  registration: string | null;
  current_belt: string | null;
  current_belt_name: string | null;
}

export interface LookupResponse {
  federation: { name: string; logo: string | null };
  practitioner: LookupPractitioner;
  registrations: LookupRegistration[];
}

// ─────────────────────────────────────────────────────────────
// Tipos — Banners
// ─────────────────────────────────────────────────────────────
export type BannerFormat = "square" | "story" | "landscape";

export interface HubBanner {
  id: string;
  title: string;
  image_url: string;
  format: BannerFormat;
  event_id: string | null;
  placement: string;
  sort_order: number;
}

export interface BannersResponse {
  federation: { name: string; logo: string | null };
  banners: HubBanner[];
}

// ─────────────────────────────────────────────────────────────
// Tipos — Portal público do sensei (atualização de quadro por token)
//
// Consome GET/POST /public/roster-update/:token (karateRosterPortalPublic.js
// no backend). Token opaco de uso único — NÃO é o mesmo token de auth do
// usuário; nunca anexar Authorization aqui. 404 = token inválido,
// 410 = token existe mas expirou (ou já foi usado — vira 'validated' e
// token_expires_at é zerado no POST, então um novo GET some com 410).
// ─────────────────────────────────────────────────────────────
export interface RosterPractitioner {
  id: string;
  name: string;
  karate_registration_number: string | null;
  belt_name: string | null;
  is_active: boolean;
}

export interface RosterUpdateResponse {
  dojo_nome: string;
  status: string;
  praticantes: RosterPractitioner[];
}

export interface RosterUpdateInput {
  student_id: string;
  is_active: boolean;
}

export interface RosterSubmitResult {
  status: string;
  validated_at: string;
  validated_by: string | null;
  applied: { student_id: string; was_active: boolean }[];
  skipped: { student_id: string | null; reason: string }[];
}

/**
 * Input de POST /public/roster-update/:token/practitioner — novo
 * praticante cadastrado pelo sensei direto do portal. `name` e
 * `belt_level` são obrigatórios; o backend exige ainda pelo menos um
 * contato (`phone` OU `email`). dojo_id/federation_id NUNCA vão no
 * body — vêm sempre do token no backend.
 */
export interface AddPractitionerInput {
  name: string;
  phone?: string;
  email?: string;
  belt_level: string;
  belt_name: string;
}

/** Retorno de POST /public/roster-update/:token/practitioner. */
export interface AddPractitionerResult {
  id: string;
  name: string;
  karate_registration_number: string | null;
  belt_name: string | null;
  belt_level: string;
  is_active: true;
}

// ─────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────
export const karatePublicApi = {
  /**
   * Busca praticante por CPF, e-mail ou Número FPKT.
   * Lança ApiError com code='PRACTITIONER_NOT_FOUND' (404) se não achar.
   */
  lookup: (slug: string, identifier: string): Promise<LookupResponse> =>
    pub(`/public/karate/${enc(slug)}/lookup`, { method: "POST", body: { identifier } }),

  /**
   * Banners do hub público por placement.
   * Retorna lista vazia quando não há banners — nunca lança para esse caso.
   */
  getBanners: (slug: string, placement = "hub"): Promise<BannersResponse> =>
    pub(`/public/karate/${enc(slug)}/banners?placement=${enc(placement)}`),
  verifyCert: (token: string): Promise<any> =>
    pub(`/public/karate/verify/cert/${enc(token)}`),
  myCerts: (slug: string, cpf: string): Promise<{ federation: { name: string }; certificates: { verify_token: string; course_name: string | null; participant_name: string | null; issued_at: string }[] }> =>
    pub(`/public/karate/${enc(slug)}/meus-certificados`, { method: "POST", body: { cpf } }),

  /**
   * Portal público do sensei — atualização de quadro por token.
   * GET dados do dojô + praticantes. 404 = link inválido; 410 = link
   * expirado (ou já usado, já que o POST expira o token — uso único).
   */
  getPublicRoster: (token: string): Promise<RosterUpdateResponse> =>
    pub(`/public/roster-update/${enc(token)}`),

  /**
   * Aplica as alterações de is_active do quadro e expira o token (uso
   * único). `validatedBy` é opcional (nome de quem confirmou no dojô).
   */
  submitPublicRoster: (
    token: string,
    updates: RosterUpdateInput[],
    validatedBy?: string
  ): Promise<RosterSubmitResult> =>
    pub(`/public/roster-update/${enc(token)}`, {
      method: "POST",
      body: { updates, validated_by: validatedBy || undefined },
    }),

  /**
   * URL do CSV de export do quadro (nome, registro, faixa, situação).
   * Não faz fetch — é só a URL pronta pra <a href> / download direto,
   * já que o backend manda Content-Disposition: attachment.
   */
  getRosterExportUrl: (token: string): string =>
    `${apiBase()}/public/roster-update/${enc(token)}/export`,

  /**
   * Adiciona um novo praticante ao dojô do token, direto do portal do
   * sensei. NÃO expira o token — o sensei pode adicionar vários e só
   * confirmar o quadro depois (submitPublicRoster). 422 = validação
   * (nome/faixa/contato faltando); 404/410 = link inválido/expirado.
   */
  addPublicPractitioner: (
    token: string,
    input: AddPractitionerInput
  ): Promise<AddPractitionerResult> =>
    pub(`/public/roster-update/${enc(token)}/practitioner`, {
      method: "POST",
      body: input,
    }),
};
