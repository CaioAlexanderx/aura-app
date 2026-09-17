// ============================================================
// AURA. — D-UNIFY: Lista de agendamentos (CRUD)
// GET  /companies/:id/dental/appointments  (com filtros)
// DELETE /companies/:id/dental/appointments/:aid
//
// Permite visualizar agendamentos passados, futuros e de periodos
// amplos — complementa a visao de grade (dia atual) do AgendaDental.
//
// PR20 (2026-04-27): botao "▶ Iniciar" pra agendamento/aprovado/
// em_atendimento — leva direto pra /dental/consulta/[id].
// Mockup agenda (16/09/2026): filtro "Amanhã · a confirmar" abre a rotina
// Confirmar amanhã (ConfirmTomorrowView); cores/rótulos de status vêm de
// constants/dentalStatus.
// ============================================================
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Modal } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { toDateOnlyString } from "@/utils/dateOnly";
import { AppointmentDetailModal } from "@/components/verticals/odonto/AppointmentDetailModal";
import { ContactActions } from "@/components/dental/ContactActions";
import { appointmentMessage } from "@/utils/whatsapp";
import { dentalStatus } from "@/constants/dentalStatus";
import { ConfirmTomorrowView, useTomorrowAppointments } from "@/components/verticals/odonto/ConfirmTomorrowView";

type Period = "today" | "7d" | "30d" | "future" | "all" | "confirm_tomorrow";
type StatusFilter = "all" | "agendado" | "confirmado" | "em_atendimento" | "concluido" | "faltou" | "cancelado";

function periodDates(p: Period): { from?: string; to?: string } {
  const today = new Date();
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
  const iso = toDateOnlyString; // dia local (toISOString daria o dia UTC)

  if (p === "today")  return { from: iso(new Date(y, m, d)),         to: iso(new Date(y, m, d)) };
  if (p === "7d")     return { from: iso(new Date(y, m, d)),         to: iso(new Date(y, m, d + 7)) };
  if (p === "30d")    return { from: iso(new Date(y, m, d)),         to: iso(new Date(y, m, d + 30)) };
  if (p === "future") return { from: iso(new Date(y, m, d)) };
  return {};
}

interface Props {
  /** Muda a cada clique no atalho "Confirmar amanhã" do cabeçalho: abre essa visão. */
  confirmTomorrowSignal?: number;
}

export function AppointmentsList({ confirmTomorrowSignal }: Props = {}) {
  const company = useAuthStore().company;
  const cid = company?.id;
  const qc = useQueryClient();
  const router = useRouter();

  const [period, setPeriod] = useState<Period>(confirmTomorrowSignal ? "confirm_tomorrow" : "future");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailSeed, setDetailSeed] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { pending: pendingTomorrow } = useTomorrowAppointments();
  const confirmMode = period === "confirm_tomorrow";

  useEffect(() => {
    if (confirmTomorrowSignal) setPeriod("confirm_tomorrow");
  }, [confirmTomorrowSignal]);

  function openDetail(a: any) {
    setDetailSeed(a);
    setDetailId(a.id);
  }

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
    enabled: !!cid && !confirmMode,
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
    { v: "all", l: "Todos" },
    ...(["agendado", "confirmado", "em_atendimento", "concluido", "faltou", "cancelado"] as const).map((k) => ({ v: k, l: dentalStatus(k).label })),
  ];

  return (
    <>
      <View style={s.container}>
        {/* Filtros */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          <Pressable
            testID="list-confirm-tomorrow"
            onPress={() => setPeriod("confirm_tomorrow")}
            style={[s.pill, confirmMode && s.pillActive, { flexDirection: "row", alignItems: "center", gap: 6 }]}
          >
            <Icon name="check" size={12} color={confirmMode ? "#fff" : Colors.ink3} />
            <Text style={[s.pillText, confirmMode && s.pillTextActive]}>Amanhã · a confirmar</Text>
            {pendingTomorrow > 0 && <View style={s.badge}><Text style={s.badgeText}>{pendingTomorrow}</Text></View>}
          </Pressable>
          {periodOpts.map(o => (
            <Pressable key={o.v} onPress={() => setPeriod(o.v)} style={[s.pill, period === o.v && s.pillActive]}>
              <Text style={[s.pillText, period === o.v && s.pillTextActive]}>{o.l}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {confirmMode && <ConfirmTomorrowView onOpen={openDetail} />}

        {!confirmMode && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {statusOpts.map(o => (
            <Pressable key={o.v} onPress={() => setStatus(o.v)} style={[s.pillSm, status === o.v && s.pillSmActive]}>
              <Text style={[s.pillSmText, status === o.v && s.pillSmTextActive]}>{o.l}</Text>
            </Pressable>
          ))}
        </ScrollView>
        )}

        {/* Summary */}
        {!confirmMode && <Text style={s.summary}>{appointments.length} agendamento{appointments.length !== 1 ? "s" : ""}</Text>}

        {/* Lista */}
        {!confirmMode && isLoading && <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={Colors.violet3} /></View>}

        {!confirmMode && !isLoading && appointments.length === 0 && (
          <View style={s.empty}>
            <Icon name="calendar" size={24} color={Colors.ink3} />
            <Text style={s.emptyText}>Nenhum agendamento no período selecionado</Text>
          </View>
        )}

        {!confirmMode && !isLoading && appointments.map((a: any) => {
          const { date, time } = formatDateTime(a.scheduled_at);
          const meta = dentalStatus(a.status);
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
                <View style={[s.statusBadge, { backgroundColor: meta.bg }, meta.dashed && { borderWidth: 1, borderStyle: "dashed", borderColor: meta.color }]}>
                  <Text style={[s.statusText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>
              <View style={s.actions}>
                <ContactActions
                  phone={a.patient_phone}
                  whatsappText={appointmentMessage({
                    status: a.status,
                    patientName: a.patient_name || "",
                    clinicName: company?.name,
                    when: new Date(a.scheduled_at),
                  })}
                  variant="icon"
                  showCall={false}
                  contactName={a.patient_name}
                />
                {(a.status === "agendado" || a.status === "aprovado" || a.status === "em_atendimento") && (
                  <Pressable
                    onPress={() => router.push(`/dental/consulta/${a.id}` as any)}
                    style={[s.btn, s.btnPrimary]}
                    accessibilityLabel={`Iniciar consulta de ${a.patient_name || "paciente"}`}
                  >
                    <Text style={[s.btnText, { color: "#fff" }]}>▶ Iniciar</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => openDetail(a)} style={[s.btn, s.btnGhost]}>
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
        seed={detailSeed}
        onClose={() => { setDetailId(null); setDetailSeed(null); }}
      />

      {/* Confirm delete */}
      <Modal visible={!!deleteId} transparent animationType="fade" onRequestClose={() => setDeleteId(null)}>
        <View style={s.confirmBackdrop}>
          <View style={s.confirmBox}>
            <Text style={s.confirmTitle}>Excluir agendamento?</Text>
            <Text style={s.confirmText}>
              Esta ação não pode ser desfeita. Se o agendamento já ocorreu ou foi cancelado, prefira manter o registro para histórico.
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
  badge: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: "#fbbf24", alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 11, fontWeight: "800", color: "#1a1200" },
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
  btnPrimary:    { backgroundColor: "#06B6D4", borderWidth: 0 },
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
