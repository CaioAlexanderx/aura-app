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
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP } from "@/constants/karateTheme";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import {
  ShojiBackground, PageHead, SectionHead, Card, KpiBand, ShojiBadge, ShojiButton, Body,
} from "@/components/karate/shoji";
import { CriarTorneioModal } from "@/components/karate/CriarTorneioModal";
import { karateCompetitionsApi, Competition, CompetitionStatus } from "@/services/karateCompetitionsApi";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { formatEventDateShort } from "@/utils/eventDate";

const STATUS: Record<CompetitionStatus, { label: string; badge: "neutral" | "ok" | "warn" | "danger" }> = {
  draft: { label: "Rascunho", badge: "neutral" }, open: { label: "Inscrições abertas", badge: "ok" },
  closed: { label: "Encerradas", badge: "warn" }, done: { label: "Concluído", badge: "neutral" }, cancelled: { label: "Cancelado", badge: "danger" },
};
const fmtDate = (iso?: string | null) => formatEventDateShort(iso, "Data a definir");

export default function CompeticoesIndex() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const [items, setItems] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // NOTA (fix campeonato "some" sem erro): a listagem NÃO filtra por season.
  // Antes filtrava implicitamente pelo ano corrente (sem seletor visível na UI),
  // então um campeonato criado com outra temporada (ex.: planejamento do ano
  // seguinte) era salvo com sucesso mas sumia da lista sem nenhum aviso.
  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try { const res = await karateCompetitionsApi.listCompetitions(federationId, { pageSize: 200 }); setItems(res?.data ?? []); }
    catch { setError(true); }
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
  }, [federationId]);
  useEffect(() => { load(); }, [load]);

  if (error) return <ShojiBackground><KarateErrorState onRetry={() => load()} /></ShojiBackground>;

  const inscritos = items.reduce((a, c) => a + (c.entry_count || 0), 0);
  const cats = items.reduce((a, c) => a + (c.category_count || 0), 0);

  return (
    <ShojiBackground>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={P.red} />}>
        <PageHead
          eyebrow={`${items.length} ${items.length === 1 ? "campeonato" : "campeonatos"} · todas as temporadas`}
          title="Competições"
          sub="Campeonato, etapas do circuito estadual e ranking acumulado."
          actions={<ShojiButton label="Novo campeonato" icon="add" variant="sumi" onPress={() => setShowCreate(true)} />}
        />
        {loading ? <ActivityIndicator style={{ marginTop: 40 }} size="large" color={P.red} /> : <>
          <KpiBand items={[
            { label: "Campeonatos", value: items.length },
            { label: "Inscrições abertas", value: items.filter((c) => c.status === "open").length },
            { label: "Atletas inscritos", value: inscritos },
            { label: "Categorias", value: cats },
          ]} />
          <View style={styles.section}>
            <SectionHead title="Campeonatos" />
            {items.length === 0 ? <Card><KarateEmptyState icon="trophy-outline" title="Nenhum campeonato ainda" subtitle="Crie o primeiro campeonato da temporada." style={{ paddingVertical: 24 }} /></Card>
              : items.map((c) => (
                <TouchableOpacity key={c.id} onPress={() => router.push(`/karate/competicoes/torneio/${c.id}` as any)} activeOpacity={0.85}>
                  <Card style={{ marginBottom: 12 }}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle}>{c.name}</Text>
                      <ShojiBadge status={STATUS[c.status]?.badge ?? "neutral"} label={STATUS[c.status]?.label ?? c.status} />
                    </View>
                    <View style={styles.metaRow}>
                      <Meta icon="calendar-outline" text={fmtDate(c.event_date)} />
                      <Meta icon="flag-outline" text={`Temporada ${c.season}`} />
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
  return <View style={styles.metaItem}><Icon name={icon as any} size={13} color={C.ink3} /><Text style={styles.metaTxt}>{text}</Text></View>;
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
