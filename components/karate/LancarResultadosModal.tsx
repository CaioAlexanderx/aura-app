// ============================================================
// LancarResultadosModal — Aura Karatê Track C
//
// Modal para lançar resultado por candidato:
//   - Tabela inline: aprovado/reprovado + observações
//   - RBAC: o guard examResults é aplicado no backend
//   - Ao fechar o modal, resultados já estão salvos individualmente
//
// Wired contra karateApi.updateCandidateResult. Em falha, erro honesto.
// ============================================================
import React, { useState } from "react";
import {
  Modal, View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { karateApi, ExamCandidate, CandidateResult } from "@/services/karateApi";

interface Props {
  visible:           boolean;
  candidates:        ExamCandidate[];
  onClose:           () => void;
  onUpdateCandidate: (updated: ExamCandidate) => void;
  federationId:      string;
  examId:            string;
}

type ResultState = Record<string, { result: CandidateResult; notes: string; saving: boolean }>;

export function LancarResultadosModal({
  visible, candidates, onClose, onUpdateCandidate, federationId, examId,
}: Props) {
  const [resultState, setResultState] = useState<ResultState>(() => {
    const init: ResultState = {};
    for (const c of candidates) {
      init[c.id] = { result: c.result, notes: c.notes ?? "", saving: false };
    }
    return init;
  });

  const setField = (candidateId: string, field: "result" | "notes", value: any) => {
    setResultState(prev => ({
      ...prev,
      [candidateId]: { ...prev[candidateId], [field]: value },
    }));
  };

  const handleSave = async (candidate: ExamCandidate) => {
    const state = resultState[candidate.id];
    if (!state || state.result === "pending") return;
    setResultState(prev => ({ ...prev, [candidate.id]: { ...prev[candidate.id], saving: true } }));
    try {
      const updated = await karateApi.updateCandidateResult(federationId, examId, candidate.id, {
        result: state.result as "approved" | "rejected",
        notes: state.notes || null,
      });
      onUpdateCandidate(updated);
    } catch (e: any) {
      Alert.alert("Não foi possível salvar o resultado", e?.message ?? "Tente novamente.");
    } finally {
      setResultState(prev => ({ ...prev, [candidate.id]: { ...prev[candidate.id], saving: false } }));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Lançar Resultados</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Fechar">
            <Icon name="x" size={24} color={KarateColors.ink} />
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Lance o resultado de cada candidato individualmente. RBAC examResults aplicado no backend.
        </Text>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {candidates.map((c) => {
            const state = resultState[c.id] ?? { result: c.result, notes: c.notes ?? "", saving: false };
            return (
              <View key={c.id} style={styles.row}>
                {/* Candidato info */}
                <View style={styles.candidateInfo}>
                  <Text style={styles.candidateName}>{c.full_name}</Text>
                  <Text style={styles.candidateMeta}>{c.karate_registration_number}</Text>
                </View>

                {/* Resultado toggle */}
                <View style={styles.resultToggle}>
                  <TouchableOpacity
                    onPress={() => setField(c.id, "result", "approved")}
                    style={[styles.toggleBtn, state.result === "approved" && styles.toggleBtnApproved]}
                    accessibilityRole="radio"
                    accessibilityLabel="Aprovado"
                    accessibilityState={{ checked: state.result === "approved" }}
                  >
                    <Icon name="check" size={14} color={state.result === "approved" ? "#fff" : KarateColors.ok} />
                    <Text style={[styles.toggleText, state.result === "approved" && styles.toggleTextSelected]}>Aprovado</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setField(c.id, "result", "rejected")}
                    style={[styles.toggleBtn, state.result === "rejected" && styles.toggleBtnRejected]}
                    accessibilityRole="radio"
                    accessibilityLabel="Reprovado"
                    accessibilityState={{ checked: state.result === "rejected" }}
                  >
                    <Icon name="x" size={14} color={state.result === "rejected" ? "#fff" : KarateColors.danger} />
                    <Text style={[styles.toggleText, state.result === "rejected" && styles.toggleTextSelected]}>Reprovado</Text>
                  </TouchableOpacity>
                </View>

                {/* Observações */}
                <TextInput
                  style={styles.notesInput}
                  value={state.notes}
                  onChangeText={(v) => setField(c.id, "notes", v)}
                  placeholder="Observações (opcional)"
                  placeholderTextColor={KarateColors.ink4}
                  multiline
                  numberOfLines={2}
                  accessibilityLabel={`Observações para ${c.full_name}`}
                />

                {/* Salvar */}
                <View style={styles.saveRow}>
                  {state.saving ? (
                    <ActivityIndicator size="small" color={KarateColors.primary} />
                  ) : (
                    <KarateButton
                      label="Salvar"
                      variant={state.result === "pending" ? "ghost" : "primary"}
                      size="sm"
                      disabled={state.result === "pending"}
                      onPress={() => handleSave(c)}
                    />
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <KarateButton label="Fechar" variant="secondary" size="md" onPress={onClose} style={{ flex: 1 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, borderBottomWidth: 1, borderBottomColor: KarateColors.border,
  } as ViewStyle,
  headerTitle: { fontSize: 17, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  hint: { fontSize: 12, color: KarateColors.ink3, paddingHorizontal: 16, paddingTop: 8 } as TextStyle,
  body: { flex: 1 } as ViewStyle,
  bodyContent: { padding: 16, gap: 12, paddingBottom: 32 } as ViewStyle,
  row: {
    backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md,
    borderWidth: 1, borderColor: KarateColors.border, padding: 12, gap: 8,
  } as ViewStyle,
  candidateInfo: { gap: 2 } as ViewStyle,
  candidateName: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  candidateMeta: { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  resultToggle: { flexDirection: "row", gap: 8 } as ViewStyle,
  toggleBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: KarateRadius.sm,
    borderWidth: 1.5, borderColor: KarateColors.border,
  } as ViewStyle,
  toggleBtnApproved: { backgroundColor: KarateColors.ok, borderColor: KarateColors.ok } as ViewStyle,
  toggleBtnRejected: { backgroundColor: KarateColors.danger, borderColor: KarateColors.danger } as ViewStyle,
  toggleText: { fontSize: 12, fontWeight: "700", color: KarateColors.ink3 } as TextStyle,
  toggleTextSelected: { color: "#fff" } as TextStyle,
  notesInput: {
    borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm,
    padding: 8, fontSize: 12, color: KarateColors.ink, backgroundColor: KarateColors.bg,
    textAlignVertical: "top",
  } as TextStyle,
  saveRow: { flexDirection: "row", justifyContent: "flex-end" } as ViewStyle,
  footer: {
    flexDirection: "row", padding: 16,
    borderTopWidth: 1, borderTopColor: KarateColors.border,
  } as ViewStyle,
});
