import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, BASE_URL } from "@/services/api";
import { ListSkeleton } from "@/components/ListSkeleton";
import { toast } from "@/components/Toast";
import { useState } from "react";

var isWeb = Platform.OS === "web";

type Overview = {
  clients: { total: number; paying: number; trial: number; overdue: number; new_this_month: number; by_plan: Record<string, number> };
  mrr: { total: number; by_plan: Record<string, number>; growth_pct: number; previous: number; arr: number };
  arpu: number;
  churn: { count: number; mrr_lost: number; rate_pct: number };
  costs: { current_month: number };
  margin: { gross: number; pct: number };
  goal: { mrr_target: number; clients_target: number; mrr_progress: number | null; clients_progress: number | null } | null;
  usage: { transactions_month: number; sales_month: number; total_products: number; total_customers: number };
};

type Alert = {
  type: string; priority: string; company_id?: string; company_name?: string;
  contact?: string; message: string; action?: string; plan?: string;
  days_left?: number; days_inactive?: number; score?: number;
};

type AlertsData = { total: number; critical: number; high: number; medium: number; alerts: Alert[] };

var fmt = function(n: number) { return "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, "."); };
var fmtK = function(n: number) { if (n >= 1000) return "R$ " + (n / 1000).toFixed(1).replace(".", ",") + "k"; return fmt(n); };

var PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: Colors.redD, text: Colors.red, border: Colors.red + "44" },
  high: { bg: Colors.amberD, text: Colors.amber, border: Colors.amber + "44" },
  medium: { bg: Colors.violetD, text: Colors.violet3, border: Colors.border2 },
  low: { bg: Colors.bg4, text: Colors.ink3, border: Colors.border },
};

var ALERT_ICONS: Record<string, string> = {
  trial_expiring: "clock", payment_overdue: "dollar", client_inactive: "user",
  health_critical: "alert", ticket_no_response: "message",
};

