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
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { Badge } from "@/components/karate/Badge";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { useKarateFederation } from "@/contexts/KarateFederation";
import {
  karateCompetitionsApi, Entry, CompetitionDetail, Modality, CompetitionStatus,
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
  sheetTitle: { fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  sheetSub: { fontSize: 13, color: KarateColors.ink3, marginBottom: 4 } as TextStyle,
  inputLabel: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2, marginTop: 4 } as TextStyle,
  input: { borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: KarateColors.ink, backgroundColor: KarateColors.surface, fontFamily: KarateFonts.mono } as TextStyle,
  sheetActions: { flexDirection: "row", gap: 8, marginTop: 12 } as ViewStyle,
});
