// ============================================================
// AURA STUDIO · Tokens V2 (Fase 8 — Design System Foundation)
//
// Consolida e expande os tokens originais (constants/studio-tokens.ts).
// V1 mantida pra backward compat.
//
// Adições V2:
//  - Escala numerada de cores (50-900) pra hover/active/disabled
//  - Spacing escala (4, 8, 12, 16, 24, 32...)
//  - Type scale completa (xs, sm, base, lg, xl, 2xl, 3xl, 4xl)
//  - Shadows nomeadas com tint da própria cor
//  - Easings + durations pra animação consistente
//
// Mockup mestre: Projects/Aura/mockup_studio_dashboard.html
// ============================================================

// ─── Cor primária (navy) ─────────────────────────────────────
export const navy = {
  50:  "#EFF6FF",
  100: "#DBEAFE",
  200: "#BFDBFE",
  300: "#93C5FD",
  400: "#60A5FA",
  500: "#3B82F6",   // primary-2
  600: "#2563EB",
  700: "#1D4ED8",
  800: "#1E40AF",
  900: "#1E3A8A",   // primary canônico
} as const;

// ─── Cor accent (magenta) ────────────────────────────────────
export const magenta = {
  50:  "#FDF2F8",
  100: "#FCE7F3",
  200: "#FBCFE8",
  300: "#F9A8D4",
  400: "#F472B6",   // accent-2
  500: "#EC4899",   // accent canônico
  600: "#DB2777",
  700: "#BE185D",
  800: "#9D174D",
  900: "#831843",
} as const;

// ─── Complementares (uso restrito conforme regra) ────────────
export const warm = {
  50: "#FFFBEB", 100: "#FEF3C7", 300: "#FCD34D",
  400: "#FBBF24", 500: "#F59E0B", 700: "#B45309", 900: "#78350F",
} as const;
export const mint = {
  50: "#ECFDF5", 100: "#D1FAE5", 300: "#6EE7B7",
  400: "#34D399", 500: "#10B981", 700: "#047857", 900: "#064E3B",
} as const;
export const sky = { 500: "#06B6D4", 400: "#38BDF8" } as const; // SÓ ícone Loja Digital
export const violet = { 500: "#7C3AED", 400: "#A78BFA" } as const; // SÓ ícone Caixa/PDV
export const slate = {
  50: "#F8FAFC", 100: "#F1F5F9", 200: "#E2E8F0",
  300: "#CBD5E1", 400: "#94A3B8", 500: "#64748B",
  700: "#334155", 900: "#0F172A",
} as const;

// ─── Semânticos (cor + uso) ──────────────────────────────────
export const StudioTokens = {
  // Primary / Accent
  primary:     navy[900],
  primaryHover: navy[700],
  primarySoft: navy[100],
  primaryGhost: navy[50],
  accent:      magenta[500],
  accentHover: magenta[600],
  accentSoft:  magenta[100],
  accentGhost: magenta[50],

  // Status
  success:     mint[500],
  successSoft: mint[100],
  warning:     warm[500],
  warningSoft: warm[100],
  danger:      "#DC2626",
  dangerSoft:  "#FEE2E2",
  info:        navy[500],
  infoSoft:    navy[100],

  // Background (escurecido conforme decisão Caio)
  bg:           "#E8E9F0",
  bgSoft:       "#EEF0F5",
  paperCard:    "#F5F6FA",
  paperCardElev: "#FFFFFF",

  // Ink (texto)
  ink:    slate[900],
  ink2:   slate[700],
  ink3:   "#5E6A7A",   // AA fix Fase 0 (era slate[500]=#64748B)
  ink4:   slate[400],
  ink5:   slate[300],

  // Borda padrão
  border:      slate[400],
  borderSoft:  slate[200],
} as const;

// ─── StudioTokensDark (Fase 0 redesign — paleta dark-first) ──
// Espelha StudioTokens (light) com paridade de chaves garantida por tipo.
// Dark é a paleta PRINCIPAL do Studio (DA-2). Validada AA no PR da Fase 0.
export const StudioTokensDark = {
  primary:      navy[500],
  primaryHover: navy[400],
  primarySoft:  "rgba(59,130,246,0.18)",
  primaryGhost: "rgba(59,130,246,0.08)",
  accent:       magenta[400],
  accentHover:  magenta[300],
  accentSoft:   "rgba(244,114,182,0.18)",
  accentGhost:  "rgba(244,114,182,0.08)",

  success:      "#34D399",
  successSoft:  "rgba(52,211,153,0.18)",
  warning:      "#FBBF24",
  warningSoft:  "rgba(251,191,36,0.18)",
  danger:       "#EF4444",
  dangerSoft:   "rgba(239,68,68,0.18)",
  info:         "#60A5FA",
  infoSoft:     "rgba(96,165,250,0.18)",

  bg:            "#0F172A",
  bgSoft:        "#1E293B",
  paperCard:     "#1E293B",
  paperCardElev: "#334155",

  ink:    "#F8FAFC",
  ink2:   "#CBD5E1",
  ink3:   "#94A3B8",
  ink4:   "#64748B",
  ink5:   "#334155",

  border:      "#475569",
  borderSoft:  "#334155",
} as const;

