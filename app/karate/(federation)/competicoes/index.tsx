// ============================================================
// Competições — Visão Geral — Aura Karatê (federação)
//
// Lista de torneios da temporada + KPIs + Criar Torneio (wizard).
// Dados reais via karateCompetitionsApi.listCompetitions. Sem mock:
// loading → spinner, falha → ErrorState, vazio → honesto.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KPIStrip } from "@/components/karate/KPIStrip";
import { Badge } from "@/components/karate/Badge";
import { KarateButton } from "@/components/karate/KarateButton";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { CriarTorneioModal } from "@/components/karate/CriarTorneioModal";
import { karateCompetitionsApi, Competition, CompetitionStatus } from "@/services/karateCompetitionsApi";

const STATUS_BADGE: Record<CompetitionStatus, "ok" | "warn" | "alert" | "neutral"> = {
  draft: "neutral", open: "ok", closed: "warn", done: "neutral", cancelled: "alert",
};
const STATUS_LABEL: Record<CompetitionStatus, string> = {
  draft: "Rascunho", open: "Inscrições abertas", closed: "Encerradas", done: "Concluído", cancelled: "Cancelado",
};

function fmtDate(iso?: string | null): string {
  if (!iso) return "Data a definir";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

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
    try {
      const res = await karateCompetitionsApi.listCompetitions(federationId, { season: year });
      setItems(res?.data ?? []);
    } catch {
      setError(true);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId, year]);

  useEffect(() => { load(); }, [load]);

  if (error) return <KarateErrorState onRetry={() => load()} />;

  const totalInscritos = items.reduce((a, c) => a + (c.entry_count || 0), 0);
  const abertos = items.filter((c) => c.status === "open").length;
  const kpis = [
    { label: "Torneios na temporada", value: String(items.length), accent: "primary" as const },
    { label: "Com inscrições abertas", value: String(abertos), accent: "ok" as const },
    { label: "Atletas inscritos", value: String(totalInscritos) },
    { label: "Categorias", value: String(items.reduce((a, c) => a + (c.category_count || 0), 0)) },
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={KarateColors.primary} />}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Circuito {year} · {items.length} {items.length === 1 ? "torneio" : "torneios"}</Text>
          <Text style={styles.title}>Competições</Text>
        </View>
        <KarateButton label="Criar torneio" variant="primary" size="md" onPress={() => setShowCreate(true)} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={KarateColors.primary} />
      ) : (
        <>
          <KPIStrip kpis={kpis} />
          <Text style={styles.sectionTitle}>Torneios</Text>
          {items.length === 0 ? (
            <KarateEmptyState icon="trophy-outline" title="Nenhum torneio ainda" subtitle="Crie o primeiro torneio da temporada." style={{ paddingVertical: 32 }} />
          ) : (
            items.map((c) => (
              <TouchableOpacity key={c.id} style={styles.card}
                onPress={() => router.push(`/karate/competicoes/torneio/${c.id}` as any)}
                accessibilityRole="button" accessibilityLabel={c.name}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardName}>{c.name}</Text>
                  <Badge status={STATUS_BADGE[c.status]} label={STATUS_LABEL[c.status]} />
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={13} color={KarateColors.ink3} />
                  <Text style={styles.meta}>{fmtDate(c.event_date)}</Text>
                  {c.circuit_round ? <Text style={styles.meta}>· {c.circuit_round}ª etapa</Text> : null}
                </View>
                {!!c.location && (
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={13} color={KarateColors.ink3} />
                    <Text style={styles.meta} numberOfLines={1}>{c.location}</Text>
                  </View>
                )}
                <View style={styles.statsRow}>
                  <Text style={styles.stat}><Text style={styles.statNum}>{c.category_count}</Text> categorias</Text>
                  <Text style={styles.stat}><Text style={styles.statNum}>{c.entry_count}</Text> inscritos</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </>
      )}

      <CriarTorneioModal visible={showCreate} onClose={() => setShowCreate(false)} federationId={federationId} onCreated={() => load(true)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 24, gap: 14, paddingBottom: 48, maxWidth: 1000, width: "100%", alignSelf: "center" } as ViewStyle,
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, color: KarateColors.primary, textTransform: "uppercase" } as TextStyle,
  title: { fontSize: 28, fontWeight: "800", color: KarateColors.ink, marginTop: 4 } as TextStyle,
  sectionTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink, marginTop: 4 } as TextStyle,
  card: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 16, gap: 6 } as ViewStyle,
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 } as ViewStyle,
  cardName: { flex: 1, fontSize: 15, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 } as ViewStyle,
  meta: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  statsRow: { flexDirection: "row", gap: 18, marginTop: 4 } as ViewStyle,
  stat: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  statNum: { fontSize: 13, fontWeight: "800", color: KarateColors.ink, fontFamily: "monospace" } as TextStyle,
});
