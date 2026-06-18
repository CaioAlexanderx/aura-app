// ============================================================
// Eventos — Histórico — Aura Karatê (federação)
//
// Exames encerrados. Dados reais via karateApi.listBeltExams.
// Sem mock: loading → spinner, falha → ErrorState, vazio → honesto.
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, RefreshControl, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateApi, BeltExam } from "@/services/karateApi";

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("pt-BR");
}

export default function EventosHistorico() {
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
      const past = (res.data ?? [])
        .filter((e) => e.status === "closed")
        .sort((a, b) => (b.exam_date ?? "").localeCompare(a.exam_date ?? ""));
      setExams(past);
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
      <Text style={styles.pageHint}>Exames encerrados.</Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} size="large" color={KarateColors.primary} />
      ) : exams.length === 0 ? (
        <KarateEmptyState icon="time-outline" title="Nenhum histórico ainda" style={{ paddingVertical: 28 }} />
      ) : (
        exams.map((exam) => (
          <TouchableOpacity key={exam.id} style={styles.card}
            onPress={() => router.push(`/karate/eventos/exame/${exam.id}` as any)}
            accessibilityRole="button" accessibilityLabel={exam.title}>
            <View style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.cardTitle}>{exam.title}</Text>
                <Text style={styles.metaText}>{fmtDate(exam.exam_date)}{exam.location ? ` · ${exam.location}` : ""}</Text>
                <Text style={styles.metaText}>{exam.candidate_count} candidatos</Text>
              </View>
              <Badge status="warn" label="Encerrado" />
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
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 } as ViewStyle,
  info: { flex: 1, gap: 3 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  metaText: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
});
