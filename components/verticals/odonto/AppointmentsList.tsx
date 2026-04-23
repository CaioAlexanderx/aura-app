// ============================================================
// AURA. — D-UNIFY: Lista de agendamentos (CRUD)
// GET  /companies/:id/dental/appointments  (com filtros)
// DELETE /companies/:id/dental/appointments/:aid
//
// Permite visualizar agendamentos passados, futuros e de periodos
// amplos — complementa a visao de grade (dia atual) do AgendaDental.
// ============================================================
import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Modal } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { AppointmentDetailModal } from "@/components/verticals/odonto/AppointmentDetailModal";

type Period = "today" | "7d" | "30d" | "future" | "all";
type StatusFilter = "all" | "agendado" | "em_atendimento" | "concluido" | "cancelado";

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  agendado:       { label: "Agendado",        color: "#06B6D4", bg: "rgba(6,182,212,0.12)" },
  avaliacao:      { label: "Em avaliacao",    color: "#8B5CF6", bg: "rgba(139,92,246,0.12)" },
  aprovado:       { label: "Aprovado",        color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  em_atendimento: { label: "Em atendimento",  color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  concluido:      { label: "Concluido",       color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  cancelado:      { label: "Cancelado",       color: "#9CA3AF", bg: "rgba(156,163,175,0.08)" },
  faltou:         { label: "Faltou",          color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  confirmado:     { label: "Confirmado",      color: "#10B981", bg: "rgba(16,185,129,0.12)" },
};

function periodDates(p: Period): { from?: string; to?: string } {
  const today = new Date();
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
  const iso = (dt: Date) => dt.toISOString().split("T")[0];

  if (p === "today")  return { from: iso(new Date(y, m, d)),         to: iso(new Date(y, m, d)) };
  if (p === "7d")     return { from: iso(new Date(y, m, d)),         to: iso(new Date(y, m, d + 7)) };
  if (p === "30d")    return { from: iso(new Date(y, m, d)),         to: iso(new Date(y, m, d + 30)) };
  if (p === "future") return { from: iso(new Date(y, m, d)) };
  return {};
}

export function AppointmentsList() {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();

  const [period, setPeriod] = useState<Period>("future");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["dental-appointments-list", cid, period, status],
    queryFn: () => {
      const dates = periodDates(period);
      const qs = new URLSearchParams();
      if (dates.from) qs.append("from", dates.from);
      if (dates.to)   qs.append("to",   dates.to);
      if (status !== "all") qs.append("status", status);
      return request(`/companies/${cid}/dental/appointments?${qs.toString()}`);
    },
    enabled: !!cid,
    staleTime: 15000,
  });

  const deleteMut = useMutation({
    mutationFn: (aid: string) => request(`/companies/${cid}/dental/appointments/${aid}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dental-appointments-list"] });
      qc.invalidateQueries({ queryKey: ["dental-agenda"] });
      setDeleteId(null);
    },
  });

  const appointments = (data as any)?.appointments || [];

  function formatDateTime(iso: string) {
    const d = new Date(iso);
    const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
    const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    return { date, time };
  }

  const periodOpts: Array<{ v: Period; l: string }> = [
    { v: "today", l: "Hoje" },
    { v: "7d",    l: "7 dias" },
    { v: "30d",   l: "30 dias" },
    { v: "future",l: "Futuros" },
    { v: "all",   l: "Todos" },
  ];
  const statusOpts: Array<{ v: StatusFilter; l: string }> = [
    { v: "all",            l: "Todos" },
    { v: "agendado",       l: "Agendado" },
    { v: "em_atendimento", l: "Em atendimento" },
    { v: "concluido",      l: "Concluido" },
    { v: "cancelado",      l: "Cancelado" },
  ];

  return (
    <>
      <View style={s.container}>
        {/* Filtros */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {periodOpts.map(o => (
            <Pressable key={o.v} onPress={() => setPeriod(o.v)} style={[s.pill, period === o.v && s.pillActive]}>
              <Text style={[s.pillText, period === o.v && s.pillTextActive]}>{o.l}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {statusOpts.map(o => (
            <Pressable key={o.v} onPress={() => setStatus(o.v)} style={[s.pillSm, status === o.v && s.pillSmActive]}>
              <Text style={[s.pillSmText, status === o.v && s.pillSmTextActive]}>{o.l}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Summary */}
        <Text style={s.summary}>{appointments.length} agendamento{appointments.length !== 1 ? "s" : ""}</Text>

        {/* Lista */}
        {isLoading && <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={Colors.violet3} /></View>}

        {!isLoading && appointments.length === 0 && (
          <View style={s.empty}>
            <Icon name="calendar" size={24} color={Colors.ink3} />
            <Text style={s.emptyText}>Nenhum agendamento no periodo selecionado</Text>
          </View>
        )}

        {!isLoading && appointments.map((a: any) => {
          const { date, time } = formatDateTime(a.scheduled_at);
          const meta = STATUS_META[a.status] || STATUS_META.agendado;
          return (
            <View key={a.id} style={s.card}>
              <View style={s.cardLeft}>
                <View style={s.dateBox}>
                  <Text style={s.dateDay}>{date}</Text>
                  <Text style={s.dateTime}>{time}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.patientName}>{a.patient_name || "Paciente"}</Text>
                  <Text style={s.meta}>
                    {a.professional_name ? `${a.professional_name}` : "Sem dentista alocado"} · {a.duration_min || 60}min
                  </Text>
                  {a.chief_complaint && <Text style={s.complaint}>{a.chief_complaint}</Text>}
                </View>
                <View style={[s.statusBadge, { backgroundColor: meta.bg }]}>
                  <Text style={[s.statusText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>
              <View style={s.actions}>
                <Pressable onPress={() => setDetailId(a.id)} style={[s.btn, s.btnGhost]}>
                  <Icon name="eye" size={12} color={Colors.ink} />
                  <Text style={s.btnText}>Ver</Text>
                </Pressable>
                {a.status !== "concluido" && (
                  <Pressable onPress={() => setDeleteId(a.id)} style={[s.btn, s.btnDanger]}>
                    <Icon name="trash" size={12} color="#EF4444" />
                    <Text style={[s.btnText, { color: "#EF4444" }]}>Excluir</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <AppointmentDetailModal
        visible={!!detailId}
        appointmentId={detailId}
        onClose={() => setDetailId(null)}
      />

      {/* Confirm delete */}
      <Modal visible={!!deleteId} transparent animationType="fade" onRequestClose={() => setDeleteId(null)}>
        <View style={s.confirmBackdrop}>
          <View style={s.confirmBox}>
            <Text style={s.confirmTitle}>Excluir agendamento?</Text>
            <Text style={s.confirmText}>
              Esta acao nao pode ser desfeita. Se o agendamento ja ocorreu ou foi cancelado, prefira manter o registro para historico.
            </Text>
            <View style={s.confirmActions}>
              <Pressable onPress={() => setDeleteId(null)} style={[s.btn, s.btnGhost, { flex: 1 }]} disabled={deleteMut.isPending}>
                <Text style={s.btnText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={() => deleteMut.mutate(deleteId!)} style={[s.btn, s.btnDangerSolid, { flex: 1 }]} disabled={deleteMut.isPending}>
                {deleteMut.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={[s.btnText, { color: "#fff" }]}>Excluir</Text>}
              </Pressable>
            </View>
            {deleteMut.isError && (
              <Text style={{ color: "#EF4444", fontSize: 11, marginTop: 8, textAlign: "center" }}>
                {(deleteMut.error as any)?.message || (deleteMut.error as any)?.error || "Erro ao excluir"}
              </Text>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  container: { gap: 10 },
  filterRow: { flexDirection: "row", gap: 6, paddingRight: 16 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3 },
  pillActive: { backgroundColor: Colors.violet || "#6d28d9", borderColor: Colors.violet || "#6d28d9" },
  pillText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  pillTextActive: { color: "#fff" },
  pillSm: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, backgroundColor: "transparent" },
  pillSmActive: { backgroundColor: Colors.violet3 || "#a78bfa", borderColor: Colors.violet3 || "#a78bfa" },
  pillSmText: { fontSize: 11, color: Colors.ink3, fontWeight: "600" },
  pillSmTextActive: { color: "#fff" },
  summary: { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginTop: 4 },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 13, color: Colors.ink3 },
  card: { backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  cardLeft: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  dateBox: { alignItems: "center", minWidth: 52, paddingVertical: 4, paddingHorizontal: 4, borderRadius: 8, backgroundColor: "rgba(109,40,217,0.08)" },
  dateDay: { fontSize: 11, color: Colors.violet3 || "#a78bfa", fontWeight: "700" },
  dateTime: { fontSize: 14, color: Colors.ink, fontWeight: "700", marginTop: 2 },
  patientName: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 2 },
  meta: { fontSize: 11, color: Colors.ink3 },
  complaint: { fontSize: 11, color: Colors.ink2 || "#aaa", fontStyle: "italic", marginTop: 3 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: "flex-start" },
  statusText: { fontSize: 10, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 6, justifyContent: "flex-end", borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  btn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  btnGhost: { backgroundColor: "transparent", borderColor: Colors.border },
  btnDanger: { backgroundColor: "transparent", borderColor: "#EF4444" },
  btnDangerSolid: { backgroundColor: "#EF4444", borderColor: "#EF4444" },
  btnText: { fontSize: 11, color: Colors.ink, fontWeight: "600" },
  confirmBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 20 },
  confirmBox: { backgroundColor: Colors.bg2 || "#0f0f1e", borderRadius: 14, padding: 20, maxWidth: 400, width: "100%", borderWidth: 1, borderColor: Colors.border },
  confirmTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 8 },
  confirmText: { fontSize: 12, color: Colors.ink3, lineHeight: 18, marginBottom: 16 },
  confirmActions: { flexDirection: "row", gap: 8 },
});

export default AppointmentsList;
