import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { fmt, fmtK } from "./types";

var isWeb = Platform.OS === "web";

type Projection = { days: number; label: string; receita: number; despesa: number; resultado: number };
type CashFlowData = {
  current_month: { receita: number; despesa: number; resultado: number; projecao_receita: number; dias_restantes: number; pct_mes: number };
  averages: { receita: number; despesa: number; resultado: number; meses: number };
  velocity: { daily_7d: number; daily_30d: number; trend_pct: number };
  projections: Projection[];
  risk: { level: string; message: string };
  monthly_history: { month: string; label: string; receita: number; despesa: number; resultado: number }[];
};

export function CashFlowCard() {
  var { company } = useAuthStore();
  var companyId = company?.id;
  var plan = company?.plan || "";
  var isExpansao = plan === "expansao" || plan === "personalizado";

  var { data, isLoading, isError } = useQuery<CashFlowData>({
    queryKey: ["cashflow", companyId],
    queryFn: function() { return request<CashFlowData>("/companies/" + companyId + "/cashflow"); },
    enabled: !!companyId && isExpansao,
    staleTime: 300_000,
    retry: 1,
  });

  if (!isExpansao) {
    return (
      <View style={s.card}>
        <View style={s.lockRow}>
          <Icon name="lock" size={14} color={Colors.violet3} />
          <Text style={s.lockText}>Projecao de fluxo de caixa disponivel no plano Expansao</Text>
        </View>
      </View>
    );
  }

  if (isLoading) return <View style={s.card}><ActivityIndicator color={Colors.violet3} /></View>;
  if (isError || !data) return null;

  var d = data;
  var riskColor = d.risk.level === "critical" ? Colors.red : d.risk.level === "warning" ? Colors.amber : Colors.green;
  var riskBg = d.risk.level === "critical" ? Colors.redD : d.risk.level === "warning" ? Colors.amberD : Colors.greenD;
  var maxProj = Math.max(1, ...d.projections.map(function(p) { return Math.max(Math.abs(p.receita), Math.abs(p.despesa)); }));
  var trendArrow = d.velocity.trend_pct > 0 ? "\u2191" : d.velocity.trend_pct < 0 ? "\u2193" : "";
  var trendColor = d.velocity.trend_pct > 0 ? Colors.green : d.velocity.trend_pct < 0 ? Colors.red : Colors.ink3;

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <Text style={s.title}>Projecao de caixa</Text>
        <View style={[s.riskBadge, { backgroundColor: riskBg }]}>
          <View style={[s.riskDot, { backgroundColor: riskColor }]} />
          <Text style={[s.riskText, { color: riskColor }]}>{d.risk.level === "critical" ? "Critico" : d.risk.level === "warning" ? "Atencao" : "Saudavel"}</Text>
        </View>
      </View>

      {/* Mes atual */}
      <View style={s.monthRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.monthLabel}>Mes atual ({d.current_month.pct_mes}%)</Text>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: d.current_month.pct_mes + "%" }, isWeb && { transition: "width 0.5s ease" } as any]} />
          </View>
        </View>
        <View style={s.monthStats}>
          <Text style={s.monthVal}>{fmtK(d.current_month.receita)}</Text>
          <Text style={s.monthHint}>de ~{fmtK(d.current_month.projecao_receita)}</Text>
        </View>
      </View>

      {/* Velocidade */}
      <View style={s.velRow}>
        <Text style={s.velLabel}>Velocidade diaria</Text>
        <Text style={s.velVal}>{fmt(d.velocity.daily_7d)}/dia</Text>
        <Text style={[s.velTrend, { color: trendColor }]}>{trendArrow}{Math.abs(d.velocity.trend_pct)}%</Text>
      </View>

      {/* Projecoes 30/60/90 */}
      <Text style={s.projTitle}>Projecao</Text>
      {d.projections.map(function(p) {
        var wR = Math.round((p.receita / maxProj) * 100);
        var wD = Math.round((p.despesa / maxProj) * 100);
        return (
          <View key={p.days} style={s.projRow}>
            <Text style={s.projLabel}>{p.label}</Text>
            <View style={s.projBars}>
              <View style={s.projBarWrap}>
                <View style={[s.projBar, s.projBarInc, { width: Math.max(wR, 3) + "%" }, isWeb && { transition: "width 0.4s" } as any]} />
              </View>
              <View style={s.projBarWrap}>
                <View style={[s.projBar, s.projBarExp, { width: Math.max(wD, 3) + "%" }, isWeb && { transition: "width 0.4s" } as any]} />
              </View>
            </View>
            <Text style={[s.projResult, { color: p.resultado >= 0 ? Colors.green : Colors.red }]}>{p.resultado >= 0 ? "+" : ""}{fmtK(p.resultado)}</Text>
          </View>
        );
      })}

      <Text style={s.riskMsg}>{d.risk.message}</Text>
    </View>
  );
}

var s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  title: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  riskBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16 },
  riskDot: { width: 6, height: 6, borderRadius: 3 },
  riskText: { fontSize: 10, fontWeight: "700" },
  monthRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  monthLabel: { fontSize: 10, color: Colors.ink3, marginBottom: 6 },
  progressTrack: { height: 6, backgroundColor: Colors.bg4, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: Colors.violet, borderRadius: 3 },
  monthStats: { alignItems: "flex-end" },
  monthVal: { fontSize: 16, fontWeight: "800", color: Colors.green },
  monthHint: { fontSize: 10, color: Colors.ink3 },
  velRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  velLabel: { fontSize: 10, color: Colors.ink3, flex: 1 },
  velVal: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  velTrend: { fontSize: 11, fontWeight: "700" },
  projTitle: { fontSize: 10, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 8 },
  projRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  projLabel: { width: 50, fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  projBars: { flex: 1, gap: 3 },
  projBarWrap: { height: 6, backgroundColor: Colors.bg4, borderRadius: 3, overflow: "hidden" },
  projBar: { height: 6, borderRadius: 3 },
  projBarInc: { backgroundColor: Colors.green },
  projBarExp: { backgroundColor: Colors.red, opacity: 0.7 },
  projResult: { width: 68, fontSize: 12, fontWeight: "700", textAlign: "right" },
  riskMsg: { fontSize: 11, color: Colors.ink3, fontStyle: "italic", marginTop: 8, lineHeight: 16 },
  lockRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  lockText: { fontSize: 12, color: Colors.ink3, flex: 1 },
});

export default CashFlowCard;
