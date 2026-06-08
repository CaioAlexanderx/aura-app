// ============================================================
// Competições — Ranking acumulado da temporada (Track E / DESIGN-20)
//
// Filtro por temporada + categoria. Lê da view via
// karateCompetitionsApi.getSeasonRanking, com [MOCK] fallback.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { EmptyState } from "@/components/karate/EmptyState";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateCompetitionsApi, RankingRow } from "@/services/karateCompetitionsApi";

const SEASONS = [2026, 2025, 2024];
const CATEGORIES = [
  "Kata Adulto Faixa Preta Masc.",
  "Kata Adulto Faixa Preta Fem.",
  "Kumite Sub-21 -68kg Fem.",
  "Kumite Adulto -84kg Masc.",
];

// [MOCK] seed espelhando o backend (Design 21)
const MOCK: Record<string, RankingRow[]> = {
  "Kata Adulto Faixa Preta Masc.": [
    { category: "Kata Adulto Faixa Preta Masc.", student_id: "1", student_name: "Bruno Yukio Tanaka", karate_registration_number: "FPKT-A-00417", dojo_name: "Dojô Shotokan Jacareí", total_points: 1285, gold: 5, silver: 2, bronze: 0, events_participated: 8 },
    { category: "Kata Adulto Faixa Preta Masc.", student_id: "2", student_name: "Ricardo Nakamura Alves", karate_registration_number: "FPKT-A-00231", dojo_name: "Dojô Central FPKT São Paulo", total_points: 1190, gold: 3, silver: 3, bronze: 1, events_participated: 8 },
    { category: "Kata Adulto Faixa Preta Masc.", student_id: "3", student_name: "Eduardo Sato Pereira", karate_registration_number: "FPKT-A-00582", dojo_name: "Associação Shotokan Campinas", total_points: 1142, gold: 2, silver: 2, bronze: 3, events_participated: 7 },
    { category: "Kata Adulto Faixa Preta Masc.", student_id: "4", student_name: "Felipe Onishi Costa", karate_registration_number: "FPKT-A-00104", dojo_name: "Dojô Seishin Santo André", total_points: 1058, gold: 2, silver: 1, bronze: 2, events_participated: 8 },
    { category: "Kata Adulto Faixa Preta Masc.", student_id: "5", student_name: "Marcelo Yamamoto Dias", karate_registration_number: "FPKT-A-00673", dojo_name: "Dojô Bushido Sorocaba", total_points: 994, gold: 1, silver: 2, bronze: 2, events_participated: 7 },
  ],
};

const medalColor = ["#D4A017", "#9CA3AF", "#B07A3C"]; // ouro/prata/bronze

export default function CompeticoesRanking() {
  const { federationId } = useKarateFederation();
  const [season, setSeason] = useState(2026);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [rows, setRows] = useState<RankingRow[]>(MOCK[CATEGORIES[0]] || []);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await karateCompetitionsApi.getSeasonRanking(federationId, { season, category });
      setRows(res?.ranking ?? []);
    } catch {
      setRows(season === 2026 ? (MOCK[category] || []) : []);
    }
  }, [federationId, season, category]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={KarateColors.primary} />}>
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

      {/* Filtro categoria */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity key={c} onPress={() => setCategory(c)}
            style={[styles.catChip, category === c && styles.catChipActive]}
            accessibilityRole="radio" accessibilityState={{ checked: category === c }}>
            <Text style={[styles.catChipText, category === c && styles.catChipTextActive]} numberOfLines={1}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {rows.length === 0 ? (
        <EmptyState icon="podium-outline" title="Sem resultados nesta categoria" subtitle="Os pontos aparecem aqui assim que os resultados forem lançados." />
      ) : (
        <View style={styles.table}>
          {rows.map((r, i) => (
            <View key={r.student_id} style={[styles.tr, i === 0 && styles.trTop]}>
              <View style={[styles.pos, i < 3 && { backgroundColor: medalColor[i] }]}>
                <Text style={[styles.posText, i < 3 && { color: "#fff" }]}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.athlete}>{r.student_name}</Text>
                <Text style={styles.athleteMeta}>{r.karate_registration_number} · {r.dojo_name}</Text>
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
  content: { padding: 16, gap: 12, paddingBottom: 40 } as ViewStyle,
  pageHint: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  filterRow: { flexDirection: "row", gap: 8 } as ViewStyle,
  seasonChip: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.surface } as ViewStyle,
  seasonChipActive: { backgroundColor: KarateColors.primary, borderColor: KarateColors.primary } as ViewStyle,
  seasonChipText: { fontSize: 13, fontWeight: "700", color: KarateColors.ink3, fontFamily: "monospace" } as TextStyle,
  seasonChipTextActive: { color: "#fff" } as TextStyle,
  catScroll: { flexGrow: 0 } as ViewStyle,
  catChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.surface, maxWidth: 240 } as ViewStyle,
  catChipActive: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primary } as ViewStyle,
  catChipText: { fontSize: 12, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  catChipTextActive: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  table: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, overflow: "hidden" } as ViewStyle,
  tr: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  trTop: { borderTopWidth: 0 } as ViewStyle,
  pos: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: KarateColors.bg2 } as ViewStyle,
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
