// ============================================================
// CadastralTab — Aba "Atualização cadastral" — Aura Karatê (federação) · Shoji
//
// Aba nova da tela de Dojôs (irmã de DojosListTab): acompanha o andamento
// da coleta cadastral por dojô — GET /federation/:id/dojos/roster-progress
// (default do backend: só dojôs ATIVOS, ver PR do backend). Substitui o
// antigo RosterProgressPanel (que vivia no header da lista de dojôs) —
// aqui ele ganha espaço de tela inteira: KPIs + tabela com ações por dojô.
//
// KPIs seguem a ordem "leitura mais útil primeiro": Não abriram é o
// PRIMEIRO — é onde a federação precisa agir. A tabela abaixo continua em
// ordem ALFABÉTICA (mesma convenção do resto da tela de Dojôs — quem usa
// já procura por nome), mas o pill de status de quem "não abriu" já
// chama atenção sozinho (cor + ícone), sem precisar reordenar a lista.
//
// "Sem contato" e "não abriu" são NEUTROS — trabalho a fazer, não erro.
// Nada de vermelho alarmista (P.red) em nenhum dos dois.
//
// Ações por dojô:
//   - Ainda não solicitado (requested_at nulo): botão "Solicitar
//     atualização" — MUTA (gera/renova o pedido, invalida o link
//     anterior), por isso passa por confirmação EXPLÍCITA antes de
//     disparar. A confirmação é um ESTÁGIO INLINE na própria linha (troca
//     os botões pela pergunta + Cancelar/Confirmar), NUNCA um <Modal> —
//     RN Web renderiza Modal-dentro-de-Modal atrás da tela (invisível,
//     no-op silencioso; já mordeu este produto 4×). Esta tela não vive
//     dentro de nenhum Modal, mas o padrão inline é mais simples e mais
//     seguro de qualquer forma (mesma decisão do portal do sensei, ver
//     app/karate/roster-update/[token].tsx).
//   - Já solicitado: "Copiar link do sensei" e "Copiar link do aluno".
//     roster-progress NÃO devolve os tokens (payload deliberadamente
//     enxuto); o link é buscado sob demanda (GET roster-validation) na
//     primeira cópia e cacheado localmente por dojô — clique seguinte não
//     refaz a chamada. Um novo "Solicitar atualização" (renovação) já
//     atualiza o cache direto com a resposta do POST.
//
// Fonte única: as mutações (solicitar atualização) escrevem no MESMO
// array `rows` que a tabela renderiza — nunca uma estrutura paralela
// (evita o "clique vira no-op silencioso" já visto neste produto).
//
// Condição de corrida: cada fetch carrega um id incremental; só a
// resposta MAIS RECENTE pode escrever no estado (mesmo padrão de
// DojosListTab).
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator,
  useWindowDimensions, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { toast } from "@/components";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP } from "@/constants/karateTheme";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { Skeleton } from "@/components/karate/Skeleton";
import { ShojiBackground, PageHead, Card, KpiBand, Mono, Body } from "@/components/karate/shoji";
import { copyToClipboard } from "@/utils/clipboard";
import {
  karateApi, DojoRosterProgress, RosterProgressStatus, RosterProgressSummary,
} from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

const STATUS_VIEW: Record<RosterProgressStatus, { label: string; color: string; bg: string; icon: string }> = {
  nao_aberto:   { label: "Não abriu",    color: P.neutral, bg: P.neutralWash, icon: "close-circle" },
  em_andamento: { label: "Em andamento", color: P.warn,    bg: P.warnWash,    icon: "time" },
  validado:     { label: "Validado",     color: P.ok,      bg: P.okWash,      icon: "checkmark-circle" },
};

const fmtDate = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

function StatusPill({ status }: { status: RosterProgressStatus }) {
  const v = STATUS_VIEW[status];
  return (
    <View style={[st.statusPill, { backgroundColor: v.bg }]}>
      <Icon name={v.icon as any} size={11} color={v.color} />
      <Text style={[st.statusPillTxt, { color: v.color }]}>{v.label}</Text>
    </View>
  );
}

// ── Cache de links por dojô (sensei/aluno) — evita refazer o GET
// roster-validation a cada clique de "copiar" no mesmo dojô. ─────────
type DojoLinks = { url: string | null; self_service_url: string | null };

