import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

const LABELS: Record<string, string> = { expansao: "Expansao", negocio: "Negocio", essencial: "Essencial" };

export function PlanBadge({ plan }: { plan: string }) {
  return (
    <View style={s.b}>
      <View style={s.d} />
      <Text style={s.t}>{LABELS[plan] || plan}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  b: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, gap: 5 },
  d: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green },
  t: { fontSize: 11, color: Colors.violet3, fontWeight: "600", letterSpacing: 0.3 },
});
