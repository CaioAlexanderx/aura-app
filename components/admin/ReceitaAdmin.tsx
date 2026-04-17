import { View, Text, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { ListSkeleton } from "@/components/ListSkeleton";

var isWeb = Platform.OS === "web";
var fmt = function(n: number) { return "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, "."); };
var fmtK = function(n: number) { return n >= 1000 ? "R$ " + (n/1000).toFixed(1).replace(".",",") + "k" : fmt(n); };

type Waterfall = { previous_mrr: number; current_mrr: number; new_mrr: number; expansion_mrr: number; churn_mrr: number; contraction_mrr: number; net_change: number; net_revenue_retention: number };
type UnitEcon = { paying_clients: number; mrr: number; arpu: number; churn: { rate_pct: number; count_3m: number }; ltv: { value: number; months: number }; cac: { value: number }; ltv_cac_ratio: number | null; costs: { total: number; breakdown: { category: string; amount: number }[] }; margin: { gross: number; pct: number } };
type Forecast = { current_mrr: number; growth_rate_pct: number; projections: { month: number; mrr: number; arr: number }[]; milestones: { mrr_1k: number | null; mrr_5k: number | null; mrr_10k: number | null } };
type TrendItem = { month: string; mrr_total: number; mrr_essencial: number; mrr_negocio: number; mrr_expansao: number; clients_total: number };

var CATEGORY_LABELS: Record<string, string> = { infra: "Infraestrutura", tools: "Ferramentas", people: "Pessoas", marketing: "Marketing", other: "Outros" };
var CATEGORY_COLORS: Record<string, string> = { infra: Colors.blue || "#3b82f6", tools: Colors.violet3, people: Colors.amber, marketing: Colors.green, other: Colors.ink3 };

export function ReceitaAdmin() {
  var { data: waterfall, isLoading: loadW } = useQuery<Waterfall>({ queryKey: ["admin-waterfall"], queryFn: function() { return request("/admin/metrics/mrr-waterfall"); }, staleTime: 120_000 });
  var { data: unitEcon, isLoading: loadU } = useQuery<UnitEcon>({ queryKey: ["admin-unit-econ"], queryFn: function() { return request("/admin/metrics/unit-economics"); }, staleTime: 120_000 });
  var { data: forecast, isLoading: loadF } = useQuery<Forecast>({ queryKey: ["admin-forecast"], queryFn: function() { return request("/admin/metrics/forecast"); }, staleTime: 300_000 });
  var { data: trendData } = useQuery<{ months: TrendItem[] }>({ queryKey: ["admin-mrr-trend"], queryFn: function() { return request("/admin/metrics/mrr-trend?months=12"); }, staleTime: 300_000 });

  if (loadW || loadU) return <ListSkeleton rows={4} showCards />;
  if (!waterfall || !unitEcon) return <Text style={{ color: Colors.ink3, textAlign: "center", padding: 20 }}>Erro ao carregar dados</Text>;

  var w = waterfall;
  var u = unitEcon;
  var f = forecast;
  var trend = trendData?.months || [];

  return (
    <View>
      {/* MRR Waterfall */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>MRR waterfall — este mes</Text>
        <View style={s.waterfallRow}>
          <WaterfallItem label="MRR anterior" value={w.previous_mrr} color={Colors.ink3} />
          <WaterfallItem label="+ Novo" value={w.new_mrr} color={Colors.green} sign="+" />
          <WaterfallItem label="+ Expansao" value={w.expansion_mrr} color={Colors.violet3} sign="+" />
          <WaterfallItem label="- Churn" value={w.churn_mrr} color={Colors.red} sign="-" />
          <WaterfallItem label="= MRR atual" value={w.current_mrr} color={Colors.ink} bold />
        </View>
        <View style={s.nrrRow}>
          <Text style={s.nrrLabel}>Net Revenue Retention</Text>
          <Text style={[s.nrrVal, { color: w.net_revenue_retention >= 100 ? Colors.green : Colors.red }]}>{w.net_revenue_retention}%</Text>
        </View>
      </View>

      {/* Unit Economics */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Unit economics</Text>
        <View style={s.econGrid}>
          <EconCard label="ARPU" value={fmt(u.arpu)} sub="por cliente" />
          <EconCard label="LTV" value={fmtK(u.ltv.value)} sub={u.ltv.months + " meses"} />
          <EconCard label="CAC" value={u.cac.value > 0 ? fmt(u.cac.value) : "N/A"} sub={u.cac.value > 0 ? "por aquisicao" : "Sem marketing"} />
          <EconCard label="LTV/CAC" value={u.ltv_cac_ratio ? u.ltv_cac_ratio + "x" : "N/A"} sub={u.ltv_cac_ratio && u.ltv_cac_ratio >= 3 ? "Saudavel" : u.ltv_cac_ratio ? "Abaixo de 3x" : ""} color={u.ltv_cac_ratio && u.ltv_cac_ratio >= 3 ? Colors.green : Colors.amber} />
        </View>
      </View>

      {/* Custos */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Custos operacionais — este mes</Text>
        <View style={s.costsRow}>
          <View style={s.costTotal}>
            <Text style={s.costTotalLabel}>Total custos</Text>
            <Text style={s.costTotalVal}>{fmt(u.costs.total)}</Text>
          </View>
          <View style={s.costTotal}>
            <Text style={s.costTotalLabel}>Margem bruta</Text>
            <Text style={[s.costTotalVal, { color: u.margin.pct >= 60 ? Colors.green : Colors.amber }]}>{u.margin.pct}%</Text>
          </View>
          <View style={s.costTotal}>
            <Text style={s.costTotalLabel}>Lucro bruto</Text>
            <Text style={[s.costTotalVal, { color: u.margin.gross >= 0 ? Colors.green : Colors.red }]}>{fmtK(u.margin.gross)}</Text>
          </View>
        </View>
        {u.costs.breakdown.length > 0 && (
          <View style={s.costBreakdown}>
            {u.costs.breakdown.map(function(c) {
              var pct = u.costs.total > 0 ? Math.round((c.amount / u.costs.total) * 100) : 0;
              var color = CATEGORY_COLORS[c.category] || Colors.ink3;
              return (
                <View key={c.category} style={s.costItem}>
                  <View style={[s.costDot, { backgroundColor: color }]} />
                  <Text style={s.costName}>{CATEGORY_LABELS[c.category] || c.category}</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={s.costVal}>{fmt(c.amount)}</Text>
                  <Text style={s.costPct}>{pct}%</Text>
                </View>
              );
            })}
          </View>
        )}
        {u.costs.breakdown.length === 0 && <Text style={s.noCosts}>Nenhum custo registrado este mes. Use POST /admin/costs para registrar.</Text>}
      </View>

      {/* MRR Trend */}
      {trend.length > 1 && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Evolucao MRR</Text>
          <View style={s.trendList}>
            {trend.map(function(t, i) {
              var prev = i > 0 ? trend[i-1].mrr_total : 0;
              var change = prev > 0 ? Math.round(((t.mrr_total - prev) / prev) * 100) : 0;
              var changeColor = change > 0 ? Colors.green : change < 0 ? Colors.red : Colors.ink3;
              return (
                <View key={t.month} style={s.trendRow}>
                  <Text style={s.trendMonth}>{t.month}</Text>
                  <Text style={s.trendVal}>{fmtK(t.mrr_total)}</Text>
                  <Text style={s.trendClients}>{t.clients_total} clientes</Text>
                  {i > 0 && <Text style={[s.trendChange, { color: changeColor }]}>{change > 0 ? "\u2191" : change < 0 ? "\u2193" : ""}{Math.abs(change)}%</Text>}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Forecast */}
      {f && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Projecao de crescimento</Text>
          <Text style={s.forecastGrowth}>Taxa de crescimento estimada: <Text style={{ color: Colors.violet3, fontWeight: "800" }}>{f.growth_rate_pct}% ao mes</Text></Text>
          <View style={s.forecastGrid}>
            {[3, 6, 12].map(function(m) {
              var proj = f.projections.find(function(p) { return p.month === m; });
              if (!proj) return null;
              return (
                <View key={m} style={s.forecastCard}>
                  <Text style={s.forecastLabel}>{m} meses</Text>
                  <Text style={s.forecastMRR}>{fmtK(proj.mrr)}</Text>
                  <Text style={s.forecastARR}>ARR {fmtK(proj.arr)}</Text>
                </View>
              );
            })}
          </View>
          {(f.milestones.mrr_1k || f.milestones.mrr_5k || f.milestones.mrr_10k) && (
            <View style={s.milestones}>
              <Text style={s.milestoneTitle}>Marcos estimados</Text>
              {f.milestones.mrr_1k && <Text style={s.milestoneItem}>R$ 1k MRR em ~{f.milestones.mrr_1k} mes{f.milestones.mrr_1k > 1 ? "es" : ""}</Text>}
              {f.milestones.mrr_5k && <Text style={s.milestoneItem}>R$ 5k MRR em ~{f.milestones.mrr_5k} meses</Text>}
              {f.milestones.mrr_10k && <Text style={s.milestoneItem}>R$ 10k MRR em ~{f.milestones.mrr_10k} meses</Text>}
            </View>
          )}
          <Text style={s.disclaimer}>Projecao baseada em taxa historica. Resultados reais podem variar.</Text>
        </View>
      )}
    </View>
  );
}

// Sub-components
function WaterfallItem(p: { label: string; value: number; color: string; sign?: string; bold?: boolean }) {
  return (
    <View style={s.wfItem}>
      <Text style={s.wfLabel}>{p.label}</Text>
      <Text style={[s.wfVal, { color: p.color }, p.bold && { fontSize: 18 }]}>{p.sign || ""}{fmtK(p.value)}</Text>
    </View>
  );
}

function EconCard(p: { label: string; value: string; sub: string; color?: string }) {
  return (
    <View style={s.econCard}>
      <Text style={s.econLabel}>{p.label}</Text>
      <Text style={[s.econVal, p.color && { color: p.color }]}>{p.value}</Text>
      <Text style={s.econSub}>{p.sub}</Text>
    </View>
  );
}

var s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 14 },
  // Waterfall
  waterfallRow: { flexDirection: "row", gap: 6, marginBottom: 12 },
  wfItem: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 10, padding: 10, alignItems: "center", gap: 2 },
  wfLabel: { fontSize: 8, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.2, textAlign: "center" },
  wfVal: { fontSize: 14, fontWeight: "800" },
  nrrRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  nrrLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  nrrVal: { fontSize: 16, fontWeight: "800" },
  // Unit Economics
  econGrid: { flexDirection: "row", gap: 8 },
  econCard: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 10, padding: 12, alignItems: "center", gap: 2 },
  econLabel: { fontSize: 8, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.3, fontWeight: "600" },
  econVal: { fontSize: 16, fontWeight: "800", color: Colors.ink },
  econSub: { fontSize: 9, color: Colors.ink3 },
  // Costs
  costsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  costTotal: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 10, padding: 12, alignItems: "center" },
  costTotalLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.3 },
  costTotalVal: { fontSize: 18, fontWeight: "800", color: Colors.ink, marginTop: 2 },
  costBreakdown: { gap: 6 },
  costItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  costDot: { width: 8, height: 8, borderRadius: 4 },
  costName: { fontSize: 12, color: Colors.ink, fontWeight: "500" },
  costVal: { fontSize: 12, fontWeight: "700", color: Colors.ink },
  costPct: { fontSize: 10, color: Colors.ink3, width: 30, textAlign: "right" },
  noCosts: { fontSize: 11, color: Colors.ink3, fontStyle: "italic", textAlign: "center", paddingVertical: 12 },
  // Trend
  trendList: { gap: 4 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  trendMonth: { fontSize: 12, color: Colors.ink3, fontWeight: "500", width: 60 },
  trendVal: { fontSize: 13, fontWeight: "700", color: Colors.ink, flex: 1 },
  trendClients: { fontSize: 10, color: Colors.ink3 },
  trendChange: { fontSize: 10, fontWeight: "700", width: 40, textAlign: "right" },
  // Forecast
  forecastGrowth: { fontSize: 12, color: Colors.ink3, marginBottom: 12 },
  forecastGrid: { flexDirection: "row", gap: 8, marginBottom: 12 },
  forecastCard: { flex: 1, backgroundColor: Colors.violetD, borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: Colors.border2 },
  forecastLabel: { fontSize: 10, color: Colors.violet3, fontWeight: "600" },
  forecastMRR: { fontSize: 18, fontWeight: "800", color: Colors.ink, marginTop: 4 },
  forecastARR: { fontSize: 10, color: Colors.ink3, marginTop: 2 },
  milestones: { backgroundColor: Colors.greenD, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.green + "33" },
  milestoneTitle: { fontSize: 10, color: Colors.green, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 6 },
  milestoneItem: { fontSize: 12, color: Colors.green, fontWeight: "500", paddingVertical: 2 },
  disclaimer: { fontSize: 9, color: Colors.ink3, fontStyle: "italic", textAlign: "center" },
});

export default ReceitaAdmin;