// Parity guard — StudioTokens (light) e StudioTokensDark com mesmas chaves.
type _TokensParity =
  keyof typeof StudioTokens extends keyof typeof StudioTokensDark
    ? keyof typeof StudioTokensDark extends keyof typeof StudioTokens
      ? true
      : never
    : never;
export const _STUDIO_TOKENS_PARITY: _TokensParity = true;

export function getStudioTokensV2(isDark: boolean) {
  return isDark ? StudioTokensDark : StudioTokens;
}


// ─── Gradientes nomeados (para LinearGradient) ──────────────
export const StudioGradientsV2 = {
  brand:    [navy[900], magenta[500]]   as const, // logo/hero
  primary:  [navy[900], navy[500]]      as const,
  accent:   [magenta[500], magenta[400]] as const,
  warm:     [warm[500], warm[400]]      as const,
  mint:     [mint[500], mint[400]]      as const,
  sky:      [sky[500], sky[400]]        as const,
  violet:   [violet[500], violet[400]]  as const,

  // Backgrounds soft pra cards e seções
  bgPink:   [magenta[50], "#FCE7F3"]   as const,
  bgCream:  [warm[50], warm[100]]      as const,
  bgMint:   [mint[50], mint[100]]      as const,
  bgNeutral: [slate[50], slate[100]]   as const,
} as const;

// ─── Radius (escala + orgânicos) ─────────────────────────────
export const StudioRadiusV2 = {
  none: 0,
  sm:   6,
  md:   10,
  lg:   14,
  xl:   18,
  "2xl": 22,
  "3xl": 28,
  pill: 999,
  full: 9999,

  // Border-radius assimétricos (string) — playful estudio
  organic1: "32px 22px 28px 30px",
  organic2: "26px 36px 22px 30px",
  organic3: "30px 24px 32px 24px",
  organic4: "24px 28px 28px 38px",
  bubble1:  "50% 50% 42% 58%",
  bubble2:  "46% 54% 50% 50%",
  bubble3:  "58% 42% 50% 50%",
  bubble4:  "42% 58% 50% 50%",
} as const;

// ─── Spacing (4-pt grid) ─────────────────────────────────────
export const space = {
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20,
  6: 24, 7: 28, 8: 32, 10: 40, 12: 48, 16: 64,
} as const;

// ─── Type scale ──────────────────────────────────────────────
export const text = {
  xs:   { fontSize: 10.5, lineHeight: 14 },
  sm:   { fontSize: 12,   lineHeight: 16 },
  base: { fontSize: 14,   lineHeight: 20 },
  lg:   { fontSize: 16,   lineHeight: 22 },
  xl:   { fontSize: 18,   lineHeight: 24 },
  "2xl": { fontSize: 22,  lineHeight: 28 },
  "3xl": { fontSize: 28,  lineHeight: 32 },
  "4xl": { fontSize: 36,  lineHeight: 38, letterSpacing: -0.5 },
} as const;

// Pesos
export const weight = {
  regular: "400",
  medium:  "500",
  semibold: "600",
  bold:    "700",
  black:   "800",
  ultra:   "900",
} as const;

// ─── Shadows nomeadas (com tint da própria cor) ──────────────
// Pra usar em web (boxShadow) — RN usa shadow* props.
export const StudioShadows = {
  sm:    "0 1px 2px rgba(15,23,42,0.05)",
  md:    "0 4px 12px -4px rgba(15,23,42,0.10), 0 2px 4px -1px rgba(15,23,42,0.05)",
  lg:    "0 12px 30px -10px rgba(15,23,42,0.18), 0 4px 8px -2px rgba(15,23,42,0.06)",
  navy:  "0 8px 24px -6px rgba(30,58,138,0.40)",
  accent: "0 8px 24px -6px rgba(236,72,153,0.35)",
  glass: "0 24px 50px -16px rgba(15,23,42,0.25)",
} as const;

// ─── Animação ────────────────────────────────────────────────
export const motion = {
  durations: { fast: 150, base: 250, slow: 400, ambient: 5000 },
  easings: {
    standard: "cubic-bezier(0.4, 0.0, 0.2, 1)",
    spring:   "cubic-bezier(0.34, 1.56, 0.64, 1)",
    sine:     "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
  },
} as const;

// ─── Re-export V1 pra compat (não quebrar imports existentes) ─
export { StudioColors, StudioGradients, StudioRadius, StudioFloat } from "@/constants/studio-tokens";

export type StudioTokenKey = keyof typeof StudioTokens;
