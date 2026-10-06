import { create } from "zustand";
import type { TourStep } from "@/components/onboarding/SpotlightTour";

// ============================================================
// Tour pendente (05/10/2026 — primeiros passos por frente)
//
// O cartão de primeiros passos não abre o tour na própria tela: ele grava
// aqui "quando chegar em <path>, aponte para <alvo>" e navega. O
// PendingTourHost (montado no layout do shell) mostra o SpotlightTour
// quando a rota bate, e limpa ao fechar.
// ============================================================

export type PendingTour = {
  path: string;      // pathname de destino, sem query (ex.: "/estoque")
  step: TourStep;
  arrived?: boolean; // o host já viu a rota de destino
};

type PendingTourState = {
  pending: PendingTour | null;
  start: (p: PendingTour) => void;
  markArrived: () => void;
  clear: () => void;
};

export const usePendingTour = create<PendingTourState>((set, get) => ({
  pending: null,
  start: (p) => set({ pending: { ...p, arrived: false } }),
  markArrived: () => {
    const p = get().pending;
    if (p && !p.arrived) set({ pending: { ...p, arrived: true } });
  },
  clear: () => set({ pending: null }),
}));

/** "/estoque?x=1" → "/estoque"; tira a barra final. */
export function normalizarPath(p: string | null | undefined): string {
  const semQuery = String(p || "").split("?")[0].split("#")[0];
  return semQuery.length > 1 ? semQuery.replace(/\/+$/, "") : semQuery;
}
