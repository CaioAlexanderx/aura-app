// ─── useLeadsList ─────────────────────────────────────────────────────────────
// Le filtros do store global (useLeadFiltersStore). Mantem API estavel pra
// nao quebrar callers — apenas o STATE migrou de local pra global.
// ============================================================================

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { crmApi, type LeadStats, type Lead, type LeadPipeline, type LeadStatus } from "@/services/crmApi";
import { useLeadFiltersStore, countActiveFilters, filtersToQuery } from "../shared/useLeadFiltersStore";

export function useLeadsList(viewIsActive = true) {
  const { token, isStaff } = useAuthStore();
  const enabled = !!token && (isStaff ?? false) && viewIsActive;

  // Filtros vem do store GLOBAL agora — compartilhado entre Fila/Lista/Kanban.
  const filters            = useLeadFiltersStore((s) => s.filters);
  const setFilter          = useLeadFiltersStore((s) => s.setFilter);
  const setFilters         = useLeadFiltersStore((s) => s.setFilters);
  const clearFilters       = useLeadFiltersStore((s) => s.clearFilters);
  const toggleStatusFilter = useLeadFiltersStore((s) => s.toggleStatusFilter);

  const queryFilters = useMemo(() => filtersToQuery(filters), [filters]);
  const queryKey = useMemo(() => ["admin-leads", queryFilters], [queryFilters]);

  const leadsQuery = useQuery<{
    total: number;
    pipeline: LeadPipeline;
    pipeline_filtered?: LeadPipeline;
    leads: Lead[];
  }>({
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

  // Filter count derivado do store
  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

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
    leads:             leadsQuery.data?.leads || [],
    pipeline:          leadsQuery.data?.pipeline,
    pipelineFiltered:  leadsQuery.data?.pipeline_filtered,
    meta:              metaQuery.data,
    stats:             statsQuery.data,
    leadsByStatus,

    // Loading
    isLoading:        leadsQuery.isLoading,
    isFetching:       leadsQuery.isFetching,
    isLoadingMeta:    metaQuery.isLoading,
    isLoadingStats:   statsQuery.isLoading,

    // Filtros (proxied do store global)
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
