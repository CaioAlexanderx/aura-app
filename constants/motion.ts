// ============================================================
// AURA. — Motion tokens (F1 do redesign Crediário; uso transversal)
//
// Fonte: docs/crediario-redesign-spec.md §2.1.
// Regra: movimento comunica causa→efeito (expandiu, filtrou, confirmou).
// Nunca decoração gratuita. Hovers são ADITIVOS e só-web — nenhuma ação
// pode depender de hover (CLAUDE.md, armadilha 7).
// ============================================================
import { Platform } from "react-native";

export const Motion = {
  /** Hover, press, feedback imediato. */
  fast: 120,
  /** Chips, badges, transições de cor/borda. */
  base: 200,
  /** Accordion, sheets, entrada de cards. */
  slow: 280,
  /** Easing padrão (Material standard) para transitions web. */
  easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  /** Config spring caso um componente migre para reanimated. */
  spring: { damping: 18, stiffness: 220 },
} as const;

/**
 * Helper web-only: gera `{ transition: "prop Xms ease, ..." }` no web e
 * objeto vazio no nativo (RN não aceita `transition`).
 *
 *   style={[s.card, webTransition(["transform", "box-shadow"], Motion.fast)]}
 */
export function webTransition(props: string | string[], ms: number = Motion.base): any {
  if (Platform.OS !== "web") return {};
  const list = Array.isArray(props) ? props : [props];
  return { transition: list.map(p => `${p} ${ms}ms ${Motion.easing}`).join(", ") };
}

/** Sombras premium compartilhadas (web: boxShadow string via webOnly). */
export const Shadows = {
  soft: "0 6px 24px rgba(0,0,0,0.35)",
  glow: "0 4px 20px rgba(124,58,237,0.25)",
  glowGreen: "0 4px 16px rgba(52,211,153,0.25)",
} as const;
