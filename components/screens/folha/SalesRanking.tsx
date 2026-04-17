import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/ListSkeleton";

var isWeb = Platform.OS === "web";

type RankedEmployee = {
  position: number; id: string; full_name: string; job_role: string;
  total_sales: number; total_revenue: number; avg_ticket: number;
  trend_pct: number; share_pct: number; is_top: boolean; medal: string | null;
};

type RankingData = {
  period: { start: string; end: string; label: string };
  total_revenue: number; total_employees: number;
  ranking: RankedEmployee[]; employee_of_month: RankedEmployee | null;
};

var fmt = function(n: number) { return "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, "."); };
var fmtK = function(n: number) { return n >= 1000 ? "R$ " + (n / 1000).toFixed(1).replace(".", ",") + "k" : fmt(n); };

var PERIODS = [
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "year", label: "Ano" },
];

var MEDAL_EMOJI: Record<string, string> = { gold: "\uD83E\uDD47", silver: "\uD83E\uDD48", bronze: "\uD83E\uDD49" };
var MEDAL_BG: Record<string, string> = { gold: "#FDE68A", silver: "#E5E7EB", bronze: "#FDBA74" };
var MEDAL_BORDER: Record<string, string> = { gold: "#F59E0B", silver: "#9CA3AF", bronze: "#F97316" };

