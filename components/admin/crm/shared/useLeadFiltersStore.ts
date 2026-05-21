// ─── useLeadFiltersStore ─────────────────────────────────────────────────────
// Store Zustand GLOBAL de filtros do CRM. Compartilhado entre Fila, Lista e
// Kanban — Caio aplica um filtro e ele vale nas 3 views simultaneamente.
//
// Razao de ser global (e nao local em useLeadsList):
//   Antes os filtros viviam em useLeadsList. Fila e Kanban nao conseguiam
//   filtrar por cidade pra direcionar visitas presenciais. Agora as 3 views
//   leem desse store, a barra de filtros aparece em todas, e Saved Views
//   tambem aplicam aqui.
// ============================================================================

import { create } from "zustand";
import { DEFAULT_FILTERS, type LeadListFilters } from "./types";

type State = {
  filters: LeadListFilters;
};

type Actions = {
  setFilter: <K extends keyof LeadListFilters>(key: K, value: LeadListFilters[K]) => void;
  setFilters: (filters: LeadListFilters) => void;
  patchFilters: (patch: Partial<LeadListFilters>) => void;
  clearFilters: () => void;
  toggleStatusFilter: (status: LeadListFilters["status"]) => void;
};

export const useLeadFiltersStore = create<State & Actions>((set, get) => ({
  filters: DEFAULT_FILTERS,

  setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),

  setFilters: (filters) => set({ filters }),

  patchFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),

  clearFilters: () => set({ filters: DEFAULT_FILTERS }),

  toggleStatusFilter: (status) => set((s) => ({
    filters: { ...s.filters, status: s.filters.status === status ? "" : status as any },
  })),
}));

// ── Selector de contagem de filtros ativos (sem contar search) ─────────────
export function countActiveFilters(filters: LeadListFilters): number {
  let n = 0;
  if (filters.status)        n++;
  if (filters.city)          n++;
  if (filters.category)      n++;
  if (filters.has_phone)     n++;
  if (filters.min_rating)    n++;
  if (filters.followup_due)  n++;
  if (filters.no_contact)    n++;
  if (filters.min_score)     n++;
  if (filters.expected_plan) n++;
  if (filters.is_rotten)     n++;
  if (filters.status_in)     n++;
  if (filters.status_not_in) n++;
  if (filters.stale_days)    n++;
  if (filters.recent_hours)  n++;
  return n;
}

// ── Converte filters do state pra query params do backend ──────────────────
// Reusada em useLeadsList e useLeadQueue.
export function filtersToQuery(f: LeadListFilters): Record<string, any> {
  return {
    status:        f.status        || undefined,
    city:          f.city          || undefined,
    category:      f.category      || undefined,
    has_phone:     f.has_phone     || undefined,
    min_rating:    f.min_rating ? Number(f.min_rating) : undefined,
    followup_due:  f.followup_due  || undefined,
    no_contact:    f.no_contact    || undefined,
    search:        f.search        || undefined,
    min_score:     f.min_score ? Number(f.min_score) : undefined,
    expected_plan: f.expected_plan || undefined,
    is_rotten:     f.is_rotten === "" ? undefined : f.is_rotten === "true",
    status_in:     f.status_in     || undefined,
    status_not_in: f.status_not_in || undefined,
    stale_days:    f.stale_days ? Number(f.stale_days) : undefined,
    recent_hours:  f.recent_hours ? Number(f.recent_hours) : undefined,
  };
}
