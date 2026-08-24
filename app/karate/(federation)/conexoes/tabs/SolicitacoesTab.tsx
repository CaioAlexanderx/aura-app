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
//
// Lista e métricas falham de forma INDEPENDENTE (Promise.allSettled, não
// Promise.all): um 500 no GET da lista não pode derrubar a faixa de KPIs
// se as métricas responderam 200, e vice-versa — mesma separação de
// responsabilidade que ../index.tsx já usa pro badge de pendentes. Sem
// isso, a tela inteira caía em erro e a federação perdia até a
// informação que estava disponível.
//
// ── Lote (24/08/2026) — aprovação/rejeição EM MASSA ─────────
// QA 23/08 (dono do produto): "a aprovação tem 5 passos e é feita de um
// por um" — o envio do dojô já é em lote, a análise da federação não era.
// Modo de seleção na fila (só no filtro Pendentes) + revisão resumida
// INLINE (nunca <Modal> — RN Web renderiza Modal-dentro-de-Modal atrás
// da tela, já mordeu este produto 5x): nome, nascimento, faixa e dojô por
// linha, número FPKT digitado POR ITEM (continua obrigatório e emitido
// pela federação — lote não muda essa regra). Rejeição em massa com
// motivo compartilhado opcional. O backend processa item a item (cada um
// na própria transação) e devolve resposta ITEMIZADA — o que falha
// permanece pendente na fila com o motivo visível na tela de resultado.
// Solicitação com possíveis correspondências entra no lote AVISADA
// (chip âmbar + um toque para remover): o caminho individual continua
// sendo o lugar de decidir transferência — transferência nunca é em lote.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, ScrollView, Pressable, RefreshControl, TextInput,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Icon } from "@/components/Icon";
import { toast } from "@/components";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP } from "@/constants/karateTheme";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { Skeleton } from "@/components/karate/Skeleton";
import { ShojiBackground, PageHead, Card, KpiBand, Chip, Avatar, Mono, Body, ShojiButton } from "@/components/karate/shoji";
import {
  karateApi, PractitionerRequestAdminRow, PractitionerRequestMetrics, PractitionerRequestStatus,
  BatchResultItem,
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

// Data de NASCIMENTO é data pura (sem hora, sem fuso) — nunca passa por
// new Date(iso), que parseia UTC e volta um dia em UTC-3 (mesmo bugfix de
// 15/07/2026 da tela de decisão; elegibilidade infantil depende disso).
function fmtBirthDate(iso?: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (m) {
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y}`;
  }
  return String(iso);
}

// Estágios do fluxo em lote — inline no lugar da lista, um por vez
// (mesma disciplina de "só um estágio aberto" da tela de decisão).
type BatchStage = "none" | "approve" | "reject" | "result";

// Snapshot do que foi ENVIADO no lote — a tela de resultado renderiza a
// partir dele (nome/dojô por id), porque `rows` já terá sido recarregada
// da fonte e as aprovadas não estarão mais na fila pendente.
interface BatchSnapshotRow { id: string; full_name: string; dojo_name: string | null }

export function SolicitacoesTab() {
  const router = useRouter();
  const { federationId } = useKarateFederation();

  const [rows, setRows] = useState<PractitionerRequestAdminRow[]>([]);
  const [metrics, setMetrics] = useState<PractitionerRequestMetrics | null>(null);
  const [statusFilter, setStatusFilter] = useState<PractitionerRequestStatus | "todas">("pendente");
  const [dojoFilter, setDojoFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Erros independentes: a lista pode falhar sem derrubar os KPIs (e
  // vice-versa) — ver comentário de topo.
  const [listError, setListError] = useState(false);
  const [metricsError, setMetricsError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Lote: seleção múltipla + estágio inline ────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchStage, setBatchStage] = useState<BatchStage>("none");
  // Número FPKT digitado por solicitação (chave = request id).
  const [fpktByReq, setFpktByReq] = useState<Record<string, string>>({});
  const [batchReason, setBatchReason] = useState("");
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchResult, setBatchResult] = useState<{
    kind: "approve" | "reject";
    results: BatchResultItem[];
    okCount: number;
    failCount: number;
    snapshot: BatchSnapshotRow[];
  } | null>(null);

  // Condição de corrida: só a resposta MAIS RECENTE escreve no estado.
  const reqIdRef = useRef(0);

  const load = useCallback(async (isRefresh = false) => {
    if (!federationId) return;
    const myReq = ++reqIdRef.current;
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      // allSettled (não Promise.all): lista e métricas são chamadas
      // independentes — uma falhar não pode apagar o resultado da outra.
      const [listRes, metricsRes] = await Promise.allSettled([
        karateApi.listPractitionerRequestsAdmin(federationId, {
          status: statusFilter === "todas" ? undefined : statusFilter,
        }),
        karateApi.getPractitionerRequestMetrics(federationId),
      ]);
      if (myReq !== reqIdRef.current) return; // resposta obsoleta — descarta

      if (listRes.status === "fulfilled") {
        // Urgência: mais antiga primeiro, sempre — mesmo critério em
        // qualquer filtro de status (não só pendente).
        const sorted = [...(listRes.value.data || [])].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setRows(sorted);
        setListError(false);
      } else {
        setListError(true);
      }

      if (metricsRes.status === "fulfilled") {
        setMetrics(metricsRes.value);
        setMetricsError(false);
      } else {
        setMetricsError(true);
      }
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

  // Sair do modo de seleção zera TUDO do lote — nenhum estado fantasma
  // sobrevive pra próxima entrada.
  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
    setBatchStage("none");
    setFpktByReq({});
    setBatchReason("");
    setBatchResult(null);
  }, []);

  // Trocar de filtro no meio de uma seleção descarta a seleção — os ids
  // selecionados podem nem existir na nova lista.
  useEffect(() => { exitSelectMode(); }, [statusFilter, dojoFilter, exitSelectMode]);

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

  // Linhas do lote: interseção seleção × fila atual, só pendentes — se a
  // fila recarregou e uma selecionada sumiu/resolveu, ela cai daqui sozinha.
  const batchRows = useMemo(
    () => visibleRows.filter((r) => r.status === "pendente" && selected.has(r.id)),
    [visibleRows, selected]
  );

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const removeFromBatch = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelected(new Set(visibleRows.filter((r) => r.status === "pendente").map((r) => r.id)));
  }, [visibleRows]);

  // ── Validação do lote de aprovação (números por item) ──────
  const trimmedFpkt = useCallback((id: string) => (fpktByReq[id] || "").trim(), [fpktByReq]);
  const missingCount = useMemo(
    () => batchRows.filter((r) => !trimmedFpkt(r.id)).length,
    [batchRows, trimmedFpkt]
  );
  const duplicatedNumbers = useMemo(() => {
    const count = new Map<string, number>();
    for (const r of batchRows) {
      const n = trimmedFpkt(r.id);
      if (n) count.set(n, (count.get(n) || 0) + 1);
    }
    return new Set(Array.from(count.entries()).filter(([, c]) => c > 1).map(([n]) => n));
  }, [batchRows, trimmedFpkt]);
  const approveReady = batchRows.length > 0 && missingCount === 0 && duplicatedNumbers.size === 0;

  const openApproveStage = useCallback(() => {
    // Pré-preenche com o número ALEGADO pelo sensei quando houver — a
    // federação confere e pode sobrescrever; alegado nunca é autoritativo.
    setFpktByReq((prev) => {
      const next = { ...prev };
      for (const r of batchRows) {
        if (next[r.id] === undefined) next[r.id] = r.fpkt_number_claimed || "";
      }
      return next;
    });
    setBatchStage("approve");
  }, [batchRows]);

  const snapshotOf = useCallback((rowsToSend: PractitionerRequestAdminRow[]): BatchSnapshotRow[] =>
    rowsToSend.map((r) => ({ id: r.id, full_name: r.full_name, dojo_name: r.dojo_name })), []);

  const handleBatchApprove = useCallback(async () => {
    if (!approveReady || batchSubmitting) return;
    const toSend = batchRows;
    setBatchSubmitting(true);
    try {
      const res = await karateApi.batchApproveCreatePractitionerRequests(
        federationId,
        toSend.map((r) => ({ request_id: r.id, fpkt_number: trimmedFpkt(r.id) }))
      );
      setBatchResult({
        kind: "approve",
        results: res.results,
        okCount: res.approved,
        failCount: res.failed,
        snapshot: snapshotOf(toSend),
      });
      setBatchStage("result");
      toast.success(
        res.failed === 0
          ? `${res.approved} ${res.approved === 1 ? "solicitação aprovada" : "solicitações aprovadas"}.`
          : `${res.approved} aprovada(s), ${res.failed} com falha — veja o detalhe abaixo.`
      );
      load(true); // fonte única: a fila e os KPIs se atualizam do servidor
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível aprovar o lote.");
    } finally {
      setBatchSubmitting(false);
    }
  }, [approveReady, batchSubmitting, batchRows, federationId, trimmedFpkt, snapshotOf, load]);

  const handleBatchReject = useCallback(async () => {
    if (!batchRows.length || batchSubmitting) return;
    const toSend = batchRows;
    setBatchSubmitting(true);
    try {
      const res = await karateApi.batchRejectPractitionerRequests(
        federationId,
        toSend.map((r) => r.id),
        batchReason.trim() || undefined
      );
      setBatchResult({
        kind: "reject",
        results: res.results,
        okCount: res.rejected,
        failCount: res.failed,
        snapshot: snapshotOf(toSend),
      });
      setBatchStage("result");
      toast.success(
        res.failed === 0
          ? `${res.rejected} ${res.rejected === 1 ? "solicitação rejeitada" : "solicitações rejeitadas"}.`
          : `${res.rejected} rejeitada(s), ${res.failed} com falha — veja o detalhe abaixo.`
      );
      load(true);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível rejeitar o lote.");
    } finally {
      setBatchSubmitting(false);
    }
  }, [batchRows, batchSubmitting, federationId, batchReason, snapshotOf, load]);

  const kpiItems = useMemo(() => ([
    { label: "Pendentes", value: metrics?.pendentes ?? 0 },
    { label: "Mais antiga", value: metrics?.mais_antiga ? diasLabel(metrics.mais_antiga.dias) : "—" },
    { label: "Aguardando número FPKT", value: metrics?.aguardando_numero_fpkt ?? 0 },
  ]), [metrics]);

  // Seleção múltipla só faz sentido na fila de PENDENTES — aprovada e
  // rejeitada não têm ação em massa.
  const canSelect = statusFilter === "pendente" && !loading && !listError &&
    visibleRows.some((r) => r.status === "pendente");

  const inBatchPanel = batchStage !== "none";

  // ── Sub-render: linha resumida de revisão (nome, nascimento, faixa, dojô) ──
  const renderReviewRow = (r: PractitionerRequestAdminRow, withFpktInput: boolean) => {
    const matchCount = r.possible_matches?.length ?? 0;
    const num = trimmedFpkt(r.id);
    const isDup = num !== "" && duplicatedNumbers.has(num);
    return (
      <View key={r.id} style={st.reviewRow}>
        <Avatar name={r.full_name} size={32} />
        <View style={{ flex: 1, minWidth: 170 }}>
          <Text style={st.name} numberOfLines={1}>{r.full_name}</Text>
          <Body muted style={{ fontSize: 11.5 }}>
            {r.dojo_name || "Dojô sem nome"} · nascimento {fmtBirthDate(r.birth_date)} · {r.claimed_belt ? `faixa ${r.claimed_belt}` : "faixa não alegada"}
          </Body>
          {matchCount > 0 && (
            <View style={st.reviewWarn}>
              <Icon name="alert-circle" size={11} color={P.warn} />
              <Text style={st.reviewWarnTxt}>
                {matchCount} possível{matchCount > 1 ? "is" : ""} correspondência{matchCount > 1 ? "s" : ""} — recomendada análise individual
              </Text>
            </View>
          )}
        </View>
        {withFpktInput && (
          <View style={{ minWidth: 132 }}>
            <Text style={st.fieldLabel}>Número FPKT</Text>
            <TextInput
              style={[st.input, isDup && st.inputDup] as any}
              value={fpktByReq[r.id] ?? ""}
              onChangeText={(t) => setFpktByReq((prev) => ({ ...prev, [r.id]: t }))}
              placeholder="Ex.: 12345-D"
              placeholderTextColor={C.ink4}
            />
            {isDup && <Text style={st.dupTxt}>Repetido no lote</Text>}
          </View>
        )}
        <Pressable
          onPress={() => removeFromBatch(r.id)}
          style={st.removeBtn}
          accessibilityRole="button"
          accessibilityLabel={`Remover ${r.full_name} do lote`}
        >
          <Icon name="close" size={14} color={C.ink3} />
        </Pressable>
      </View>
    );
  };

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
        ) : metrics ? (
          <KpiBand items={kpiItems} style={{ marginTop: 16, marginBottom: 16 }} />
        ) : null /* métricas indisponíveis (metricsError) — não bloqueia a tela, só some com a faixa */}

        {/* Durante a revisão/resultado do lote, filtros e fila saem de cena —
            um estágio por vez, foco total no que vai ser decidido. */}
        {!inBatchPanel && (
          <>
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

            {/* Barra do lote — entrada no modo de seleção e ações em massa */}
            {canSelect && !selectMode && (
              <View style={st.selectBar}>
                <ShojiButton label="Selecionar várias" icon="checkbox-outline" variant="ghost" onPress={() => setSelectMode(true)} />
                <Body muted style={{ fontSize: 11.5, flex: 1 }}>
                  Aprove ou rejeite várias solicitações de uma vez — o caminho individual continua valendo para os casos que pedem análise.
                </Body>
              </View>
            )}
            {canSelect && selectMode && (
              <View style={st.selectBarActive}>
                <Text style={st.selectCount}>
                  {batchRows.length} {batchRows.length === 1 ? "selecionada" : "selecionadas"}
                </Text>
                <Pressable onPress={selectAllVisible} accessibilityRole="button"><Text style={st.selectLink}>Selecionar todas</Text></Pressable>
                <Pressable onPress={() => setSelected(new Set())} accessibilityRole="button"><Text style={st.selectLink}>Limpar</Text></Pressable>
                <View style={{ flex: 1 }} />
                <Pressable onPress={exitSelectMode} accessibilityRole="button" style={st.cancelBtn}><Text style={st.cancelTxt}>Cancelar</Text></Pressable>
                <ShojiButton
                  label="Rejeitar em lote"
                  icon="close-circle"
                  variant="ghost"
                  onPress={batchRows.length ? () => setBatchStage("reject") : undefined}
                  style={!batchRows.length ? { opacity: 0.5 } : undefined}
                />
                <ShojiButton
                  label="Aprovar em lote"
                  icon="checkmark-done"
                  variant="sumi"
                  onPress={batchRows.length ? openApproveStage : undefined}
                  style={!batchRows.length ? { opacity: 0.5 } : undefined}
                />
              </View>
            )}
          </>
        )}

        {/* ── Estágio: revisão do lote de APROVAÇÃO ─────────────── */}
        {batchStage === "approve" && (
          <Card style={{ marginTop: 16 }}>
            <Text style={st.stageTitle}>Aprovar em lote como criação</Text>
            <Body muted style={{ marginBottom: 4 }}>
              Confira os dados essenciais e atribua um número FPKT para cada solicitação — o número é emitido pela
              federação, nunca gerado pelo sistema. Cada aprovação cria o praticante NOVO no dojô da solicitação, e a
              faixa alegada vira o primeiro registro do histórico.
            </Body>
            <Body muted style={{ fontSize: 11.5, marginBottom: 12 }}>
              Solicitações marcadas com possíveis correspondências merecem análise individual (podem ser transferência)
              — remova do lote e decida uma a uma pela fila.
            </Body>

            {batchRows.map((r) => renderReviewRow(r, true))}

            {batchRows.length === 0 && (
              <Body muted style={{ paddingVertical: 10 }}>Nenhuma solicitação restou no lote — volte e selecione outras.</Body>
            )}

            {missingCount > 0 && batchRows.length > 0 && (
              <Text style={st.pendingHint}>
                {missingCount === 1 ? "Falta 1 número FPKT" : `Faltam ${missingCount} números FPKT`} para liberar a aprovação.
              </Text>
            )}
            {duplicatedNumbers.size > 0 && (
              <Text style={[st.pendingHint, { color: P.red }]}>
                Há número FPKT repetido dentro do lote — cada praticante precisa de um número próprio.
              </Text>
            )}

            <View style={st.stageActions}>
              <Pressable onPress={batchSubmitting ? undefined : () => setBatchStage("none")} style={st.cancelBtn}>
                <Text style={st.cancelTxt}>Voltar</Text>
              </Pressable>
              <ShojiButton
                label={batchSubmitting
                  ? "Aprovando..."
                  : `Aprovar ${batchRows.length} ${batchRows.length === 1 ? "solicitação" : "solicitações"}`}
                variant="accent"
                icon="checkmark-done"
                onPress={approveReady && !batchSubmitting ? handleBatchApprove : undefined}
                style={!approveReady ? { opacity: 0.5 } : undefined}
              />
            </View>
          </Card>
        )}

        {/* ── Estágio: revisão do lote de REJEIÇÃO ──────────────── */}
        {batchStage === "reject" && (
          <Card style={{ marginTop: 16 }}>
            <Text style={st.stageTitle}>Rejeitar em lote</Text>
            <Body muted style={{ marginBottom: 12 }}>
              O motivo é opcional e vale para todas as selecionadas — sem motivo, o sensei vê um texto padrão. O link de
              cada dojô é reaberto para ele ver o motivo e reenviar corrigido.
            </Body>

            {batchRows.map((r) => renderReviewRow(r, false))}

            {batchRows.length === 0 && (
              <Body muted style={{ paddingVertical: 10 }}>Nenhuma solicitação restou no lote — volte e selecione outras.</Body>
            )}

            <View style={{ marginTop: 12 }}>
              <Text style={st.fieldLabel}>Motivo (opcional — visível para o sensei)</Text>
              <TextInput
                style={[st.input, { minHeight: 76, textAlignVertical: "top" }] as any}
                value={batchReason}
                onChangeText={setBatchReason}
                placeholder="Ex.: documentação ilegível, dados incompletos..."
                placeholderTextColor={C.ink4}
                multiline
              />
            </View>

            <View style={st.stageActions}>
              <Pressable onPress={batchSubmitting ? undefined : () => setBatchStage("none")} style={st.cancelBtn}>
                <Text style={st.cancelTxt}>Voltar</Text>
              </Pressable>
              <ShojiButton
                label={batchSubmitting
                  ? "Rejeitando..."
                  : `Rejeitar ${batchRows.length} ${batchRows.length === 1 ? "solicitação" : "solicitações"}`}
                variant="accent"
                icon="close-circle"
                onPress={batchRows.length && !batchSubmitting ? handleBatchReject : undefined}
                style={!batchRows.length ? { opacity: 0.5 } : undefined}
              />
            </View>
          </Card>
        )}

        {/* ── Estágio: RESULTADO itemizado do lote ──────────────── */}
        {batchStage === "result" && batchResult && (
          <Card style={{ marginTop: 16 }}>
            <Text style={st.stageTitle}>
              {batchResult.kind === "approve" ? "Resultado da aprovação em lote" : "Resultado da rejeição em lote"}
            </Text>
            <Body muted style={{ marginBottom: 12 }}>
              {batchResult.okCount} de {batchResult.results.length} {batchResult.kind === "approve" ? "aprovadas" : "rejeitadas"}.
              {batchResult.failCount > 0
                ? " As que falharam permanecem pendentes na fila — o motivo de cada uma está abaixo."
                : ""}
            </Body>

            {batchResult.results.map((item) => {
              const snap = batchResult.snapshot.find((s) => s.id === item.request_id);
              return (
                <View key={item.request_id} style={st.resultRow}>
                  <Icon
                    name={item.ok ? "checkmark-circle" : "alert-circle"}
                    size={16}
                    color={item.ok ? P.ok : P.warn}
                  />
                  <View style={{ flex: 1, minWidth: 160 }}>
                    <Text style={st.name} numberOfLines={1}>{snap?.full_name || item.request_id}</Text>
                    <Body muted style={{ fontSize: 11.5 }}>
                      {item.ok
                        ? batchResult.kind === "approve"
                          ? `Aprovada — matrícula ${item.practitioner?.karate_registration_number || "—"}${snap?.dojo_name ? ` em ${snap.dojo_name}` : ""}`
                          : "Rejeitada — o dojô pode ver o motivo e reenviar"
                        : item.error || "Falhou"}
                    </Body>
                  </View>
                </View>
              );
            })}

            <View style={st.stageActions}>
              <ShojiButton label="Voltar para a fila" variant="sumi" onPress={exitSelectMode} />
            </View>
          </Card>
        )}

        {!inBatchPanel && (
          <View style={{ marginTop: 16 }}>
            {loading ? (
              <><Skeleton height={72} style={{ marginBottom: 10, borderRadius: R.lg }} /><Skeleton height={72} style={{ marginBottom: 10, borderRadius: R.lg }} /><Skeleton height={72} style={{ borderRadius: R.lg }} /></>
            ) : listError ? (
              <Card>
                <KarateErrorState
                  title="Não foi possível carregar a fila"
                  message="Os KPIs acima continuam valendo, se tiverem vindo. Tente de novo pra ver as solicitações."
                  onRetry={() => load()}
                  style={{ paddingVertical: 28 }}
                />
              </Card>
            ) : visibleRows.length === 0 ? (
              <Card><KarateEmptyState icon="clipboard" title="Nenhuma solicitação aqui" subtitle="Quando um dojô enviar uma solicitação de praticante, ela aparece nesta fila." style={{ paddingVertical: 28 }} /></Card>
            ) : (
              visibleRows.map((r) => {
                const matchCount = r.possible_matches?.length ?? 0;
                const ageDays = Math.max(0, Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000));
                const selectable = selectMode && r.status === "pendente";
                const isSelected = selectable && selected.has(r.id);
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => {
                      if (selectable) return toggleSelected(r.id);
                      if (selectMode) return; // em modo de seleção, não-pendente não navega nem seleciona
                      router.push(`/karate/conexoes/solicitacoes/${r.id}` as any);
                    }}
                    accessibilityRole={selectable ? "checkbox" : "button"}
                    accessibilityState={selectable ? { checked: isSelected } : undefined}
                    accessibilityLabel={selectable
                      ? `${isSelected ? "Remover" : "Incluir"} ${r.full_name} ${isSelected ? "do" : "no"} lote`
                      : `Ver solicitação de ${r.full_name}`}
                  >
                    <Card style={[{ marginBottom: 10 }, isSelected && st.cardSelected] as any}>
                      <View style={st.rowTop}>
                        {selectable && (
                          <View style={[st.checkbox, isSelected && st.checkboxOn]}>
                            {isSelected && <Icon name="checkmark" size={12} color={P.paper} />}
                          </View>
                        )}
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
                        {!selectMode && <Icon name="chevron-forward" size={16} color={C.ink4} />}
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
        )}
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

  // ── Lote ──
  selectBar: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" } as ViewStyle,
  selectBarActive: {
    flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap",
    backgroundColor: P.glass2, borderWidth: 1, borderColor: C.line2, borderRadius: R.lg,
    paddingVertical: 10, paddingHorizontal: 14,
  } as ViewStyle,
  selectCount: { fontFamily: F.body, fontSize: 13, fontWeight: "700", color: C.ink } as TextStyle,
  selectLink: { fontFamily: F.body, fontSize: 12, fontWeight: "600", color: P.red } as TextStyle,
  checkbox: {
    width: 20, height: 20, borderRadius: R.sm, borderWidth: 1.5, borderColor: C.ink4,
    alignItems: "center", justifyContent: "center", backgroundColor: "transparent",
  } as ViewStyle,
  checkboxOn: { backgroundColor: P.red, borderColor: P.red } as ViewStyle,
  cardSelected: { borderColor: P.redLine, backgroundColor: P.redWash } as ViewStyle,

  reviewRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line, flexWrap: "wrap" } as ViewStyle,
  reviewWarn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 } as ViewStyle,
  reviewWarnTxt: { fontFamily: F.body, fontSize: 11, fontWeight: "600", color: P.warn } as TextStyle,
  removeBtn: { padding: 8, borderRadius: R.pill } as ViewStyle,
  pendingHint: { fontFamily: F.body, fontSize: 12, fontWeight: "600", color: C.ink3, marginTop: 10 } as TextStyle,
  resultRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line } as ViewStyle,

  stageTitle: { fontFamily: F.heading, fontSize: 16, fontWeight: "400", color: C.ink, marginBottom: 8 } as TextStyle,
  stageActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 14 } as ViewStyle,
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: R.sm, justifyContent: "center" } as ViewStyle,
  cancelTxt: { fontFamily: F.body, fontSize: 12.5, fontWeight: "600", color: C.ink3 } as TextStyle,
  fieldLabel: { fontFamily: F.body, fontSize: 11, fontWeight: "600", color: C.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 } as TextStyle,
  input: { fontFamily: F.body, fontSize: 13, color: C.ink, backgroundColor: P.glass2, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 10 } as any,
  inputDup: { borderColor: P.red } as ViewStyle,
  dupTxt: { fontFamily: F.body, fontSize: 10.5, fontWeight: "600", color: P.red, marginTop: 3 } as TextStyle,
});
