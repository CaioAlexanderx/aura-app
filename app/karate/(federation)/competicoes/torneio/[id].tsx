// ============================================================
// Competições — Detalhe do Campeonato — Aura Karatê (federação)
//
// Dados do campeonato, categorias com inscritos e lançamento de
// resultado (colocação + pontos). Dados reais via
// karateCompetitionsApi. Sem mock: loading → spinner, falha →
// ErrorState; lançamento falho avisa erro (não finge sucesso).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Modal, TextInput, Alert,
  ActivityIndicator, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts, KarateBelts, BeltKey, ShojiPalette as P } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { Badge } from "@/components/karate/Badge";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { useKarateFederation } from "@/contexts/KarateFederation";
import {
  karateCompetitionsApi, Entry, CompetitionDetail, Modality, CompetitionStatus, Category, Sex,
} from "@/services/karateCompetitionsApi";

const MODALITY_LABEL: Record<Modality, string> = {
  kata: "Kata", kumite: "Kumite", kihon_ippon: "Kihon-Ippon", team_kata: "Kata Equipe", team_kumite: "Kumite Equipe",
};
const STATUS_BADGE: Record<CompetitionStatus, "ok" | "warn" | "alert" | "neutral"> = {
  draft: "neutral", open: "ok", closed: "warn", done: "neutral", cancelled: "alert",
};
const STATUS_LABEL: Record<CompetitionStatus, string> = {
  draft: "Rascunho", open: "Inscrições abertas", closed: "Encerradas", done: "Concluído", cancelled: "Cancelado",
};

const MODALITIES: { value: Modality; label: string }[] = [
  { value: "kata", label: "Kata" },
  { value: "kumite", label: "Kumite" },
  { value: "kihon_ippon", label: "Kihon-Ippon" },
  { value: "team_kata", label: "Kata Equipe" },
  { value: "team_kumite", label: "Kumite Equipe" },
];
const SEXES: { value: Sex; label: string }[] = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Feminino" },
  { value: "mixed", label: "Misto" },
];
const BELT_KEYS = Object.keys(KarateBelts) as BeltKey[];
const onlyD = (v: string) => (v || "").replace(/\D/g, "");
function maskMoney(v: string) {
  const cents = onlyD(v).slice(0, 11);
  if (!cents) return "";
  const n = parseInt(cents, 10);
  return `${Math.floor(n / 100).toLocaleString("pt-BR")},${String(n % 100).padStart(2, "0")}`;
}
function moneyToNumber(v: string): number {
  const cents = onlyD(v);
  return cents ? parseInt(cents, 10) / 100 : 0;
}

