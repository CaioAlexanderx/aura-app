import { useState, useMemo } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { Icon } from "@/components/Icon";

var fmt = function(n: number) { return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2 }); };

function KpiCard({ value, label, color, icon }: { value: string; label: string; color: string; icon: string }) {
  return (
    <View style={z.kpi}>
      <View style={[z.kpiIcon, { backgroundColor: color + "18" }]}><Icon name={icon as any} size={16} color={color} /></View>
      <Text style={[z.kpiValue, { color: color }]}>{value}</Text>
      <Text style={z.kpiLabel}>{label}</Text>
    </View>
  );
}

export function OdontoDashboard() {
  var { company } = useAuthStore();

  var { data: agenda, isLoading: loadAgenda } = useQuery({
    queryKey: ["dental-dash-agenda", company?.id],
    queryFn: function() {
      var now = new Date();
      var start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      var end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      return request("/companies/" + company!.id + "/dental/agenda?start=" + start + "&end=" + end);
    },
    enabled: !!company?.id, staleTime: 30000,
  });

  var { data: funnel } = useQuery({
    queryKey: ["dental-dash-funnel", company?.id],
    queryFn: function() { return request("/companies/" + company!.id + "/dental/funnel/stats"); },
    enabled: !!company?.id, staleTime: 60000,
  });

  var { data: billing } = useQuery({
    queryKey: ["dental-dash-billing", company?.id],
    queryFn: function() { return request("/companies/" + company!.id + "/dental/billing/dashboard"); },
    enabled: !!company?.id, staleTime: 60000,
  });

  var agendaData = (agenda as any) || {};
  var funnelData = (funnel as any) || {};
  var billingData = (billing as any) || {};

  var appointments = agendaData.appointments || [];
  var totalHoje = agendaData.total || 0;
  var confirmados = appointments.filter(function(a: any) { return a.status === 'confirmed'; }).length;
  var pendentes = appointments.filter(function(a: any) { return a.status === 'scheduled' || a.status === 'pending'; }).length;
  var noShow = appointments.filter(function(a: any) { return a.status === 'no_show'; }).length;

  var isLoading = loadAgenda;

  return (
    <View>
      <Text style={z.title}>Dashboard Odonto</Text>

      {isLoading && <ActivityIndicator color={Colors.violet3} style={{ padding: 30 }} />}

      {!isLoading && (
        <>
          <View style={z.kpiRow}>
            <KpiCard value={String(totalHoje)} label="Consultas hoje" color="#06b6d4" icon="calendar" />
            <KpiCard value={String(confirmados)} label="Confirmados" color={Colors.green} icon="check" />
            <KpiCard value={String(pendentes)} label="Pendentes" color={Colors.amber} icon="clock" />
            <KpiCard value={String(noShow)} label="Faltas" color={Colors.red} icon="alert" />
          </View>

          <View style={z.kpiRow}>
            <KpiCard value={fmt(funnelData.pipeline_value || 0)} label="Pipeline funil" color={Colors.violet3} icon="users" />
            <KpiCard value={(funnelData.conversion_to_treatment || 0) + "%"} label="Conversao" color={Colors.green} icon="trending_up" />
            <KpiCard value={fmt(billingData.vencido || 0)} label="Inadimplente" color={Colors.red} icon="dollar" />
            <KpiCard value={fmt(billingData.recebido_mes || 0)} label="Recebido mes" color={Colors.green} icon="wallet" />
          </View>

          {appointments.length > 0 && (
            <View style={z.section}>
              <Text style={z.sectionTitle}>Proximos atendimentos</Text>
              {appointments.slice(0, 6).map(function(a: any) {
                var statusColors: Record<string, string> = { confirmed: Colors.green, scheduled: Colors.amber, pending: Colors.amber, in_progress: "#06b6d4", completed: Colors.ink3, no_show: Colors.red, cancelled: Colors.ink3 };
                var statusLabels: Record<string, string> = { confirmed: "Confirmado", scheduled: "Agendado", pending: "Pendente", in_progress: "Atendendo", completed: "Concluido", no_show: "Faltou", cancelled: "Cancelado" };
                var sc = statusColors[a.status] || Colors.ink3;
                return (
                  <View key={a.id} style={z.apptCard}>
                    <View style={[z.apptDot, { backgroundColor: sc }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={z.apptName}>{a.patient_name || "Paciente"}</Text>
                      <Text style={z.apptMeta}>{a.chief_complaint || "Consulta"} | {a.duration_min || 60}min</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={z.apptTime}>{new Date(a.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</Text>
                      <Text style={[z.apptStatus, { color: sc }]}>{statusLabels[a.status] || a.status}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {appointments.length === 0 && (
            <View style={z.empty}>
              <Icon name="calendar" size={28} color={Colors.ink3} />
              <Text style={z.emptyText}>Nenhuma consulta hoje</Text>
              <Text style={z.emptyHint}>Agende consultas na aba Agenda.</Text>
            </View>
          )}

          <View style={z.infoCard}>
            <Icon name="star" size={12} color={Colors.violet3} />
            <Text style={z.infoText}>O agente IA odonto analisa seus dados reais: consultas, funil, cobrancas e recall. Converse com ele pelo botao flutuante.</Text>
          </View>
        </>
      )}
    </View>
  );
}

var z = StyleSheet.create({
  title: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 14 },
  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  kpi: { flex: 1, minWidth: "22%", alignItems: "center", backgroundColor: Colors.bg3, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  kpiIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  kpiValue: { fontSize: 16, fontWeight: "800" },
  kpiLabel: { fontSize: 8, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  section: { marginTop: 12 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: Colors.ink, marginBottom: 8 },
  apptCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bg3, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 4, gap: 10 },
  apptDot: { width: 8, height: 8, borderRadius: 4 },
  apptName: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  apptMeta: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  apptTime: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  apptStatus: { fontSize: 9, fontWeight: "600", marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: 30, gap: 6 },
  emptyText: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  emptyHint: { fontSize: 12, color: Colors.ink3 },
  infoCard: { flexDirection: "row", gap: 8, backgroundColor: Colors.violetD, borderRadius: 10, padding: 14, marginTop: 16, borderWidth: 1, borderColor: Colors.border2 },
  infoText: { fontSize: 11, color: Colors.violet3, flex: 1, lineHeight: 16 },
});

export default OdontoDashboard;
