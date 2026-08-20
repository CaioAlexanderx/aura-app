// ============================================================
// AURA KARATÊ — P0 Hub de Campeonatos: SETUP + FILA DE CONFERÊNCIA
// (cliente da FEDERAÇÃO) e páginas PÚBLICAS do campeonato.
//
// Backend: src/routes/karateCompetitionSetup.js (divisões, pricing,
// publicações, delegações) e karateCompetitionsPublic.js (conferência e
// chaves públicas) — migration 294, já em produção.
//
// Service próprio e pequeno (regra da casa). Reusa tipos do cliente da
// delegação do dojô onde o shape é o mesmo (quote/pedido).
// ============================================================
import { request } from "@/services/api";
import type {
  DelegationQuote, OrderStatus, PaymentMode,
} from "@/services/karateDelegationsApi";

const apiBase = () =>
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "https://aura-backend-production-f805.up.railway.app/api/v1";

// ── Tipos ───────────────────────────────────────────────────

export interface CompetitionDivision {
  id: string;
  name: string;
  sort_order: number;
  rules: {
    max_individual_per_dojo_per_category?: number | null;
    max_teams_per_dojo_per_category?: number | null;
    notes?: string | null;
  };
  category_count: number;
}

export interface PricingBand { max_age?: number | null; amount: number }
export interface PricingConfig {
  individual?: { mode?: "per_athlete" | "per_entry"; bands: PricingBand[] };
  team?: { per_prova?: number | null; bundle_both?: number | null };
  exemptions?: { officials_per_exemption?: number | null; max_exemptions?: number | null };
}

export interface FedDelegationSummary {
  id: string;
  dojo_id: string;
  dojo_name: string | null;
  status: OrderStatus;
  payment_mode: PaymentMode;
  total_amount: number;
  officials_count: number;
  receipt_url: string | null;
  created_at: string;
  confirmed_at: string | null;
  entry_count: number;
}

export interface FedDelegationDetail {
  id: string;
  dojo: { id: string; name: string | null };
  status: OrderStatus;
  payment_mode: PaymentMode;
  total_amount: number;
  officials_count: number;
  quote: DelegationQuote | Record<string, never>;
  receipt_url: string | null;
  receipt_uploaded_at: string | null;
  created_at: string;
  confirmed_at: string | null;
  confirmed_by_name: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  entries: {
    id: string; category_id: string; category_name: string; status: string; fee_paid: boolean;
    student_id: string | null; student_name: string | null;
    team_id: string | null; team_name: string | null;
  }[];
}

// ── Cliente (federação, autenticado) ────────────────────────

const fed = (fid: string, cid: string) => `/federation/${fid}/competitions/${cid}`;

export const karateCompetitionSetupApi = {
  listDivisions: (fid: string, cid: string): Promise<CompetitionDivision[]> =>
    request(`${fed(fid, cid)}/divisions`),

  createDivision: (fid: string, cid: string, body: { name: string; sort_order?: number; rules?: CompetitionDivision["rules"] }): Promise<CompetitionDivision> =>
    request(`${fed(fid, cid)}/divisions`, { method: "POST", body }),

  updateDivision: (fid: string, cid: string, divId: string, patch: Partial<{ name: string; sort_order: number; rules: CompetitionDivision["rules"] }>): Promise<CompetitionDivision> =>
    request(`${fed(fid, cid)}/divisions/${divId}`, { method: "PATCH", body: patch }),

  deleteDivision: (fid: string, cid: string, divId: string): Promise<{ deleted: boolean }> =>
    request(`${fed(fid, cid)}/divisions/${divId}`, { method: "DELETE" }),

  updatePricing: (fid: string, cid: string, body: { pricing_config?: PricingConfig; rectification_deadline?: string | null }): Promise<{ id: string; pricing_config: PricingConfig; rectification_deadline: string | null }> =>
    request(`${fed(fid, cid)}/pricing`, { method: "PATCH", body }),

  listDelegations: (fid: string, cid: string, status?: OrderStatus): Promise<FedDelegationSummary[]> =>
    request(`${fed(fid, cid)}/delegations${status ? `?status=${status}` : ""}`),

  getDelegation: (fid: string, cid: string, orderId: string): Promise<{ order: FedDelegationDetail }> =>
    request(`${fed(fid, cid)}/delegations/${orderId}`),

  /** Confirma a conferência: pedido 'paid' + cascata fee_paid. Mutação — sem retry. */
  confirmDelegation: (fid: string, cid: string, orderId: string): Promise<{ id: string; status: "paid"; entries_marked_paid: number }> =>
    request(`${fed(fid, cid)}/delegations/${orderId}/confirm`, { method: "POST", body: {}, retry: 0 }),

  rejectDelegation: (fid: string, cid: string, orderId: string, reason?: string): Promise<{ id: string; status: "cancelled"; entries_withdrawn: number }> =>
    request(`${fed(fid, cid)}/delegations/${orderId}/reject`, { method: "POST", body: { reason }, retry: 0 }),

  publishConference: (fid: string, cid: string, published: boolean): Promise<{ id: string; conference_published_at: string | null }> =>
    request(`${fed(fid, cid)}/publish-conference`, { method: "POST", body: { published }, retry: 0 }),

  publishBrackets: (fid: string, cid: string, published: boolean): Promise<{ id: string; brackets_published_at: string | null }> =>
    request(`${fed(fid, cid)}/publish-brackets`, { method: "POST", body: { published }, retry: 0 }),
};

