// ============================================================
// Competições — Ranking acumulado da temporada — Aura Karatê
//
// Filtro por temporada + categoria. Lê da view via
// karateCompetitionsApi.getSeasonRanking. Sem mock: as categorias
// são derivadas das linhas reais; falha → ErrorState; vazio honesto.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateCompetitionsApi, RankingRow } from "@/services/karateCompetitionsApi";

const medalColor = ["#D4A017", "#9CA3AF", "#B07A3C"]; // ouro/prata/bronze

export default function CompeticoesRanking() {
  const { federationId } = useKarateFederation();
  const thisYear = new Date().getFullYear();
  const SEASONS = [thisYear, thisYear - 1, thisYear - 2];

  const [season, setSeason] = useState(thisYear);
  const [category, setCategory] = useState<string | null>(null); // null = primeira disponível
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      // Sem category → traz todas as categorias da temporada; derivamos os chips.
      const res = await karateCompetitionsApi.getSeasonRanking(federationId, { season });
      setRows(res?.ranking ?? []);
    } catch {
      setError(true);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId, season]);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(
    () => Array.from(new Set(rows.map((r) => r.category).filter(Boolean))),
    [rows]
  );
  const activeCategory = category && categories.includes(category) ? category : categories[0] ?? null;
  const view = useMemo(
    () => rows.filter((r) => r.category === activeCategory),
    [rows, activeCategory]
  );

  if (error) return <KarateErrorState onRetry={() => load()} />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={KarateColors.primary} />}>
      <Text style={styles.pageHint}>Pontuação acumulada do circuito por temporada e categoria.</Text>

      {/* Filtro temporada */}
      <View style={styles.filterRow}>
        {SEASONS.map((s) => (
          <TouchableOpacity key={s} onPress={() => setSeason(s)}
            style={[styles.seasonChip, season === s && styles.seasonChipActive]}
            accessibilityRole="radio" accessibilityState={{ checked: season === s }}>
            <Text style={[styles.seasonChipText, season === s && styles.seasonChipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filtro categoria (derivado dos dados) */}
      {categories.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
          {categories.map((c) => (
            <TouchableOpacity key={c} onPress={() => setCategory(c)}
              style={[styles.catChip, activeCategory === c && styles.catChipActive]}
              accessibilityRole="radio" accessibilityState={{ checked: activeCategory === c }}>
              <Text style={[styles.catChipText, activeCategory === c && styles.catChipTextActive]} numberOfLines={1}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={KarateColors.primary} />
      ) : view.length === 0 ? (
        <KarateEmptyState icon="podium-outline" title="Sem resultados nesta temporada" subtitle="Os pontos aparecem aqui assim que os resultados forem lançados." style={{ paddingVertical: 32 }} />
      ) : (
        <View style={styles.table}>
          {view.map((r, i) => (
            <View key={r.student_id} style={[styles.tr, i === 0 && styles.trTop]}>
              <View style={[styles.pos, i < 3 && { backgroundColor: medalColor[i] }]}>
                <Text style={[styles.posText, i < 3 && { color: "#fff" }]}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.athlete}>{r.student_name}</Text>
                <Text style={styles.athleteMeta}>{r.karate_registration_number ?? "—"} · {r.dojo_name ?? "—"}</Text>
                <View style={styles.medalsRow}>
                  {r.gold > 0 && <Text style={styles.medal}>🥇 {r.gold}</Text>}
                  {r.silver > 0 && <Text style={styles.medal}>🥈 {r.silver}</Text>}
                  {r.bronze > 0 && <Text style={styles.medal}>🥉 {r.bronze}</Text>}
                  <Text style={styles.medalMeta}>· {r.events_participated} etapas</Text>
                </View>
              </View>
              <View style={styles.ptsBox}>
                <Text style={styles.pts}>{r.total_points}</Text>
                <Text style={styles.ptsLabel}>pts</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 24, gap: 12, paddingBottom: 48, maxWidth: 900, width: "100%", alignSelf: "center" } as ViewStyle,
  pageHint: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  filterRow: { flexDirection: "row", gap: 8 } as ViewStyle,
  seasonChip: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.bg2 } as ViewStyle,
  seasonChipActive: { backgroundColor: KarateColors.primary, borderColor: KarateColors.primary } as ViewStyle,
  seasonChipText: { fontSize: 13, fontWeight: "700", color: KarateColors.ink3, fontFamily: "monospace" } as TextStyle,
  seasonChipTextActive: { color: "#fff" } as TextStyle,
  catScroll: { flexGrow: 0 } as ViewStyle,
  catChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.bg2, maxWidth: 240 } as ViewStyle,
  catChipActive: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primary } as ViewStyle,
  catChipText: { fontSize: 12, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  catChipTextActive: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  table: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, overflow: "hidden" } as ViewStyle,
  tr: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  trTop: { borderTopWidth: 0 } as ViewStyle,
  pos: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: KarateColors.surface } as ViewStyle,
  posText: { fontSize: 13, fontWeight: "800", color: KarateColors.ink2, fontFamily: "monospace" } as TextStyle,
  athlete: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  athleteMeta: { fontSize: 11, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  medalsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" } as ViewStyle,
  medal: { fontSize: 12, color: KarateColors.ink2, fontWeight: "600" } as TextStyle,
  medalMeta: { fontSize: 11, color: KarateColors.ink4 } as TextStyle,
  ptsBox: { alignItems: "flex-end" } as ViewStyle,
  pts: { fontSize: 18, fontWeight: "800", color: KarateColors.primary, fontFamily: "monospace" } as TextStyle,
  ptsLabel: { fontSize: 10, color: KarateColors.ink4 } as TextStyle,
});
