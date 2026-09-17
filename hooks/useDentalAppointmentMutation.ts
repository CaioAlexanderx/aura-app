// ============================================================
// AURA. — PATCH de agendamento odonto com atualização otimista
//
// O QA viu ~3–4 s entre o PATCH e o modal refletir o status novo. Aqui o
// cache do detalhe e das listas (agenda, Lista, Confirmar amanhã, painel
// Hoje) muda na hora; se o backend recusar (ex.: 400 INVALID_TRANSITION),
// volta ao estado anterior e mostra a mensagem do servidor.
// ============================================================
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { request } from "@/services/api";
import { notify } from "@/utils/webAlert";

export type AppointmentPatch = {
  status?: string;
  scheduled_at?: string;
  duration_min?: number;
  practitioner_id?: string | null;
  chief_complaint?: string | null;
  cancel_reason?: string | null;
  clinical_notes?: string | null;
  reject_on_conflict?: boolean;
};

export type AppointmentPatchResult = {
  appointment?: any;
  conflicts?: Array<{ id: string; patient_name?: string | null; scheduled_at: string; duration_min?: number }>;
};

/** Listas de agendamentos que refletem a mudança. */
export const APPOINTMENT_LIST_KEYS: QueryKey[] = [
  ["dental-agenda"],
  ["dental-agenda-day"],
  ["dental-appointments-list"],
  ["dental-tomorrow"],
  ["dental-hoje-appointments"],
];

/** Mensagem legível de um erro do `request` (ApiError tem .data.error). */
export function apiErrorMessage(err: any, fallback = "Não foi possível salvar. Tente de novo."): string {
  return err?.data?.error || err?.message || err?.error || fallback;
}

function mergeFields(patch: AppointmentPatch) {
  const { reject_on_conflict: _ignored, ...fields } = patch;
  return fields;
}

export function useDentalAppointmentMutation(cid: string | null | undefined) {
  const qc = useQueryClient();

  return useMutation<AppointmentPatchResult, any, { id: string; patch: AppointmentPatch; silent?: boolean }, { snapshots: Array<[QueryKey, unknown]> }>({
    mutationFn: ({ id, patch }) =>
      request<AppointmentPatchResult>(`/companies/${cid}/dental/appointments/${id}`, { method: "PATCH", body: patch }),

    onMutate: async ({ id, patch }) => {
      const fields = mergeFields(patch);
      const keys: QueryKey[] = [["dental-appointment", cid, id], ...APPOINTMENT_LIST_KEYS];
      await Promise.all(keys.map((k) => qc.cancelQueries({ queryKey: k })));
      const snapshots: Array<[QueryKey, unknown]> = [];
      for (const k of keys) snapshots.push(...qc.getQueriesData({ queryKey: k }));

      qc.setQueriesData<any>({ queryKey: ["dental-appointment", cid, id] }, (old: any) =>
        old?.appointment ? { ...old, appointment: { ...old.appointment, ...fields } } : old,
      );
      for (const k of APPOINTMENT_LIST_KEYS) {
        qc.setQueriesData<any>({ queryKey: k }, (old: any) => {
          if (!old || !Array.isArray(old.appointments)) return old;
          let list = old.appointments.map((a: any) => (a.id === id ? { ...a, ...fields } : a));
          // A grade não mostra cancelados (o backend também os tira de /agenda).
          if ((k[0] === "dental-agenda" || k[0] === "dental-agenda-day") && fields.status === "cancelado") {
            list = list.filter((a: any) => a.id !== id);
          }
          return { ...old, appointments: list };
        });
      }
      return { snapshots };
    },

    onError: (err, vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      if (!vars.silent) notify("Não foi possível salvar", apiErrorMessage(err));
    },

    onSuccess: (res, { id }) => {
      if (res?.appointment) {
        qc.setQueriesData<any>({ queryKey: ["dental-appointment", cid, id] }, (old: any) =>
          old?.appointment ? { ...old, appointment: { ...old.appointment, ...res.appointment, procedures: old.appointment.procedures } } : old,
        );
      }
    },

    onSettled: (_res, _err, { id }) => {
      qc.invalidateQueries({ queryKey: ["dental-appointment", cid, id] });
      for (const k of APPOINTMENT_LIST_KEYS) qc.invalidateQueries({ queryKey: k });
    },
  });
}
