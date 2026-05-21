// ─── useLeadsList ─────────────────────────────────────────────────────────────
// Gerencia estado dos filtros + query da lista de leads + meta + stats.
// Retorna API estavel pro view (LeadsListView / KanbanView).
// ============================================================================

import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { crmApi, type LeadStats, type Lead, type LeadPipeline, type LeadStatus } from "@/services/crmApi";
import { DEFAULT_FILTERS, type LeadListFilters } from "../shared/types";

export function useLeadsList(viewIsActive = true) {
  const { token, isStaff } = useAuthStore();
  const enabled = !!token && (isStaff ?? false) && viewIsActive;

  const [filters, setFilters] = useState<LeadListFilters>(DEFAULT_FILTERS);

  const queryFilters = useMemo(() => ({
    status:        filters.status        || undefined,
    city:          filters.city          || undefined,
    category:      filters.category      || undefined,
    has_phone:     filters.has_phone     || undefined,
    min_rating:    filters.min_rating ? Number(filters.min_rating) : undefined,
    followup_due:  filters.followup_due  || undefined,
    no_contact:    filters.no_contact    || undefined,
    search:        filters.search        || undefined,
    min_score:     filters.min_score ? Number(filters.min_score) : undefined,
    expected_plan: filters.expected_plan || undefined,
    is_rotten:     filters.is_rotten === "" ? undefined : filters.is_rotten === "true",
    // Fase 5 (21/05/2026)
    status_in:     filters.status_in     || undefined,
    status_not_in: filters.status_not_in || undefined,
    stale_days:    filters.stale_days ? Number(filters.stale_days) : undefined,
    recent_hours:  filters.recent_hours ? Number(filters.recent_hours) : undefined,
  }), [filters]);

  const queryKey = useMemo(() => ["admin-leads", queryFilters], [queryFilters]);

  const leadsQuery = useQuery<{ total: number; pipeline: LeadPipeline; leads: Lead[] }>({
    queryKey,
    queryFn: () => crmApi.leads.list(queryFilters),
    enabled,
    staleTime: 30_000,
  });

  const metaQuery = useQuery({
    queryKey: ["admin-leads-meta"],
    queryFn:  () => crmApi.leads.meta(),
    enabled,
    staleTime: 120_000,
  });

  const statsQuery = useQuery<LeadStats>({
    queryKey: ["admin-leads-stats"],
    queryFn:  () => crmApi.leads.stats(),
    enabled,
    staleTime: 60_000,
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  const setFilter = useCallback(<K extends keyof LeadListFilters>(key: K, value: LeadListFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const toggleStatusFilter = useCallback((status: LeadStatus) => {
    setFilters((prev) => ({ ...prev, status: prev.status === status ? "" : status }));
  }, []);

  // Numero de filtros ativos (sem contar search) — usado pra badge no botao
  const activeFilterCount = useMemo(() => {
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
  }, [filters]);

  // Leads agrupados por status (pro Kanban)
  const leadsByStatus = useMemo(() => {
    const out: Record<string, Lead[]> = {};
    (leadsQuery.data?.leads || []).forEach((l) => {
      if (!out[l.status]) out[l.status] = [];
      out[l.status].push(l);
    });
    return out;
  }, [leadsQuery.data?.leads]);

  return {
    // Data
    leads:    leadsQuery.data?.leads || [],
    pipeline: leadsQuery.data?.pipeline,
    meta:     metaQuery.data,
    stats:    statsQuery.data,
    leadsByStatus,

    // Loading
    isLoading:        leadsQuery.isLoading,
    isFetching:       leadsQuery.isFetching,
    isLoadingMeta:    metaQuery.isLoading,
    isLoadingStats:   statsQuery.isLoading,

    // Filtros
    filters,
    setFilter,
    setFilters,
    clearFilters,
    toggleStatusFilter,
    activeFilterCount,

    // Refetch
    refetch: leadsQuery.refetch,

    // Query keys (pra invalidate em mutations)
    queryKey,
  };
}
