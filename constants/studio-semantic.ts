// ============================================================
// AURA STUDIO · StudioSemantic — fonte ÚNICA de cor de estado
//
// Fase 0 do redesign (30/05/2026). Guardrail DURO §3.1.2:
//   "Cor de estado é semântica e universal. NUNCA magenta para estado."
//
// Antes deste módulo, a cor de estado vivia hardcoded em
// constants/studio-status.ts (light-only) — inclusive usava ROSA
// (#FCE7F3/#9D174D) para `awaiting_customization`, violando o guardrail.
// Agora toda cor de estado nasce aqui, é theme-aware (light + dark) e
// validada em contraste WCAG AA (laudo no PR da Fase 0).
//
// Mapeamento canônico de intents (guardrail):
//   aprovado = verde · aguardando = âmbar · em produção = azul ·
//   recusado/atrasado = vermelho.
// Estados adjacentes no board (KDS) ganham hues distintos dentro da
// mesma família para legibilidade coluna-a-coluna; o RÓTULO (pt-BR)
// carrega a especificidade, a COR carrega a fase/severidade.
//
// Tripla por intent: base (ponto/ícone, >=3:1 sobre card) ·
// soft (fundo do chip) · ink (texto sobre soft, >=4.5:1).
//
// Consumir via useStudioSemantic() (contexts/StudioThemeMode.tsx).
// ============================================================

export type StudioIntent =
  | "waiting"      // aguardando (âmbar)
  | "art"          // aguardando arte (laranja — 2o estágio de espera)
  | "approved"     // aprovado (verde)
  | "production"   // em produção (azul)
  | "ready"        // pronto pra entrega (teal — positivo, distinto do approved)
  | "delivered"    // entregue (neutro)
  | "danger"       // recusado / cancelado / atrasado / expirado (vermelho)
  | "changes"      // ajuste pedido (rosa-vermelho — atenção destrutiva leve)
  | "neutral";     // rascunho / sem estado

export type SemanticTriple = { base: string; soft: string; ink: string };
export type StudioSemanticPalette = Record<StudioIntent, SemanticTriple>;

// ─── DARK (paleta PRINCIPAL — dark-first, DA-2) ──────────────
// soft = rgba sobre card #1E293B; ink = tom claro do hue.
export const StudioSemanticDark: StudioSemanticPalette = {
  waiting:    { base: "#FBBF24", soft: "rgba(251,191,36,0.18)", ink: "#FCD34D" },
  art:        { base: "#FB923C", soft: "rgba(251,146,60,0.18)", ink: "#FDBA74" },
  approved:   { base: "#34D399", soft: "rgba(52,211,153,0.18)", ink: "#6EE7B7" },
  production: { base: "#60A5FA", soft: "rgba(96,165,250,0.18)", ink: "#93C5FD" },
  ready:      { base: "#2DD4BF", soft: "rgba(45,212,191,0.18)", ink: "#5EEAD4" },
  delivered:  { base: "#94A3B8", soft: "rgba(148,163,184,0.16)", ink: "#CBD5E1" },
  danger:     { base: "#F87171", soft: "rgba(248,113,113,0.18)", ink: "#FCA5A5" },
  changes:    { base: "#FB7185", soft: "rgba(251,113,133,0.18)", ink: "#FDA4AF" },
  neutral:    { base: "#64748B", soft: "rgba(100,116,139,0.16)", ink: "#CBD5E1" },
};

// ─── LIGHT ───────────────────────────────────────────────────
// soft = hex sólido claro; ink = tom escuro do hue (>=4.5:1).
export const StudioSemanticLight: StudioSemanticPalette = {
  waiting:    { base: "#B45309", soft: "#FEF3C7", ink: "#92400E" },
  art:        { base: "#EA580C", soft: "#FFEDD5", ink: "#9A3412" },
  approved:   { base: "#059669", soft: "#D1FAE5", ink: "#065F46" },
  production: { base: "#2563EB", soft: "#DBEAFE", ink: "#1E40AF" },
  ready:      { base: "#0D9488", soft: "#CCFBF1", ink: "#115E59" },
  delivered:  { base: "#64748B", soft: "#F1F5F9", ink: "#475569" },
  danger:     { base: "#DC2626", soft: "#FEE2E2", ink: "#991B1B" },
  changes:    { base: "#E11D48", soft: "#FFE4E6", ink: "#9F1239" },
  neutral:    { base: "#64748B", soft: "#F1F5F9", ink: "#475569" },
};

export function getStudioSemantic(isDark: boolean): StudioSemanticPalette {
  return isDark ? StudioSemanticDark : StudioSemanticLight;
}

// Parity guard — light e dark precisam ter exatamente as mesmas chaves.
type _ParityCheck =
  keyof typeof StudioSemanticDark extends keyof typeof StudioSemanticLight
    ? keyof typeof StudioSemanticLight extends keyof typeof StudioSemanticDark
      ? true
      : never
    : never;
export const _STUDIO_SEMANTIC_PARITY: _ParityCheck = true;

// ─── Mapa estado(API) → intent semântica ─────────────────────
export const STUDIO_STATUS_INTENT: Record<string, StudioIntent> = {
  // Produção
  awaiting_customization: "waiting",   // era ROSA — agora âmbar (guardrail)
  pending_art: "art",
  approved: "approved",
  in_production: "production",
  ready: "ready",
  delivered: "delivered",
  cancelled: "danger",
  // Aprovação
  pending: "waiting",
  changes_requested: "changes",
  expired: "neutral",
  // Evento (bulk)
  draft: "neutral",
  confirmed: "production",
};

export function intentForStatus(status: string | null | undefined): StudioIntent {
  if (!status) return "neutral";
  return STUDIO_STATUS_INTENT[status] ?? "neutral";
}
