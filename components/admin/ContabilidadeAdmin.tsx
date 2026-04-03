import { View, Text, StyleSheet, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { HoverCard } from "@/components/HoverCard";
import { Icon } from "@/components/Icon";

// VER-03a: Cross-client accounting obligations view

const MOCK_OBLIGATIONS = [
  { client: "Barbearia do Marcos", type: "DAS-MEI", due: "20/04/2026", status: "pendente", amount: 75.90, daysLeft: 17 },
  { client: "Clinica Sorriso", type: "PGDAS-D", due: "20/04/2026", status: "pendente", amount: 1250, daysLeft: 17 },
  { client: "Pet Love Jacarei", type: "DAS-MEI", due: "20/04/2026", status: "pago", amount: 75.90, daysLeft: 17 },
  { client: "Loja Moda Bella", type: "DAS-MEI", due: "20/04/2026", status: "pendente", amount: 75.90, daysLeft: 17 },
  { client: "Studio Bella Estetica", type: "PGDAS-D", due: "20/04/2026", status: "atrasado", amount: 890, daysLeft: -3 },
  { client: "Barbearia do Marcos", type: "DASN-SIMEI", due: "31/05/2026", status: "pendente", amount: 0, daysLeft: 58 },
  { client: "Clinica Sorriso", type: "DEFIS", due: "31/03/2026", status: "pago", amount: 0, daysLeft: -3 },
];

const ST: Record<string, { bg: string; color: string; label: string }> = {
  pendente: { bg: "rgba(245,158,11,0.12)", color: "#F59E0B", label: "Pendente" },
  pago:     { bg: "rgba(16,185,129,0.12)", color: "#10B981", label: "Pago" },
  atrasado: { bg: "rgba(239,68,68,0.12)",  color: "#EF4444", label: "Atrasado" },
};

export function ContabilidadeAdmin() {
  const pending = MOCK_OBLIGATIONS.filter(o => o.status === "pendente").length;
  const overdue = MOCK_OBLIGATIONS.filter(o => o.status === "atrasado").length;
  const paid = MOCK_OBLIGATIONS.filter(o => o.status === "pago").length;

  return (
    <View style={s.container}>
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#F59E0B" }]}>{pending}</Text><Text style={s.kpiLbl}>Pendentes</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#EF4444" }]}>{overdue}</Text><Text style={s.kpiLbl}>Atrasados</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#10B981" }]}>{paid}</Text><Text style={s.kpiLbl}>Pagos</Text></View>
      </View>
      <HoverCard style={s.card}>
        <Text style={s.title}>Calendario fiscal — Todos os clientes</Text>
        <View style={s.tableH}>
          <Text style={[s.th, { flex: 1 }]}>Cliente</Text>
          <Text style={[s.th, { width: 80 }]}>Obrigacao</Text>
          <Text style={[s.th, { width: 80 }]}>Vencimento</Text>
          <Text style={[s.th, { width: 70, textAlign: "right" }]}>Valor</Text>
          <Text style={[s.th, { width: 70 }]}>Status</Text>
        </View>
        {MOCK_OBLIGATIONS.sort((a, b) => a.daysLeft - b.daysLeft).map((o, i) => {
          const st = ST[o.status] || ST.pendente;
          return (
            <View key={i} style={s.tr}>
              <Text style={[s.td, { flex: 1, fontWeight: "600" }]}>{o.client}</Text>
              <Text style={[s.td, { width: 80 }]}>{o.type}</Text>
              <Text style={[s.td, { width: 80 }]}>{o.due}</Text>
              <Text style={[s.td, { width: 70, textAlign: "right" }]}>{o.amount > 0 ? "R$ " + o.amount.toFixed(0) : "—"}</Text>
              <View style={[s.badge, { backgroundColor: st.bg, width: 70 }]}><Text style={[s.badgeT, { color: st.color }]}>{st.label}</Text></View>
            </View>
          );
        })}
      </HoverCard>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 16 },
  kpiRow: { flexDirection: "row", gap: 8 },
  kpi: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  kpiVal: { fontSize: 22, fontWeight: "800" },
  kpiLbl: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 3 },
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
  title: { fontSize: 15, fontWeight: "700", color: Colors.ink, marginBottom: 14 },
  tableH: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8, alignItems: "center" },
  th: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", fontWeight: "600" },
  tr: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: Colors.border, gap: 8, alignItems: "center" },
  td: { fontSize: 12, color: Colors.ink },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignItems: "center" },
  badgeT: { fontSize: 10, fontWeight: "600" },
});
