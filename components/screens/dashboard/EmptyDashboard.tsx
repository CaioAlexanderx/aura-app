import { View, Text, StyleSheet, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { IS_WIDE } from "./types";

export function EmptyDashboard({ name, onPress }: { name: string; onPress: (p: string) => void }) {
  return (
    <View style={s.wrap}>
      <View style={s.iconWrap}><Icon name="star" size={32} color={Colors.violet3} /></View>
      <Text style={s.title}>Bem-vindo, {name}!</Text>
      <Text style={s.sub}>Seu dashboard vai ganhar vida conforme voce usar a Aura. Comece por uma dessas acoes:</Text>
      <View style={s.actions}>
        <Pressable style={s.action} onPress={() => onPress("/financeiro")}><Icon name="dollar" size={18} color={Colors.green} /><Text style={s.actionText}>Lancar receita</Text></Pressable>
        <Pressable style={s.action} onPress={() => onPress("/estoque")}><Icon name="package" size={18} color={Colors.amber} /><Text style={s.actionText}>Cadastrar produto</Text></Pressable>
        <Pressable style={s.action} onPress={() => onPress("/clientes")}><Icon name="user_plus" size={18} color={Colors.violet3} /><Text style={s.actionText}>Adicionar cliente</Text></Pressable>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 28, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", marginBottom: 28 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "700", color: Colors.ink, marginBottom: 8 },
  sub: { fontSize: 13, color: Colors.ink3, textAlign: "center", lineHeight: 20, marginBottom: 24, maxWidth: 360 },
  actions: { flexDirection: IS_WIDE ? "row" : "column", gap: 10, width: "100%" },
  action: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, flex: 1 },
  actionText: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
});
