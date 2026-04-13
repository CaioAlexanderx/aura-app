import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

export function Avatar({ name }: { name: string }) {
  return <View style={s.c}><Text style={s.l}>{(name || "A").charAt(0).toUpperCase()}</Text></View>;
}
const s = StyleSheet.create({
  c: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
  l: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
