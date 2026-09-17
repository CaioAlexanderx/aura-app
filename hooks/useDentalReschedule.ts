// ============================================================
// useDentalReschedule — remarcar/redimensionar pela grade da agenda odonto
//
// PATCH /companies/:cid/dental/appointments/:id com { scheduled_at } ou
// { duration_min } (e practitioner_id ao trocar de cadeira) — Aura-backend#722.
// Com rejectOnConflict o backend devolve 409 SCHEDULE_CONFLICT sem gravar.
// Atualização otimista no cache ["dental-agenda", ...]; erro ou 409 volta o
// bloco para o lugar antigo.
// ============================================================
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { applyAppointmentPatch, type ReschedulePatch, type ScheduleConflict } from "@/utils/agendaGrid";

export type RescheduleResult =
  | { status: "ok"; conflicts: ScheduleConflict[] }
  | { status: "conflict"; conflicts: ScheduleConflict[] }
  | { status: "error"; message: string };

export type RescheduleFn = (
  appointmentId: string,
  patch: ReschedulePatch,
  opts: { rejectOnConflict: boolean },
) => Promise<RescheduleResult>;

const AGENDA_KEY = ["dental-agenda"];

export function useDentalReschedule(cid: string | undefined): RescheduleFn {
  const qc = useQueryClient();
  return useCallback<RescheduleFn>(async (appointmentId, patch, { rejectOnConflict }) => {
    if (!cid) return { status: "error", message: "Não foi possível mover a consulta. Recarregue a página." };
    await qc.cancelQueries({ queryKey: AGENDA_KEY });
    const snapshot = qc.getQueriesData({ queryKey: AGENDA_KEY });
    qc.setQueriesData({ queryKey: AGENDA_KEY }, (old: any) => applyAppointmentPatch(old, appointmentId, patch));
    try {
      const res = await request<{ conflicts?: ScheduleConflict[] }>(
        `/companies/${cid}/dental/appointments/${appointmentId}`,
        { method: "PATCH", body: rejectOnConflict ? { ...patch, reject_on_conflict: true } : patch },
      );
      return { status: "ok", conflicts: res?.conflicts || [] };
    } catch (e: any) {
      // Nada foi gravado (ou não sabemos): o bloco volta para onde estava.
      for (const [key, data] of snapshot) qc.setQueryData(key, data);
      if (e?.status === 409 && e?.data?.code === "SCHEDULE_CONFLICT") {
        return { status: "conflict", conflicts: e.data.conflicts || [] };
      }
      return { status: "error", message: e?.data?.error || e?.message || "Não foi possível mover a consulta." };
    } finally {
      qc.invalidateQueries({ queryKey: AGENDA_KEY });
      qc.invalidateQueries({ queryKey: ["dental-agenda-window"] });
      qc.invalidateQueries({ queryKey: ["dental-appointment"] });
      qc.invalidateQueries({ queryKey: ["dental-hoje-appointments"] });
    }
  }, [cid, qc]);
}
