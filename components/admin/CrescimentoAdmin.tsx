import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { ListSkeleton } from "@/components/ListSkeleton";

type FunnelStage = { stage: string; count: number; pct: number };
type FunnelData = { funnel: FunnelStage[]; churned: number; conversion_rate: number };
type AdoptionData = { total_companies: number; modules: string[]; by_module: { module: string; adopters: number; adoption_pct: number }[]; matrix: any[] };
type GeoData = { by_city: any[]; by_regime: { regime: string; count: number }[]; total_cities: number };
type VerticalData = { verticals: { vertical: string; count: number }[]; by_plan: { plan: string; count: number }[] };

var MODULE_LABELS: Record<string, string> = { financeiro: "Financeiro", pdv: "PDV", estoque: "Estoque", crm: "CRM", folha: "Folha", contabilidade: "Contabilidade", nfe: "NF-e", canal: "Canal Digital", ia: "Agentes IA", agendamento: "Agendamento" };
var VERTICAL_LABELS: Record<string, string> = { sem_vertical: "Sem vertical", barbearia: "Barbearia", dental: "Dental", food: "Food", salao: "Salao", estetica: "Estetica", pet: "Pet" };
var FUNNEL_COLORS = [Colors.ink3, Colors.amber, Colors.violet3, Colors.green];
var PLAN_COLORS: Record<string, string> = { essencial: Colors.blue || "#3b82f6", negocio: Colors.violet3, expansao: Colors.green, personalizado: Colors.amber };

