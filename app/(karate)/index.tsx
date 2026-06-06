// ============================================================
// Dashboard — Aura Karatê
//
// KPIs consolidados, distribuição de faixas, agenda próxima
// e devedores. Wired ao endpoint GET /federation/{id}/dashboard.
// MOCK: dados estáticos enquanto o backend não estiver pronto
// (shape fiel ao contrato karate-fase0-openapi.yaml).
// ============================================================
import React, { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { KarateColors, KarateRadius, ShojiPalette } from "@/constants/karateTheme";
import { KPIStrip, KPIData } from "@/components/karate/KPIStrip";
import { Badge } from "@/components/karate/Badge";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { karateApi, DashboardPayload, OverdueDojo, UpcomingEvent } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

// — MOCK DATA (shape = contrato OpenAPI) —
// TODO: remover quando backend estiver respondendo
const MOCK_DASHBOARD: DashboardPayload = {
  kpis: {
    dojo_count: 47,
    practitioner_count: 1284,
    revenue_ytd: 182400.0,
    overdue_rate: 0.08,
  },
  upcoming_events: [
    { title: "Campeonato Estadual", date: "2026-07-12", location: "Gynásio Central SP", registered_count: 312 },
    { title: "Exame de Faixas FPKT", date: "2026-07-28", location: "Dojô Sede", registered_count: 84 },
  ],
  overdue_dojos: [
    { dojo_id: "d1", name: "Dojô Shotokan ABC", amount: 1200, days_overdue: 45 },
    { dojo_id: "d2", name: "Dojô Karatê Esperança", amount: 600, days_overdue: 12 },
  ],
  belt_distribution: [
    { belt_level: "branca",      belt_name: "Branca",      count: 320 },
    { belt_level: "amarela",     belt_name: "Amarela",     count: 210 },
    { belt_level: "laranja",     belt_name: "Laranja",     count: 180 },
    { belt_level: "verde",       belt_name: "Verde",       count: 145 },
    { belt_level: "azul_claro",  belt_name: "Azul Claro",  count: 120 },
    { belt_level: "azul_escuro", belt_name: "Azul Escuro", count: 98 },
    { belt_level: "marrom",      belt_name: "Marrom",      count: 87 },
    { belt_level: "preta",       belt_name: "Preta",       count: 124 },
  ],
};

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function OverdueRow({ dojo }: { dojo: OverdueDojo }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={styles.overdueRow}
      onPress={() => router.push(`/(karate)/dojos/${dojo.dojo_id}` as any)}
      accessibilityLabel={`${dojo.name}, ${formatCurrency(dojo.amount)}, ${dojo.days_overdue} dias em atraso`}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.overdueName}>{dojo.name}</Text>
        <Text style={styles.overdueDays}>{dojo.days_overdue}d em atraso</Text>
      </View>
      <Text style={styles.overdueAmount}>{formatCurrency(dojo.amount)}</Text>
      <Ionicons name="chevron-forward" size={14} color={KarateColors.ink4} />
    </TouchableOpacity>
  );
}

function EventRow({ event }: { event: UpcomingEvent }) {
  const date = new Date(event.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return (
    <View style={styles.eventRow} accessibilityLabel={`${event.title}, ${date}, ${event.location}`}>
      <View style={styles.eventDateBox}>
        <Text style={styles.eventDate}>{date}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.eventTitle}>{event.title}</Text>
        <Text style={styles.eventSub}>{event.location} · {event.registered_count} inscritos</Text>
      </View>
    </View>
  );
}

