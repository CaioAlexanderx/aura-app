// ============================================================
// Eventos — Visão Geral — Aura Karatê (federação) · Shoji
// Fiel ao pane "graduacoes" do standalone v5. Dados reais.
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP } from "@/constants/karateTheme";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import {
  ShojiBackground, PageHead, SectionHead, Card, KpiBand, ShojiBadge, ShojiButton, Mono, Body,
} from "@/components/karate/shoji";
import { CriarExameModal } from "@/components/karate/CriarExameModal";
import { karateApi, BeltExam, CourseEvent } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

const EXAM_STATUS: Record<string, { label: string; badge: "neutral" | "ok" | "warn" | "danger" }> = {
  draft: { label: "Rascunho", badge: "neutral" }, open: { label: "Aberto", badge: "ok" },
  closed: { label: "Encerrado", badge: "warn" }, cancelled: { label: "Cancelado", badge: "danger" },
};
const COURSE_LABEL: Record<string, string> = { seminar: "Seminário", course: "Curso", clinic: "Clínica" };
const fmtDate = (iso?: string | null) => { if (!iso) return "Data a definir"; const d = new Date(iso); return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); };

export default function EventosOverview() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const [exams, setExams] = useState<BeltExam[]>([]);
  const [courses, setCourses] = useState<CourseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCriar, setShowCriar] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const [e, c] = await Promise.all([karateApi.listBeltExams(federationId), karateApi.listCourses(federationId)]);
      setExams(e.data ?? []); setCourses(c.data ?? []);
    } catch { setError(true); }
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
  }, [federationId]);
  useEffect(() => { load(); }, [load]);

  if (error) return <ShojiBackground><KarateErrorState onRetry={() => load()} /></ShojiBackground>;

  return (
    <ShojiBackground>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={P.red} />}>
        <PageHead
          eyebrow="Calendário oficial FPKT"
          title="Eventos"
          sub="Calendário de exames e cursos, e lançamento de resultados."
          actions={<>
            <ShojiButton label="Criar evento" icon="add" variant="sumi" onPress={() => setShowCriar(true)} />
          </>}
        />

        {loading ? <ActivityIndicator style={{ marginTop: 40 }} size="large" color={P.red} /> : <>
          <KpiBand items={[
            { label: "Exames", value: exams.length },
            { label: "Abertos", value: exams.filter((e) => e.status === "open").length },
            { label: "Cursos", value: courses.length },
          ]} />

          <View style={styles.section}>
            <SectionHead title="Próximos exames" />
            {exams.length === 0 ? <Card><KarateEmptyState icon="ribbon-outline" title="Nenhum exame agendado" subtitle="Crie um exame para começar." style={{ paddingVertical: 24 }} /></Card>
              : exams.map((exam) => (
                <TouchableOpacity key={exam.id} onPress={() => router.push(`/karate/eventos/exame/${exam.id}` as any)} activeOpacity={0.85}>
                  <Card style={{ marginBottom: 12 }}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle}>{exam.title}</Text>
                      <ShojiBadge status={EXAM_STATUS[exam.status]?.badge ?? "neutral"} label={EXAM_STATUS[exam.status]?.label ?? exam.status} />
                    </View>
                    <View style={styles.metaRow}>
                      <Meta icon="calendar-outline" text={fmtDate(exam.exam_date)} />
                      {!!exam.location && <Meta icon="location-outline" text={exam.location} />}
                      <Meta icon="people-outline" text={`${exam.candidate_count} candidatos`} />
                    </View>
                  </Card>
                </TouchableOpacity>
              ))}
          </View>

          <View style={styles.section}>
            <SectionHead title="Cursos e seminários" />
            {courses.length === 0 ? <Card><KarateEmptyState icon="school-outline" title="Nenhum curso agendado" style={{ paddingVertical: 24 }} /></Card>
              : courses.map((course) => (
                <Card key={course.id} style={{ marginBottom: 12 }}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle}>{course.title}</Text>
                    <ShojiBadge status="neutral" label={COURSE_LABEL[course.event_type] ?? course.event_type} />
                  </View>
                  <View style={styles.metaRow}>
                    <Meta icon="calendar-outline" text={fmtDate(course.event_date)} />
                    <Meta icon="person-outline" text={course.instructor ?? "Instrutor a definir"} />
                    <Meta icon="people-outline" text={`${course.enrolled_count} inscritos`} />
                  </View>
                </Card>
              ))}
          </View>
        </>}
      </ScrollView>
      <CriarExameModal visible={showCriar} onClose={() => setShowCriar(false)} federationId={federationId} onCreated={() => load(true)} />
    </ShojiBackground>
  );
}

function Meta({ icon, text }: { icon: string; text: string }) {
  return <View style={styles.metaItem}><Ionicons name={icon as any} size={13} color={C.ink3} /><Text style={styles.metaTxt}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  content: { padding: 40, paddingTop: 40, paddingBottom: 72, maxWidth: SP.contentMax, width: "100%", alignSelf: "center" } as ViewStyle,
  section: { marginTop: SP[12] } as ViewStyle,
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 } as ViewStyle,
  cardTitle: { flex: 1, fontFamily: F.heading, fontSize: 18, color: C.ink } as TextStyle,
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 14 } as ViewStyle,
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 } as ViewStyle,
  metaTxt: { fontFamily: F.body, fontSize: 12, color: C.ink3 } as TextStyle,
});
