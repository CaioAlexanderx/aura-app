// ============================================================
// Detalhe do Exame — Aura Karatê Track C
//
// Exibe: dados do exame, banca, lista de candidatos com resultado.
// Lançar Resultados: modal inline por candidato (aprovado/reprovado + obs).
// Fechar Exame: confirmação forte antes de chamar /close.
// DECISÃO FPKT #3: nenhum certificado é gerado automaticamente ao fechar.
// Certificado: botão "Solicitar emissão" nos aprovados.
//
// [MOCK] — dados mockados; wired contra contrato Fase 2.
// ============================================================
import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  StyleSheet, RefreshControl, ViewStyle, TextStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { KarateButton } from "@/components/karate/KarateButton";
import { LancarResultadosModal } from "@/components/karate/LancarResultadosModal";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateApi, ExamCandidate, BeltExam } from "@/services/karateApi";

// [MOCK]
const MOCK_EXAM: BeltExam = {
  id: "exam-001",
  federation_id: "f",
  title: "Exame de Faixa — Jun/2026",
  exam_date: "2026-06-28",
  location: "Dojô Central SP",
  target_belt: "verde",
  status: "open",
  candidate_count: 2,
  created_at: "2026-06-01T10:00:00Z",
};

const MOCK_CANDIDATES: ExamCandidate[] = [
  { id: "c1", exam_id: "exam-001", practitioner_id: "p1", full_name: "Carlos Tanaka", karate_registration_number: "SP-0042", current_belt: "branca", target_belt: "verde", result: "pending", notes: null, eligibility: null, certificate_status: null, certificate_url: null },
  { id: "c2", exam_id: "exam-001", practitioner_id: "p2", full_name: "Ana Ferreira", karate_registration_number: "SP-0043", current_belt: "branca", target_belt: "verde", result: "approved", notes: null, eligibility: null, certificate_status: "pending", certificate_url: null },
];

const RESULT_BADGE: Record<string, "ok" | "alert" | "neutral"> = {
  approved: "ok", rejected: "alert", pending: "neutral",
};
const RESULT_LABEL: Record<string, string> = {
  approved: "Aprovado", rejected: "Reprovado", pending: "Pendente",
};

