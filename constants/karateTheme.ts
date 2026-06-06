// ============================================================
// KARATE (SHOJI) TOKENS — Aura Karatê
//
// Identidade visual: vermelho #B91C1C como primary (não violeta).
// Shoji = sistema de design Aura para o vertical karate_federation.
//
// Espelha estrutura de constants/dental-tokens.ts e food-tokens.ts.
// Importar: import { KarateColors, KarateBelts, KarateStatus } from "@/constants/karateTheme";
//
// Regra de acessibilidade: indicadores de status SEMPRE usam icon+texto,
// NUNCA cor isolada (WCAG 1.4.1 Use of Color).
// ============================================================

// ─────────────────────────────────────────────────────────────
// Primitivos Shoji — paleta completa
// ─────────────────────────────────────────────────────────────
export const ShojiPalette = {
  // Brand vermelho federação
  red:         "#B91C1C",
  redSoft:     "#FEE2E2",

  // Ink (texto)
  ink:         "#1C1714",
  ink2:        "#4A3728",
  ink3:        "#8B6F5E",
  ink4:        "#C4A882",

  // Superfícies
  paper:       "#FDFAF5",
  surface:     "#F7F3EB",
  line:        "#E8E0D0",

  // Status semantic
  ok:          "#15803D",
  okSoft:      "#DCFCE7",
  warn:        "#B45309",
  warnSoft:    "#FEF3C7",
  alert:       "#C2410C",
  alertSoft:   "#FFEDD5",
  danger:      "#B91C1C",
  dangerSoft:  "#FEE2E2",
  neutral:     "#6B7280",
  neutralSoft: "#F3F4F6",
} as const;

// ─────────────────────────────────────────────────────────────
// KarateColors — alias semânticos para consumo nos componentes
// ─────────────────────────────────────────────────────────────
export const KarateColors = {
  // Primary vermelho
  primary:        ShojiPalette.red,
  primarySoft:    ShojiPalette.redSoft,
  primaryDim:     "rgba(185,28,28,0.12)",
  primaryLine:    "rgba(185,28,28,0.25)",

  // Backgrounds
  bg:             ShojiPalette.paper,
  bg2:            ShojiPalette.surface,
  surface:        ShojiPalette.surface,
  border:         ShojiPalette.line,

  // Ink
  ink:            ShojiPalette.ink,
  ink2:           ShojiPalette.ink2,
  ink3:           ShojiPalette.ink3,
  ink4:           ShojiPalette.ink4,

  // Status
  ok:             ShojiPalette.ok,
  okSoft:         ShojiPalette.okSoft,
  warn:           ShojiPalette.warn,
  warnSoft:       ShojiPalette.warnSoft,
  alert:          ShojiPalette.alert,
  alertSoft:      ShojiPalette.alertSoft,
  danger:         ShojiPalette.danger,
  dangerSoft:     ShojiPalette.dangerSoft,
  neutral:        ShojiPalette.neutral,
  neutralSoft:    ShojiPalette.neutralSoft,
} as const;

// ─────────────────────────────────────────────────────────────
// Radius tokens
// ─────────────────────────────────────────────────────────────
export const KarateRadius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

// ─────────────────────────────────────────────────────────────
// Typography tokens
// Body: Inter (RN fallback: System)
// Mono: JetBrains Mono (RN fallback: monospace) — usar em IDs, números
// ─────────────────────────────────────────────────────────────
export const KarateFonts = {
  body:    "Inter",
  mono:    "JetBrainsMono",
} as const;

// ─────────────────────────────────────────────────────────────
// Status do Dojô — mapeamento label + ícone + cor
// Regra: SEMPRE usar label + ícone, nunca só cor.
// ─────────────────────────────────────────────────────────────
export type DojoStatus = "active" | "expiring" | "overdue" | "defaulting" | "suspended";

export const KarateDojoStatus: Record<DojoStatus, {
  label: string;
  icon:  string;   // nome do ícone Ionicons
  color: string;   // cor de foreground
  bg:    string;   // cor de fundo do badge
}> = {
  active:     { label: "Ativo",       icon: "checkmark-circle", color: ShojiPalette.ok,      bg: ShojiPalette.okSoft },
  expiring:   { label: "A vencer",    icon: "alert-circle",     color: ShojiPalette.warn,    bg: ShojiPalette.warnSoft },
  overdue:    { label: "Vencido",     icon: "warning",          color: ShojiPalette.alert,   bg: ShojiPalette.alertSoft },
  defaulting: { label: "Inadimplente",icon: "close-circle",     color: ShojiPalette.danger,  bg: ShojiPalette.dangerSoft },
  suspended:  { label: "Suspenso",    icon: "ban",              color: ShojiPalette.neutral,  bg: ShojiPalette.neutralSoft },
} as const;

