// ─── useLeadQueue ────────────────────────────────────────────────────────────
// Fila do dia priorizada. Aceita filtros do store global (city, category, etc).
// Fase 5.1: agora a fila respeita os mesmos filtros da Lista/Kanban.
// ============================================================================

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { crmApi, type QueueResponse, type PriorityReason } from "@/services/crmApi";
import { useLeadFiltersStore, filtersToQuery } from "../shared/useLeadFiltersStore";

export function useLeadQueue(limit = 50) {
  const { token, isStaff } = useAuthStore();
  const qc = useQueryClient();
  const enabled = !!token && (isStaff ?? false);

  // Le filtros do store global pra ficar sincronizado com Lista/Kanban
  const filters = useLeadFiltersStore((s) => s.filters);
  const queryFilters = useMemo(() => ({ ...filtersToQuery(filters), limit }), [filters, limit]);
  const queryKey = useMemo(() => ["admin-leads-queue", queryFilters], [queryFilters]);

  const query = useQuery<QueueResponse>({
    queryKey,
    queryFn: () => crmApi.leads.queue(queryFilters),
    enabled,
    staleTime: 30_000,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin-leads-queue"] });
  }

  return {
    queue: query.data,
    leads: query.data?.leads || [],
    total: query.data?.total || 0,
    byReason: query.data?.by_reason || {},
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
    invalidate,
  };
}

// ─── Helpers de label/cor por razao ─────────────────────────────────────────

export function priorityReasonLabel(r: PriorityReason): string {
  switch (r) {
    case "followup_overdue": return "Follow-up vencido";
    case "funnel_stalled":   return "Funil parado";
    case "hot_cold":         return "Quente sem contato";
    case "new_lead":         return "Recem-importado";
    default:                 return "Outro";
  }
}

export function priorityReasonColor(r: PriorityReason): string {
  switch (r) {
    case "followup_overdue": return "#ef4444";
    case "funnel_stalled":   return "#a855f7";
    case "hot_cold":         return "#f97316";
    case "new_lead":         return "#10b981";
    default:                 return "#6b7280";
  }
}

export function priorityReasonDescription(r: PriorityReason): string {
  switch (r) {
    case "followup_overdue": return "Esse lead tinha um follow-up agendado que ja venceu";
    case "funnel_stalled":   return "Em demo ou interessado, mas sem atividade ha 3+ dias";
    case "hot_cold":         return "Score alto (50+) sem contato ha 7+ dias";
    case "new_lead":         return "Importado nas ultimas 24h, ainda sem primeiro contato";
    default:                 return "";
  }
}
