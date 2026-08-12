// ============================================================
// FiliacoesTab — aba "Filiações" — Aura Karatê (federação) · Shoji (F6)
//
// CONVERGÊNCIA (27/07/2026): esta tela era a rota própria /karate/filiacao
// (app/karate/(federation)/filiacao/index.tsx, ainda viva como redirect
// fino para /karate/conexoes?tab=filiacoes — não quebra bookmarks). Virou
// aba irmã de ConexoesTab ("Sincronização") e SolicitacoesTab
// ("Praticantes") dentro do container único de Conexões (ver ../index.tsx)
// — a investigação confirmou que não havia dois inboxes de filiação
// concorrentes: "Conectar dojô"/karate_dojo_connections é config de MODO
// DE SINCRONIA (native/manual) para quem JÁ está linkado; o inbox real de
// pedidos SEMPRE foi karate_affiliation_requests (esta tela). GET/POST
// .../affiliation-requests[?status], GET .../affiliation-requests/metrics,
// POST .../:id/approve|reject (contrato Aura-backend#424 + migration 252).
//
// DECISÃO (27/07/2026): a federação NUNCA abre filiação pelo dojô — é
// sempre o dojô self-serve que se filia. Sem selo de origem no card, sem
// quebra de KPI por origem: o inbox é só self-serve, ponto.
//
// Decisão de UX (mesmo racional documentado em
// conexoes/solicitacoes/[requestId].tsx): TODA ação que muta fica em um
// estágio INLINE dentro do próprio card — nunca <Modal> (RN Web
// renderiza Modal-dentro-de-Modal atrás da tela, já mordeu este produto
// várias vezes). Só um card com estágio aberto por vez. O seletor de
// registro da F11 abaixo segue a MESMA regra: é um bloco dentro do
// estágio, não um modal de busca.
//
// A federação DEFINE o número de filiação no approve (o sistema NÃO
// gera) — texto explícito no estágio de aprovação.
//
// ── F11 (10/08/2026): APROVAR TAMBÉM É APONTAR ──────────────
// A federação tem 105 dojôs cadastrados como REGISTRO FEDERATIVO (código
// FPKT, anuidade e 9.840 praticantes). O sensei que assina a Aura chega
// por uma conta NOVA e vazia. No aceite a federação diz QUAL daqueles
// registros é ele — `target_company_id` — e a conta do sensei PASSA A SER
// aquela linha (move-se o USUÁRIO, não os praticantes). Sem apontar, o
// dojô real fica com DUAS linhas: o registro antigo, com os praticantes, e
// a conta nova, vazia.
//
// Três cuidados que o código abaixo materializa, e que não são detalhe:
//   1. A escolha não tem desfazer pela tela (a conta do cadastro é
//      DESATIVADA). Por isso há prévia do que vem junto ANTES do confirmar,
//      e o botão troca de rótulo para "Aprovar e transferir a conta".
//   2. São 105 registros: busca obrigatória (nome OU número FPKT), nunca
//      uma lista rolável.
//   3. NÃO existe match automático por semelhança de nome. O que existe é
//      uma SUGESTÃO DE BUSCA rotulada como tal, que só preenche o campo de
//      busca — escolher continua sendo ato humano. Um match errado aqui
//      entrega os praticantes de um dojô para outro.
//
// ⚠️ LIMITE CONHECIDO DO CONTRATO: GET /federation/:id/dojos não expõe o
// dono do registro, então a lista NÃO consegue marcar quais registros já
// têm responsável. Quem adjudica é o backend no approve
// (TARGET_ALREADY_CLAIMED / TARGET_OWNER_INCONSISTENT) — os dois têm
// mensagem e ação próprias na caixa de erro do estágio.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, RefreshControl, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP } from "@/constants/karateTheme";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { Skeleton } from "@/components/karate/Skeleton";
import { ShojiBackground, PageHead, Card, KpiBand, Chip, Avatar, Mono, Body, ShojiButton } from "@/components/karate/shoji";
import {
  karateAffiliationApi, AffiliationRequestRow, AffiliationRequestsMetrics, AffiliationRequestStatus,
  RegistryCandidate, RegistryAnnuitySummary,
} from "@/services/karateAffiliationApi";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { ApiError } from "@/services/api";
import { toast } from "@/components/Toast";

const STATUS_FILTERS: { key: AffiliationRequestStatus | "todas"; label: string }[] = [
  { key: "pending", label: "Pendentes" },
  { key: "approved", label: "Aprovados" },
  { key: "rejected", label: "Recusados" },
  { key: "todas", label: "Todas" },
];

const STATUS_VIEW: Record<AffiliationRequestStatus, { label: string; color: string; bg: string; icon: string }> = {
  pending:  { label: "Pendente",  color: P.warn, bg: P.warnWash, icon: "hourglass" },
  approved: { label: "Aprovado",  color: P.ok,   bg: P.okWash,   icon: "checkmark-circle" },
  rejected: { label: "Recusado",  color: P.red,  bg: P.redWash,  icon: "close-circle" },
};

// Busca de registro: mínimo de caracteres antes de bater na API (evita
// pedir os 105 de uma vez) e página curta — o objetivo é RECONHECER o
// dojô, não paginar um catálogo.
const MIN_REGISTRY_QUERY = 2;
const REGISTRY_PAGE_SIZE = 8;
const REGISTRY_DEBOUNCE_MS = 400;

