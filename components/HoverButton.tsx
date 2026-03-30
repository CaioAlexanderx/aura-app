import { useState } from "react";
import { Text, Pressable, StyleSheet, Platform } from "react-native";

type Props = {
  label: string;
  color: string;
  bgColor: string;
  onPress: () => void;
  icon?: string;
  full?: boolean;
};

export function HoverButton({ label, color, bgColor, onPress, icon, full }: Props) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[
        s.btn,
        { backgroundColor: bgColor },
        full && { flex: 1 },
        hovered && {
          transform: [{ translateY: -2 }, { scale: 1.03 }],
          shadowColor: color,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 6,
        },
        isWeb && { transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)" } as any,
      ]}
    >
      {icon && <Text style={[s.icon, { color }]}>{icon}</Text>}
      <Text style={[s.text, { color }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16 },
  icon: { fontSize: 15, fontWeight: "700" },
  text: { fontSize: 14, fontWeight: "700" },
});
