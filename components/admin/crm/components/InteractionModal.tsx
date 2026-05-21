// ─── InteractionModal ────────────────────────────────────────────────────────
// Modal pra registrar interacao em um lead. Suporta canal, body, novo status,
// proximo follow-up e advance_cadence (Fase 1).
// ============================================================================

import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Modal, ActivityIndicator, Switch } from "react-native";
import { Colors } from "@/constants/colors";
import { crmStyles as cs } from "../shared/styles";
import { CHANNELS, STATUSES } from "../shared/constants";
import type { Lead, LeadChannel, LeadStatus } from "@/services/crmApi";

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
  }) => void;
  isPending?: boolean;
};

export function InteractionModal({ visible, lead, onClose, onSubmit, isPending }: Props) {
  const [body, setBody]                         = useState("");
  const [channel, setChannel]                   = useState<LeadChannel>("whatsapp");
  const [status, setStatus]                     = useState<LeadStatus | "">("");
  const [followup, setFollowup]                 = useState("");
  const [advanceCadence, setAdvanceCadence]     = useState(true);

  // Reset ao abrir
  useEffect(() => {
    if (visible && lead) {
      setBody("");
      setChannel("whatsapp");
      setStatus(lead.status);
      setFollowup("");
      setAdvanceCadence(!!lead.cadence_name);
    }
  }, [visible, lead]);

  if (!lead) return null;

  function handleSubmit() {
    if (!body.trim()) return;
    onSubmit({
      body: body.trim(),
      channel,
      new_status: status || undefined,
      next_followup_at: followup || undefined,
      advance_cadence: advanceCadence,
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
          <Text style={cs.fieldLabel}>Observacao *</Text>
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

          {/* Proximo follow-up */}
          <Text style={cs.fieldLabel}>Proximo follow-up (YYYY-MM-DD)</Text>
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
                <Text style={{ fontSize: 13, color: Colors.ink, fontWeight: "600" }}>Avancar cadencia</Text>
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
              disabled={isPending || !body.trim()}
              style={[cs.actionBtn, { flex: 1, backgroundColor: Colors.violetD, borderColor: Colors.border2 }, !body.trim() && { opacity: 0.5 }]}
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
