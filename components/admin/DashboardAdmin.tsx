import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/api";
import { IS_WIDE, fmt } from "@/constants/helpers";
import { HoverCard } from "@/components/HoverCard";
import { useAuthStore } from "@/stores/auth";
import { Icon } from "@/components/Icon";
import { ListSkeleton } from "@/components/ListSkeleton";
import { PLAN_C } from "./types";

export function DashboardAdmin() {
  const { token, isStaff } = useAuthStore();
  const { data: apiDash, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => adminApi.dashboard(),
    enabled: !!token && isStaff,
    retry: 1,
    staleTime: 30000,
  });

  if (isLoading) return <ListSkeleton rows={3} showCards />;

  const clients = apiDash?.clients || { total: 0, essencial: 0, negocio: 0, expansao: 0 };
  const mrrEstimated = apiDash?.mrr?.estimated || 0;
  const totalCosts = apiDash?.costs?.current_month || 0;
  const grossMargin = apiDash?.gross_margin?.estimated || 0;
  const marginPct = apiDash?.gross_margin?.margin_pct || 0;
  const avgTicket = clients.total > 0 ? mrrEstimated / clients.total : 0;
  const activeClients = clients.total;

  const planDist = { essencial: clients.essencial, negocio: clients.negocio, expansao: clients.expansao };

  return (
    <View>
      <View style={s.kpis}>
        <HoverCard style={s.kpi}><Icon name="dollar" size={20} color={Colors.green} /><Text style={[s.kv, { color: Colors.green }]}>{fmt(mrrEstimated)}</Text><Text style={s.kl}>MRR</Text></HoverCard>
        <HoverCard style={s.kpi}><Icon name="users" size={20} color={Colors.violet3} /><Text style={s.kv}>{activeClients}</Text><Text style={s.kl}>Clientes ativos</Text></HoverCard>
        <HoverCard style={s.kpi}><Icon name="trending_up" size={20} color={Colors.amber} /><Text style={s.kv}>{fmt(avgTicket)}</Text><Text style={s.kl}>Ticket medio</Text></HoverCard>
        <HoverCard style={s.kpi}><Icon name="trending_down" size={20} color={Colors.red} /><Text style={s.kv}>{fmt(totalCosts)}</Text><Text style={s.kl}>Custos mes</Text></HoverCard>
      </View>

      <View style={s.row}>
        <HoverCard style={s.card}>
          <Text style={s.ct}>Distribuicao por plano</Text>
          <View style={s.bars}>
            {Object.entries(planDist).map(([plan, count]) => {
              const pct = activeClients > 0 ? Math.round((count as number) / activeClients * 100) : 0;
              const pc = PLAN_C[plan] || { color: Colors.ink3, label: plan };
              return (
                <View key={plan} style={s.barRow}>
                  <Text style={[s.barLabel, { color: pc.color }]}>{pc.label}</Text>
                  <View style={s.barBg}><View style={[s.barFill, { width: pct + "%", backgroundColor: pc.color }]} /></View>
                  <Text style={s.barPct}>{count} ({pct}%)</Text>
                </View>
              );
            })}
          </View>
        </HoverCard>

        <HoverCard style={s.card}>
          <Text style={s.ct}>Margem bruta</Text>
          <Text style={[s.bigNum, { color: grossMargin >= 0 ? Colors.green : Colors.red }]}>{fmt(grossMargin)}</Text>
          <Text style={s.hint}>Margem: {marginPct}%</Text>
          <View style={{ marginTop: 12 }}>
            <Text style={s.hint}>Receita: {fmt(mrrEstimated)}</Text>
            <Text style={s.hint}>Custos: {fmt(totalCosts)}</Text>
          </View>
        </HoverCard>
      </View>

      <HoverCard style={s.projCard}>
        <Text style={s.ct}>Projecao de receita</Text>
        <View style={s.projRow}>
          <View style={s.projItem}><Text style={s.projLabel}>Este mes</Text><Text style={[s.projValue, { color: Colors.green }]}>{fmt(mrrEstimated)}</Text></View>
          <View style={s.projItem}><Text style={s.projLabel}>Proximo mes</Text><Text style={s.projValue}>{fmt(mrrEstimated * 1.08)}</Text></View>
          <View style={s.projItem}><Text style={s.projLabel}>Anualizado</Text><Text style={[s.projValue, { color: Colors.violet3 }]}>{fmt(mrrEstimated * 12)}</Text></View>
        </View>
      </HoverCard>
    </View>
  );
}

const s = StyleSheet.create({
  kpis: { flexDirection: "row", gap: 10, marginBottom: 20, flexWrap: "wrap" },
  kpi: { flex: 1, minWidth: IS_WIDE ? 140 : "45%", backgroundColor: Colors.bg3, borderRadius: 16, padding: IS_WIDE ? 20 : 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 6 },
  kv: { fontSize: IS_WIDE ? 22 : 18, fontWeight: "800", color: Colors.ink },
  kl: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: IS_WIDE ? "row" : "column", gap: 12, marginBottom: 16 },
  card: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
  ct: { fontSize: 15, fontWeight: "700", color: Colors.ink, marginBottom: 14 },
  bars: { gap: 12 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { fontSize: 11, fontWeight: "600", width: 70 },
  barBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: Colors.bg4 },
  barFill: { height: 8, borderRadius: 4 },
  barPct: { fontSize: 11, color: Colors.ink3, width: 55, textAlign: "right" },
  bigNum: { fontSize: 28, fontWeight: "800", marginBottom: 4 },
  hint: { fontSize: 12, color: Colors.ink3 },
  projCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  projRow: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  projItem: { flex: 1, minWidth: 100, gap: 4 },
  projLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  projValue: { fontSize: 20, fontWeight: "700", color: Colors.ink },
});
