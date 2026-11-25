// ============================================================
// ModalPop — Aura · anim (promovido de karate/anim em F1 do
// redesign Crediário; o caminho antigo reexporta daqui)
//
// Wrapper de entrada "spring-like" para o CARTÃO interno de modais
// (não o backdrop — o backdrop já usa animationType="fade" do <Modal>).
// Anima scale 0.96 → 1 + opacity 0 → 1 (Motion.slow, 280 ms) quando
// `visible` vira true.
// Web-safe: Animated.Value + useNativeDriver:false (funciona com
// transform/opacity em react-native-web sem exigir o native driver).
//
// 25/11/2026: curva do app (Motion.easingRN) e "menos movimento" do
// sistema (entra na hora). Antes eram 250 ms com a curva padrão.
// ============================================================
import React, { useEffect, useRef } from "react";
import { Animated, ViewStyle, StyleProp } from "react-native";
import { Motion, duracao, useMenosMovimento } from "@/constants/motion";

interface ModalPopProps {
  visible:   boolean;
  children:  React.ReactNode;
  style?:    StyleProp<ViewStyle>;
  duration?: number;
}

export function ModalPop({ visible, children, style, duration = Motion.slow }: ModalPopProps) {
  const menos = useMenosMovimento();
  const anim = useRef(new Animated.Value(menos ? 1 : 0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (visible) {
      anim.setValue(menos ? 1 : 0);
      animRef.current = Animated.timing(anim, {
        toValue: 1,
        duration: duracao(duration, menos),
        easing: Motion.easingRN,
        useNativeDriver: false,
      });
      animRef.current.start();
    }
    return () => {
      animRef.current?.stop();
    };
  }, [visible, anim, duration, menos]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  return (
    <Animated.View style={[style, { opacity: anim, transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
}

export default ModalPop;
