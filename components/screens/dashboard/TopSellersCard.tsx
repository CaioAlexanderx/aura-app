import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";

var isWeb = Platform.OS === "web";

type RankedEmployee = {
  position: number; full_name: string; job_role: string;
  total_sales: number; total_revenue: number; trend_pct: number; medal: string | null;
};

type RankingData = {
  total_revenue: number; total_employees: number;
  ranking: RankedEmployee[];
};

var fmt = function(n: number) { return "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, "."); };
var MEDAL_EMOJI: Record<string, string> = { gold: "\uD83E\uDD47", silver: "\uD83E\uDD48", bronze: "\uD83E\uDD49" };

type Props = { onSeeAll?: () => void };

export function TopSellersCard({ onSeeAll }: Props) {
  var { company } = useAuthStore();
  var companyId = company?.id;
  var plan = company?.plan || "";
  var isNegocio = plan === "negocio" || plan === "expansao" || plan === "personalizado";

  var { data } = useQuery<RankingData>({
    queryKey: ["employees-ranking", companyId, "month"],
    queryFn: function() { return request<RankingData>("/companies/" + companyId + "/employees/ranking?period=month"); },
    enabled: !!companyId && isNegocio,
    staleTime: 300_000,
    retry: 1,
  });

  if (!isNegocio || !data || data.ranking.length === 0) return null;

  var top3 = data.ranking.slice(0, 3);

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <Text style={s.title}>Top vendedores do mes</Text>
        {onSeeAll && <Pressable onPress={onSeeAll}><Text style={s.seeAll}>Ver ranking</Text></Pressable>}
      </View>
      {top3.map(function(emp, i) {
        var medal = emp.medal || "";
        var emoji = MEDAL_EMOJI[medal] || String(emp.position);
        var trendColor = emp.trend_pct > 0 ? Colors.green : emp.trend_pct < 0 ? Colors.red : Colors.ink3;
        var trendArrow = emp.trend_pct > 0 ? "\u2191" : emp.trend_pct < 0 ? "\u2193" : "";
        return (
          <View key={i} style={[s.row, i < top3.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border }]}>
            <Text style={s.medal}>{emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={1}>{emp.full_name}</Text>
              <Text style={s.role}>{emp.total_sales} vendas</Text>
            </View>
            <View style={s.right}>
              <Text style={s.revenue}>{fmt(emp.total_revenue)}</Text>
              <Text style={[s.trend, { color: trendColor }]}>{trendArrow}{Math.abs(emp.trend_pct)}%</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

var s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  seeAll: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  medal: { fontSize: 18, width: 28, textAlign: "center" },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  role: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  right: { alignItems: "flex-end" },
  revenue: { fontSize: 13, color: Colors.green, fontWeight: "700" },
  trend: { fontSize: 10, fontWeight: "600" },
});

export default TopSellersCard;
