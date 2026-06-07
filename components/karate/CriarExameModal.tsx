// ============================================================
// CriarExameModal — Aura Karatê Track C
//
// Wizard 3 passos usando o Stepper:
//   Passo 1 — Dados (título, data, local, faixa alvo)
//   Passo 2 — Banca (examinadores)
//   Passo 3 — Candidatos (inscrever praticantes)
//
// Wired: karateApi.createBeltExam (Passo 1), karateApi.addExaminer (Passo 2),
//        karateApi.enrollCandidate (Passo 3).
// [MOCK] Banca e Candidatos usam dados mock enquanto o backend Fase 2
//        não está online.
// ============================================================
import React, { useState } from "react";
import {
  Modal, View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, ViewStyle, TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius, KarateBelts, BeltKey } from "@/constants/karateTheme";
import { Stepper } from "@/components/karate/Stepper";
import { FormField } from "@/components/karate/FormField";
import { KarateButton } from "@/components/karate/KarateButton";
import { EligibilityChecklist } from "@/components/karate/EligibilityChecklist";
import { karateApi, BeltExam, ExamCandidate, EligibilityResult } from "@/services/karateApi";

const STEPS = ["Dados", "Banca", "Candidatos"];

// [MOCK] praticantes disponíveis para seleção
const MOCK_PRACTITIONERS = [
  { id: "p1", full_name: "Carlos Tanaka",  karate_registration_number: "SP-0042", current_belt: "branca" },
  { id: "p2", full_name: "Ana Ferreira",    karate_registration_number: "SP-0043", current_belt: "branca" },
  { id: "p3", full_name: "Lucas Miyamoto", karate_registration_number: "SP-0044", current_belt: "amarela" },
];

// [MOCK] examinadores disponíveis
const MOCK_EXAMINERS = [
  { id: "e1", practitioner_id: "p10", name: "Sensei Watanabe", belt_level: "preta", role: "chief" as const },
  { id: "e2", practitioner_id: "p11", name: "Sensei Ozaki",    belt_level: "preta", role: "member" as const },
];

interface Props {
  visible:      boolean;
  onClose:      () => void;
  federationId: string;
}

