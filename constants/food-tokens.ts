// ============================================================
// AURA Food — tokens de design (accent vermelho #EF4444).
// Espelha estrutura de constants/dental-tokens.ts.
//
// Uso: import { FoodColors, FoodGradients } from "@/constants/food-tokens";
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
