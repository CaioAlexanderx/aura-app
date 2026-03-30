import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";

type Props = {
  label: string;
  value: string;
  color?: string;
  sub?: string;
  onPress?: () => void;
};

export function SummaryCard({ label, value, color, sub, onPress }: Props) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[
        s.card,
        hovered && { transform: [{ translateY: -2 }], borderColor: Colors.border2 },
        onPress && hovered && { borderColor: Colors.violet2 },
        isWeb && { transition: "all 0.2s ease", cursor: onPress ? "pointer" : "default" } as any,
      ]}
    >
      <Text style={s.label}>{label}</Text>
      <Text style={[s.value, color ? { color } : {}]}>{value}</Text>
      {sub && <Text style={[s.sub, onPress && hovered && { color: Colors.violet3 }]}>{sub}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, flex: 1, minWidth: IS_WIDE ? 140 : "45%" as any, margin: 4 },
  label: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  value: { fontSize: 20, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  sub: { fontSize: 10, color: Colors.ink3, marginTop: 4 },
});
