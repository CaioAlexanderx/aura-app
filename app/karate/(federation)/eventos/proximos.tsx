// ============================================================
// Eventos — Próximos — Aura Karatê (federação)
//
// Exames com status Rascunho/Aberto, ordenados por data.
// Dados reais via karateApi.listBeltExams. Sem mock: loading →
// spinner, falha → ErrorState, vazio → honesto.
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, RefreshControl, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateApi, BeltExam } from "@/services/karateApi";

const EXAM_STATUS_BADGE: Record<string, "neutral" | "ok" | "warn" | "alert"> = {
  draft: "neutral", open: "ok", closed: "warn", cancelled: "alert",
};
const EXAM_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", open: "Aberto", closed: "Encerrado", cancelled: "Cancelado",
};

export default function EventosProximos() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const [exams, setExams] = useState<BeltExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const res = await karateApi.listBeltExams(federationId);
      const upcoming = (res.data ?? [])
        .filter((e) => e.status === "draft" || e.status === "open")
        .sort((a, b) => (a.exam_date ?? "").localeCompare(b.exam_date ?? ""));
      setExams(upcoming);
    } catch {
      setError(true);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  if (error) return <KarateErrorState onRetry={() => load()} />;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={KarateColors.primary} />}
    >
      <Text style={styles.pageHint}>Exames com status Rascunho ou Aberto, ordenados por data.</Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} size="large" color={KarateColors.primary} />
      ) : exams.length === 0 ? (
        <KarateEmptyState icon="calendar-outline" title="Nenhum exame próximo" style={{ paddingVertical: 28 }} />
      ) : (
        exams.map((exam) => (
          <TouchableOpacity key={exam.id} style={styles.card}
            onPress={() => router.push(`/karate/eventos/exame/${exam.id}` as any)}
            accessibilityRole="button" accessibilityLabel={exam.title}>
            <View style={styles.row}>
              <View style={styles.dateBlock}>
                <Text style={styles.dateDay}>{(exam.exam_date ?? "--").slice(8, 10) || "--"}</Text>
                <Text style={styles.dateMon}>{(exam.exam_date ?? "").slice(5, 7)}/{(exam.exam_date ?? "").slice(0, 4)}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.cardTitle}>{exam.title}</Text>
                {!!exam.location && (
                  <View style={styles.metaRow}><Ionicons name="location-outline" size={12} color={KarateColors.ink3} /><Text style={styles.metaText}>{exam.location}</Text></View>
                )}
                <View style={styles.metaRow}><Ionicons name="people-outline" size={12} color={KarateColors.ink3} /><Text style={styles.metaText}>{exam.candidate_count} candidatos</Text></View>
              </View>
              <Badge status={EXAM_STATUS_BADGE[exam.status]} label={EXAM_STATUS_LABEL[exam.status] ?? exam.status} />
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 24, gap: 10, paddingBottom: 40, maxWidth: 900, width: "100%", alignSelf: "center" } as ViewStyle,
  pageHint: { fontSize: 12, color: KarateColors.ink3, marginBottom: 4 } as TextStyle,
  card: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  row: { flexDirection: "row", alignItems: "center", gap: 12 } as ViewStyle,
  dateBlock: { alignItems: "center", minWidth: 40 } as ViewStyle,
  dateDay: { fontSize: 22, fontWeight: "800", color: KarateColors.primary } as TextStyle,
  dateMon: { fontSize: 10, color: KarateColors.ink3, fontWeight: "600" } as TextStyle,
  info: { flex: 1, gap: 3 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 } as ViewStyle,
  metaText: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
});
