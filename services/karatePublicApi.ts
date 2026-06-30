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
export interface LookupEnrollment {
  id: string;
  name: string;
  kind: string;
  event_date: string | null;
  location: string | null;
  status: string;
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
  active_enrollments: LookupEnrollment[];
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
};
