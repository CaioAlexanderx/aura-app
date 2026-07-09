// ============================================================
// Competições — Ranking da temporada — Aura Karatê (federação) · Shoji
// Categorias derivadas das linhas reais. Dados reais.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP } from "@/constants/karateTheme";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { ShojiBackground, Chip, Avatar, Mono, Body } from "@/components/karate/shoji";
import { karateCompetitionsApi, RankingRow } from "@/services/karateCompetitionsApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

const MEDAL = ["#b8463a", "#9b9180", "#7a4e30"]; // ouro(vermelhão)/prata/bronze

export default function CompeticoesRanking() {
  const { federationId } = useKarateFederation();
  const thisYear = new Date().getFullYear();

  // F7.5: temporadas derivadas das competicoes reais (nao hardcoded).
  // Enquanto carrega, usa so o ano atual como fallback seguro.
  const [seasons, setSeasons] = useState<number[]>([thisYear]);
  const [seasonsLoading, setSeasonsLoading] = useState(true);
  const [season, setSeason] = useState(thisYear);
  const [seasonInitialized, setSeasonInitialized] = useState(false);

  const [category, setCategory] = useState<string | null>(null);
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSeasonsLoading(true);
      try {
        const res = await karateCompetitionsApi.listCompetitions(federationId);
        if (cancelled) return;
        const distinct = Array.from(new Set((res?.data ?? []).map((c) => c.season).filter((s): s is number => !!s)));
        distinct.sort((a, b) => b - a);
        const list = distinct.length > 0 ? distinct : [thisYear];
        setSeasons(list);
        // Preferir o ano corrente quando ele existir na lista de temporadas;
        // caso contrário, cair na mais recente (list[0], já ordenada desc).
        // Sem isso, uma temporada futura (ex.: 2027) já cadastrada abre por
        // padrão em vez do ano corrente (2026).
        setSeason(list.includes(thisYear) ? thisYear : list[0]);
      } catch {
        if (!cancelled) setSeasons([thisYear]);
      } finally {
        if (!cancelled) { setSeasonsLoading(false); setSeasonInitialized(true); }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [federationId]);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try { const res = await karateCompetitionsApi.getSeasonRanking(federationId, { season }); setRows(res?.ranking ?? []); }
    catch { setError(true); }
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
  }, [federationId, season]);
  useEffect(() => { if (seasonInitialized) load(); }, [load, seasonInitialized]);

  const categories = useMemo(() => Array.from(new Set(rows.map((r) => r.category).filter(Boolean))), [rows]);
  const active = category && categories.includes(category) ? category : categories[0] ?? null;
  const view = useMemo(() => rows.filter((r) => r.category === active), [rows, active]);

  if (error) return <ShojiBackground><KarateErrorState onRetry={() => load()} /></ShojiBackground>;

  return (
    <ShojiBackground>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={P.red} />}>
        <Body muted style={{ marginBottom: 14 }}>Pontuação acumulada do circuito por temporada e categoria.</Body>
        <View style={styles.chips}>
          {seasonsLoading
            ? <ActivityIndicator size="small" color={P.red} />
            : seasons.map((s) => <Chip key={s} label={String(s)} active={season === s} onPress={() => setSeason(s)} />)}
        </View>
        {categories.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { paddingBottom: 16 }]}>
            {categories.map((c) => <Chip key={c} label={c} active={active === c} onPress={() => setCategory(c)} />)}
          </ScrollView>
        )}

        {loading ? <ActivityIndicator style={{ marginTop: 40 }} size="large" color={P.red} />
          : view.length === 0 ? <KarateEmptyState icon="podium-outline" title="Sem resultados nesta temporada" subtitle="Os pontos aparecem quando os resultados forem lançados." style={{ paddingVertical: 32 }} />
          : (
            <View style={styles.table}>
              {view.map((r, i) => (
                <View key={r.student_id} style={[styles.tr, i === 0 && styles.trTop]}>
                  <View style={[styles.pos, i < 3 && { backgroundColor: MEDAL[i] }]}>
                    <Text style={[styles.posTxt, i < 3 && { color: "#fdf8f2" }]}>{i + 1}</Text>
                  </View>
                  <Avatar name={r.student_name} size={34} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{r.student_name}</Text>
                    <Body muted style={{ fontSize: 11, marginTop: 1 }}>{r.karate_registration_number ?? "—"} · {r.dojo_name ?? "—"}</Body>
                    <View style={styles.medals}>
                      {r.gold > 0 && <Medal c={MEDAL[0]} n={r.gold} />}
                      {r.silver > 0 && <Medal c={MEDAL[1]} n={r.silver} />}
                      {r.bronze > 0 && <Medal c={MEDAL[2]} n={r.bronze} />}
                      <Body muted style={{ fontSize: 11 }}>· {r.events_participated} etapas</Body>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Mono style={{ fontSize: 18, color: P.red }}>{r.total_points}</Mono>
                    <Text style={styles.pts}>pts</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
      </ScrollView>
    </ShojiBackground>
  );
}

function Medal({ c, n }: { c: string; n: number }) {
  return <View style={styles.medal}><View style={[styles.medalDot, { backgroundColor: c }]} /><Text style={styles.medalN}>{n}</Text></View>;
}

const styles = StyleSheet.create({
  content: { padding: 40, paddingTop: 32, paddingBottom: 72, maxWidth: 980, width: "100%", alignSelf: "center" } as ViewStyle,
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 12 } as ViewStyle,
  table: { backgroundColor: P.glass, borderWidth: 1, borderColor: C.line, borderRadius: R.xl, overflow: "hidden" } as ViewStyle,
  tr: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderTopWidth: 1, borderTopColor: C.line } as ViewStyle,
  trTop: { borderTopWidth: 0 } as ViewStyle,
  pos: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: P.paper2 } as ViewStyle,
  posTxt: { fontFamily: F.mono, fontSize: 13, color: C.ink2 } as TextStyle,
  name: { fontFamily: F.body, fontSize: 14, fontWeight: "600", color: C.ink } as TextStyle,
  medals: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" } as ViewStyle,
  medal: { flexDirection: "row", alignItems: "center", gap: 4 } as ViewStyle,
  medalDot: { width: 9, height: 9, borderRadius: 5 } as ViewStyle,
  medalN: { fontFamily: F.mono, fontSize: 12, color: C.ink2 } as TextStyle,
  pts: { fontFamily: F.body, fontSize: 10, color: C.ink4 } as TextStyle,
});
