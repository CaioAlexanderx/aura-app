// ============================================================
// Eventos — Resultados  (Track C)
//
// Tabela de resultados dos exames encerrados por candidato.
// [MOCK] aguarda backend Fase 2.
// ============================================================
import React from "react";
import { View, Text, ScrollView, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { EmptyState } from "@/components/karate/EmptyState";
import { ExamCandidate } from "@/services/karateApi";

// [MOCK]
const MOCK_RESULTS: Array<ExamCandidate & { exam_title: string; exam_date: string }> = [
  { id: "c1", exam_id: "exam-h1", practitioner_id: "p1", full_name: "Carlos Tanaka", karate_registration_number: "SP-0042", current_belt: "branca", target_belt: "amarela", result: "approved", notes: null, eligibility: null, certificate_status: "pending", certificate_url: null, exam_title: "Exame Faixa Mar/2026", exam_date: "2026-03-15" },
  { id: "c2", exam_id: "exam-h1", practitioner_id: "p2", full_name: "Ana Ferreira", karate_registration_number: "SP-0043", current_belt: "branca", target_belt: "amarela", result: "rejected", notes: "Kata incompleto", eligibility: null, certificate_status: null, certificate_url: null, exam_title: "Exame Faixa Mar/2026", exam_date: "2026-03-15" },
];

const RESULT_BADGE: Record<string, "ok" | "alert" | "neutral"> = {
  approved: "ok", rejected: "alert", pending: "neutral",
};
const RESULT_LABEL: Record<string, string> = {
  approved: "Aprovado", rejected: "Reprovado", pending: "Pendente",
};

export default function EventosResultados() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.pageHint}>Resultados consolidados por candidato e exame.</Text>
      {MOCK_RESULTS.length === 0 ? (
        <EmptyState icon="trophy-outline" title="Nenhum resultado ainda" />
      ) : (
        MOCK_RESULTS.map((c) => (
          <View key={c.id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.name}>{c.full_name}</Text>
                <Text style={styles.meta}>{c.karate_registration_number} · {c.exam_title}</Text>
                <Text style={styles.meta}>{c.exam_date} · Faixa alvo: {c.target_belt}</Text>
                {c.notes ? <Text style={styles.note}>Obs: {c.notes}</Text> : null}
              </View>
              <Badge status={RESULT_BADGE[c.result]} label={RESULT_LABEL[c.result]} />
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 10, paddingBottom: 32 } as ViewStyle,
  pageHint: { fontSize: 12, color: KarateColors.ink3, marginBottom: 4 } as TextStyle,
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 } as ViewStyle,
  info: { flex: 1, gap: 3 } as ViewStyle,
  name: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  meta: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  note: { fontSize: 12, color: KarateColors.warn, fontStyle: "italic" } as TextStyle,
});
