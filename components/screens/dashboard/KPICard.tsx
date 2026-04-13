import { View, Text, StyleSheet, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { Sparkline } from "./Sparkline";
import { IS_WIDE } from "./types";

type Props = {
  ic: string; iconColor: string; label: string; value: string;
  delta?: string; deltaUp?: boolean; large?: boolean;
  spark?: number[]; onPress?: () => void;
};

export function KPICard({ ic, iconColor, label, value, delta, deltaUp, large, spark, onPress }: Props) {
  return (
    <Pressable style={[s.card, large && s.large]} onPress={onPress}>
      <View style={s.header}>
        <View style={[s.ic, { backgroundColor: iconColor + "22", borderColor: iconColor + "44" }]}>
          <Icon name={ic as any} size={20} color={iconColor} />
        </View>
        {spark && spark.length >= 2 && (
          <View style={{ opacity: 0.7 }}><Sparkline data={spark} color={iconColor} height={36} /></View>
        )}
      </View>
      <Text style={[s.val, large && { fontSize: 28 }]}>{value}</Text>
      <Text style={s.lb}>{label}</Text>
      {delta && (
        <View style={[s.db, { backgroundColor: deltaUp ? Colors.greenD : Colors.redD }]}>
          <Text style={[s.dt, { color: deltaUp ? Colors.green : Colors.red }]}>{deltaUp ? "+" : "-"} {delta}</Text>
        </View>
      )}
    </Pressable>
  );
}
const s = StyleSheet.create({
  // P0 #9 fix: overflow hidden prevents sparkline from bleeding outside card
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.border, flex: 1, minWidth: IS_WIDE ? 160 : "45%" as any, margin: 5, overflow: "hidden" as any },
  large: { borderColor: Colors.border2, backgroundColor: Colors.bg4, borderWidth: 1.5, minWidth: IS_WIDE ? 260 : "100%" as any, flex: IS_WIDE ? 2 : undefined },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  ic: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  val: { fontSize: 22, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5, marginBottom: 4 },
  lb: { fontSize: 11, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  db: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  dt: { fontSize: 10, fontWeight: "600" },
});