function StatusPill({ status }: { status: AffiliationRequestStatus }) {
  const v = STATUS_VIEW[status];
  return (
    <View style={st.statusPill}>
      <Icon name={v.icon as any} size={11} color={v.color} />
      <Text style={[st.statusPillTxt, { color: v.color }]}>{v.label}</Text>
    </View>
  );
}

function diasLabel(dias: number | null | undefined): string {
  if (dias == null) return "—";
  if (dias <= 0) return "hoje";
  return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

// created_at é timestamptz de verdade (não data pura) — Date real está certo aqui.
function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// affiliation_since/due_date são DATE puro (YYYY-MM-DD). `new Date()` num
// date puro volta meia-noite UTC e, em UTC-3, imprime o dia ANTERIOR —
// por isso a formatação é textual, sem Date.
function fmtDateOnly(v?: string | null): string {
  if (!v) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if (!m) return String(v);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function fmtMoney(v?: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function localLine(c: RegistryCandidate): string {
  const cityUf = [c.city, c.state].filter(Boolean).join("/");
  return cityUf || c.region || "";
}

function ativosLabel(c: RegistryCandidate): string {
  const ativos = c.active_practitioner_count;
  if (ativos == null) return `${c.practitioner_count} praticantes`;
  if (ativos === c.practitioner_count) return `${ativos} praticantes ativos`;
  return `${ativos} ativos de ${c.practitioner_count}`;
}

type Mode = "approve" | "reject" | null;
/** null = a federação ainda não decidiu. Decisão explícita, sem default. */
type RegistryChoice = "existing" | "new" | null;

type StageError = { title: string; detail?: string | null; pickAnother?: boolean };

// Cada código do backend pede uma AÇÃO diferente do operador — por isso
// mensagem própria, em português, e não o código cru na tela. `detail` só
// entra nos códigos cuja mensagem do backend carrega informação extra
// (qual das três inconsistências de dono, qual tabela colidiu…).
function approveErrorView(e: ApiError): StageError {
  const code = (e.data && e.data.code) || e.code || null;
  const backend = typeof e.message === "string" && e.message ? e.message : null;
  switch (code) {
    case "FPKT_NUMBER_REQUIRED":
      return { title: "Informe o número de filiação — a federação define esse número, o sistema não gera." };
    case "FPKT_NUMBER_TAKEN":
      return { title: "Esse número de filiação já está em uso por outro dojô desta federação. Use outro número." };
    case "TARGET_COMPANY_INVALID":
      return { title: "O registro apontado não é válido. Busque e selecione o registro de novo.", pickAnother: true };
    case "TARGET_NOT_FOUND":
      return {
        title: "Esse registro não é desta federação. Escolha um registro que apareça na busca aqui.",
        detail: backend, pickAnother: true,
      };
    case "TARGET_NOT_DOJO":
      return { title: "A empresa apontada não é um registro de dojô. Escolha outro registro.", pickAnother: true };
    case "TARGET_INACTIVE":
      return {
        title: "Esse registro está desativado. Reative o dojô em Dojôs antes de vinculá-lo a um sensei — depois volte e aprove.",
      };
    case "TARGET_ALREADY_CLAIMED":
      return {
        title: "Esse registro já tem responsável com conta própria: os praticantes dele são de outra pessoa. Aponte outro registro ou trate a duplicidade antes de aprovar.",
        detail: backend, pickAnother: true,
      };
    case "TARGET_OWNER_INCONSISTENT":
      return {
        title: "Ninguém reclamou esse registro — ele está com o cadastro quebrado. Corrija o registro na federação antes de aprovar; trocar de registro não resolve, se for este o dojô.",
        detail: backend,
      };
    case "TARGET_IS_REQUESTER":
      return {
        title: "O registro apontado é a própria conta que pediu a filiação. Se ela já é o registro federativo, aprove com a opção \"É um dojô novo\".",
        pickAnother: true,
      };
    case "REQUESTER_IS_SYSTEM_OWNED":
      return {
        title: "A conta que pediu a filiação é ela própria um registro da federação (não tem sensei com login). Não há usuário para assumir o registro apontado.",
      };
    case "REQUESTER_WITHOUT_OWNER":
      return { title: "A conta que pediu a filiação está sem dono — não há usuário para transferir. Aprove sem apontar registro e acione o suporte." };
    case "DOJO_NOT_FOUND":
      return { title: "A conta que pediu a filiação não existe mais nesta federação.", detail: backend };
    case "MIGRACAO_COLIDIU":
      return {
        title: "Nada foi alterado. Já existe cadastro equivalente no registro apontado (aluno ou tag repetido). Resolva a duplicidade e aprove de novo.",
        detail: backend,
      };
    case "SCHEMA_PENDING":
      return { title: "A filiação está indisponível neste ambiente (migração pendente). Fale com o suporte." };
    default:
      return { title: backend || "Não foi possível aprovar a filiação. Tente de novo." };
  }
}

export function FiliacoesTab() {
  const { federationId } = useKarateFederation();

  const [rows, setRows] = useState<AffiliationRequestRow[]>([]);
  const [metrics, setMetrics] = useState<AffiliationRequestsMetrics | null>(null);
  const [statusFilter, setStatusFilter] = useState<AffiliationRequestStatus | "todas">("pending");
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Condição de corrida: só a resposta MAIS RECENTE escreve no estado
  // (mesmo padrão de SolicitacoesTab.tsx).
  const reqIdRef = useRef(0);

  // Estágio inline de decisão — no máximo um card aberto por vez.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [fpktNumber, setFpktNumber] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stageError, setStageError] = useState<StageError | null>(null);

  // ── F11: apontamento de registro ─────────────────────────────
  const [registryChoice, setRegistryChoice] = useState<RegistryChoice>(null);
  const [registryQuery, setRegistryQuery] = useState("");
  const [registryResults, setRegistryResults] = useState<RegistryCandidate[]>([]);
  const [registryTotal, setRegistryTotal] = useState(0);
  const [registrySearching, setRegistrySearching] = useState(false);
  const [registrySearchError, setRegistrySearchError] = useState(false);
  const [selectedRegistry, setSelectedRegistry] = useState<RegistryCandidate | null>(null);
  const [registryAnnuity, setRegistryAnnuity] = useState<RegistryAnnuitySummary | null>(null);
  const [registryAnnuityLoading, setRegistryAnnuityLoading] = useState(false);
  const searchReqRef = useRef(0);
  const searchTimerRef = useRef<any>(null);
  const annuityReqRef = useRef(0);

  const load = useCallback(async (isRefresh = false) => {
    if (!federationId) return;
    const myReq = ++reqIdRef.current;
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      // allSettled: a fila e as métricas são chamadas independentes — uma
      // falhar não pode apagar o resultado da outra (mesmo racional de
      // SolicitacoesTab.tsx).
      const [listRes, metricsRes] = await Promise.allSettled([
        karateAffiliationApi.listRequests(federationId, statusFilter === "todas" ? undefined : statusFilter),
        karateAffiliationApi.getMetrics(federationId),
      ]);
      if (myReq !== reqIdRef.current) return;

      if (listRes.status === "fulfilled") {
        const sorted = [...listRes.value.data].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setRows(sorted);
        setListError(false);
      } else {
        setListError(true);
      }

      if (metricsRes.status === "fulfilled") setMetrics(metricsRes.value);
      // metrics falhando não bloqueia a tela — só some com a faixa de KPIs.
    } finally {
      if (myReq === reqIdRef.current) isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId, statusFilter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const activeRow = useMemo(
    () => rows.find((r) => r.id === activeId) || null,
    [rows, activeId]
  );
  // A conta que PEDIU nunca pode ser o registro apontado (o backend recusa
  // com TARGET_IS_REQUESTER). Some da busca antes de virar um 422.
  const requesterCompanyId = activeRow?.dojo?.id || null;

  const clearRegistryStage = useCallback(() => {
    if (searchTimerRef.current) { clearTimeout(searchTimerRef.current); searchTimerRef.current = null; }
    searchReqRef.current++;
    annuityReqRef.current++;
    setRegistryChoice(null);
    setRegistryQuery("");
    setRegistryResults([]);
    setRegistryTotal(0);
    setRegistrySearching(false);
    setRegistrySearchError(false);
    setSelectedRegistry(null);
    setRegistryAnnuity(null);
    setRegistryAnnuityLoading(false);
  }, []);

  const closeStage = useCallback(() => {
    setActiveId(null); setMode(null); setFpktNumber(""); setRejectReason("");
    setStageError(null);
    clearRegistryStage();
  }, [clearRegistryStage]);

  const openApprove = useCallback((row: AffiliationRequestRow) => {
    clearRegistryStage();
    setStageError(null);
    setFpktNumber("");
    setActiveId(row.id);
    setMode("approve");
  }, [clearRegistryStage]);

  // Busca dos registros: debounce + "a última resposta vence" (mesmo
  // racional do reqIdRef da fila). Sem query mínima não bate na API.
  useEffect(() => {
    if (searchTimerRef.current) { clearTimeout(searchTimerRef.current); searchTimerRef.current = null; }
    if (mode !== "approve" || registryChoice !== "existing" || selectedRegistry || !federationId) return;

    const q = registryQuery.trim();
    if (q.length < MIN_REGISTRY_QUERY) {
      searchReqRef.current++; // invalida qualquer resposta em voo
      setRegistrySearching(false);
      setRegistrySearchError(false);
      setRegistryResults([]);
      setRegistryTotal(0);
      return;
    }

    const myReq = ++searchReqRef.current;
    setRegistrySearching(true);
    setRegistrySearchError(false);
    searchTimerRef.current = setTimeout(() => {
      karateAffiliationApi
        .listRegistryCandidates(federationId, { q, pageSize: REGISTRY_PAGE_SIZE })
        .then((res) => {
          if (myReq !== searchReqRef.current) return;
          const list = requesterCompanyId
            ? res.data.filter((c) => c.id !== requesterCompanyId)
            : res.data;
          setRegistryResults(list);
          setRegistryTotal(res.total);
          setRegistrySearchError(false);
        })
        .catch(() => {
          if (myReq !== searchReqRef.current) return;
          setRegistryResults([]);
          setRegistryTotal(0);
          setRegistrySearchError(true);
        })
        .then(() => {
          if (myReq === searchReqRef.current) setRegistrySearching(false);
        });
    }, REGISTRY_DEBOUNCE_MS);

    return () => {
      if (searchTimerRef.current) { clearTimeout(searchTimerRef.current); searchTimerRef.current = null; }
    };
  }, [mode, registryChoice, selectedRegistry, registryQuery, federationId, requesterCompanyId]);

  const selectRegistry = useCallback((c: RegistryCandidate) => {
    setSelectedRegistry(c);
    setStageError(null);
    setRegistryAnnuity(null);
    if (!federationId) return;
    // Anuidade é enfeite HONESTO da prévia: a lista de dojôs não carrega
    // anuidade, só o detalhe. Falhou, não mostra o bloco — nunca erro.
    const myReq = ++annuityReqRef.current;
    setRegistryAnnuityLoading(true);
    karateAffiliationApi.getRegistryAnnuity(federationId, c.id).then((summary) => {
      if (myReq !== annuityReqRef.current) return;
      setRegistryAnnuity(summary);
      setRegistryAnnuityLoading(false);
    });
  }, [federationId]);

  const clearSelectedRegistry = useCallback(() => {
    annuityReqRef.current++;
    setSelectedRegistry(null);
    setRegistryAnnuity(null);
    setRegistryAnnuityLoading(false);
    setStageError(null);
  }, []);

  // Registro desativado é recusado pelo backend (TARGET_INACTIVE). Dá para
  // dizer isso ANTES de gastar um 409 — e sem esconder o registro da busca,
  // senão a federação procura o dojô dela e não acha.
  const targetInactive = registryChoice === "existing" && !!selectedRegistry && !selectedRegistry.is_active;
  const approveReady =
    !!fpktNumber.trim() &&
    !submitting &&
    (registryChoice === "new" || (registryChoice === "existing" && !!selectedRegistry && !targetInactive));

  const handleApprove = useCallback(async (row: AffiliationRequestRow) => {
    const number = fpktNumber.trim();
    if (!number) return;
    if (registryChoice === null) return;
    const target = registryChoice === "existing" ? (selectedRegistry?.id || null) : null;
    if (registryChoice === "existing" && !target) return;

    setSubmitting(true);
    setStageError(null);
    try {
      const res = await karateAffiliationApi.approve(federationId, row.id, number, target);
      const assumption = res && res.assumption ? res.assumption : null;
      if (assumption) {
        const destino = assumption.to_company_name || selectedRegistry?.name || "o registro";
        const movidos = Number(assumption.migrated_rows) || 0;
        toast.success(
          `Filiação aprovada — a conta de ${row.dojo?.name || "o dojô"} agora É o registro ${destino}` +
          (movidos > 0 ? `, com ${movidos} ${movidos === 1 ? "cadastro migrado" : "cadastros migrados"}.` : ".")
        );
      } else {
        toast.success(`${row.dojo?.name || "Dojô"} conectado — filiação ${res.fpkt_affiliation_id}.`);
      }
      closeStage();
      await load();
    } catch (e: any) {
      if (e instanceof ApiError) {
        const code = (e.data && e.data.code) || e.code || null;
        if (e.status === 409 && code === "JA_RESOLVIDA") {
          toast.error("Esta solicitação já foi resolvida.");
          closeStage();
          await load();
          return;
        }
        // Caixa PERSISTENTE dentro do estágio: um toast some antes de a
        // federação conseguir agir, e metade destes erros exige escolher
        // outro registro ou corrigir cadastro.
        setStageError(approveErrorView(e));
      } else {
        setStageError({ title: "Não foi possível aprovar a filiação. Verifique a conexão e tente de novo." });
      }
    } finally {
      setSubmitting(false);
    }
  }, [federationId, fpktNumber, registryChoice, selectedRegistry, closeStage, load]);

  const handleReject = useCallback(async (row: AffiliationRequestRow) => {
    const reason = rejectReason.trim();
    if (!reason) return;
    setSubmitting(true);
    try {
      await karateAffiliationApi.reject(federationId, row.id, reason);
      toast.success(`Solicitação de ${row.dojo?.name || "dojô"} recusada.`);
      closeStage();
      await load();
    } catch (e: any) {
      if (e instanceof ApiError) {
        const code = e.data?.code;
        if (e.status === 422) {
          toast.error("Informe o motivo da recusa — o sensei vai ver esse texto.");
        } else if (e.status === 409 && code === "JA_RESOLVIDA") {
          toast.error("Esta solicitação já foi resolvida.");
          closeStage();
          await load();
        } else {
          toast.error(e.message || "Não foi possível recusar a solicitação.");
        }
      } else {
        toast.error("Não foi possível recusar a solicitação. Tente de novo.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [federationId, rejectReason, closeStage, load]);

  const kpiItems = useMemo(() => ([
    { label: "Pendentes", value: metrics?.pending ?? 0, accent: true },
    { label: "Aprovados", value: metrics?.approved ?? 0 },
    { label: "Recusados", value: metrics?.rejected ?? 0 },
    { label: "Mais antiga", value: metrics?.mais_antiga ? diasLabel(metrics.mais_antiga.dias) : "—" },
  ]), [metrics]);

  return (
    <ShojiBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={P.red} />}
      >
        <PageHead
          title="Filiações"
          sub="Pedidos de conexão vindos dos dojôs. A federação confere os dados de contato, define o número de filiação — o sistema não gera esse número — e aponta qual registro federativo é aquele dojô."
        />

        {loading && !metrics ? (
          <Skeleton height={100} style={{ marginBottom: 16, borderRadius: R.xl }} />
        ) : metrics ? (
          <KpiBand items={kpiItems} style={{ marginBottom: 16 }} />
        ) : null}

        <View style={st.filtersRow}>
          {STATUS_FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} active={statusFilter === f.key} onPress={() => setStatusFilter(f.key)} accessibilityLabel={`Filtrar por ${f.label}`} />
          ))}
        </View>

        <View style={{ marginTop: 16 }}>
          {loading ? (
            <><Skeleton height={96} style={{ marginBottom: 10, borderRadius: R.lg }} /><Skeleton height={96} style={{ borderRadius: R.lg }} /></>
          ) : listError ? (
            <Card><KarateErrorState title="Não foi possível carregar a fila" message="Os KPIs acima continuam valendo, se tiverem vindo. Tente de novo." onRetry={() => load()} style={{ paddingVertical: 28 }} /></Card>
          ) : rows.length === 0 ? (
            <Card><KarateEmptyState icon="inbox" title="Nenhum pedido aqui" subtitle="Quando um dojô solicitar conexão com a federação, o pedido aparece nesta fila." style={{ paddingVertical: 28 }} /></Card>
          ) : (
            rows.map((row) => {
              const isPending = row.status === "pending";
              const isActive = activeId === row.id;
              const ageDays = Math.max(0, Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86400000));
              const cityLine = [row.city, row.state].filter(Boolean).join("/");
              const doc = row.cnpj ? `CNPJ ${row.cnpj}` : row.cpf ? `CPF ${row.cpf}` : null;
              const dojoName = row.dojo?.name || "";
              return (
                <Card key={row.id} style={{ marginBottom: 10 }}>
                  <View style={st.rowTop}>
                    <Avatar name={row.dojo?.name || "Dojô"} size={36} />
                    <View style={{ flex: 1, minWidth: 160 }}>
                      <Text style={st.name} numberOfLines={1}>{row.dojo?.name || "Dojô sem nome"}</Text>
                      <View style={st.nameMetaRow}>
                        <Body muted style={{ fontSize: 11.5 }}>
                          {row.contact_name}{row.contact_phone ? ` · ${row.contact_phone}` : ""}
                        </Body>
                        {isPending && (
                          <View style={st.waitChip}>
                            <Icon name="time-outline" size={10} color={C.ink2} />
                            <Mono style={st.waitChipText}>{diasLabel(ageDays)}</Mono>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <StatusPill status={row.status} />
                    </View>
                  </View>

                  <View style={st.rowMeta}>
                    <View style={st.metaItem}>
                      <Icon name="calendar-outline" size={12} color={C.ink3} />
                      <Text style={st.metaTxt}>Enviado em {fmtDateTime(row.created_at)}</Text>
                    </View>
                    {!!doc && (
                      <View style={st.metaItem}><Icon name="barcode" size={12} color={C.ink3} /><Mono style={st.metaTxt}>{doc}</Mono></View>
                    )}
                    {!!cityLine && (
                      <View style={st.metaItem}><Icon name="location-outline" size={12} color={C.ink3} /><Text style={st.metaTxt}>{cityLine}</Text></View>
                    )}
                    {row.students_count != null && (
                      <View style={st.metaItem}><Icon name="people" size={12} color={C.ink3} /><Text style={st.metaTxt}>{row.students_count} alunos</Text></View>
                    )}
                  </View>

                  {!!row.contact_email && (
                    <View style={[st.metaItem, { marginTop: 6 }]}><Icon name="mail-outline" size={12} color={C.ink3} /><Text style={st.metaTxt}>{row.contact_email}</Text></View>
                  )}
                  {!!row.notes && (
                    <Body muted style={{ fontSize: 12, marginTop: 8, lineHeight: 17 }}>{row.notes}</Body>
                  )}

                  {row.status === "rejected" && !!row.rejection_reason && (
                    <View style={st.reasonBox}>
                      <Text style={st.reasonLabel}>Motivo da recusa</Text>
                      <Text style={st.reasonTxt}>{row.rejection_reason}</Text>
                    </View>
                  )}
                  {row.status === "approved" && !!row.reviewed_at && (
                    <Body muted style={{ fontSize: 11.5, marginTop: 8 }}>Aprovado em {fmtDateTime(row.reviewed_at)}.</Body>
                  )}

                  {isPending && !isActive && (
                    <View style={st.actionsRow}>
                      <ShojiButton label="Aprovar" icon="checkmark-circle" variant="sumi" onPress={() => openApprove(row)} />
                      <ShojiButton label="Recusar" icon="close-circle" variant="ghost" onPress={() => { clearRegistryStage(); setStageError(null); setActiveId(row.id); setMode("reject"); }} />
                    </View>
                  )}

                  {isPending && isActive && mode === "approve" && (
                    <View style={st.stage}>
                      <Text style={st.stageTitle}>Aprovar filiação</Text>
                      <Body muted style={{ marginBottom: 12 }}>
                        Isso conecta {dojoName || "o dojô"} à federação. A federação DEFINE o número de filiação — o sistema não gera esse número — e diz qual registro federativo é este dojô.
                      </Body>

                      {/* ── 1. A escolha, sem default ─────────────── */}
                      <Text style={st.fieldLabel}>Este dojô já tem registro nesta federação?</Text>
                      <View style={st.choiceRow}>
                        <Chip
                          label="Sim — apontar o registro"
                          active={registryChoice === "existing"}
                          onPress={() => { setRegistryChoice("existing"); setStageError(null); }}
                          accessibilityLabel="Apontar um registro federativo existente"
                        />
                        <Chip
                          label="Não — é um dojô novo"
                          active={registryChoice === "new"}
                          onPress={() => { setRegistryChoice("new"); clearSelectedRegistry(); setRegistryQuery(""); setStageError(null); }}
                          accessibilityLabel="Aprovar como dojô novo, sem apontar registro"
                        />
                      </View>

                      {registryChoice === null && (
                        <View style={st.hintBox}>
                          <Icon name="information-circle" size={13} color={C.ink3} />
                          <Body muted style={st.hintTxt}>
                            Apontar um registro TRANSFERE a conta do sensei para aquela linha — ele herda os praticantes, o número FPKT e a anuidade que já estão lá. Não apontar cria um dojô sem histórico nenhum.
                          </Body>
                        </View>
                      )}

                      {registryChoice === "new" && (
                        <View style={st.hintBox}>
                          <Icon name="information-circle" size={13} color={C.ink3} />
                          <Body muted style={st.hintTxt}>
                            Nenhum registro será apontado: a conta de {dojoName || "o dojô"} continua como está e entra na federação SEM histórico — sem praticantes, sem anuidade, sem código FPKT anterior. Se este dojô já era cadastrado aqui, volte e aponte o registro.
                          </Body>
                        </View>
                      )}

                      {/* ── 2. Busca (obrigatória — são 105 registros) ── */}
                      {registryChoice === "existing" && !selectedRegistry && (
                        <View style={st.pickerBox}>
                          <Text style={st.fieldLabel}>Buscar registro por nome ou número FPKT</Text>
                          <View style={st.searchWrap}>
                            <Icon name="search" size={14} color={C.ink3} />
                            <TextInput
                              style={st.searchInput}
                              value={registryQuery}
                              onChangeText={setRegistryQuery}
                              placeholder="Ex.: Areikan, Shotokan Centro, 12345-D"
                              placeholderTextColor={C.ink4}
                              autoCapitalize="none"
                              autoCorrect={false}
                              accessibilityLabel="Buscar registro federativo por nome ou número FPKT"
                            />
                            {registrySearching && <ActivityIndicator size="small" color={P.red} />}
                          </View>

                          {!!dojoName && (
                            <View style={st.suggestRow}>
                              <Chip
                                label={`Sugestão de busca: "${dojoName}"`}
                                onPress={() => setRegistryQuery(dojoName)}
                                accessibilityLabel={`Preencher a busca com ${dojoName}`}
                              />
                            </View>
                          )}
                          <Body muted style={st.suggestNote}>
                            A sugestão só preenche o campo de busca. Nenhum registro é escolhido por semelhança de nome — conferir e escolher é sempre da federação.
                          </Body>

                          {registrySearchError ? (
                            <View style={st.errBox}>
                              <Text style={st.errTitle}>Não foi possível buscar os registros agora.</Text>
                              <Body muted style={st.errDetail}>Ajuste a busca ou tente de novo em instantes.</Body>
                            </View>
                          ) : registryQuery.trim().length < MIN_REGISTRY_QUERY ? (
                            <Body muted style={st.pickerHint}>
                              Digite ao menos {MIN_REGISTRY_QUERY} caracteres do nome do dojô ou o número FPKT.
                            </Body>
                          ) : registrySearching ? (
                            <Body muted style={st.pickerHint}>Buscando…</Body>
                          ) : registryResults.length === 0 ? (
                            <Body muted style={st.pickerHint}>
                              Nenhum registro encontrado para "{registryQuery.trim()}". Tente outro trecho do nome ou o número FPKT — se o dojô realmente não existe aqui, aprove como dojô novo.
                            </Body>
                          ) : (
                            <View style={st.resultList}>
                              {registryResults.map((c) => (
                                <Pressable
                                  key={c.id}
                                  onPress={() => selectRegistry(c)}
                                  style={st.resultRow}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Escolher o registro ${c.name}`}
                                >
                                  <View style={{ flex: 1, minWidth: 140 }}>
                                    <Text style={st.resultName} numberOfLines={1}>{c.name}</Text>
                                    <View style={st.resultMetaRow}>
                                      <Mono style={st.resultMeta}>{c.fpkt_affiliation_id || "sem número FPKT"}</Mono>
                                      {!!localLine(c) && <Text style={st.resultMeta}>· {localLine(c)}</Text>}
                                      <Text style={st.resultMeta}>· {ativosLabel(c)}</Text>
                                    </View>
                                  </View>
                                  {!c.is_active && (
                                    <View style={st.offPill}><Text style={st.offPillTxt}>Desativado</Text></View>
                                  )}
                                  <Icon name="chevron-forward" size={14} color={C.ink3} />
                                </Pressable>
                              ))}
                              {registryTotal > registryResults.length && (
                                <Body muted style={st.pickerHint}>
                                  Mostrando {registryResults.length} de {registryTotal} registros. Refine a busca para achar o certo.
                                </Body>
                              )}
                            </View>
                          )}
                        </View>
                      )}

                      {/* ── 3. Prévia honesta do que vem junto ────── */}
                      {registryChoice === "existing" && !!selectedRegistry && (
                        <View style={st.previewBox}>
                          <Text style={st.previewLabel}>Registro apontado</Text>
                          <Text style={st.previewName}>{selectedRegistry.name}</Text>

                          <View style={st.previewGrid}>
                            <View style={st.previewItem}>
                              <Icon name="people" size={12} color={C.ink3} />
                              <Text style={st.previewTxt}>{ativosLabel(selectedRegistry)}</Text>
                            </View>
                            <View style={st.previewItem}>
                              <Icon name="barcode" size={12} color={C.ink3} />
                              <Mono style={st.previewTxt}>{selectedRegistry.fpkt_affiliation_id || "sem número FPKT"}</Mono>
                            </View>
                            <View style={st.previewItem}>
                              <Icon name="calendar-outline" size={12} color={C.ink3} />
                              <Text style={st.previewTxt}>Filiado desde {fmtDateOnly(selectedRegistry.affiliation_since)}</Text>
                            </View>
                            {!!localLine(selectedRegistry) && (
                              <View style={st.previewItem}>
                                <Icon name="location-outline" size={12} color={C.ink3} />
                                <Text style={st.previewTxt}>{localLine(selectedRegistry)}</Text>
                              </View>
                            )}
                            <View style={st.previewItem}>
                              <Icon name="cash-outline" size={12} color={C.ink3} />
                              <Text style={st.previewTxt}>
                                {registryAnnuityLoading
                                  ? "Anuidade: consultando…"
                                  : registryAnnuity == null
                                    ? "Anuidade: não foi possível consultar"
                                    : registryAnnuity.total === 0
                                      ? "Anuidade: sem histórico registrado"
                                      : `Anuidade: ${registryAnnuity.open_count} em aberto de ${registryAnnuity.total}` +
                                        (registryAnnuity.latest?.reference_period
                                          ? ` · última ${registryAnnuity.latest.reference_period}` +
                                            (registryAnnuity.latest.amount != null ? ` (${fmtMoney(registryAnnuity.latest.amount)})` : "")
                                          : "")}
                              </Text>
                            </View>
                            {!!selectedRegistry.annuity_plan && (
                              <View style={st.previewItem}>
                                <Icon name="card-outline" size={12} color={C.ink3} />
                                <Text style={st.previewTxt}>Plano {selectedRegistry.annuity_plan}</Text>
                              </View>
                            )}
                          </View>

                          {targetInactive ? (
                            <View style={st.warnBox}>
                              <Text style={st.warnTitle}>Este registro está desativado</Text>
                              <Body muted style={st.warnTxt}>
                                Reative o dojô em Dojôs antes de vinculá-lo a um sensei — a aprovação seria recusada. Ou escolha outro registro.
                              </Body>
                            </View>
                          ) : (
                            <View style={st.warnBox}>
                              <Text style={st.warnTitle}>Isso não tem desfazer por esta tela</Text>
                              <Body muted style={st.warnTxt}>
                                Ao confirmar, a conta de {dojoName || "quem pediu"} PASSA A SER este registro: o sensei vira responsável por ele e herda os praticantes acima; o que ele cadastrou na conta nova é migrado para cá; e a conta usada no cadastro é DESATIVADA. Confira o nome e o número FPKT antes de confirmar — apontar o registro errado entrega os praticantes de um dojô para outra pessoa.
                              </Body>
                            </View>
                          )}

                          <View style={st.previewActions}>
                            <ShojiButton
                              label="Escolher outro registro"
                              icon="search"
                              variant="ghost"
                              onPress={submitting ? undefined : clearSelectedRegistry}
                            />
                          </View>
                        </View>
                      )}

                      {/* ── 4. Número de filiação ─────────────────── */}
                      <Text style={[st.fieldLabel, { marginTop: 14 }]}>Número de filiação (obrigatório)</Text>
                      <TextInput
                        style={st.input}
                        value={fpktNumber}
                        onChangeText={(v) => { setFpktNumber(v); if (stageError) setStageError(null); }}
                        placeholder="Ex.: 12345-D"
                        placeholderTextColor={C.ink4}
                        accessibilityLabel="Número de filiação"
                      />
                      {!!selectedRegistry?.fpkt_affiliation_id && fpktNumber.trim() !== selectedRegistry.fpkt_affiliation_id && (
                        <View style={st.suggestRow}>
                          <Chip
                            label={`Usar o número do registro: ${selectedRegistry.fpkt_affiliation_id}`}
                            onPress={() => setFpktNumber(selectedRegistry.fpkt_affiliation_id || "")}
                            accessibilityLabel={`Preencher com o número ${selectedRegistry.fpkt_affiliation_id}`}
                          />
                        </View>
                      )}

                      {!!stageError && (
                        <View style={st.errBox}>
                          <Text style={st.errTitle}>{stageError.title}</Text>
                          {!!stageError.detail && <Body muted style={st.errDetail}>{stageError.detail}</Body>}
                          {stageError.pickAnother && !!selectedRegistry && (
                            <View style={{ marginTop: 8, alignItems: "flex-start" }}>
                              <ShojiButton label="Escolher outro registro" icon="search" variant="ghost" onPress={clearSelectedRegistry} />
                            </View>
                          )}
                        </View>
                      )}

                      <View style={st.stageActions}>
                        <Pressable onPress={submitting ? undefined : closeStage} style={st.cancelBtn}><Text style={st.cancelTxt}>Cancelar</Text></Pressable>
                        <ShojiButton
                          label={
                            submitting
                              ? "Aprovando..."
                              : registryChoice === "existing"
                                ? "Aprovar e transferir a conta"
                                : "Confirmar aprovação"
                          }
                          variant="accent"
                          onPress={approveReady ? () => handleApprove(row) : undefined}
                          style={!approveReady ? { opacity: 0.5 } : undefined}
                        />
                      </View>
                      {registryChoice === null && (
                        <Body muted style={st.blockedNote}>Escolha primeiro se este dojô já tem registro na federação.</Body>
                      )}
                      {registryChoice === "existing" && !selectedRegistry && (
                        <Body muted style={st.blockedNote}>Busque e selecione o registro para liberar a aprovação.</Body>
                      )}
                    </View>
                  )}

                  {isPending && isActive && mode === "reject" && (
                    <View style={st.stage}>
                      <Text style={st.stageTitle}>Recusar solicitação</Text>
                      <Body muted style={{ marginBottom: 10 }}>O motivo abaixo fica visível para o sensei do dojô.</Body>
                      <Text style={st.fieldLabel}>Motivo (obrigatório)</Text>
                      <TextInput
                        style={[st.input, st.inputMultiline]}
                        value={rejectReason}
                        onChangeText={setRejectReason}
                        placeholder="Ex.: dados de contato incompletos, endereço não confere..."
                        placeholderTextColor={C.ink4}
                        multiline
                        accessibilityLabel="Motivo da recusa"
                      />
                      <View style={st.stageActions}>
                        <Pressable onPress={submitting ? undefined : closeStage} style={st.cancelBtn}><Text style={st.cancelTxt}>Cancelar</Text></Pressable>
                        <ShojiButton
                          label={submitting ? "Recusando..." : "Confirmar recusa"}
                          variant="accent"
                          onPress={rejectReason.trim() && !submitting ? () => handleReject(row) : undefined}
                          style={!rejectReason.trim() ? { opacity: 0.5 } : undefined}
                        />
                      </View>
                    </View>
                  )}
                </Card>
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
  reasonBox: { backgroundColor: P.redWash, borderRadius: R.md, padding: 10, marginTop: 10 } as ViewStyle,
  reasonLabel: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", color: P.red, textTransform: "uppercase", letterSpacing: 0.4 } as TextStyle,
  reasonTxt: { fontFamily: F.body, fontSize: 12.5, color: C.ink, marginTop: 3, lineHeight: 17 } as TextStyle,
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line } as ViewStyle,
  stage: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line } as ViewStyle,
  stageTitle: { fontFamily: F.heading, fontSize: 15, fontWeight: "400", color: C.ink, marginBottom: 4 } as TextStyle,
  stageActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 12 } as ViewStyle,
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: R.sm, justifyContent: "center" } as ViewStyle,
  cancelTxt: { fontFamily: F.body, fontSize: 12.5, fontWeight: "600", color: C.ink3 } as TextStyle,
  fieldLabel: { fontFamily: F.body, fontSize: 11, fontWeight: "600", color: C.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 } as TextStyle,
  input: { fontFamily: F.body, fontSize: 13, color: C.ink, backgroundColor: P.glass2, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 10 } as any,
  inputMultiline: { minHeight: 76, textAlignVertical: "top" } as any,

  // ── F11: apontamento de registro ───────────────────────────
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 } as ViewStyle,
  hintBox: { flexDirection: "row", alignItems: "flex-start", gap: 7, backgroundColor: C.bg2, borderRadius: R.md, padding: 10, marginBottom: 4 } as ViewStyle,
  hintTxt: { fontSize: 12, lineHeight: 17, flex: 1, minWidth: 160 } as TextStyle,
  pickerBox: { marginTop: 10, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, padding: 12 } as ViewStyle,
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.glass2, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, paddingHorizontal: 10, paddingVertical: 8 } as ViewStyle,
  searchInput: { fontFamily: F.body, fontSize: 13, color: C.ink, flex: 1, minWidth: 120, paddingVertical: 2 } as any,
  suggestRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 } as ViewStyle,
  suggestNote: { fontSize: 11, lineHeight: 16, marginTop: 6 } as TextStyle,
  pickerHint: { fontSize: 12, lineHeight: 17, marginTop: 10 } as TextStyle,
  resultList: { marginTop: 10, gap: 6 } as ViewStyle,
  resultRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.bg2, borderRadius: R.md, paddingVertical: 9, paddingHorizontal: 11 } as ViewStyle,
  resultName: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: C.ink } as TextStyle,
  resultMetaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5, marginTop: 2 } as ViewStyle,
  resultMeta: { fontFamily: F.body, fontSize: 11, color: C.ink3 } as TextStyle,
  offPill: { backgroundColor: P.redWash, borderRadius: R.pill, paddingVertical: 2, paddingHorizontal: 8 } as ViewStyle,
  offPillTxt: { fontFamily: F.body, fontSize: 10, fontWeight: "700", color: P.red } as TextStyle,
  previewBox: { marginTop: 10, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, padding: 12, backgroundColor: C.bg2 } as ViewStyle,
  previewLabel: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", color: C.ink3, textTransform: "uppercase", letterSpacing: 0.4 } as TextStyle,
  previewName: { fontFamily: F.body, fontSize: 14, fontWeight: "600", color: C.ink, marginTop: 3 } as TextStyle,
  previewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 } as ViewStyle,
  previewItem: { flexDirection: "row", alignItems: "center", gap: 5 } as ViewStyle,
  previewTxt: { fontFamily: F.body, fontSize: 12, color: C.ink2 } as TextStyle,
  previewActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 } as ViewStyle,
  warnBox: { backgroundColor: P.redWash, borderRadius: R.md, padding: 10, marginTop: 12 } as ViewStyle,
  warnTitle: { fontFamily: F.body, fontSize: 11.5, fontWeight: "700", color: P.red } as TextStyle,
  warnTxt: { fontSize: 12, lineHeight: 17, marginTop: 4 } as TextStyle,
  errBox: { backgroundColor: P.redWash, borderRadius: R.md, padding: 10, marginTop: 12 } as ViewStyle,
  errTitle: { fontFamily: F.body, fontSize: 12.5, fontWeight: "600", color: C.ink, lineHeight: 18 } as TextStyle,
  errDetail: { fontSize: 11.5, lineHeight: 16, marginTop: 5 } as TextStyle,
  blockedNote: { fontSize: 11.5, textAlign: "right", marginTop: 6 } as TextStyle,
});
