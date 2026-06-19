// ============================================================
// KARATE (SHOJI) TOKENS — Aura Karatê · 障子 Shoji / Kinari
//
// Tokens CANÔNICOS do Design System Shoji (fonte: _ds_manifest.json
// do "Aura Karate - design system"). Papel de arroz opaco, sumi (tinta),
// vermelhão de carimbo como acento RARO (~5%), sombras quentes em
// camadas (nunca glow), muito "ma".
//
// Regras invioláveis: papel opaco (nunca glass iOS) · vermelho cerimonial
// · Shippori Mincho leve (nunca bold pesado) · sem emoji (só o selo 空)
// · status SEMPRE icon+texto, nunca cor isolada (WCAG 1.4.1).
//
// Compatibilidade: mantém todos os nomes de export anteriores (valores
// atualizados pro canônico); novos tokens (heading, type, shadows,
// spacing, glass) adicionados pro kit Shoji.
// ============================================================
import { Platform } from "react-native";

// ─────────────────────────────────────────────────────────────
// Primitivos Shoji — paleta canônica
// ─────────────────────────────────────────────────────────────
export const ShojiPalette = {
  // Papel de arroz (fundos)
  paper:       "#f0ebe0",
  paperWarm:   "#f6f1e7",
  paper2:      "#ece5d8",
  paper3:      "#e7e0d1",

  // Sumi (tinta) — texto/estrutura, 4 níveis dessaturados
  ink:         "#2b2620",
  ink2:        "#6a6154",
  ink3:        "#9b9180",
  ink4:        "#c1b8a7",

  // Hairlines
  line:        "rgba(43,38,32,0.10)",
  line2:       "rgba(43,38,32,0.17)",

  // Vidro de papel (superfícies de card) — opaco, NÃO glass iOS
  glass:       "rgba(250,247,240,0.92)",
  glass2:      "rgba(252,250,245,0.96)",
  glassHi:     "rgba(255,253,249,0.98)",

  // Vermelhão de carimbo (hanko) — acento RARO
  red:         "#b8463a",
  red2:        "#9d3a30",
  red3:        "#843027",
  redWash:     "rgba(184,70,58,0.08)",
  redLine:     "rgba(184,70,58,0.42)",
  headRed:     "#a44c3e",   // faixa oxblood do header

  // Verde-chá — só "em dia / aprovado"
  ok:          "#4a7a48",
  okWash:      "rgba(74,122,72,0.12)",
  okLine:      "rgba(74,122,72,0.30)",

  // Semânticos auxiliares (warm, dessaturados — coerência Shoji)
  warn:        "#9c6f2e",
  warnWash:    "rgba(156,111,46,0.12)",
  alert:       "#a8543a",
  alertWash:   "rgba(168,84,58,0.12)",
  danger:      "#b8463a",
  dangerWash:  "rgba(184,70,58,0.10)",
  neutral:     "#6a6154",
  neutralWash: "rgba(43,38,32,0.05)",

  // ── compat (nomes antigos *Soft) ──
  redSoft:     "rgba(184,70,58,0.08)",
  surface:     "#f6f1e7",
  okSoft:      "rgba(74,122,72,0.12)",
  warnSoft:    "rgba(156,111,46,0.12)",
  alertSoft:   "rgba(168,84,58,0.12)",
  dangerSoft:  "rgba(184,70,58,0.10)",
  neutralSoft: "rgba(43,38,32,0.05)",
} as const;

// ─────────────────────────────────────────────────────────────
// KarateColors — alias semânticos
// ─────────────────────────────────────────────────────────────
export const KarateColors = {
  // Acento vermelhão (raro). NB: botão PRIMÁRIO Shoji = sumi (ink), não red.
  primary:        ShojiPalette.red,
  primary2:       ShojiPalette.red2,
  primarySoft:    ShojiPalette.redWash,
  primaryDim:     "rgba(184,70,58,0.12)",
  primaryLine:    ShojiPalette.redLine,
  headRed:        ShojiPalette.headRed,

  // Backgrounds / superfícies
  bg:             ShojiPalette.paper,
  bg2:            ShojiPalette.paper2,
  paperWarm:      ShojiPalette.paperWarm,
  surface:        ShojiPalette.paperWarm,
  glass:          ShojiPalette.glass,
  glass2:         ShojiPalette.glass2,
  glassHi:        ShojiPalette.glassHi,
  border:         ShojiPalette.line,
  border2:        ShojiPalette.line2,
  line:           ShojiPalette.line,
  line2:          ShojiPalette.line2,

  // Ink
  ink:            ShojiPalette.ink,
  ink2:           ShojiPalette.ink2,
  ink3:           ShojiPalette.ink3,
  ink4:           ShojiPalette.ink4,

  // Sumi (botões primários Shoji)
  sumi:           ShojiPalette.ink,

  // Status
  ok:             ShojiPalette.ok,
  okSoft:         ShojiPalette.okWash,
  okLine:         ShojiPalette.okLine,
  warn:           ShojiPalette.warn,
  warnSoft:       ShojiPalette.warnWash,
  alert:          ShojiPalette.alert,
  alertSoft:      ShojiPalette.alertWash,
  danger:         ShojiPalette.danger,
  dangerSoft:     ShojiPalette.dangerWash,
  neutral:        ShojiPalette.neutral,
  neutralSoft:    ShojiPalette.neutralWash,
} as const;

