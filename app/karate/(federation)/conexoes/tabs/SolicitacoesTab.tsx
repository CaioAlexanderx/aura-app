// ============================================================
// SolicitacoesTab — aba "Solicitações" — Aura Karatê (federação) · Shoji
// (H3 — fila de solicitações de praticante em Conexões)
//
// Smartform pronto: a solicitação chega COMPLETA do sensei. A federação
// só CONFERE + NUMERA + aprova (1 clique) — nunca redigita do zero. Aba
// PRINCIPAL nova de Conexões (irmã de ConexoesTab), deep-link
// ?tab=solicitacoes na tela pai (ver ../index.tsx).
//
// KPIs no topo (item 5 do pedido): pendentes / mais antiga há X dias /
// aguardando número FPKT — pra federação enxergar volume e urgência, e
// pra ninguém treinar invisível.
//
// Fila ordenada por URGÊNCIA (mais antiga primeiro) sempre — mesmo
// critério em qualquer filtro de status, não só em "pendente".
//
// Fonte única / sem estado duplicado: o detalhe (tela de decisão) faz as
// mutações e o router.back() traz de volta pra cá — useFocusEffect
// dispara um reload de verdade (fonte = servidor), nunca tentamos
// sincronizar duas cópias locais entre telas (a armadilha já mordeu 2x
// neste produto: "clique vira no-op").
//
// Condição de corrida: cada fetch carrega um id incremental; só a
// resposta MAIS RECENTE escreve no estado (mesmo padrão de CadastralTab).
// ============================================================
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View, Text, ScrollView, Pressable, RefreshControl,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP } from "@/constants/karateTheme";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { Skeleton } from "@/components/karate/Skeleton";
import { ShojiBackground, PageHead, Card, KpiBand, Chip, Avatar, Mono, Body } from "@/components/karate/shoji";
import {
  karateApi, PractitionerRequestAdminRow, PractitionerRequestMetrics, PractitionerRequestStatus,
} from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

const STATUS_FILTERS: { key: PractitionerRequestStatus | "todas"; label: string }[] = [
  { key: "pendente", label: "Pendentes" },
  { key: "aprovada", label: "Aprovadas" },
  { key: "rejeitada", label: "Rejeitadas" },
  { key: "todas", label: "Todas" },
];

const STATUS_VIEW: Record<PractitionerRequestStatus, { label: string; color: string; bg: string; icon: string }> = {
  pendente:  { label: "Pendente",  color: P.warn, bg: P.warnWash,  icon: "hourglass" },
  aprovada:  { label: "Aprovada",  color: P.ok,   bg: P.okWash,    icon: "checkmark-circle" },
  rejeitada: { label: "Rejeitada", color: P.red,  bg: P.redWash,   icon: "close-circle" },
};

function StatusPill({ status }: { status: PractitionerRequestStatus }) {
  const v = STATUS_VIEW[status];
  return (
    <View style={[st.statusPill, { backgroundColor: v.bg }]}>
      <Icon name={v.icon as any} size={11} color={v.color} />
      <Text style={[st.statusPillTxt, { color: v.color }]}>{v.label}</Text>
    </View>
  );
}

