// ============================================================
// Painel — Aura Karatê (federação) · Re-skin Shoji (D0 prova)
//
// Fiel ao pane "dashboard" do standalone v5 Shoji, usando o kit
// @/components/karate/shoji. Dados reais via GET /federation/{id}/dashboard.
//
// NOTA (D0): a busca rápida e o painel de notificações do Track P foram
// removidos NESTA prova visual; serão reintroduzidos estilizados na D1.
//
// Empty state: quando a federação está vazia (0 dojôs e 0 praticantes),
// mostramos boas-vindas com ação primária "Importar planilha".
//
// C6: o card "Praticantes por graduação" reflete só a graduação ATIVA —
// a Vermelha é histórica (a federação não usa mais) e fica fora dos
// gráficos/relatórios (continua no histórico do praticante, Trajetória).
// As barras saem ordenadas pela hierarquia oficial (beltRank).
// ============================================================
import React, { useEffect, useState, useCallback } from "react";
import {
  ScrollView, View, Text, RefreshControl, TouchableOpacity,
  useWindowDimensions, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP, resolveBeltKey, KarateBelts, beltRank, isActiveBelt } from "@/constants/karateTheme";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import {
  ShojiBackground, PageHead, SectionHead, Card, KpiBand, BarRow, Alert,
  ShojiButton, Body, Mono,
} from "@/components/karate/shoji";
import { karateApi, DashboardPayload, OverdueDojo, UpcomingEvent, DashboardAlert } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtPct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const beltColor = (lvl: string) => { const k = resolveBeltKey(lvl); return k ? KarateBelts[k].color : C.ink3; };

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function KaratePainel() {
  const { federationId, federationName } = useKarateFederation();
  const { width } = useWindowDimensions();
  const twoCol = width >= 900;
  const router = useRouter();

  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      setData(await karateApi.getDashboard(federationId));
    } catch { setError(true); }
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  if (error) {
    return <ShojiBackground><KarateErrorState onRetry={() => load()} /></ShojiBackground>;
  }

  const now = new Date();
  const events = data?.upcoming_events ?? [];
  const overdue = data?.overdue_dojos ?? [];
  // C6: graduação ATIVA — exclui a Vermelha (histórica) e ordena pela
  // hierarquia oficial. O total/legenda e o max consideram só os exibidos.
  const belts = (data?.belt_distribution ?? [])
    .filter((b) => isActiveBelt(b.belt_level) && isActiveBelt(b.belt_name))
    .slice()
    .sort((a, b) => beltRank(a.belt_level || a.belt_name) - beltRank(b.belt_level || b.belt_name));
  const apiAlerts: DashboardAlert[] = (data as any)?.alerts ?? [];
  const beltTotal = belts.reduce((s, b) => s + b.count, 0);
  const beltMax = belts.reduce((m, b) => Math.max(m, b.count), 0) || 1;
  const overdueTotal = overdue.reduce((s, d) => s + d.amount, 0);
  // Federação vazia: sem dojôs E sem praticantes → tela de boas-vindas.
  const isEmpty = !loading && !!data && data.kpis.dojo_count === 0 && data.kpis.practitioner_count === 0;

  const pageHead = (
    <PageHead
      eyebrow={`Temporada ${now.getFullYear()} · ${MONTHS[now.getMonth()]}`}
      title="Painel"
      sub={`Indicadores de ${federationName || "sua federação"}.`}
      actions={isEmpty ? undefined : <ShojiButton label="Exportar" icon="download-outline" variant="ghost" onPress={() => {}} />}
    />
  );

  // ── Estado de boas-vindas (federação ainda sem dados) ──
  if (isEmpty) {
    return (
      <ShojiBackground>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={P.red} />}
        >
          {pageHead}
          <Card style={styles.welcome}>
            <View style={styles.welcomeIcon}>
              <Ionicons name="sparkles-outline" size={28} color={P.red} />
            </View>
            <Text style={styles.welcomeTitle}>Bem-vindo à {federationName || "sua federação"}</Text>
            <Body muted style={styles.welcomeSub}>
              Ainda não há dojôs nem praticantes por aqui. O jeito mais rápido de começar é importar
              a planilha consolidada da FPKT — as academias, os alunos e a trajetória de faixas entram de uma vez só.
            </Body>
            <View style={styles.welcomeActions}>
              <ShojiButton label="Importar planilha" icon="cloud-upload-outline" variant="sumi" onPress={() => router.push("/karate/importacao" as any)} />
              <ShojiButton label="Cadastrar dojô" icon="home-outline" variant="ghost" onPress={() => router.push("/karate/dojos" as any)} />
              <ShojiButton label="Cadastrar praticante" icon="person-add-outline" variant="ghost" onPress={() => router.push("/karate/praticantes" as any)} />
            </View>
          </Card>
        </ScrollView>
      </ShojiBackground>
    );
  }

  return (
    <ShojiBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={P.red} />}
      >
        {pageHead}

        {/* KPIs */}
        {loading ? (
          <Skeleton height={104} style={{ borderRadius: R.xl }} />
        ) : (
          <KpiBand items={[
            { label: "Dojôs filiados", value: data!.kpis.dojo_count },
            { label: "Praticantes", value: data!.kpis.practitioner_count.toLocaleString("pt-BR") },
            { label: "Receita YTD", value: fmtMoney(data!.kpis.revenue_ytd) },
            { label: "Inadimplência", value: fmtPct(data!.kpis.overdue_rate), accent: true, meta: overdue.length ? `${overdue.length} dojô(s) em atraso` : undefined },
          ]} />
        )}

        {/* Acompanhamento */}
        {!loading && (apiAlerts.length > 0 || overdue.length > 0 || events.length > 0) && (
          <View style={styles.section}>
            <SectionHead title="Acompanhamento" sub={`${apiAlerts.length || (overdue.length ? 1 : 0) + (events.length ? 1 : 0)} item(s) em observação`} />
            <View style={{ gap: 14 }}>
              {apiAlerts.length > 0
                ? apiAlerts.map((a) => (
                    <Alert key={a.type} urgent={a.severity === "danger"} title={a.title}
                      onPress={a.action_path ? () => router.push(a.action_path as any) : undefined} />
                  ))
                : (
                  <>
                    {overdue.length > 0 && (
                      <Alert urgent title={`${overdue.length} dojô(s) com anuidade em atraso`} desc={`${fmtMoney(overdueTotal)} em aberto.`} onPress={() => router.push("/karate/financeiro" as any)} />
                    )}
                    {events.length > 0 && (
                      <Alert title={`Próximo evento: ${events[0].title}`} desc={`${fmtDate(events[0].date)} · ${events[0].location}`} when={`${events[0].registered_count} inscritos`} onPress={() => router.push("/karate/eventos" as any)} />
                    )}
                  </>
                )}
            </View>
          </View>
        )}

        {/* Distribuição por graduação (ativa — Vermelha histórica fica de fora) */}
        <View style={styles.section}>
          <SectionHead title="Praticantes por graduação" sub={beltTotal > 0 ? `${beltTotal} praticantes graduados` : undefined} />
          <Card>
            {loading ? [1, 2, 3, 4].map((k) => <Skeleton key={k} height={18} style={{ marginBottom: 14 }} />)
              : belts.length === 0 ? <KarateEmptyState icon="podium-outline" title="Sem praticantes graduados" style={{ paddingVertical: 24 }} />
              : belts.map((b) => <BarRow key={b.belt_level} label={b.belt_name} value={b.count} max={beltMax} color={beltColor(b.belt_level)} />)}
          </Card>
        </View>

        {/* Próximos passos */}
        <View style={[styles.section, twoCol && styles.twoCol]}>
          <View style={twoCol ? styles.col : undefined}>
            <SectionHead title="Eventos federativos" />
            <Card flush>
              {loading ? <View style={{ padding: 18 }}><Skeleton height={60} /></View>
                : events.length === 0 ? <KarateEmptyState icon="calendar-outline" title="Sem eventos próximos" style={{ paddingVertical: 24 }} />
                : events.map((ev, i) => <EventRow key={i} ev={ev} last={i === events.length - 1} />)}
            </Card>
          </View>
          <View style={twoCol ? styles.col : { marginTop: twoCol ? 0 : 28 }}>
            <SectionHead title="Dojôs em atraso" />
            <Card flush>
              {loading ? <View style={{ padding: 18 }}><Skeleton height={60} /></View>
                : overdue.length === 0 ? <KarateEmptyState icon="checkmark-circle-outline" title="Nenhum dojô em atraso" style={{ paddingVertical: 24 }} />
                : overdue.map((d, i) => <OverdueRow key={d.dojo_id} d={d} last={i === overdue.length - 1} onPress={() => router.push(`/karate/dojos/${d.dojo_id}` as any)} />)}
            </Card>
          </View>
        </View>
      </ScrollView>
    </ShojiBackground>
  );
}

