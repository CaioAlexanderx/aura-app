// ============================================================
// CriarExameModal — Aura Karatê (federação)
//
// Wizard 3 passos:
//   1 — Dados (título, data, local, faixa alvo) → createBeltExam
//   2 — Banca (busca praticantes reais → addExaminer)
//   3 — Candidatos (busca praticantes reais → enrollCandidate;
//       elegibilidade é aviso, nunca bloqueia — Decisão FPKT #1)
// Dados reais; sem mock. Em falha, erro honesto.
// ============================================================
import React, { useState, useCallback } from "react";
import {
  Modal, View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, ViewStyle, TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius, KarateBelts, BeltKey } from "@/constants/karateTheme";
import { Stepper } from "@/components/karate/Stepper";
import { FormField } from "@/components/karate/FormField";
import { KarateButton } from "@/components/karate/KarateButton";
import { EligibilityChecklist } from "@/components/karate/EligibilityChecklist";
import {
  karateApi, BeltExam, Examiner, EligibilityResult, PractitionerListItem,
} from "@/services/karateApi";

const STEPS = ["Dados", "Banca", "Candidatos"];

interface Props {
  visible:      boolean;
  onClose:      () => void;
  federationId: string;
  onCreated?:   () => void;
}

export function CriarExameModal({ visible, onClose, federationId, onCreated }: Props) {
  const [step, setStep] = useState(0);

  // Step 1
  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [location, setLocation] = useState("");
  const [targetBelt, setTargetBelt] = useState<BeltKey | "">("");

  const [createdExam, setCreatedExam] = useState<BeltExam | null>(null);

  // Pool de praticantes (compartilhado por Banca e Candidatos)
  const [pool, setPool] = useState<PractitionerListItem[]>([]);
  const [poolQ, setPoolQ] = useState("");
  const [poolLoading, setPoolLoading] = useState(false);

  // Step 2 — banca
  const [examiners, setExaminers] = useState<Examiner[]>([]);
  // Step 3 — candidatos
  const [selected, setSelected] = useState<string[]>([]);
  const [eligibilityMap, setEligibilityMap] = useState<Record<string, EligibilityResult>>({});

  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetAndClose = () => {
    setStep(0); setTitle(""); setExamDate(""); setLocation(""); setTargetBelt("");
    setCreatedExam(null); setPool([]); setPoolQ(""); setExaminers([]);
    setSelected([]); setEligibilityMap({}); setLoading(false); setBusyId(null); setError(null);
    onClose();
  };

  const searchPool = useCallback(async (q: string) => {
    setPoolLoading(true);
    try {
      const res = await karateApi.listPractitioners(federationId, { q: q || undefined, pageSize: 50 });
      setPool(res.data ?? []);
    } catch {
      setPool([]);
    } finally {
      setPoolLoading(false);
    }
  }, [federationId]);

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
      searchPool("");
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível criar o exame. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const addExaminer = async (p: PractitionerListItem) => {
    if (!createdExam || examiners.some((e) => e.practitioner_id === p.id)) return;
    setBusyId(p.id);
    try {
      const role = examiners.length === 0 ? "chief" : "member";
      const ex = await karateApi.addExaminer(federationId, createdExam.id, { practitioner_id: p.id, role });
      setExaminers((prev) => [...prev, ex]);
    } catch (e: any) {
      Alert.alert("Não foi possível adicionar", e?.message ?? "Tente novamente.");
    } finally {
      setBusyId(null);
    }
  };

  const handleEnroll = async (p: PractitionerListItem) => {
    if (!createdExam || selected.includes(p.id)) return;
    setBusyId(p.id);
    try {
      const candidate = await karateApi.enrollCandidate(federationId, createdExam.id, {
        practitioner_id: p.id,
        target_belt: targetBelt as string,
      });
      setSelected((prev) => [...prev, p.id]);
      if (candidate.eligibility) {
        setEligibilityMap((prev) => ({ ...prev, [p.id]: candidate.eligibility! }));
      }
    } catch (e: any) {
      Alert.alert("Não foi possível inscrever", e?.message ?? "Tente novamente.");
    } finally {
      setBusyId(null);
    }
  };

  const handleFinish = () => {
    onCreated?.();
    Alert.alert("Exame criado!", `"${createdExam?.title}" criado com ${selected.length} candidato(s) e ${examiners.length} examinador(es).`, [
      { text: "OK", onPress: resetAndClose },
    ]);
  };

  const PoolList = ({ mode }: { mode: "examiner" | "candidate" }) => (
    <View style={{ gap: 8 }}>
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={15} color={KarateColors.ink3} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar praticante por nome ou registro…"
          placeholderTextColor={KarateColors.ink4}
          value={poolQ}
          onChangeText={setPoolQ}
          onSubmitEditing={() => searchPool(poolQ)}
          returnKeyType="search"
        />
      </View>
      {poolLoading ? (
        <ActivityIndicator style={{ marginTop: 12 }} color={KarateColors.primary} />
      ) : pool.length === 0 ? (
        <Text style={styles.stepHint}>Nenhum praticante encontrado.</Text>
      ) : (
        pool.map((p) => {
          const added = mode === "examiner" ? examiners.some((e) => e.practitioner_id === p.id) : selected.includes(p.id);
          const elig = mode === "candidate" ? eligibilityMap[p.id] ?? null : null;
          return (
            <View key={p.id} style={styles.candidateCard}>
              <View style={styles.candidateHeader}>
                <View style={styles.candidateInfo}>
                  <Text style={styles.candidateName}>{p.full_name}</Text>
                  <Text style={styles.candidateMeta}>{p.karate_registration_number}{p.belt_name ? ` · ${p.belt_name}` : ""}</Text>
                </View>
                {added ? (
                  <View style={styles.enrolledTag}>
                    <Ionicons name="checkmark-circle" size={14} color={KarateColors.ok} />
                    <Text style={styles.enrolledText}>{mode === "examiner" ? "Na banca" : "Inscrito"}</Text>
                  </View>
                ) : (
                  <KarateButton
                    label={mode === "examiner" ? "Adicionar" : "Inscrever"}
                    variant="secondary"
                    size="sm"
                    loading={busyId === p.id}
                    onPress={() => (mode === "examiner" ? addExaminer(p) : handleEnroll(p))}
                  />
                )}
              </View>
              {elig && <EligibilityChecklist eligibility={elig} style={styles.checklist} />}
            </View>
          );
        })
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetAndClose}>
      <View style={styles.container}>
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

          {step === 0 && (
            <View style={styles.stepContent}>
              <FormField label="Título do exame *" value={title} onChangeText={setTitle} placeholder="Ex: Exame de Faixa Jun/2026" />
              <FormField label="Data (AAAA-MM-DD) *" value={examDate} onChangeText={setExamDate} placeholder="2026-06-28" keyboardType="numeric" />
              <FormField label="Local *" value={location} onChangeText={setLocation} placeholder="Nome do dojô / ginásio" />
              <Text style={styles.fieldLabel}>Faixa alvo *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.beltPicker}>
                {(Object.entries(KarateBelts) as [BeltKey, typeof KarateBelts[BeltKey]][]).map(([key, belt]) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setTargetBelt(key)}
                    style={[styles.beltChip, { backgroundColor: belt.color }, targetBelt === key && styles.beltChipSelected]}
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

          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepHint}>Adicione os examinadores da banca ({examiners.length} na banca). O primeiro vira presidente.</Text>
              <PoolList mode="examiner" />
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepHint}>Inscreva os candidatos. A elegibilidade é só um aviso — não impede a inscrição (Decisão FPKT #1).</Text>
              <PoolList mode="candidate" />
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 && (
            <KarateButton label="Voltar" variant="ghost" size="md" onPress={() => setStep((s) => s - 1)} style={{ flex: 1 }} />
          )}
          {step === 0 && (
            <KarateButton label={loading ? "Criando..." : "Próximo"} variant="primary" size="md" loading={loading} onPress={handleStep1Next} style={{ flex: 1 }} />
          )}
          {step === 1 && (
            <KarateButton label="Próximo" variant="primary" size="md" onPress={() => setStep(2)} style={{ flex: 1 }} />
          )}
          {step === 2 && (
            <KarateButton label="Concluir" variant="primary" size="md" onPress={handleFinish} style={{ flex: 1 }} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  headerTitle: { fontSize: 17, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  stepper: { margin: 16 } as ViewStyle,
  body: { flex: 1 } as ViewStyle,
  bodyContent: { padding: 16, paddingBottom: 32, gap: 12 } as ViewStyle,
  stepContent: { gap: 12 } as ViewStyle,
  stepHint: { fontSize: 12, color: KarateColors.ink3, marginBottom: 4 } as TextStyle,
  fieldLabel: { fontSize: 13, fontWeight: "700", color: KarateColors.ink2, marginBottom: 4 } as TextStyle,
  beltPicker: { marginBottom: 4 } as ViewStyle,
  beltChip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, marginRight: 8, borderWidth: 2, borderColor: "transparent" } as ViewStyle,
  beltChipSelected: { borderColor: KarateColors.primary } as ViewStyle,
  beltChipText: { fontSize: 12, fontWeight: "700" } as TextStyle,
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, paddingHorizontal: 12, paddingVertical: 9 } as ViewStyle,
  searchInput: { flex: 1, fontSize: 14, color: KarateColors.ink, outlineStyle: "none" as any } as ViewStyle,
  candidateCard: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 12, gap: 8 } as ViewStyle,
  candidateHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 } as ViewStyle,
  candidateInfo: { flex: 1, gap: 2 } as ViewStyle,
  candidateName: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  candidateMeta: { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  enrolledTag: { flexDirection: "row", alignItems: "center", gap: 4 } as ViewStyle,
  enrolledText: { fontSize: 12, fontWeight: "700", color: KarateColors.ok } as TextStyle,
  checklist: { marginTop: 4 } as ViewStyle,
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: KarateColors.dangerSoft, padding: 10, borderRadius: KarateRadius.sm } as ViewStyle,
  errorText: { fontSize: 12, color: KarateColors.danger, flex: 1 } as TextStyle,
  footer: { flexDirection: "row", gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
});
