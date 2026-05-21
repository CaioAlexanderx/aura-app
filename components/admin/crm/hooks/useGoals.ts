// ─── useGoals ────────────────────────────────────────────────────────────────
// Metas mensais + progresso ao vivo (GoalsCard usa o /current).
// ============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { crmApi, type LeadGoal, type GoalCurrentProgress } from "@/services/crmApi";
import { toast } from "@/components/Toast";

export function useGoals(year?: number) {
  const { token, isStaff } = useAuthStore();
  const qc = useQueryClient();
  const enabled = !!token && (isStaff ?? false);
  const yearKey = year ?? new Date().getFullYear();

  // Lista do ano todo
  const list = useQuery<{ year: number; goals: LeadGoal[] }>({
    queryKey: ["admin-lead-goals", yearKey],
    queryFn:  () => crmApi.goals.list(year),
    enabled,
    staleTime: 5 * 60_000,
  });

  // Progresso do mes atual (ao vivo)
  const current = useQuery<GoalCurrentProgress>({
    queryKey: ["admin-lead-goals-current"],
    queryFn:  () => crmApi.goals.current(),
    enabled,
    staleTime: 60_000,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin-lead-goals"] });
    qc.invalidateQueries({ queryKey: ["admin-lead-goals-current"] });
  }

  const upsert = useMutation({
    mutationFn: (body: {
      reference_month: string | { year: number; month: number };
      target_contacts: number;
      target_converted: number;
      target_mrr?: number;
      notes?: string;
    }) => crmApi.goals.upsert(body),
    onSuccess: (r) => {
      invalidate();
      toast.success(r.created ? "Meta criada" : "Meta atualizada");
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao salvar meta"),
  });

  const update = useMutation({
    mutationFn: (p: { id: string; body: Partial<Pick<LeadGoal, "target_contacts" | "target_converted" | "target_mrr" | "notes">> }) =>
      crmApi.goals.update(p.id, p.body),
    onSuccess: () => { invalidate(); toast.success("Meta atualizada"); },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => crmApi.goals.remove(id),
    onSuccess: () => { invalidate(); toast.success("Meta removida"); },
    onError: () => toast.error("Erro ao remover"),
  });

  return {
    goals: list.data?.goals || [],
    current: current.data,
    isLoading: list.isLoading,
    isLoadingCurrent: current.isLoading,
    upsert,
    update,
    remove,
    refetch: () => Promise.all([list.refetch(), current.refetch()]),
  };
}
