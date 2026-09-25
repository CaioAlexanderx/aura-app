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
};

export const Contexto = createContext<ContextoDaVitrine | null>(null);

/** A vitrine em volta, ou null fora da casca. */
export function useVitrine(): ContextoDaVitrine | null {
  return useContext(Contexto);
}
