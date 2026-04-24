import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors, Glass } from "@/constants/colors";
import { useSalesAnalytics, useProductsRanking } from "@/hooks/useSalesAnalytics";
import { fmtK, fmt, webOnly } from "./types";

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

  const summary = data?.summary || data;
  const totalSales = summary?.total_sales || 0;
  const totalRevenue = summary?.total_revenue || 0;
  const avgTicket = summary?.avg_ticket || 0;

  const topProducts = ranking?.products?.slice(0, 3) || data?.top_products?.slice(0, 3) || [];
  const totalProductsSold = ranking?.summary?.total_sold || topProducts.reduce((s: number, p: any) => s + (p.total_qty || p.qty_sold || 0), 0) || totalSales;

  const periodLabel = PERIODS.find(p => p.key === period)?.label || "Hoje";

  if (!isLoading && totalSales === 0 && totalRevenue === 0 && period === "month" && !topProducts.length) return null;

  const webCard = webOnly({
    background: Glass.card,
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
  });

  return (
    <View>
      <View style={s.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={s.titleBar} />
          <View>
            <Text style={s.title}>Vendas</Text>
            <Text style={s.sub}>Tempo real - auto-categorizado</Text>
          </View>
        </View>
        <View style={s.periodBar}>
          {PERIODS.map(p => (
            <Pressable key={p.key} onPress={() => setPeriod(p.key)}
              style={[s.periodBtn, period === p.key && s.periodBtnActive]}>
              <Text style={[s.periodText, period === p.key && s.periodTextActive]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[s.card, Platform.OS === "web" ? (webCard as any) : null, isFetching && { opacity: 0.7 }]}>
        <View style={s.kpiRow}>
          <View style={s.kpiMain}>
            <Text style={s.kpiMainValue}>{fmt(totalRevenue)}</Text>
            <Text style={s.kpiMainLabel}>Faturamento ({periodLabel.toLowerCase()})</Text>
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
            <Text style={s.topTitle}>Mais vendidos</Text>
            {topProducts.map((p: any, i: number) => (
              <View key={p.id || i} style={s.topRow}>
                <View style={[s.topRank, i === 0 && { backgroundColor: "rgba(251,191,36,0.18)", borderColor: "rgba(251,191,36,0.4)" }]}>
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
          <Text style={s.footerText}>Ver analise completa  -  </Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 },
  titleBar: { width: 4, height: 18, borderRadius: 2, backgroundColor: Colors.violet },
  title: { fontSize: 17, color: Colors.ink, fontWeight: "600" },
  sub: { fontSize: 10, color: Colors.ink3, letterSpacing: 0.5, marginTop: 2, fontFamily: (Platform.OS === "web" ? "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace" : undefined) },
  periodBar: {
    flexDirection: "row", padding: 3,
    backgroundColor: Glass.lineWhisper, borderRadius: 10,
    borderWidth: 1, borderColor: Glass.lineSoft,
  },
  periodBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7 },
  periodBtnActive: { backgroundColor: Colors.violet, shadowColor: Colors.violet, shadowOpacity: 0.4 as any, shadowRadius: 8 },
  periodText: { fontSize: 11, color: Colors.ink3, fontWeight: "600", letterSpacing: 0.3, fontFamily: (Platform.OS === "web" ? "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace" : undefined) },
  periodTextActive: { color: "#fff", fontWeight: "700" },
  card: {
    backgroundColor: Colors.bg3, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: Glass.lineBorderCard, marginBottom: 24,
  },
  kpiRow: { gap: 12, marginBottom: 12 },
  kpiMain: { alignItems: "center", paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Glass.lineSoft },
  kpiMainValue: { fontSize: 28, fontWeight: "800", color: Colors.green, letterSpacing: -0.5, textShadowColor: "rgba(52,211,153,0.3)" as any, textShadowRadius: Platform.OS === "web" ? 10 : 0 as any, fontFamily: (Platform.OS === "web" ? "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace" : undefined) },
  kpiMainLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: "700", marginTop: 4 },
  kpiSide: { flexDirection: "row", justifyContent: "space-around" },
  kpiSmall: { alignItems: "center", flex: 1 },
  kpiSmallValue: { fontSize: 18, fontWeight: "800", color: Colors.ink, fontFamily: (Platform.OS === "web" ? "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace" : undefined) },
  kpiSmallLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 3, fontWeight: "700" },
  kpiDivider: { width: 1, backgroundColor: Glass.lineSoft, marginHorizontal: 4 },
  emptyPeriod: { alignItems: "center", paddingVertical: 16 },
  emptyText: { fontSize: 12, color: Colors.ink3 },
  topSection: { borderTopWidth: 1, borderTopColor: Glass.lineSoft, paddingTop: 14, marginTop: 4 },
  topTitle: { fontSize: 10, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  topRank: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: "rgba(124,58,237,0.14)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.28)",
    alignItems: "center", justifyContent: "center",
  },
  topRankText: { fontSize: 11, fontWeight: "800", color: Colors.violet3, fontFamily: (Platform.OS === "web" ? "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace" : undefined) },
  topName: { flex: 1, fontSize: 12, color: Colors.ink, fontWeight: "600" },
  topQty: { fontSize: 11, color: Colors.ink3, fontFamily: (Platform.OS === "web" ? "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace" : undefined) },
  topRev: { fontSize: 12, color: Colors.green, fontWeight: "700", minWidth: 70, textAlign: "right", fontFamily: (Platform.OS === "web" ? "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace" : undefined) },
  footer: { alignItems: "center", paddingTop: 12, borderTopWidth: 1, borderTopColor: Glass.lineSoft, marginTop: 10 },
  footerText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
});
