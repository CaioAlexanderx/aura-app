import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// D-08: OrcamentoFunnel — Full pipeline view for treatment plans
// Kanban-like columns: Enviado → Negociando → Aprovado → Em trat. → Concluido
// ============================================================

export interface FunnelPlan {
  id: string;
  plan_number: string;
  patient_name: string;
  total: number;
  status: string;
  items_count: number;
  items_done: number;
  created_at: string;
}

interface Props {
  plans: FunnelPlan[];
  onPlanPress?: (planId: string) => void;
  onStatusChange?: (planId: string, newStatus: string) => void;
}

const COLUMNS = [
  { key: "enviado", label: "Enviados", color: "#06B6D4" },
  { key: "negociando", label: "Negociando", color: "#F59E0B" },
  { key: "aprovado", label: "Aprovados", color: "#10B981" },
  { key: "em_tratamento", label: "Em tratamento", color: "#7C3AED" },
  { key: "concluido", label: "Concluidos", color: "#10B981" },
  { key: "recusado", label: "Recusados", color: "#EF4444" },
];

function fmt(v: number): string {
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function OrcamentoFunnel({ plans, onPlanPress, onStatusChange }: Props) {
  const [view, setView] = useState<"funnel" | "pipeline">("pipeline");

  // Stats per column
  const colStats = COLUMNS.map(col => ({
    ...col,
    plans: plans.filter(p => p.status === col.key),
    total: plans.filter(p => p.status === col.key).reduce((s, p) => s + Number(p.total), 0),
    count: plans.filter(p => p.status === col.key).length,
  }));

  const maxCount = Math.max(...colStats.map(c => c.count), 1);
  const totalValue = plans.reduce((s, p) => s + Number(p.total), 0);
  const approvedValue = plans.filter(p => ["aprovado", "em_tratamento", "concluido"].includes(p.status)).reduce((s, p) => s + Number(p.total), 0);
  const conversionRate = plans.length > 0 ? Math.round(plans.filter(p => ["aprovado", "em_tratamento", "concluido"].includes(p.status)).length / plans.length * 100) : 0;

  return (
    <View style={s.container}>
      {/* KPIs */}
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#06B6D4" }]}>{plans.length}</Text><Text style={s.kpiLbl}>Total orcamentos</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#F59E0B" }]}>{fmt(totalValue)}</Text><Text style={s.kpiLbl}>Valor total</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#10B981" }]}>{fmt(approvedValue)}</Text><Text style={s.kpiLbl}>Valor aprovado</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#7C3AED" }]}>{conversionRate}%</Text><Text style={s.kpiLbl}>Conversao</Text></View>
      </View>

      {/* Funnel bar */}
      <View style={s.funnelBar}>
        {colStats.filter(c => c.count > 0).map(col => (
          <View key={col.key} style={[s.funnelSegment, { flex: col.count / maxCount }]}>
            <View style={[s.funnelFill, { backgroundColor: col.color }]} />
          </View>
        ))}
      </View>
      <View style={s.funnelLabels}>
        {colStats.filter(c => c.count > 0).map(col => (
          <Text key={col.key} style={s.funnelLabel}>
            <Text style={{ color: col.color, fontWeight: "600" }}>{col.count}</Text>{" "}{col.label}
          </Text>
        ))}
      </View>

      {/* Pipeline cards */}
      {colStats.filter(c => c.count > 0).map(col => (
        <View key={col.key} style={s.colSection}>
          <View style={s.colHeader}>
            <View style={[s.colDot, { backgroundColor: col.color }]} />
            <Text style={s.colTitle}>{col.label}</Text>
            <Text style={s.colCount}>{col.count} | {fmt(col.total)}</Text>
          </View>
          {col.plans.map(plan => (
            <Pressable key={plan.id} onPress={() => onPlanPress?.(plan.id)} style={[s.planCard, { borderLeftColor: col.color }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.planNum}>{plan.plan_number}</Text>
                <Text style={s.planPatient}>{plan.patient_name}</Text>
                <Text style={s.planItems}>{plan.items_done}/{plan.items_count} procedimentos</Text>
              </View>
              <Text style={s.planTotal}>{fmt(Number(plan.total))}</Text>
            </Pressable>
          ))}
        </View>
      ))}

      {plans.length === 0 && (
        <View style={s.empty}><Text style={s.emptyText}>Nenhum orcamento criado ainda.</Text></View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 14 },
  kpiRow: { flexDirection: "row", gap: 8 },
  kpi: { flex: 1, backgroundColor: Colors.bg2 || "#1a1a2e", borderRadius: 10, padding: 10, alignItems: "center" },
  kpiVal: { fontSize: 18, fontWeight: "700" },
  kpiLbl: { fontSize: 9, color: Colors.ink3 || "#888", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  funnelBar: { flexDirection: "row", gap: 3, height: 8 },
  funnelSegment: { overflow: "hidden" },
  funnelFill: { height: 8, borderRadius: 4 },
  funnelLabels: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  funnelLabel: { fontSize: 11, color: Colors.ink2 || "#aaa" },
  colSection: { gap: 6 },
  colHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  colDot: { width: 8, height: 8, borderRadius: 4 },
  colTitle: { fontSize: 13, fontWeight: "600", color: Colors.ink || "#fff", flex: 1 },
  colCount: { fontSize: 11, color: Colors.ink3 || "#888" },
  planCard: {
    flexDirection: "row", alignItems: "center", padding: 10,
    borderRadius: 8, borderLeftWidth: 3, backgroundColor: Colors.bg2 || "#1a1a2e",
  },
  planNum: { fontSize: 12, fontWeight: "600", color: "#06B6D4" },
  planPatient: { fontSize: 13, fontWeight: "500", color: Colors.ink || "#fff", marginTop: 1 },
  planItems: { fontSize: 10, color: Colors.ink3 || "#888", marginTop: 2 },
  planTotal: { fontSize: 14, fontWeight: "600", color: Colors.ink || "#fff" },
  empty: { alignItems: "center", paddingVertical: 24 },
  emptyText: { fontSize: 13, color: Colors.ink3 || "#888" },
});

export default OrcamentoFunnel;
