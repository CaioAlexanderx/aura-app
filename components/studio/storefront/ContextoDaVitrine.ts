// ============================================================
// components/studio/storefront/ContextoDaVitrine.ts
//
// Onda 1B: a vitrine em volta — o estado da loja e o aviso passageiro —
// para quem está dentro da casca (PaginaDaVitrine.tsx, CascaDaVitrine).
// Módulo próprio para não fechar ciclo de import: a casca desenha o
// configurador, e o botão de compartilhar dele lê daqui.
// ============================================================
import { createContext, useContext } from "react";
import type { StorefrontState } from "./useStorefront";

export type ContextoDaVitrine = {
  sf: StorefrontState;
  /** O slug da loja aberta (o do backend vence o do caminho). */
  slug: string;
  /** Um aviso curto no pé da tela ("Link da peça copiado"). */
  avisar: (texto: string, icone?: "check" | "info") => void;
  /**
   * QA 27/09: o recado que a home nova mostra no topo do conteúdo, uma
   * vez — hoje, o da peça que saiu da loja (link direto de peça oculta ou
   * apagada). Some no "Fechar aviso" ou quando a cliente sai da home.
   */
  recadoDaHome?: string | null;
  deixarRecadoNaHome?: (texto: string | null) => void;
};

export const Contexto = createContext<ContextoDaVitrine | null>(null);

/** A vitrine em volta, ou null fora da casca. */
export function useVitrine(): ContextoDaVitrine | null {
  return useContext(Contexto);
}
