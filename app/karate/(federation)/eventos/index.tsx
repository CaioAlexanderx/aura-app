// ============================================================
// Eventos — Visão Geral  (Track C)
//
// KPIs: total de exames, exames abertos, cursos no mês.
// Cards rápidos dos próximos eventos (exames + cursos).
// Botão "Criar Exame" abre o wizard (modal).
// Botão "Critérios" navega para a tela de requisitos.
//
// MOCK: dados com shape do contrato; marcado com // [MOCK].
// ============================================================
import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KPIStrip } from "@/components/karate/KPIStrip";
import { Badge } from "@/components/karate/Badge";
import { KarateButton } from "@/components/karate/KarateButton";
import { EmptyState } from "@/components/karate/EmptyState";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { CriarExameModal } from "@/components/karate/CriarExameModal";
import { BeltExam, CourseEvent } from "@/services/karateApi";

// [MOCK] — substituiír por karateApi.listBeltExams + karateApi.listCourses
const MOCK_EXAMS: BeltExam[] = [
  {
    id: "exam-001",
    federation_id: "fed-001",
    title: "Exame de Faixa — Jun/2026",
    exam_date: "2026-06-28",
    location: "Dojô Central SP",
    target_belt: "verde",
    status: "open",
    candidate_count: 12,
    created_at: "2026-06-01T10:00:00Z",
  },
  {
    id: "exam-002",
    federation_id: "fed-001",
    title: "Exame de Faixa — Jul/2026",
    exam_date: "2026-07-19",
    location: "Dojô Norte SP",
    target_belt: "azul_claro",
    status: "draft",
    candidate_count: 5,
    created_at: "2026-06-02T10:00:00Z",
  },
];

const MOCK_COURSES: CourseEvent[] = [
  {
    id: "course-001",
    federation_id: "fed-001",
    title: "Seminário Técnico — Kata Heian",
    event_type: "seminar",
    event_date: "2026-06-21",
    location: "Ginasio Municipal ABC",
    instructor: "Sensei Tanaka",
    enrolled_count: 34,
    created_at: "2026-05-20T10:00:00Z",
  },
];

const EXAM_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  open:  "Aberto",
  closed: "Encerrado",
  cancelled: "Cancelado",
};
const EXAM_STATUS_BADGE: Record<string, "neutral" | "ok" | "warn" | "alert"> = {
  draft: "neutral",
  open:  "ok",
  closed: "warn",
  cancelled: "alert",
};

export default function EventosOverview() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const [refreshing, setRefreshing] = useState(false);
  const [showCriarExame, setShowCriarExame] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // [MOCK] simulate refresh
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const kpiItems = [
    { label: "Total Exames", value: MOCK_EXAMS.length, icon: "ribbon-outline" as const },
    { label: "Abertos",      value: MOCK_EXAMS.filter(e => e.status === "open").length, icon: "checkmark-circle-outline" as const, statusKey: "ok" as const },
    { label: "Cursos/Mês",  value: MOCK_COURSES.length, icon: "school-outline" as const },
  ];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={KarateColors.primary} />}
    >
      {/* Header actions */}
      <View style={styles.header}>
        <Text style={styles.title}>Eventos</Text>
        <View style={styles.headerActions}>
          <KarateButton
            label="Critérios"
            variant="secondary"
            size="sm"
            onPress={() => router.push("/karate/eventos/criterios" as any)}
          />
          <KarateButton
            label="+ Criar Exame"
            variant="primary"
            size="sm"
            onPress={() => setShowCriarExame(true)}
          />
        </View>
      </View>

      {/* KPI strip */}
      <KPIStrip items={kpiItems} style={styles.kpiStrip} />

      {/* Upcoming exams */}
      <Text style={styles.sectionTitle}>Próximos Exames</Text>
      {MOCK_EXAMS.length === 0 ? (
        <EmptyState
          icon="ribbon-outline"
          title="Nenhum exame agendado"
          subtitle="Crie um exame para começar."
        />
      ) : (
        MOCK_EXAMS.map((exam) => (
          <TouchableOpacity
            key={exam.id}
            style={styles.card}
            onPress={() => router.push(`/karate/eventos/exame/${exam.id}` as any)}
            accessibilityRole="button"
            accessibilityLabel={exam.title}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{exam.title}</Text>
              <Badge
                status={EXAM_STATUS_BADGE[exam.status]}
                label={EXAM_STATUS_LABEL[exam.status]}
              />
            </View>
            <View style={styles.cardMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={13} color={KarateColors.ink3} />
                <Text style={styles.metaText}>{exam.exam_date}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={13} color={KarateColors.ink3} />
                <Text style={styles.metaText}>{exam.location}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="people-outline" size={13} color={KarateColors.ink3} />
                <Text style={styles.metaText}>{exam.candidate_count} candidatos</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}

      {/* Upcoming courses */}
      <Text style={styles.sectionTitle}>Cursos e Seminários</Text>
      {MOCK_COURSES.length === 0 ? (
        <EmptyState icon="school-outline" title="Nenhum curso agendado" />
      ) : (
        MOCK_COURSES.map((course) => (
          <View key={course.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{course.title}</Text>
              <Badge status="neutral" label={course.event_type} />
            </View>
            <View style={styles.cardMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={13} color={KarateColors.ink3} />
                <Text style={styles.metaText}>{course.event_date}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="person-outline" size={13} color={KarateColors.ink3} />
                <Text style={styles.metaText}>{course.instructor ?? "Instrutor a definir"}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="people-outline" size={13} color={KarateColors.ink3} />
                <Text style={styles.metaText}>{course.enrolled_count} inscritos</Text>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>

    /* Criar Exame Wizard Modal */
    , <CriarExameModal
      key="criar-exame-modal"
      visible={showCriarExame}
      onClose={() => setShowCriarExame(false)}
      federationId={federationId}
    />
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  scrollContent: { padding: 16, gap: 12, paddingBottom: 32 } as ViewStyle,
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  } as ViewStyle,
  headerActions: { flexDirection: "row", gap: 8 } as ViewStyle,
  title: { fontSize: 20, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  kpiStrip: { marginBottom: 8 } as ViewStyle,
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: KarateColors.ink2,
    marginTop: 8,
    marginBottom: 4,
  } as TextStyle,
  card: {
    backgroundColor: KarateColors.surface,
    borderRadius: KarateRadius.md,
    borderWidth: 1,
    borderColor: KarateColors.border,
    padding: 14,
    gap: 8,
  } as ViewStyle,
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  } as ViewStyle,
  cardTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 10 } as ViewStyle,
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 } as ViewStyle,
  metaText: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
});
