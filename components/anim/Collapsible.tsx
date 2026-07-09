// ============================================================
// Collapsible — Aura · anim (F1 do redesign Crediário)
//
// Accordion com altura animada cross-platform (web + nativo):
// mede o conteúdo via onLayout e anima height 0 ↔ contentH + opacity,
// com Animated.Value/useNativeDriver:false (web-safe).
//
// Uso: <Collapsible open={expanded}> ...conteúdo... </Collapsible>
// O conteúdo é SEMPRE renderizado (para medição); overflow:hidden
// esconde quando fechado. Se o conteúdo mudar de altura enquanto
// aberto, o onLayout atualiza a medida e o container acompanha.
// ============================================================
import React, { useEffect, useRef, useState } from "react";
import { Animated, View, StyleProp, ViewStyle, LayoutChangeEvent } from "react-native";
import { Motion } from "@/constants/motion";

interface CollapsibleProps {
  open:      boolean;
  children:  React.ReactNode;
  style?:    StyleProp<ViewStyle>;
  duration?: number;
}

export function Collapsible({ open, children, style, duration = Motion.slow }: CollapsibleProps) {
  const anim = useRef(new Animated.Value(open ? 1 : 0)).current;
  const [contentH, setContentH] = useState(0);

  useEffect(() => {
    Animated.timing(anim, { toValue: open ? 1 : 0, duration, useNativeDriver: false }).start();
  }, [open, anim, duration]);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - contentH) > 0.5) setContentH(h);
  };

  const height = anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(contentH, 0)] });

  return (
    <Animated.View style={[{ overflow: "hidden" }, style, { height, opacity: anim }]}>
      <View onLayout={onLayout}>{children}</View>
    </Animated.View>
  );
}

export default Collapsible;
