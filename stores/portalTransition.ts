import { create } from "zustand";

// ============================================================
// PortalTransition store — controla se a animacao 3s do portal
// Aura Odonto ja foi exibida nesta sessao.
//
// Em-memory (sem persistencia): reset natural a cada hard reload
// significa nova sessao = animacao roda de novo. Suficiente para
// o objetivo: dar um momento de marca ao entrar, sem repetir a
// cada navegacao interna.
//
// Reset manual disponivel para casos como debug/preview ou um
// futuro botao "reproduzir intro" em configuracoes.
// ============================================================

type PortalTransitionState = {
  shown: boolean;
  markShown: () => void;
  reset: () => void;
};

export const usePortalTransition = create<PortalTransitionState>((set) => ({
  shown: false,
  markShown: () => set({ shown: true }),
  reset: () => set({ shown: false }),
}));
