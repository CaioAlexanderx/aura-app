// ============================================================
// AURA Food — tokens de design (accent vermelho #EF4444).
// Espelha estrutura de constants/dental-tokens.ts.
//
// Uso: import { FoodColors, FoodGradients } from "@/constants/food-tokens";
//
// legacy v1 — Fase 9 introduz tokens v2 abaixo
// ============================================================

export const FoodColors = {
  // Backgrounds
  bg:           "#0a0a1a",
  surface:      "#14142b",
  surface2:     "#1a1a2e",
  surface3:     "#232347",
  border:       "#2a2a4a",
  borderStrong: "#3a3a5e",

  // Ink (text)
  ink:  "#fff",
  ink2: "#cbd5e1",
  ink3: "#94a3b8",
  ink4: "#64748b",

  // Accent (food = vermelho)
  red:    "#EF4444",
  redDim: "rgba(239,68,68,0.15)",
  red2:   "#dc2626",
  orange: "#f97316",

  // Status
  green:  "#10B981",
  amber:  "#F59E0B",
  cyan:   "#06B6D4",
  rose:   "#f43f5e",
  violet: "#7c3aed",
} as const;

export const FoodGradients = {
  shellBg:    "linear-gradient(180deg, #0a0a1a 0%, #14142b 100%)",
  heroAccent: "linear-gradient(135deg, #EF4444, #f97316)",
} as const;

// ============================================================
// AURA FOOD · DESIGN TOKENS v2 (Fase 9 — 22/05/2026)
// Paleta canônica memory aura_food_principios_design:
// - primary #EF4444 (cherry)
// - violet  #7c3aed (accent Aura)
// - bg light (alma Aura em light glassmorphism)
//
// Os tokens v1 acima (FoodColors red/orange) ficam mantidos
// por backward compat — telas atuais continuam funcionando.
// Telas novas (Hub de Pedidos, refresh fases 10-13) usam v2.
// ============================================================

export const FoodTokensV2 = {
  // Brand
  primary:        "#EF4444",
  primaryDark:    "#DC2626",
  primarySoft:    "rgba(239, 68, 68, 0.08)",
  primaryLine:    "rgba(239, 68, 68, 0.22)",
  primaryGlow:    "rgba(239, 68, 68, 0.45)",

  // Aura accent
  violet:         "#7c3aed",
  violet2:        "#a78bfa",
  violet3:        "#c4b5fd",
  violetSoft:     "rgba(124, 58, 237, 0.10)",
  violetLine:     "rgba(124, 58, 237, 0.18)",

  // Heat (logo core)
  heat:           "#FCD34D",

  // Surfaces (light glass)
  bg:             "#fafaf9",
  bg2:            "#f5f5f4",
  surface:        "rgba(255, 255, 255, 0.72)",
  surfaceStrong:  "rgba(255, 255, 255, 0.90)",
  surfaceFlat:    "#ffffff",

  // Ink
  ink:            "#0a0a0f",
  ink2:           "#1f2937",
  ink3:           "#4b5563",
  ink4:           "#9ca3af",
  ink5:           "#e5e7eb",

  // Lines
  line:           "rgba(15, 23, 42, 0.06)",
  line2:          "rgba(15, 23, 42, 0.10)",

  // Status
  stNovo:         "#EF4444",
  stPrep:         "#F59E0B",
  stPronto:       "#10B981",
  stRota:         "#7c3aed",

  // Channels (cores oficiais marcas)
  cIfood:         "#EA1D2C",
  c99food:        "#FFD400",
  c99foodText:    "#0a0a0f",
  cWhatsapp:      "#25D366",
  cPresencial:    "#0EA5E9",
  cDigital:       "#7c3aed",

  // Radii
  rSm:  8,
  rMd:  12,
  rLg:  18,
  rXl:  24,

  // Shadows (light)
  shadowSm:  "0 1px 2px rgba(15, 23, 42, 0.04)",
  shadowMd:  "0 4px 12px rgba(15, 23, 42, 0.06)",
  shadowLg:  "0 12px 32px rgba(15, 23, 42, 0.08)",
  shadowRed: "0 8px 24px rgba(239, 68, 68, 0.25)",
} as const;

// Gradientes assinatura
export const FoodGradientsV2 = {
  flame:           "linear-gradient(135deg, #EF4444 0%, #7c3aed 100%)",
  flameVertical:   "linear-gradient(180deg, #EF4444 0%, #7c3aed 100%)",
  conicSignature:  "conic-gradient(from 200deg at 50% 50%, #EF4444 0deg, #7c3aed 180deg, #EF4444 360deg)",
  cherryRadial:    "radial-gradient(circle, rgba(239,68,68,0.16) 0%, transparent 65%)",
  violetRadial:    "radial-gradient(circle, rgba(124,58,237,0.14) 0%, transparent 65%)",
  heatCore:        "radial-gradient(circle, #FCD34D 0%, transparent 60%)",
} as const;
