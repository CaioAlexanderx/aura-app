// ============================================================
// KARATE COMPETITIONS API — Aura Karatê (Track E / Fase 4)
//
// Competições + Categorias + Inscrições + Resultados + Ranking.
// Contrato: docs/karate-fase4-openapi.yaml v0.4.0 (Aura-backend #169).
//
// Mantido SEPARADO de services/karateApi.ts (mesmo critério do Track D):
// rotas autenticadas usam o request() core (Bearer JWT); o ranking PÚBLICO
// embeddável usa fetch direto (sem auth), igual karateCardApi.verifyCard.
// ============================================================
import { request } from "@/services/api";

export type CompetitionStatus = "draft" | "open" | "closed" | "done" | "cancelled";
export type Modality = "kata" | "kumite" | "kihon_ippon" | "team_kata" | "team_kumite";
export type Sex = "M" | "F" | "mixed";
export type EntryStatus = "registered" | "confirmed" | "checked_in" | "competing" | "done" | "withdrawn";

export interface Competition {
  id: string;
  federation_id: string;
  name: string;
  season: number;
  event_date: string | null;
  location: string | null;
  circuit_round: number | null;
  fee_amount: number;
  status: CompetitionStatus;
  category_count: number;
  entry_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  id: string;
  competition_id: string;
  name: string;
  modality: Modality;
  min_age: number | null;
  max_age: number | null;
  belt_min: string | null;
  belt_max: string | null;
  sex: Sex;
  weight_class: string | null;
  max_entries: number | null;
  fee_amount: number | null;
  entry_count?: number;
}

export interface CompetitionDetail extends Competition {
  categories: Category[];
}

export interface CategoryFitCheck {
  criterion: "age" | "belt" | "sex";
  ok: boolean;
  required: any;
  actual: any;
  unit: string | null;
}
export interface CategoryFit {
  fits: boolean;
  is_hard_block: boolean; // sempre false (FPKT)
  checks: CategoryFitCheck[];
  warnings: string[];
}

export interface Entry {
  id: string;
  category_id: string;
  category_name?: string;
  modality?: Modality;
  student_id: string;
  student_name: string;
  karate_registration_number: string | null;
  current_belt: string | null;
  current_belt_name: string | null;
  dojo_id: string | null;
  dojo_name: string | null;
  status: EntryStatus;
  fee_paid: boolean;
  placement: number | null;
  points_awarded: number;
  result_notes: string | null;
  created_at?: string;
}

export interface EnrollResult {
  id: string;
  competition_id: string;
  category_id: string;
  student_id: string;
  student_name: string;
  dojo_id: string | null;
  status: EntryStatus;
  created_at: string;
  capacity: { max: number; filled: number } | null;
  category_fit: CategoryFit;
}

export interface RankingRow {
  category: string;
  student_id: string;
  student_name: string;
  karate_registration_number: string | null;
  dojo_id?: string | null;
  dojo_name: string | null;
  total_points: number;
  gold: number;
  silver: number;
  bronze: number;
  events_participated: number;
}
export interface SeasonRanking {
  season: number;
  category: string | null;
  ranking: RankingRow[];
}

export interface TournamentRankingCategory {
  category_id: string;
  category_name: string;
  modality: Modality;
  results: Array<{
    student_id: string;
    student_name: string;
    dojo_name: string | null;
    placement: number | null;
    points_awarded: number;
  }>;
}
export interface TournamentRanking {
  competition_id: string;
  season: number;
  categories: TournamentRankingCategory[];
}

export interface PublicRanking {
  federation: { name: string; logo: string | null };
  season: number;
  category: string | null;
  ranking: RankingRow[];
}
export interface PublicSeasons {
  federation: { name: string; logo: string | null };
  seasons: Array<{ season: number; categories: string[] }>;
}

interface Paginated<T> {
  page: number;
  page_size: number;
  total: number;
  data: T[];
}

