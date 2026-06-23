// ============================================================
// Detalhe do Exame — Aura Karatê (federação)
//
// Dados do exame, banca e candidatos com resultado. Lançar
// resultados (modal por candidato), fechar exame (confirmação),
// e solicitar certificado (sob demanda — Decisão FPKT #3).
// Dados reais via karateApi.getBeltExam. Sem mock: loading →
// spinner, falha → ErrorState; close/cert não fingem sucesso.
//
// Nav P2: sem candidatos inscritos, a tela usa o KarateEmptyState padrão
//   do kit (mesmo componente das outras telas karatê) com a ação
//   "Compartilhar link de inscrição" — copia o link público da federação
//   (microsite). A ação só aparece se o slug público resolver; caso
//   contrário o empty state fica só com a mensagem (sem link fantasma).
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
  StyleSheet, RefreshControl, ViewStyle, TextStyle, Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { KarateButton } from "@/components/karate/KarateButton";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { LancarResultadosModal } from "@/components/karate/LancarResultadosModal";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateApi, ExamCandidate, BeltExam } from "@/services/karateApi";
import { buildMicrositeUrl, getMicrositeSlug } from "@/utils/microsite";
import { copyToClipboard } from "@/utils/clipboard";

const RESULT_BADGE: Record<string, "ok" | "alert" | "neutral"> = {
  approved: "ok", rejected: "alert", pending: "neutral",
};
const RESULT_LABEL: Record<string, string> = {
  approved: "Aprovado", rejected: "Reprovado", pending: "Pendente",
};
const certStatusLabel: Record<string, string> = {
  pending: "Pendente", generated: "Gerado", sent: "Enviado", error: "Erro",
};
const certStatusBadge: Record<string, "neutral" | "ok" | "warn" | "alert"> = {
  pending: "neutral", generated: "ok", sent: "ok", error: "alert",
};

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("pt-BR");
}

