// ============================================================
// Competições — Detalhe do Torneio (Track E)
//
// Mostra dados do torneio, categorias com inscritos e lançamento de
// resultado (colocação + pontos). Wired com karateCompetitionsApi,
// [MOCK] fallback enquanto federationId é placeholder.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Modal, TextInput,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { EmptyState } from "@/components/karate/EmptyState";
import { useKarateFederation } from "@/contexts/KarateFederation";
import {
  karateCompetitionsApi, Category, Entry, CompetitionDetail, Modality,
} from "@/services/karateCompetitionsApi";

const MODALITY_LABEL: Record<Modality, string> = {
  kata: "Kata", kumite: "Kumite", kihon_ippon: "Kihon-Ippon", team_kata: "Kata Equipe", team_kumite: "Kumite Equipe",
};

// [MOCK] seed
const MOCK_DETAIL: CompetitionDetail = {
  id: "t-204", federation_id: "", name: "Copa Vale do Paraíba 2026 — 2ª Etapa", season: 2026,
  event_date: "2026-07-18", location: "Ginásio Poliesportivo — Taubaté/SP", circuit_round: 2,
  fee_amount: 70, status: "open", category_count: 2, entry_count: 5,
  categories: [
    { id: "cat-1", competition_id: "t-204", name: "Kata Adulto Faixa Preta Masc.", modality: "kata", min_age: 18, max_age: 34, belt_min: "1dan", belt_max: "8dan", sex: "M", weight_class: null, max_entries: 32, fee_amount: null, entry_count: 3 },
    { id: "cat-2", competition_id: "t-204", name: "Kumite Adulto -84kg Masc.", modality: "kumite", min_age: 18, max_age: 34, belt_min: "6kyu", belt_max: "8dan", sex: "M", weight_class: "-84kg", max_entries: 16, fee_amount: 90, entry_count: 2 },
  ],
};
const MOCK_ENTRIES: Record<string, Entry[]> = {
  "cat-1": [
    { id: "e1", category_id: "cat-1", student_id: "1", student_name: "Bruno Yukio Tanaka", karate_registration_number: "FPKT-A-00417", current_belt: "2dan", current_belt_name: "Preta", dojo_id: null, dojo_name: "Dojô Shotokan Jacareí", status: "registered", fee_paid: true, placement: 1, points_awarded: 100, result_notes: null },
    { id: "e2", category_id: "cat-1", student_id: "2", student_name: "Ricardo Nakamura Alves", karate_registration_number: "FPKT-A-00231", current_belt: "3dan", current_belt_name: "Preta", dojo_id: null, dojo_name: "Dojô Central FPKT São Paulo", status: "registered", fee_paid: true, placement: 2, points_awarded: 70, result_notes: null },
    { id: "e3", category_id: "cat-1", student_id: "3", student_name: "Eduardo Sato Pereira", karate_registration_number: "FPKT-A-00582", current_belt: "1dan", current_belt_name: "Preta", dojo_id: null, dojo_name: "Associação Shotokan Campinas", status: "registered", fee_paid: false, placement: null, points_awarded: 0, result_notes: null },
  ],
  "cat-2": [
    { id: "e4", category_id: "cat-2", student_id: "4", student_name: "Leonardo Miyazaki Prado", karate_registration_number: "FPKT-A-00276", current_belt: "1dan", current_belt_name: "Preta", dojo_id: null, dojo_name: "Dojô Bushido Sorocaba", status: "registered", fee_paid: true, placement: null, points_awarded: 0, result_notes: null },
    { id: "e5", category_id: "cat-2", student_id: "5", student_name: "Vinícius Kuroda Santos", karate_registration_number: "FPKT-A-00318", current_belt: "2dan", current_belt_name: "Preta", dojo_id: null, dojo_name: "Dojô Central FPKT São Paulo", status: "registered", fee_paid: true, placement: null, points_awarded: 0, result_notes: null },
  ],
};

