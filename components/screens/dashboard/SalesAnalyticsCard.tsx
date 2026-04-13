import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Colors } from "@/constants/colors";
import { useSalesAnalytics, useProductsRanking } from "@/hooks/useSalesAnalytics";
import { fmtK, fmt } from "./types";

export function SalesAnalyticsCard({ onPress }: { onPress: () => void }) {
  const { data, isLoading } = useSalesAnalytics("month", "day");
  const { data: ranking } = useProductsRanking("month");
  if (isLoading || !data) return null;
  if (data.total_sales === 0 && !ranking?.products?.length) return null;
  const topProducts = ranking?.products?.slice(0, 3) || [];
  const growth = data.comparison?.growth_pct;
  return (
    <View>
      <View style={s.sh}><Text style={s.sec}>Desempenho de vendas</Text><TouchableOpacity onPress={onPress}><Text style={s.sa}>Ver detalhes</Text></TouchableOpacity></View>
      <View style={s.card}>
        <View style={s.row}>
          <View style={s.metric}><Text style={s.mv}>{data.total_sales}</Text><Text style={s.ml}>Vendas no mes</Text></View>
          <View style={s.divider} />
          <View style={s.metric}><Text style={s.mv}>{fmtK(data.total_revenue)}</Text><Text style={s.ml}>Faturamento</Text></View>
          <View style={s.divider} />
          <View style={s.metric}><Text style={s.mv}>{fmt(data.avg_ticket)}</Text><Text style={s.ml}>Ticket medio</Text></View>
        </View>
        {growth !== undefined && growth !== null && (
          <View style={[s.gb, { backgroundColor: growth >= 0 ? Colors.greenD : Colors.redD }]}>
            <Text style={[s.gt, { color: growth >= 0 ? Colors.green : Colors.red }]}>{growth >= 0 ? "+" : ""}{growth.toFixed(1)}% vs mes anterior</Text>
          </View>
        )}
        {topProducts.length > 0 && (
          <View style={s.top}>
            <Text style={s.topTitle}>Mais vendidos</Text>
            {topProducts.map((p: any, i: number) => (
              <View key={p.id || i} style={s.topRow}>
                <View style={s.topRank}><Text style={s.topRankText}>{i + 1}</Text></View>
                <Text style={s.topName} numberOfLines={1}>{p.name}</Text>
                <Text style={s.topQty}>{p.qty_sold} un</Text>
                <Text style={s.topRev}>{fmtK(p.revenue)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  sh: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sec: { fontSize: 15, color: Colors.ink, fontWeight: "600" },
  sa: { fontSize: 12, color: Colors.violet3, fontWeight: "500" },
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 24 },
  row: { flexDirection: "row", justifyContent: "space-around", marginBottom: 12 },
  metric: { alignItems: "center", flex: 1 },
  mv: { fontSize: 18, fontWeight: "800", color: Colors.ink, marginBottom: 2 },
  ml: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  divider: { width: 1, backgroundColor: Colors.border, marginHorizontal: 8 },
  gb: { alignSelf: "center", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 12 },
  gt: { fontSize: 11, fontWeight: "600" },
  top: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  topTitle: { fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  topRank: { width: 22, height: 22, borderRadius: 6, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  topRankText: { fontSize: 10, fontWeight: "700", color: Colors.violet3 },
  topName: { flex: 1, fontSize: 12, color: Colors.ink, fontWeight: "500" },
  topQty: { fontSize: 11, color: Colors.ink3 },
  topRev: { fontSize: 12, color: Colors.green, fontWeight: "600", minWidth: 70, textAlign: "right" },
});
