// ============================================================
// CriarTorneioModal — Aura Karatê Track E (DESIGN-19) · Shoji
//
// Wizard 3 passos, agora em MODAL CENTRADO (overlay + card), igual às
// fichas de ouro (PraticanteFichaModal / DojoFichaModal). Antes abria em
// <Modal presentationStyle="pageSheet"> que no web vira TELA CHEIA.
//
//   Passo 1 — Dados do torneio (nome, temporada, data, local, etapa, taxa)
//   Passo 2 — Categorias (modalidade, faixa etária, graduação, sexo, peso, vagas, taxa)
//   Passo 3 — Revisão → cria competição + categorias
//
// Wired: karateCompetitionsApi.createCompetition + createCategory.
// Em falha, mostra erro honesto (sem simular sucesso).
//
// Metodologia de forms (decisões Caio):
//   - Máscara de dinheiro consistente (maskMoney) nas DUAS taxas — formata
//     centavos e envia em reais corretamente (antes era parseFloat de texto livre).
//   - Data com validação de calendário real (parseBrDate) — rejeita 31/02.
//   - Validação inline; asterisco real nos obrigatórios; autofocus; Enter avança.
//
// NOTA: os pickers de graduação oferecem TODAS as faixas de propósito —
// um torneio tem categorias para qualquer graduação. A regra "só Marrom →
// Preta" vale apenas para EXAMES da federação, não para competições.
//
// Comportamento de criação INTOCADO: createCompetition + createCategory.
// ============================================================
import React, { useState } from "react";
import {
  Modal, View, Text, TextInput, ScrollView, TouchableOpacity, Pressable,
  StyleSheet, Alert, useWindowDimensions, ViewStyle, TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ShojiPalette as P, KarateColors, KarateRadius as R, KarateFonts as F, KarateBelts, BeltKey } from "@/constants/karateTheme";
import { Stepper } from "@/components/karate/Stepper";
import { KarateButton } from "@/components/karate/KarateButton";
import { parseBrDate } from "@/components/inputs/DateInput";
import { karateCompetitionsApi, Modality, Sex } from "@/services/karateCompetitionsApi";

const STEPS = ["Dados", "Categorias", "Revisão"];

const onlyD = (v: string) => (v || "").replace(/\D/g, "");

// dd/mm/aaaa parcial enquanto digita (validação real é via parseBrDate)
function maskDate(v: string) {
  const d = onlyD(v).slice(0, 8);
  if (d.length > 4) return d.replace(/(\d{2})(\d{2})(\d+)/, "$1/$2/$3");
  if (d.length > 2) return d.replace(/(\d{2})(\d+)/, "$1/$2");
  return d;
}

// Máscara de dinheiro consistente: trabalha em centavos → exibe X,YY.
function maskMoney(v: string) {
  const cents = onlyD(v).slice(0, 11);
  if (!cents) return "";
  const n = parseInt(cents, 10);
  const reais = Math.floor(n / 100);
  const frac = String(n % 100).padStart(2, "0");
  return `${reais.toLocaleString("pt-BR")},${frac}`;
}
function moneyToNumber(v: string): number {
  const cents = onlyD(v);
  return cents ? parseInt(cents, 10) / 100 : 0;
}

const MODALITIES: { value: Modality; label: string }[] = [
  { value: "kata",        label: "Kata" },
  { value: "kumite",      label: "Kumite" },
  { value: "kihon_ippon", label: "Kihon-Ippon" },
  { value: "team_kata",   label: "Kata Equipe" },
  { value: "team_kumite", label: "Kumite Equipe" },
];
const SEXES: { value: Sex; label: string }[] = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Feminino" },
  { value: "mixed", label: "Misto" },
];

interface DraftCategory {
  key: string;
  name: string;
  modality: Modality;
  ageMin: string;
  ageMax: string;
  beltMin: BeltKey | "";
  beltMax: BeltKey | "";
  sex: Sex;
  weight: string;
  maxEntries: string;
  fee: string;
}

const BELT_KEYS = Object.keys(KarateBelts) as BeltKey[];

let __k = 0;
const newKey = () => `cat-${Date.now()}-${++__k}`;
const emptyDraft = (): DraftCategory => ({
  key: newKey(), name: "", modality: "kata", ageMin: "", ageMax: "",
  beltMin: "", beltMax: "", sex: "mixed", weight: "", maxEntries: "", fee: "",
});

interface Props {
  visible: boolean;
  onClose: () => void;
  federationId: string;
  onCreated?: () => void;
}