export default function TorneioDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const cid = String(id || "");

  const [comp, setComp] = useState<CompetitionDetail>(MOCK_DETAIL);
  const [entriesByCat, setEntriesByCat] = useState<Record<string, Entry[]>>(MOCK_ENTRIES);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [resultFor, setResultFor] = useState<Entry | null>(null);

  const load = useCallback(async () => {
    try {
      const detail = await karateCompetitionsApi.getCompetition(federationId, cid);
      if (detail?.id) setComp(detail);
    } catch { /* [MOCK fallback] */ }
  }, [federationId, cid]);
  useEffect(() => { load(); }, [load]);

  const loadEntries = useCallback(async (categoryId: string) => {
    try {
      const rows = await karateCompetitionsApi.listEntries(federationId, cid, categoryId);
      if (rows) setEntriesByCat((prev) => ({ ...prev, [categoryId]: rows }));
    } catch { /* keep mock */ }
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
    } catch { /* [MOCK fallback] aplica localmente */ }
    setEntriesByCat((prev) => ({
      ...prev,
      [entry.category_id]: (prev[entry.category_id] || []).map((e) =>
        e.id === entry.id ? { ...e, placement: body.placement, points_awarded: body.points_awarded, status: "done" } : e
      ),
    }));
    setResultFor(null);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar">
        <Ionicons name="chevron-back" size={18} color={KarateColors.primary} />
        <Text style={styles.backText}>Competições</Text>
      </TouchableOpacity>

      <View style={styles.headerCard}>
        <Text style={styles.title}>{comp.name}</Text>
        <Text style={styles.meta}>Temporada {comp.season}{comp.circuit_round ? ` · ${comp.circuit_round}ª etapa` : ""}</Text>
        {!!comp.location && <Text style={styles.meta}>{comp.location}</Text>}
        <View style={styles.statsRow}>
          <Text style={styles.stat}><Text style={styles.statNum}>{comp.categories.length}</Text> categorias</Text>
          <Text style={styles.stat}><Text style={styles.statNum}>{comp.entry_count}</Text> inscritos</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Categorias</Text>
      {comp.categories.length === 0 ? (
        <EmptyState icon="albums-outline" title="Sem categorias" subtitle="Adicione categorias ao criar ou editar o torneio." />
      ) : (
        comp.categories.map((cat) => {
          const open = openCat === cat.id;
          const entries = entriesByCat[cat.id] || [];
          return (
            <View key={cat.id} style={styles.catCard}>
              <TouchableOpacity style={styles.catHead} onPress={() => toggleCat(cat.id)} accessibilityRole="button">
                <View style={{ flex: 1 }}>
                  <Text style={styles.catName}>{cat.name}</Text>
                  <Text style={styles.catMeta}>{MODALITY_LABEL[cat.modality]} · {cat.entry_count ?? entries.length} inscritos{cat.weight_class ? ` · ${cat.weight_class}` : ""}</Text>
                </View>
                <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={KarateColors.ink3} />
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
                          <Text style={styles.entryMeta}>{e.karate_registration_number} · {e.dojo_name}</Text>
                        </View>
                        {e.points_awarded > 0 ? (
                          <Text style={styles.entryPts}>{e.points_awarded} pts</Text>
                        ) : null}
                        <TouchableOpacity onPress={() => setResultFor(e)} style={styles.resultBtn} accessibilityLabel={`Lançar resultado de ${e.student_name}`}>
                          <Ionicons name="create-outline" size={16} color={KarateColors.primary} />
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
    </ScrollView>
  );
}

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

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 12, paddingBottom: 40 } as ViewStyle,
  back: { flexDirection: "row", alignItems: "center", gap: 2 } as ViewStyle,
  backText: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  headerCard: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 16, gap: 4 } as ViewStyle,
  title: { fontSize: 20, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  meta: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  statsRow: { flexDirection: "row", gap: 18, marginTop: 6 } as ViewStyle,
  stat: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  statNum: { fontSize: 14, fontWeight: "800", color: KarateColors.ink, fontFamily: "monospace" } as TextStyle,
  sectionTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink, marginTop: 4 } as TextStyle,
  catCard: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, overflow: "hidden" } as ViewStyle,
  catHead: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 } as ViewStyle,
  catName: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  catMeta: { fontSize: 11, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  entries: { borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  emptyEntries: { fontSize: 12, color: KarateColors.ink3, padding: 14 } as TextStyle,
  entryRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  placeBadge: { width: 34, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: KarateColors.bg2 } as ViewStyle,
  placeText: { fontSize: 12, fontWeight: "800", color: KarateColors.ink2, fontFamily: "monospace" } as TextStyle,
  entryName: { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  entryMeta: { fontSize: 11, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  entryPts: { fontSize: 13, fontWeight: "800", color: KarateColors.primary, fontFamily: "monospace" } as TextStyle,
  resultBtn: { padding: 6, borderRadius: 8, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  overlay: { flex: 1, backgroundColor: "rgba(28,23,20,0.45)", alignItems: "center", justifyContent: "center", padding: 24 } as ViewStyle,
  sheet: { width: "100%", maxWidth: 360, backgroundColor: KarateColors.bg, borderRadius: KarateRadius.lg, padding: 20, gap: 8 } as ViewStyle,
  sheetTitle: { fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  sheetSub: { fontSize: 13, color: KarateColors.ink3, marginBottom: 4 } as TextStyle,
  inputLabel: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2, marginTop: 4 } as TextStyle,
  input: { borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: KarateColors.ink, backgroundColor: KarateColors.surface, fontFamily: "monospace" } as TextStyle,
  sheetActions: { flexDirection: "row", gap: 8, marginTop: 12 } as ViewStyle,
});
