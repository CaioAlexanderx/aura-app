// ============================================================
// Dashboard — Aura Karatê
//
// Track P additions (additive):
//   — AlertStrip: alerts[] do backend (overdue, pending connections, etc)
//   — SearchBar: busca debounced de dojôs + praticantes
//   — NotificationsPanel: painel colapsável com events recentes
//
// Wired ao endpoint GET /federation/{id}/dashboard.
// MOCK: dados estáticos enquanto o backend não estiver pronto
// (shape fiel ao contrato karate-fase0-openapi.yaml).
// ============================================================
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  FlatList,
  Animated,
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
import {
  karateApi,
  DashboardPayload,
  OverdueDojo,
  UpcomingEvent,
  DashboardAlert,
  NotificationItem,
  SearchDojoResult,
  SearchPractitionerResult,
} from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

// — MOCK DATA (shape = contrato OpenAPI) —
// TODO: remover quando backend estiver pronto
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
  alerts: [],
};

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={st.sectionTitle}>{children}</Text>;
}

// ── AlertStrip (Track P) ───────────────────────────────────────
const ALERT_BG: Record<string, string> = {
  danger: "#FEF2F2",
  warn: "#FFFBEB",
  info: "#EFF6FF",
};
const ALERT_BORDER: Record<string, string> = {
  danger: "#FCA5A5",
  warn: "#FCD34D",
  info: "#93C5FD",
};
const ALERT_TEXT: Record<string, string> = {
  danger: "#991B1B",
  warn: "#92400E",
  info: "#1E40AF",
};
const ALERT_ICON: Record<string, "alert-circle" | "warning" | "information-circle"> = {
  danger: "alert-circle",
  warn: "warning",
  info: "information-circle",
};

function AlertRow({ alert, onPress }: { alert: DashboardAlert; onPress?: () => void }) {
  const sev = alert.severity || "info";
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={[
        st.alertRow,
        {
          backgroundColor: ALERT_BG[sev] || ALERT_BG.info,
          borderColor: ALERT_BORDER[sev] || ALERT_BORDER.info,
        },
      ]}
      accessibilityLabel={alert.title}
    >
      <Ionicons
        name={ALERT_ICON[sev] || "information-circle"}
        size={16}
        color={ALERT_TEXT[sev] || ALERT_TEXT.info}
        style={{ marginRight: 8, flexShrink: 0 }}
      />
      <Text style={[st.alertTitle, { color: ALERT_TEXT[sev] || ALERT_TEXT.info, flex: 1 }]}>
        {alert.title}
      </Text>
      {alert.action_path && (
        <Ionicons name="chevron-forward" size={14} color={ALERT_TEXT[sev] || ALERT_TEXT.info} />
      )}
    </TouchableOpacity>
  );
}

function AlertStrip({ alerts }: { alerts: DashboardAlert[] }) {
  const router = useRouter();
  if (!alerts || alerts.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      {alerts.map((a) => (
        <AlertRow
          key={a.type}
          alert={a}
          onPress={a.action_path ? () => router.push(a.action_path as any) : undefined}
        />
      ))}
    </View>
  );
}

