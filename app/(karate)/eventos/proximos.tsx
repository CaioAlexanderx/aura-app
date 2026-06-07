// ============================================================
// Eventos — Próximos  (Track C)
//
// Lista de exames com status open/draft ordenados por data.
// [MOCK] aguarda backend Fase 2.
// ============================================================
import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { EmptyState } from "@/components/karate/EmptyState";
import { BeltExam } from "@/services/karateApi";

// [MOCK]
const MOCK_PROXIMOS: BeltExam[] = [
  { id: "exam-001", federation_id: "f", title: "Exame Faixa Jun/2026", exam_date: "2026-06-28", location: "Dojô Central SP", target_belt: "verde", status: "open", candidate_count: 12, created_at: "2026-06-01T00:00:00Z" },
  { id: "exam-002", federation_id: "f", title: "Exame Faixa Jul/2026", exam_date: "2026-07-19", location: "Dojô Norte SP", target_belt: "azul_claro", status: "draft", candidate_count: 5, created_at: "2026-06-02T00:00:00Z" },
  { id: "exam-003", federation_id: "f", title: "Exame Faixa Ago/2026", exam_date: "2026-08-16", location: "Dojô Leste SP", target_belt: "roxo", status: "draft", candidate_count: 3, created_at: "2026-06-03T00:00:00Z" },
];

const EXAM_STATUS_BADGE: Record<string, "neutral" | "ok" | "warn" | "alert"> = {
  draft: "neutral", open: "ok", closed: "warn", cancelled: "alert",
};
const EXAM_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", open: "Aberto", closed: "Encerrado", cancelled: "Cancelado",
};

export default function EventosProximos() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 800); }, []);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={KarateColors.primary} />}
    >
      <Text style={styles.pageHint}>Exames com status Rascunho ou Aberto, ordenados por data.</Text>
      {MOCK_PROXIMOS.length === 0 ? (
        <EmptyState icon="calendar-outline" title="Nenhum exame próximo" />
      ) : (
        MOCK_PROXIMOS.map((exam) => (
          <TouchableOpacity
            key={exam.id}
            style={styles.card}
            onPress={() => router.push(`/(karate)/eventos/exame/${exam.id}` as any)}
            accessibilityRole="button"
            accessibilityLabel={exam.title}
          >
            <View style={styles.row}>
              <View style={styles.dateBlock}>
                <Text style={styles.dateDay}>{exam.exam_date.slice(8, 10)}</Text>
                <Text style={styles.dateMon}>{exam.exam_date.slice(5, 7)}/{exam.exam_date.slice(0, 4)}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.cardTitle}>{exam.title}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={12} color={KarateColors.ink3} />
                  <Text style={styles.metaText}>{exam.location}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="people-outline" size={12} color={KarateColors.ink3} />
                  <Text style={styles.metaText}>{exam.candidate_count} candidatos</Text>
                </View>
              </View>
              <Badge status={EXAM_STATUS_BADGE[exam.status]} label={EXAM_STATUS_LABEL[exam.status]} />
            </View>
          </TouchableOpacity>
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
  row: { flexDirection: "row", alignItems: "center", gap: 12 } as ViewStyle,
  dateBlock: { alignItems: "center", minWidth: 36 } as ViewStyle,
  dateDay: { fontSize: 22, fontWeight: "800", color: KarateColors.primary } as TextStyle,
  dateMon: { fontSize: 10, color: KarateColors.ink3, fontWeight: "600" } as TextStyle,
  info: { flex: 1, gap: 3 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 } as ViewStyle,
  metaText: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
});
