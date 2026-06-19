// ============================================================
// Eventos — Próximos — Aura Karatê (federação) · Shoji
// Exames Rascunho/Aberto ordenados por data. Dados reais.
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
import { ShojiBackground, Card, ShojiBadge, Mono, Body } from "@/components/karate/shoji";
import { karateApi, BeltExam } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

const BADGE: Record<string, { label: string; badge: "neutral" | "ok" | "warn" | "danger" }> = {
  draft: { label: "Rascunho", badge: "neutral" }, open: { label: "Aberto", badge: "ok" },
  closed: { label: "Encerrado", badge: "warn" }, cancelled: { label: "Cancelado", badge: "danger" },
};
const dd = (iso?: string | null) => (iso ?? "--").slice(8, 10) || "--";
const mm = (iso?: string | null) => { const s = iso ?? ""; return `${s.slice(5, 7)}/${s.slice(0, 4)}`; };

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
      setExams((res.data ?? []).filter((e) => e.status === "draft" || e.status === "open").sort((a, b) => (a.exam_date ?? "").localeCompare(b.exam_date ?? "")));
    } catch { setError(true); }
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
  }, [federationId]);
  useEffect(() => { load(); }, [load]);

  if (error) return <ShojiBackground><KarateErrorState onRetry={() => load()} /></ShojiBackground>;

  return (
    <ShojiBackground>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={P.red} />}>
        <Body muted style={{ marginBottom: 14 }}>Exames com status Rascunho ou Aberto, ordenados por data.</Body>
        {loading ? <ActivityIndicator style={{ marginTop: 32 }} size="large" color={P.red} />
          : exams.length === 0 ? <KarateEmptyState icon="calendar-outline" title="Nenhum exame próximo" style={{ paddingVertical: 28 }} />
          : exams.map((exam) => (
            <TouchableOpacity key={exam.id} onPress={() => router.push(`/karate/eventos/exame/${exam.id}` as any)} activeOpacity={0.85}>
              <Card style={{ marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View style={styles.dateBox}>
                  <Text style={styles.dd}>{dd(exam.exam_date)}</Text>
                  <Mono style={{ fontSize: 10, color: C.ink3 }}>{mm(exam.exam_date)}</Mono>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{exam.title}</Text>
                  {!!exam.location && <Meta icon="location-outline" text={exam.location} />}
                  <Meta icon="people-outline" text={`${exam.candidate_count} candidatos`} />
                </View>
                <ShojiBadge status={BADGE[exam.status]?.badge ?? "neutral"} label={BADGE[exam.status]?.label ?? exam.status} />
              </Card>
            </TouchableOpacity>
          ))}
      </ScrollView>
    </ShojiBackground>
  );
}

function Meta({ icon, text }: { icon: string; text: string }) {
  return <View style={styles.metaItem}><Ionicons name={icon as any} size={12} color={C.ink3} /><Text style={styles.metaTxt}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  content: { padding: 40, paddingTop: 32, paddingBottom: 72, maxWidth: 980, width: "100%", alignSelf: "center" } as ViewStyle,
  dateBox: { width: 52, alignItems: "center" } as ViewStyle,
  dd: { fontFamily: F.heading, fontSize: 24, color: P.red, lineHeight: 26 } as TextStyle,
  title: { fontFamily: F.body, fontSize: 14, fontWeight: "600", color: C.ink, marginBottom: 3 } as TextStyle,
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 } as ViewStyle,
  metaTxt: { fontFamily: F.body, fontSize: 12, color: C.ink3 } as TextStyle,
});
