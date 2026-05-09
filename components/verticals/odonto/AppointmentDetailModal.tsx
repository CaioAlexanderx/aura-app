// ============================================================
// AURA. — D-UNIFY: Detalhes do agendamento odonto
// Acoes: Confirmar, Iniciar atendimento, Concluir, Cancelar
// PATCH /companies/:id/dental/appointments/:aid
//
// Item 1  (2026-04-27): Modal centrado (fade, backdrop escuro centralizado).
// Item 10 (2026-04-27): Assinatura vinculada ao fim do atendimento.
// PR24 (2026-04-28): atalho "Abrir prontuario" no footer.
// FIX-16 (2026-05-09): transicao agendado → confirmado + botao "Confirmar".
// FIX-21 (2026-05-09): seletor de status com chips (Nao confirmada,
//   Confirmada, Falta justificada, Falta, Paciente no consultorio).
// ============================================================
import { useState } from "react";
import { useRouter } from "expo-router";
import { Modal, View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView, Platform } from "react-native";
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
  agendado:             "Agendado",
  confirmado:           "Confirmado",
  avaliacao:            "Em avaliacao",
  aprovado:             "Aprovado",
  em_atendimento:       "Em atendimento",
  concluido:            "Concluido",
  cancelado:            "Cancelado",
  faltou:               "Faltou",
  falta_justificada:    "Falta justificada",
  paciente_consultorio: "Paciente no consultorio",
};

// Chips de status disponíveis para seleção rápida (FIX-21)
const STATUS_CHIPS: Array<{ value: string; label: string; color: string }> = [
  { value: "agendado",             label: "Nao confirmada",        color: "#06B6D4" },
  { value: "confirmado",           label: "Confirmada",            color: "#F97316" },
  { value: "paciente_consultorio", label: "Paciente no consult.",  color: "#A78BFA" },
  { value: "falta_justificada",    label: "Falta justificada",     color: "#F59E0B" },
  { value: "faltou",               label: "Falta",                 color: "#EF4444" },
];

