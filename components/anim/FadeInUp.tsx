// ============================================================
// FadeInUp — Aura · anim (promovido de app/(tabs)/crediario.tsx em
// 25/11/2026, movimento do crediário)
//
// Entrada de uma seção ao montar: fade + subida de 8 px em Motion.slow
// (280 ms), na curva do app. Para reanimar quando o conteúdo troca (a
// ficha de outra cliente), mude a `key` do FadeInUp.
// "Menos movimento" no sistema: aparece na hora, sem deslocamento.
// ============================================================
import React, { useEffect, useRef } from "react";
import { Animated, StyleProp, ViewStyle } from "react-native";
import { Motion, duracao, useMenosMovimento } from "@/constants/motion";

interface FadeInUpProps {
  children: React.ReactNode;
  delay?:   number;
  style?:   StyleProp<ViewStyle>;
  testID?:  string;
}

export function FadeInUp({ children, delay = 0, style, testID }: FadeInUpProps) {
  const menos = useMenosMovimento();
  const anim = useRef(new Animated.Value(menos ? 1 : 0)).current;
  useEffect(() => {
    if (menos) { anim.setValue(1); return; }
    const a = Animated.timing(anim, {
      toValue: 1,
      duration: duracao(Motion.slow, menos),
      delay,
      easing: Motion.easingRN,
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [anim, delay, menos]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [menos ? 0 : 8, 0] });
  return (
    <Animated.View style={[style, { opacity: anim, transform: [{ translateY }] }]} testID={testID}>
      {children}
    </Animated.View>
  );
}

export default FadeInUp;