export default function ExameDetalhe() {
  const { examId } = useLocalSearchParams<{ examId: string }>();
  const router = useRouter();
  const { federationId } = useKarateFederation();

  const [exam, setExam] = useState<BeltExam | null>(null);
  const [candidates, setCandidates] = useState<ExamCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showResultados, setShowResultados] = useState(false);
  const [closingExam, setClosingExam] = useState(false);
  const [issuingCert, setIssuingCert] = useState<string | null>(null);
  // Nav P2: slug público da federação para o link de inscrição (empty state).
  const [pubSlug, setPubSlug] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!examId) return;
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const res = await karateApi.getBeltExam(federationId, examId);
      setExam(res);
      setCandidates(res.candidates ?? []);
    } catch {
      setError(true);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId, examId]);

  useEffect(() => { load(); }, [load]);

  // Resolve o slug público da federação (best-effort, sem bloquear a tela).
  useEffect(() => {
    let alive = true;
    const fromHost = getMicrositeSlug();
    if (fromHost) { setPubSlug(fromHost); return; }
    if (!federationId) return;
    karateApi.getFederationIdentity(federationId)
      .then((id) => { if (alive && id?.slug) setPubSlug(id.slug); })
      .catch(() => { /* sem slug → empty state sem ação de link */ });
    return () => { alive = false; };
  }, [federationId]);

  // Link público da federação (microsite) — usado pela ação do empty state.
  const publicUrl = pubSlug ? buildMicrositeUrl(pubSlug, "/") : null;

  const shareInscription = async () => {
    if (!publicUrl) return;
    const ok = await copyToClipboard(publicUrl);
    Alert.alert(
      ok ? "Link copiado" : "Não foi possível copiar",
      ok ? `Compartilhe a página pública da federação:\n${publicUrl}` : "Copie manualmente: " + publicUrl
    );
  };

  const handleCandidateUpdate = (updated: ExamCandidate) => {
    setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleCloseExam = () => {
    if (!exam) return;
    const pendingCount = candidates.filter((c) => c.result === "pending").length;
    Alert.alert(
      "Fechar exame?",
      `Tem certeza que deseja fechar "${exam.title}"?${pendingCount > 0 ? `\n\n${pendingCount} candidato(s) ainda com resultado pendente.` : ""}\n\nAtenção: certificados NÃO são gerados automaticamente. (Decisão FPKT #3)`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Fechar exame", style: "destructive", onPress: confirmCloseExam },
      ],
      { cancelable: true }
    );
  };

  const confirmCloseExam = async () => {
    if (!exam) return;
    setClosingExam(true);
    try {
      await karateApi.closeBeltExam(federationId, exam.id);
      setExam((prev) => (prev ? { ...prev, status: "closed" } : prev));
    } catch (e: any) {
      Alert.alert("Não foi possível fechar o exame", e?.message ?? "Tente novamente.");
    } finally {
      setClosingExam(false);
    }
  };

  const handleIssueCertificate = async (candidateId: string) => {
    setIssuingCert(candidateId);
    try {
      const cert = await karateApi.issueCertificate(federationId, candidateId);
      setCandidates((prev) => prev.map((c) =>
        c.id === candidateId ? { ...c, certificate_status: cert.status, certificate_url: cert.pdf_url } : c
      ));
      Alert.alert("Solicitação enviada", `Emissão do certificado solicitada. Status: ${cert.status}.`);
    } catch (e: any) {
      Alert.alert("Não foi possível solicitar", e?.message ?? "Tente novamente.");
    } finally {
      setIssuingCert(null);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: KarateColors.bg }}>
        <ActivityIndicator size="large" color={KarateColors.primary} style={{ marginTop: 48 }} />
      </View>
    );
  }
  if (error || !exam) return <KarateErrorState onRetry={() => load()} />;

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={KarateColors.primary} />}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Voltar">
          <Ionicons name="arrow-back" size={20} color={KarateColors.primary} />
          <Text style={styles.backText}>Eventos</Text>
        </TouchableOpacity>

        <View style={styles.examHeader}>
          <View style={styles.examTitleRow}>
            <Text style={styles.examTitle}>{exam.title}</Text>
            <Badge
              status={exam.status === "open" ? "ok" : exam.status === "closed" ? "warn" : "neutral"}
              label={exam.status === "open" ? "Aberto" : exam.status === "closed" ? "Encerrado" : "Rascunho"}
            />
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={KarateColors.ink3} />
            <Text style={styles.metaText}>{fmtDate(exam.exam_date)}</Text>
            {!!exam.location && (
              <>
                <Ionicons name="location-outline" size={13} color={KarateColors.ink3} />
                <Text style={styles.metaText}>{exam.location}</Text>
              </>
            )}
          </View>
          <Text style={styles.metaText}>Faixa alvo: {exam.target_belt}</Text>
        </View>

        {exam.status === "open" && (
          <View style={styles.actions}>
            <KarateButton label="Lançar Resultados" variant="primary" size="sm" onPress={() => setShowResultados(true)} style={{ flex: 1 }} />
            <KarateButton label={closingExam ? "Fechando..." : "Fechar Exame"} variant="secondary" size="sm" loading={closingExam} onPress={handleCloseExam} style={{ flex: 1 }} />
          </View>
        )}

        <Text style={styles.sectionTitle}>Candidatos ({candidates.length})</Text>
        {candidates.length === 0 ? (
          <KarateEmptyState
            icon="people-outline"
            title="Nenhum candidato inscrito"
            subtitle="Assim que houver inscrições neste exame, os candidatos aparecem aqui para lançar resultados."
            style={{ paddingVertical: 40 }}
            action={
              publicUrl ? (
                <KarateButton
                  label="Compartilhar link de inscrição"
                  variant="secondary"
                  size="sm"
                  onPress={shareInscription}
                />
              ) : undefined
            }
          />
        ) : (
          candidates.map((c) => (
            <View key={c.id} style={styles.candidateCard}>
              <View style={styles.candidateRow}>
                <View style={styles.candidateInfo}>
                  <Text style={styles.candidateName}>{c.full_name}</Text>
                  <Text style={styles.candidateMeta}>{c.karate_registration_number ?? "—"} · Faixa atual: {c.current_belt ?? "—"}</Text>
                </View>
                <Badge status={RESULT_BADGE[c.result]} label={RESULT_LABEL[c.result]} />
              </View>
              {c.notes && <Text style={styles.notes}>Obs: {c.notes}</Text>}

              {c.result === "approved" && (
                <View style={styles.certSection}>
                  <Text style={styles.certLabel}>Certificado:</Text>
                  {c.certificate_status ? (
                    <>
                      <Badge status={certStatusBadge[c.certificate_status]} label={certStatusLabel[c.certificate_status]} />
                      {c.certificate_url && <Text style={styles.certUrl} numberOfLines={1}>{c.certificate_url}</Text>}
                    </>
                  ) : (
                    <KarateButton
                      label={issuingCert === c.id ? "Solicitando..." : "Solicitar emissão do certificado"}
                      variant="secondary"
                      size="sm"
                      loading={issuingCert === c.id}
                      onPress={() => handleIssueCertificate(c.id)}
                    />
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <LancarResultadosModal
        visible={showResultados}
        candidates={candidates}
        onClose={() => setShowResultados(false)}
        onUpdateCandidate={handleCandidateUpdate}
        federationId={federationId}
        examId={exam.id}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 24, gap: 12, paddingBottom: 40, maxWidth: 860, width: "100%", alignSelf: "center" } as ViewStyle,
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 } as ViewStyle,
  backText: { fontSize: 13, color: KarateColors.primary, fontWeight: "600" } as TextStyle,
  examHeader: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 6 } as ViewStyle,
  examTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 } as ViewStyle,
  examTitle: { flex: 1, fontFamily: KarateFonts.heading, fontSize: 19, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" } as ViewStyle,
  metaText: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  actions: { flexDirection: "row", gap: 8 } as ViewStyle,
  sectionTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink2, marginTop: 4 } as TextStyle,
  emptyTxt: { fontSize: 13, color: KarateColors.ink3, paddingVertical: 8 } as TextStyle,
  candidateCard: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 6 } as ViewStyle,
  candidateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 } as ViewStyle,
  candidateInfo: { flex: 1, gap: 2 } as ViewStyle,
  candidateName: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  candidateMeta: { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  notes: { fontSize: 12, color: KarateColors.warn, fontStyle: "italic" } as TextStyle,
  certSection: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 6, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  certLabel: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
  certUrl: { fontSize: 11, color: KarateColors.primary, flex: 1 } as TextStyle,
});