// ─────────────────────────────────────────────────────────────
// Status do Praticante — mapeamento label + ícone + cor
// ─────────────────────────────────────────────────────────────
export type AffiliationStatus = "active" | "pending" | "inactive";

export const KarateAffiliationStatus: Record<AffiliationStatus, {
  label: string;
  icon:  string;
  color: string;
  bg:    string;
}> = {
  active:   { label: "Ativo",     icon: "checkmark-circle", color: ShojiPalette.ok,     bg: ShojiPalette.okSoft },
  pending:  { label: "Pendente",  icon: "time",             color: ShojiPalette.warn,   bg: ShojiPalette.warnSoft },
  inactive: { label: "Inativo",  icon: "close-circle",     color: ShojiPalette.neutral, bg: ShojiPalette.neutralSoft },
} as const;

// ─────────────────────────────────────────────────────────────
// Faixas (Belt) — cores e metadados
// is_legacy = true → badge "Histórico" (BeltBadge)
// ─────────────────────────────────────────────────────────────
export type BeltKey =
  | "branca" | "amarela" | "laranja" | "verde"
  | "azul_claro" | "roxo" | "azul_escuro"
  | "vermelha" | "marrom" | "preta";

export const KarateBelts: Record<BeltKey, {
  label:     string;
  color:     string;   // cor de fundo da faixa
  textColor: string;   // cor do texto sobre a faixa
  isLegacy?: boolean;  // true → disponível apenas em belt_schema=legacy
}> = {
  branca:      { label: "Branca",       color: "#FFFFFF", textColor: ShojiPalette.ink },
  amarela:     { label: "Amarela",      color: "#F4C430", textColor: ShojiPalette.ink },
  laranja:     { label: "Laranja",      color: "#E8772E", textColor: "#FFFFFF" },
  verde:       { label: "Verde",        color: "#2E8B57", textColor: "#FFFFFF" },
  azul_claro:  { label: "Azul Claro",   color: "#5BA7D6", textColor: "#FFFFFF" },
  roxo:        { label: "Roxa",         color: "#6B4C9A", textColor: "#FFFFFF" },
  azul_escuro: { label: "Azul Escuro",  color: "#1E3A8A", textColor: "#FFFFFF" },
  vermelha:    { label: "Vermelha",     color: "#C0392B", textColor: "#FFFFFF", isLegacy: true },
  marrom:      { label: "Marrom",       color: "#6B4226", textColor: "#FFFFFF" },
  preta:       { label: "Preta",        color: "#1C1714", textColor: "#FFFFFF" },
} as const;

// Helper: resolve belt key a partir de belt_level string da API
export function resolveBeltKey(beltLevel: string): BeltKey | null {
  const map: Record<string, BeltKey> = {
    branca: "branca", amarela: "amarela", laranja: "laranja",
    verde: "verde", azul_claro: "azul_claro", roxo: "roxo",
    azul_escuro: "azul_escuro", vermelha: "vermelha",
    marrom: "marrom", preta: "preta",
    // kyus comuns em notação numérica
    "9kyu": "branca", "8kyu": "amarela", "7kyu": "laranja",
    "6kyu": "verde",  "5kyu": "azul_claro", "4kyu": "azul_escuro",
    "3kyu": "marrom", "2kyu": "marrom", "1kyu": "marrom",
    "1dan": "preta",  "2dan": "preta", "3dan": "preta",
  };
  return map[beltLevel.toLowerCase()] ?? null;
}

// ─────────────────────────────────────────────────────────────
// KarateStatus — alias curto para status semânticos
// (usado nos componentes Badge e KPIStrip)
// ─────────────────────────────────────────────────────────────
export const KarateStatus = {
  ok:      { color: ShojiPalette.ok,     bg: ShojiPalette.okSoft,      icon: "checkmark-circle" as const },
  warn:    { color: ShojiPalette.warn,   bg: ShojiPalette.warnSoft,    icon: "alert-circle"     as const },
  alert:   { color: ShojiPalette.alert,  bg: ShojiPalette.alertSoft,   icon: "warning"          as const },
  danger:  { color: ShojiPalette.danger, bg: ShojiPalette.dangerSoft,  icon: "close-circle"     as const },
  neutral: { color: ShojiPalette.neutral,bg: ShojiPalette.neutralSoft, icon: "ellipse-outline"  as const },
} as const;

export type KarateStatusKey = keyof typeof KarateStatus;