// ─────────────────────────────────────────────────────────────
// Radius — canônico 7/10/14/18 + pill
// ─────────────────────────────────────────────────────────────
export const KarateRadius = {
  sm:   7,
  md:   10,
  lg:   14,
  xl:   18,
  pill: 999,
} as const;

// ─────────────────────────────────────────────────────────────
// Fontes Shoji. No web, carregadas via Google Fonts (useShojiFonts).
// No nativo, fallback de sistema até @expo-google-fonts (paridade).
// Display/títulos: Shippori Mincho (serifa de pincel, 400–500).
// Corpo: Zen Kaku Gothic New. Dados/IDs/números: DM Mono (tabular).
// ─────────────────────────────────────────────────────────────
export const KarateFonts = {
  heading: Platform.select({ web: "'Shippori Mincho', 'Times New Roman', serif", default: "ShipporiMincho" }) as string,
  body:    Platform.select({ web: "'Zen Kaku Gothic New', system-ui, sans-serif", default: "ZenKakuGothicNew" }) as string,
  mono:    Platform.select({ web: "'DM Mono', ui-monospace, monospace", default: "DMMono" }) as string,
} as const;

// ─────────────────────────────────────────────────────────────
// Tipografia — escala canônica
// ─────────────────────────────────────────────────────────────
export const KarateType = {
  display: 52,
  h1:      36,
  h2:      27,
  h3:      21,
  kpi:     48,
  body:    13,
  sm:      12,
  xs:      11,
  label:   10.5,
  trackingLabel:   0.10,  // em → multiplicar por fontSize no RN (letterSpacing)
  trackingEyebrow: 0.16,
} as const;

// ─────────────────────────────────────────────────────────────
// Sombras quentes (nunca glow). Web usa boxShadow em camadas;
// nativo aproxima com sombra quente única.
// ─────────────────────────────────────────────────────────────
export const KarateShadows = {
  sm: Platform.select({
    web:     { boxShadow: "0 1px 2px rgba(43,38,32,0.04), 0 8px 22px -14px rgba(43,38,32,0.32)" } as any,
    default: { shadowColor: "#2b2620", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 2 } as any,
  }),
  card: Platform.select({
    web:     { boxShadow: "0 1px 2px rgba(43,38,32,0.03), 0 18px 50px -28px rgba(43,38,32,0.30)" } as any,
    default: { shadowColor: "#2b2620", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 4 } as any,
  }),
  dry: Platform.select({
    web:     { boxShadow: "4px 4px 0 rgba(43,38,32,0.10)" } as any,
    default: { shadowColor: "#2b2620", shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.10, shadowRadius: 0, elevation: 2 } as any,
  }),
} as const;

// ─────────────────────────────────────────────────────────────
// Espaçamento base-4
// ─────────────────────────────────────────────────────────────
export const KarateSpacing = {
  1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 15: 60,
  sidebar: 236,
  contentMax: 1220,
} as const;

// ─────────────────────────────────────────────────────────────
// Status do Dojô — label + ícone + cor (sempre icon+texto)
// ─────────────────────────────────────────────────────────────
export type DojoStatus = "active" | "expiring" | "overdue" | "defaulting" | "suspended";

export const KarateDojoStatus: Record<DojoStatus, {
  label: string; icon: string; color: string; bg: string;
}> = {
  active:     { label: "Ativo",        icon: "checkmark-circle", color: ShojiPalette.ok,      bg: ShojiPalette.okWash },
  expiring:   { label: "A vencer",     icon: "alert-circle",     color: ShojiPalette.warn,    bg: ShojiPalette.warnWash },
  overdue:    { label: "Vencido",      icon: "warning",          color: ShojiPalette.alert,   bg: ShojiPalette.alertWash },
  defaulting: { label: "Inadimplente", icon: "close-circle",     color: ShojiPalette.danger,  bg: ShojiPalette.dangerWash },
  suspended:  { label: "Suspenso",     icon: "ban",              color: ShojiPalette.neutral, bg: ShojiPalette.neutralWash },
} as const;

