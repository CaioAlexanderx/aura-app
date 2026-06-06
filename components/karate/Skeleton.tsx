// ============================================================
// Skeleton — Aura Karatê
//
// Placeholder de carregamento animado (fade).
// ============================================================
import React, { useEffect, useRef } from "react";
import { Animated, View, StyleSheet, ViewStyle } from "react-native";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";

interface SkeletonProps {
  width?:  number | `${number}%`;
  height?: number;
  radius?: number;
  style?:  ViewStyle;
}

export function Skeleton({ width = "100%", height = 16, radius = KarateRadius.sm, style }: SkeletonProps) {
  const anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <Animated.View
      style={[
        styles.base,
        { width: width as any, height, borderRadius: radius, opacity: anim },
        style,
      ]}
      accessibilityLabel="Carregando..."
      accessibilityLiveRegion="polite"
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: KarateColors.border,
  } as ViewStyle,
});
