// ============================================================
// Canal digital · as cores NEUTRAS das abas (fundo, cartão, texto, borda)
//
// As abas Meu Site, Design e Entrega são as mesmas no Negócio e no
// Studio. O AccentTheme já trocava os quatro tokens "de marca" (botão,
// chip ativo), mas o resto vinha de `Colors`, o tema do painel Negócio —
// que não sabe do tema do Studio. Com o Studio no claro e o Negócio no
// escuro (o padrão), as três abas saíam com cartões quase pretos no meio
// de uma tela clara, e o título "INFORMAÇÕES DO NEGÓCIO" (tinta clara)
// sumia no fundo claro.
//
// Contrato: sem provider, a paleta é a de `Colors` (o Negócio fica
// exatamente como estava). A Loja Digital do Studio envelopa as abas com
// <PaletaDoCanal paleta={paletaDoStudio(tokens)}> e elas passam a seguir
// o tema do Studio, claro ou escuro.
// ============================================================
import { createContext, useContext, type ReactNode } from "react";
import { Colors } from "@/constants/colors";
import type { StudioPalette } from "@/constants/studio-tokens";

export type PaletaDoCanalTokens = {
  bg: string; bg2: string; bg3: string; bg4: string;
  ink: string; ink2: string; ink3: string;
  border: string; border2: string;
  green: string; greenD: string;
  red: string; redD: string;
  amber: string; amberD: string;
  // AA fix (QA LJ-48, 28/09/2026): `green`/`red` são a cor VIVA — boa pra
  // ícone, ponto de status, trilho de switch, mas TEXTO pequeno nessas
  // cores (ou sobre o próprio `greenD`/`redD`) não bate 4,5:1 no Studio
  // ("Aberta"/"Fechada" na Entrega, "Publicada" e "(-5%)" no Meu Site).
  // `greenInk`/`redInk` são a variante escura, só para TEXTO — mesmo
  // padrão que `amber` já seguia (aponta pra `warningInk`).
  greenInk: string;
  redInk: string;
};

/** A paleta do painel Negócio — o que as abas sempre usaram. */
export const PALETA_DO_NEGOCIO: PaletaDoCanalTokens = {
  bg: Colors.bg, bg2: Colors.bg2, bg3: Colors.bg3, bg4: Colors.bg4,
  ink: Colors.ink, ink2: Colors.ink2, ink3: Colors.ink3,
  border: Colors.border, border2: Colors.border2,
  green: Colors.green, greenD: Colors.greenD,
  red: Colors.red, redD: Colors.redD,
  amber: Colors.amber, amberD: Colors.amberD,
  // Negócio não foi flagrado no QA — mesma cor de `green`/`red` (já mais
  // escura que a do Studio), sem mudança visual.
  greenInk: Colors.green,
  redInk: Colors.red,
};

/**
 * A paleta do Studio a partir dos tokens do tema ativo.
 *
 * - cartão (`bg3`) = paperCard, o mesmo das abas nativas do Studio;
 * - campo e chip (`bg4`) = paperCardElev: branco sobre o cartão cinza no
 *   claro, um degrau mais claro que o cartão no escuro;
 * - âmbar vira o `warningInk`, porque aqui ele é quase sempre TEXTO de
 *   aviso — o âmbar puro sobre fundo claro não passa de 2:1.
 */
export function paletaDoStudio(t: StudioPalette): PaletaDoCanalTokens {
  return {
    bg: t.bg, bg2: t.bgSoft, bg3: t.paperCard, bg4: t.paperCardElev,
    ink: t.ink, ink2: t.ink2, ink3: t.ink3,
    border: t.ink5, border2: t.primaryBorder,
    green: t.success, greenD: t.successSoft,
    red: t.danger, redD: t.dangerSoft,
    amber: t.warningInk, amberD: t.warningSoft,
    greenInk: t.successInk,
    redInk: t.dangerInk,
  };
}

const Contexto = createContext<PaletaDoCanalTokens | null>(null);

export function PaletaDoCanal({ paleta, children }: { paleta: PaletaDoCanalTokens; children: ReactNode }) {
  return <Contexto.Provider value={paleta}>{children}</Contexto.Provider>;
}

/** As cores neutras das abas do canal. Sem provider: as do Negócio. */
export function usePaletaDoCanal(): PaletaDoCanalTokens {
  return useContext(Contexto) || PALETA_DO_NEGOCIO;
}