export default function TorneioDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const cid = String(id || "");

  const [comp, setComp] = useState<CompetitionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [entriesByCat, setEntriesByCat] = useState<Record<string, Entry[]>>({});
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [resultFor, setResultFor] = useState<Entry | null>(null);
  const [copyFor, setCopyFor] = useState<Category | null>(null);

  const load = useCallback(() => {
    if (!cid) return;
    setLoading(true);
    setError(false);
    karateCompetitionsApi.getCompetition(federationId, cid)
      .then(setComp)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [federationId, cid]);
  useEffect(() => { load(); }, [load]);

  const loadEntries = useCallback(async (categoryId: string) => {
    try {
      const rows = await karateCompetitionsApi.listEntries(federationId, cid, categoryId);
      setEntriesByCat((prev) => ({ ...prev, [categoryId]: rows ?? [] }));
    } catch {
      setEntriesByCat((prev) => ({ ...prev, [categoryId]: [] }));
    }
  }, [federationId, cid]);

  const toggleCat = (categoryId: string) => {
    const next = openCat === categoryId ? null : categoryId;
    setOpenCat(next);
    if (next) loadEntries(next);
  };

  const saveResult = async (entry: Entry, placement: string, points: string) => {
    const body = {
      placement: placement ? parseInt(placement, 10) : null,
      points_awarded: points ? parseInt(points, 10) : 0,
      status: "done" as const,
    };
    try {
      await karateCompetitionsApi.patchEntry(federationId, cid, entry.id, body);
      setEntriesByCat((prev) => ({
        ...prev,
        [entry.category_id]: (prev[entry.category_id] || []).map((e) =>
          e.id === entry.id ? { ...e, placement: body.placement, points_awarded: body.points_awarded, status: "done" } : e
        ),
      }));
      setResultFor(null);
    } catch (e: any) {
      Alert.alert("Não foi possível salvar", e?.message ?? "Tente novamente.");
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: KarateColors.bg, padding: 24, gap: 12 }}>
        <ActivityIndicator size="large" color={KarateColors.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }
  if (error || !comp) return <KarateErrorState onRetry={load} />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar">
        <Icon name="chevron-back" size={18} color={KarateColors.primary} />
        <Text style={styles.backText}>Competições</Text>
      </TouchableOpacity>

      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>{comp.name}</Text>
          <Badge status={STATUS_BADGE[comp.status]} label={STATUS_LABEL[comp.status]} />
        </View>
        <Text style={styles.meta}>Temporada {comp.season}{comp.circuit_round ? ` · ${comp.circuit_round}ª etapa` : ""}</Text>
        {!!comp.location && <Text style={styles.meta}>{comp.location}</Text>}
        <View style={styles.statsRow}>
          <Text style={styles.stat}><Text style={styles.statNum}>{comp.categories.length}</Text> categorias</Text>
          <Text style={styles.stat}><Text style={styles.statNum}>{comp.entry_count}</Text> inscritos</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Categorias</Text>
      {comp.categories.length === 0 ? (
        <KarateEmptyState icon="albums-outline" title="Sem categorias" subtitle="Adicione categorias ao criar ou editar o campeonato." style={{ paddingVertical: 28 }} />
      ) : (
        comp.categories.map((cat) => {
          const open = openCat === cat.id;
          const entries = entriesByCat[cat.id] || [];
          return (
            <View key={cat.id} style={styles.catCard}>
              <TouchableOpacity style={styles.catHead} onPress={() => toggleCat(cat.id)} accessibilityRole="button">
                <View style={{ flex: 1 }}>
                  <Text style={styles.catName}>{cat.name}</Text>
                  <Text style={styles.catMeta}>{MODALITY_LABEL[cat.modality]} · {cat.entry_count ?? entries.length} inscritos</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setCopyFor(cat)}
                  style={styles.copyBtn}
                  accessibilityLabel={`Copiar categoria ${cat.name}`}
                  hitSlop={8}
                >
                  <Icon name="copy" size={15} color={KarateColors.ink3} />
                </TouchableOpacity>
                <Icon name={open ? "chevron-up" : "chevron-down"} size={18} color={KarateColors.ink3} />
              </TouchableOpacity>

              {open && (
                <View style={styles.entries}>
                  {entries.length === 0 ? (
                    <Text style={styles.emptyEntries}>Nenhum inscrito nesta categoria.</Text>
                  ) : (
                    entries.map((e) => (
                      <View key={e.id} style={styles.entryRow}>
                        <View style={styles.placeBadge}>
                          <Text style={styles.placeText}>{e.placement ? `${e.placement}º` : "—"}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.entryName}>{e.student_name}</Text>
                          <Text style={styles.entryMeta}>{e.karate_registration_number ?? "—"} · {e.dojo_name ?? "—"}</Text>
                        </View>
                        {e.points_awarded > 0 ? <Text style={styles.entryPts}>{e.points_awarded} pts</Text> : null}
                        <TouchableOpacity onPress={() => setResultFor(e)} style={styles.resultBtn} accessibilityLabel={`Lançar resultado de ${e.student_name}`}>
                          <Icon name="create-outline" size={16} color={KarateColors.primary} />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          );
        })
      )}

      <ResultadoModal entry={resultFor} onClose={() => setResultFor(null)} onSave={saveResult} />
      <CopiarCategoriaModal
        category={copyFor}
        federationId={federationId}
        competitionId={cid}
        onClose={() => setCopyFor(null)}
        onCreated={(newCat) => {
          setCopyFor(null);
          setComp((prev) => prev ? { ...prev, categories: [...prev.categories, newCat] } : prev);
        }}
      />
    </ScrollView>
  );
}

// ── Modal: Lançar resultado ──────────────────────────────────
function ResultadoModal({ entry, onClose, onSave }: {
  entry: Entry | null;
  onClose: () => void;
  onSave: (e: Entry, placement: string, points: string) => void;
}) {
  const [placement, setPlacement] = useState("");
  const [points, setPoints] = useState("");
  useEffect(() => {
    setPlacement(entry?.placement ? String(entry.placement) : "");
    setPoints(entry?.points_awarded ? String(entry.points_awarded) : "");
  }, [entry]);
  if (!entry) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Lançar resultado</Text>
          <Text style={styles.sheetSub}>{entry.student_name}</Text>
          <Text style={styles.inputLabel}>Colocação</Text>
          <TextInput style={styles.input} value={placement} onChangeText={setPlacement} keyboardType="numeric" placeholder="1" placeholderTextColor={KarateColors.ink4} />
          <Text style={styles.inputLabel}>Pontos FPKT</Text>
          <TextInput style={styles.input} value={points} onChangeText={setPoints} keyboardType="numeric" placeholder="100" placeholderTextColor={KarateColors.ink4} />
          <View style={styles.sheetActions}>
            <KarateButton label="Cancelar" variant="ghost" size="md" onPress={onClose} style={{ flex: 1 }} />
            <KarateButton label="Salvar" variant="primary" size="md" onPress={() => onSave(entry, placement, points)} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Modal: Copiar categoria ──────────────────────────────────
function CopiarCategoriaModal({ category, federationId, competitionId, onClose, onCreated }: {
  category: Category | null;
  federationId: string;
  competitionId: string;
  onClose: () => void;
  onCreated: (cat: Category) => void;
}) {
  const [name, setName] = useState("");
  const [modality, setModality] = useState<Modality>("kata");
  const [sex, setSex] = useState<Sex>("mixed");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [beltMin, setBeltMin] = useState<BeltKey | "">("");
  const [beltMax, setBeltMax] = useState<BeltKey | "">("");
  const [maxEntries, setMaxEntries] = useState("");
  const [fee, setFee] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preenche o formulário com os dados da categoria a ser copiada
  useEffect(() => {
    if (!category) return;
    setName(`${category.name} (cópia)`);
    setModality(category.modality);
    setSex(category.sex);
    setAgeMin(category.min_age != null ? String(category.min_age) : "");
    setAgeMax(category.max_age != null ? String(category.max_age) : "");
    setBeltMin((category.belt_min as BeltKey | null) ?? "");
    setBeltMax((category.belt_max as BeltKey | null) ?? "");
    setMaxEntries(category.max_entries != null ? String(category.max_entries) : "");
    const cents = category.fee_amount != null ? Math.round(category.fee_amount * 100) : 0;
    setFee(cents ? maskMoney(String(cents)) : "");
    setError(null);
    setSaving(false);
  }, [category]);

  if (!category) return null;

  const handleSave = async () => {
    if (!name.trim()) { setError("Informe o nome da categoria."); return; }
    setError(null);
    setSaving(true);
    try {
      const created = await karateCompetitionsApi.createCategory(federationId, competitionId, {
        name: name.trim(),
        modality,
        min_age: ageMin ? parseInt(ageMin, 10) : null,
        max_age: ageMax ? parseInt(ageMax, 10) : null,
        belt_min: beltMin || null,
        belt_max: beltMax || null,
        sex,
        weight_class: null,
        max_entries: maxEntries ? parseInt(maxEntries, 10) : null,
        fee_amount: fee ? moneyToNumber(fee) : null,
      });
      onCreated(created);
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível criar a categoria. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, styles.sheetLarge]}>
          <Text style={styles.sheetTitle}>Copiar categoria</Text>
          <Text style={styles.sheetSub}>Ajuste os campos e salve como nova categoria.</Text>

          {error ? (
            <View style={styles.errorBanner}>
              <Icon name="alert_circle" size={14} color={P.red} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.inputLabel}>Nome da categoria <Text style={{ color: P.red }}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ex: Kata Adulto Faixa Preta Masc."
              placeholderTextColor={KarateColors.ink4}
              autoFocus
            />

            <Text style={styles.inputLabel}>Modalidade</Text>
            <View style={styles.chipsRow}>
              {MODALITIES.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  onPress={() => setModality(m.value)}
                  style={[styles.chip, modality === m.value && styles.chipActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: modality === m.value }}
                >
                  <Text style={[styles.chipText, modality === m.value && styles.chipTextActive]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Sexo</Text>
            <View style={styles.chipsRow}>
              {SEXES.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  onPress={() => setSex(s.value)}
                  style={[styles.chip, sex === s.value && styles.chipActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: sex === s.value }}
                >
                  <Text style={[styles.chipText, sex === s.value && styles.chipTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Idade mín.</Text>
                <TextInput style={styles.input} value={ageMin} onChangeText={(v) => setAgeMin(onlyD(v).slice(0, 3))} keyboardType="numeric" placeholder="—" placeholderTextColor={KarateColors.ink4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Idade máx.</Text>
                <TextInput style={styles.input} value={ageMax} onChangeText={(v) => setAgeMax(onlyD(v).slice(0, 3))} keyboardType="numeric" placeholder="—" placeholderTextColor={KarateColors.ink4} />
              </View>
            </View>

            <Text style={styles.inputLabel}>Graduação mínima</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              {BELT_KEYS.map((k) => (
                <TouchableOpacity
                  key={`min-${k}`}
                  onPress={() => setBeltMin(beltMin === k ? "" : k)}
                  style={[styles.beltChip, { backgroundColor: KarateBelts[k].color }, beltMin === k && styles.beltChipSelected]}
                  accessibilityLabel={`Faixa mínima ${KarateBelts[k].label}`}
                >
                  <Text style={[styles.beltChipText, { color: KarateBelts[k].textColor }]}>{KarateBelts[k].label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Graduação máxima</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              {BELT_KEYS.map((k) => (
                <TouchableOpacity
                  key={`max-${k}`}
                  onPress={() => setBeltMax(beltMax === k ? "" : k)}
                  style={[styles.beltChip, { backgroundColor: KarateBelts[k].color }, beltMax === k && styles.beltChipSelected]}
                  accessibilityLabel={`Faixa máxima ${KarateBelts[k].label}`}
                >
                  <Text style={[styles.beltChipText, { color: KarateBelts[k].textColor }]}>{KarateBelts[k].label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Vagas</Text>
                <TextInput style={styles.input} value={maxEntries} onChangeText={(v) => setMaxEntries(onlyD(v))} keyboardType="numeric" placeholder="sem limite" placeholderTextColor={KarateColors.ink4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Taxa (R$)</Text>
                <TextInput style={styles.input} value={fee} onChangeText={(v) => setFee(maskMoney(v))} keyboardType="numeric" placeholder="0,00" placeholderTextColor={KarateColors.ink4} />
              </View>
            </View>
          </ScrollView>

          <View style={styles.sheetActions}>
            <KarateButton label="Cancelar" variant="ghost" size="md" onPress={onClose} style={{ flex: 1 }} disabled={saving} />
            <KarateButton label={saving ? "Criando…" : "Criar cópia"} variant="primary" size="md" loading={saving} onPress={handleSave} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 24, gap: 12, paddingBottom: 48, maxWidth: 900, width: "100%", alignSelf: "center" } as ViewStyle,
  back: { flexDirection: "row", alignItems: "center", gap: 2 } as ViewStyle,
  backText: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  headerCard: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 16, gap: 4 } as ViewStyle,
  headerTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 } as ViewStyle,
  title: { flex: 1, fontFamily: KarateFonts.heading, fontSize: 22, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  meta: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  statsRow: { flexDirection: "row", gap: 18, marginTop: 6 } as ViewStyle,
  stat: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  statNum: { fontSize: 14, fontWeight: "800", color: KarateColors.ink, fontFamily: KarateFonts.mono } as TextStyle,
  sectionTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink, marginTop: 4 } as TextStyle,
  catCard: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, overflow: "hidden" } as ViewStyle,
  catHead: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 } as ViewStyle,
  catName: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  catMeta: { fontSize: 11, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  copyBtn: { padding: 6, borderRadius: 8, backgroundColor: KarateColors.surface } as ViewStyle,
  entries: { borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  emptyEntries: { fontSize: 12, color: KarateColors.ink3, padding: 14 } as TextStyle,
  entryRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  placeBadge: { width: 34, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: KarateColors.surface } as ViewStyle,
  placeText: { fontSize: 12, fontWeight: "800", color: KarateColors.ink2, fontFamily: KarateFonts.mono } as TextStyle,
  entryName: { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  entryMeta: { fontSize: 11, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  entryPts: { fontSize: 13, fontWeight: "800", color: KarateColors.primary, fontFamily: KarateFonts.mono } as TextStyle,
  resultBtn: { padding: 6, borderRadius: 8, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  overlay: { flex: 1, backgroundColor: "rgba(28,23,20,0.45)", alignItems: "center", justifyContent: "center", padding: 24 } as ViewStyle,
  sheet: { width: "100%", maxWidth: 360, backgroundColor: KarateColors.bg, borderRadius: KarateRadius.lg, padding: 20, gap: 8 } as ViewStyle,
  sheetLarge: { maxWidth: 520 } as ViewStyle,
  sheetTitle: { fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  sheetSub: { fontSize: 13, color: KarateColors.ink3, marginBottom: 4 } as TextStyle,
  inputLabel: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2, marginTop: 4 } as TextStyle,
  input: { borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: KarateColors.ink, backgroundColor: KarateColors.surface, fontFamily: KarateFonts.mono } as TextStyle,
  sheetActions: { flexDirection: "row", gap: 8, marginTop: 12 } as ViewStyle,
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(184,70,58,0.08)", borderWidth: 1, borderColor: "rgba(184,70,58,0.42)", borderRadius: 10, padding: 10 } as ViewStyle,
  errorText: { fontSize: 12.5, color: P.red2, flex: 1 } as TextStyle,
  row2: { flexDirection: "row", gap: 10 } as ViewStyle,
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 } as ViewStyle,
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.surface } as ViewStyle,
  chipActive: { backgroundColor: "rgba(184,70,58,0.08)", borderColor: P.red } as ViewStyle,
  chipText: { fontSize: 12, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  chipTextActive: { color: P.red, fontWeight: "700" } as TextStyle,
  beltChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginRight: 8, borderWidth: 2, borderColor: "transparent" } as ViewStyle,
  beltChipSelected: { borderColor: P.ink } as ViewStyle,
  beltChipText: { fontSize: 12, fontWeight: "700" } as TextStyle,
});
