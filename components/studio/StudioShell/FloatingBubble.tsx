// ============================================================
// AURA STUDIO · StudioShell — FloatingBubble (wrap animado das bolinhas)
//
// Decomposição Fase 2 (31/05/2026): extraído do monólito StudioShell.tsx.
// Componente decorativo que aplica translateY periódico ao child via
// useFloat. Pausa após N segundos (controle no parent).
// ============================================================
import { ReactNode } from "react";
import { Animated } from "react-native";
import { useFloat, FLOAT_AMP_AMBIENT } from "./useFloat";

export function FloatingBubble({
  idx,
  children,
  style,
  pause,
}: {
  idx: number;
  children: ReactNode;
  style?: any;
  pause: boolean;
}) {
  const v = useFloat(idx, !!pause);
  const transY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -FLOAT_AMP_AMBIENT] });
  return (
    <Animated.View style={[style, { transform: [{ translateY: transY }] }]}>
      {children}
    </Animated.View>
  );
}
