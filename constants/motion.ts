// ============================================================
// AURA. — Motion tokens (F1 do redesign Crediário; uso transversal)
//
// Fonte: docs/crediario-redesign-spec.md §2.1.
// Regra: movimento comunica causa→efeito (expandiu, filtrou, confirmou).
// Nunca decoração gratuita. Hovers são ADITIVOS e só-web — nenhuma ação
// pode depender de hover (CLAUDE.md, armadilha 7).
// ============================================================
import { useEffect, useState } from "react";
import { AccessibilityInfo, Easing, Platform } from "react-native";
import { IS_DARK_MODE } from "@/constants/colors";

export const Motion = {
  /** Hover, press, feedback imediato. */
  fast: 120,
  /** Chips, badges, transições de cor/borda. */
  base: 200,
  /** Accordion, sheets, entrada de cards. */
  slow: 280,
  /** Easing padrão (Material standard) para transitions web. */
  easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  /** A mesma curva para Animated (web e nativo). 25/11/2026: as animações
   *  de Animated.timing usavam a curva padrão do RN; agora batem com as
   *  transitions web e com o Caixa. */
  //  (Defensivo: testes que trocam o react-native inteiro por um mock sem
  //  Easing continuam carregando este arquivo.)
  easingRN: (typeof Easing?.bezier === "function"
    ? Easing.bezier(0.4, 0, 0.2, 1)
    : (t: number) => t) as (t: number) => number,
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

// ── Menos movimento (25/11/2026) ───────────────────────────────────────
// Quem pediu "reduzir movimento" no sistema (iOS/Android: acessibilidade;
// web: prefers-reduced-motion) vê tudo sem animação: duração 0, sem
// deslocamento. Para os outros nada muda.
const CONSULTA_MENOS_MOVIMENTO = "(prefers-reduced-motion: reduce)";

/** Último valor lido no nativo: a próxima tela já nasce certa, sem esperar
 *  a promessa do AccessibilityInfo. */
let menosMovimentoNativo = false;

function consultaDoNavegador(): MediaQueryList | null {
  try {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
    return window.matchMedia(CONSULTA_MENOS_MOVIMENTO);
  } catch {
    return null;
  }
}

function menosMovimentoAgora(): boolean {
  if (Platform.OS === "web") return !!consultaDoNavegador()?.matches;
  return menosMovimentoNativo;
}

/** true quando o sistema pede menos movimento. Atualiza se a pessoa mudar a
 *  preferência com a tela aberta. */
export function useMenosMovimento(): boolean {
  const [menos, setMenos] = useState<boolean>(menosMovimentoAgora);

  useEffect(() => {
    if (Platform.OS === "web") {
      const mq = consultaDoNavegador();
      if (!mq) return;
      setMenos(mq.matches);
      const aoMudar = (e: { matches: boolean }) => setMenos(!!e.matches);
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", aoMudar);
        return () => mq.removeEventListener("change", aoMudar);
      }
      // Safari antigo
      (mq as any).addListener?.(aoMudar);
      return () => (mq as any).removeListener?.(aoMudar);
    }

    let vivo = true;
    const guardar = (v: boolean) => {
      menosMovimentoNativo = !!v;
      if (vivo) setMenos(!!v);
    };
    AccessibilityInfo?.isReduceMotionEnabled?.()
      ?.then(guardar)
      .catch(() => {});
    const sub = AccessibilityInfo?.addEventListener?.("reduceMotionChanged", guardar);
    return () => {
      vivo = false;
      sub?.remove?.();
    };
  }, []);

  return menos;
}

/** Duração da animação respeitando o "menos movimento": 0 quando pedido. */
export function duracao(ms: number, menosMovimento: boolean): number {
  return menosMovimento ? 0 : ms;
}

/** Sombras premium compartilhadas (web: boxShadow string via webOnly).
 *  Theme-aware: no claro as sombras são mais leves (pretas pesadas
 *  ficam sujas sobre fundo claro). */
export const Shadows = IS_DARK_MODE ? {
  soft: "0 6px 24px rgba(0,0,0,0.35)",
  glow: "0 4px 20px rgba(124,58,237,0.25)",
  glowGreen: "0 4px 16px rgba(52,211,153,0.25)",
} : {
  soft: "0 6px 20px rgba(24,23,43,0.14)",
  glow: "0 4px 16px rgba(124,58,237,0.20)",
  glowGreen: "0 4px 14px rgba(5,150,105,0.18)",
};
