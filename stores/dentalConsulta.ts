// ============================================================
// AURA. — useDentalConsultaStore (PR44 #10, 2026-04-29)
//
// Zustand store keyed por appointmentId pra persistir o ConsultaState
// quando o user clica "Minimizar" no Modo Consulta. Antes, o state vivia
// dentro de useReducer no ConsultaShell — ao fazer router.back() o
// componente desmontava e perdia toothChanges/transcript/evolutionDraft.
//
// Agora o ConsultaShell hidrata o reducer a partir do store na entrada
// e sincroniza alteracoes de volta ao store. Reentrar na consulta
// retoma exatamente onde parou.
//
// Memoria: vive enquanto a aba estiver aberta (sem persist no
// AsyncStorage). Encerrar consulta limpa o snapshot.
// ============================================================

import { create } from "zustand";
import type { ConsultaState } from "@/lib/dentalConsultaTypes";

type Snapshots = Record<string, ConsultaState>;

interface ConsultaStoreState {
  snapshots: Snapshots;
  get: (appointmentId: string) => ConsultaState | undefined;
  set: (appointmentId: string, state: ConsultaState) => void;
  clear: (appointmentId: string) => void;
}

export const useDentalConsultaStore = create<ConsultaStoreState>((set, getState) => ({
  snapshots: {},
  get: (appointmentId: string) => getState().snapshots[appointmentId],
  set: (appointmentId: string, state: ConsultaState) =>
    set((s) => ({ snapshots: { ...s.snapshots, [appointmentId]: state } })),
  clear: (appointmentId: string) =>
    set((s) => {
      const next = { ...s.snapshots };
      delete next[appointmentId];
      return { snapshots: next };
    }),
}));
