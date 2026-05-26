// ============================================================
// StudioGradient — gradient cross-platform sem expo-linear-gradient.
// Web: usa CSS linear-gradient inline (nativo do browser).
// Native: usa backgroundColor solido (cor de meio do gradient).
//
// Por que custom: expo-linear-gradient não está no package.json.
// Adicionar a dep daria conflito. Esta solução é zero-deps.
// ============================================================
import { ReactNode } from "react";
import { View, Platform, ViewStyle, StyleProp } from "react-native";

export function StudioGradient({
  colors,
  direction = "to bottom right",  // CSS-style
  style,
  children,
  pointerEvents,
}: {
  colors: readonly string[] | string[];
  direction?: string;     // CSS direction ou angle, ex "135deg", "to right"
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  pointerEvents?: "auto" | "none" | "box-none" | "box-only";
}) {
  if (Platform.OS === "web") {
    const css = `linear-gradient(${direction}, ${colors.join(", ")})`;
    return (
      <View
        pointerEvents={pointerEvents}
        style={[style, { background: css } as any]}
      >
        {children}
      </View>
    );
  }
  // Native: fallback solido com cor central (ou primeira do array)
  // Pra gradient real native, seria necessario expo-linear-gradient.
  const midColor = colors[Math.floor(colors.length / 2)] || colors[0];
  return (
    <View pointerEvents={pointerEvents} style={[style, { backgroundColor: midColor }]}>
      {children}
    </View>
  );
}

export default StudioGradient;