// ── Botão de ação compacto (ícone + label), com spinner próprio enquanto
// `busy`. Reaproveitado nos três estados possíveis da célula de ações. ──
function ActionBtn({
  icon, label, onPress, busy, accessibilityLabel,
}: { icon: string; label: string; onPress: () => void; busy?: boolean; accessibilityLabel: string }) {
  return (
    <Pressable
      onPress={busy ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[st.actionBtn, busy && { opacity: 0.6 }]}
    >
      {busy ? <ActivityIndicator size="small" color={C.ink} /> : <Icon name={icon as any} size={13} color={C.ink} />}
      <Text style={st.actionBtnTxt} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// ── Estágio de confirmação INLINE (nunca Modal) — "Solicitar
// atualização" MUTA (gera/renova o pedido, invalida o link anterior), por
// isso exige confirmação explícita antes de disparar. ──────────────────
function InlineConfirm({
  message, onConfirm, onCancel, loading,
}: { message: string; onConfirm: () => void; onCancel: () => void; loading?: boolean }) {
  return (
    <View style={st.inlineConfirm}>
      <Text style={st.inlineConfirmText}>{message}</Text>
      <View style={st.inlineConfirmActions}>
        <Pressable onPress={loading ? undefined : onCancel} style={st.inlineCancelBtn} accessibilityRole="button" accessibilityLabel="Cancelar">
          <Text style={st.inlineCancelTxt}>Cancelar</Text>
        </Pressable>
        <Pressable onPress={loading ? undefined : onConfirm} style={st.inlineConfirmBtn} accessibilityRole="button" accessibilityLabel="Solicitar atualização">
          {loading ? <ActivityIndicator size="small" color="#fdf8f2" /> : <Text style={st.inlineConfirmBtnTxt}>Solicitar</Text>}
        </Pressable>
      </View>
    </View>
  );
}

// ── Célula/bloco de ações de UM dojô — estado próprio (confirmação,
// busy) fica no componente pai (uma linha por vez), passado via props,
// pra evitar duas linhas confirmando ao mesmo tempo (ruído visual). ────
function RowActions({
  row, confirming, requesting, copyingKind, onAskConfirm, onCancelConfirm, onConfirmRequest, onCopy,
}: {
  row: DojoRosterProgress;
  confirming: boolean;
  requesting: boolean;
  copyingKind: "sensei" | "aluno" | null;
  onAskConfirm: () => void;
  onCancelConfirm: () => void;
  onConfirmRequest: () => void;
  onCopy: (kind: "sensei" | "aluno") => void;
}) {
  if (confirming) {
    return (
      <InlineConfirm
        message={`Gerar um novo link para ${row.dojo_nome}? Se já havia um pedido em aberto, o link anterior deixa de funcionar.`}
        onConfirm={onConfirmRequest}
        onCancel={onCancelConfirm}
        loading={requesting}
      />
    );
  }
  if (!row.requested_at) {
    return (
      <View style={st.actionsRow}>
        <ActionBtn icon="send" label="Solicitar atualização" onPress={onAskConfirm} accessibilityLabel={`Solicitar atualização cadastral de ${row.dojo_nome}`} />
      </View>
    );
  }
  return (
    <View style={st.actionsRow}>
      <ActionBtn
        icon="user" label="Link do sensei"
        busy={copyingKind === "sensei"}
        onPress={() => onCopy("sensei")}
        accessibilityLabel={`Copiar link do sensei de ${row.dojo_nome}`}
      />
      <ActionBtn
        icon="people" label="Link do aluno"
        busy={copyingKind === "aluno"}
        onPress={() => onCopy("aluno")}
        accessibilityLabel={`Copiar link de auto-atendimento do aluno de ${row.dojo_nome}`}
      />
    </View>
  );
}

export function CadastralTab() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const { width } = useWindowDimensions();
  const wide = width >= 860;

  const [rows, setRows] = useState<DojoRosterProgress[]>([]);
  const [summary, setSummary] = useState<RosterProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fonte única de links já conhecidos por dojô (sensei/aluno) — populada
  // sob demanda (1º clique em "copiar") ou direto pela resposta do POST
  // de solicitação (já vem com o link pronto, sem precisar de outro GET).
  const [linksByDojo, setLinksByDojo] = useState<Record<string, DojoLinks>>({});

  // Só UMA linha por vez em confirmação/busy — evita ruído visual de
  // várias linhas "abertas" ao mesmo tempo.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [copyingKey, setCopyingKey] = useState<string | null>(null); // `${dojoId}:${kind}`

  // Condição de corrida: só a resposta MAIS RECENTE escreve no estado.
  const reqIdRef = useRef(0);

  const load = useCallback(async (isRefresh = false) => {
    if (!federationId) return;
    const myReq = ++reqIdRef.current;
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const res = await karateApi.getRosterProgress(federationId);
      if (myReq !== reqIdRef.current) return; // resposta obsoleta — descarta
      setRows(res.data || []);
      setSummary(res.summary || null);
    } catch {
      if (myReq !== reqIdRef.current) return;
      setError(true);
    } finally {
      if (myReq === reqIdRef.current) {
        isRefresh ? setRefreshing(false) : setLoading(false);
      }
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  const confirmRequest = useCallback(async (dojoId: string) => {
    setRequestingId(dojoId);
    try {
      const res = await karateApi.requestRosterUpdate(federationId, dojoId);
      // Fonte única: a mutação escreve no MESMO array `rows` que a tabela
      // renderiza (nunca uma estrutura paralela).
      setRows((prev) => prev.map((r) => (
        r.dojo_id === dojoId ? { ...r, requested_at: res.requested_at || new Date().toISOString() } : r
      )));
      setLinksByDojo((prev) => ({
        ...prev,
        [dojoId]: { url: res.url || null, self_service_url: res.self_service_url || null },
      }));
      toast.success("Solicitação enviada — link gerado");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível solicitar a atualização");
    } finally {
      setRequestingId(null);
      setConfirmingId(null);
    }
  }, [federationId]);

  const copyLink = useCallback(async (dojoId: string, kind: "sensei" | "aluno") => {
    const key = `${dojoId}:${kind}`;
    setCopyingKey(key);
    try {
      let links = linksByDojo[dojoId];
      if (!links) {
        const rv = await karateApi.getRosterValidation(federationId, dojoId);
        links = { url: rv.url || null, self_service_url: rv.self_service_url || null };
        setLinksByDojo((prev) => ({ ...prev, [dojoId]: links! }));
      }
      const link = kind === "sensei" ? links.url : links.self_service_url;
      if (!link) {
        toast.info("Link indisponível (expirado) — solicite a atualização de novo.");
        return;
      }
      const ok = await copyToClipboard(link);
      if (ok) toast.success("Link copiado");
      else toast.error("Não foi possível copiar o link");
    } catch {
      toast.error("Não foi possível carregar o link");
    } finally {
      setCopyingKey(null);
    }
  }, [federationId, linksByDojo]);

  const kpiItems = useMemo(() => ([
    { label: "Não abriram", value: summary?.nao_abriram ?? 0 },
    { label: "Em andamento", value: summary?.em_andamento ?? 0 },
    { label: "Validados", value: summary?.validados ?? 0 },
    { label: "Praticantes sem contato", value: summary?.praticantes_sem_contato ?? 0 },
  ]), [summary]);

  if (error) return <ShojiBackground><KarateErrorState onRetry={() => load()} /></ShojiBackground>;

  return (
    <ShojiBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={P.red} />}
      >
        <PageHead
          eyebrow={summary ? `${summary.total_dojos} ${summary.total_dojos === 1 ? "dojô ativo" : "dojôs ativos"}` : undefined}
          title="Atualização cadastral"
          sub="Andamento do pedido de atualização cadastral por dojô — quem já abriu o link, quem confirmou o quadro e quem ainda falta contato."
        />

        {loading ? (
          <><Skeleton height={100} style={{ marginTop: 16, marginBottom: 16, borderRadius: R.xl }} /><Skeleton height={280} style={{ borderRadius: R.xl }} /></>
        ) : rows.length === 0 ? (
          <KarateEmptyState
            icon="clipboard"
            title="Nenhum dojô ativo encontrado"
            subtitle="Não há dojôs ativos na federação para acompanhar."
            style={{ paddingVertical: 40, marginTop: 16 }}
          />
        ) : (
          <>
            <KpiBand items={kpiItems} style={{ marginTop: 16, marginBottom: 20 }} />

            <Card flush>
              {wide && (
                <View style={[st.tr, st.thead]}>
                  <View style={[st.colDivider, { flex: 2 }]}><Text style={st.th}>Dojô</Text></View>
                  <View style={[st.colDivider, { width: 150 }]}><Text style={st.th}>Status do pedido</Text></View>
                  <View style={[st.colDivider, { width: 120 }]}><Text style={st.th}>Último acesso</Text></View>
                  <View style={[st.colDivider, { width: 100 }]}><Text style={[st.th, { textAlign: "right" }]}>Sem contato</Text></View>
                  <View style={{ flex: 1.4 }}><Text style={st.th}>Ações</Text></View>
                </View>
              )}

              {rows.map((r) => {
                const confirming = confirmingId === r.dojo_id;
                const requesting = requestingId === r.dojo_id;
                const copyingKind = copyingKey?.startsWith(`${r.dojo_id}:`)
                  ? (copyingKey.split(":")[1] as "sensei" | "aluno")
                  : null;

                const actions = (
                  <RowActions
                    row={r}
                    confirming={confirming}
                    requesting={requesting}
                    copyingKind={copyingKind}
                    onAskConfirm={() => setConfirmingId(r.dojo_id)}
                    onCancelConfirm={() => setConfirmingId(null)}
                    onConfirmRequest={() => confirmRequest(r.dojo_id)}
                    onCopy={(kind) => copyLink(r.dojo_id, kind)}
                  />
                );

                if (wide) {
                  return (
                    <View key={r.dojo_id} style={st.tr}>
                      <View style={[st.colDivider, { flex: 2 }]}>
                        <Pressable onPress={() => router.push(`/karate/dojos/${r.dojo_id}` as any)} accessibilityRole="link" accessibilityLabel={`Ver ${r.dojo_nome}`}>
                          <Text style={st.dojoName} numberOfLines={1}>{r.dojo_nome}</Text>
                        </Pressable>
                      </View>
                      <View style={[st.colDivider, { width: 150 }]}><StatusPill status={r.status} /></View>
                      <View style={[st.colDivider, { width: 120 }]}><Body muted style={st.cell}>{fmtDate(r.last_accessed_at) || "—"}</Body></View>
                      <View style={[st.colDivider, { width: 100 }]}><Mono style={[st.cellNum, { textAlign: "right" }]}>{r.praticantes_sem_contato}</Mono></View>
                      <View style={{ flex: 1.4 }}>{actions}</View>
                    </View>
                  );
                }

                return (
                  <View key={r.dojo_id} style={st.card}>
                    <View style={st.cardTop}>
                      <Pressable style={{ flex: 1 }} onPress={() => router.push(`/karate/dojos/${r.dojo_id}` as any)} accessibilityRole="link" accessibilityLabel={`Ver ${r.dojo_nome}`}>
                        <Text style={st.dojoName} numberOfLines={1}>{r.dojo_nome}</Text>
                      </Pressable>
                      <StatusPill status={r.status} />
                    </View>
                    <View style={st.cardMeta}>
                      <View style={st.metaItem}><Icon name="time-outline" size={12} color={C.ink3} /><Text style={st.metaTxt}>{fmtDate(r.last_accessed_at) ? `Acesso em ${fmtDate(r.last_accessed_at)}` : "Ainda sem acesso"}</Text></View>
                      <View style={st.metaItem}><Icon name="people-outline" size={12} color={C.ink3} /><Text style={st.metaTxt}>{r.praticantes_sem_contato} sem contato</Text></View>
                    </View>
                    {actions}
                  </View>
                );
              })}
            </Card>
          </>
        )}
      </ScrollView>
    </ShojiBackground>
  );
}


const styles = StyleSheet.create({
  content: { paddingHorizontal: 40, paddingTop: 48, paddingBottom: 72, maxWidth: SP.contentMax, width: "100%", alignSelf: "center" } as ViewStyle,
});

const st = StyleSheet.create({
  tr: { flexDirection: "row", alignItems: "center", paddingVertical: 13, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: C.line, gap: 8 } as ViewStyle,
  thead: { paddingVertical: 10, backgroundColor: P.paper2 } as ViewStyle,
  colDivider: { borderRightWidth: 1, borderRightColor: "rgba(43,38,32,0.055)", paddingRight: 14 } as ViewStyle,
  th: { fontFamily: F.body, fontSize: 10, fontWeight: "600", color: C.ink3, textTransform: "uppercase", letterSpacing: 1 } as TextStyle,
  cell: { fontSize: 12.5 } as TextStyle,
  cellNum: { fontSize: 12.5, color: C.ink } as TextStyle,
  dojoName: { fontFamily: F.body, fontSize: 14, fontWeight: "600", color: C.ink } as TextStyle,

  card: { backgroundColor: P.glass, borderWidth: 1, borderColor: C.line, borderRadius: R.lg, padding: 14, gap: 10, marginHorizontal: 16, marginVertical: 6 } as ViewStyle,
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "space-between" } as ViewStyle,
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 14 } as ViewStyle,
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 } as ViewStyle,
  metaTxt: { fontFamily: F.body, fontSize: 12, color: C.ink3 } as TextStyle,

  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 9, borderRadius: R.pill, alignSelf: "flex-start" } as ViewStyle,
  statusPillTxt: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700" } as TextStyle,

  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 7, paddingHorizontal: 10, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, backgroundColor: P.glass2 } as ViewStyle,
  actionBtnTxt: { fontFamily: F.body, fontSize: 11.5, fontWeight: "600", color: C.ink } as TextStyle,

  inlineConfirm: { backgroundColor: P.neutralWash, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, padding: 10, flex: 1 } as ViewStyle,
  inlineConfirmText: { fontFamily: F.body, fontSize: 12, color: C.ink, lineHeight: 17, marginBottom: 8 } as TextStyle,
  inlineConfirmActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 } as ViewStyle,
  inlineCancelBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: R.sm } as ViewStyle,
  inlineCancelTxt: { fontFamily: F.body, fontSize: 12, fontWeight: "600", color: C.ink3 } as TextStyle,
  inlineConfirmBtn: { backgroundColor: C.ink, borderRadius: R.sm, paddingVertical: 8, paddingHorizontal: 14, minWidth: 84, alignItems: "center" } as ViewStyle,
  inlineConfirmBtnTxt: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: "#fdf8f2" } as TextStyle,
});
