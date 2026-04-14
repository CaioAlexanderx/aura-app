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

export function SalesAnalyticsCard({ onPress }: { onPress: () => void }) {
  const [period, setPeriod] = useState<PeriodKey>("today");
  const { data, isLoading, isFetching } = useSalesAnalytics(period, "day");
  const { data: ranking } = useProductsRanking(period);
  const isWeb = Platform.OS === "web";

  // FIX: API returns nested { summary: { total_sales, ... } }
  const summary = data?.summary || data;
  const totalSales = summary?.total_sales || 0;
  const totalRevenue = summary?.total_revenue || 0;
  const avgTicket = summary?.avg_ticket || 0;

  // Top products: from dedicated ranking endpoint OR from salesAnalytics.top_products
  const topProducts = ranking?.products?.slice(0, 3) || data?.top_products?.slice(0, 3) || [];
  const totalProductsSold = ranking?.summary?.total_sold || topProducts.reduce((s: number, p: any) => s + (p.total_qty || p.qty_sold || 0), 0) || totalSales;

  const periodLabel = PERIODS.find(p => p.key === period)?.label || "Hoje";
  const comparisonLabel = period === "today" ? "ontem" : period === "yesterday" ? "anteontem" : period === "week" ? "semana anterior" : "mes anterior";

  if (!isLoading && totalSales === 0 && totalRevenue === 0 && period === "month" && !topProducts.length) return null;

  return (
    <View>
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

        {!isLoading && totalSales === 0 && (
          <View style={s.emptyPeriod}>
            <Text style={s.emptyText}>Nenhuma venda {periodLabel.toLowerCase() === "hoje" ? "hoje ainda" : periodLabel.toLowerCase()}</Text>
          </View>
        )}

        {topProducts.length > 0 && (
          <View style={s.topSection}>
            <Text style={s.topTitle}>Mais vendidos ({periodLabel.toLowerCase()})</Text>
            {topProducts.map((p: any, i: number) => (
              <View key={p.id || i} style={s.topRow}>
                <View style={[s.topRank, i === 0 && { backgroundColor: Colors.amberD, borderColor: Colors.amber + "33" }]}>
                  <Text style={[s.topRankText, i === 0 && { color: Colors.amber }]}>{i + 1}</Text>
                </View>
                <Text style={s.topName} numberOfLines={1}>{p.name}</Text>
                <Text style={s.topQty}>{p.total_qty || p.qty_sold || 0} un</Text>
                <Text style={s.topRev}>{fmtK(p.total_revenue || p.revenue || 0)}</Text>
              </View>
            ))}
          </View>
        )}

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
