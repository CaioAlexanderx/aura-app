import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { IS_WIDE, webOnly } from "./types";

// 19/10/2026 (tq-32): "Fazer a primeira venda" entra como botão PRINCIPAL,
// acima dos três de sempre. Quem decide se aparece e para onde leva é
// usePrimeiraVenda (DashboardEmptyState); sem `onPrimeiraVenda`, a tela é a
// de antes.
export const TEXTO_PRIMEIRA_VENDA = "Fazer a primeira venda";

export function EmptyDashboard({ name, onPress, onPrimeiraVenda }: {
  name: string;
  onPress: (p: string) => void;
  onPrimeiraVenda?: () => void;
}) {
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
      <Text style={s.sub}>Seu painel vai ganhar vida à medida que você usar a Aura. Comece por uma destas ações:</Text>
      {!!onPrimeiraVenda && (
        <Pressable
          style={s.primary}
          onPress={onPrimeiraVenda}
          accessibilityRole="button"
          testID="painel-primeira-venda"
          {...({ dataSet: { auraHover: "card" } } as any)}
        >
          <Icon name="cart" size={18} color="#fff" />
          <Text style={s.primaryText}>{TEXTO_PRIMEIRA_VENDA}</Text>
        </Pressable>
      )}
      <View style={s.actions}>
        <Pressable style={s.action} onPress={() => onPress("/financeiro")} accessibilityRole="button" {...({ dataSet: { auraHover: "card" } } as any)}>
          <Icon name="dollar" size={18} color={Colors.green} />
          <Text style={s.actionText}>Lançar receita</Text>
        </Pressable>
        <Pressable style={s.action} onPress={() => onPress("/estoque")} accessibilityRole="button" {...({ dataSet: { auraHover: "card" } } as any)}>
          <Icon name="package" size={18} color={Colors.amber} />
          <Text style={s.actionText}>Cadastrar produto</Text>
        </Pressable>
        <Pressable style={s.action} onPress={() => onPress("/clientes")} accessibilityRole="button" {...({ dataSet: { auraHover: "card" } } as any)}>
          <Icon name="user_plus" size={18} color={Colors.violet3} />
          <Text style={s.actionText}>Cadastrar cliente</Text>
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
  // Botão principal: cheio, violeta, a largura toda; o realce é só o
  // [data-aura-hover="card"] do Painel, que não esconde nada em touch.
  primary: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.violet, borderRadius: 14, minHeight: 50,
    paddingHorizontal: 18, paddingVertical: 14, width: "100%", marginBottom: 10,
  },
  primaryText: { fontSize: 15, color: "#fff", fontWeight: "700" },
  actions: { flexDirection: IS_WIDE ? "row" : "column", gap: 10, width: "100%" },
  action: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(14,18,40,0.55)", borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    flex: 1,
  },
  actionText: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
});