export function SalesRanking() {
  var { company } = useAuthStore();
  var companyId = company?.id;
  var [period, setPeriod] = useState("month");

  var { data, isLoading, isError } = useQuery<RankingData>({
    queryKey: ["employees-ranking", companyId, period],
    queryFn: function() { return request<RankingData>("/companies/" + companyId + "/employees/ranking?period=" + period); },
    enabled: !!companyId,
    staleTime: 120_000,
    retry: 1,
  });

  if (isLoading) return <ListSkeleton rows={3} showCards />;

  if (isError || !data || data.ranking.length === 0) {
    return <EmptyState icon="trophy" iconColor={Colors.amber} title="Ranking de desempenho" subtitle="O ranking sera gerado quando funcionarios forem vinculados a vendas no PDV. Ao registrar uma venda, selecione o vendedor responsavel." />;
  }

  var ranking = data.ranking;
  var top3 = ranking.slice(0, 3);
  var rest = ranking.slice(3);

  return (
    <View>
      {/* Seletor de periodo */}
      <View style={s.periodBar}>
        {PERIODS.map(function(p) {
          return <Pressable key={p.key} onPress={function() { setPeriod(p.key); }} style={[s.periodBtn, period === p.key && s.periodBtnActive, isWeb && { transition: "all 0.15s" } as any]}>
            <Text style={[s.periodText, period === p.key && s.periodTextActive]}>{p.label}</Text>
          </Pressable>;
        })}
      </View>

      {/* KPIs */}
      <View style={s.kpiRow}>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Vendas</Text>
          <Text style={s.kpiVal}>{ranking.reduce(function(s, e) { return s + e.total_sales; }, 0)}</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Faturamento</Text>
          <Text style={[s.kpiVal, { color: Colors.green }]}>{fmtK(data.total_revenue)}</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Ticket medio</Text>
          <Text style={s.kpiVal}>{data.total_revenue > 0 ? fmt(data.total_revenue / ranking.reduce(function(s, e) { return s + e.total_sales; }, 1)) : "R$ 0"}</Text>
        </View>
      </View>

      {/* Podium — top 3 */}
      <View style={s.podium}>
        {top3.map(function(emp) {
          var medal = emp.medal || "";
          var bg = MEDAL_BG[medal] || Colors.bg4;
          var border = MEDAL_BORDER[medal] || Colors.border;
          var emoji = MEDAL_EMOJI[medal] || "";
          var trendColor = emp.trend_pct > 0 ? Colors.green : emp.trend_pct < 0 ? Colors.red : Colors.ink3;
          var trendArrow = emp.trend_pct > 0 ? "\u2191" : emp.trend_pct < 0 ? "\u2193" : "";
          return (
            <View key={emp.id} style={[s.podiumCard, { borderColor: border }]}>
              <Text style={s.podiumMedal}>{emoji}</Text>
              <View style={[s.podiumAvatar, { backgroundColor: bg }]}>
                <Text style={s.podiumInitial}>{(emp.full_name || "?")[0].toUpperCase()}</Text>
              </View>
              <Text style={s.podiumName} numberOfLines={1}>{emp.full_name}</Text>
              <Text style={s.podiumRole}>{emp.job_role || "Vendedor"}</Text>
              <Text style={[s.podiumRevenue, { color: Colors.green }]}>{fmtK(emp.total_revenue)}</Text>
              <View style={s.podiumStats}>
                <Text style={s.podiumStat}>{emp.total_sales} vendas</Text>
                <Text style={[s.podiumTrend, { color: trendColor }]}>{trendArrow}{Math.abs(emp.trend_pct)}%</Text>
              </View>
              <View style={s.shareBar}>
                <View style={[s.shareFill, { width: emp.share_pct + "%", backgroundColor: border }, isWeb && { transition: "width 0.4s" } as any]} />
              </View>
              <Text style={s.shareText}>{emp.share_pct}% do total</Text>
            </View>
          );
        })}
      </View>

      {/* Tabela completa */}
      {rest.length > 0 && (
        <View style={s.tableCard}>
          <Text style={s.tableTitle}>Todos os vendedores</Text>
          {ranking.map(function(emp) {
            var trendColor = emp.trend_pct > 0 ? Colors.green : emp.trend_pct < 0 ? Colors.red : Colors.ink3;
            var trendArrow = emp.trend_pct > 0 ? "\u2191" : emp.trend_pct < 0 ? "\u2193" : "";
            return (
              <View key={emp.id} style={s.tableRow}>
                <Text style={s.tablePos}>{emp.position}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.tableName} numberOfLines={1}>{emp.full_name}</Text>
                  <Text style={s.tableRole}>{emp.job_role || "Vendedor"}</Text>
                </View>
                <View style={s.tableRight}>
                  <Text style={s.tableRevenue}>{fmtK(emp.total_revenue)}</Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Text style={s.tableSales}>{emp.total_sales} vendas</Text>
                    <Text style={[s.tableTrend, { color: trendColor }]}>{trendArrow}{Math.abs(emp.trend_pct)}%</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  periodBar: { flexDirection: "row", backgroundColor: Colors.bg3, borderRadius: 10, padding: 3, marginBottom: 16, borderWidth: 1, borderColor: Colors.border, gap: 3 },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  periodBtnActive: { backgroundColor: Colors.violet },
  periodText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  periodTextActive: { color: "#fff", fontWeight: "700" },
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  kpiCard: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  kpiLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.3 },
  kpiVal: { fontSize: 18, fontWeight: "800", color: Colors.ink, marginTop: 4 },
  podium: { flexDirection: "row", gap: 10, marginBottom: 20 },
  podiumCard: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 16, padding: 14, alignItems: "center", borderWidth: 1.5, gap: 4 },
  podiumMedal: { fontSize: 24 },
  podiumAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  podiumInitial: { fontSize: 18, fontWeight: "800", color: Colors.ink },
  podiumName: { fontSize: 12, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  podiumRole: { fontSize: 9, color: Colors.ink3 },
  podiumRevenue: { fontSize: 16, fontWeight: "800", marginTop: 2 },
  podiumStats: { flexDirection: "row", gap: 6, marginTop: 2 },
  podiumStat: { fontSize: 10, color: Colors.ink3 },
  podiumTrend: { fontSize: 10, fontWeight: "700" },
  shareBar: { height: 4, width: "100%", backgroundColor: Colors.bg4, borderRadius: 2, marginTop: 6, overflow: "hidden" },
  shareFill: { height: 4, borderRadius: 2 },
  shareText: { fontSize: 9, color: Colors.ink3, marginTop: 2 },
  tableCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: Colors.border },
  tableTitle: { fontSize: 13, fontWeight: "700", color: Colors.ink, marginBottom: 10, paddingHorizontal: 4 },
  tableRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tablePos: { width: 24, fontSize: 14, fontWeight: "800", color: Colors.ink3, textAlign: "center" },
  tableName: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  tableRole: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  tableRight: { alignItems: "flex-end" },
  tableRevenue: { fontSize: 13, fontWeight: "700", color: Colors.green },
  tableSales: { fontSize: 10, color: Colors.ink3 },
  tableTrend: { fontSize: 10, fontWeight: "700" },
});

export default SalesRanking;
