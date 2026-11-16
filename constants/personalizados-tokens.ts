// ============================================================
// AURA. — Personalizados: as cores do Negócio no formato do Studio (p-128)
//
// As telas do Studio (Produção, Orçamentos, Insumos...) leem as cores por
// useStudioTokens(), que devolve a paleta navy e magenta do shell /studio.
// Dentro do shell Negócio essas mesmas telas precisam das cores do Negócio
// (violeta #7c3aed, tema claro ou escuro do app). Este arquivo traduz a
// paleta do Negócio (constants/colors.ts) para o formato StudioPalette, e
// components/personalizados/TemaDoNegocio.tsx entrega a tradução às telas.
//
// O que vem do Negócio: marca (primary e accent), fundos, texto e bordas.
// O que continua do Studio: as cores de ESTADO (danger, warning, info,
// success). Elas são semânticas, iguais em qualquer shell, e já têm o
// contraste conferido nos dois temas (constants/studio-tokens.ts).
//
// Função pura: recebe a paleta e o tema, não lê hook nem módulo global.
// ============================================================
import type { AuraColors } from "@/constants/colors";
import { StudioColors, StudioColorsDark, type StudioPalette } from "@/constants/studio-tokens";

export function tokensDoNegocio(c: AuraColors, isDark: boolean): StudioPalette {
  const estado = (isDark ? StudioColorsDark : StudioColors) as unknown as StudioPalette;
  const tokens: Record<keyof StudioPalette, string> = {
    // ── Marca: violeta do Negócio ──────────────────────────
    primary:       c.violet,
    primary2:      c.violet2,
    primarySoft:   isDark ? "rgba(124,58,237,0.22)" : "#ede9fe",
    primaryGhost:  c.violetD,
    primaryBorder: c.border2,

    // O Negócio não tem segunda cor de marca: o destaque também é violeta.
    accent:        c.violet2,
    accent2:       c.violet3,
    accentSoft:    isDark ? "rgba(139,92,246,0.20)" : "#ede9fe",
    accentGhost:   c.violetD,
    accentInk:     c.violet4,

    // ── Complementares ─────────────────────────────────────
    warm:          c.amber,
    warmSoft:      isDark ? "rgba(251,191,36,0.18)" : "#fef3c7",
    mint:          c.green,
    mintSoft:      isDark ? "rgba(52,211,153,0.18)" : "#d1fae5",
    sky:           estado.sky,
    violet:        c.violet,

    // ── Fundos ─────────────────────────────────────────────
    bg:            c.bg,
    bgSoft:        isDark ? c.bg2 : c.bg4,
    paperCard:     c.bg3,
    paperCardElev: isDark ? c.bg4 : c.bg3,

    // ── Texto e divisores ──────────────────────────────────
    ink:           c.ink,
    ink2:          c.ink2,
    ink3:          c.ink3,
    ink4:          isDark ? "rgba(170,160,235,0.45)" : "#9a93b8",
    ink5:          isDark ? "rgba(255,255,255,0.10)" : "#d9d4ea",

    // ── Sombras ────────────────────────────────────────────
    shadowNavy:    isDark ? "0 8px 24px -6px rgba(0,0,0,0.6)" : "0 8px 24px -6px rgba(124,58,237,0.30)",
    shadowAccent:  isDark ? "0 8px 24px -6px rgba(0,0,0,0.5)" : "0 8px 24px -6px rgba(124,58,237,0.22)",

    // ── Estado: igual em qualquer shell ────────────────────
    danger:        estado.danger,
    dangerSoft:    estado.dangerSoft,
    dangerInk:     estado.dangerInk,
    warning:       estado.warning,
    warningSoft:   estado.warningSoft,
    warningInk:    estado.warningInk,
    info:          estado.info,
    infoSoft:      estado.infoSoft,
    infoInk:       estado.infoInk,
    success:       estado.success,
    successSoft:   estado.successSoft,
    successInk:    estado.successInk,
  };
  return tokens as unknown as StudioPalette;
}
