// ============================================================
// Competições — Visão Geral (Track E / DESIGN-18)
//
// Lista de torneios da temporada + KPIs + botão Criar Torneio (wizard).
// Wired: karateCompetitionsApi.listCompetitions com [MOCK] fallback
// (federationId ainda é placeholder até o login de federação).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KPIStrip } from "@/components/karate/KPIStrip";
import { Badge } from "@/components/karate/Badge";
import { KarateButton } from "@/components/karate/KarateButton";
import { EmptyState } from "@/components/karate/EmptyState";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { CriarTorneioModal } from "@/components/karate/CriarTorneioModal";
import { karateCompetitionsApi, Competition, CompetitionStatus } from "@/services/karateCompetitionsApi";

// [MOCK] seed — substituir 100% por listCompetitions quando o federationId vier do JWT
const MOCK_COMPETITIONS: Competition[] = [
  { id: "t-204", federation_id: "", name: "Copa Vale do Paraíba 2026 — 2ª Etapa", season: 2026, event_date: "2026-07-18", location: "Ginásio Poliesportivo — Taubaté/SP", circuit_round: 2, fee_amount: 70, status: "open", category_count: 18, entry_count: 142 },
  { id: "t-198", federation_id: "", name: "Campeonato Estadual Sub-21", season: 2026, event_date: "2026-08-09", location: "Arena Ibirapuera — São Paulo/SP", circuit_round: null, fee_amount: 90, status: "open", category_count: 24, entry_count: 310 },
  { id: "t-187", federation_id: "", name: "Copa Interior 2026 — 1ª Etapa", season: 2026, event_date: "2026-05-24", location: "Ginásio Municipal — Jacareí/SP", circuit_round: 1, fee_amount: 60, status: "done", category_count: 16, entry_count: 128 },
  { id: "t-176", federation_id: "", name: "Festival Kata Infantil", season: 2026, event_date: "2026-06-28", location: "Centro Esportivo — São José dos Campos/SP", circuit_round: null, fee_amount: 0, status: "draft", category_count: 6, entry_count: 0 },
];

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
  const [items, setItems] = useState<Competition[]>(MOCK_COMPETITIONS);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await karateCompetitionsApi.listCompetitions(federationId, { season: new Date().getFullYear() });
      if (res?.data?.length) setItems(res.data);
    } catch {
      // [MOCK fallback] mantém o seed
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={KarateColors.primary} />}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Circuito {new Date().getFullYear()}</Text>
          <Text style={styles.title}>Competições</Text>
        </View>
        <KarateButton label="Criar torneio" variant="primary" size="md" onPress={() => setShowCreate(true)} />
      </View>

      <KPIStrip kpis={kpis} />

      <Text style={styles.sectionTitle}>Torneios</Text>
      {items.length === 0 ? (
        <EmptyState icon="trophy-outline" title="Nenhum torneio ainda" subtitle="Crie o primeiro torneio da temporada." />
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

      <CriarTorneioModal visible={showCreate} onClose={() => setShowCreate(false)} federationId={federationId} onCreated={load} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 14, paddingBottom: 40 } as ViewStyle,
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, color: KarateColors.primary, textTransform: "uppercase" } as TextStyle,
  title: { fontSize: 24, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  sectionTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink, marginTop: 4 } as TextStyle,
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 6 } as ViewStyle,
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 } as ViewStyle,
  cardName: { flex: 1, fontSize: 15, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 } as ViewStyle,
  meta: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  statsRow: { flexDirection: "row", gap: 18, marginTop: 4 } as ViewStyle,
  stat: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  statNum: { fontSize: 13, fontWeight: "800", color: KarateColors.ink, fontFamily: "monospace" } as TextStyle,
});