function apiBase(): string {
  return (
    (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
    "https://aura-backend-production-f805.up.railway.app/api/v1"
  );
}

export const karateCompetitionsApi = {
  // ── Competições ─────────────────────────────────────────
  listCompetitions: (
    federationId: string,
    params?: { status?: CompetitionStatus; season?: number; page?: number; pageSize?: number }
  ): Promise<Paginated<Competition>> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.season) qs.set("season", String(params.season));
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/competitions${query}`);
  },

  createCompetition: (
    federationId: string,
    body: {
      name: string; season?: number; event_date?: string | null;
      location?: string | null; circuit_round?: number | null; fee_amount?: number;
    }
  ): Promise<Competition> =>
    request(`/federation/${federationId}/competitions`, { method: "POST", body }),

  getCompetition: (federationId: string, cid: string): Promise<CompetitionDetail> =>
    request(`/federation/${federationId}/competitions/${cid}`),

  patchCompetition: (federationId: string, cid: string, body: Record<string, any>): Promise<Competition> =>
    request(`/federation/${federationId}/competitions/${cid}`, { method: "PATCH", body }),

  closeCompetition: (federationId: string, cid: string): Promise<{ id: string; status: CompetitionStatus }> =>
    request(`/federation/${federationId}/competitions/${cid}/close`, { method: "POST", body: {} }),

  // ── Categorias ──────────────────────────────────────────
  listCategories: (federationId: string, cid: string): Promise<Category[]> =>
    request(`/federation/${federationId}/competitions/${cid}/categories`),

  createCategory: (
    federationId: string,
    cid: string,
    body: {
      name: string; modality: Modality; min_age?: number | null; max_age?: number | null;
      belt_min?: string | null; belt_max?: string | null; sex?: Sex;
      weight_class?: string | null; max_entries?: number | null; fee_amount?: number | null;
    }
  ): Promise<Category> =>
    request(`/federation/${federationId}/competitions/${cid}/categories`, { method: "POST", body }),

  // ── Inscrições / Resultados ─────────────────────────────
  listEntries: (federationId: string, cid: string, categoryId?: string): Promise<Entry[]> => {
    const query = categoryId ? `?category_id=${encodeURIComponent(categoryId)}` : "";
    return request(`/federation/${federationId}/competitions/${cid}/entries${query}`);
  },

  enroll: (
    federationId: string, cid: string, body: { student_id: string; category_id: string }
  ): Promise<EnrollResult> =>
    request(`/federation/${federationId}/competitions/${cid}/entries`, { method: "POST", body }),

  patchEntry: (
    federationId: string, cid: string, entryId: string,
    body: { placement?: number | null; points_awarded?: number; status?: EntryStatus; result_notes?: string | null }
  ): Promise<Entry> =>
    request(`/federation/${federationId}/competitions/${cid}/entries/${entryId}`, { method: "PATCH", body }),

  // ── Ranking ─────────────────────────────────────────────
  getTournamentRanking: (federationId: string, cid: string): Promise<TournamentRanking> =>
    request(`/federation/${federationId}/competitions/${cid}/ranking`),

  getSeasonRanking: (
    federationId: string, params?: { season?: number; category?: string }
  ): Promise<SeasonRanking> => {
    const qs = new URLSearchParams();
    if (params?.season) qs.set("season", String(params.season));
    if (params?.category) qs.set("category", params.category);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/rankings${query}`);
  },

  // ── Público (sem auth) ──────────────────────────────────
  getPublicSeasons: async (slug: string): Promise<PublicSeasons | null> => {
    const res = await fetch(`${apiBase()}/public/karate/${encodeURIComponent(slug)}/seasons`,
      { headers: { Accept: "application/json" } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Falha ao carregar temporadas (${res.status})`);
    return res.json();
  },

  getPublicRanking: async (
    slug: string, params?: { season?: number; category?: string }
  ): Promise<PublicRanking | null> => {
    const qs = new URLSearchParams();
    if (params?.season) qs.set("season", String(params.season));
    if (params?.category) qs.set("category", params.category);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    const res = await fetch(`${apiBase()}/public/karate/${encodeURIComponent(slug)}/ranking${query}`,
      { headers: { Accept: "application/json" } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Falha ao carregar ranking (${res.status})`);
    return res.json();
  },
};
