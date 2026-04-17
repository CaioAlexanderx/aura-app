import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { ListSkeleton } from "@/components/ListSkeleton";
import { Icon } from "@/components/Icon";
import { EquipeAdmin } from "./EquipeAdmin";
import { useState } from "react";

type Stage = { key: string; label: string; count: number; clients: any[] };
type PipelineData = { total: number; stages: Stage[] };
type SlaData = { total_tickets: number; open: number; in_progress: number; resolved: number; avg_first_response_hours: number | null; avg_resolution_hours: number | null; sla_met: boolean };
type Consultation = { id: string; date: string; duration_hours: number; category: string; description: string; amount: number; status: string; trade_name?: string; consultant_name?: string };
type ConsultData = { total: number; total_hours: number; total_revenue: number; consultations: Consultation[] };

var fmt = function(n: number) { return "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, "."); };
var STAGE_COLORS = [Colors.red, Colors.amber, Colors.amber, Colors.violet3, Colors.green];
var STATUS_COLORS: Record<string, { bg: string; text: string }> = { scheduled: { bg: Colors.violetD, text: Colors.violet3 }, completed: { bg: Colors.greenD, text: Colors.green }, cancelled: { bg: Colors.redD, text: Colors.red } };
var CATEGORY_LABELS: Record<string, string> = { setup: "Setup", training: "Treinamento", automation: "Automacao", integration: "Integracao", data_analysis: "Analise de dados" };

export function OperacoesAdmin() {
  var [section, setSection] = useState("pipeline");
  var { data: pipeline, isLoading: loadP } = useQuery<PipelineData>({ queryKey: ["admin-pipeline"], queryFn: function() { return request("/admin/onboarding/pipeline"); }, staleTime: 120_000 });
  var { data: sla, isLoading: loadS } = useQuery<SlaData>({ queryKey: ["admin-sla"], queryFn: function() { return request("/admin/metrics/sla"); }, staleTime: 120_000 });
  var { data: consult } = useQuery<ConsultData>({ queryKey: ["admin-consultations"], queryFn: function() { return request("/admin/consultations"); }, staleTime: 120_000 });

  if (loadP || loadS) return <ListSkeleton rows={3} showCards />;

  var SECTIONS = [
    { key: "pipeline", label: "Pipeline" },
    { key: "sla", label: "SLA" },
    { key: "consultorias", label: "Consultorias" },
    { key: "equipe", label: "Equipe" },
  ];

  return (
    <View>
      {/* Sub-nav */}
      <View style={s.subNav}>
        {SECTIONS.map(function(sec) {
          return <Pressable key={sec.key} onPress={function() { setSection(sec.key); }} style={[s.subBtn, section === sec.key && s.subBtnActive]}>
            <Text style={[s.subText, section === sec.key && s.subTextActive]}>{sec.label}</Text>
          </Pressable>;
        })}
      </View>

      {section === "pipeline" && pipeline && (
        <View>
          <Text style={s.sectionTitle}>Pipeline de onboarding</Text>
          <View style={s.pipelineRow}>
            {pipeline.stages.map(function(stage, i) {
              var color = STAGE_COLORS[i] || Colors.ink3;
              return (
                <View key={stage.key} style={s.stageCard}>
                  <View style={[s.stageDot, { backgroundColor: color + "22" }]}>
                    <Text style={[s.stageCount, { color: color }]}>{stage.count}</Text>
                  </View>
                  <Text style={s.stageLabel}>{stage.label}</Text>
                  {stage.clients.slice(0, 3).map(function(c) {
                    return <Text key={c.id} style={s.stageClient} numberOfLines={1}>{c.name}</Text>;
                  })}
                  {stage.count > 3 && <Text style={s.stageMore}>+{stage.count - 3}</Text>}
                </View>
              );
            })}
          </View>
          <View style={s.funnelBar}>
            {pipeline.stages.map(function(stage, i) {
              var pct = pipeline.total > 0 ? Math.max(5, Math.round((stage.count / pipeline.total) * 100)) : 20;
              var color = STAGE_COLORS[i] || Colors.ink3;
              return <View key={stage.key} style={[s.funnelSeg, { flex: pct, backgroundColor: color + "33" }]}>
                <Text style={[s.funnelPct, { color: color }]}>{Math.round((stage.count/pipeline.total)*100)||0}%</Text>
              </View>;
            })}
          </View>
        </View>
      )}

      {section === "sla" && sla && (
        <View>
          <Text style={s.sectionTitle}>SLA de suporte</Text>
          <View style={s.slaGrid}>
            <View style={s.slaCard}><Text style={[s.slaVal, { color: Colors.amber }]}>{sla.open}</Text><Text style={s.slaLabel}>Abertos</Text></View>
            <View style={s.slaCard}><Text style={[s.slaVal, { color: Colors.violet3 }]}>{sla.in_progress}</Text><Text style={s.slaLabel}>Em andamento</Text></View>
            <View style={s.slaCard}><Text style={[s.slaVal, { color: Colors.green }]}>{sla.resolved}</Text><Text style={s.slaLabel}>Resolvidos</Text></View>
          </View>
          <View style={s.slaMetrics}>
            <View style={s.slaMetric}>
              <Text style={s.slaMetricLabel}>Tempo medio 1a resposta</Text>
              <Text style={[s.slaMetricVal, sla.avg_first_response_hours !== null && sla.avg_first_response_hours > 4 && { color: Colors.red }]}>{sla.avg_first_response_hours !== null ? sla.avg_first_response_hours + "h" : "N/A"}</Text>
              <Text style={s.slaMeta}>Meta: ate 4h</Text>
            </View>
            <View style={s.slaMetric}>
              <Text style={s.slaMetricLabel}>Tempo medio resolucao</Text>
              <Text style={[s.slaMetricVal, sla.avg_resolution_hours !== null && sla.avg_resolution_hours > 48 && { color: Colors.red }]}>{sla.avg_resolution_hours !== null ? sla.avg_resolution_hours + "h" : "N/A"}</Text>
              <Text style={s.slaMeta}>Meta: ate 48h</Text>
            </View>
            <View style={s.slaMetric}>
              <Text style={s.slaMetricLabel}>SLA cumprido</Text>
              <View style={[s.slaBadge, { backgroundColor: sla.sla_met ? Colors.greenD : Colors.amberD }]}>
                <Text style={[s.slaBadgeText, { color: sla.sla_met ? Colors.green : Colors.amber }]}>{sla.sla_met ? "Sim" : "Nao"}</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {section === "consultorias" && (
        <View>
          <Text style={s.sectionTitle}>Consultorias</Text>
          {consult && (
            <View style={s.consultKpis}>
              <View style={s.consultKpi}><Text style={s.consultKpiVal}>{consult.total}</Text><Text style={s.consultKpiLabel}>Total</Text></View>
              <View style={s.consultKpi}><Text style={[s.consultKpiVal, { color: Colors.violet3 }]}>{consult.total_hours}h</Text><Text style={s.consultKpiLabel}>Horas</Text></View>
              <View style={s.consultKpi}><Text style={[s.consultKpiVal, { color: Colors.green }]}>{fmt(consult.total_revenue)}</Text><Text style={s.consultKpiLabel}>Receita</Text></View>
            </View>
          )}
          {(!consult || consult.consultations.length === 0) && <Text style={s.empty}>Nenhuma consultoria registrada. Use a API POST /admin/consultations para criar.</Text>}
          {consult && consult.consultations.map(function(c) {
            var sc = STATUS_COLORS[c.status] || STATUS_COLORS.scheduled;
            return (
              <View key={c.id} style={s.consultRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.consultClient}>{c.trade_name || "Cliente avulso"}</Text>
                  <Text style={s.consultMeta}>{CATEGORY_LABELS[c.category] || c.category} \u00b7 {c.duration_hours}h \u00b7 {new Date(c.date).toLocaleDateString("pt-BR")}</Text>
                </View>
                <Text style={s.consultAmount}>{fmt(c.amount || 0)}</Text>
                <View style={[s.statusBadge, { backgroundColor: sc.bg }]}><Text style={[s.statusText, { color: sc.text }]}>{c.status}</Text></View>
              </View>
            );
          })}
        </View>
      )}

      {section === "equipe" && <EquipeAdmin />}
    </View>
  );
}

var s = StyleSheet.create({
  subNav: { flexDirection: "row", gap: 4, marginBottom: 16, backgroundColor: Colors.bg3, borderRadius: 10, padding: 3, borderWidth: 1, borderColor: Colors.border },
  subBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  subBtnActive: { backgroundColor: Colors.violet },
  subText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  subTextActive: { color: "#fff", fontWeight: "700" },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 14 },
  // Pipeline
  pipelineRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  stageCard: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  stageDot: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  stageCount: { fontSize: 18, fontWeight: "800" },
  stageLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.3, textAlign: "center", fontWeight: "600" },
  stageClient: { fontSize: 10, color: Colors.ink, textAlign: "center" },
  stageMore: { fontSize: 9, color: Colors.ink3, textAlign: "center" },
  funnelBar: { flexDirection: "row", height: 24, borderRadius: 6, overflow: "hidden", gap: 2, marginBottom: 20 },
  funnelSeg: { alignItems: "center", justifyContent: "center", borderRadius: 4 },
  funnelPct: { fontSize: 8, fontWeight: "700" },
  // SLA
  slaGrid: { flexDirection: "row", gap: 8, marginBottom: 16 },
  slaCard: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  slaVal: { fontSize: 24, fontWeight: "800" },
  slaLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", marginTop: 2 },
  slaMetrics: { flexDirection: "row", gap: 8 },
  slaMetric: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 4 },
  slaMetricLabel: { fontSize: 9, color: Colors.ink3, textAlign: "center", textTransform: "uppercase" },
  slaMetricVal: { fontSize: 18, fontWeight: "800", color: Colors.ink },
  slaMeta: { fontSize: 9, color: Colors.ink3 },
  slaBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
  slaBadgeText: { fontSize: 12, fontWeight: "700" },
  // Consultorias
  consultKpis: { flexDirection: "row", gap: 8, marginBottom: 16 },
  consultKpi: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  consultKpiVal: { fontSize: 18, fontWeight: "800", color: Colors.ink },
  consultKpiLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", marginTop: 2 },
  consultRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg3, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 6 },
  consultClient: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  consultMeta: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  consultAmount: { fontSize: 13, fontWeight: "700", color: Colors.green },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  empty: { fontSize: 12, color: Colors.ink3, textAlign: "center", padding: 24, fontStyle: "italic" },
});

export default OperacoesAdmin;
