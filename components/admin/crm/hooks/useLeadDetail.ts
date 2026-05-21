// ─── useLeadDetail ───────────────────────────────────────────────────────────
// Query do lead individual + interactions (timeline).
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { crmApi, type Lead, type LeadInteraction } from "@/services/crmApi";

export function useLeadDetail(leadId: string | null) {
  const query = useQuery<{ lead: Lead; interactions: LeadInteraction[] }>({
    queryKey: ["admin-lead-detail", leadId],
    queryFn:  () => crmApi.leads.get(leadId as string),
    enabled:  !!leadId,
    staleTime: 30_000,
  });

  return {
    lead: query.data?.lead,
    interactions: query.data?.interactions || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
