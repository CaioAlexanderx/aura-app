import { View, Text, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { webOnly } from "./types";

const LABELS: Record<string, string> = { expansao: "Expansao", negocio: "Negocio", essencial: "Essencial", personalizado: "Personalizado" };

export function PlanBadge({ plan }: { plan: string }) {
  const webBg = webOnly({
    background: "linear-gradient(135deg, rgba(124,58,237,0.22), rgba(79,91,213,0.12))",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  });
  return (
    <View style={[s.b, Platform.OS === "web" ? (webBg as any) : { backgroundColor: Colors.violetD }]}>
      <View style={s.d} />
      <Text style={s.t}>{LABELS[plan] || plan}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  b: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, gap: 6,
    borderWidth: 1, borderColor: "rgba(124,58,237,0.30)",
  },
  d: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.violet3, shadowColor: Colors.violet3, shadowRadius: 6, shadowOpacity: 0.9 as any },
  t: { fontSize: 10, color: Colors.violet3, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
});
