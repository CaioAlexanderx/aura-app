// ============================================================
// AURA. — D-UNIFY: Detalhes do agendamento odonto
// Acoes: Confirmar, Iniciar atendimento, Concluir, Cancelar
// PATCH /companies/:id/dental/appointments/:aid
//
// W1-04: botao "Coletar assinatura" adicional quando status =
// em_atendimento. Alternativa a "Concluir consulta" — paciente
// assina no proprio celular via QR/WhatsApp, WS handler do BE
// transiciona automaticamente pra concluido.
// ============================================================
import { useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { SignatureRequestModal } from "./SignatureRequestModal";

interface Props {
  visible: boolean;
  appointmentId: string | null;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  agendado: "Agendado",
  avaliacao: "Em avaliacao",
  aprovado: "Aprovado",
  em_atendimento: "Em atendimento",
  concluido: "Concluido",
  cancelado: "Cancelado",
  faltou: "Faltou",
  confirmado: "Confirmado",
};

export function AppointmentDetailModal({ visible, appointmentId, onClose }: Props) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();
  const [signatureOpen, setSignatureOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["dental-appointment", cid, appointmentId],
    queryFn: () => request(`/companies/${cid}/dental/appointments/${appointmentId}`),
    enabled: !!cid && !!appointmentId && visible,
    staleTime: 5000,
  });

  const statusMut = useMutation({
    mutationFn: (newStatus: string) => request(`/companies/${cid}/dental/appointments/${appointmentId}`, {
      method: "PATCH",
      body: { status: newStatus },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dental-agenda"] });
      qc.invalidateQueries({ queryKey: ["dental-appointment"] });
    },
  });

  const appt = (data as any)?.appointment;
  const status = appt?.status || "agendado";

  function canTransitionTo(target: string): boolean {
    const transitions: Record<string, string[]> = {
      agendado: ["avaliacao", "em_atendimento", "cancelado", "faltou"],
      avaliacao: ["aprovado", "cancelado"],
      aprovado: ["em_atendimento", "cancelado"],
      em_atendimento: ["concluido", "cancelado"],
    };
    return (transitions[status] || []).includes(target);
  }

  function formatDateTime(iso: string) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  }

  function handleSigned() {
    // Assinatura foi capturada pelo WS -> BE ja transicionou pra concluido.
    // Fecha o modal de assinatura e tambem o modal principal.
    setSignatureOpen(false);
    onClose();
  }

  return (
    <>
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            <View>
              <Text style={s.title}>Detalhes</Text>
              {status && <View style={s.statusPill}><Text style={s.statusPillText}>{STATUS_LABELS[status] || status}</Text></View>}
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="x" size={20} color={Colors.ink3} />
            </Pressable>
          </View>

          {isLoading ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <ActivityIndicator color={Colors.violet3} />
            </View>
          ) : !appt ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <Text style={s.hint}>Agendamento nao encontrado</Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
              <Row label="Paciente" value={appt.patient_name || "—"} />
              <Row label="Telefone" value={appt.patient_phone || "—"} />
              <Row label="Data / hora" value={formatDateTime(appt.scheduled_at)} />
              <Row label="Duracao" value={`${appt.duration_min || 60} min`} />
              {appt.chief_complaint && <Row label="Queixa" value={appt.chief_complaint} />}
              {appt.insurance_name && <Row label="Convenio" value={appt.insurance_name} />}
              {appt.allergies && <Row label="Alergias" value={appt.allergies} highlight />}
              {(appt.procedures || []).length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={s.sectionLabel}>Procedimentos</Text>
                  {appt.procedures.map((p: any) => (
                    <View key={p.id} style={s.procRow}>
                      <Text style={s.procName}>{p.procedure_name}</Text>
                      <Text style={s.procPrice}>R$ {parseFloat(p.price_total || 0).toFixed(2)}</Text>
                    </View>
                  ))}
                  <View style={s.totalRow}>
                    <Text style={s.totalLabel}>Total</Text>
                    <Text style={s.totalValue}>R$ {parseFloat(appt.total || 0).toFixed(2)}</Text>
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          {/* Acoes conforme status atual */}
          {appt && !isLoading && (
            <View style={s.footer}>
              {canTransitionTo("em_atendimento") && (
                <Pressable onPress={() => statusMut.mutate("em_atendimento")} style={[s.btn, s.btnPrimary]} disabled={statusMut.isPending}>
                  {statusMut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>Iniciar atendimento</Text>}
                </Pressable>
              )}
              {/* W1-04: coletar assinatura e alternativa a concluir diretamente */}
              {status === "em_atendimento" && (
                <Pressable
                  onPress={() => setSignatureOpen(true)}
                  style={[s.btn, s.btnSignature]}
                  disabled={statusMut.isPending}
                >
                  <Icon name="edit" size={14} color="#fff" />
                  <Text style={s.btnPrimaryText}>Coletar assinatura</Text>
                </Pressable>
              )}
              {canTransitionTo("concluido") && (
                <Pressable onPress={() => statusMut.mutate("concluido")} style={[s.btn, s.btnSuccess]} disabled={statusMut.isPending}>
                  {statusMut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>Concluir consulta</Text>}
                </Pressable>
              )}
              {canTransitionTo("cancelado") && (
                <Pressable onPress={() => statusMut.mutate("cancelado")} style={[s.btn, s.btnDanger]} disabled={statusMut.isPending}>
                  <Text style={s.btnDangerText}>Cancelar</Text>
                </Pressable>
              )}
              {!canTransitionTo("em_atendimento") && !canTransitionTo("concluido") && !canTransitionTo("cancelado") && status !== "em_atendimento" && (
                <Pressable onPress={onClose} style={[s.btn, s.btnGhost]}>
                  <Text style={s.btnGhostText}>Fechar</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>

    {/* W1-04 overlay — modal de coleta de assinatura */}
    <SignatureRequestModal
      visible={signatureOpen}
      appointmentId={appointmentId}
      patientName={appt?.patient_name}
      patientPhone={appt?.patient_phone}
      onClose={() => setSignatureOpen(false)}
      onSigned={handleSigned}
    />
    </>
  );
}

function Row({ label, value, highlight }: any) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, highlight && s.rowValueHighlight]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: Colors.bg2 || "#0f0f1e", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%", borderWidth: 1, borderColor: Colors.border, borderBottomWidth: 0 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  title: { fontSize: 18, fontWeight: "700", color: Colors.ink },
  statusPill: { alignSelf: "flex-start", backgroundColor: "rgba(6,182,212,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 6 },
  statusPillText: { fontSize: 11, color: "#06B6D4", fontWeight: "600" },
  body: { padding: 20, gap: 8, paddingBottom: 30 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  rowLabel: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  rowValue: { fontSize: 13, color: Colors.ink, fontWeight: "500", flex: 1, textAlign: "right" },
  rowValueHighlight: { color: "#EF4444", fontWeight: "700" },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: Colors.violet3, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6, marginTop: 4 },
  procRow: { flexDirection: "row", justifyContent: "space-between", padding: 10, backgroundColor: Colors.bg3, borderRadius: 8, marginBottom: 4 },
  procName: { fontSize: 12, color: Colors.ink, flex: 1 },
  procPrice: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4 },
  totalLabel: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  totalValue: { fontSize: 14, color: Colors.violet3, fontWeight: "700" },
  hint: { fontSize: 12, color: Colors.ink3 },
  footer: { flexDirection: "row", gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: Colors.border, flexWrap: "wrap" },
  btn: { flex: 1, minWidth: 120, paddingVertical: 12, borderRadius: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  btnPrimary: { backgroundColor: Colors.violet || "#6d28d9" },
  btnPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  btnSuccess: { backgroundColor: "#10B981" },
  btnSignature: { backgroundColor: "#06B6D4" },
  btnDanger: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#EF4444" },
  btnDangerText: { color: "#EF4444", fontSize: 13, fontWeight: "600" },
  btnGhost: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  btnGhostText: { color: Colors.ink, fontSize: 13, fontWeight: "600" },
});

export default AppointmentDetailModal;