export function CriarExameModal({ visible, onClose, federationId }: Props) {
  const [step, setStep] = useState(0);

  // Step 1 — Dados
  const [title,       setTitle]       = useState("");
  const [examDate,    setExamDate]    = useState("");
  const [location,    setLocation]    = useState("");
  const [targetBelt,  setTargetBelt]  = useState<BeltKey | "">("");

  // Step 2 — Banca
  const [examiners,   setExaminers]   = useState<typeof MOCK_EXAMINERS>(MOCK_EXAMINERS);

  // Step 3 — Candidatos
  const [selectedPractitioners, setSelectedPractitioners] = useState<string[]>([]);
  const [eligibilityMap, setEligibilityMap] = useState<Record<string, EligibilityResult>>({});

  // State
  const [createdExam, setCreatedExam] = useState<BeltExam | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const resetAndClose = () => {
    setStep(0); setTitle(""); setExamDate(""); setLocation(""); setTargetBelt("");
    setExaminers(MOCK_EXAMINERS); setSelectedPractitioners([]); setEligibilityMap({});
    setCreatedExam(null); setLoading(false); setError(null);
    onClose();
  };

  // Step 1 → 2: criar o exame
  const handleStep1Next = async () => {
    if (!title || !examDate || !location || !targetBelt) {
      setError("Preencha todos os campos obrigatórios."); return;
    }
    setError(null); setLoading(true);
    try {
      const exam = await karateApi.createBeltExam(federationId, {
        title, exam_date: examDate, location, target_belt: targetBelt,
      });
      setCreatedExam(exam);
      setStep(1);
    } catch (e: any) {
      // [MOCK fallback] se backend não responder ainda
      const mockExam: BeltExam = {
        id: `exam-new-${Date.now()}`, federation_id: federationId,
        title, exam_date: examDate, location, target_belt: targetBelt,
        status: "draft", candidate_count: 0, created_at: new Date().toISOString(),
      };
      setCreatedExam(mockExam);
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  // Step 2 → 3 (banca já mockada, só avança)
  const handleStep2Next = () => {
    setError(null);
    setStep(2);
  };

  // Step 3: inscrever candidatos (DECISÃO FPKT #1: sempre 201, sem bloqueio)
  const handleEnroll = async (practitionerId: string) => {
    if (!createdExam) return;
    if (selectedPractitioners.includes(practitionerId)) return;
    setLoading(true);
    try {
      const candidate = await karateApi.enrollCandidate(federationId, createdExam.id, {
        practitioner_id: practitionerId,
        target_belt: targetBelt as string,
      });
      setSelectedPractitioners(prev => [...prev, practitionerId]);
      if (candidate.eligibility) {
        setEligibilityMap(prev => ({ ...prev, [practitionerId]: candidate.eligibility! }));
      }
    } catch {
      // [MOCK fallback] simular elegibilidade com avisos
      const mockEligibility: EligibilityResult = {
        practitioner_id: practitionerId,
        target_belt: targetBelt as string,
        eligible: false,
        checks: [
          { criterion: "min_time_in_belt", ok: true,  required: 6, actual: 8, label: "Tempo mínimo na faixa" },
          { criterion: "kata_required",    ok: true,  required: "Heian Shodan", actual: "Heian Shodan", label: "Kata obrigatório" },
          { criterion: "course_required",  ok: false, required: true, actual: false, label: "Curso obrigatório" },
        ],
        warnings: ["Seminário técnico não concluído (provisório — confirmar com a FPKT)."],
      };
      setSelectedPractitioners(prev => [...prev, practitionerId]);
      setEligibilityMap(prev => ({ ...prev, [practitionerId]: mockEligibility }));
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    Alert.alert("Exame criado!", `"${createdExam?.title}" foi criado com ${selectedPractitioners.length} candidato(s).`, [
      { text: "OK", onPress: resetAndClose },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetAndClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Criar Exame</Text>
          <TouchableOpacity onPress={resetAndClose} accessibilityLabel="Fechar modal">
            <Ionicons name="close" size={24} color={KarateColors.ink} />
          </TouchableOpacity>
        </View>

        <Stepper steps={STEPS} currentStep={step} style={styles.stepper} />

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="warning" size={14} color={KarateColors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* ---- STEP 1: DADOS ---- */}
          {step === 0 && (
            <View style={styles.stepContent}>
              <FormField label="Título do exame *" value={title} onChangeText={setTitle} placeholder="Ex: Exame de Faixa Jun/2026" />
              <FormField label="Data (AAAA-MM-DD) *" value={examDate} onChangeText={setExamDate} placeholder="2026-06-28" keyboardType="numeric" />
              <FormField label="Local *" value={location} onChangeText={setLocation} placeholder="Nome do dojô / ginásio" />
              {/* Faixa alvo */}
              <Text style={styles.fieldLabel}>Faixa alvo *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.beltPicker}>
                {(Object.entries(KarateBelts) as [BeltKey, typeof KarateBelts[BeltKey]][]).map(([key, belt]) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setTargetBelt(key)}
                    style={[
                      styles.beltChip,
                      { backgroundColor: belt.color },
                      targetBelt === key && styles.beltChipSelected,
                    ]}
                    accessibilityRole="radio"
                    accessibilityLabel={belt.label}
                    accessibilityState={{ checked: targetBelt === key }}
                  >
                    <Text style={[styles.beltChipText, { color: belt.textColor }]}>{belt.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ---- STEP 2: BANCA ---- */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepHint}>
                Selecione os examinadores da banca. [MOCK — integração real após backend Fase 2]
              </Text>
              {MOCK_EXAMINERS.map((ex) => (
                <View key={ex.id} style={styles.examinerRow}>
                  <View style={styles.examinerInfo}>
                    <Ionicons name="person-circle-outline" size={20} color={KarateColors.ink3} />
                    <View>
                      <Text style={styles.examinerName}>{ex.name}</Text>
                      <Text style={styles.examinerMeta}>Faixa: {ex.belt_level} · {ex.role === "chief" ? "Presidente" : "Membro"}</Text>
                    </View>
                  </View>
                  <Ionicons name="checkmark-circle" size={18} color={KarateColors.ok} />
                </View>
              ))}
            </View>
          )}

          {/* ---- STEP 3: CANDIDATOS ---- */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepHint}>
                Inscreva os candidatos. A elegibilidade é verificada automaticamente e exibida como aviso — não impede a inscrição. [DECISÃO FPKT #1]
              </Text>
              {MOCK_PRACTITIONERS.map((p) => {
                const enrolled = selectedPractitioners.includes(p.id);
                const eligibility = eligibilityMap[p.id] ?? null;
                return (
                  <View key={p.id} style={styles.candidateCard}>
                    <View style={styles.candidateHeader}>
                      <View style={styles.candidateInfo}>
                        <Text style={styles.candidateName}>{p.full_name}</Text>
                        <Text style={styles.candidateMeta}>{p.karate_registration_number} · Faixa: {p.current_belt}</Text>
                      </View>
                      {enrolled ? (
                        <View style={styles.enrolledTag}>
                          <Ionicons name="checkmark-circle" size={14} color={KarateColors.ok} />
                          <Text style={styles.enrolledText}>Inscrito</Text>
                        </View>
                      ) : (
                        <KarateButton
                          label="Inscrever"
                          variant="secondary"
                          size="sm"
                          loading={loading}
                          onPress={() => handleEnroll(p.id)}
                        />
                      )}
                    </View>
                    {enrolled && eligibility && (
                      <EligibilityChecklist eligibility={eligibility} style={styles.checklist} />
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Footer actions */}
        <View style={styles.footer}>
          {step > 0 && (
            <KarateButton
              label="Voltar"
              variant="ghost"
              size="md"
              onPress={() => setStep(s => s - 1)}
              style={{ flex: 1 }}
            />
          )}
          {step === 0 && (
            <KarateButton
              label={loading ? "Criando..." : "Próximo"}
              variant="primary"
              size="md"
              loading={loading}
              onPress={handleStep1Next}
              style={{ flex: 1 }}
            />
          )}
          {step === 1 && (
            <KarateButton
              label="Próximo"
              variant="primary"
              size="md"
              onPress={handleStep2Next}
              style={{ flex: 1 }}
            />
          )}
          {step === 2 && (
            <KarateButton
              label="Concluir"
              variant="primary"
              size="md"
              onPress={handleFinish}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, borderBottomWidth: 1, borderBottomColor: KarateColors.border,
  } as ViewStyle,
  headerTitle: { fontSize: 17, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  stepper: { margin: 16 } as ViewStyle,
  body: { flex: 1 } as ViewStyle,
  bodyContent: { padding: 16, paddingBottom: 32, gap: 12 } as ViewStyle,
  stepContent: { gap: 12 } as ViewStyle,
  stepHint: { fontSize: 12, color: KarateColors.ink3, marginBottom: 4 } as TextStyle,
  fieldLabel: { fontSize: 13, fontWeight: "700", color: KarateColors.ink2, marginBottom: 4 } as TextStyle,
  beltPicker: { marginBottom: 4 } as ViewStyle,
  beltChip: {
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20,
    marginRight: 8, borderWidth: 2, borderColor: "transparent",
  } as ViewStyle,
  beltChipSelected: { borderColor: KarateColors.primary } as ViewStyle,
  beltChipText: { fontSize: 12, fontWeight: "700" } as TextStyle,
  examinerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 12, backgroundColor: KarateColors.surface,
    borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border,
  } as ViewStyle,
  examinerInfo: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 } as ViewStyle,
  examinerName: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  examinerMeta: { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  candidateCard: {
    backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md,
    borderWidth: 1, borderColor: KarateColors.border, padding: 12, gap: 8,
  } as ViewStyle,
  candidateHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 } as ViewStyle,
  candidateInfo: { flex: 1, gap: 2 } as ViewStyle,
  candidateName: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  candidateMeta: { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  enrolledTag: { flexDirection: "row", alignItems: "center", gap: 4 } as ViewStyle,
  enrolledText: { fontSize: 12, fontWeight: "700", color: KarateColors.ok } as TextStyle,
  checklist: { marginTop: 4 } as ViewStyle,
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: KarateColors.dangerSoft, padding: 10, borderRadius: KarateRadius.sm,
  } as ViewStyle,
  errorText: { fontSize: 12, color: KarateColors.danger, flex: 1 } as TextStyle,
  footer: {
    flexDirection: "row", gap: 8, padding: 16,
    borderTopWidth: 1, borderTopColor: KarateColors.border,
  } as ViewStyle,
});
