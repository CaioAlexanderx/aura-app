// ============================================================
// STUDIO TOKENS — Aura Studio (personalizados)
//
// Aprovado em 24/05/2026 com Caio.
// Paleta dedicada ao vertical. NÃO usar fora do shell /studio.
//
// Light theme. Primary navy #1E3A8A, accent magenta #EC4899.
// Distinta de varejo (violeta #7c3aed), Food (vermelho #EF4444)
// e Odonto (cyan #06B6D4, ver constants/dental-tokens.ts).
//
// Identidade visual: bolhas orgânicas (border-radius assimétrico),
// gradientes navy↔magenta, flutuação suave.
//
// Doc: Projects/Aura/BACKLOG_AURA_STUDIO.md
// Memory: plano_aura_studio_vertical_24mai2026
//
// 25/05/2026 (Fase 0 UX overhaul) — adicionados tokens semanticos
// (danger/warning/info/success + soft/ink variants) pra padronizar
// estados pelo app e parar de hardcodar #F59E0B, #FEE2E2, etc.
// ============================================================

export const StudioColors = {
  // ── Primary navy ─────────────────────────────────────────
  primary:       "#1E3A8A",
  primary2:      "#3B82F6",
  primarySoft:   "#DBEAFE",
  primaryGhost:  "#EFF6FF",
  primaryBorder: "rgba(30,58,138,0.25)",

  // ── Accent magenta ───────────────────────────────────────
  accent:        "#EC4899",
  accent2:       "#F472B6",
  accentSoft:    "#FCE7F3",
  accentGhost:   "#FDF2F8",

  // ── Cores complementares pras bolinhas-filhas ────────────
  warm:          "#F59E0B",
  warmSoft:      "#FEF3C7",
  mint:          "#10B981",
  mintSoft:      "#D1FAE5",
  sky:           "#06B6D4",   // SÓ pra ícone de Loja Digital (colide com Odonto se usar em grande área)
  violet:        "#7C3AED",   // SÓ pra ícone de Caixa/PDV (colide com varejo)

  // ── Background (escurecido ~15% vs mockup playful original) ──
  bg:            "#E8E9F0",       // shell bg (slate-100 levemente azulado)
  bgSoft:        "#EEF0F5",       // bg de cards secundários
  paperCard:     "#F5F6FA",       // bg padrão de cards (era #FFFFFF puro)
  paperCardElev: "#FFFFFF",       // cards elevados (modals, hero)

  // ── Ink (texto) ──────────────────────────────────────────
  ink:           "#0F172A",
  ink2:          "#334155",
  ink3:          "#64748B",
  ink4:          "#94A3B8",       // bordas padrão de cards/nav inativos
  ink5:          "#CBD5E1",       // divisores

  // ── Sombras coloridas ────────────────────────────────────
  shadowNavy:    "0 8px 24px -6px rgba(30,58,138,0.4)",
  shadowAccent:  "0 8px 24px -6px rgba(236,72,153,0.35)",

  // ════════════════════════════════════════════════════════
  // TOKENS SEMÂNTICOS (Fase 0 UX overhaul — 25/05/2026)
  //
  // Use SEMPRE estes pra estados (erro, alerta, info, sucesso).
  // NUNCA hardcode #DC2626/#F59E0B/#3B82F6/#10B981 nas telas.
  // Padrão tripla: cor base + soft (background) + ink (texto sobre soft).
  // ════════════════════════════════════════════════════════

  // ── Danger (erro, destrutivo, alerta crítico) ────────────
  danger:        "#DC2626",
  dangerSoft:    "#FEE2E2",
  dangerInk:     "#991B1B",

  // ── Warning (atenção, prazo apertado) ────────────────────
  warning:       "#F59E0B",
  warningSoft:   "#FEF3C7",
  warningInk:    "#92400E",

  // ── Info (informação neutra, hints) ──────────────────────
  info:          "#3B82F6",       // = primary2 (navy claro)
  infoSoft:      "#DBEAFE",       // = primarySoft
  infoInk:       "#1E3A8A",       // = primary

  // ── Success (confirmação, sucesso) ───────────────────────
  success:       "#10B981",       // = mint (mantido alias pra clareza)
  successSoft:   "#D1FAE5",       // = mintSoft
  successInk:    "#065F46",
} as const;

// ── Gradientes nomeados ───────────────────────────────────
export const StudioGradients = {
  primary: ["#1E3A8A", "#3B82F6"] as const,
  accent:  ["#EC4899", "#F472B6"] as const,
  warm:    ["#F59E0B", "#FBBF24"] as const,
  mint:    ["#10B981", "#34D399"] as const,
  sky:     ["#06B6D4", "#38BDF8"] as const,
  violet:  ["#7C3AED", "#A78BFA"] as const,
  brand:   ["#1E3A8A", "#EC4899"] as const, // navy → magenta (logo / hero)
} as const;

// ── Border-radius orgânicos (presets) ─────────────────────
// Variar entre eles dá o feel playful sem caos visual.
export const StudioRadius = {
  organic1: "32px 22px 28px 30px",
  organic2: "26px 36px 22px 30px",
  organic3: "30px 24px 32px 24px",
  organic4: "24px 28px 28px 38px",
  bubble1:  "50% 50% 42% 58%",      // pra bolhas-ícone
  bubble2:  "46% 54% 50% 50%",
  bubble3:  "58% 42% 50% 50%",
  bubble4:  "42% 58% 50% 50%",
  pill:     "999px",
} as const;

// ── Animações de flutuação (durações + delays) ────────────
// Use com Animated.loop pra simular balões soltos.
export const StudioFloat = {
  durationsMs: [5400, 6200, 5800, 6600, 6000],
  delaysMs:    [0, -1400, -2600, -900, -1800],
  amplitudePx: 4,
  rotationDeg: 1.5,
} as const;

export type StudioColorKey = keyof typeof StudioColors;
export type StudioGradientKey = keyof typeof StudioGradients;
