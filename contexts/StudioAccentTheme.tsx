import React, { createContext, useContext, useMemo, ReactNode } from "react";
import { StudioColors } from "@/constants/studio-tokens";

export interface StudioAccentTokens {
  primary: string;        // navy default OU custom do lojista
  primary2: string;       // tom claro
  primarySoft: string;    // bg soft pra status
  primaryGhost: string;   // bg suave hover
  primaryBorder: string;  // border
  accent: string;         // magenta default OU custom
  accent2: string;
  accentSoft: string;
  accentGhost: string;
}

// Default = paleta Studio canônica (navy + magenta)
export const studioDefaultAccent: StudioAccentTokens = {
  primary:       StudioColors.primary,
  primary2:      StudioColors.primary2,
  primarySoft:   StudioColors.primarySoft,
  primaryGhost:  StudioColors.primaryGhost,
  primaryBorder: StudioColors.primaryBorder,
  accent:        StudioColors.accent,
  accent2:       StudioColors.accent2,
  accentSoft:    StudioColors.accentSoft,
  accentGhost:   StudioColors.accentGhost,
};

// Helper: deriva paleta completa a partir de 2 cores custom (primary + accent)
// Gera primary2/Soft/Ghost/Border automaticamente via tinting (rgba alpha).
export function deriveAccentFromColors(primary: string, accent: string): StudioAccentTokens {
  // Helper inline pra converter hex pra rgba
  function toRgba(hex: string, alpha: number): string {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return {
    primary,
    primary2: toRgba(primary, 0.65),
    primarySoft: toRgba(primary, 0.12),
    primaryGhost: toRgba(primary, 0.06),
    primaryBorder: toRgba(primary, 0.25),
    accent,
    accent2: toRgba(accent, 0.7),
    accentSoft: toRgba(accent, 0.15),
    accentGhost: toRgba(accent, 0.08),
  };
}

const StudioAccentContext = createContext<StudioAccentTokens>(studioDefaultAccent);

export function StudioAccentTheme({ tokens, children }: { tokens: StudioAccentTokens; children: ReactNode }) {
  const value = useMemo(() => tokens, [tokens.primary, tokens.accent]);
  return <StudioAccentContext.Provider value={value}>{children}</StudioAccentContext.Provider>;
}

export function useStudioAccent(): StudioAccentTokens {
  return useContext(StudioAccentContext);
}
