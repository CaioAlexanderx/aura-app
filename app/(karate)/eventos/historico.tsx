// ============================================================
// Eventos — Histórico  (Track C)
//
// Exames encerrados e cursos passados.
// [MOCK] aguarda backend Fase 2.
// ============================================================
import React from "react";
import { View, Text, ScrollView, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { EmptyState } from "@/components/karate/EmptyState";
import { BeltExam } from "@/services/karateApi";

// [MOCK]
const MOCK_HISTORICO: BeltExam[] = [
  { id: "exam-h1", federation_id: "f", title: "Exame Faixa Mar/2026", exam_date: "2026-03-15", location: "Dojô Sul SP", target_belt: "amarela", status: "closed", candidate_count: 8, created_at: "2026-02-01T00:00:00Z" },
  { id: "exam-h2", federation_id: "f", title: "Exame Faixa Dez/2025", exam_date: "2025-12-14", location: "Dojô Central SP", target_belt: "laranja", status: "closed", candidate_count: 10, created_at: "2025-11-01T00:00:00Z" },
];

export default function EventosHistorico() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.pageHint}>Exames e eventos encerrados.</Text>
      {MOCK_HISTORICO.length === 0 ? (
        <EmptyState icon="time-outline" title="Nenhum histórico ainda" />
      ) : (
        MOCK_HISTORICO.map((exam) => (
          <View key={exam.id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.cardTitle}>{exam.title}</Text>
                <Text style={styles.metaText}>{exam.exam_date} · {exam.location}</Text>
                <Text style={styles.metaText}>{exam.candidate_count} candidatos</Text>
              </View>
              <Badge status="warn" label="Encerrado" />
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
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 } as ViewStyle,
  info: { flex: 1, gap: 3 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  metaText: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
});