export function DashboardAdmin() {
  var { token } = useAuthStore();
  var qc = useQueryClient();
  var [recalculating, setRecalculating] = useState(false);

  var { data: overview, isLoading: loadingOv } = useQuery<Overview>({
    queryKey: ["admin-overview"],
    queryFn: function() { return request<Overview>("/admin/metrics/overview"); },
    staleTime: 120_000,
  });

  var { data: alertsData, isLoading: loadingAl } = useQuery<AlertsData>({
    queryKey: ["admin-alerts"],
    queryFn: function() { return request<AlertsData>("/admin/alerts"); },
    staleTime: 60_000,
  });

  async function handleRecalcHealth() {
    if (!token) return;
    setRecalculating(true);
    try {
      await fetch(BASE_URL + "/admin/health/recalculate", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" } });
      toast.success("Health scores recalculados!");
      qc.invalidateQueries({ queryKey: ["admin-alerts"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch { toast.error("Erro ao recalcular"); }
    finally { setRecalculating(false); }
  }

  if (loadingOv) return <ListSkeleton rows={4} showCards />;
  if (!overview) return <Text style={{ color: Colors.ink3, textAlign: "center", padding: 20 }}>Erro ao carregar metricas</Text>;

  var o = overview;
  var alerts = alertsData?.alerts || [];
  var mrrTrend = o.mrr.growth_pct;
  var mrrTrendColor = mrrTrend > 0 ? Colors.green : mrrTrend < 0 ? Colors.red : Colors.ink3;
  var mrrArrow = mrrTrend > 0 ? "\u2191" : mrrTrend < 0 ? "\u2193" : "";

  return (
    <View>
      {/* KPI Cards - row 1: MRR + Clientes + ARPU */}
      <View style={s.kpiRow}>
        <View style={[s.kpiCard, s.kpiMain]}>
          <Text style={s.kpiLabel}>MRR</Text>
          <Text style={s.kpiVal}>{fmtK(o.mrr.total)}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={[s.kpiTrend, { color: mrrTrendColor }]}>{mrrArrow}{Math.abs(mrrTrend)}%</Text>
            <Text style={s.kpiSub}>vs anterior</Text>
          </View>
          {o.goal?.mrr_progress != null && (
            <View style={s.goalBar}>
              <View style={[s.goalFill, { width: Math.min(o.goal.mrr_progress, 100) + "%" }, isWeb && { transition: "width 0.5s" } as any]} />
              <Text style={s.goalPct}>{o.goal.mrr_progress}% da meta</Text>
            </View>
          )}
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Clientes</Text>
          <Text style={s.kpiVal}>{o.clients.total}</Text>
          <Text style={s.kpiSub}>{o.clients.paying} pagantes</Text>
          {o.clients.trial > 0 && <Text style={[s.kpiSub, { color: Colors.amber }]}>{o.clients.trial} em trial</Text>}
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>ARPU</Text>
          <Text style={s.kpiVal}>{fmt(o.arpu)}</Text>
          <Text style={s.kpiSub}>por cliente</Text>
        </View>
      </View>

      {/* KPI Cards - row 2: Churn + Margem + Novos */}
      <View style={s.kpiRow}>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Churn</Text>
          <Text style={[s.kpiVal, { color: o.churn.rate_pct > 5 ? Colors.red : Colors.ink }]}>{o.churn.rate_pct}%</Text>
          <Text style={s.kpiSub}>{o.churn.count} cancelamento{o.churn.count !== 1 ? "s" : ""}</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Margem bruta</Text>
          <Text style={[s.kpiVal, { color: o.margin.pct >= 60 ? Colors.green : Colors.amber }]}>{o.margin.pct}%</Text>
          <Text style={s.kpiSub}>{fmtK(o.margin.gross)}</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Novos (mes)</Text>
          <Text style={[s.kpiVal, { color: Colors.green }]}>{o.clients.new_this_month}</Text>
          <Text style={s.kpiSub}>ARR {fmtK(o.mrr.arr)}</Text>
        </View>
      </View>

      {/* MRR Breakdown */}
      <View style={s.breakdownCard}>
        <Text style={s.sectionTitle}>MRR por plano</Text>
        <View style={s.breakdownRow}>
          {["essencial", "negocio", "expansao"].map(function(p) {
            var val = o.mrr.by_plan[p] || 0;
            var count = o.clients.by_plan[p] || 0;
            var color = p === "essencial" ? Colors.blue || "#3b82f6" : p === "negocio" ? Colors.violet3 : Colors.green;
            var pct = o.mrr.total > 0 ? Math.round((val / o.mrr.total) * 100) : 0;
            return (
              <View key={p} style={s.breakdownItem}>
                <View style={[s.breakdownDot, { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.breakdownName}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
                  <Text style={s.breakdownCount}>{count} cliente{count !== 1 ? "s" : ""}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={s.breakdownVal}>{fmtK(val)}</Text>
                  <Text style={s.breakdownPct}>{pct}%</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Uso da plataforma */}
      <View style={s.usageRow}>
        <View style={s.usageStat}><Text style={s.usageVal}>{o.usage.transactions_month}</Text><Text style={s.usageLabel}>Lancamentos (mes)</Text></View>
        <View style={s.usageStat}><Text style={s.usageVal}>{o.usage.sales_month}</Text><Text style={s.usageLabel}>Vendas PDV (mes)</Text></View>
        <View style={s.usageStat}><Text style={s.usageVal}>{o.usage.total_products}</Text><Text style={s.usageLabel}>Produtos</Text></View>
        <View style={s.usageStat}><Text style={s.usageVal}>{o.usage.total_customers}</Text><Text style={s.usageLabel}>Clientes</Text></View>
      </View>

      {/* Alertas */}
      <View style={s.alertsSection}>
        <View style={s.alertsHeader}>
          <Text style={s.sectionTitle}>Alertas operacionais</Text>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            {alertsData && alertsData.critical > 0 && <View style={s.alertBadgeCrit}><Text style={s.alertBadgeText}>{alertsData.critical} criticos</Text></View>}
            <Pressable onPress={handleRecalcHealth} disabled={recalculating} style={s.recalcBtn}>
              {recalculating ? <ActivityIndicator size="small" color={Colors.violet3} /> : <Icon name="refresh" size={12} color={Colors.violet3} />}
            </Pressable>
          </View>
        </View>

        {loadingAl && <ActivityIndicator color={Colors.violet3} />}
        {!loadingAl && alerts.length === 0 && (
          <View style={s.noAlerts}>
            <Icon name="check" size={20} color={Colors.green} />
            <Text style={s.noAlertsText}>Nenhum alerta no momento</Text>
          </View>
        )}
        {alerts.slice(0, 8).map(function(alert, i) {
          var colors = PRIORITY_COLORS[alert.priority] || PRIORITY_COLORS.low;
          var icon = ALERT_ICONS[alert.type] || "alert";
          return (
            <View key={i} style={[s.alertCard, { borderColor: colors.border }]}>
              <View style={[s.alertIcon, { backgroundColor: colors.bg }]}>
                <Icon name={icon} size={14} color={colors.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.alertCompany}>{alert.company_name || ""}</Text>
                <Text style={s.alertMessage}>{alert.message}</Text>
                {alert.action && <Text style={[s.alertAction, { color: colors.text }]}>{alert.action}</Text>}
              </View>
              <View style={[s.priorityBadge, { backgroundColor: colors.bg }]}>
                <Text style={[s.priorityText, { color: colors.text }]}>{alert.priority}</Text>
              </View>
            </View>
          );
        })}
        {alerts.length > 8 && <Text style={s.moreAlerts}>+{alerts.length - 8} alertas</Text>}
      </View>
    </View>
  );
}

var s = StyleSheet.create({
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  kpiCard: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 2 },
  kpiMain: { flex: 1.5 },
  kpiLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.3, fontWeight: "600" },
  kpiVal: { fontSize: 22, fontWeight: "800", color: Colors.ink },
  kpiTrend: { fontSize: 11, fontWeight: "700" },
  kpiSub: { fontSize: 10, color: Colors.ink3 },
  goalBar: { marginTop: 6, gap: 3 },
  goalFill: { height: 4, backgroundColor: Colors.violet, borderRadius: 2 },
  goalPct: { fontSize: 9, color: Colors.violet3, fontWeight: "600" },
  breakdownCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 12 },
  breakdownRow: { gap: 10 },
  breakdownItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  breakdownDot: { width: 10, height: 10, borderRadius: 5 },
  breakdownName: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  breakdownCount: { fontSize: 10, color: Colors.ink3 },
  breakdownVal: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  breakdownPct: { fontSize: 10, color: Colors.ink3 },
  usageRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  usageStat: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  usageVal: { fontSize: 16, fontWeight: "800", color: Colors.ink },
  usageLabel: { fontSize: 8, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.3, marginTop: 2, textAlign: "center" },
  alertsSection: { marginBottom: 20 },
  alertsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  alertBadgeCrit: { backgroundColor: Colors.redD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  alertBadgeText: { fontSize: 10, color: Colors.red, fontWeight: "700" },
  recalcBtn: { width: 28, height: 28, borderRadius: 7, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border2 },
  noAlerts: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.greenD, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.green + "33" },
  noAlertsText: { fontSize: 13, color: Colors.green, fontWeight: "500" },
  alertCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg3, borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 8 },
  alertIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  alertCompany: { fontSize: 12, fontWeight: "600", color: Colors.ink },
  alertMessage: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  alertAction: { fontSize: 10, fontWeight: "600", marginTop: 3 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priorityText: { fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  moreAlerts: { fontSize: 11, color: Colors.ink3, textAlign: "center", paddingVertical: 8 },
});

export default DashboardAdmin;
