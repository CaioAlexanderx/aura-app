// ─── InteractionModal ────────────────────────────────────────────────────────
// Modal pra registrar interacao em um lead. Suporta canal, body, novo status,
// proximo follow-up e advance_cadence (Fase 1).
// ============================================================================

import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Modal, ActivityIndicator, Switch } from "react-native";
import { Colors } from "@/constants/colors";
import { crmStyles as cs } from "../shared/styles";
import { CHANNELS, STATUSES, LOST_REASONS } from "../shared/constants";
import { canConfirmLossReason, buildLostReasonNote } from "../shared/helpers";
import type { Lead, LeadChannel, LeadStatus } from "@/services/crmApi";
import type { LostReasonKey } from "../shared/constants";

type Props = {
  visible: boolean;
  lead: Lead | null;
  onClose: () => void;
  onSubmit: (p: {
    body: string;
    channel: LeadChannel;
    new_status?: LeadStatus;
    next_followup_at?: string;
    advance_cadence?: boolean;
    // Fase 0 (C0.1): so vem preenchido quando new_status === "lost".
    lost_reason?: LostReasonKey;
  }) => void;
  isPending?: boolean;
};

export function InteractionModal({ visible, lead, onClose, onSubmit, isPending }: Props) {
  const [body, setBody]                         = useState("");
  const [channel, setChannel]                   = useState<LeadChannel>("whatsapp");
  const [status, setStatus]                     = useState<LeadStatus | "">("");
  const [followup, setFollowup]                 = useState("");
  const [advanceCadence, setAdvanceCadence]     = useState(true);
  // Fase 0 (C0.1, 16/09/2026): motivo de perda inline quando o novo status
  // escolhido e "Perdido". Nao empilha um segundo modal — e so um bloco a
  // mais dentro deste (aqui e passo unico, nao wizard).
  const [lostReason, setLostReason]             = useState<LostReasonKey | "">("");
  const [competitor, setCompetitor]             = useState("");
  const [lostDetail, setLostDetail]             = useState("");

  // Reset ao abrir
  useEffect(() => {
    if (visible && lead) {
      setBody("");
      setChannel("whatsapp");
      setStatus(lead.status);
      setFollowup("");
      setAdvanceCadence(!!lead.cadence_name);
      setLostReason("");
      setCompetitor("");
      setLostDetail("");
    }
  }, [visible, lead]);

  if (!lead) return null;

  // So exige motivo quando o status esta REALMENTE mudando pra "Perdido"
  // agora — um lead que ja estava perdido pode receber uma nova nota sem
  // reabrir o motivo toda vez.
  const movingToLost = status === "lost" && lead.status !== "lost";
  // Sem motivo (ou "outro" sem texto) o Salvar fica travado.
  const canSubmit = !!body.trim() && (!movingToLost || canConfirmLossReason(lostReason, lostDetail));

  function handleSubmit() {
    if (!canSubmit) return;
    // Quando vai pra "Perdido", prefixamos a observacao com o motivo
    // padronizado — assim a linha do tempo sempre mostra o motivo, mesmo
    // pra quem so olha o corpo da interacao (nao so o campo lost_reason).
    const finalBody = movingToLost && lostReason
      ? `${buildLostReasonNote(lostReason, { competitor, detail: lostDetail })}\n${body.trim()}`
      : body.trim();
    onSubmit({
      body: finalBody,
      channel,
      new_status: status || undefined,
      next_followup_at: followup || undefined,
      advance_cadence: advanceCadence,
      ...(movingToLost && lostReason ? { lost_reason: lostReason } : {}),
    });
  }

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={cs.modalOverlay}>
        <View style={cs.modalBox}>
          <Text style={cs.modalTitle}>Contato — {lead.name}</Text>

          {/* Canal */}
          <Text style={cs.fieldLabel}>Canal</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {CHANNELS.map((ch) => (
                <Pressable
                  key={ch}
                  onPress={() => setChannel(ch)}
                  style={[cs.chip, channel === ch && cs.chipActive]}
                >
                  <Text style={[cs.chipText, channel === ch && cs.chipTextActive]}>{ch}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Observacao */}
          <Text style={cs.fieldLabel}>Observação *</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="O que aconteceu?"
            placeholderTextColor={Colors.ink3}
            multiline
            numberOfLines={3}
            style={cs.noteInput}
          />

          {/* Novo status */}
          <Text style={cs.fieldLabel}>Novo status</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {STATUSES.map((st) => (
                <Pressable
                  key={st.key}
                  onPress={() => setStatus(st.key)}
                  style={[cs.chip, status === st.key && { backgroundColor: st.color + "22", borderColor: st.color }]}
                >
                  <Text style={[cs.chipText, status === st.key && { color: st.color }]}>{st.label}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Motivo de perda (Fase 0 — C0.1): so aparece indo pra "Perdido" */}
          {movingToLost && (
            <View style={{ marginBottom: 12, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.red + "44", backgroundColor: Colors.red + "0a" }}>
              <Text style={[cs.fieldLabel, { color: Colors.red }]}>Motivo da perda *</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: lostReason ? 10 : 0 }}>
                {LOST_REASONS.map((r) => (
                  <Pressable
                    key={r.key}
                    onPress={() => setLostReason(r.key)}
                    style={[cs.chip, lostReason === r.key && { backgroundColor: Colors.red + "22", borderColor: Colors.red }]}
                  >
                    <Text style={[cs.chipText, lostReason === r.key && { color: Colors.red, fontWeight: "700" }]}>
                      {r.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {lostReason === "concorrente" && (
                <TextInput
                  value={competitor}
                  onChangeText={setCompetitor}
                  placeholder="Qual concorrente? (opcional)"
                  placeholderTextColor={Colors.ink3}
                  style={[cs.noteInput, { minHeight: 40, marginBottom: 0 }]}
                />
              )}
              {lostReason === "outro" && (
                <TextInput
                  value={lostDetail}
                  onChangeText={setLostDetail}
                  placeholder="Descreva o motivo (obrigatório)"
                  placeholderTextColor={Colors.ink3}
                  multiline
                  numberOfLines={2}
                  style={[cs.noteInput, { marginBottom: 0 }]}
                />
              )}
            </View>
          )}

          {/* Proximo follow-up */}
          <Text style={cs.fieldLabel}>Próximo follow-up (YYYY-MM-DD)</Text>
          <TextInput
            value={followup}
            onChangeText={setFollowup}
            placeholder="2026-05-27"
            placeholderTextColor={Colors.ink3}
            style={[cs.noteInput, { minHeight: 40 }]}
          />

          {/* Avancar cadencia (se houver) */}
          {lead.cadence_name && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: Colors.ink, fontWeight: "600" }}>Avancar cadência</Text>
                <Text style={{ fontSize: 10, color: Colors.ink3, marginTop: 2 }}>
                  Cadencia atual: {lead.cadence_name} (dia {lead.cadence_day})
                </Text>
              </View>
              <Switch
                value={advanceCadence}
                onValueChange={setAdvanceCadence}
                trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
                thumbColor={advanceCadence ? Colors.violet : Colors.ink3}
              />
            </View>
          )}

          {/* Acoes */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={onClose} style={[cs.actionBtn, { flex: 1 }]}>
              <Text style={cs.actionBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={isPending || !canSubmit}
              style={[cs.actionBtn, { flex: 1, backgroundColor: Colors.violetD, borderColor: Colors.border2 }, !canSubmit && { opacity: 0.5 }]}
            >
              {isPending
                ? <ActivityIndicator size="small" color={Colors.violet3} />
                : <Text style={[cs.actionBtnText, { color: Colors.violet3 }]}>Salvar</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
