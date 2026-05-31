// ============================================================
// AURA STUDIO · StudioShell — useFloat hook + FLOAT_AMP_AMBIENT
//
// Decomposição Fase 2 (31/05/2026): extraído do monólito StudioShell.tsx.
// Hook de flutuação suave (StudioFloat das constants). Pausa via prop
// quando o shell aposenta animação após 10s.
//
// DD-3 (decisão futura): em Fase 3 a sidebar docada não usa mais
// FloatingBubble; o hook fica disponível pra decoração pontual.
// ============================================================
import { useRef, useEffect } from "react";
import { Animated, Easing } from "react-native";
import { StudioFloat } from "@/constants/studio-tokens";

export const FLOAT_AMP_AMBIENT = 2;

export function useFloat(idx: number, pause: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (pause) {
      v.stopAnimation();
      return;
    }
    const dur   = StudioFloat.durationsMs[idx % StudioFloat.durationsMs.length];
    const delay = Math.abs(StudioFloat.delaysMs[idx % StudioFloat.delaysMs.length]);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: dur / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: dur / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [idx, v, pause]);
  return v;
}
