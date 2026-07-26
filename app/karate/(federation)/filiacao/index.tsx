// ============================================================
// Filiações — Aura Karatê (federação) · Shoji (F6)
// Rota: /karate/filiacao — app/karate/(federation)/filiacao/index.tsx
//
// Inbox de pedidos de conexão/filiação vindos dos dojôs (contrato
// Aura-backend#424 + migration 252): GET .../affiliation-requests[?status],
// GET .../affiliation-requests/metrics, POST .../:id/approve|reject.
//
// É uma tela IRMÃ, não a mesma, de app/karate/(federation)/conexoes/*:
// "Conexões" ali é sobre SAÚDE DE SINCRONIZAÇÃO de dojôs já ligados
// (native/manual, eventos de sync) — um domínio totalmente diferente do
// que esta tela resolve, que é a PORTA DE ENTRADA (o dojô ainda nem está
// conectado). Nomes deliberadamente distintos ("Filiações" vs
// "Conexões") pra não confundir os dois fluxos.
//
// Decisão de UX (mesmo racional documentado em
// conexoes/solicitacoes/[requestId].tsx): TODA ação que muta fica em um
// estágio INLINE dentro do próprio card — nunca <Modal> (RN Web
// renderiza Modal-dentro-de-Modal atrás da tela, já mordeu este produto
// várias vezes). Só um card com estágio aberto por vez.
//
// A federação DEFINE o número de filiação no approve (o sistema NÃO
// gera) — texto explícito no estágio de aprovação.
// ============================================================
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, RefreshControl,
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

type Mode = "approve" | "reject" | null;

export default function FiliacoesScreen() {
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

  const closeStage = useCallback(() => {
    setActiveId(null); setMode(null); setFpktNumber(""); setRejectReason("");
  }, []);

  const handleApprove = useCallback(async (row: AffiliationRequestRow) => {
    const number = fpktNumber.trim();
    if (!number) return;
    setSubmitting(true);
    try {
      const res = await karateAffiliationApi.approve(federationId, row.id, number);
      toast.success(`${row.dojo?.name || "Dojô"} conectado — filiação ${res.fpkt_affiliation_id}.`);
      closeStage();
      await load();
    } catch (e: any) {
      if (e instanceof ApiError) {
        const code = e.data?.code;
        if (e.status === 422 && code === "FPKT_NUMBER_REQUIRED") {
          toast.error("Informe o número de filiação — a federação define esse número, o sistema não gera.");
        } else if (e.status === 409 && code === "FPKT_NUMBER_TAKEN") {
          toast.error("Esse número de filiação já está em uso por outro dojô.");
        } else if (e.status === 409 && code === "JA_RESOLVIDA") {
          toast.error("Esta solicitação já foi resolvida.");
          closeStage();
          await load();
        } else {
          toast.error(e.message || "Não foi possível aprovar a filiação.");
        }
      } else {
        toast.error("Não foi possível aprovar a filiação. Tente de novo.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [federationId, fpktNumber, closeStage, load]);

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
          sub="Pedidos de conexão vindos dos dojôs. A federação confere os dados de contato e define o número de filiação — o sistema não gera esse número sozinho."
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
              return (
                <Card key={row.id} style={{ marginBottom: 10 }}>
                  <View style={st.rowTop}>
                    <Avatar name={row.dojo?.name || "Dojô"} size={36} />
                    <View style={{ flex: 1, minWidth: 160 }}>
                      <Text style={st.name} numberOfLines={1}>{row.dojo?.name || "Dojô sem nome"}</Text>
                      <View style={st.nameMetaRow}>
                        <Body muted style={{ fontSize: 11.5 }} numberOfLines={1}>
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
                    <StatusPill status={row.status} />
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
                      <ShojiButton label="Aprovar" icon="checkmark-circle" variant="sumi" onPress={() => { setActiveId(row.id); setMode("approve"); }} />
                      <ShojiButton label="Recusar" icon="close-circle" variant="ghost" onPress={() => { setActiveId(row.id); setMode("reject"); }} />
                    </View>
                  )}

                  {isPending && isActive && mode === "approve" && (
                    <View style={st.stage}>
                      <Text style={st.stageTitle}>Aprovar filiação</Text>
                      <Body muted style={{ marginBottom: 10 }}>
                        Isso conecta {row.dojo?.name || "o dojô"} à federação. A federação DEFINE o número de filiação abaixo — o sistema não gera esse número.
                      </Body>
                      <Text style={st.fieldLabel}>Número de filiação (obrigatório)</Text>
                      <TextInput
                        style={st.input}
                        value={fpktNumber}
                        onChangeText={setFpktNumber}
                        placeholder="Ex.: 12345-D"
                        placeholderTextColor={C.ink4}
                        accessibilityLabel="Número de filiação"
                      />
                      <View style={st.stageActions}>
                        <Pressable onPress={submitting ? undefined : closeStage} style={st.cancelBtn}><Text style={st.cancelTxt}>Cancelar</Text></Pressable>
                        <ShojiButton
                          label={submitting ? "Aprovando..." : "Confirmar aprovação"}
                          variant="accent"
                          onPress={fpktNumber.trim() && !submitting ? () => handleApprove(row) : undefined}
                          style={!fpktNumber.trim() ? { opacity: 0.5 } : undefined}
                        />
                      </View>
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
  stageActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 10 } as ViewStyle,
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: R.sm, justifyContent: "center" } as ViewStyle,
  cancelTxt: { fontFamily: F.body, fontSize: 12.5, fontWeight: "600", color: C.ink3 } as TextStyle,
  fieldLabel: { fontFamily: F.body, fontSize: 11, fontWeight: "600", color: C.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 } as TextStyle,
  input: { fontFamily: F.body, fontSize: 13, color: C.ink, backgroundColor: P.glass2, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 10 } as any,
  inputMultiline: { minHeight: 76, textAlignVertical: "top" } as any,
});
