// ============================================================
// PressableScale — Aura Karatê · anim
//
// Wrapper Pressable com realce discreto:
//   - pressIn/pressOut → scale 0.98 (Animated.Value, useNativeDriver:false)
//   - hoverIn/hoverOut (web) → leve realce de opacidade (NÃO é hover-reveal:
//     não esconde/mostra ações, só realça o item já visível)
// Repassa onPress/style/children/accessibilityRole para o Pressable.
// Usa Animated.createAnimatedComponent(Pressable) — o próprio elemento
// pressionável recebe o transform/opacity, então `style` (ex.: flexDirection
// "row" das linhas de tabela) continua se aplicando diretamente a ele, sem
// caixa extra alterando o layout dos filhos.
// ============================================================
import React, { useRef } from "react";
import { Animated, Pressable, GestureResponderEvent, ViewStyle, StyleProp } from "react-native";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps {
  onPress?:            (e: GestureResponderEvent) => void;
  style?:               StyleProp<ViewStyle>;
  children?:            React.ReactNode;
  accessibilityRole?:   "button" | "link" | "none" | "image" | "text" | undefined;
  accessibilityLabel?:  string;
  disabled?:            boolean;
}

export function PressableScale({
  onPress, style, children, accessibilityRole = "button", accessibilityLabel, disabled,
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const hover = useRef(new Animated.Value(1)).current;

  const animateTo = (anim: Animated.Value, toValue: number, duration: number) => {
    Animated.timing(anim, { toValue, duration, useNativeDriver: false }).start();
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => animateTo(scale, 0.98, 90)}
      onPressOut={() => animateTo(scale, 1, 120)}
      onHoverIn={() => animateTo(hover, 0.92, 120)}
      onHoverOut={() => animateTo(hover, 1, 150)}
      style={[style, { transform: [{ scale }], opacity: hover }]}
    >
      {children}
    </AnimatedPressable>
  );
}

export default PressableScale;