// ── SearchBar (Track P) ────────────────────────────────────────
function SearchBar({ federationId }: { federationId: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ dojos: SearchDojoResult[]; practitioners: SearchPractitionerResult[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(
    async (query: string) => {
      if (query.length < 2) { setResults(null); return; }
      setSearching(true);
      try {
        const res = await karateApi.search(federationId, query);
        setResults(res);
      } catch (_) {
        setResults(null);
      } finally {
        setSearching(false);
      }
    },
    [federationId]
  );

  const handleChange = (text: string) => {
    setQ(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(text), 300);
  };

  const clearSearch = () => {
    setQ("");
    setResults(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const totalResults =
    (results?.dojos.length || 0) + (results?.practitioners.length || 0);

  return (
    <View style={{ marginBottom: 4 }}>
      <View style={st.searchBox}>
        <Ionicons name="search" size={16} color={KarateColors.ink3} style={{ marginRight: 8 }} />
        <TextInput
          style={st.searchInput}
          placeholder="Buscar dojôs ou praticantes..."
          placeholderTextColor={KarateColors.ink4}
          value={q}
          onChangeText={handleChange}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Busca rápida"
        />
        {q.length > 0 && (
          <TouchableOpacity onPress={clearSearch} accessibilityLabel="Limpar busca">
            <Ionicons name="close-circle" size={16} color={KarateColors.ink4} />
          </TouchableOpacity>
        )}
      </View>

      {/* Resultados */}
      {results && q.length >= 2 && (
        <View style={st.searchDropdown}>
          {totalResults === 0 ? (
            <Text style={st.searchEmpty}>Nenhum resultado para "{q}"</Text>
          ) : (
            <>
              {results.dojos.map((d) => (
                <TouchableOpacity
                  key={`dojo-${d.id}`}
                  style={st.searchResultRow}
                  onPress={() => { clearSearch(); router.push(`/karate/dojos/${d.id}` as any); }}
                  accessibilityLabel={`Dojô ${d.name}`}
                >
                  <Ionicons name="business" size={14} color={KarateColors.primary} style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.searchResultTitle} numberOfLines={1}>{d.name}</Text>
                    <Text style={st.searchResultSub}>
                      {d.fpkt_affiliation_id || ""}{d.region ? ` · ${d.region}` : ""}
                    </Text>
                  </View>
                  <Text style={st.searchResultBadge}>{d.practitioner_count} praticantes</Text>
                </TouchableOpacity>
              ))}
              {results.practitioners.map((p) => (
                <TouchableOpacity
                  key={`pract-${p.id}`}
                  style={st.searchResultRow}
                  onPress={() => { clearSearch(); router.push(`/karate/praticantes/${p.id}` as any); }}
                  accessibilityLabel={`Praticante ${p.full_name}`}
                >
                  <Ionicons name="person" size={14} color={KarateColors.ink3} style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.searchResultTitle} numberOfLines={1}>{p.full_name}</Text>
                    <Text style={st.searchResultSub}>
                      {p.karate_registration_number || ""}{p.dojo_name ? ` · ${p.dojo_name}` : ""}
                    </Text>
                  </View>
                  {p.belt_name && <Text style={st.searchResultBadge}>{p.belt_name}</Text>}
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
}

// ── NotificationsPanel (Track P) ──────────────────────────────
const NOTIF_ICON: Record<string, string> = {
  pending_connection: "link",
  sync_failure: "sync",
  reminder_sent: "mail",
  reminder_error: "mail-unread",
};

function NotifRow({ item }: { item: NotificationItem }) {
  const dateStr = item.created_at
    ? new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";
  const iconName = (NOTIF_ICON[item.type] || "notifications") as any;
  const dotColor = item.severity === "danger" ? "#EF4444"
                 : item.severity === "warn"   ? "#F59E0B"
                 : "#60A5FA";
  return (
    <View style={st.notifRow} accessibilityLabel={item.title}>
      <View style={[st.notifDot, { backgroundColor: dotColor }]} />
      <View style={{ flex: 1 }}>
        <Text style={st.notifTitle} numberOfLines={2}>{item.title}</Text>
        {item.detail && <Text style={st.notifDetail} numberOfLines={1}>{item.detail}</Text>}
        <Text style={st.notifDate}>{dateStr}</Text>
      </View>
    </View>
  );
}

function NotificationsPanel({ federationId }: { federationId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (loaded) return;
    try {
      const res = await karateApi.getNotifications(federationId, 10);
      setItems(res.items || []);
    } catch (_) {
      // Graceful: keep empty
    } finally {
      setLoaded(true);
    }
  }, [federationId, loaded]);

  const toggle = () => {
    if (!expanded && !loaded) load();
    setExpanded((e) => !e);
  };

  return (
    <View style={st.card}>
      <TouchableOpacity
        onPress={toggle}
        style={st.notifHeader}
        accessibilityLabel={expanded ? "Recolher notificações" : "Ver notificações"}
      >
        <Ionicons name="notifications-outline" size={16} color={KarateColors.ink2} style={{ marginRight: 8 }} />
        <Text style={st.notifHeaderText}>Notificações</Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={14}
          color={KarateColors.ink4}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={{ marginTop: 8, gap: 4 }}>
          {!loaded ? (
            [1, 2, 3].map((k) => <Skeleton key={k} height={40} style={{ marginBottom: 4 }} />)
          ) : items.length === 0 ? (
            <KarateEmptyState
              icon="checkmark-circle-outline"
              title="Nenhuma notificação recente"
              style={{ paddingVertical: 16 }}
            />
          ) : (
            items.map((item) => <NotifRow key={item.id} item={item} />)
          )}
        </View>
      )}
    </View>
  );
}

// ── Existing row components (unchanged) ───────────────────────────────
function OverdueRow({ dojo }: { dojo: OverdueDojo }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={st.overdueRow}
      onPress={() => router.push(`/karate/dojos/${dojo.dojo_id}` as any)}
      accessibilityLabel={`${dojo.name}, ${formatCurrency(dojo.amount)}, ${dojo.days_overdue} dias em atraso`}
    >
      <View style={{ flex: 1 }}>
        <Text style={st.overdueName}>{dojo.name}</Text>
        <Text style={st.overdueDays}>{dojo.days_overdue}d em atraso</Text>
      </View>
      <Text style={st.overdueAmount}>{formatCurrency(dojo.amount)}</Text>
      <Ionicons name="chevron-forward" size={14} color={KarateColors.ink4} />
    </TouchableOpacity>
  );
}

function EventRow({ event }: { event: UpcomingEvent }) {
  const date = new Date(event.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return (
    <View style={st.eventRow} accessibilityLabel={`${event.title}, ${date}, ${event.location}`}>
      <View style={st.eventDateBox}>
        <Text style={st.eventDate}>{date}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.eventTitle}>{event.title}</Text>
        <Text style={st.eventSub}>{event.location} · {event.registered_count} inscritos</Text>
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────
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
    { label: "Inadimplência", value: formatPercent(data.kpis.overdue_rate), accent: data.kpis.overdue_rate > 0.1 ? "danger" : "warn" },
  ] : [];

  return (
    <ScrollView
      style={st.screen}
      contentContainerStyle={st.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={KarateColors.primary} />}
      keyboardShouldPersistTaps="handled"
    >
      {/* Track P: Busca rápida */}
      <SearchBar federationId={federationId} />

      {/* Track P: Alertas (badges de atenção derivados do dashboard) */}
      {!loading && data?.alerts && data.alerts.length > 0 && (
        <AlertStrip alerts={data.alerts} />
      )}

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
      <View style={st.card}>
        {loading ? (
          [1,2,3].map((k) => <Skeleton key={k} height={20} style={{ marginBottom: 8 }} />)
        ) : (
          data?.belt_distribution.map((b) => (
            <View key={b.belt_level} style={st.beltRow} accessibilityLabel={`${b.belt_name}: ${b.count} praticantes`}>
              <View style={[st.beltDot, { backgroundColor: getBeltColor(b.belt_level) }]} />
              <Text style={st.beltName}>{b.belt_name}</Text>
              <Text style={st.beltCount}>{b.count}</Text>
            </View>
          ))
        )}
      </View>

      {/* Agenda */}
      <SectionTitle>Próximos Eventos</SectionTitle>
      <View style={st.card}>
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
      <View style={st.card}>
        {loading ? (
          <Skeleton height={60} />
        ) : data?.overdue_dojos.length === 0 ? (
          <KarateEmptyState icon="checkmark-circle-outline" title="Nenhum devedor" style={{ paddingVertical: 24 }} />
        ) : (
          data?.overdue_dojos.map((d) => <OverdueRow key={d.dojo_id} dojo={d} />)
        )}
      </View>

      {/* Track P: Notificações (colapsável) */}
      <SectionTitle>Notificações</SectionTitle>
      <NotificationsPanel federationId={federationId} />
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

// StyleSheet.create — TODOS os valores são objetos (sem strings/cores soltas no top-level)
// para evitar o WeakMap pitfall (aura-app armadilha 08/06).
const st = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content:      { padding: 16, gap: 8, paddingBottom: 32 } as ViewStyle,
  sectionTitle: { fontSize: 11, fontWeight: "800", color: KarateColors.ink3, letterSpacing: 1.2, textTransform: "uppercase", marginTop: 16, marginBottom: 6 } as TextStyle,
  card:         { backgroundColor: "#fff", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 12, gap: 8 } as ViewStyle,

  // Alert
  alertRow:   { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: KarateRadius.sm, borderWidth: 1 } as ViewStyle,
  alertTitle: { fontSize: 13, fontWeight: "600" } as TextStyle,

  // Search
  searchBox:         { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, paddingHorizontal: 12, paddingVertical: 8 } as ViewStyle,
  searchInput:       { flex: 1, fontSize: 14, color: KarateColors.ink, outlineStyle: "none" } as any,
  searchDropdown:    { backgroundColor: "#fff", borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, marginTop: 4, overflow: "hidden" } as ViewStyle,
  searchResultRow:   { flexDirection: "row", alignItems: "center", padding: 10, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  searchResultTitle: { fontSize: 13, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  searchResultSub:   { fontSize: 11, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  searchResultBadge: { fontSize: 11, color: KarateColors.ink4, marginLeft: 8 } as TextStyle,
  searchEmpty:       { padding: 12, fontSize: 13, color: KarateColors.ink3, textAlign: "center" } as TextStyle,

  // Belt dist
  beltRow:   { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  beltDot:   { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" } as ViewStyle,
  beltName:  { flex: 1, fontSize: 13, color: KarateColors.ink2 } as TextStyle,
  beltCount: { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,

  // Overdue
  overdueRow:    { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 } as ViewStyle,
  overdueName:   { fontSize: 13, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  overdueDays:   { fontSize: 11, color: KarateColors.danger } as TextStyle,
  overdueAmount: { fontSize: 14, fontWeight: "700", color: KarateColors.danger } as TextStyle,

  // Events
  eventRow:    { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 4 } as ViewStyle,
  eventDateBox: { width: 44, height: 44, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.primarySoft, alignItems: "center", justifyContent: "center" } as ViewStyle,
  eventDate:   { fontSize: 11, fontWeight: "800", color: KarateColors.primary, textAlign: "center" } as TextStyle,
  eventTitle:  { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  eventSub:    { fontSize: 11, color: KarateColors.ink3, marginTop: 2 } as TextStyle,

  // Notifications
  notifHeader:     { flexDirection: "row", alignItems: "center" } as ViewStyle,
  notifHeaderText: { flex: 1, fontSize: 13, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
  notifRow:        { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  notifDot:        { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 } as ViewStyle,
  notifTitle:      { fontSize: 13, color: KarateColors.ink, fontWeight: "500" } as TextStyle,
  notifDetail:     { fontSize: 11, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  notifDate:       { fontSize: 10, color: KarateColors.ink4, marginTop: 2 } as TextStyle,
});
