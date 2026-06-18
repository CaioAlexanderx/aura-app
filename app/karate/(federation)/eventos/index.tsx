// ============================================================
// Eventos — Visão Geral — Aura Karatê (federação)
//
// KPIs (exames, abertos, cursos) + próximos exames + cursos.
// Botão "Criar Exame" (wizard) e "Critérios". Dados reais via
// karateApi.listBeltExams + listCourses. Sem mock: loading →
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
import { KPIStrip } from "@/components/karate/KPIStrip";
import { Badge } from "@/components/karate/Badge";
import { KarateButton } from "@/components/karate/KarateButton";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { CriarExameModal } from "@/components/karate/CriarExameModal";
import { karateApi, BeltExam, CourseEvent } from "@/services/karateApi";

const EXAM_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", open: "Aberto", closed: "Encerrado", cancelled: "Cancelado",
};
const EXAM_STATUS_BADGE: Record<string, "neutral" | "ok" | "warn" | "alert"> = {
  draft: "neutral", open: "ok", closed: "warn", cancelled: "alert",
};
const COURSE_TYPE_LABEL: Record<string, string> = {
  seminar: "Seminário", course: "Curso", clinic: "Clínica",
};

function fmtDate(iso?: string | null): string {
  if (!iso) return "Data a definir";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function EventosOverview() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const [exams, setExams] = useState<BeltExam[]>([]);
  const [courses, setCourses] = useState<CourseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCriarExame, setShowCriarExame] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const [examRes, courseRes] = await Promise.all([
        karateApi.listBeltExams(federationId),
        karateApi.listCourses(federationId),
      ]);
      setExams(examRes.data ?? []);
      setCourses(courseRes.data ?? []);
    } catch {
      setError(true);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  if (error) return <KarateErrorState onRetry={() => load()} />;

  const kpis = [
    { label: "Exames", value: exams.length, accent: "primary" as const },
    { label: "Abertos", value: exams.filter((e) => e.status === "open").length, accent: "ok" as const },
    { label: "Cursos", value: courses.length, accent: "primary" as const },
  ];

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={KarateColors.primary} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Eventos</Text>
          <View style={styles.headerActions}>
            <KarateButton label="Critérios" variant="secondary" size="sm" onPress={() => router.push("/karate/eventos/criterios" as any)} />
            <KarateButton label="+ Criar Exame" variant="primary" size="sm" onPress={() => setShowCriarExame(true)} />
          </View>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} size="large" color={KarateColors.primary} />
        ) : (
          <>
            <KPIStrip kpis={kpis} style={styles.kpiStrip} />

            <Text style={styles.sectionTitle}>Próximos Exames</Text>
            {exams.length === 0 ? (
              <KarateEmptyState icon="ribbon-outline" title="Nenhum exame agendado" subtitle="Crie um exame para começar." style={{ paddingVertical: 24 }} />
            ) : (
              exams.map((exam) => (
                <TouchableOpacity key={exam.id} style={styles.card}
                  onPress={() => router.push(`/karate/eventos/exame/${exam.id}` as any)}
                  accessibilityRole="button" accessibilityLabel={exam.title}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle}>{exam.title}</Text>
                    <Badge status={EXAM_STATUS_BADGE[exam.status]} label={EXAM_STATUS_LABEL[exam.status] ?? exam.status} />
                  </View>
                  <View style={styles.cardMeta}>
                    <View style={styles.metaItem}><Ionicons name="calendar-outline" size={13} color={KarateColors.ink3} /><Text style={styles.metaText}>{fmtDate(exam.exam_date)}</Text></View>
                    {!!exam.location && <View style={styles.metaItem}><Ionicons name="location-outline" size={13} color={KarateColors.ink3} /><Text style={styles.metaText}>{exam.location}</Text></View>}
                    <View style={styles.metaItem}><Ionicons name="people-outline" size={13} color={KarateColors.ink3} /><Text style={styles.metaText}>{exam.candidate_count} candidatos</Text></View>
                  </View>
                </TouchableOpacity>
              ))
            )}

            <Text style={styles.sectionTitle}>Cursos e Seminários</Text>
            {courses.length === 0 ? (
              <KarateEmptyState icon="school-outline" title="Nenhum curso agendado" style={{ paddingVertical: 24 }} />
            ) : (
              courses.map((course) => (
                <View key={course.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle}>{course.title}</Text>
                    <Badge status="neutral" label={COURSE_TYPE_LABEL[course.event_type] ?? course.event_type} />
                  </View>
                  <View style={styles.cardMeta}>
                    <View style={styles.metaItem}><Ionicons name="calendar-outline" size={13} color={KarateColors.ink3} /><Text style={styles.metaText}>{fmtDate(course.event_date)}</Text></View>
                    <View style={styles.metaItem}><Ionicons name="person-outline" size={13} color={KarateColors.ink3} /><Text style={styles.metaText}>{course.instructor ?? "Instrutor a definir"}</Text></View>
                    <View style={styles.metaItem}><Ionicons name="people-outline" size={13} color={KarateColors.ink3} /><Text style={styles.metaText}>{course.enrolled_count} inscritos</Text></View>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      <CriarExameModal
        visible={showCriarExame}
        onClose={() => setShowCriarExame(false)}
        federationId={federationId}
        onCreated={() => load(true)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  scrollContent: { padding: 24, gap: 12, paddingBottom: 40, maxWidth: 1000, width: "100%", alignSelf: "center" } as ViewStyle,
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 } as ViewStyle,
  headerActions: { flexDirection: "row", gap: 8 } as ViewStyle,
  title: { fontSize: 24, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  kpiStrip: { marginBottom: 8 } as ViewStyle,
  sectionTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink2, marginTop: 8, marginBottom: 4 } as TextStyle,
  card: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 8 } as ViewStyle,
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 } as ViewStyle,
  cardTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 10 } as ViewStyle,
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 } as ViewStyle,
  metaText: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
});
