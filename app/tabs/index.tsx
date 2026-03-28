import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { dashboardApi } from "@/services/api";
import { Colors } from "@/constants/colors";

function KpiCard({ label, value, delta, deltaUp }: { label: string; value: string; delta?: string; deltaUp?: boolean }) {
  return (
    <View style={k.card}>
      <Text style={k.label}>{label}</Text>
      <Text style={k.value}>{value}</Text>
      {delta && <Text style={[k.delta, { color: deltaUp ? Colors.green : Colors.red }]}>{delta}</Text>}
    </View>
  );
}
const k = StyleSheet.create({
  card:  { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, flex: 1, minWidth: "45%", margin: 5 },
  label: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  value: { fontSize: 24, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  delta: { fontSize: 11, marginTop: 4, fontWeight: "500" },
});

export default function DashboardScreen() {
  const { user, company, token, logout } = useAuthStore();
  const { isLoading } = useQuery({
    queryKey: ["dashboard", company?.id],
    queryFn:  () => dashboardApi.summary(company!.id, token!),
    enabled:  !!company?.id && !!token,
    retry: 1,
  });

  const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Bom dia, {user?.name?.split(" ")[0]} 👋</Text>
          <Text style={s.company}>{company?.name ?? "—"} · {company?.plan ?? "—"}</Text>
        </View>
        <TouchableOpacity onPress={logout}><Text style={s.logout}>Sair</Text></TouchableOpacity>
      </View>
      <View style={s.hero}>
        <Text style={s.heroEye}>Março · 2026</Text>
        <Text style={s.heroTitle}>Sua empresa está saudável.</Text>
        <Text style={s.heroSub}>DAS vence em 14 dias — estimativa preparada.</Text>
      </View>
      <Text style={s.section}>Visão geral</Text>
      {isLoading ? <Text style={s.loading}>Carregando...</Text> : (
        <View style={s.grid}>
          <KpiCard label="Receita do mês"  value={fmt(18420)} delta="▲ 12% vs anterior" deltaUp />
          <KpiCard label="Despesas"        value={fmt(7840)}  delta="▲ 3% vs anterior"  deltaUp={false} />
          <KpiCard label="Saldo líquido"   value={fmt(10580)} delta="▲ 18% vs anterior" deltaUp />
          <KpiCard label="Vendas hoje"     value="47"         delta="Atualizado agora" />
        </View>
      )}
      <View style={s.alert}>
        <Text style={s.alertText}>⚡ Analista disponível · PGDAS-D aguardando revisão</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: 20, paddingBottom: 40 },
  header:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  greeting:  { fontSize: 18, color: Colors.ink, fontWeight: "600" },
  company:   { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  logout:    { fontSize: 12, color: Colors.ink3 },
  hero:      { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 24 },
  heroEye:   { fontSize: 10, color: Colors.violet3, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  heroTitle: { fontSize: 20, color: Colors.ink, fontWeight: "700", marginBottom: 6 },
  heroSub:   { fontSize: 13, color: Colors.ink2, lineHeight: 20 },
  section:   { fontSize: 16, color: Colors.ink, fontWeight: "600", marginBottom: 12 },
  loading:   { color: Colors.ink3, textAlign: "center", marginVertical: 20 },
  grid:      { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5, marginBottom: 20 },
  alert:     { backgroundColor: Colors.violetD, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: Colors.border2 },
  alertText: { fontSize: 13, color: Colors.violet3 },
});
