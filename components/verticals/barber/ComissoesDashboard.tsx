import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// B-03: ComissoesDashboard — Commission tracking + payroll
// Table with per-professional breakdown + salon vs partner split
// ============================================================

export interface ProfessionalCommission {
  id: string;
  name: string;
  color: string;
  type: "clt" | "parceiro" | "autonomo";
  commission_pct: number;
  appointments_count: number;
  revenue: number;
  commission_amount: number;
  tips: number;
  product_commission: number;
}

interface Props {
  professionals: ProfessionalCommission[];
  period?: string;
  grossRevenue?: number;
  totalCommissions?: number;
  salonShare?: number;
  totalTips?: number;
  onExportPayroll?: () => void;
  onGenerateNfse?: () => void;
  onProfessionalPress?: (proId: string) => void;
}

const TYPE_MAP: Record<string, { bg: string; color: string; label: string }> = {
  clt:      { bg: "rgba(6,182,212,0.12)",   color: "#06B6D4", label: "CLT" },
  parceiro: { bg: "rgba(245,158,11,0.12)",  color: "#F59E0B", label: "Parceiro" },
  autonomo: { bg: "rgba(124,58,237,0.12)",  color: "#7C3AED", label: "Autonomo" },
};

function fmt(v: number): string {
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function ComissoesDashboard({
  professionals, period, grossRevenue = 0, totalCommissions = 0,
  salonShare = 0, totalTips = 0, onExportPayroll, onGenerateNfse,
  onProfessionalPress,
}: Props) {
  // Auto-calculate if not provided
  const calcRevenue = grossRevenue || professionals.reduce((s, p) => s + p.revenue, 0);
  const calcCommissions = totalCommissions || professionals.reduce((s, p) => s + p.commission_amount, 0);
  const calcSalon = salonShare || (calcRevenue - calcCommissions);
  const calcTips = totalTips || professionals.reduce((s, p) => s + p.tips, 0);

  // Best performer
  const best = [...professionals].sort((a, b) => b.revenue - a.revenue)[0];

  return (
    <View style={s.container}>
      {/* KPIs */}
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#F59E0B" }]}>{fmt(calcRevenue)}</Text><Text style={s.kpiLbl}>Receita bruta</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#EF4444" }]}>{fmt(calcCommissions)}</Text><Text style={s.kpiLbl}>Comissoes</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#10B981" }]}>{fmt(calcSalon)}</Text><Text style={s.kpiLbl}>Cota salao</Text></View>
        {calcTips > 0 && (
          <View style={s.kpi}><Text style={[s.kpiVal, { color: "#7C3AED" }]}>{fmt(calcTips)}</Text><Text style={s.kpiLbl}>Gorjetas</Text></View>
        )}
      </View>

      {/* Period title */}
      <Text style={s.title}>Comissoes {period ? `\u2014 ${period}` : ""}</Text>

      {/* Table header */}
      <View style={s.tableHeader}>
        <Text style={[s.th, { flex: 1 }]}>Profissional</Text>
        <Text style={[s.th, { width: 50 }]}>Tipo</Text>
        <Text style={[s.th, { width: 45, textAlign: "right" }]}>Atend.</Text>
        <Text style={[s.th, { width: 70, textAlign: "right" }]}>Receita</Text>
        <Text style={[s.th, { width: 35, textAlign: "right" }]}>%</Text>
        <Text style={[s.th, { width: 70, textAlign: "right" }]}>Comissao</Text>
      </View>

      {/* Rows */}
      {professionals.map(pro => {
        const typeInfo = TYPE_MAP[pro.type] || TYPE_MAP.autonomo;
        return (
          <Pressable
            key={pro.id}
            onPress={() => onProfessionalPress?.(pro.id)}
            style={s.row}
          >
            <View style={[s.cell, { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }]}>
              <View style={[s.avatar, { backgroundColor: pro.color }]}>
                <Text style={s.avatarText}>{pro.name.charAt(0)}</Text>
              </View>
              <Text style={s.proName}>{pro.name}</Text>
            </View>
            <View style={[s.cell, { width: 50 }]}>
              <View style={[s.typeBadge, { backgroundColor: typeInfo.bg }]}>
                <Text style={[s.typeText, { color: typeInfo.color }]}>{typeInfo.label}</Text>
              </View>
            </View>
            <Text style={[s.cellVal, { width: 45 }]}>{pro.appointments_count}</Text>
            <Text style={[s.cellVal, { width: 70, fontWeight: "600" }]}>{fmt(pro.revenue)}</Text>
            <Text style={[s.cellVal, { width: 35, color: "#F59E0B" }]}>{pro.commission_pct}%</Text>
            <Text style={[s.cellVal, { width: 70, color: "#EF4444", fontWeight: "600" }]}>{fmt(pro.commission_amount)}</Text>
          </Pressable>
        );
      })}

      {/* Best performer */}
      {best && (
        <View style={s.bestCard}>
          <View style={[s.bestAvatar, { backgroundColor: best.color }]}>
            <Text style={s.bestInitial}>{best.name.charAt(0)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.bestTitle}>Profissional do mes</Text>
            <Text style={s.bestName}>{best.name}</Text>
            <Text style={s.bestStats}>
              {best.appointments_count} atendimentos \u2014 {fmt(best.revenue)} receita
            </Text>
          </View>
          <Text style={s.bestStar}>\u2605</Text>
        </View>
      )}

      {/* Actions */}
      <View style={s.actions}>
        {onExportPayroll && (
          <Pressable onPress={onExportPayroll} style={s.btnOut}>
            <Text style={s.btnOutText}>Exportar folha</Text>
          </Pressable>
        )}
        {onGenerateNfse && (
          <Pressable onPress={onGenerateNfse} style={s.btnOut}>
            <Text style={s.btnOutText}>Gerar NFS-e parceiros</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },
  kpiRow: { flexDirection: "row", gap: 8 },
  kpi: { flex: 1, backgroundColor: Colors.bg2 || "#1a1a2e", borderRadius: 10, padding: 10, alignItems: "center" },
  kpiVal: { fontSize: 16, fontWeight: "700" },
  kpiLbl: { fontSize: 9, color: Colors.ink3 || "#888", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  title: { fontSize: 15, fontWeight: "700", color: Colors.ink || "#fff" },
  tableHeader: {
    flexDirection: "row", alignItems: "center", paddingBottom: 6,
    borderBottomWidth: 0.5, borderBottomColor: Colors.border || "#444",
  },
  th: { fontSize: 10, color: Colors.ink3 || "#888", fontWeight: "600", textTransform: "uppercase" },
  row: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 0.5,
    borderBottomColor: Colors.border || "#222",
  },
  cell: {},
  cellVal: { fontSize: 13, color: Colors.ink || "#fff", textAlign: "right" },
  avatar: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  proName: { fontSize: 13, fontWeight: "600", color: Colors.ink || "#fff" },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  typeText: { fontSize: 9, fontWeight: "600" },
  bestCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 12, backgroundColor: Colors.bg2 || "#1a1a2e",
    borderWidth: 0.5, borderColor: "rgba(245,158,11,0.3)",
  },
  bestAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  bestInitial: { color: "#fff", fontSize: 16, fontWeight: "700" },
  bestTitle: { fontSize: 11, color: Colors.ink3 || "#888", fontWeight: "600" },
  bestName: { fontSize: 15, fontWeight: "700", color: Colors.ink || "#fff" },
  bestStats: { fontSize: 11, color: Colors.ink2 || "#aaa", marginTop: 2 },
  bestStar: { fontSize: 24, color: "#F59E0B" },
  actions: { flexDirection: "row", gap: 8 },
  btnOut: { borderWidth: 0.5, borderColor: "#F59E0B", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnOutText: { fontSize: 12, color: "#F59E0B", fontWeight: "500" },
});

export default ComissoesDashboard;
