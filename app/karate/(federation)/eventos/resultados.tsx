// ============================================================
// Eventos — Resultados — Aura Karatê (federação)
//
// Não há endpoint de resultados em massa: os resultados são lançados
// e consultados por exame. Esta tela lista os exames encerrados —
// toque para ver/lançar resultados por candidato no detalhe.
// Dados reais via karateApi.listBeltExams. Sem mock.
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, RefreshControl, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
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

export default function EventosResultados() {
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
      const done = (res.data ?? [])
        .filter((e) => e.status === "closed" || e.status === "open")
        .sort((a, b) => (b.exam_date ?? "").localeCompare(a.exam_date ?? ""));
      setExams(done);
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
      <Text style={styles.pageHint}>Selecione um exame para ver ou lançar os resultados por candidato.</Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} size="large" color={KarateColors.primary} />
      ) : exams.length === 0 ? (
        <KarateEmptyState icon="trophy-outline" title="Nenhum exame para resultados" subtitle="Exames abertos ou encerrados aparecem aqui." style={{ paddingVertical: 28 }} />
      ) : (
        exams.map((exam) => (
          <TouchableOpacity key={exam.id} style={styles.card}
            onPress={() => router.push(`/karate/eventos/exame/${exam.id}` as any)}
            accessibilityRole="button" accessibilityLabel={`Resultados de ${exam.title}`}>
            <View style={styles.info}>
              <Text style={styles.name}>{exam.title}</Text>
              <Text style={styles.meta}>{fmtDate(exam.exam_date)}{exam.location ? ` · ${exam.location}` : ""}</Text>
              <Text style={styles.meta}>{exam.candidate_count} candidatos</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={KarateColors.ink4} />
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
  card: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  info: { flex: 1, gap: 3 } as ViewStyle,
  name: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  meta: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
});
