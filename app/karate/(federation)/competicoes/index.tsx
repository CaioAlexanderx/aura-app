// ============================================================
// Competições — Visão Geral — Aura Karatê (federação) · Shoji
// Fiel ao pane "competicoes" do standalone v5. Dados reais.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP } from "@/constants/karateTheme";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import {
  ShojiBackground, PageHead, SectionHead, Card, KpiBand, ShojiBadge, ShojiButton, Body,
} from "@/components/karate/shoji";
import { CriarTorneioModal } from "@/components/karate/CriarTorneioModal";
import { karateCompetitionsApi, Competition, CompetitionStatus } from "@/services/karateCompetitionsApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

const STATUS: Record<CompetitionStatus, { label: string; badge: "neutral" | "ok" | "warn" | "danger" }> = {
  draft: { label: "Rascunho", badge: "neutral" }, open: { label: "Inscrições abertas", badge: "ok" },
  closed: { label: "Encerradas", badge: "warn" }, done: { label: "Concluído", badge: "neutral" }, cancelled: { label: "Cancelado", badge: "danger" },
};
const fmtDate = (iso?: string | null) => { if (!iso) return "Data a definir"; const d = new Date(iso); return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); };

export default function CompeticoesIndex() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const year = new Date().getFullYear();
  const [items, setItems] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try { const res = await karateCompetitionsApi.listCompetitions(federationId, { season: year }); setItems(res?.data ?? []); }
    catch { setError(true); }
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
  }, [federationId, year]);
  useEffect(() => { load(); }, [load]);

  if (error) return <ShojiBackground><KarateErrorState onRetry={() => load()} /></ShojiBackground>;

  const inscritos = items.reduce((a, c) => a + (c.entry_count || 0), 0);
  const cats = items.reduce((a, c) => a + (c.category_count || 0), 0);

  return (
    <ShojiBackground>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={P.red} />}>
        <PageHead
          eyebrow={`Circuito ${year} · ${items.length} ${items.length === 1 ? "torneio" : "torneios"}`}
          title="Competições"
          sub="Campeonato, etapas do circuito estadual e ranking acumulado."
          actions={<ShojiButton label="Novo torneio" icon="add" variant="sumi" onPress={() => setShowCreate(true)} />}
        />
        {loading ? <ActivityIndicator style={{ marginTop: 40 }} size="large" color={P.red} /> : <>
          <KpiBand items={[
            { label: "Torneios", value: items.length },
            { label: "Inscrições abertas", value: items.filter((c) => c.status === "open").length },
            { label: "Atletas inscritos", value: inscritos },
            { label: "Categorias", value: cats },
          ]} />
          <View style={styles.section}>
            <SectionHead title="Torneios" />
            {items.length === 0 ? <Card><KarateEmptyState icon="trophy-outline" title="Nenhum torneio ainda" subtitle="Crie o primeiro torneio da temporada." style={{ paddingVertical: 24 }} /></Card>
              : items.map((c) => (
                <TouchableOpacity key={c.id} onPress={() => router.push(`/karate/competicoes/torneio/${c.id}` as any)} activeOpacity={0.85}>
                  <Card style={{ marginBottom: 12 }}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle}>{c.name}</Text>
                      <ShojiBadge status={STATUS[c.status]?.badge ?? "neutral"} label={STATUS[c.status]?.label ?? c.status} />
                    </View>
                    <View style={styles.metaRow}>
                      <Meta icon="calendar-outline" text={fmtDate(c.event_date)} />
                      {c.circuit_round ? <Meta icon="flag-outline" text={`${c.circuit_round}ª etapa`} /> : null}
                      {!!c.location && <Meta icon="location-outline" text={c.location} />}
                    </View>
                    <View style={styles.statsRow}>
                      <Stat n={c.category_count} l="categorias" />
                      <Stat n={c.entry_count} l="inscritos" />
                    </View>
                  </Card>
                </TouchableOpacity>
              ))}
          </View>
        </>}
      </ScrollView>
      <CriarTorneioModal visible={showCreate} onClose={() => setShowCreate(false)} federationId={federationId} onCreated={() => load(true)} />
    </ShojiBackground>
  );
}

function Meta({ icon, text }: { icon: string; text: string }) {
  return <View style={styles.metaItem}><Ionicons name={icon as any} size={13} color={C.ink3} /><Text style={styles.metaTxt}>{text}</Text></View>;
}
function Stat({ n, l }: { n: number; l: string }) {
  return <Text style={styles.statTxt}><Text style={styles.statNum}>{n}</Text> {l}</Text>;
}

const styles = StyleSheet.create({
  content: { padding: 40, paddingTop: 40, paddingBottom: 72, maxWidth: SP.contentMax, width: "100%", alignSelf: "center" } as ViewStyle,
  section: { marginTop: SP[12] } as ViewStyle,
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 } as ViewStyle,
  cardTitle: { flex: 1, fontFamily: F.heading, fontSize: 18, color: C.ink } as TextStyle,
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 14 } as ViewStyle,
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 } as ViewStyle,
  metaTxt: { fontFamily: F.body, fontSize: 12, color: C.ink3 } as TextStyle,
  statsRow: { flexDirection: "row", gap: 20, marginTop: 12 } as ViewStyle,
  statTxt: { fontFamily: F.body, fontSize: 12, color: C.ink3 } as TextStyle,
  statNum: { fontFamily: F.mono, fontSize: 13, color: C.ink } as TextStyle,
});
