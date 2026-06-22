// ============================================================
// Ranking Público Embeddável — Aura Karatê (DESIGN-21)
// Rota: /karate/[slug]/ranking  (PÚBLICA, sem login — para <iframe>)
//
// Fica FORA do grupo (federation). O AuthGuard raiz (app/_layout.tsx) tem
// bypass para segments[0]==="karate" && segments[2]==="ranking".
// Consome GET /public/karate/:slug/ranking e /seasons (sem auth).
// Sem chrome do app: cabeçalho FPKT + tabela + rodapé Aura.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, Image, ActivityIndicator, TouchableOpacity,
  StyleSheet, ViewStyle, TextStyle, Linking,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { FpktLogo } from "@/components/karate/FpktLogo";
import { karateCompetitionsApi, RankingRow, PublicSeasons } from "@/services/karateCompetitionsApi";

const medalColor = ["#b8463a", "#9b9180", "#7a4e30"]; // ouro(vermelhão)/prata/bronze — Shoji

export default function PublicRankingScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const fedSlug = String(slug || "fpkt");

  const [loading, setLoading] = useState(true);
  const [fed, setFed] = useState<{ name: string; logo: string | null }>({ name: "FPKT", logo: null });
  const [seasons, setSeasons] = useState<PublicSeasons["seasons"]>([]);
  const [season, setSeason] = useState<number>(new Date().getFullYear());
  const [category, setCategory] = useState<string | null>(null);
  const [rows, setRows] = useState<RankingRow[]>([]);

  // carrega temporadas/categorias
  useEffect(() => {
    let alive = true;
    karateCompetitionsApi.getPublicSeasons(fedSlug)
      .then((res) => {
        if (!alive || !res) return;
        setFed(res.federation);
        setSeasons(res.seasons || []);
        if (res.seasons?.length) {
          setSeason(res.seasons[0].season);
          setCategory(res.seasons[0].categories?.[0] ?? null);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [fedSlug]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await karateCompetitionsApi.getPublicRanking(fedSlug, {
        season, category: category || undefined,
      });
      if (res) { setFed(res.federation); setRows(res.ranking || []); }
      else setRows([]);
    } catch { setRows([]); }
    finally { setLoading(false); }
  }, [fedSlug, season, category]);
  useEffect(() => { load(); }, [load]);

  const cats = seasons.find((s) => s.season === season)?.categories ?? (category ? [category] : []);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <View style={styles.container}>
        {/* Cabeçalho FPKT */}
        <View style={styles.gov}>
          {fed.logo ? (
            <Image source={{ uri: fed.logo }} style={styles.govLogo} resizeMode="contain" />
          ) : (
            <FpktLogo size={42} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.govTitle}>{fed.name}</Text>
            <Text style={styles.govSub}>Ranking oficial do circuito</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.govK}>TEMPORADA</Text>
            <Text style={styles.govSeason}>{season}</Text>
          </View>
        </View>

        {/* Filtros */}
        {seasons.length > 1 && (
          <View style={styles.filterRow}>
            {seasons.map((s) => (
              <TouchableOpacity key={s.season} onPress={() => { setSeason(s.season); setCategory(s.categories?.[0] ?? null); }}
                style={[styles.seasonChip, season === s.season && styles.seasonChipActive]}>
                <Text style={[styles.seasonChipText, season === s.season && styles.seasonChipTextActive]}>{s.season}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {cats.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
            {cats.map((c) => (
              <TouchableOpacity key={c} onPress={() => setCategory(c)}
                style={[styles.catChip, category === c && styles.catChipActive]}>
                <Text style={[styles.catChipText, category === c && styles.catChipTextActive]} numberOfLines={1}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Tabela */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={KarateColors.primary} />
            <Text style={styles.loadingTxt}>Carregando ranking…</Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Sem resultados</Text>
            <Text style={styles.emptyTxt}>Ainda não há resultados lançados nesta categoria/temporada.</Text>
          </View>
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
                    {r.gold > 0 && <Medal c={medalColor[0]} n={r.gold} />}
                    {r.silver > 0 && <Medal c={medalColor[1]} n={r.silver} />}
                    {r.bronze > 0 && <Medal c={medalColor[2]} n={r.bronze} />}
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

        {/* Rodapé Aura */}
        <TouchableOpacity style={styles.auraFooter} onPress={() => Linking.openURL("https://www.getaura.com.br")} accessibilityRole="link">
          <View style={styles.footSeal}><Text style={styles.footSealK}>空</Text></View>
          <View>
            <Text style={styles.footWm}>Aura · Karatê</Text>
            <Text style={styles.footSub}>Atualizado em tempo real</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Medal({ c, n }: { c: string; n: number }) {
  return <View style={styles.medalItem}><View style={[styles.medalDot, { backgroundColor: c }]} /><Text style={styles.medal}>{n}</Text></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  medalItem: { flexDirection: "row", alignItems: "center", gap: 4 } as ViewStyle,
  medalDot: { width: 9, height: 9, borderRadius: 5 } as ViewStyle,
  pageContent: { alignItems: "center", paddingHorizontal: 16, paddingVertical: 22, paddingBottom: 48 } as ViewStyle,
  container: { width: "100%", maxWidth: 560 } as ViewStyle,
  gov: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  govLogo: { width: 42, height: 42 } as any,
  seal: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: KarateColors.primaryLine, backgroundColor: KarateColors.primarySoft, alignItems: "center", justifyContent: "center" } as ViewStyle,
  sealKanji: { fontFamily: KarateFonts.heading, fontSize: 22, color: KarateColors.primary } as TextStyle,
  govTitle: { fontFamily: KarateFonts.heading, fontSize: 19, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  govSub: { fontSize: 11, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  govK: { fontSize: 9.5, letterSpacing: 1.4, color: KarateColors.ink4, fontFamily: KarateFonts.mono } as TextStyle,
  govSeason: { fontSize: 15, color: KarateColors.ink2, fontFamily: KarateFonts.mono, fontWeight: "700" } as TextStyle,
  filterRow: { flexDirection: "row", gap: 8, marginTop: 14 } as ViewStyle,
  seasonChip: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.surface } as ViewStyle,
  seasonChipActive: { backgroundColor: KarateColors.primary, borderColor: KarateColors.primary } as ViewStyle,
  seasonChipText: { fontSize: 13, fontWeight: "700", color: KarateColors.ink3, fontFamily: KarateFonts.mono } as TextStyle,
  seasonChipTextActive: { color: "#fff" } as TextStyle,
  catScroll: { flexGrow: 0, marginTop: 10 } as ViewStyle,
  catChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.surface, maxWidth: 260 } as ViewStyle,
  catChipActive: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primary } as ViewStyle,
  catChipText: { fontSize: 12, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  catChipTextActive: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  loadingBox: { alignItems: "center", gap: 10, paddingVertical: 48 } as ViewStyle,
  loadingTxt: { fontSize: 13, color: KarateColors.ink3 } as TextStyle,
  emptyBox: { alignItems: "center", gap: 6, paddingVertical: 48 } as ViewStyle,
  emptyTitle: { fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  emptyTxt: { fontSize: 13, color: KarateColors.ink3, textAlign: "center", maxWidth: 320 } as TextStyle,
  table: { backgroundColor: KarateColors.glass, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: KarateColors.border, overflow: "hidden", marginTop: 14 } as ViewStyle,
  tr: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  trTop: { borderTopWidth: 0 } as ViewStyle,
  pos: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: KarateColors.bg2 } as ViewStyle,
  posText: { fontSize: 13, fontWeight: "800", color: KarateColors.ink2, fontFamily: KarateFonts.mono } as TextStyle,
  athlete: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  athleteMeta: { fontSize: 11, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  medalsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" } as ViewStyle,
  medal: { fontSize: 12, color: KarateColors.ink2, fontWeight: "600" } as TextStyle,
  medalMeta: { fontSize: 11, color: KarateColors.ink4 } as TextStyle,
  ptsBox: { alignItems: "flex-end" } as ViewStyle,
  pts: { fontSize: 18, fontWeight: "800", color: KarateColors.primary, fontFamily: KarateFonts.mono } as TextStyle,
  ptsLabel: { fontSize: 10, color: KarateColors.ink4 } as TextStyle,
  auraFooter: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center", marginTop: 24 } as ViewStyle,
  footSeal: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: KarateColors.border, alignItems: "center", justifyContent: "center" } as ViewStyle,
  footSealK: { fontFamily: KarateFonts.heading, fontSize: 16, color: KarateColors.ink3 } as TextStyle,
  footWm: { fontSize: 13, fontWeight: "800", color: KarateColors.ink2 } as TextStyle,
  footSub: { fontSize: 11, color: KarateColors.ink4 } as TextStyle,
});
