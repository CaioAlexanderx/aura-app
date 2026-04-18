import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, Modal } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { toast } from "@/components/Toast";
import { Icon } from "@/components/Icon";

var fmt = function(n: number) { return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2 }); };

var STAGES = [
  { key: "lead", label: "Lead", color: Colors.ink3 },
  { key: "contacted", label: "Contatado", color: "#6366f1" },
  { key: "evaluation_scheduled", label: "Avaliacao", color: Colors.violet3 },
  { key: "evaluation_done", label: "Avaliado", color: "#8b5cf6" },
  { key: "budget_sent", label: "Orcamento", color: Colors.amber },
  { key: "budget_approved", label: "Aprovado", color: Colors.green },
  { key: "in_treatment", label: "Tratamento", color: "#06b6d4" },
  { key: "completed", label: "Concluido", color: Colors.green },
  { key: "lost", label: "Perdido", color: Colors.red },
];

function StageBadge({ stage }: { stage: string }) {
  var s = STAGES.find(function(x) { return x.key === stage; }) || STAGES[0];
  return <View style={[z.badge, { backgroundColor: s.color + "18" }]}><Text style={[z.badgeText, { color: s.color }]}>{s.label}</Text></View>;
}

function LeadCard({ lead, onMove }: { lead: any; onMove: (lid: string, stage: string) => void }) {
  var [expanded, setExpanded] = useState(false);
  var nextStages = STAGES.filter(function(s) { return s.key !== lead.stage && s.key !== "lead"; });
  return (
    <Pressable onPress={function() { setExpanded(!expanded); }} style={z.leadCard}>
      <View style={z.leadHeader}>
        <Text style={z.leadName}>{lead.lead_name}</Text>
        <StageBadge stage={lead.stage} />
      </View>
      {lead.treatment_value > 0 && <Text style={z.leadValue}>{fmt(parseFloat(lead.treatment_value))}</Text>}
      {lead.lead_phone && <Text style={z.leadMeta}>{lead.lead_phone}</Text>}
      {lead.source && <Text style={z.leadMeta}>Fonte: {lead.source}</Text>}
      {lead.assigned_name && <Text style={z.leadMeta}>Resp: {lead.assigned_name}</Text>}
      {expanded && (
        <View style={z.moveRow}>
          <Text style={z.moveLabel}>Mover para:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
            {nextStages.map(function(s) {
              return <Pressable key={s.key} onPress={function() { onMove(lead.id, s.key); }} style={[z.moveBtn, { borderColor: s.color + "44" }]}><Text style={[z.moveBtnText, { color: s.color }]}>{s.label}</Text></Pressable>;
            })}
          </ScrollView>
        </View>
      )}
    </Pressable>
  );
}

