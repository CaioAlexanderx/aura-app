// ─── useCadences ─────────────────────────────────────────────────────────────
// CRUD de cadencias (templates de sequencia).
// ============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { crmApi, type Cadence, type CadenceStep } from "@/services/crmApi";
import { toast } from "@/components/Toast";

export function useCadences(activeOnly?: boolean) {
  const { token, isStaff } = useAuthStore();
  const qc = useQueryClient();
  const enabled = !!token && (isStaff ?? false);

  const list = useQuery<{ cadences: Cadence[] }>({
    queryKey: ["admin-cadences", activeOnly ?? "all"],
    queryFn:  () => crmApi.cadences.list(activeOnly),
    enabled,
    staleTime: 60_000,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin-cadences"] });
    // Cadencia afeta cadence_name em leads tambem
    qc.invalidateQueries({ queryKey: ["admin-leads"] });
  }

  const create = useMutation({
    mutationFn: (body: { name: string; description?: string; steps: CadenceStep[]; is_active?: boolean }) =>
      crmApi.cadences.create(body),
    onSuccess: () => {
      invalidate();
      toast.success("Cadencia criada");
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao criar"),
  });

  const update = useMutation({
    mutationFn: (p: { id: string; body: Partial<{ name: string; description: string; steps: CadenceStep[]; is_active: boolean }> }) =>
      crmApi.cadences.update(p.id, p.body),
    onSuccess: () => {
      invalidate();
      toast.success("Cadencia atualizada");
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao atualizar"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => crmApi.cadences.remove(id),
    onSuccess: (r) => {
      invalidate();
      toast.success(r.soft_deleted ? "Cadencia desativada (em uso)" : "Cadencia removida");
    },
    onError: () => toast.error("Erro ao remover"),
  });

  return {
    cadences: list.data?.cadences || [],
    isLoading: list.isLoading,
    create,
    update,
    remove,
    refetch: list.refetch,
  };
}