// ─────────────────────────────────────────────────────────────
// Status do Praticante
// ─────────────────────────────────────────────────────────────
export type AffiliationStatus = "active" | "pending" | "inactive";

export const KarateAffiliationStatus: Record<AffiliationStatus, {
  label: string; icon: string; color: string; bg: string;
}> = {
  active:   { label: "Ativo",    icon: "checkmark-circle", color: ShojiPalette.ok,      bg: ShojiPalette.okWash },
  pending:  { label: "Pendente", icon: "time",             color: ShojiPalette.warn,    bg: ShojiPalette.warnWash },
  inactive: { label: "Inativo",  icon: "close-circle",     color: ShojiPalette.neutral, bg: ShojiPalette.neutralWash },
} as const;

// ─────────────────────────────────────────────────────────────
// Faixas (Belt) — paleta DESSATURADA canônica (10 faixas Shotokan)
// ─────────────────────────────────────────────────────────────
export type BeltKey =
  | "branca" | "amarela" | "laranja" | "verde"
  | "azul_claro" | "roxo" | "azul_escuro"
  | "vermelha" | "marrom" | "preta";

export const KarateBelts: Record<BeltKey, {
  label: string; color: string; textColor: string; isLegacy?: boolean;
}> = {
  branca:      { label: "Branca",      color: "#e0d8c6", textColor: ShojiPalette.ink },
  amarela:     { label: "Amarela",     color: "#cfaa48", textColor: ShojiPalette.ink },
  laranja:     { label: "Laranja",     color: "#c06f35", textColor: "#fdf8f2" },
  verde:       { label: "Verde",       color: "#56804c", textColor: "#fdf8f2" },
  azul_claro:  { label: "Azul Claro",  color: "#73a0b8", textColor: "#fdf8f2" },
  roxo:        { label: "Roxa",        color: "#75568c", textColor: "#fdf8f2" },
  azul_escuro: { label: "Azul Escuro", color: "#374d6e", textColor: "#fdf8f2" },
  vermelha:    { label: "Vermelha",    color: "#a14a3e", textColor: "#fdf8f2", isLegacy: true },
  marrom:      { label: "Marrom",      color: "#7a4e30", textColor: "#fdf8f2" },
  preta:       { label: "Preta",       color: "#2b2620", textColor: "#fdf8f2" },
} as const;

// Helper: resolve belt key a partir do belt_level da API
export function resolveBeltKey(beltLevel: string): BeltKey | null {
  const map: Record<string, BeltKey> = {
    branca: "branca", amarela: "amarela", laranja: "laranja",
    verde: "verde", azul_claro: "azul_claro", roxo: "roxo",
    azul_escuro: "azul_escuro", vermelha: "vermelha",
    marrom: "marrom", preta: "preta",
    "9kyu": "branca", "8kyu": "amarela", "7kyu": "laranja",
    "6kyu": "verde",  "5kyu": "azul_claro", "4kyu": "azul_escuro",
    "3kyu": "marrom", "2kyu": "marrom", "1kyu": "marrom",
    "1dan": "preta",  "2dan": "preta", "3dan": "preta",
  };
  return map[beltLevel.toLowerCase()] ?? null;
}

// ─────────────────────────────────────────────────────────────
// KarateStatus — alias curto (Badge, KPIStrip)
// ─────────────────────────────────────────────────────────────
export const KarateStatus = {
  ok:      { color: ShojiPalette.ok,      bg: ShojiPalette.okWash,      icon: "checkmark-circle" as const },
  warn:    { color: ShojiPalette.warn,    bg: ShojiPalette.warnWash,    icon: "alert-circle"     as const },
  alert:   { color: ShojiPalette.alert,   bg: ShojiPalette.alertWash,   icon: "warning"          as const },
  danger:  { color: ShojiPalette.danger,  bg: ShojiPalette.dangerWash,  icon: "close-circle"     as const },
  neutral: { color: ShojiPalette.neutral, bg: ShojiPalette.neutralWash, icon: "ellipse-outline"  as const },
} as const;

export type KarateStatusKey = keyof typeof KarateStatus;
