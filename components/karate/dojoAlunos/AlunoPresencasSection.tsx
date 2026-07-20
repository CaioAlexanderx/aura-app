// ============================================================
// AlunoPresencasSection — presenças do aluno na ficha (F4)
//
// Seção pequena na ficha do aluno (AlunoFichaModal): GET
// /students/:sid/attendance-summary — total, 30d/90d, por turma,
// recentes (badges compactos). Silencioso em SCHEMA_PENDING/erro (some
// da ficha, mesmo racional do AlunoQrSection).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { karateDojoClassesApi, DojoAttendanceSummary } from "@/services/karateDojoClassesApi";
import { fmtDateBR } from "@/components/karate/dojoMensalidades/helpers";

interface Props {
  federationId: string;
  studentId: string;
}

export function AlunoPresencasSection({ federationId, studentId }: Props) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DojoAttendanceSummary | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await karateDojoClassesApi.getStudentAttendanceSummary(federationId, studentId);
      setSummary(res);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [federationId, studentId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.box}>
        <ActivityIndicator size="small" color={KarateColors.primary} />
      </View>
    );
  }
  if (failed || !summary) return null;

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <Icon name="check_circle" size={14} color={KarateColors.primary} />
        <Text style={styles.title}>Presenças</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{summary.total_present}</Text>
          <Text style={styles.statLbl}>Total</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{summary.present_30d}</Text>
          <Text style={styles.statLbl}>Últimos 30d</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{summary.present_90d}</Text>
          <Text style={styles.statLbl}>Últimos 90d</Text>
        </View>
      </View>

      {summary.by_class.length > 0 && (
        <View style={{ gap: 5, marginTop: 4 }}>
          {summary.by_class.map((c) => (
            <View key={c.class_id} style={styles.classRow}>
              <Text style={styles.className} numberOfLines={1}>{c.class_name}</Text>
              <Text style={styles.classMeta}>
                {c.present_count} presença{c.present_count === 1 ? "" : "s"}
                {c.last_present_date ? ` · última ${fmtDateBR(c.last_present_date)}` : ""}
              </Text>
            </View>
          ))}
        </View>
      )}

      {summary.recent.length > 0 && (
        <View style={styles.recentWrap}>
          {summary.recent.slice(0, 8).map((r, i) => (
            <View key={`${r.date}-${i}`} style={[styles.recentBadge, r.present ? styles.recentOk : styles.recentOff]}>
              <Text style={[styles.recentTxt, { color: r.present ? KarateColors.ok : KarateColors.danger }]}>
                {fmtDateBR(r.date)} · {r.class_name}
              </Text>
            </View>
          ))}
        </View>
      )}

      {summary.total_present === 0 && summary.recent.length === 0 && (
        <Text style={styles.empty}>Nenhuma presença registrada ainda.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, padding: 12, backgroundColor: KarateColors.surface, marginTop: 4 } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  title: { fontSize: 12, fontWeight: "800", color: KarateColors.ink2 } as TextStyle,
  statsRow: { flexDirection: "row", gap: 16 } as ViewStyle,
  stat: { alignItems: "center" } as ViewStyle,
  statNum: { fontSize: 18, fontWeight: "800", color: KarateColors.ink, fontFamily: "monospace" } as TextStyle,
  statLbl: { fontSize: 10.5, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  classRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 } as ViewStyle,
  className: { flex: 1, fontSize: 12, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  classMeta: { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  recentWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 } as ViewStyle,
  recentBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 } as ViewStyle,
  recentOk: { backgroundColor: KarateColors.okSoft } as ViewStyle,
  recentOff: { backgroundColor: KarateColors.dangerSoft } as ViewStyle,
  recentTxt: { fontSize: 10.5, fontWeight: "700" } as TextStyle,
  empty: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
});