export default function ExameDetalhe() {
  const { examId } = useLocalSearchParams<{ examId: string }>();
  const router = useRouter();
  const { federationId } = useKarateFederation();

  const [exam,          setExam]          = useState<BeltExam>(MOCK_EXAM);
  const [candidates,    setCandidates]    = useState<ExamCandidate[]>(MOCK_CANDIDATES);
  const [refreshing,    setRefreshing]    = useState(false);
  const [showResultos,  setShowResultados] = useState(false);
  const [closingExam,   setClosingExam]   = useState(false);
  const [issuingCert,   setIssuingCert]   = useState<string | null>(null);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // [MOCK] fetch real: karateApi.getBeltExam(federationId, examId)
    setTimeout(() => setRefreshing(false), 800);
  }, [federationId, examId]);

  const handleCandidateUpdate = (updated: ExamCandidate) => {
    setCandidates(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  // Fechar exame — confirmação forte (DECISÃO FPKT #3: não gera certificados)
  const handleCloseExam = () => {
    const pendingCount = candidates.filter(c => c.result === "pending").length;
    Alert.alert(
      "Fechar exame?",
      `Tem certeza que deseja fechar "${exam.title}"?${
        pendingCount > 0 ? `\n\n${pendingCount} candidato(s) ainda com resultado pendente.` : ""
      }\n\nAtenção: certificados NÃO são gerados automaticamente. (Decisão FPKT #3)`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Fechar exame", style: "destructive", onPress: confirmCloseExam },
      ],
      { cancelable: true }
    );
  };

  const confirmCloseExam = async () => {
    setClosingExam(true);
    try {
      await karateApi.closeBeltExam(federationId, exam.id);
      setExam(prev => ({ ...prev, status: "closed" }));
    } catch {
      // [MOCK fallback]
      setExam(prev => ({ ...prev, status: "closed" }));
    } finally {
      setClosingExam(false);
    }
  };

  // Solicitar certifcado — DECISÃO FPKT #3: sob demanda
  const handleIssueCertificate = async (candidateId: string) => {
    setIssuingCert(candidateId);
    try {
      const cert = await karateApi.issueCertificate(federationId, candidateId);
      setCandidates(prev => prev.map(c =>
        c.id === candidateId
          ? { ...c, certificate_status: cert.status, certificate_url: cert.pdf_url }
          : c
      ));
      Alert.alert("Solicitação enviada", `Emissão do certificado solicitada. Status: ${cert.status}.`);
    } catch {
      // [MOCK fallback]
      setCandidates(prev => prev.map(c =>
        c.id === candidateId ? { ...c, certificate_status: "pending" } : c
      ));
      Alert.alert("Solicitação enviada [MOCK]", "Status: pending — o certificado será gerado em breve.");
    } finally {
      setIssuingCert(null);
    }
  };

  const certStatusLabel: Record<string, string> = {
    pending: "Pendente", generated: "Gerado", sent: "Enviado", error: "Erro",
  };
  const certStatusBadge: Record<string, "neutral" | "ok" | "warn" | "alert"> = {
    pending: "neutral", generated: "ok", sent: "ok", error: "alert",
  };

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={KarateColors.primary} />}
      >
        {/* Header */}
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
            <Text style={styles.metaText}>{exam.exam_date}</Text>
            <Ionicons name="location-outline" size={13} color={KarateColors.ink3} />
            <Text style={styles.metaText}>{exam.location}</Text>
          </View>
          <Text style={styles.metaText}>Faixa alvo: {exam.target_belt}</Text>
        </View>

        {/* Actions */}
        {exam.status === "open" && (
          <View style={styles.actions}>
            <KarateButton
              label="Lançar Resultados"
              variant="primary"
              size="sm"
              onPress={() => setShowResultados(true)}
              style={{ flex: 1 }}
            />
            <KarateButton
              label={closingExam ? "Fechando..." : "Fechar Exame"}
              variant="secondary"
              size="sm"
              loading={closingExam}
              onPress={handleCloseExam}
              style={{ flex: 1 }}
            />
          </View>
        )}

        {/* Candidatos */}
        <Text style={styles.sectionTitle}>Candidatos ({candidates.length})</Text>
        {candidates.map((c) => (
          <View key={c.id} style={styles.candidateCard}>
            <View style={styles.candidateRow}>
              <View style={styles.candidateInfo}>
                <Text style={styles.candidateName}>{c.full_name}</Text>
                <Text style={styles.candidateMeta}>{c.karate_registration_number} · Faixa atual: {c.current_belt ?? "—"}</Text>
              </View>
              <Badge status={RESULT_BADGE[c.result]} label={RESULT_LABEL[c.result]} />
            </View>
            {c.notes && (
              <Text style={styles.notes}>Obs: {c.notes}</Text>
            )}

            {/* Certificado — DECISÃO FPKT #3: sob demanda */}
            {c.result === "approved" && (
              <View style={styles.certSection}>
                <Text style={styles.certLabel}>Certificado:</Text>
                {c.certificate_status ? (
                  <>
                    <Badge
                      status={certStatusBadge[c.certificate_status]}
                      label={certStatusLabel[c.certificate_status]}
                    />
                    {c.certificate_url && (
                      <Text style={styles.certUrl} numberOfLines={1}>{c.certificate_url}</Text>
                    )}
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
        ))}
      </ScrollView>

      {/* Modal Lançar Resultados */}
      <LancarResultadosModal
        visible={showResultos}
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
  content: { padding: 16, gap: 12, paddingBottom: 32 } as ViewStyle,
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 } as ViewStyle,
  backText: { fontSize: 13, color: KarateColors.primary, fontWeight: "600" } as TextStyle,
  examHeader: {
    backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md,
    borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 6,
  } as ViewStyle,
  examTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 } as ViewStyle,
  examTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" } as ViewStyle,
  metaText: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  actions: { flexDirection: "row", gap: 8 } as ViewStyle,
  sectionTitle: { fontSize: 14, fontWeight: "700", color: KarateColors.ink2, marginTop: 4 } as TextStyle,
  candidateCard: {
    backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md,
    borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 6,
  } as ViewStyle,
  candidateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 } as ViewStyle,
  candidateInfo: { flex: 1, gap: 2 } as ViewStyle,
  candidateName: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  candidateMeta: { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  notes: { fontSize: 12, color: KarateColors.warn, fontStyle: "italic" } as TextStyle,
  certSection: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 6, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  certLabel: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
  certUrl: { fontSize: 11, color: KarateColors.primary, flex: 1 } as TextStyle,
});