export function CrescimentoAdmin() {
  var { data: funnel, isLoading: loadF } = useQuery<FunnelData>({ queryKey: ["admin-funnel"], queryFn: function() { return request("/admin/metrics/funnel"); }, staleTime: 120_000 });
  var { data: adoption } = useQuery<AdoptionData>({ queryKey: ["admin-adoption"], queryFn: function() { return request("/admin/metrics/feature-adoption"); }, staleTime: 300_000 });
  var { data: geo } = useQuery<GeoData>({ queryKey: ["admin-geo"], queryFn: function() { return request("/admin/metrics/geography"); }, staleTime: 300_000 });
  var { data: verticals } = useQuery<VerticalData>({ queryKey: ["admin-verticals"], queryFn: function() { return request("/admin/metrics/verticals"); }, staleTime: 300_000 });

  if (loadF) return <ListSkeleton rows={3} showCards />;

  return (
    <View>
      {/* Funil de aquisicao */}
      {funnel && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Funil de aquisicao</Text>
          <View style={s.funnelList}>
            {funnel.funnel.map(function(stage, i) {
              var color = FUNNEL_COLORS[i] || Colors.ink3;
              var barWidth = Math.max(15, stage.pct);
              return (
                <View key={stage.stage} style={s.funnelRow}>
                  <Text style={s.funnelLabel}>{stage.stage}</Text>
                  <View style={s.funnelBarWrap}>
                    <View style={[s.funnelBar, { width: barWidth + "%", backgroundColor: color + "33" }]}>
                      <Text style={[s.funnelVal, { color: color }]}>{stage.count}</Text>
                    </View>
                  </View>
                  <Text style={s.funnelPct}>{stage.pct}%</Text>
                </View>
              );
            })}
          </View>
          <View style={s.conversionRow}>
            <Text style={s.convLabel}>Taxa de conversao (signup → pagante)</Text>
            <Text style={[s.convVal, { color: funnel.conversion_rate >= 30 ? Colors.green : Colors.amber }]}>{funnel.conversion_rate}%</Text>
          </View>
          {funnel.churned > 0 && <Text style={s.churnedNote}>{funnel.churned} empresa(s) cancelada(s)</Text>}
        </View>
      )}

      {/* Feature Adoption */}
      {adoption && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Adocao de features</Text>
          {adoption.by_module.map(function(mod) {
            var label = MODULE_LABELS[mod.module] || mod.module;
            var color = mod.adoption_pct >= 50 ? Colors.green : mod.adoption_pct >= 25 ? Colors.amber : Colors.red;
            return (
              <View key={mod.module} style={s.adoptionRow}>
                <Text style={s.adoptionLabel}>{label}</Text>
                <View style={s.adoptionBarWrap}>
                  <View style={[s.adoptionBar, { width: Math.max(5, mod.adoption_pct) + "%", backgroundColor: color + "44" }]} />
                </View>
                <Text style={[s.adoptionPct, { color: color }]}>{mod.adoption_pct}%</Text>
                <Text style={s.adoptionCount}>{mod.adopters}/{adoption.total_companies}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Distribuicao por plano */}
      {verticals && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Distribuicao por plano</Text>
          <View style={s.planRow}>
            {verticals.by_plan.map(function(p) {
              var color = PLAN_COLORS[p.plan] || Colors.ink3;
              return (
                <View key={p.plan} style={s.planCard}>
                  <View style={[s.planDot, { backgroundColor: color }]} />
                  <Text style={s.planName}>{(p.plan || "?").charAt(0).toUpperCase() + (p.plan || "").slice(1)}</Text>
                  <Text style={[s.planCount, { color: color }]}>{p.count}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Verticais */}
      {verticals && verticals.verticals.length > 0 && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Verticais ativas</Text>
          <View style={s.vertRow}>
            {verticals.verticals.map(function(v) {
              var label = VERTICAL_LABELS[v.vertical] || v.vertical;
              return (
                <View key={v.vertical} style={s.vertCard}>
                  <Text style={s.vertCount}>{v.count}</Text>
                  <Text style={s.vertLabel}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Geografia */}
      {geo && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Distribuicao por regime</Text>
          <View style={s.geoRow}>
            {geo.by_regime.map(function(r) {
              return (
                <View key={r.regime} style={s.geoCard}>
                  <Text style={s.geoCount}>{r.count}</Text>
                  <Text style={s.geoLabel}>{r.regime === "mei" ? "MEI" : r.regime === "simples_nacional" ? "Simples Nacional" : r.regime}</Text>
                </View>
              );
            })}
          </View>
          {geo.by_city.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={s.geoSubtitle}>Cidades</Text>
              {geo.by_city.slice(0, 5).map(function(c, i) {
                return <Text key={i} style={s.geoCity}>{c.city || "?"}{c.state ? ", " + c.state : ""} ({c.total})</Text>;
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 14 },
  // Funnel
  funnelList: { gap: 8, marginBottom: 12 },
  funnelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  funnelLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "500", width: 85 },
  funnelBarWrap: { flex: 1, height: 28, borderRadius: 6, backgroundColor: Colors.bg4, overflow: "hidden" },
  funnelBar: { height: 28, borderRadius: 6, justifyContent: "center", paddingLeft: 8 },
  funnelVal: { fontSize: 12, fontWeight: "800" },
  funnelPct: { fontSize: 10, color: Colors.ink3, fontWeight: "600", width: 30, textAlign: "right" },
  conversionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: Colors.bg4, borderRadius: 8, padding: 12 },
  convLabel: { fontSize: 11, color: Colors.ink3, flex: 1 },
  convVal: { fontSize: 18, fontWeight: "800" },
  churnedNote: { fontSize: 10, color: Colors.red, marginTop: 6, textAlign: "center" },
  // Adoption
  adoptionRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  adoptionLabel: { fontSize: 11, color: Colors.ink, fontWeight: "500", width: 80 },
  adoptionBarWrap: { flex: 1, height: 8, backgroundColor: Colors.bg4, borderRadius: 4, overflow: "hidden" },
  adoptionBar: { height: 8, borderRadius: 4 },
  adoptionPct: { fontSize: 11, fontWeight: "700", width: 30, textAlign: "right" },
  adoptionCount: { fontSize: 9, color: Colors.ink3, width: 24, textAlign: "right" },
  // Plans
  planRow: { flexDirection: "row", gap: 8 },
  planCard: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 10, padding: 14, alignItems: "center", gap: 4 },
  planDot: { width: 10, height: 10, borderRadius: 5 },
  planName: { fontSize: 11, color: Colors.ink, fontWeight: "500" },
  planCount: { fontSize: 20, fontWeight: "800" },
  // Verticals
  vertRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  vertCard: { minWidth: 80, backgroundColor: Colors.bg4, borderRadius: 10, padding: 12, alignItems: "center" },
  vertCount: { fontSize: 18, fontWeight: "800", color: Colors.ink },
  vertLabel: { fontSize: 9, color: Colors.ink3, marginTop: 2 },
  // Geo
  geoRow: { flexDirection: "row", gap: 8 },
  geoCard: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 10, padding: 14, alignItems: "center" },
  geoCount: { fontSize: 20, fontWeight: "800", color: Colors.ink },
  geoLabel: { fontSize: 10, color: Colors.ink3, marginTop: 2, textAlign: "center" },
  geoSubtitle: { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 6 },
  geoCity: { fontSize: 12, color: Colors.ink, paddingVertical: 2 },
});

export default CrescimentoAdmin;
