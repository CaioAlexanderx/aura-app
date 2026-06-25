// ============================================================
// CriarExameModal — Aura Karatê (federação) · Shoji
//
// Wizard em MODAL CENTRADO (overlay + card), igual às fichas de ouro
// (PraticanteFichaModal / DojoFichaModal).
//
// TIPO DE EVENTO (Decisão Caio 25/06): a federação realiza eventos AMPLOS.
// Dois tipos, sem especificar grau:
//   • Exame  → exam_type: 'exame'  — 3 passos (Dados · Banca · Candidatos)
//   • Curso  → exam_type: 'curso'  — 1 passo (Dados); curso não gradua,
//              logo não tem banca nem candidatos.
//
// O backend passou a aceitar os tipos amplos 'exame' e 'curso' no
// /belt-exams (antes a constraint só aceitava os Dan e o FE mandava um
// valor inválido → 500 ao criar).
//
// Metodologia de forms (decisões Caio):
//   - maskMoney consistente (centavos → reais) · parseBrDate valida calendário.
//   - Dado INVÁLIDO é sinalizado; dado AUSENTE é neutro/opcional.
//   - CTA do rodapé é primário em sumi (escuro), full-width.
//
// O create envia { name, event_date, location, exam_type, fee_amount,
// max_candidates } via request() direto (o tipo de karateApi está
// dessincronizado para este payload amplo).
// ============================================================
import React, { useState, useCallback } from "react";
import {
  Modal, View, Text, ScrollView, TouchableOpacity, TextInput, Pressable,
  StyleSheet, ActivityIndicator, Alert, useWindowDimensions, ViewStyle, TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ShojiPalette as P, KarateColors, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { Stepper } from "@/components/karate/Stepper";
import { KarateButton } from "@/components/karate/KarateButton";
import { EligibilityChecklist } from "@/components/karate/EligibilityChecklist";
import { parseBrDate } from "@/components/inputs/DateInput";
import {
  karateApi, Examiner, EligibilityResult, PractitionerListItem,
} from "@/services/karateApi";
import { request } from "@/services/api";

// Tipo de evento amplo (sem grau). Mapeia 1:1 para exam_type do backend.
type EventKind = "exame" | "curso";

// Passos por tipo: Exame monta banca + candidatos; Curso é só Dados.
const STEPS_EXAME = ["Dados", "Banca", "Candidatos"];
const STEPS_CURSO = ["Dados"];

// Faixa-alvo default da inscrição de candidato no Exame amplo. Não é exposta
// no form (não forçamos grau); serve só para o enroll do candidato, cuja
// elegibilidade é apenas um aviso (Decisão FPKT #1).
const DEFAULT_TARGET_BELT = "preta";

interface Props {
  visible:      boolean;
  onClose:      () => void;
  federationId: string;
  onCreated?:   () => void;
}

// ── máscaras BR ──────────────────────────────────────────────
const onlyD = (v: string) => (v || "").replace(/\D/g, "");

// dd/mm/aaaa parcial enquanto digita (validação real é via parseBrDate)
function maskDate(v: string) {
  const d = onlyD(v).slice(0, 8);
  if (d.length > 4) return d.replace(/(\d{2})(\d{2})(\d+)/, "$1/$2/$3");
  if (d.length > 2) return d.replace(/(\d{2})(\d+)/, "$1/$2");
  return d;
}

// Máscara de dinheiro consistente: trabalha em centavos e exibe R$ X,YY.
function maskMoney(v: string) {
  const cents = onlyD(v).slice(0, 11); // teto generoso
  if (!cents) return "";
  const n = parseInt(cents, 10);
  const reais = Math.floor(n / 100);
  const frac = String(n % 100).padStart(2, "0");
  return `${reais.toLocaleString("pt-BR")},${frac}`;
}
// "1.234,56" (display) → 1234.56 (número em reais) | 0 se vazio
function moneyToNumber(v: string): number {
  const cents = onlyD(v);
  return cents ? parseInt(cents, 10) / 100 : 0;
}

export function CriarExameModal({ visible, onClose, federationId, onCreated }: Props) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(680, width - 24);

  // Tipo de evento (default Exame). Define os passos e o exam_type enviado.
  const [kind, setKind] = useState<EventKind>("exame");
  const STEPS = kind === "exame" ? STEPS_EXAME : STEPS_CURSO;

  const [step, setStep] = useState(0);

  // Step 1
  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [location, setLocation] = useState("");
  const [fee, setFee] = useState("");
  const [maxCandidates, setMaxCandidates] = useState("");

  const [createdExamId, setCreatedExamId] = useState<string | null>(null);

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

  // sinaliza data inválida só quando completa (10 chars) e não parseia
  const dateBad = examDate.length === 10 && parseBrDate(examDate) === null;

  const resetAndClose = () => {
    setKind("exame"); setStep(0); setTitle(""); setExamDate(""); setLocation(""); setFee(""); setMaxCandidates("");
    setCreatedExamId(null); setPool([]); setPoolQ(""); setExaminers([]);
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
    const iso = parseBrDate(examDate); // valida calendário (rejeita 31/02)
    if (!title.trim() || !iso || !location.trim()) {
      setError("Preencha título, uma data válida (dd/mm/aaaa) e o local.");
      return;
    }
    setError(null); setLoading(true);
    try {
      // Payload amplo: exam_type = 'exame' | 'curso' (sem grau).
      const exam: any = await request(`/federation/${federationId}/belt-exams`, {
        method: "POST",
        body: {
          name: title.trim(),
          event_date: iso,
          location: location.trim(),
          exam_type: kind, // 'exame' ou 'curso'
          fee_amount: fee ? moneyToNumber(fee) : undefined,
          max_candidates: maxCandidates ? parseInt(maxCandidates, 10) : undefined,
        },
      });
      setCreatedExamId(exam?.id ?? null);
      if (kind === "curso") {
        // Curso não gradua: não há banca nem candidatos. Conclui direto.
        handleFinish();
        return;
      }
      setStep(1);
      searchPool("");
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível criar o evento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const addExaminer = async (p: PractitionerListItem) => {
    if (!createdExamId || examiners.some((e) => e.practitioner_id === p.id)) return;
    setBusyId(p.id);
    try {
      const role = examiners.length === 0 ? "chief" : "member";
      const ex = await karateApi.addExaminer(federationId, createdExamId, { practitioner_id: p.id, role });
      setExaminers((prev) => [...prev, ex]);
    } catch (e: any) {
      Alert.alert("Não foi possível adicionar", e?.message ?? "Tente novamente.");
    } finally {
      setBusyId(null);
    }
  };

  const handleEnroll = async (p: PractitionerListItem) => {
    if (!createdExamId || selected.includes(p.id)) return;
    setBusyId(p.id);
    try {
      const candidate = await karateApi.enrollCandidate(federationId, createdExamId, {
        practitioner_id: p.id,
        target_belt: DEFAULT_TARGET_BELT,
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
    const what = kind === "curso" ? "Curso" : "Exame";
    const detail = kind === "curso"
      ? `"${title}" criado.`
      : `"${title}" criado com ${selected.length} candidato(s) e ${examiners.length} examinador(es).`;
    Alert.alert(`${what} criado!`, detail, [{ text: "OK", onPress: resetAndClose }]);
  };

  const PoolList = ({ mode }: { mode: "examiner" | "candidate" }) => (
    <View style={{ gap: 8 }}>
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={15} color={P.ink3} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar praticante por nome ou registro…"
          placeholderTextColor={P.ink4}
          value={poolQ}
          onChangeText={setPoolQ}
          onSubmitEditing={() => searchPool(poolQ)}
          returnKeyType="search"
        />
      </View>
      {poolLoading ? (
        <ActivityIndicator style={{ marginTop: 12 }} color={P.red} />
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
                    <Ionicons name="checkmark-circle" size={14} color={P.ok} />
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

  // CTA do rodapé depende do tipo: no Curso o passo Dados é o último.
  const isLastStep = kind === "curso" || step === STEPS_EXAME.length - 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={resetAndClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={resetAndClose} />
        <View style={[styles.card, { width: cardW }]}>
          {/* header */}
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>空  FPKT · Novo evento</Text>
              <Text style={styles.title}>Criar evento<Text style={{ color: P.red }}>.</Text></Text>
              <Text style={styles.sub}>Escolha o tipo, preencha os dados{kind === "exame" ? " e monte a banca" : ""}.</Text>
            </View>
            <TouchableOpacity onPress={resetAndClose} hitSlop={10} style={styles.close} accessibilityLabel="Fechar modal">
              <Ionicons name="close" size={20} color={P.ink2} />
            </TouchableOpacity>
          </View>

          <Stepper steps={STEPS} currentStep={step} style={styles.stepper} />

          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={15} color={P.red} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {step === 0 && (
              <View style={styles.stepContent}>
                {/* Seletor de tipo de evento (amplo, sem grau) */}
                <View style={styles.kindRow}>
                  <KindOption
                    label="Exame"
                    desc="Avaliação com banca e candidatos"
                    icon="ribbon-outline"
                    active={kind === "exame"}
                    onPress={() => { setKind("exame"); setStep(0); }}
                  />
                  <KindOption
                    label="Curso"
                    desc="Formação / seminário (sem banca)"
                    icon="school-outline"
                    active={kind === "curso"}
                    onPress={() => { setKind("curso"); setStep(0); }}
                  />
                </View>

                <Field label={kind === "curso" ? "Título do curso" : "Título do exame"} req value={title} onChangeText={setTitle}
                  placeholder={kind === "curso" ? "Ex.: Curso de Arbitragem · Jun/2026" : "Ex.: Exame · Jun/2026"} autoFocus returnKeyType="next" />
                <Row2>
                  <Field flex label="Data" req hint="dd/mm/aaaa" mono value={examDate}
                    onChangeText={(v) => setExamDate(maskDate(v))} keyboardType="numeric" maxLength={10}
                    placeholder="dd/mm/aaaa" bad={dateBad}
                    note={dateBad ? "Data inválida. Use dd/mm/aaaa." : undefined} />
                  <Field flex label="Local" req value={location} onChangeText={setLocation}
                    placeholder="Dojô / ginásio" returnKeyType="next" />
                </Row2>
                <Row2>
                  <Field flex label="Taxa" hint="opcional" mono value={fee}
                    onChangeText={(v) => setFee(maskMoney(v))} keyboardType="numeric"
                    placeholder="0,00" prefix="R$" />
                  <Field flex label="Vagas" hint="opcional" mono value={maxCandidates}
                    onChangeText={(v) => setMaxCandidates(onlyD(v))} keyboardType="numeric"
                    placeholder="Sem limite" />
                </Row2>
              </View>
            )}

            {kind === "exame" && step === 1 && (
              <View style={styles.stepContent}>
                <Text style={styles.stepHint}>Adicione os examinadores da banca ({examiners.length} na banca). O primeiro vira presidente.</Text>
                <PoolList mode="examiner" />
              </View>
            )}

            {kind === "exame" && step === 2 && (
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
              <KarateButton
                label={loading ? "Criando..." : (isLastStep ? "Concluir" : "Próximo")}
                variant="sumi" size="md" loading={loading} onPress={handleStep1Next} style={{ flex: 1 }} />
            )}
            {kind === "exame" && step === 1 && (
              <KarateButton label="Próximo" variant="sumi" size="md" onPress={() => setStep(2)} style={{ flex: 1 }} />
            )}
            {kind === "exame" && step === 2 && (
              <KarateButton label="Concluir" variant="sumi" size="md" onPress={handleFinish} style={{ flex: 1 }} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── subcomponentes (padrão das fichas) ───────────────────────
function KindOption({ label, desc, icon, active, onPress }: {
  label: string; desc: string; icon: string; active: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[styles.kindOpt, active && styles.kindOptActive]}
    >
      <View style={[styles.kindIcon, active && styles.kindIconActive]}>
        <Ionicons name={icon as any} size={16} color={active ? P.paper : P.ink2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.kindLabel, active && styles.kindLabelActive]}>{label}</Text>
        <Text style={styles.kindDesc}>{desc}</Text>
      </View>
      {active && <Ionicons name="checkmark-circle" size={16} color={P.red} />}
    </Pressable>
  );
}
function Row2({ children }: { children: React.ReactNode }) {
  return <View style={styles.row2}>{children}</View>;
}
function Field(props: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  hint?: string; req?: boolean; mono?: boolean; flex?: boolean; bad?: boolean; prefix?: string;
  note?: string; noteOk?: boolean; keyboardType?: any; autoCapitalize?: any; maxLength?: number;
  autoFocus?: boolean; returnKeyType?: any;
}) {
  return (
    <View style={[styles.field, props.flex && { flex: 1 }]}>
      <Text style={styles.label}>{props.label}{props.req ? <Text style={{ color: P.red }}> *</Text> : null}{props.hint ? <Text style={styles.labelHint}>  · {props.hint}</Text> : null}</Text>
      <View style={[styles.inputWrap, props.bad && styles.inputBad]}>
        {props.prefix ? <Text style={styles.prefix}>{props.prefix}</Text> : null}
        <TextInput
          style={[styles.input, props.mono && styles.mono]}
          value={props.value} onChangeText={props.onChangeText} placeholder={props.placeholder}
          placeholderTextColor={P.ink4} keyboardType={props.keyboardType} autoCapitalize={props.autoCapitalize}
          maxLength={props.maxLength} autoFocus={props.autoFocus} returnKeyType={props.returnKeyType}
        />
      </View>
      {props.note ? <Text style={[styles.note, props.noteOk ? styles.noteOk : props.bad ? styles.noteBad : null]}>{props.note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card: { backgroundColor: P.paper, borderRadius: R.xl, overflow: "hidden", maxHeight: "92%", borderWidth: 1, borderColor: P.line2 } as ViewStyle,

  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
  eyebrow: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", letterSpacing: 1.4, color: P.ink3, textTransform: "uppercase" } as TextStyle,
  title: { fontFamily: F.heading, fontSize: 24, color: P.ink, marginTop: 2 } as TextStyle,
  sub: { fontFamily: F.body, fontSize: 12.5, color: P.ink2, marginTop: 3 } as TextStyle,
  close: { padding: 4, borderRadius: 999 } as ViewStyle,

  stepper: { marginHorizontal: 20, marginTop: 14 } as ViewStyle,

  bodyContent: { padding: 20, paddingTop: 12, gap: 12 } as ViewStyle,
  stepContent: { gap: 4 } as ViewStyle,
  stepHint: { fontFamily: F.body, fontSize: 12, color: P.ink3, marginBottom: 4 } as TextStyle,

  // Seletor de tipo de evento
  kindRow: { flexDirection: "row", gap: 10, marginBottom: 10 } as ViewStyle,
  kindOpt: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, padding: 12 } as ViewStyle,
  kindOptActive: { borderColor: P.red, backgroundColor: P.redWash } as ViewStyle,
  kindIcon: { width: 30, height: 30, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: P.paper3 } as ViewStyle,
  kindIconActive: { backgroundColor: P.ink } as ViewStyle,
  kindLabel: { fontFamily: F.body, fontSize: 14, fontWeight: "800", color: P.ink } as TextStyle,
  kindLabelActive: { color: P.ink } as TextStyle,
  kindDesc: { fontFamily: F.body, fontSize: 11, color: P.ink3, marginTop: 1 } as TextStyle,

  row2: { flexDirection: "row", gap: 12 } as ViewStyle,
  field: { marginBottom: 11 } as ViewStyle,
  label: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: P.ink2, marginBottom: 5 } as TextStyle,
  labelHint: { fontWeight: "500", color: P.ink4 } as TextStyle,
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, paddingHorizontal: 12 } as ViewStyle,
  inputBad: { borderColor: P.red } as ViewStyle,
  prefix: { fontFamily: F.mono, fontSize: 13, color: P.ink3, marginRight: 6 } as TextStyle,
  input: { flex: 1, fontFamily: F.body, fontSize: 14, color: P.ink, paddingVertical: 11, outlineStyle: "none" as any } as TextStyle,
  mono: { fontFamily: F.mono, letterSpacing: 0.5 } as TextStyle,
  note: { fontFamily: F.body, fontSize: 11, color: P.ink3, marginTop: 4 } as TextStyle,
  noteOk: { color: P.ok } as TextStyle,
  noteBad: { color: P.red } as TextStyle,

  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.glassHi, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, paddingHorizontal: 12, paddingVertical: 9 } as ViewStyle,
  searchInput: { flex: 1, fontFamily: F.body, fontSize: 14, color: P.ink, outlineStyle: "none" as any } as ViewStyle,
  candidateCard: { backgroundColor: P.glassHi, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, padding: 12, gap: 8 } as ViewStyle,
  candidateHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 } as ViewStyle,
  candidateInfo: { flex: 1, gap: 2 } as ViewStyle,
  candidateName: { fontFamily: F.body, fontSize: 14, fontWeight: "700", color: P.ink } as TextStyle,
  candidateMeta: { fontFamily: F.mono, fontSize: 11, color: P.ink3 } as TextStyle,
  enrolledTag: { flexDirection: "row", alignItems: "center", gap: 4 } as ViewStyle,
  enrolledText: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: P.ok } as TextStyle,
  checklist: { marginTop: 4 } as ViewStyle,

  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(184,70,58,0.08)", borderWidth: 1, borderColor: P.redLine, borderRadius: 12, padding: 11 } as ViewStyle,
  errorText: { fontFamily: F.body, fontSize: 12.5, color: P.red2, flex: 1 } as TextStyle,

  footer: { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
});