function EventRow({ ev, last }: { ev: UpcomingEvent; last?: boolean }) {
  return (
    <View style={[styles.row, last && styles.noBorder]}>
      <View style={styles.dateBox}><Mono style={{ color: P.red, fontSize: 11 }}>{fmtDate(ev.date)}</Mono></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{ev.title}</Text>
        <Body muted style={{ fontSize: 11.5, marginTop: 2 }} >{ev.location} · {ev.registered_count} inscritos</Body>
      </View>
    </View>
  );
}
function OverdueRow({ d, last, onPress }: { d: OverdueDojo; last?: boolean; onPress?: () => void }) {
  return (
    <TouchableOpacity style={[styles.row, last && styles.noBorder]} onPress={onPress} activeOpacity={0.8}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{d.name}</Text>
        <Text style={styles.rowDanger}>{d.days_overdue} dias em atraso</Text>
      </View>
      <Mono style={{ color: P.red, fontSize: 14 }}>{fmtMoney(d.amount)}</Mono>
      <Ionicons name="chevron-forward" size={14} color={C.ink4} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: { padding: 40, paddingTop: 48, paddingBottom: 80, maxWidth: SP.contentMax, width: "100%", alignSelf: "center" } as ViewStyle,
  section: { marginTop: SP[15] } as ViewStyle,
  twoCol: { flexDirection: "row", gap: 24 } as ViewStyle,
  col: { flex: 1 } as ViewStyle,
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 15, paddingHorizontal: 22, borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  noBorder: { borderBottomWidth: 0 } as ViewStyle,
  dateBox: { width: 54, paddingVertical: 7, borderRadius: R.sm, backgroundColor: P.redWash, alignItems: "center" } as ViewStyle,
  rowTitle: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: C.ink } as TextStyle,
  rowDanger: { fontFamily: F.body, fontSize: 11.5, color: P.red, marginTop: 2 } as TextStyle,
  // Empty state de boas-vindas
  welcome: { marginTop: SP[6], alignItems: "center", gap: 12, paddingVertical: 36, paddingHorizontal: 24 } as ViewStyle,
  welcomeIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: P.redWash, alignItems: "center", justifyContent: "center" } as ViewStyle,
  welcomeTitle: { fontFamily: F.heading, fontSize: 22, color: C.ink, textAlign: "center" } as TextStyle,
  welcomeSub: { fontSize: 13.5, textAlign: "center", maxWidth: 520, lineHeight: 20 } as TextStyle,
  welcomeActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 6 } as ViewStyle,
});
