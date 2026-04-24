import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors, Glass } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { Sparkline } from "./Sparkline";
import { IS_WIDE, webOnly } from "./types";

type Props = {
  ic: string; iconColor: string; label: string; value: string;
  delta?: string; deltaUp?: boolean; large?: boolean;
  spark?: number[]; onPress?: () => void;
};

// Claude Design KPI: glass card, top accent stripe, icon chip with soft glow,
// tight mono value + delta chip + mini sparkline. Bg/ink swap per theme.
export function KPICard({ ic, iconColor, label, value, delta, deltaUp, large, spark, onPress }: Props) {
  const webCard = webOnly({
    background: Glass.card,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    transition: "all 0.3s cubic-bezier(0.3, 0, 0.2, 1)",
    cursor: "pointer",
    position: "relative",
    overflow: "hidden",
  });
  const webAccent = webOnly({
    content: "",
    position: "absolute", top: 0, left: 0, right: 0, height: 2,
    background: `linear-gradient(90deg, transparent, ${iconColor}, transparent)`,
    opacity: 0.7,
  });
  const webChip = webOnly({
    background: `color-mix(in srgb, ${iconColor} 18%, transparent)`,
    borderColor: `color-mix(in srgb, ${iconColor} 30%, transparent)`,
    transition: "transform 0.35s cubic-bezier(0.3, 0, 0.2, 1)",
    position: "relative",
  });

  return (
    <Pressable
      style={[s.card, large && s.large, Platform.OS === "web" ? (webCard as any) : { backgroundColor: Colors.bg3 }]}
      onPress={onPress}
    >
      {Platform.OS === "web" && <span style={webAccent as any} />}

      <View style={s.header}>
        <View style={[s.ic, Platform.OS === "web" ? (webChip as any) : { backgroundColor: iconColor + "22", borderColor: iconColor + "44" }]}>
          <Icon name={ic as any} size={18} color={iconColor} />
        </View>
        <Text style={s.lb}>{label}</Text>
      </View>

      <Text style={[s.val, large && { fontSize: 26 }]}>{value}</Text>

      <View style={s.foot}>
        {delta ? (
          <Text style={[s.delta, { color: deltaUp ? Colors.green : Colors.red }]}>
            {deltaUp ? "\u25B2" : "\u25BC"} {delta}
          </Text>
        ) : <View />}
        {spark && spark.length >= 2 && (
          <Sparkline data={spark} color={iconColor} width={56} height={20} strokeWidth={1.5} />
        )}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg3, borderRadius: 18,
    paddingHorizontal: 18, paddingVertical: 16,
    borderWidth: 1, borderColor: Glass.lineBorderCard,
    flex: 1, minWidth: IS_WIDE ? 160 : "45%" as any, margin: 5,
    overflow: "hidden" as any,
  },
  large: {
    borderColor: "rgba(124,58,237,0.25)",
    minWidth: IS_WIDE ? 260 : "100%" as any,
    flex: IS_WIDE ? 2 : undefined,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12, zIndex: 2 },
  ic: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
  },
  lb: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 1.1, fontWeight: "700", flex: 1 },
  val: { fontFamily: (Platform.OS === "web" ? "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace" : undefined), fontSize: 22, fontWeight: "700", color: Colors.ink, letterSpacing: -0.4, marginBottom: 10 },
  foot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  delta: { fontSize: 11, fontWeight: "700", fontFamily: (Platform.OS === "web" ? "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace" : undefined) },
});
