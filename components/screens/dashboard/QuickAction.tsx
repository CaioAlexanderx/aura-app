import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { webOnly } from "./types";

export function QuickAction({ ic, iconColor, label, onPress }: { ic: string; iconColor: string; label: string; onPress?: () => void }) {
  const webCard = webOnly({
    background: "rgba(14,18,40,0.55)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    transition: "all 0.3s cubic-bezier(0.3, 0, 0.2, 1)",
    cursor: "pointer",
    position: "relative",
    overflow: "hidden",
  });
  const webGlow = webOnly({
    position: "absolute", bottom: -40, left: "50%",
    width: 80, height: 80, borderRadius: 40,
    background: iconColor,
    opacity: 0.28, filter: "blur(30px)",
    transform: "translateX(-50%)",
    pointerEvents: "none",
  });
  const webChip = webOnly({
    background: `color-mix(in srgb, ${iconColor} 14%, rgba(255,255,255,0.02))`,
    borderColor: `color-mix(in srgb, ${iconColor} 26%, transparent)`,
  });
  return (
    <Pressable
      style={[s.btn, Platform.OS === "web" ? (webCard as any) : { backgroundColor: Colors.bg3 }]}
      onPress={onPress}
    >
      {Platform.OS === "web" && <span style={webGlow as any} />}
      <View style={[s.iw, Platform.OS === "web" ? (webChip as any) : { borderColor: iconColor + "33", backgroundColor: iconColor + "11" }]}>
        <Icon name={ic as any} size={20} color={iconColor} />
      </View>
      <Text style={s.lb}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    alignItems: "center", justifyContent: "center", gap: 10,
    minWidth: 92, paddingVertical: 16, paddingHorizontal: 12,
    borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  iw: {
    width: 44, height: 44, borderRadius: 12,
    borderWidth: 1,
    alignItems: "center", justifyContent: "center",
    zIndex: 2,
  },
  lb: { fontSize: 12, color: Colors.ink, fontWeight: "600", textAlign: "center", zIndex: 2 },
});