export default function KarateDashboard() {
  const { federationId } = useKarateFederation();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      // TODO: remover fallback MOCK quando backend estiver pronto
      const result = await karateApi.getDashboard(federationId).catch(() => MOCK_DASHBOARD);
      setData(result);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  const kpis: KPIData[] = data ? [
    { label: "Dojôs",       value: data.kpis.dojo_count,        accent: "primary" },
    { label: "Praticantes", value: data.kpis.practitioner_count, accent: "ok" },
    { label: "Receita YTD", value: formatCurrency(data.kpis.revenue_ytd), accent: "ok" },
    { label: "Inadimplência",value: formatPercent(data.kpis.overdue_rate), accent: data.kpis.overdue_rate > 0.1 ? "danger" : "warn" },
  ] : [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={KarateColors.primary} />}
    >
      {/* KPIs */}
      <SectionTitle>Visão Geral</SectionTitle>
      {loading ? (
        <View style={{ gap: 8 }}>
          <Skeleton height={80} />
        </View>
      ) : (
        <KPIStrip kpis={kpis} />
      )}

      {/* Distribuição de Faixas */}
      <SectionTitle>Distribuição de Faixas</SectionTitle>
      <View style={styles.card}>
        {loading ? (
          [1,2,3].map((k) => <Skeleton key={k} height={20} style={{ marginBottom: 8 }} />)
        ) : (
          data?.belt_distribution.map((b) => (
            <View key={b.belt_level} style={styles.beltRow} accessibilityLabel={`${b.belt_name}: ${b.count} praticantes`}>
              <View style={[styles.beltDot, { backgroundColor: getBeltColor(b.belt_level) }]} />
              <Text style={styles.beltName}>{b.belt_name}</Text>
              <Text style={styles.beltCount}>{b.count}</Text>
            </View>
          ))
        )}
      </View>

      {/* Agenda */}
      <SectionTitle>Próximos Eventos</SectionTitle>
      <View style={styles.card}>
        {loading ? (
          <Skeleton height={60} />
        ) : data?.upcoming_events.length === 0 ? (
          <KarateEmptyState icon="calendar-outline" title="Sem eventos próximos" style={{ paddingVertical: 24 }} />
        ) : (
          data?.upcoming_events.map((ev, i) => <EventRow key={i} event={ev} />)
        )}
      </View>

      {/* Devedores */}
      <SectionTitle>Dojôs com Pendências</SectionTitle>
      <View style={styles.card}>
        {loading ? (
          <Skeleton height={60} />
        ) : data?.overdue_dojos.length === 0 ? (
          <KarateEmptyState icon="checkmark-circle-outline" title="Nenhum devedor" style={{ paddingVertical: 24 }} />
        ) : (
          data?.overdue_dojos.map((d) => <OverdueRow key={d.dojo_id} dojo={d} />)
        )}
      </View>
    </ScrollView>
  );
}

// helper de cor de faixa (mapa simples, sem import circular)
const BELT_COLORS: Record<string, string> = {
  branca: "#FFFFFF", amarela: "#F4C430", laranja: "#E8772E",
  verde: "#2E8B57", azul_claro: "#5BA7D6", roxo: "#6B4C9A",
  azul_escuro: "#1E3A8A", vermelha: "#C0392B", marrom: "#6B4226", preta: "#1C1714",
};
function getBeltColor(level: string) { return BELT_COLORS[level] ?? KarateColors.neutral; }

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content:      { padding: 16, gap: 8, paddingBottom: 32 } as ViewStyle,
  sectionTitle: { fontSize: 11, fontWeight: "800", color: KarateColors.ink3, letterSpacing: 1.2, textTransform: "uppercase", marginTop: 16, marginBottom: 6 } as TextStyle,
  card:         { backgroundColor: "#fff", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 12, gap: 8 } as ViewStyle,

  beltRow:   { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  beltDot:   { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" } as ViewStyle,
  beltName:  { flex: 1, fontSize: 13, color: KarateColors.ink2 } as TextStyle,
  beltCount: { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,

  overdueRow:    { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 } as ViewStyle,
  overdueName:   { fontSize: 13, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  overdueDays:   { fontSize: 11, color: KarateColors.danger } as TextStyle,
  overdueAmount: { fontSize: 14, fontWeight: "700", color: KarateColors.danger } as TextStyle,

  eventRow:    { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 4 } as ViewStyle,
  eventDateBox:{ width: 44, height: 44, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.primarySoft, alignItems: "center", justifyContent: "center" } as ViewStyle,
  eventDate:   { fontSize: 11, fontWeight: "800", color: KarateColors.primary, textAlign: "center" } as TextStyle,
  eventTitle:  { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  eventSub:    { fontSize: 11, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
});