function diasLabel(dias: number | null): string {
  if (dias === null) return "—";
  if (dias <= 0) return "hoje";
  return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

export function SolicitacoesTab() {
  const router = useRouter();
  const { federationId } = useKarateFederation();

  const [rows, setRows] = useState<PractitionerRequestAdminRow[]>([]);
  const [metrics, setMetrics] = useState<PractitionerRequestMetrics | null>(null);
  const [statusFilter, setStatusFilter] = useState<PractitionerRequestStatus | "todas">("pendente");
  const [dojoFilter, setDojoFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Condição de corrida: só a resposta MAIS RECENTE escreve no estado.
  const reqIdRef = useRef(0);

  const load = useCallback(async (isRefresh = false) => {
    if (!federationId) return;
    const myReq = ++reqIdRef.current;
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const [listRes, metricsRes] = await Promise.all([
        karateApi.listPractitionerRequestsAdmin(federationId, {
          status: statusFilter === "todas" ? undefined : statusFilter,
        }),
        karateApi.getPractitionerRequestMetrics(federationId),
      ]);
      if (myReq !== reqIdRef.current) return; // resposta obsoleta — descarta
      // Urgência: mais antiga primeiro, sempre — mesmo critério em
      // qualquer filtro de status (não só pendente).
      const sorted = [...(listRes.data || [])].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setRows(sorted);
      setMetrics(metricsRes);
    } catch {
      if (myReq !== reqIdRef.current) return;
      setError(true);
    } finally {
      if (myReq === reqIdRef.current) {
        isRefresh ? setRefreshing(false) : setLoading(false);
      }
    }
  }, [federationId, statusFilter]);

  // useFocusEffect dispara no mount E toda vez que a aba volta ao foco
  // (ex.: voltando da tela de decisão depois de aprovar/rejeitar) — fonte
  // única: sempre refaz a busca no servidor, nunca tenta sincronizar duas
  // cópias locais entre telas.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Dojôs disponíveis pra filtrar — derivado do que está CARREGADO agora
  // (nunca uma lista paralela que pode divergir da fila visível).
  const dojoOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.dojo_id) map.set(r.dojo_id, r.dojo_name || "Dojô sem nome");
    }
    return Array.from(map.entries()).map(([dojo_id, dojo_nome]) => ({ dojo_id, dojo_nome }));
  }, [rows]);

  const visibleRows = useMemo(
    () => (dojoFilter ? rows.filter((r) => r.dojo_id === dojoFilter) : rows),
    [rows, dojoFilter]
  );

  const kpiItems = useMemo(() => ([
    { label: "Pendentes", value: metrics?.pendentes ?? 0 },
    { label: "Mais antiga", value: metrics?.mais_antiga ? diasLabel(metrics.mais_antiga.dias) : "—" },
    { label: "Aguardando número FPKT", value: metrics?.aguardando_numero_fpkt ?? 0 },
  ]), [metrics]);

  if (error) return <ShojiBackground><KarateErrorState onRetry={() => load()} /></ShojiBackground>;

  return (
    <ShojiBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={P.red} />}
      >
        <PageHead
          title="Solicitações"
          sub="Fila de solicitações de praticante vindas dos dojôs. Confira, atribua o número FPKT e aprove — a ficha já chega completa."
        />

        {loading && !metrics ? (
          <Skeleton height={100} style={{ marginTop: 16, marginBottom: 16, borderRadius: R.xl }} />
        ) : (
          <KpiBand items={kpiItems} style={{ marginTop: 16, marginBottom: 16 }} />
        )}

        <View style={st.filtersRow}>
          {STATUS_FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={f.label}
              active={statusFilter === f.key}
              onPress={() => setStatusFilter(f.key)}
              accessibilityLabel={`Filtrar por ${f.label}`}
            />
          ))}
        </View>

        {dojoOptions.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <View style={st.filtersRow}>
              <Chip label="Todos os dojôs" active={!dojoFilter} onPress={() => setDojoFilter(null)} />
              {dojoOptions.map((d) => (
                <Chip
                  key={d.dojo_id}
                  label={d.dojo_nome}
                  active={dojoFilter === d.dojo_id}
                  onPress={() => setDojoFilter(d.dojo_id)}
                />
              ))}
            </View>
          </ScrollView>
        )}

        <View style={{ marginTop: 16 }}>
          {loading ? (
            <><Skeleton height={72} style={{ marginBottom: 10, borderRadius: R.lg }} /><Skeleton height={72} style={{ marginBottom: 10, borderRadius: R.lg }} /><Skeleton height={72} style={{ borderRadius: R.lg }} /></>
          ) : visibleRows.length === 0 ? (
            <Card><KarateEmptyState icon="clipboard" title="Nenhuma solicitação aqui" subtitle="Quando um dojô enviar uma solicitação de praticante, ela aparece nesta fila." style={{ paddingVertical: 28 }} /></Card>
          ) : (
            visibleRows.map((r) => {
              const matchCount = r.possible_matches?.length ?? 0;
              const ageDays = Math.max(0, Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000));
              return (
                <Pressable
                  key={r.id}
                  onPress={() => router.push(`/karate/conexoes/solicitacoes/${r.id}` as any)}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver solicitação de ${r.full_name}`}
                >
                  <Card style={{ marginBottom: 10 }}>
                    <View style={st.rowTop}>
                      <Avatar name={r.full_name} size={36} />
                      <View style={{ flex: 1, minWidth: 160 }}>
                        <Text style={st.name} numberOfLines={1}>{r.full_name}</Text>
                        <View style={st.nameMetaRow}>
                          <Body muted style={{ fontSize: 11.5 }} numberOfLines={1}>{r.dojo_name || "Dojô sem nome"}</Body>
                          {r.status === "pendente" && (
                            <View style={st.waitChip}>
                              <Icon name="time-outline" size={10} color={C.ink2} />
                              <Mono style={st.waitChipText}>{diasLabel(ageDays)}</Mono>
                            </View>
                          )}
                        </View>
                      </View>
                      <StatusPill status={r.status} />
                      <Icon name="chevron-forward" size={16} color={C.ink4} />
                    </View>
                    <View style={st.rowMeta}>
                      <View style={st.metaItem}>
                        <Icon name="ribbon" size={12} color={C.ink3} />
                        <Text style={st.metaTxt}>{r.claimed_belt ? `Faixa alegada: ${r.claimed_belt}` : "Faixa não alegada"}</Text>
                      </View>
                      <View style={st.metaItem}>
                        <Icon name="barcode" size={12} color={C.ink3} />
                        <Mono style={st.metaTxt}>{r.fpkt_number_claimed || "Não tem número FPKT"}</Mono>
                      </View>
                      {matchCount > 0 && (
                        <View style={st.metaItem}>
                          <Icon name="alert-circle" size={12} color={P.warn} />
                          <Text style={[st.metaTxt, { color: P.warn, fontWeight: "600" }]}>
                            {matchCount} possível{matchCount > 1 ? "is" : ""} correspondência{matchCount > 1 ? "s" : ""}
                          </Text>
                        </View>
                      )}
                    </View>
                  </Card>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </ShojiBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 40, paddingTop: 48, paddingBottom: 72, maxWidth: SP.contentMax, width: "100%", alignSelf: "center" } as ViewStyle,
});

const st = StyleSheet.create({
  filtersRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  rowTop: { flexDirection: "row", alignItems: "center", gap: 12 } as ViewStyle,
  rowMeta: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line } as ViewStyle,
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 } as ViewStyle,
  metaTxt: { fontFamily: F.body, fontSize: 12, color: C.ink3 } as TextStyle,
  name: { fontFamily: F.body, fontSize: 14, fontWeight: "600", color: C.ink } as TextStyle,
  nameMetaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 2 } as ViewStyle,
  waitChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.bg2, borderRadius: R.pill, paddingVertical: 2, paddingHorizontal: 7 } as ViewStyle,
  waitChipText: { fontSize: 10.5, color: C.ink2, fontWeight: "600" } as TextStyle,
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 9, borderRadius: R.pill, alignSelf: "flex-start" } as ViewStyle,
  statusPillTxt: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700" } as TextStyle,
});
