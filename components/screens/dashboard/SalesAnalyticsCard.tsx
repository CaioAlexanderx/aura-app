import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useSalesAnalytics, useProductsRanking } from "@/hooks/useSalesAnalytics";
import { fmtK, fmt } from "./types";

const PERIODS = [
  { key: "yesterday", label: "Ontem" },
  { key: "today", label: "Hoje" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
] as const;

type PeriodKey = typeof PERIODS[number]["key"];

/**
 * P1 #3: Quick period selector for Dashboard
 * Replaces "Desempenho de vendas" with Ontem/Hoje/Semana/Mes tabs
 * Shows: total R$, total vendas, total produtos, ticket medio, growth vs anterior
 */
export function SalesAnalyticsCard({ onPress }: { onPress: () => void }) {
  const [period, setPeriod] = useState<PeriodKey>("today");
  const { data, isLoading, isFetching } = useSalesAnalytics(period, "day");
  const { data: ranking } = useProductsRanking(period);
  const isWeb = Platform.OS === "web";

  const totalSales = data?.total_sales || 0;
  const totalRevenue = data?.total_revenue || 0;
  const avgTicket = data?.avg_ticket || 0;
  const growth = data?.comparison?.growth_pct;
  const topProducts = ranking?.products?.slice(0, 3) || [];
  const totalProductsSold = ranking?.summary?.total_sold || totalSales;

  const periodLabel = PERIODS.find(p => p.key === period)?.label || "Hoje";
  const comparisonLabel = period === "today" ? "ontem" : period === "yesterday" ? "anteontem" : period === "week" ? "semana anterior" : "mes anterior";

  // Show empty state only if ALL periods would be empty (month has no sales)
  if (!isLoading && totalSales === 0 && totalRevenue === 0 && period === "month" && !topProducts.length) return null;

  return (
    <View>
      {/* Header with period selector */}
      <View style={s.header}>
        <Text style={s.title}>Vendas</Text>
        <View style={s.periodBar}>
          {PERIODS.map(p => (
            <Pressable key={p.key} onPress={() => setPeriod(p.key)}
              style={[s.periodBtn, period === p.key && s.periodBtnActive,
                isWeb && { transition: "all 0.15s ease" } as any]}>
              <Text style={[s.periodText, period === p.key && s.periodTextActive]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[s.card, isFetching && { opacity: 0.7 }]}>
        {/* Main KPIs row */}
        <View style={s.kpiRow}>
          <View style={s.kpiMain}>
            <Text style={s.kpiMainValue}>{fmt(totalRevenue)}</Text>
            <Text style={s.kpiMainLabel}>Faturamento</Text>
          </View>
          <View style={s.kpiSide}>
            <View style={s.kpiSmall}>
              <Text style={s.kpiSmallValue}>{totalSales}</Text>
              <Text style={s.kpiSmallLabel}>Vendas</Text>
            </View>
            <View style={s.kpiDivider} />
            <View style={s.kpiSmall}>
              <Text style={s.kpiSmallValue}>{totalProductsSold}</Text>
              <Text style={s.kpiSmallLabel}>Produtos</Text>
            </View>
            <View style={s.kpiDivider} />
            <View style={s.kpiSmall}>
              <Text style={s.kpiSmallValue}>{fmt(avgTicket)}</Text>
              <Text style={s.kpiSmallLabel}>Ticket</Text>
            </View>
          </View>
        </View>

        {/* Growth badge */}
        {growth !== undefined && growth !== null && (
          <View style={[s.growthBadge, { backgroundColor: growth >= 0 ? Colors.greenD : Colors.redD }]}>
            <Text style={[s.growthText, { color: growth >= 0 ? Colors.green : Colors.red }]}>
              {growth >= 0 ? "+" : ""}{growth.toFixed(1)}% vs {comparisonLabel}
            </Text>
          </View>
        )}

        {/* No sales for this period */}
        {!isLoading && totalSales === 0 && (
          <View style={s.emptyPeriod}>
            <Text style={s.emptyText}>Nenhuma venda {periodLabel.toLowerCase() === "hoje" ? "hoje ainda" : periodLabel.toLowerCase()}</Text>
          </View>
        )}

        {/* Top products */}
        {topProducts.length > 0 && (
          <View style={s.topSection}>
            <Text style={s.topTitle}>Mais vendidos ({periodLabel.toLowerCase()})</Text>
            {topProducts.map((p: any, i: number) => (
              <View key={p.id || i} style={s.topRow}>
                <View style={[s.topRank, i === 0 && { backgroundColor: Colors.amberD, borderColor: Colors.amber + "33" }]}>
                  <Text style={[s.topRankText, i === 0 && { color: Colors.amber }]}>{i + 1}</Text>
                </View>
                <Text style={s.topName} numberOfLines={1}>{p.name}</Text>
                <Text style={s.topQty}>{p.qty_sold} un</Text>
                <Text style={s.topRev}>{fmtK(p.revenue)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer link */}
        <Pressable onPress={onPress} style={s.footer}>
          <Text style={s.footerText}>Ver analise completa</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 },
  title: { fontSize: 16, color: Colors.ink, fontWeight: "700" },
  periodBar: { flexDirection: "row", backgroundColor: Colors.bg3, borderRadius: 10, padding: 3, borderWidth: 1, borderColor: Colors.border },
  periodBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  periodBtnActive: { backgroundColor: Colors.violet },
  periodText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  periodTextActive: { color: "#fff", fontWeight: "600" },

  card: { backgroundColor: Colors.bg3, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 24 },

  kpiRow: { gap: 12, marginBottom: 12 },
  kpiMain: { alignItems: "center", paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  kpiMainValue: { fontSize: 28, fontWeight: "800", color: Colors.green, letterSpacing: -0.5 },
  kpiMainLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 2 },

  kpiSide: { flexDirection: "row", justifyContent: "space-around" },
  kpiSmall: { alignItems: "center", flex: 1 },
  kpiSmallValue: { fontSize: 18, fontWeight: "800", color: Colors.ink },
  kpiSmallLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  kpiDivider: { width: 1, backgroundColor: Colors.border, marginHorizontal: 4 },

  growthBadge: { alignSelf: "center", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 12 },
  growthText: { fontSize: 11, fontWeight: "600" },

  emptyPeriod: { alignItems: "center", paddingVertical: 16 },
  emptyText: { fontSize: 12, color: Colors.ink3, fontStyle: "italic" as any },

  topSection: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12, marginTop: 4 },
  topTitle: { fontSize: 10, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  topRank: { width: 24, height: 24, borderRadius: 7, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  topRankText: { fontSize: 10, fontWeight: "700", color: Colors.violet3 },
  topName: { flex: 1, fontSize: 12, color: Colors.ink, fontWeight: "500" },
  topQty: { fontSize: 11, color: Colors.ink3 },
  topRev: { fontSize: 12, color: Colors.green, fontWeight: "600", minWidth: 70, textAlign: "right" },

  footer: { alignItems: "center", paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 8 },
  footerText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
});