export function CriarTorneioModal({ visible, onClose, federationId, onCreated }: Props) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(700, width - 24);

  const [step, setStep] = useState(0);

  // Passo 1
  const [name, setName] = useState("");
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [circuitRound, setCircuitRound] = useState("");
  const [fee, setFee] = useState("");

  // Passo 2
  const [categories, setCategories] = useState<DraftCategory[]>([]);
  const [draft, setDraft] = useState<DraftCategory>(emptyDraft());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateBad = eventDate.length === 10 && parseBrDate(eventDate) === null;

  const resetAndClose = () => {
    setStep(0); setName(""); setSeason(String(new Date().getFullYear()));
    setEventDate(""); setLocation(""); setCircuitRound(""); setFee("");
    setCategories([]); setDraft(emptyDraft()); setLoading(false); setError(null);
    onClose();
  };

  const handleStep1Next = () => {
    if (!name.trim()) { setError("Informe o nome do torneio."); return; }
    if (eventDate && parseBrDate(eventDate) === null) { setError("Data inválida — use dd/mm/aaaa."); return; }
    setError(null); setStep(1);
  };

  const addCategory = () => {
    if (!draft.name.trim()) { setError("Informe o nome da categoria."); return; }
    setError(null);
    setCategories((prev) => [...prev, draft]);
    setDraft(emptyDraft());
  };
  const removeCategory = (key: string) =>
    setCategories((prev) => prev.filter((c) => c.key !== key));

  const handleFinish = async () => {
    setLoading(true); setError(null);
    try {
      const comp = await karateCompetitionsApi.createCompetition(federationId, {
        name: name.trim(),
        season: parseInt(season, 10) || new Date().getFullYear(),
        event_date: parseBrDate(eventDate),
        location: location || null,
        circuit_round: circuitRound ? parseInt(circuitRound, 10) : null,
        fee_amount: fee ? moneyToNumber(fee) : 0,
      });
      for (const c of categories) {
        await karateCompetitionsApi.createCategory(federationId, comp.id, {
          name: c.name.trim(), modality: c.modality,
          min_age: c.ageMin ? parseInt(c.ageMin, 10) : null,
          max_age: c.ageMax ? parseInt(c.ageMax, 10) : null,
          belt_min: c.beltMin || null, belt_max: c.beltMax || null,
          sex: c.sex, weight_class: c.weight || null,
          max_entries: c.maxEntries ? parseInt(c.maxEntries, 10) : null,
          fee_amount: c.fee ? moneyToNumber(c.fee) : null,
        });
      }
      Alert.alert("Torneio criado!", `"${name}" criado com ${categories.length} categoria(s).`,
        [{ text: "OK", onPress: () => { onCreated?.(); resetAndClose(); } }]);
    } catch (e: any) {
      Alert.alert("Não foi possível criar o torneio", e?.message ?? "Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={resetAndClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={resetAndClose} />
        <View style={[styles.card, { width: cardW }]}>
          {/* header */}
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>空  FPKT · Novo torneio</Text>
              <Text style={styles.title}>Criar torneio<Text style={{ color: P.red }}>.</Text></Text>
              <Text style={styles.sub}>Defina os dados e monte as categorias. Tudo nasce como rascunho.</Text>
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

            {/* STEP 1 — DADOS */}
            {step === 0 && (
              <View style={styles.stepContent}>
                <Field label="Nome do torneio" req value={name} onChangeText={setName}
                  placeholder="Ex: Copa Interior 2026 — 1ª Etapa" autoFocus returnKeyType="next" />
                <Row2>
                  <Field flex label="Temporada" mono value={season} onChangeText={(v) => setSeason(onlyD(v).slice(0, 4))}
                    placeholder="2026" keyboardType="numeric" maxLength={4} />
                  <Field flex label="Data do evento" hint="dd/mm/aaaa" mono value={eventDate}
                    onChangeText={(v) => setEventDate(maskDate(v))} placeholder="dd/mm/aaaa" keyboardType="numeric"
                    maxLength={10} bad={dateBad} note={dateBad ? "Data inválida. Use dd/mm/aaaa." : undefined} />
                </Row2>
                <Field label="Local" value={location} onChangeText={setLocation}
                  placeholder="Ginásio Municipal — Jacareí/SP" returnKeyType="next" />
                <Row2>
                  <Field flex label="Etapa do circuito" mono value={circuitRound}
                    onChangeText={(v) => setCircuitRound(onlyD(v))} placeholder="1" keyboardType="numeric" />
                  <Field flex label="Taxa padrão de inscrição" hint="opcional" mono value={fee}
                    onChangeText={(v) => setFee(maskMoney(v))} placeholder="0,00" keyboardType="numeric" prefix="R$" />
                </Row2>
              </View>
            )}

            {/* STEP 2 — CATEGORIAS */}
            {step === 1 && (
              <View style={styles.stepContent}>
                <Text style={styles.stepHint}>Adicione as categorias do torneio. Cada uma pode ter faixa etária, graduação, sexo e peso próprios.</Text>

                {categories.map((c) => (
                  <View key={c.key} style={styles.catRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catName}>{c.name}</Text>
                      <Text style={styles.catMeta}>
                        {MODALITIES.find((m) => m.value === c.modality)?.label}
                        {c.sex !== "mixed" ? ` · ${c.sex === "M" ? "Masc." : "Fem."}` : " · Misto"}
                        {c.weight ? ` · ${c.weight}` : ""}
                        {c.ageMin || c.ageMax ? ` · ${c.ageMin || "0"}–${c.ageMax || "∞"} anos` : ""}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => removeCategory(c.key)} accessibilityLabel={`Remover ${c.name}`}>
                      <Ionicons name="trash-outline" size={18} color={P.red} />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Editor de nova categoria */}
                <View style={styles.editor}>
                  <Text style={styles.editorTitle}>Nova categoria</Text>
                  <Field label="Nome da categoria" value={draft.name} onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
                    placeholder="Ex: Kata Adulto Faixa Preta Masc." returnKeyType="next" />

                  <Text style={styles.fieldLabel}>Modalidade</Text>
                  <View style={styles.chipsRow}>
                    {MODALITIES.map((m) => (
                      <TouchableOpacity key={m.value}
                        onPress={() => setDraft((d) => ({ ...d, modality: m.value }))}
                        style={[styles.chip, draft.modality === m.value && styles.chipActive]}
                        accessibilityRole="radio" accessibilityState={{ checked: draft.modality === m.value }}>
                        <Text style={[styles.chipText, draft.modality === m.value && styles.chipTextActive]}>{m.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>Sexo</Text>
                  <View style={styles.chipsRow}>
                    {SEXES.map((s) => (
                      <TouchableOpacity key={s.value}
                        onPress={() => setDraft((d) => ({ ...d, sex: s.value }))}
                        style={[styles.chip, draft.sex === s.value && styles.chipActive]}
                        accessibilityRole="radio" accessibilityState={{ checked: draft.sex === s.value }}>
                        <Text style={[styles.chipText, draft.sex === s.value && styles.chipTextActive]}>{s.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Row2>
                    <Field flex label="Idade mín." mono value={draft.ageMin}
                      onChangeText={(v) => setDraft((d) => ({ ...d, ageMin: onlyD(v).slice(0, 3) }))} placeholder="—" keyboardType="numeric" />
                    <Field flex label="Idade máx." mono value={draft.ageMax}
                      onChangeText={(v) => setDraft((d) => ({ ...d, ageMax: onlyD(v).slice(0, 3) }))} placeholder="—" keyboardType="numeric" />
                  </Row2>

                  <Text style={styles.fieldLabel}>Graduação mínima</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.beltPicker}>
                    {BELT_KEYS.map((k) => (
                      <TouchableOpacity key={`min-${k}`} onPress={() => setDraft((d) => ({ ...d, beltMin: k }))}
                        style={[styles.beltChip, { backgroundColor: KarateBelts[k].color }, draft.beltMin === k && styles.beltChipSelected]}>
                        <Text style={[styles.beltChipText, { color: KarateBelts[k].textColor }]}>{KarateBelts[k].label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <Text style={styles.fieldLabel}>Graduação máxima</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.beltPicker}>
                    {BELT_KEYS.map((k) => (
                      <TouchableOpacity key={`max-${k}`} onPress={() => setDraft((d) => ({ ...d, beltMax: k }))}
                        style={[styles.beltChip, { backgroundColor: KarateBelts[k].color }, draft.beltMax === k && styles.beltChipSelected]}>
                        <Text style={[styles.beltChipText, { color: KarateBelts[k].textColor }]}>{KarateBelts[k].label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Row2>
                    <Field flex label="Peso" value={draft.weight} onChangeText={(v) => setDraft((d) => ({ ...d, weight: v }))} placeholder="-60kg" />
                    <Field flex label="Vagas" mono value={draft.maxEntries}
                      onChangeText={(v) => setDraft((d) => ({ ...d, maxEntries: onlyD(v) }))} placeholder="sem limite" keyboardType="numeric" />
                  </Row2>
                  <Field label="Taxa da categoria" hint="usa a taxa padrão se vazio" mono value={draft.fee}
                    onChangeText={(v) => setDraft((d) => ({ ...d, fee: maskMoney(v) }))} placeholder="0,00" keyboardType="numeric" prefix="R$" />

                  <KarateButton label="Adicionar categoria" variant="secondary" size="sm" onPress={addCategory} />
                </View>
              </View>
            )}

            {/* STEP 3 — REVISÃO */}
            {step === 2 && (
              <View style={styles.stepContent}>
                <View style={styles.reviewCard}>
                  <Text style={styles.reviewTitle}>{name || "—"}</Text>
                  <Text style={styles.reviewMeta}>Temporada {season}{circuitRound ? ` · ${circuitRound}ª etapa` : ""}</Text>
                  {!!location && <Text style={styles.reviewMeta}>{location}</Text>}
                  {!!eventDate && <Text style={styles.reviewMeta}>{eventDate}</Text>}
                  <Text style={styles.reviewMeta}>Taxa padrão: {fee ? `R$ ${fee}` : "—"}</Text>
                </View>
                <Text style={styles.fieldLabel}>{categories.length} categoria(s)</Text>
                {categories.length === 0 ? (
                  <Text style={styles.stepHint}>Nenhuma categoria adicionada. Você pode adicioná-las depois no detalhe do torneio.</Text>
                ) : (
                  categories.map((c) => (
                    <View key={c.key} style={styles.catRow}>
                      <Text style={styles.catName}>{c.name}</Text>
                    </View>
                  ))
                )}
                <Text style={styles.stepHint}>O torneio será criado como rascunho. Você poderá abrir inscrições e lançar resultados no detalhe.</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {step > 0 && (
              <KarateButton label="Voltar" variant="ghost" size="md" onPress={() => setStep((s) => s - 1)} style={{ flex: 1 }} />
            )}
            {step === 0 && (
              <KarateButton label="Próximo" variant="primary" size="md" onPress={handleStep1Next} style={{ flex: 1 }} />
            )}
            {step === 1 && (
              <KarateButton label="Próximo" variant="primary" size="md" onPress={() => { setError(null); setStep(2); }} style={{ flex: 1 }} />
            )}
            {step === 2 && (
              <KarateButton label={loading ? "Criando..." : "Criar torneio"} variant="primary" size="md" loading={loading} onPress={handleFinish} style={{ flex: 1 }} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── subcomponentes (padrão das fichas) ───────────────────────
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

  fieldLabel: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: P.ink2, marginBottom: 5 } as TextStyle,
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 } as ViewStyle,
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: P.line2, backgroundColor: P.glassHi } as ViewStyle,
  chipActive: { backgroundColor: P.redWash, borderColor: P.red } as ViewStyle,
  chipText: { fontFamily: F.body, fontSize: 12, fontWeight: "600", color: P.ink3 } as TextStyle,
  chipTextActive: { color: P.red, fontWeight: "700" } as TextStyle,
  beltPicker: { marginBottom: 8 } as ViewStyle,
  beltChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginRight: 8, borderWidth: 2, borderColor: "transparent" } as ViewStyle,
  beltChipSelected: { borderColor: P.ink } as ViewStyle,
  beltChipText: { fontFamily: F.body, fontSize: 12, fontWeight: "700" } as TextStyle,
  editor: { backgroundColor: P.glassHi, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, padding: 14, gap: 4, marginTop: 4 } as ViewStyle,
  editorTitle: { fontFamily: F.body, fontSize: 14, fontWeight: "800", color: P.ink, marginBottom: 4 } as TextStyle,
  catRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: P.glassHi, borderRadius: R.sm, borderWidth: 1, borderColor: P.line2, marginBottom: 8 } as ViewStyle,
  catName: { fontFamily: F.body, fontSize: 14, fontWeight: "700", color: P.ink } as TextStyle,
  catMeta: { fontFamily: F.body, fontSize: 11, color: P.ink3, marginTop: 2 } as TextStyle,
  reviewCard: { backgroundColor: P.glassHi, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, padding: 14, gap: 3, marginBottom: 4 } as ViewStyle,
  reviewTitle: { fontFamily: F.heading, fontSize: 16, color: P.ink } as TextStyle,
  reviewMeta: { fontFamily: F.body, fontSize: 12, color: P.ink3 } as TextStyle,

  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(184,70,58,0.08)", borderWidth: 1, borderColor: P.redLine, borderRadius: 12, padding: 11 } as ViewStyle,
  errorText: { fontFamily: F.body, fontSize: 12.5, color: P.red2, flex: 1 } as TextStyle,

  footer: { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
});
