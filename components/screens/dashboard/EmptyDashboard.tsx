import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { IS_WIDE, webOnly } from "./types";

export function EmptyDashboard({ name, onPress }: { name: string; onPress: (p: string) => void }) {
  const webCard = webOnly({
    background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(79,91,213,0.05))",
    backdropFilter: "blur(18px) saturate(140%)",
    WebkitBackdropFilter: "blur(18px) saturate(140%)",
  });
  const webOrb = webOnly({
    width: 84, height: 84, borderRadius: 42,
    background: "conic-gradient(from 0deg, #7c3aed, #8b5cf6, #4f5bd5, #7c3aed)",
    padding: 3,
    animation: "auraSpin 6s linear infinite",
  });
  return (
    <View style={[s.wrap, Platform.OS === "web" ? (webCard as any) : { backgroundColor: Colors.bg3 }]}>
      <View style={[s.ring, Platform.OS === "web" ? (webOrb as any) : { backgroundColor: Colors.violet }]}>
        <View style={s.ringInner}><Icon name="star" size={28} color={Colors.violet3} /></View>
      </View>
      <Text style={s.title}>Bem-vindo, {name}!</Text>
      <Text style={s.sub}>Seu painel vai ganhar vida conforme voce usar a Aura. Comece por uma destas acoes:</Text>
      <View style={s.actions}>
        <Pressable style={s.action} onPress={() => onPress("/financeiro")}>
          <Icon name="dollar" size={18} color={Colors.green} />
          <Text style={s.actionText}>Lancar receita</Text>
        </Pressable>
        <Pressable style={s.action} onPress={() => onPress("/estoque")}>
          <Icon name="package" size={18} color={Colors.amber} />
          <Text style={s.actionText}>Cadastrar produto</Text>
        </Pressable>
        <Pressable style={s.action} onPress={() => onPress("/clientes")}>
          <Icon name="user_plus" size={18} color={Colors.violet3} />
          <Text style={s.actionText}>Adicionar cliente</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderRadius: 24, padding: 32,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center", marginBottom: 28,
  },
  ring: { alignItems: "center", justifyContent: "center", marginBottom: 20 },
  ringInner: { width: 78, height: 78, borderRadius: 39, backgroundColor: Colors.bg2, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", color: Colors.ink, marginBottom: 10, letterSpacing: -0.3 },
  sub: { fontSize: 13, color: Colors.ink3, textAlign: "center", lineHeight: 20, marginBottom: 24, maxWidth: 380 },
  actions: { flexDirection: IS_WIDE ? "row" : "column", gap: 10, width: "100%" },
  action: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(14,18,40,0.55)", borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    flex: 1,
  },
  actionText: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
});