export function AppointmentDetailModal({ visible, appointmentId, onClose }: Props) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();
  const router = useRouter();
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

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
      qc.invalidateQueries({ queryKey: ["dental-hoje-appointments"] });
      setShowStatusPicker(false);
    },
  });

  const appt = (data as any)?.appointment;
  const status = appt?.status || "agendado";

  function canTransitionTo(target: string): boolean {
    const transitions: Record<string, string[]> = {
      agendado:             ["confirmado", "avaliacao", "em_atendimento", "cancelado", "faltou"],
      confirmado:           ["em_atendimento", "cancelado", "faltou"],
      avaliacao:            ["aprovado", "cancelado"],
      aprovado:             ["em_atendimento", "cancelado"],
      em_atendimento:       ["concluido", "cancelado"],
    };
    return (transitions[status] || []).includes(target);
  }

  function formatDateTime(iso: string) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  }

  function handleSigned() {
    setSignatureOpen(false);
    onClose();
  }

  function handleConcluirClick() {
    setSignatureOpen(true);
  }

  // Status válidos para o chip selector (não mostra status já concluídos/cancelados)
  const CHIP_APPLICABLE = new Set(["agendado", "confirmado", "avaliacao", "aprovado"]);
  const showChips = appt && CHIP_APPLICABLE.has(status);

  const backdropWebBlur = Platform.OS === "web" ? {
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
  } as any : {};

  return (
    <>
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={[s.backdrop, backdropWebBlur]}>
        <View style={s.sheet}>
          <View style={s.header}>
            <View>
              <Text style={s.title}>Detalhes</Text>
              {status && (
                <Pressable onPress={() => showChips && setShowStatusPicker(p => !p)} style={s.statusPill}>
                  <Text style={s.statusPillText}>{STATUS_LABELS[status] || status}</Text>
                  {showChips && <Text style={{ fontSize: 9, color: "#06B6D4", marginLeft: 4 }}>{showStatusPicker ? "▲" : "▼"}</Text>}
                </Pressable>
              )}
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="x" size={20} color={Colors.ink3} />
            </Pressable>
          </View>

          {/* FIX-21: Seletor de status por chips */}
          {showStatusPicker && showChips && (
            <View style={s.statusPickerWrap}>
              <Text style={s.statusPickerLabel}>Definir status</Text>
              <View style={s.statusChipsRow}>
                {STATUS_CHIPS.map((chip) => {
                  const isActive = status === chip.value;
                  return (
                    <Pressable
                      key={chip.value}
                      onPress={() => !isActive && statusMut.mutate(chip.value)}
                      disabled={statusMut.isPending}
                      style={[
                        s.statusChip,
                        { borderColor: chip.color, backgroundColor: isActive ? chip.color + "22" : "transparent" },
                      ]}
                    >
                      {statusMut.isPending && status !== chip.value ? null : null}
                      <Text style={[s.statusChipText, { color: chip.color }, isActive && { fontWeight: "800" }]}>
                        {isActive ? "● " : ""}{chip.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

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

          {appt && !isLoading && (
            <View style={s.footerWrap}>
              {canTransitionTo("concluido") && (
                <View style={s.concludeNote}>
                  <Icon name="edit" size={12} color={Colors.ink3} />
                  <Text style={s.concludeNoteText}>A assinatura do paciente sera coletada ao concluir</Text>
                </View>
              )}
              {/* Atalho pro prontuario do paciente */}
              {(appt.customer_id || appt.patient_id) && (
                <Pressable
                  onPress={() => {
                    onClose();
                    router.push(`/dental/(clinic)/pacientes?open_patient=${appt.customer_id || appt.patient_id}&tab=prontuario` as any);
                  }}
                  style={[s.btn, { backgroundColor: "rgba(124,58,237,0.12)", borderWidth: 1, borderColor: "rgba(124,58,237,0.30)", flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", marginHorizontal: 16, marginTop: 10, marginBottom: 4 }]}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.violet3 || "#a78bfa" }}>📋 Abrir prontuario</Text>
                </Pressable>
              )}
              <View style={s.footer}>
                {/* FIX-16: botao Confirmar quando agendado */}
                {canTransitionTo("confirmado") && (
                  <Pressable onPress={() => statusMut.mutate("confirmado")} style={[s.btn, s.btnConfirm]} disabled={statusMut.isPending}>
                    {statusMut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>✓ Confirmar</Text>}
                  </Pressable>
                )}
                {canTransitionTo("em_atendimento") && (
                  <Pressable onPress={() => statusMut.mutate("em_atendimento")} style={[s.btn, s.btnPrimary]} disabled={statusMut.isPending}>
                    {statusMut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>Iniciar atendimento</Text>}
                  </Pressable>
                )}
                {canTransitionTo("concluido") && (
                  <Pressable onPress={handleConcluirClick} style={[s.btn, s.btnSuccess]} disabled={statusMut.isPending}>
                    <Icon name="edit" size={14} color="#fff" />
                    <Text style={s.btnPrimaryText}>Concluir + Assinatura</Text>
                  </Pressable>
                )}
                {canTransitionTo("cancelado") && (
                  <Pressable onPress={() => statusMut.mutate("cancelado")} style={[s.btn, s.btnDanger]} disabled={statusMut.isPending}>
                    <Text style={s.btnDangerText}>Cancelar</Text>
                  </Pressable>
                )}
                {!canTransitionTo("confirmado") && !canTransitionTo("em_atendimento") && !canTransitionTo("concluido") && !canTransitionTo("cancelado") && (
                  <Pressable onPress={onClose} style={[s.btn, s.btnGhost]}>
                    <Text style={s.btnGhostText}>Fechar</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>

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
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "center", alignItems: "center", padding: 20 },
  sheet: { backgroundColor: Colors.bg2 || "#0f0f1e", borderRadius: 20, width: "100%", maxWidth: 480, maxHeight: "85%", borderWidth: 1, borderColor: Colors.border },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  title: { fontSize: 18, fontWeight: "700", color: Colors.ink },
  statusPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", backgroundColor: "rgba(6,182,212,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 6 },
  statusPillText: { fontSize: 11, color: "#06B6D4", fontWeight: "600" },
  // FIX-21: Status picker
  statusPickerWrap: { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: "rgba(6,182,212,0.04)" },
  statusPickerLabel: { fontSize: 10, fontWeight: "700", color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  statusChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  statusChipText: { fontSize: 11, fontWeight: "600" },
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
  footerWrap: { borderTopWidth: 1, borderTopColor: Colors.border },
  concludeNote: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  concludeNoteText: { fontSize: 11, color: Colors.ink3 },
  footer: { flexDirection: "row", gap: 8, padding: 16, flexWrap: "wrap" },
  btn: { flex: 1, minWidth: 110, paddingVertical: 12, borderRadius: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  btnConfirm: { backgroundColor: "#F97316" },
  btnPrimary: { backgroundColor: Colors.violet || "#6d28d9" },
  btnPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  btnSuccess: { backgroundColor: "#10B981" },
  btnDanger: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#EF4444" },
  btnDangerText: { color: "#EF4444", fontSize: 13, fontWeight: "600" },
  btnGhost: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  btnGhostText: { color: Colors.ink, fontSize: 13, fontWeight: "600" },
});

export default AppointmentDetailModal;
