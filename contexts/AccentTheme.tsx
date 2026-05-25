// ============================================================
// AccentTheme — Context pra tematizar o Canal Digital
//
// 25/05/2026: o Canal Digital (TabMeuSite/Design/Vitrine/Entrega/Pedidos)
// é compartilhado entre o shell Varejo e o shell Studio. Cada shell
// quer seu accent: varejo violeta #7c3aed, Studio navy #1E3A8A.
//
// Em vez de duplicar 5 tabs (~165KB), o canal lê só 4 tokens via
// useAccent(). Default sem provider = violeta varejo (backward compat).
// Shell Studio envelopa em <AccentTheme tokens={studioAccent}>.
//
// Só 4 tokens são tematizáveis (os "violetas" do canal). Outros
// (bg/ink/green/red/amber) ficam neutros — vêm direto de Colors.
// ============================================================
import React, { createContext, useContext, useMemo, ReactNode } from "react";
import { Colors } from "@/constants/colors";
import { StudioColors } from "@/constants/studio-tokens";

export interface AccentTokens {
  /** Cor primária (botão CTA, switch on, link). Varejo: violet. Studio: primary navy. */
  primary: string;
  /** Texto/ícone forte sobre fundo soft (chip ativo, badge text). Varejo: violet3. Studio: accent magenta. */
  primaryStrong: string;
  /** Fundo soft pra chip ativo, badge bg, hover. Varejo: violetD. Studio: primaryGhost. */
  primarySoft: string;
  /** Cor de borda padrão de cards/inputs. Varejo: border. Studio: ink5 (mais visível). */
  border: string;
}

// Default = varejo violeta (mantém comportamento atual quando sem provider)
export const varejoAccent: AccentTokens = {
  primary:       Colors.violet,
  primaryStrong: Colors.violet3,
  primarySoft:   Colors.violetD,
  border:        Colors.border,
};

// Studio = navy + magenta
export const studioAccent: AccentTokens = {
  primary:       StudioColors.primary,        // navy #1E3A8A
  primaryStrong: StudioColors.accent,         // magenta #EC4899
  primarySoft:   StudioColors.primaryGhost,   // #EFF6FF
  border:        StudioColors.ink5,           // #CBD5E1
};

const AccentContext = createContext<AccentTokens>(varejoAccent);

export function AccentTheme({ tokens, children }: { tokens: AccentTokens; children: ReactNode }) {
  // useMemo evita re-render dos consumers quando tokens são objeto literal estável
  const value = useMemo(() => tokens, [tokens.primary, tokens.primaryStrong, tokens.primarySoft, tokens.border]);
  return <AccentContext.Provider value={value}>{children}</AccentContext.Provider>;
}

/** Tokens tematizáveis do Canal. Default = varejo violeta. */
export function useAccent(): AccentTokens {
  return useContext(AccentContext);
}
