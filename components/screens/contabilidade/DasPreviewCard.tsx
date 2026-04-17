import { View, Text, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { ListSkeleton } from "@/components/ListSkeleton";

var isWeb = Platform.OS === "web";

type AutoPreview = {
  regime: string;
  das: { total?: number; estimated_das?: number; effective_rate_pct?: number; nominal_rate_pct?: number; label?: string };
  limit_check?: { annual_revenue: number; annual_limit: number; used_pct: number; remaining: number; alert_level: string | null; alert_message: string | null };
  current_revenue?: number;
  revenue_12m?: number;
  due_date?: string;
};

var fmt = function(n: number) { return "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, "."); };

export function DasPreviewCard() {
  var { company } = useAuthStore();
  var companyId = company?.id;

  var { data, isLoading } = useQuery<AutoPreview>({
    queryKey: ["das-auto-preview", companyId],
    queryFn: function() { return request<AutoPreview>("/companies/" + companyId + "/obligations/das/auto-preview"); },
    enabled: !!companyId,
    staleTime: 300_000,
    retry: 1,
  });

  if (isLoading) return <ListSkeleton rows={1} />;
  if (!data) return null;

  var isMei = data.regime === "mei";
  var dasTotal = isMei ? (data.das.total || 0) : (data.das.estimated_das || 0);
  var dueLabel = data.due_date ? new Date(data.due_date + "T12:00:00").toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "dia 20";
  var limit = data.limit_check;

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          <View style={s.icon}><Text style={s.iconText}>$</Text></View>
          <View>
            <Text style={s.title}>{isMei ? "DAS-MEI" : "DAS Simples Nacional"}</Text>
            <Text style={s.subtitle}>Estimativa do mes | Vence {dueLabel}</Text>
          </View>
        </View>
        <Text style={s.amount}>{fmt(dasTotal)}</Text>
      </View>

      {!isMei && data.das.effective_rate_pct != null && (
        <View style={s.rateRow}>
          <Text style={s.rateLabel}>Aliquota efetiva</Text>
          <Text style={s.rateVal}>{data.das.effective_rate_pct}%</Text>
        </View>
      )}

      {isMei && limit && (
        <View style={s.limitSection}>
          <View style={s.limitHeader}>
            <Text style={s.limitLabel}>Faturamento anual MEI</Text>
            <Text style={s.limitPct}>{limit.used_pct.toFixed(1)}%</Text>
          </View>
          <View style={s.progressTrack}>
            <View style={[
              s.progressFill,
              { width: Math.min(limit.used_pct, 100) + "%" },
              { backgroundColor: limit.used_pct >= 100 ? Colors.red : limit.used_pct >= 80 ? Colors.amber : Colors.green },
              isWeb && { transition: "width 0.5s ease" } as any,
            ]} />
          </View>
          <View style={s.limitFooter}>
            <Text style={s.limitVal}>{fmt(limit.annual_revenue)}</Text>
            <Text style={s.limitMax}>de {fmt(limit.annual_limit)}</Text>
          </View>
          {limit.alert_message && (
            <View style={[s.alertBanner, { backgroundColor: limit.alert_level === "critical" ? Colors.redD : Colors.amberD }]}>
              <Icon name="alert" size={12} color={limit.alert_level === "critical" ? Colors.red : Colors.amber} />
              <Text style={[s.alertText, { color: limit.alert_level === "critical" ? Colors.red : Colors.amber }]}>{limit.alert_message}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 16, fontWeight: "800", color: Colors.violet3 },
  title: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  subtitle: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  amount: { fontSize: 22, fontWeight: "800", color: Colors.ink },
  rateRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  rateLabel: { fontSize: 10, color: Colors.ink3 },
  rateVal: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  limitSection: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  limitHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  limitLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "500" },
  limitPct: { fontSize: 12, color: Colors.ink, fontWeight: "700" },
  progressTrack: { height: 8, backgroundColor: Colors.bg4, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4 },
  limitFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  limitVal: { fontSize: 10, color: Colors.ink, fontWeight: "600" },
  limitMax: { fontSize: 10, color: Colors.ink3 },
  alertBanner: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, padding: 10, marginTop: 10 },
  alertText: { fontSize: 10, fontWeight: "500", flex: 1, lineHeight: 14 },
});

export default DasPreviewCard;
