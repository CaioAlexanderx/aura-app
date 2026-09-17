// ============================================================
// AURA. — Cancelar consulta com motivo (mockup 16/09/2026, aba E)
//
// Só se chega aqui pelo menu ⋯ do detalhe ou escolhendo "Cancelado" no
// selo. O botão vermelho fica desligado até escolher o motivo; "Outro"
// pede texto. "Remarcada" sugere remarcar em vez de cancelar. Avisar no
// WhatsApp mostra a prévia (muda com o motivo) e abre a conversa no
// próprio clique (antes do PATCH, senão o navegador bloqueia o pop-up).
// Nada é apagado: PATCH status=cancelado + cancel_reason.
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { cancellationText, openWhatsApp, type CancelReasonKey } from "@/utils/whatsapp";
import { CANCEL_REASONS, cancelReasonText, isCancelValid, whenLine } from "@/utils/dentalAgenda";
import { notify } from "@/utils/webAlert";
import { useDentalAppointmentMutation } from "@/hooks/useDentalAppointmentMutation";
import {
  AC, AgendaBtn, AgendaModalFrame, AnchoredBox, CheckRow, Chip, FieldLabel, Hint, MessageBubble, useIsSheet,
} from "./agendaModalKit";

export interface CancelTarget {
  id: string;
  patient_name?: string | null;
  patient_phone?: string | null;
  scheduled_at: string;
  duration_min?: number | null;
  chief_complaint?: string | null;
}

interface Props {
  visible: boolean;
  appointment: CancelTarget | null;
  onBack: () => void;
  onCancelled: () => void;
  /** "Remarcar em vez de cancelar" (motivo Remarcada). */
  onReschedule?: () => void;
}

const firstName = (n?: string | null) => (n || "").trim().split(/\s+/)[0] || "o paciente";

export function CancelAppointmentModal({ visible, appointment, onBack, onCancelled, onReschedule }: Props) {
  const company = useAuthStore().company;
  const sheet = useIsSheet();
  const mut = useDentalAppointmentMutation(company?.id);
  const [reason, setReason] = useState<CancelReasonKey | null>(null);
  const [other, setOther] = useState("");
  const [notifyWa, setNotifyWa] = useState(true);

  useEffect(() => {
    if (visible) { setReason(null); setOther(""); setNotifyWa(!!appointment?.patient_phone); }
  }, [visible, appointment?.id, appointment?.patient_phone]);

  if (!appointment) return null;
  const who = firstName(appointment.patient_name);
  const when = new Date(appointment.scheduled_at);
  const valid = isCancelValid(reason, other);
  const hasPhone = !!appointment.patient_phone;
  const message = cancellationText({ patientName: appointment.patient_name || "", clinicName: company?.name, when, reason });

  function confirm() {
    if (!valid || !reason || !appointment) return;
    // Abre o WhatsApp no mesmo tick do clique (regra do pop-up no web).
    const opened = notifyWa && hasPhone ? openWhatsApp(appointment.patient_phone, message) : false;
    mut.mutate(
      { id: appointment.id, patch: { status: "cancelado", cancel_reason: cancelReasonText(reason, other) } },
      {
        onSuccess: () => {
          notify(`Consulta de ${who} cancelada${opened ? " · WhatsApp aberto com o aviso" : ""}`);
          onCancelled();
        },
      },
    );
  }

  const header = (
    <View style={s.head}>
      <View style={s.icon}><Icon name="alert" size={20} color={AC.redInk} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.title}>Cancelar a consulta de {who}?</Text>
        <Text style={s.sub}>
          {whenLine(appointment.scheduled_at, appointment.duration_min || 60)}
          {appointment.chief_complaint ? ` · ${appointment.chief_complaint}` : ""}
        </Text>
      </View>
    </View>
  );

  const cancelBtn = (
    <AgendaBtn
      testID="cancel-confirm"
      variant="danger"
      label="Cancelar consulta"
      large={sheet}
      disabled={!valid}
      loading={mut.isPending}
      onPress={confirm}
    />
  );
  const backBtn = <AgendaBtn testID="cancel-back" variant={sheet ? "ghost" : "outline"} label="Voltar" onPress={onBack} disabled={mut.isPending} />;

  return (
    <AgendaModalFrame
      visible={visible}
      onClose={onBack}
      sheet={sheet}
      testID="cancel-modal"
      header={header}
      footer={sheet ? <>{cancelBtn}{backBtn}</> : <>{backBtn}<View style={{ flex: 1 }} />{cancelBtn}</>}
    >
      <Text style={s.p}>A consulta sai da agenda e fica registrada no histórico de {who}. Nada é apagado.</Text>
      <FieldLabel>Motivo</FieldLabel>
      <View style={s.chips}>
        {CANCEL_REASONS.map((r) => (
          <Chip key={r.key} testID={`cancel-reason-${r.key}`} label={r.label} on={reason === r.key} onPress={() => setReason(r.key)} />
        ))}
      </View>
      {reason === "outro" && (
        <TextInput
          testID="cancel-other"
          value={other}
          onChangeText={setOther}
          placeholder="Conte rapidamente o motivo"
          placeholderTextColor={AC.ink3}
          multiline
          style={s.input}
        />
      )}
      {reason === "remarcada" && onReschedule && (
        <View style={s.info}>
          <Text style={s.infoText}>Já tem a nova data? Remarcar é mais rápido e mantém tudo na mesma consulta.</Text>
          <AgendaBtn testID="cancel-reschedule" small label="Remarcar em vez de cancelar" onPress={onReschedule} />
        </View>
      )}
      {hasPhone ? (
        <>
          <CheckRow testID="cancel-notify" label={`Avisar ${who} no WhatsApp`} value={notifyWa} onChange={setNotifyWa} />
          {notifyWa && (
            <AnchoredBox title="Mensagem que vai abrir no WhatsApp" caretLeft={14}>
              <MessageBubble text={message} />
              <Hint>Ao confirmar, a conversa abre com o texto. Você só aperta enviar.</Hint>
            </AnchoredBox>
          )}
        </>
      ) : (
        <Hint style={{ marginTop: 14 }}>Sem telefone cadastrado: não dá para avisar pelo WhatsApp.</Hint>
      )}
    </AgendaModalFrame>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, alignItems: "flex-start" },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: AC.redBg, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "700", color: AC.ink },
  sub: { fontSize: 12.5, color: AC.ink2, marginTop: 1 },
  p: { fontSize: 13, color: AC.ink2, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  input: { marginTop: 8, minHeight: 56, backgroundColor: AC.bg3, borderWidth: 1, borderColor: AC.border2, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, fontSize: 13.5, color: AC.ink, textAlignVertical: "top" } as any,
  info: { marginTop: 10, borderWidth: 1, borderColor: AC.cyanSoft, backgroundColor: AC.cyanDim, borderRadius: 10, padding: 10, gap: 8 },
  infoText: { fontSize: 13, color: AC.ink },
});

export default CancelAppointmentModal;
