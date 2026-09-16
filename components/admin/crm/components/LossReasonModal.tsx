// ─── LossReasonModal ─────────────────────────────────────────────────────────
// Fase 0 — C0.1 (16/09/2026): motivo de perda obrigatorio.
//
// Contexto: 15/09/2026 perdemos o primeiro trial pra um concorrente porque o
// lojista nao achou uma funcao que ja existia no app. Sem medir POR QUE cada
// lead e perdido, a gente nao sabe se isso se repete. Daqui pra frente, mover
// um lead pra "Perdido" (kanban, fila/modo de trabalho, InteractionModal ou
// batch) exige escolher um motivo de uma lista fechada.
//
// Passo unico (nao e wizard — regra do TrocaModal e pra multi-passo, aqui e
// so um select + 2 campos condicionais), mas segue o mesmo "DNA" de modal do
// repo: overlay + box + fieldLabel + chips + Cancelar/Confirmar com o botao
// de confirmar desabilitado ate o formulario ficar valido.
// ============================================================================

import { useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, Modal, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { crmStyles as cs } from "../shared/styles";
import { LOST_REASONS } from "../shared/constants";
import { canConfirmLossReason, buildLostReasonNote } from "../shared/helpers";
import type { LostReasonKey } from "../shared/constants";

export type LossReasonResult = {
  reason: LostReasonKey;
  competitor?: string;
  detail?: string;
  note: string;
};

type Props = {
  visible: boolean;
  // Um dos dois: nome do lead unico, ou contagem (uso em batch).
  leadName?: string;
  count?: number;
  onCancel: () => void;
  onConfirm: (result: LossReasonResult) => void;
  isPending?: boolean;
};

export function LossReasonModal({ visible, leadName, count, onCancel, onConfirm, isPending }: Props) {
  const [reason, setReason]       = useState<LostReasonKey | "">("");
  const [competitor, setCompetitor] = useState("");
  const [detail, setDetail]         = useState("");

  // Reset a cada abertura — motivo nao deve "vazar" entre leads diferentes.
  useEffect(() => {
    if (visible) {
      setReason("");
      setCompetitor("");
      setDetail("");
    }
  }, [visible]);

  const canConfirm = canConfirmLossReason(reason, detail);

  function handleConfirm() {
    if (!reason || !canConfirm) return;
    onConfirm({
      reason,
      competitor: reason === "concorrente" ? competitor.trim() || undefined : undefined,
      detail: reason === "outro" ? detail.trim() : undefined,
      note: buildLostReasonNote(reason, { competitor, detail }),
    });
  }

  const title = leadName
    ? `Motivo da perda — ${leadName}`
    : count
    ? `Motivo da perda de ${count} lead(s)`
    : "Motivo da perda";

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <Pressable style={cs.modalOverlay} onPress={onCancel}>
        <Pressable style={cs.modalBox} onPress={(e: any) => e.stopPropagation?.()}>
          <Text style={cs.modalTitle}>{title}</Text>
          <Text style={[cs.hintText, { marginTop: -10 }]}>
            Sem um motivo a gente nao aprende por que perde. Escolha o que mais se aproxima.
          </Text>

          {/* Motivo (lista fechada) */}
          <Text style={cs.fieldLabel}>Motivo *</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {LOST_REASONS.map((r) => (
              <Pressable
                key={r.key}
                onPress={() => setReason(r.key)}
                style={[
                  cs.chip,
                  reason === r.key && { backgroundColor: Colors.red + "22", borderColor: Colors.red },
                ]}
              >
                <Text style={[cs.chipText, reason === r.key && { color: Colors.red, fontWeight: "700" }]}>
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Qual concorrente (opcional) */}
          {reason === "concorrente" && (
            <>
              <Text style={cs.fieldLabel}>Qual concorrente? (opcional)</Text>
              <TextInput
                value={competitor}
                onChangeText={setCompetitor}
                placeholder="Ex: NomeDoConcorrente"
                placeholderTextColor={Colors.ink3}
                style={[cs.noteInput, { minHeight: 40 }]}
              />
            </>
          )}

          {/* Detalhe do "outro" (obrigatorio) */}
          {reason === "outro" && (
            <>
              <Text style={cs.fieldLabel}>Descreva o motivo *</Text>
              <TextInput
                value={detail}
                onChangeText={setDetail}
                placeholder="O que aconteceu?"
                placeholderTextColor={Colors.ink3}
                multiline
                numberOfLines={3}
                style={cs.noteInput}
              />
            </>
          )}

          {/* Acoes */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={onCancel} style={[cs.actionBtn, { flex: 1 }]}>
              <Text style={cs.actionBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={!canConfirm || isPending}
              style={[
                cs.actionBtn,
                { flex: 1, backgroundColor: Colors.red + "18", borderColor: Colors.red + "55" },
                (!canConfirm || isPending) && { opacity: 0.5 },
              ]}
            >
              {isPending
                ? <ActivityIndicator size="small" color={Colors.red} />
                : <Text style={[cs.actionBtnText, { color: Colors.red }]}>Marcar como perdido</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
