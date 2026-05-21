// ─── useLeadViews ────────────────────────────────────────────────────────────
// CRUD de saved views (lentes salvas). Inclui count ao vivo de cada view.
// ============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { crmApi, type LeadView, type LeadViewFilters } from "@/services/crmApi";
import { toast } from "@/components/Toast";

export function useLeadViews() {
  const { token, isStaff } = useAuthStore();
  const qc = useQueryClient();
  const enabled = !!token && (isStaff ?? false);

  const list = useQuery<{ views: LeadView[] }>({
    queryKey: ["admin-lead-views"],
    queryFn:  () => crmApi.views.list(),
    enabled,
    // Counts mudam conforme leads sao mexidos; mantemos 30s pra evitar refetch em cada hover
    staleTime: 30_000,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin-lead-views"] });
  }

  const create = useMutation({
    mutationFn: (body: {
      name: string;
      description?: string;
      filters: LeadViewFilters;
      icon?: string;
      color?: string;
      is_pinned?: boolean;
      sort_order?: number;
    }) => crmApi.views.create(body),
    onSuccess: () => {
      invalidate();
      toast.success("Lente salva");
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao salvar lente"),
  });

  const update = useMutation({
    mutationFn: (p: { id: string; body: Partial<{
      name: string;
      description: string;
      filters: LeadViewFilters;
      icon: string;
      color: string;
      is_pinned: boolean;
      sort_order: number;
    }> }) => crmApi.views.update(p.id, p.body),
    onSuccess: () => {
      invalidate();
      toast.success("Lente atualizada");
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao atualizar"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => crmApi.views.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success("Lente removida");
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao remover"),
  });

  // Helpers de classificacao pra UI
  const allViews = list.data?.views || [];
  const systemViews = allViews.filter(v => v.is_system).sort((a, b) => a.sort_order - b.sort_order);
  const customViews = allViews.filter(v => !v.is_system).sort((a, b) => a.sort_order - b.sort_order);
  const pinnedViews = allViews.filter(v => v.is_pinned).sort((a, b) => a.sort_order - b.sort_order);

  return {
    views: allViews,
    systemViews,
    customViews,
    pinnedViews,
    isLoading: list.isLoading,
    isFetching: list.isFetching,
    refetch: list.refetch,
    create,
    update,
    remove,
    invalidate,
  };
}
