import React from "react";
import { View, StyleSheet, ViewStyle, Platform } from "react-native";
import { FoodTokensV2 } from "@/constants/food-tokens";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  hover?: boolean; // habilita hover transform (só web)
  topAccent?: string; // cor da barra superior (opcional)
}

// Glass surface canônica Aura Food.
// Em web: backdrop-filter blur. Em native: solid surface (sem blur — perf).
export function GlassCard({ children, style, hover = false, topAccent }: Props) {
  return (
    <View
      style={[
        styles.base,
        Platform.OS === "web" ? (styles as any).webGlass : styles.solid,
        hover && Platform.OS === "web" && (styles as any).hover,
        style,
      ]}
    >
      {topAccent && <View style={[styles.topAccent, { backgroundColor: topAccent }]} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: FoodTokensV2.rLg,
    borderWidth: 1,
    borderColor: FoodTokensV2.line,
    overflow: "hidden",
    position: "relative",
  },
  solid: {
    backgroundColor: FoodTokensV2.surfaceFlat,
  },
  webGlass: {
    backgroundColor: FoodTokensV2.surface,
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
  } as any,
  hover: {
    transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s",
  } as any,
  topAccent: {
    position: "absolute" as const,
    top: 0, left: 0, right: 0, height: 3,
    opacity: 0.65,
  },
});