// ── Cliente PÚBLICO (sem auth — fetch direto, 404 → null) ───

export interface PublicCompetitionHeader {
  federation: { name: string; logo: string | null };
  competition: {
    id: string; name: string; season: number | null; event_date: string | null;
    location: string | null; status: string;
    conference_published: boolean; brackets_published: boolean;
    rectification_deadline: string | null;
  };
}

export interface PublicConferenceCategory {
  category_id: string;
  category_name: string;
  modality: string;
  sex: string;
  group_label: string | null;
  division_name: string | null;
  entries: {
    name: string; dojo_name: string | null; belt_name: string | null;
    is_team: boolean; team_members?: { name: string; role: string }[];
  }[];
}

export interface PublicConference {
  federation: { name: string; logo: string | null };
  competition: { id: string; name: string; event_date: string | null };
  published_at: string;
  rectification_deadline: string | null;
  categories: PublicConferenceCategory[];
  total_entries: number;
}

export interface PublicBracketIndexCategory {
  category_id: string;
  category_name: string;
  modality: string;
  group_label: string | null;
  division_name: string | null;
  entry_count: number;
  bracket_status: "not_generated" | "draft" | "locked";
}

export interface PublicBracketSide { entry_id: string; name: string | null; dojo_name: string | null }
export interface PublicBracketMatch {
  id: string;
  aka: PublicBracketSide | "bye" | null;
  shiro: PublicBracketSide | "bye" | null;
  winner_entry_id: string | null;
  aka_score: number | null;
  shiro_score: number | null;
}

export interface PublicCategoryBracket {
  category: { id: string; name: string; modality: string };
  status: "not_generated" | "draft" | "locked";
  rounds?: PublicBracketMatch[][];
  third_place_match?: PublicBracketMatch | null;
  champion?: PublicBracketSide | null;
  kata_scores?: {
    name: string; dojo_name: string | null; phase: "eliminatoria" | "final";
    nota: number | null; presentation_order: number | null; advances: boolean | null;
  }[];
}

async function publicGet<T>(path: string): Promise<T | null> {
  const res = await fetch(`${apiBase()}/public/karate${path}`, { headers: { Accept: "application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Falha ao carregar (${res.status})`);
  return res.json();
}

export const karateCompetitionPublicApi = {
  getHeader: (slug: string, cid: string) =>
    publicGet<PublicCompetitionHeader>(`/${encodeURIComponent(slug)}/competitions/${cid}`),
  getConference: (slug: string, cid: string) =>
    publicGet<PublicConference>(`/${encodeURIComponent(slug)}/competitions/${cid}/conference`),
  getBracketsIndex: (slug: string, cid: string) =>
    publicGet<{ categories: PublicBracketIndexCategory[]; published_at: string }>(`/${encodeURIComponent(slug)}/competitions/${cid}/brackets`),
  getCategoryBracket: (slug: string, cid: string, catId: string) =>
    publicGet<PublicCategoryBracket>(`/${encodeURIComponent(slug)}/competitions/${cid}/categories/${catId}/bracket`),
};
