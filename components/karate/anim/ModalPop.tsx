// ============================================================
// ModalPop — Aura Karatê · anim
//
// Wrapper de entrada "spring-like" para o CARTÃO interno de modais
// (não o backdrop — o backdrop já usa animationType="fade" do <Modal>).
// Anima scale 0.96 → 1 + opacity 0 → 1 (~250ms) quando `visible` vira true.
// Web-safe: Animated.Value + useNativeDriver:false (funciona com
// transform/opacity em react-native-web sem exigir o native driver).
// ============================================================
import React, { useEffect, useRef } from "react";
import { Animated, ViewStyle, StyleProp } from "react-native";

interface ModalPopProps {
  visible:   boolean;
  children:  React.ReactNode;
  style?:    StyleProp<ViewStyle>;
  duration?: number;
}

export function ModalPop({ visible, children, style, duration = 250 }: ModalPopProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (visible) {
      anim.setValue(0);
      animRef.current = Animated.timing(anim, {
        toValue: 1,
        duration,
        useNativeDriver: false,
      });
      animRef.current.start();
    }
    return () => {
      animRef.current?.stop();
    };
  }, [visible, anim, duration]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  return (
    <Animated.View style={[style, { opacity: anim, transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
}

export default ModalPop;
