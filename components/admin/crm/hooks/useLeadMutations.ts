// ─── useLeadMutations ────────────────────────────────────────────────────────
// Concentra todas as mutacoes do lead: interaction, update, batch,
// applyCadence, recomputeScores, markRotten, import.
// Invalida queries de forma consistente em todas (lista + queue + meta + stats).
// Fase 5.1: invalidacao agora inclui admin-leads-queue (Fila sincroniza com
// Kanban/Lista em ambos os sentidos).
// ============================================================================

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { crmApi, type LeadStatus, type LeadChannel } from "@/services/crmApi";
import { toast } from "@/components/Toast";

export function useLeadMutations(selectedLeadId?: string | null) {
  const qc = useQueryClient();

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["admin-leads"] });
    qc.invalidateQueries({ queryKey: ["admin-leads-queue"] }); // Fase 5.1
    qc.invalidateQueries({ queryKey: ["admin-leads-meta"] });
    qc.invalidateQueries({ queryKey: ["admin-leads-stats"] });
    qc.invalidateQueries({ queryKey: ["admin-lead-views"] });  // counts das lentes
    if (selectedLeadId) {
      qc.invalidateQueries({ queryKey: ["admin-lead-detail", selectedLeadId] });
    }
  }

  // ── Registrar interacao ────────────────────────────────────────────────────
  const interaction = useMutation({
    mutationFn: (p: {
      id: string;
      body: string;
      channel: LeadChannel;
      new_status?: LeadStatus;
      next_followup_at?: string;
      advance_cadence?: boolean;
    }) => crmApi.leads.interactions.create(p.id, {
      body: p.body,
      channel: p.channel,
      new_status: p.new_status,
      next_followup_at: p.next_followup_at,
      advance_cadence: p.advance_cadence,
    }),
    onSuccess: () => {
      invalidateAll();
      toast.success("Interacao registrada");
    },
    onError: () => toast.error("Erro ao registrar"),
  });

  // ── Editar campos do lead ──────────────────────────────────────────────────
  const update = useMutation({
    mutationFn: (p: { id: string; body: Record<string, any> }) =>
      crmApi.leads.update(p.id, p.body),
    onSuccess: () => {
      invalidateAll();
      toast.success("Lead atualizado");
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao atualizar"),
  });

  // ── Mudar status (otimista — usado pelo Kanban DnD) ────────────────────────
  // Optimistic cobre admin-leads E admin-leads-queue.
  const moveStatus = useMutation({
    mutationFn: (p: { id: string; status: LeadStatus }) =>
      crmApi.leads.update(p.id, { status: p.status }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["admin-leads"] });
      await qc.cancelQueries({ queryKey: ["admin-leads-queue"] });

      const snapshots = [
        ...qc.getQueriesData({ queryKey: ["admin-leads"] }),
        ...qc.getQueriesData({ queryKey: ["admin-leads-queue"] }),
      ];

      // Optimistic em admin-leads (estrutura: { leads, pipeline, ... })
      qc.setQueriesData<any>({ queryKey: ["admin-leads"] }, (old) => {
        if (!old?.leads) return old;
        return {
          ...old,
          leads: old.leads.map((l: any) => l.id === vars.id ? { ...l, status: vars.status } : l),
        };
      });

      // Optimistic em admin-leads-queue (estrutura: { leads, total, by_reason })
      // Se mudou pra converted/lost, removemos da fila (queue enforce esses excludes).
      const isTerminal = vars.status === "converted" || vars.status === "lost";
      qc.setQueriesData<any>({ queryKey: ["admin-leads-queue"] }, (old) => {
        if (!old?.leads) return old;
        if (isTerminal) {
          return {
            ...old,
            leads: old.leads.filter((l: any) => l.id !== vars.id),
            total: Math.max(0, old.total - 1),
          };
        }
        return {
          ...old,
          leads: old.leads.map((l: any) => l.id === vars.id ? { ...l, status: vars.status } : l),
        };
      });

      return { snapshots };
    },
    onError: (_err, _vars, ctx: any) => {
      ctx?.snapshots?.forEach(([key, data]: any) => qc.setQueryData(key, data));
      toast.error("Erro ao mover lead");
    },
    onSettled: () => {
      invalidateAll();
    },
  });

  // ── Batch (acoes em massa) ─────────────────────────────────────────────────
  const batch = useMutation({
    mutationFn: (p: {
      ids: string[];
      action: "update_status" | "set_expected_plan" | "assign_cadence" | "mark_rotten" | "unmark_rotten" | "set_followup" | "delete";
      payload?: Record<string, any>;
    }) => crmApi.leads.batch(p.ids, p.action, p.payload),
    onSuccess: (r) => {
      invalidateAll();
      toast.success(`${r.affected} lead(s) atualizados`);
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erro no batch"),
  });

  // ── Aplicar cadencia ───────────────────────────────────────────────────────
  const applyCadence = useMutation({
    mutationFn: (p: { id: string; cadence_name: string; start_day?: number }) =>
      crmApi.leads.applyCadence(p.id, p.cadence_name, p.start_day),
    onSuccess: () => {
      invalidateAll();
      toast.success("Cadencia aplicada");
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao aplicar cadencia"),
  });

  // ── Recomputar scores em massa ─────────────────────────────────────────────
  const recomputeScores = useMutation({
    mutationFn: () => crmApi.leads.recomputeScores(),
    onSuccess: (r) => {
      invalidateAll();
      toast.success(`${r.recomputed} scores recalculados`);
    },
    onError: () => toast.error("Erro ao recalcular"),
  });

  // ── Marcar rotten em massa ─────────────────────────────────────────────────
  const markRotten = useMutation({
    mutationFn: (threshold_days?: number) => crmApi.leads.markRotten(threshold_days),
    onSuccess: (r) => {
      invalidateAll();
      toast.success(`${r.affected} leads marcados como rotten (>${r.threshold_days}d)`);
    },
    onError: () => toast.error("Erro ao marcar rotten"),
  });

  // ── Importar (planilha Excel/CSV mapeada) ──────────────────────────────────
  const importLeads = useMutation({
    mutationFn: (leads: any[]) => crmApi.leads.import(leads),
    onSuccess: (r) => {
      invalidateAll();
      toast.success(`Importado: ${r.inserted} leads (${r.skipped} ignorados)`);
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao importar"),
  });

  // ── Deletar (single) ───────────────────────────────────────────────────────
  const remove = useMutation({
    mutationFn: (id: string) => crmApi.leads.remove(id),
    onSuccess: () => {
      invalidateAll();
      toast.success("Lead removido");
    },
    onError: () => toast.error("Erro ao remover"),
  });

  return {
    interaction,
    update,
    moveStatus,
    batch,
    applyCadence,
    recomputeScores,
    markRotten,
    importLeads,
    remove,
    invalidateAll,
  };
}
