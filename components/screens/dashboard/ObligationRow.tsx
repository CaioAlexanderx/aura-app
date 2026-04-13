import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { fmt } from "./types";

export function ObligationRow({ name, due, amount, status, category }: {
  name: string; due: string; amount: number | null; status: string; category: string;
}) {
  const sc = status === "pending" ? Colors.amber : Colors.ink3;
  const cl = category === "aura_resolve" ? "Aura resolve" : "Aura facilita";
  const cc = category === "aura_resolve" ? Colors.green : Colors.amber;
  return (
    <View style={s.row}>
      <View style={s.left}>
        <View style={[s.dot, { backgroundColor: sc }]} />
        <View><Text style={s.nm}>{name}</Text><Text style={s.du}>Vencimento: {due}</Text></View>
      </View>
      <View style={s.right}>
        {amount != null && <Text style={s.am}>{fmt(amount)}</Text>}
        <View style={[s.cb, { backgroundColor: cc + "18" }]}>
          <Text style={[s.ct, { color: cc }]}>{cl}</Text>
        </View>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  left: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  nm: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  du: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  right: { alignItems: "flex-end", gap: 4, flexShrink: 0 },
  am: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  cb: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  ct: { fontSize: 8, fontWeight: "600", letterSpacing: 0.3 },
});
