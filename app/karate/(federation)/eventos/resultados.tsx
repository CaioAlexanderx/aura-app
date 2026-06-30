// ============================================================
// Eventos — Resultados — Aura Karatê (federação) · Shoji
// Sem endpoint de resultados em massa: lista exames → abre o detalhe
// para ver/lançar resultados por candidato. Dados reais.
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateFonts as F } from "@/constants/karateTheme";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { ShojiBackground, Card, Body } from "@/components/karate/shoji";
import { karateApi, BeltExam } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

const fmt = (iso?: string | null) => { if (!iso) return "—"; const d = new Date(iso); return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString("pt-BR"); };

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
    try { const res = await karateApi.listBeltExams(federationId); setExams((res.data ?? []).filter((e) => e.status === "closed" || e.status === "open").sort((a, b) => (b.exam_date ?? "").localeCompare(a.exam_date ?? ""))); }
    catch { setError(true); }
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
  }, [federationId]);
  useEffect(() => { load(); }, [load]);

  if (error) return <ShojiBackground><KarateErrorState onRetry={() => load()} /></ShojiBackground>;

  return (
    <ShojiBackground>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={P.red} />}>
        <Body muted style={{ marginBottom: 14 }}>Selecione um exame para ver ou lançar os resultados por candidato.</Body>
        {loading ? <ActivityIndicator style={{ marginTop: 32 }} size="large" color={P.red} />
          : exams.length === 0 ? <KarateEmptyState icon="trophy-outline" title="Nenhum exame para resultados" subtitle="Exames abertos ou encerrados aparecem aqui." style={{ paddingVertical: 28 }} />
          : exams.map((exam) => (
            <TouchableOpacity key={exam.id} onPress={() => router.push(`/karate/eventos/exame/${exam.id}` as any)} activeOpacity={0.85}>
              <Card style={{ marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{exam.title}</Text>
                  <Body muted style={{ fontSize: 12, marginTop: 2 }}>{fmt(exam.exam_date)}{exam.location ? ` · ${exam.location}` : ""} · {exam.candidate_count} candidatos</Body>
                </View>
                <Icon name="chevron-forward" size={18} color={C.ink4} />
              </Card>
            </TouchableOpacity>
          ))}
      </ScrollView>
    </ShojiBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: 40, paddingTop: 32, paddingBottom: 72, maxWidth: 980, width: "100%", alignSelf: "center" } as ViewStyle,
  title: { fontFamily: F.body, fontSize: 14, fontWeight: "600", color: C.ink } as TextStyle,
});
