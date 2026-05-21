// ─── CRM Comercial — Tipos locais do modulo ──────────────────────────────────
// Tipos compartilhados pelos views/components do CRM admin que NAO pertencem
// ao contrato da API (esses ficam em services/crmApi.ts).

import type { LeadStatus, LeadChannel, ExpectedPlan, Lead } from "@/services/crmApi";

// ── Modo de visualizacao ─────────────────────────────────────────────────────

export type ViewMode = "fila" | "lista" | "kanban" | "pipeline" | "importar" | "metas";

// ── Filtros (state local sincronizado com URL query string) ──────────────────

export type LeadListFilters = {
  search: string;
  status: LeadStatus | "";
  city: string;
  category: string;
  has_phone: boolean;
  min_rating: string;          // "" | "3" | "3.5" | "4" | "4.5"
  followup_due: boolean;
  no_contact: boolean;
  // Fase 1 (21/05/2026)
  min_score: string;           // "" | "30" | "50"
  expected_plan: ExpectedPlan | "";
  is_rotten: "" | "true" | "false";
  // Fase 5 (21/05/2026)
  status_in: string;           // CSV "new,contacted,responded"
  status_not_in: string;       // CSV "converted,lost"
  stale_days: string;          // "" | "3" | "7" | "14"
  recent_hours: string;        // "" | "24" | "48"
};

export const DEFAULT_FILTERS: LeadListFilters = {
  search: "",
  status: "",
  city: "",
  category: "",
  has_phone: false,
  min_rating: "",
  followup_due: false,
  no_contact: false,
  min_score: "",
  expected_plan: "",
  is_rotten: "",
  status_in: "",
  status_not_in: "",
  stale_days: "",
  recent_hours: "",
};

// ── Selecao em lote (BatchActionBar) ─────────────────────────────────────────

export type BatchSelection = {
  ids: Set<string>;
  // Opcional: leads materializados pra mostrar contagem por status na barra
  leads?: Lead[];
};

// ── Estado do modal de interacao ─────────────────────────────────────────────

export type InteractionDraft = {
  body: string;
  channel: LeadChannel;
  new_status: LeadStatus | "";
  next_followup_at: string;   // "YYYY-MM-DD"
  advance_cadence: boolean;
};

export const DEFAULT_INTERACTION_DRAFT: InteractionDraft = {
  body: "",
  channel: "whatsapp",
  new_status: "",
  next_followup_at: "",
  advance_cadence: false,
};

// ── Importacao Excel ─────────────────────────────────────────────────────────

export type ImportStats = { inserted: number; skipped: number };

// ── Kanban DnD ───────────────────────────────────────────────────────────────

export type KanbanDragState = {
  draggingId: string | null;
  draggingStatus: LeadStatus | null;
  hoverStatus: LeadStatus | null;
};

// ── Saved Views helper ──────────────────────────────────────────────────────

// Converte a estrutura armazenada (jsonb com chaves do API) pra LeadListFilters
// do state local (com defaults pra campos faltantes).
export function viewFiltersToLocal(viewFilters: Record<string, any> | undefined | null): LeadListFilters {
  const f = viewFilters || {};
  return {
    ...DEFAULT_FILTERS,
    search:        String(f.search ?? ""),
    status:        (f.status ?? "") as LeadListFilters["status"],
    city:          String(f.city ?? ""),
    category:      String(f.category ?? ""),
    has_phone:     Boolean(f.has_phone),
    min_rating:    f.min_rating != null ? String(f.min_rating) : "",
    followup_due:  Boolean(f.followup_due),
    no_contact:    Boolean(f.no_contact),
    min_score:     f.min_score != null ? String(f.min_score) : "",
    expected_plan: (f.expected_plan ?? "") as LeadListFilters["expected_plan"],
    is_rotten:     f.is_rotten === true ? "true" : f.is_rotten === false ? "false" : "",
    status_in:     String(f.status_in ?? ""),
    status_not_in: String(f.status_not_in ?? ""),
    stale_days:    f.stale_days != null ? String(f.stale_days) : "",
    recent_hours:  f.recent_hours != null ? String(f.recent_hours) : "",
  };
}

// Converte LeadListFilters (state) pra payload jsonb que vai pro DB.
// Remove campos vazios/falsy pra nao poluir o JSON.
export function localToViewFilters(filters: LeadListFilters): Record<string, any> {
  const out: Record<string, any> = {};
  if (filters.search)        out.search        = filters.search;
  if (filters.status)        out.status        = filters.status;
  if (filters.city)          out.city          = filters.city;
  if (filters.category)      out.category      = filters.category;
  if (filters.has_phone)     out.has_phone     = true;
  if (filters.min_rating)    out.min_rating    = Number(filters.min_rating);
  if (filters.followup_due)  out.followup_due  = true;
  if (filters.no_contact)    out.no_contact    = true;
  if (filters.min_score)     out.min_score     = Number(filters.min_score);
  if (filters.expected_plan) out.expected_plan = filters.expected_plan;
  if (filters.is_rotten)     out.is_rotten     = filters.is_rotten === "true";
  if (filters.status_in)     out.status_in     = filters.status_in;
  if (filters.status_not_in) out.status_not_in = filters.status_not_in;
  if (filters.stale_days)    out.stale_days    = Number(filters.stale_days);
  if (filters.recent_hours)  out.recent_hours  = Number(filters.recent_hours);
  return out;
}
