// ============================================================
// CriarTorneioModal — Aura Karatê Track E (DESIGN-19)
//
// Wizard 3 passos (padrão TrocaModal / CriarExameModal):
//   Passo 1 — Dados do torneio (nome, temporada, data, local, etapa, taxa)
//   Passo 2 — Categorias (modalidade, faixa etária, graduação, sexo, peso, vagas, taxa)
//   Passo 3 — Revisão → cria competição + categorias
//
// Wired: karateCompetitionsApi.createCompetition + createCategory.
// [MOCK fallback] simula sucesso enquanto o federationId real não vem do JWT.
// ============================================================
import React, { useState } from "react";
import {
  Modal, View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ViewStyle, TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius, KarateBelts, BeltKey } from "@/constants/karateTheme";
import { Stepper } from "@/components/karate/Stepper";
import { FormField } from "@/components/karate/FormField";
import { KarateButton } from "@/components/karate/KarateButton";
import { karateCompetitionsApi, Modality, Sex } from "@/services/karateCompetitionsApi";

const STEPS = ["Dados", "Categorias", "Revisão"];

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

  const resetAndClose = () => {
    setStep(0); setName(""); setSeason(String(new Date().getFullYear()));
    setEventDate(""); setLocation(""); setCircuitRound(""); setFee("");
    setCategories([]); setDraft(emptyDraft()); setLoading(false); setError(null);
    onClose();
  };

  const handleStep1Next = () => {
    if (!name.trim()) { setError("Informe o nome do torneio."); return; }
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
        event_date: eventDate || null,
        location: location || null,
        circuit_round: circuitRound ? parseInt(circuitRound, 10) : null,
        fee_amount: fee ? parseFloat(fee) : 0,
      });
      for (const c of categories) {
        await karateCompetitionsApi.createCategory(federationId, comp.id, {
          name: c.name.trim(), modality: c.modality,
          min_age: c.ageMin ? parseInt(c.ageMin, 10) : null,
          max_age: c.ageMax ? parseInt(c.ageMax, 10) : null,
          belt_min: c.beltMin || null, belt_max: c.beltMax || null,
          sex: c.sex, weight_class: c.weight || null,
          max_entries: c.maxEntries ? parseInt(c.maxEntries, 10) : null,
          fee_amount: c.fee ? parseFloat(c.fee) : null,
        });
      }
      Alert.alert("Torneio criado!", `"${name}" criado com ${categories.length} categoria(s).`,
        [{ text: "OK", onPress: () => { onCreated?.(); resetAndClose(); } }]);
    } catch (e: any) {
      // [MOCK fallback] federationId ainda é placeholder até o login de federação
      Alert.alert("Torneio criado (rascunho)",
        `"${name}" com ${categories.length} categoria(s). Sincroniza quando o login de federação estiver ativo.`,
        [{ text: "OK", onPress: () => { onCreated?.(); resetAndClose(); } }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetAndClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Criar Torneio</Text>
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

          {/* STEP 1 — DADOS */}
          {step === 0 && (
            <View style={styles.stepContent}>
              <FormField label="Nome do torneio *" value={name} onChangeText={setName} placeholder="Ex: Copa Interior 2026 — 1ª Etapa" />
              <FormField label="Temporada" value={season} onChangeText={setSeason} placeholder="2026" keyboardType="numeric" />
              <FormField label="Data do evento (AAAA-MM-DD)" value={eventDate} onChangeText={setEventDate} placeholder="2026-10-10" keyboardType="numeric" />
              <FormField label="Local" value={location} onChangeText={setLocation} placeholder="Ginásio Municipal — Jacareí/SP" />
              <FormField label="Etapa do circuito" value={circuitRound} onChangeText={setCircuitRound} placeholder="1" keyboardType="numeric" />
              <FormField label="Taxa padrão de inscrição (R$)" value={fee} onChangeText={setFee} placeholder="60" keyboardType="numeric" />
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
                    <Ionicons name="trash-outline" size={18} color={KarateColors.danger} />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Editor de nova categoria */}
              <View style={styles.editor}>
                <Text style={styles.editorTitle}>Nova categoria</Text>
                <FormField label="Nome da categoria" value={draft.name} onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder="Ex: Kata Adulto Faixa Preta Masc." />

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

                <View style={styles.twoCol}>
                  <View style={{ flex: 1 }}>
                    <FormField label="Idade mín." value={draft.ageMin} onChangeText={(v) => setDraft((d) => ({ ...d, ageMin: v }))} placeholder="—" keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FormField label="Idade máx." value={draft.ageMax} onChangeText={(v) => setDraft((d) => ({ ...d, ageMax: v }))} placeholder="—" keyboardType="numeric" />
                  </View>
                </View>

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

                <View style={styles.twoCol}>
                  <View style={{ flex: 1 }}>
                    <FormField label="Peso" value={draft.weight} onChangeText={(v) => setDraft((d) => ({ ...d, weight: v }))} placeholder="-60kg" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FormField label="Vagas" value={draft.maxEntries} onChangeText={(v) => setDraft((d) => ({ ...d, maxEntries: v }))} placeholder="sem limite" keyboardType="numeric" />
                  </View>
                </View>
                <FormField label="Taxa da categoria (R$)" value={draft.fee} onChangeText={(v) => setDraft((d) => ({ ...d, fee: v }))} placeholder="usa a taxa padrão" keyboardType="numeric" />

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
  stepHint: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  fieldLabel: { fontSize: 13, fontWeight: "700", color: KarateColors.ink2, marginBottom: 2 } as TextStyle,
  twoCol: { flexDirection: "row", gap: 10 } as ViewStyle,
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.surface } as ViewStyle,
  chipActive: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primary } as ViewStyle,
  chipText: { fontSize: 12, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  chipTextActive: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  beltPicker: { marginBottom: 4 } as ViewStyle,
  beltChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginRight: 8, borderWidth: 2, borderColor: "transparent" } as ViewStyle,
  beltChipSelected: { borderColor: KarateColors.primary } as ViewStyle,
  beltChipText: { fontSize: 12, fontWeight: "700" } as TextStyle,
  editor: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 10 } as ViewStyle,
  editorTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  catRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  catName: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  catMeta: { fontSize: 11, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  reviewCard: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 3 } as ViewStyle,
  reviewTitle: { fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  reviewMeta: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: KarateColors.dangerSoft, padding: 10, borderRadius: KarateRadius.sm } as ViewStyle,
  errorText: { fontSize: 12, color: KarateColors.danger, flex: 1 } as TextStyle,
  footer: { flexDirection: "row", gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
});