export function DentalFunnel() {
  var { company } = useAuthStore();
  var qc = useQueryClient();
  var [showForm, setShowForm] = useState(false);
  var [form, setForm] = useState({ lead_name: "", lead_phone: "", lead_email: "", source: "whatsapp", treatment_value: "", notes: "" });

  var { data, isLoading } = useQuery({
    queryKey: ["dental-funnel", company?.id],
    queryFn: function() { return request("/companies/" + company!.id + "/dental/funnel"); },
    enabled: !!company?.id, staleTime: 15000,
  });

  var { data: stats } = useQuery({
    queryKey: ["dental-funnel-stats", company?.id],
    queryFn: function() { return request("/companies/" + company!.id + "/dental/funnel/stats"); },
    enabled: !!company?.id, staleTime: 30000,
  });

  var createMut = useMutation({
    mutationFn: function(body: any) { return request("/companies/" + company!.id + "/dental/funnel/leads", { method: "POST", body: body }); },
    onSuccess: function() { qc.invalidateQueries({ queryKey: ["dental-funnel"] }); toast.success("Lead adicionado!"); setShowForm(false); setForm({ lead_name: "", lead_phone: "", lead_email: "", source: "whatsapp", treatment_value: "", notes: "" }); },
    onError: function(err: any) { toast.error(err?.message || "Erro"); },
  });

  var moveMut = useMutation({
    mutationFn: function(p: { lid: string; stage: string }) { return request("/companies/" + company!.id + "/dental/funnel/leads/" + p.lid, { method: "PATCH", body: { stage: p.stage } }); },
    onSuccess: function() { qc.invalidateQueries({ queryKey: ["dental-funnel"] }); qc.invalidateQueries({ queryKey: ["dental-funnel-stats"] }); toast.success("Lead movido!"); },
  });

  var funnelData = (data as any) || {};
  var stages = funnelData.stages || [];
  var statsData = (stats as any) || {};
  var activeStages = stages.filter(function(s: any) { return s.key !== "completed" && s.key !== "lost"; });

  return (
    <View>
      {statsData.total_leads > 0 && (
        <View style={z.statsRow}>
          <View style={z.stat}><Text style={z.statValue}>{fmt(statsData.pipeline_value || 0)}</Text><Text style={z.statLabel}>Pipeline</Text></View>
          <View style={z.stat}><Text style={[z.statValue, { color: Colors.green }]}>{statsData.conversion_to_treatment || 0}%</Text><Text style={z.statLabel}>Conversao</Text></View>
          <View style={z.stat}><Text style={z.statValue}>{statsData.total_leads || 0}</Text><Text style={z.statLabel}>Leads</Text></View>
          <View style={z.stat}><Text style={[z.statValue, { color: Colors.red }]}>{statsData.lost_pct || 0}%</Text><Text style={z.statLabel}>Perdidos</Text></View>
        </View>
      )}

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Text style={z.sectionTitle}>Funil de Vendas</Text>
        <Pressable onPress={function() { setShowForm(!showForm); }} style={z.addBtn}>
          <Icon name="plus" size={14} color={Colors.violet3} />
          <Text style={z.addBtnText}>Novo lead</Text>
        </Pressable>
      </View>

      {showForm && (
        <View style={z.formCard}>
          <TextInput style={z.input} value={form.lead_name} onChangeText={function(v) { setForm(function(f) { return { ...f, lead_name: v }; }); }} placeholder="Nome do paciente" placeholderTextColor={Colors.ink3} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput style={[z.input, { flex: 1 }]} value={form.lead_phone} onChangeText={function(v) { setForm(function(f) { return { ...f, lead_phone: v }; }); }} placeholder="Telefone" placeholderTextColor={Colors.ink3} />
            <TextInput style={[z.input, { flex: 1 }]} value={form.treatment_value} onChangeText={function(v) { setForm(function(f) { return { ...f, treatment_value: v }; }); }} placeholder="Valor estimado" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
          </View>
          <View style={z.sourceRow}>
            {["whatsapp","instagram","site","indicacao","walkin"].map(function(s) {
              var active = form.source === s;
              return <Pressable key={s} onPress={function() { setForm(function(f) { return { ...f, source: s }; }); }} style={[z.sourceBtn, active && z.sourceBtnActive]}><Text style={[z.sourceText, active && z.sourceTextActive]}>{s}</Text></Pressable>;
            })}
          </View>
          <Pressable onPress={function() { if (form.lead_name.trim()) createMut.mutate({ lead_name: form.lead_name, lead_phone: form.lead_phone, source: form.source, treatment_value: parseFloat(form.treatment_value.replace(",",".")) || 0, notes: form.notes }); }} style={[z.saveBtn, !form.lead_name.trim() && { opacity: 0.5 }]}>
            <Text style={z.saveBtnText}>{createMut.isPending ? "Salvando..." : "Adicionar lead"}</Text>
          </Pressable>
        </View>
      )}

      {isLoading && <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={Colors.violet3} /></View>}

      {!isLoading && activeStages.map(function(stage: any) {
        if (stage.count === 0) return null;
        var stageInfo = STAGES.find(function(s) { return s.key === stage.stage; }) || STAGES[0];
        return (
          <View key={stage.stage} style={z.stageSection}>
            <View style={z.stageHeader}>
              <View style={[z.stageDot, { backgroundColor: stageInfo.color }]} />
              <Text style={z.stageTitle}>{stageInfo.label}</Text>
              <Text style={z.stageCount}>{stage.count}</Text>
              {stage.value > 0 && <Text style={z.stageValue}>{fmt(stage.value)}</Text>}
            </View>
            {stage.leads.map(function(lead: any) {
              return <LeadCard key={lead.id} lead={lead} onMove={function(lid, newStage) { moveMut.mutate({ lid: lid, stage: newStage }); }} />;
            })}
          </View>
        );
      })}

      {!isLoading && funnelData.total === 0 && !showForm && (
        <View style={z.empty}><Icon name="users" size={28} color={Colors.ink3} /><Text style={z.emptyText}>Nenhum lead no funil</Text><Text style={z.emptyHint}>Adicione leads para acompanhar o pipeline de tratamentos.</Text></View>
      )}
    </View>
  );
}

var z = StyleSheet.create({
  statsRow: { flexDirection: "row", gap: 6, marginBottom: 16 },
  stat: { flex: 1, alignItems: "center", backgroundColor: Colors.bg3, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border },
  statValue: { fontSize: 16, fontWeight: "800", color: Colors.ink },
  statLabel: { fontSize: 8, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.violetD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border2 },
  addBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  formCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border2, marginBottom: 16, gap: 8 },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.ink },
  sourceRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  sourceBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  sourceBtnActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  sourceText: { fontSize: 11, color: Colors.ink3 },
  sourceTextActive: { color: Colors.violet3, fontWeight: "600" },
  saveBtn: { backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  stageSection: { marginBottom: 16 },
  stageHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  stageDot: { width: 10, height: 10, borderRadius: 5 },
  stageTitle: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  stageCount: { fontSize: 11, color: Colors.ink3, backgroundColor: Colors.bg4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  stageValue: { fontSize: 11, color: Colors.green, marginLeft: "auto", fontWeight: "600" },
  leadCard: { backgroundColor: Colors.bg3, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 6, gap: 4 },
  leadHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  leadName: { fontSize: 14, fontWeight: "700", color: Colors.ink, flex: 1 },
  leadValue: { fontSize: 13, color: Colors.green, fontWeight: "600" },
  leadMeta: { fontSize: 11, color: Colors.ink3 },
  moveRow: { marginTop: 8, gap: 6 },
  moveLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "600" },
  moveBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, backgroundColor: Colors.bg4 },
  moveBtnText: { fontSize: 10, fontWeight: "600" },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 9, fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  emptyHint: { fontSize: 12, color: Colors.ink3, textAlign: "center", maxWidth: 280 },
});

export default DentalFunnel;
