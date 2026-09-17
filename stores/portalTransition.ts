import { create } from "zustand";

// ============================================================
// PortalTransition store — controla se a animacao 3s do portal
// Aura Odonto ja foi exibida nesta sessao.
//
// QA 2026-09-16: o estado era só em-memory, então um F5 recarrega
// o JS do zero e a intro ("clique ou pressione qualquer tecla
// para entrar") volta a aparecer a cada refresh — chato pra quem
// já viu. Persistimos em sessionStorage (web only, com try/catch
// pra SSR/native/privacidade) pra valer "uma vez por sessão do
// navegador": sobrevive a F5, mas reseta ao fechar a aba/janela.
//
// Reset manual disponivel para casos como debug/preview, troca de
// empresa (ver app/dental/(clinic)/_layout.tsx) ou um futuro botão
// "reproduzir intro" em configurações.
// ============================================================

const STORAGE_KEY = "aura:dental:portal-shown";

function readShownFromSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeShownToSession(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // sessionStorage indisponível (aba privada, SSR, etc). Sem persistência,
    // cai de volta pro comportamento em-memory de antes.
  }
}

type PortalTransitionState = {
  shown: boolean;
  markShown: () => void;
  reset: () => void;
};

export const usePortalTransition = create<PortalTransitionState>((set) => ({
  shown: readShownFromSession(),
  markShown: () => {
    writeShownToSession(true);
    set({ shown: true });
  },
  reset: () => {
    writeShownToSession(false);
    set({ shown: false });
  },
}));
