// ============================================================
// useAgendaGridFlow — o que acontece depois de soltar um bloco na agenda
//
// Fluxo do mockup (16/09/2026):
//   1. checa conflito no cliente com os agendamentos carregados (mesma regra
//      do backend); havendo, abre o aviso "Encaixar / Não mover" no horário;
//   2. sem conflito → PATCH com reject_on_conflict (409 → mesmo aviso);
//   3. gravou → aviso no rodapé da agenda com Desfazer (PATCH com os valores
//      antigos); erro → aviso de erro e o bloco volta (rollback no hook de PATCH).
// Fora do horário da clínica não bloqueia: o rótulo do alvo avisa e o aviso
// final diz "como encaixe fora do horário" (o backend responde outside_hours).
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import type { DragPreview } from "@/hooks/useAgendaDrag";
import type { RescheduleFn } from "@/hooks/useDentalReschedule";
import {
  atMinute,
  dayShortLabel,
  findConflicts,
  firstName,
  hm,
  inversePatch,
  type ReschedulePatch,
  type ScheduleConflict,
} from "@/utils/agendaGrid";

export interface FlowAppointment {
  id: string;
  patient_name: string;
  scheduled_at: string;
  duration_min: number;
  status: string;
  practitioner_id?: string | null;
}

export interface ChangeRequest {
  appt: FlowAppointment;
  patch: ReschedulePatch;
  /** Onde o fantasma fica enquanto o aviso de conflito está aberto. */
  ghost: DragPreview;
  /** Texto do aviso depois de gravar. */
  message: string;
  /** O novo horário não cabe num turno da clínica (só aviso; não bloqueia). */
  outsideHours?: boolean;
}

export interface PendingConflict extends ChangeRequest {
  conflicts: ScheduleConflict[];
}

export interface GridToast {
  key: number;
  kind: "ok" | "error";
  message: string;
  undo?: () => void;
}

/** Transforma o resultado do arraste em patch + texto do aviso. */
export function changeFromPreview(
  appt: FlowAppointment,
  p: DragPreview,
  target: { day: Date; columnChanged: boolean; practitionerId?: string | null; columnLabel?: string; outsideHours?: boolean },
): ChangeRequest {
  const who = firstName(appt.patient_name);
  const outsideHours = !!target.outsideHours;
  if (p.mode === "resize") {
    return {
      appt,
      ghost: p,
      outsideHours,
      patch: { duration_min: p.durMin },
      message: `Consulta de ${who} agora dura ${p.durMin} min (${hm(p.startMin)}–${hm(p.startMin + p.durMin)})`,
    };
  }
  const patch: ReschedulePatch = { scheduled_at: atMinute(target.day, p.startMin).toISOString() };
  const chairMoved = target.columnChanged && target.practitionerId !== undefined;
  if (chairMoved) patch.practitioner_id = target.practitionerId;
  return {
    appt,
    ghost: p,
    outsideHours,
    patch,
    message: `Consulta de ${who} movida para ${dayShortLabel(target.day).toLowerCase()} às ${hm(p.startMin)}`
      + (chairMoved && target.columnLabel ? ` · ${target.columnLabel}` : ""),
  };
}

/** " como encaixe" / " como encaixe fora do horário" no aviso depois de gravar. */
export function toastSuffix(fit: boolean, outsideHours: boolean): string {
  if (outsideHours) return " como encaixe fora do horário";
  return fit ? " como encaixe" : "";
}

/** Conflitos que o patch criaria, pela regra do backend. */
export function conflictsFor(req: Pick<ChangeRequest, "appt" | "patch">, all: FlowAppointment[]): ScheduleConflict[] {
  const { appt, patch } = req;
  return findConflicts(
    {
      id: appt.id,
      scheduled_at: patch.scheduled_at ?? appt.scheduled_at,
      duration_min: patch.duration_min ?? appt.duration_min,
      practitioner_id: patch.practitioner_id !== undefined ? patch.practitioner_id : appt.practitioner_id,
    },
    all,
  );
}

export function useAgendaGridFlow({ appointments, onReschedule }: {
  appointments: FlowAppointment[];
  onReschedule?: RescheduleFn;
}) {
  const [pending, setPending] = useState<PendingConflict | null>(null);
  const [toast, setToast] = useState<GridToast | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const toastKey = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const apptsRef = useRef(appointments);
  apptsRef.current = appointments;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const showToast = useCallback((t: Omit<GridToast, "key">) => {
    if (!alive.current) return;
    toastKey.current += 1;
    setToast({ ...t, key: toastKey.current });
  }, []);

  const flash = useCallback((id: string) => {
    if (!alive.current) return;
    setFlashId(id);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => { if (alive.current) setFlashId(null); }, 1400);
  }, []);

  const send = useCallback(async (req: ChangeRequest, fit: boolean) => {
    setPending(null);
    if (!onReschedule) return;
    const undoPatch = inversePatch(req.appt, req.patch);
    const res = await onReschedule(req.appt.id, req.patch, { rejectOnConflict: !fit });
    if (!alive.current) return;
    if (res.status === "conflict") {
      setPending({ ...req, conflicts: res.conflicts });
      return;
    }
    if (res.status === "error") {
      showToast({ kind: "error", message: res.message });
      return;
    }
    flash(req.appt.id);
    showToast({
      kind: "ok",
      message: req.message + toastSuffix(fit, res.outsideHours ?? !!req.outsideHours),
      undo: async () => {
        setToast(null);
        const r = await onReschedule(req.appt.id, undoPatch, { rejectOnConflict: false });
        if (r.status === "error") showToast({ kind: "error", message: r.message });
        else flash(req.appt.id);
      },
    });
  }, [onReschedule, showToast, flash]);

  const request = useCallback((req: ChangeRequest) => {
    const local = conflictsFor(req, apptsRef.current);
    if (local.length) {
      setPending({ ...req, conflicts: local });
      return;
    }
    void send(req, false);
  }, [send]);

  const confirmFit = useCallback(() => {
    if (pending) void send(pending, true);
  }, [pending, send]);

  const cancelPending = useCallback(() => setPending(null), []);

  // Esc fecha o aviso de conflito (= "Não mover").
  useEffect(() => {
    if (!pending || typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPending(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  return {
    pending,
    toast,
    flashId,
    request,
    confirmFit,
    cancelPending,
    dismissToast: useCallback(() => setToast(null), []),
  };
}
