// ============================================================
// components/studio/storefront/TemaDaVitrine.tsx
//
// O tema da loja, disponível em qualquer componente da vitrine.
//
// POR QUE UM CONTEXTO
// `montarTema` existe desde 19/08/2026 e estava ligado em 3 dos 30
// componentes. Os outros 27 liam a constante `T` — azul-marinho e
// magenta cravados — então a partir da segunda tela a cliente entrava na
// loja da lojista e comprava numa loja da Aura.
//
// Passar o tema como prop por 30 componentes seria um diff enorme e uma
// prop a mais para alguém esquecer. O repo já resolve exatamente isso
// para a tipografia, em TipografiaVitrine.tsx — este arquivo é o par
// dele, e de propósito: dois mecanismos diferentes para a mesma coisa
// seria a próxima migração pela metade.
//
// COMO USAR
//   const T = usePaletaDaVitrine();   // a paleta antiga, agora viva
//   const tema = useTemaDaVitrine();  // o tema inteiro (raios, sombra, fonte)
//
// O provider fica em app/cardapio/studio/[slug].tsx, onde a cor da loja
// chega. Sem provider, cai no tema padrão — a vitrine nunca renderiza
// sem cor, ela herda o violeta da Aura.
// ============================================================
import React, { createContext, useContext, useMemo } from "react";
import {
  montarTema, paletaDaVitrine,
  type ModoVitrine, type PaletaDaVitrine, type VitrineTema,
} from "./theme";

/** O modo da vitrine Studio: papel quente do Studio Premium. */
export const MODO_STUDIO: ModoVitrine = "papel";

const TemaCtx = createContext<VitrineTema>(montarTema(null, MODO_STUDIO));

export function TemaDaVitrine({
  cor,
  modo = MODO_STUDIO,
  children,
}: {
  cor?: string | null;
  modo?: ModoVitrine;
  children: React.ReactNode;
}) {
  // A cor da loja muda uma vez por carregamento; recalcular a cada render
  // refaria os laços de contraste de parLegivel à toa.
  const tema = useMemo(() => montarTema(cor, modo), [cor, modo]);
  return <TemaCtx.Provider value={tema}>{children}</TemaCtx.Provider>;
}

/** O tema inteiro: raios, fontes, movimento, marca em todas as formas. */
export function useTemaDaVitrine(): VitrineTema {
  return useContext(TemaCtx);
}

/**
 * A paleta no formato antigo, derivada do tema vivo.
 *
 * É o que permite um componente trocar `import { T } from "../types"` por
 * uma linha e continuar com o corpo intacto.
 */
export function usePaletaDaVitrine(): PaletaDaVitrine {
  const tema = useTemaDaVitrine();
  return useMemo(() => paletaDaVitrine(tema), [tema]);
}
