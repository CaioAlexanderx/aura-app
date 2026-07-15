// ============================================================
// Detalhe/decisão de solicitação de praticante — Aura Karatê (federação)
// (H3 — fila de solicitações em Conexões)
//
// Lado a lado, SEM paginação: dados do sensei × possíveis correspondências
// (dedup, sugestão — nunca decide sozinha). Ações: Aprovar como criação
// (pede número FPKT), Aprovar como transferência (escolhe pessoa
// existente), Editar antes de aprovar (deliberado), Rejeitar com motivo.
//
// 🔴 REGRA CRÍTICA (item 2): aprovar como transferência NUNCA sobrescreve
// karate_belt_history nem anuidade — a faixa alegada aqui é só para
// COMPARAR. O texto de confirmação deixa isso explícito na tela, e o
// backend (karatePractitionerRequestsAdmin.js#approve-transfer) garante
// isso — coberto por teste no aura-backend.
//
// Toda ação que MUTA passa por um estágio de confirmação INLINE (nunca
// <Modal> — RN Web renderiza Modal-dentro-de-Modal atrás da tela,
// já mordeu este produto 5x) mostrando O QUE vai acontecer e COM QUEM.
// Só um estágio aberto por vez.
//
// Depois de uma decisão bem-sucedida, router.back() — a fila
// (SolicitacoesTab) refaz a busca sozinha no foco (useFocusEffect),
// fonte única, sem tentar sincronizar estado entre as duas telas.
// Exceção: rejeitar fica na tela (estágio "rejected-done") pra mostrar o
// botão "Avisar o dojô no WhatsApp" (wa.me simples, click-to-chat — a
// federação decide se clica, nada automático) antes do router.back(). O
// mesmo botão também aparece depois, reabrindo o detalhe de uma
// solicitação já rejeitada — a federação pode querer avisar depois, não
// só no calor do momento.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, TextInput, Pressable,
  useWindowDimensions, StyleSheet, ViewStyle, TextStyle, Platform, Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { toast } from "@/components";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP } from "@/constants/karateTheme";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { Skeleton } from "@/components/karate/Skeleton";
import { ShojiBackground, Card, ShojiButton, Avatar, Body, KV, Mono } from "@/components/karate/shoji";
import {
  karateApi, PractitionerRequestAdminRow, PossibleMatch, EditPractitionerRequestBody, RejectRequestResult,
} from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { buildWaMeUrl } from "@/services/messaging";

const STATUS_VIEW: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pendente:  { label: "Pendente",  color: P.warn, bg: P.warnWash, icon: "hourglass" },
  aprovada:  { label: "Aprovada",  color: P.ok,   bg: P.okWash,   icon: "checkmark-circle" },
  rejeitada: { label: "Rejeitada", color: P.red,  bg: P.redWash,  icon: "close-circle" },
};

const CONFIDENCE_VIEW: Record<string, { label: string; color: string }> = {
  high:   { label: "Correspondência forte",   color: P.ok },
  medium: { label: "Correspondência média",   color: P.warn },
  low:    { label: "Correspondência fraca",   color: C.ink3 },
};

const MATCHED_ON_LABEL: Record<string, string> = {
  fpkt_number: "mesmo número FPKT",
  name_birthdate: "nome + nascimento",
  rg: "mesmo RG",
  cpf: "mesmo CPF",
};

// ⚠️ BUGFIX (15/07/2026) — data de nascimento aparecia UM DIA ATRÁS.
// `new Date("2011-04-18")` parseia como UTC meia-noite; no fuso de Brasília
// (UTC-3) isso vira 17/04/2011 21:00 e o toLocaleDateString mostra "17/04/2011".
// É a mesma família do P0 do backend (data do driver pg como Date), agora no
// front. birth_date é DATA PURA (sem hora, sem fuso) — não pode passar por
// new Date(iso). Isso é grave: elegibilidade de categoria infantil depende
// da data de nascimento correta.
// fmtDateTime abaixo continua usando new Date() de propósito: ali o valor é
// timestamptz de verdade (created_at/resolved_at), onde o fuso local é o certo.
function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (m) {
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y}`;   // sem Date, sem fuso, sem perder um dia
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

type Stage = "none" | "create" | "transfer" | "edit" | "reject" | "rejected-done";

function Field({ label, value, onChangeText, placeholder, multiline }: {
  label: string; value: string; onChangeText: (t: string) => void; placeholder?: string; multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={st.fieldLabel}>{label}</Text>
      <TextInput
        style={[st.input, multiline && { minHeight: 76, textAlignVertical: "top" }] as any}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.ink4}
        multiline={multiline}
      />
    </View>
  );
}

// ── Botão "Avisar o dojô no WhatsApp" (pós-rejeição) ────────────────────
// wa.me simples, click-to-chat — a federação decide se clica, nada
// automático/agendado. Mensagem curta, linguagem de gestor (quem lê é o
// sensei): identificação da federação, item que precisa de ajuste, motivo
// escrito pela federação, e o link pra corrigir e reenviar (mesmo link do
// sensei que a rejeição reabre no backend). Sem tecniquês, sem emoji.
function buildDojoNoticeMessage(
  federationName: string, fullName: string, reason: string, rosterUrl: string | null,
): string {
  const fed = federationName || "a federação";
  return [
    `Olá! Aqui é a ${fed}.`,
    `A solicitação de cadastro de ${fullName} precisa de um ajuste antes de seguir.`,
    `Motivo: ${reason}`,
    rosterUrl
      ? `Corrija e reenvie por aqui: ${rosterUrl}`
      : "Entre em contato com a federação para reenviar a solicitação corrigida.",
  ].join("\n\n");
}

function openWhatsapp(url: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
  } else {
    Linking.openURL(url);
  }
}

// Reusado tanto logo após rejeitar (estágio "rejected-done") quanto ao
// reabrir o detalhe de uma solicitação já rejeitada — mesma fonte de
// verdade (dojo_whatsapp_phone/dojo_roster_update_url vêm sempre do
// backend, celular > fixo já resolvido lá; nunca recalculado aqui).
function DojoWhatsappNotice({ fullName, reason, whatsappPhone, rosterUrl, federationName }: {
  fullName: string; reason: string | null; whatsappPhone: string | null | undefined;
  rosterUrl: string | null | undefined; federationName: string;
}) {
  const message = buildDojoNoticeMessage(federationName, fullName, reason || "—", rosterUrl || null);
  const url = buildWaMeUrl(whatsappPhone, message);
  return (
    <View style={{ marginTop: 10 }}>
      <ShojiButton
        label="Avisar o dojô no WhatsApp"
        icon="logo-whatsapp"
        variant="accent"
        onPress={url ? () => openWhatsapp(url) : undefined}
        style={[{ backgroundColor: "#25D366" }, !url && { opacity: 0.5 }]}
      />
      {!url && (
        <Body muted style={{ fontSize: 11.5, marginTop: 6 }}>Dojô sem telefone cadastrado.</Body>
      )}
    </View>
  );
}

export default function SolicitacaoDetalhe() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const { federationId, federationName } = useKarateFederation();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const id = String(requestId || "");

  const [detail, setDetail] = useState<PractitionerRequestAdminRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stage, setStage] = useState<Stage>("none");
  const [submitting, setSubmitting] = useState(false);

  // ── Estágio "Aprovar como criação" ──────────────────────────
  const [fpktNumber, setFpktNumber] = useState("");

  // ── Estágio "Aprovar como transferência" ────────────────────
  const [selectedMatch, setSelectedMatch] = useState<PossibleMatch | null>(null);
  const [manualPractitionerId, setManualPractitionerId] = useState("");

  // ── Estágio "Editar antes de aprovar" ───────────────────────
  const [editForm, setEditForm] = useState<EditPractitionerRequestBody>({});

  // ── Estágio "Rejeitar" ───────────────────────────────────────
  const [rejectReason, setRejectReason] = useState("");
  // Preenchido só após rejeitar com sucesso — alimenta o botão "Avisar o
  // dojô no WhatsApp" no estágio "rejected-done". Não duplica `detail`:
  // é um dado NOVO que só existe depois da rejeição confirmada.
  const [rejectResult, setRejectResult] = useState<RejectRequestResult | null>(null);

  const load = useCallback(() => {
    if (!federationId || !id) return;
    setLoading(true);
    setError(false);
    karateApi.getPractitionerRequestAdmin(federationId, id)
      .then((d) => {
        setDetail(d);
        setEditForm({
          full_name: d.full_name,
          birth_date: d.birth_date,
          cpf: d.cpf,
          rg: d.rg,
          phone: d.phone,
          email: d.email,
          claimed_belt: d.claimed_belt,
          fpkt_number_claimed: d.fpkt_number_claimed,
        });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [federationId, id]);
  useEffect(() => { load(); }, [load]);

  const closeStage = useCallback(() => {
    setStage("none");
    setFpktNumber("");
    setSelectedMatch(null);
    setManualPractitionerId("");
    setRejectReason("");
    setRejectResult(null);
  }, []);

  const handleApproveCreate = useCallback(async () => {
    if (!detail || !fpktNumber.trim()) return;
    setSubmitting(true);
    try {
      const res = await karateApi.approveCreatePractitionerRequest(federationId, detail.id, fpktNumber.trim());
      toast.success(`${res.practitioner.name} cadastrado(a) com a matrícula ${res.practitioner.karate_registration_number}.`);
      router.back();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível aprovar como criação.");
    } finally {
      setSubmitting(false);
    }
  }, [detail, fpktNumber, federationId, router]);

  const handleApproveTransfer = useCallback(async () => {
    if (!detail) return;
    const practitionerId = selectedMatch?.practitioner_id || manualPractitionerId.trim();
    if (!practitionerId) return;
    setSubmitting(true);
    try {
      await karateApi.approveTransferPractitionerRequest(federationId, detail.id, practitionerId);
      toast.success("Transferência aprovada — o histórico de faixa e anuidade da pessoa foi preservado.");
      router.back();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível aprovar a transferência.");
    } finally {
      setSubmitting(false);
    }
  }, [detail, selectedMatch, manualPractitionerId, federationId, router]);

  const handleSaveEdit = useCallback(async () => {
    if (!detail) return;
    if (editForm.birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(editForm.birth_date)) {
      toast.error("Nascimento deve estar no formato AAAA-MM-DD.");
      return;
    }
    setSubmitting(true);
    try {
      const updated = await karateApi.editPractitionerRequestAdmin(federationId, detail.id, editForm);
      setDetail((prev) => (prev ? { ...prev, ...updated } : updated));
      toast.success("Solicitação atualizada.");
      closeStage();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar a edição.");
    } finally {
      setSubmitting(false);
    }
  }, [detail, editForm, federationId, closeStage]);

  const handleReject = useCallback(async () => {
    if (!detail || !rejectReason.trim()) return;
    setSubmitting(true);
    try {
      const res = await karateApi.rejectPractitionerRequestAdmin(federationId, detail.id, rejectReason.trim());
      toast.success(
        res.dojo_access_reopened
          ? "Solicitação rejeitada — o link do dojô foi reaberto para o sensei ver o motivo e reenviar."
          : "Solicitação rejeitada."
      );
      // Fica na tela (estágio "rejected-done") pra mostrar o botão "Avisar
      // o dojô no WhatsApp" — router.back() só depois, quando a federação
      // decidir (botão "Voltar para Solicitações" abaixo).
      setRejectResult(res);
      setStage("rejected-done");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível rejeitar a solicitação.");
    } finally {
      setSubmitting(false);
    }
  }, [detail, rejectReason, federationId]);

  const payload = detail?.payload || {};
  const enderecoLine = useMemo(() => {
    const parts = [
      payload.street && payload.number ? `${payload.street}, ${payload.number}` : payload.street,
      payload.complement, payload.neighborhood, payload.city && payload.state ? `${payload.city}/${payload.state}` : payload.city,
      payload.zip_code,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : null;
  }, [payload]);
  const guardianLine = useMemo(() => {
    if (!payload.guardian_name) return null;
    const parts = [payload.guardian_name, payload.guardian_relationship, payload.guardian_phone].filter(Boolean);
    return parts.join(" · ");
  }, [payload]);

  if (loading) {
    return (
      <ShojiBackground>
        <View style={styles.content}>
          <Skeleton height={40} width={160} style={{ marginBottom: 20 }} />
          <Skeleton height={140} style={{ marginBottom: 16, borderRadius: R.xl }} />
          <Skeleton height={280} style={{ borderRadius: R.xl }} />
        </View>
      </ShojiBackground>
    );
  }
  if (error || !detail) return <ShojiBackground><KarateErrorState onRetry={load} /></ShojiBackground>;

  const sv = STATUS_VIEW[detail.status] || STATUS_VIEW.pendente;
  const isPending = detail.status === "pendente";

  return (
    <ShojiBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={st.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar para Solicitações">
          <Icon name="chevron-back" size={18} color={P.red} />
          <Text style={st.backText}>Solicitações</Text>
        </Pressable>

        <View style={st.header}>
          <Avatar name={detail.full_name} size={48} dark />
          <View style={{ flex: 1, minWidth: 200 }}>
            <Text style={st.eyebrow}>{detail.dojo_name || "Dojô sem nome"} · solicitado em {fmtDateTime(detail.created_at)}</Text>
            <Text style={st.title}>{detail.full_name}</Text>
          </View>
          <View style={[st.statusPill, { backgroundColor: sv.bg }]}>
            <Icon name={sv.icon as any} size={13} color={sv.color} />
            <Text style={[st.statusPillTxt, { color: sv.color }]}>{sv.label}</Text>
          </View>
        </View>

        {!isPending && (
          <Card style={{ marginTop: 16 }}>
            {detail.status === "aprovada" ? (
              <>
                <Text style={st.cardTitle}>Solicitação aprovada</Text>
                <Body muted style={{ marginTop: 6 }}>
                  {detail.resolution === "created"
                    ? "Aprovada como CRIAÇÃO — o praticante foi cadastrado no dojô da solicitação."
                    : "Aprovada como TRANSFERÊNCIA — vinculada a um praticante já existente; histórico preservado."}
                  {" "}Resolvida em {fmtDateTime(detail.resolved_at)}.
                </Body>
              </>
            ) : (
              <>
                <Text style={st.cardTitle}>Solicitação rejeitada</Text>
                <Body muted style={{ marginTop: 6 }}>Motivo: {detail.reject_reason || "—"}</Body>
                <Body muted style={{ marginTop: 4, fontSize: 11.5 }}>Resolvida em {fmtDateTime(detail.resolved_at)}.</Body>
                {/* Disponível depois, não só no calor do momento do reject — a
                    federação pode voltar aqui e avisar o dojô mais tarde. */}
                <DojoWhatsappNotice
                  fullName={detail.full_name}
                  reason={detail.reject_reason}
                  whatsappPhone={detail.dojo_whatsapp_phone}
                  rosterUrl={detail.dojo_roster_update_url}
                  federationName={federationName}
                />
              </>
            )}
          </Card>
        )}

        <View style={[st.grid, wide && st.gridWide]}>
          <Card style={[st.gridCol, { marginTop: 16 }]}>
            <Text style={st.cardTitle}>Dados do sensei</Text>
            <Body muted style={{ fontSize: 11.5, marginBottom: 10 }}>Ficha enviada pelo dojô — a federação confere, não redigita.</Body>
            <View style={st.identityStrip}>
              <View style={st.identityChip}>
                <Icon name="calendar-outline" size={12} color={C.ink3} />
                <Text style={st.identityChipText}>{fmtDate(detail.birth_date)}</Text>
              </View>
              <View style={[st.identityChip, st.identityChipClaimed]}>
                <Icon name="ribbon-outline" size={12} color={P.red} />
                <Text style={st.identityChipClaimedText}>{detail.claimed_belt || "Faixa não alegada"}</Text>
                <Text style={st.identityChipTag}>ALEGADA</Text>
              </View>
              <View style={st.identityChip}>
                <Icon name="barcode" size={12} color={C.ink3} />
                <Mono style={st.identityChipMono}>{detail.fpkt_number_claimed || "Sem número alegado"}</Mono>
              </View>
            </View>
            <KV k="Nome completo" v={detail.full_name} />
            <KV k="CPF" v={detail.cpf} />
            <KV k="RG" v={detail.rg} />
            <KV k="Telefone" v={detail.phone} />
            <KV k="E-mail" v={detail.email} />
            <KV k="Endereço" v={enderecoLine} />
            <KV k="Responsável" v={guardianLine} />
            <KV k="Canal" v={detail.requested_by_label || detail.requested_by_channel} />
          </Card>

          <Card style={[st.gridCol, { marginTop: 16 }]}>
            <Text style={st.cardTitle}>Possíveis correspondências</Text>
            <Body muted style={{ fontSize: 11.5, marginBottom: 10 }}>
              Sugestão de correspondência — a federação decide, nunca é automático. Compare nome e nascimento com a
              ficha ao lado antes de escolher.
            </Body>
            {(!detail.possible_matches || detail.possible_matches.length === 0) ? (
              <Body muted style={{ paddingVertical: 8 }}>Nenhuma correspondência encontrada — provável criação nova.</Body>
            ) : (
              detail.possible_matches.map((m) => {
                const cv = CONFIDENCE_VIEW[m.confidence] || CONFIDENCE_VIEW.low;
                return (
                  <View key={m.practitioner_id} style={st.matchRow}>
                    <View style={{ flex: 1, minWidth: 160 }}>
                      <Text style={st.matchName}>{m.name}</Text>
                      <Body muted style={{ fontSize: 11.5 }}>
                        {m.dojo_name || "Dojô não identificado"}{m.karate_registration_number ? ` · ${m.karate_registration_number}` : ""}
                      </Body>
                      <View style={st.matchTags}>
                        <Text style={[st.matchConfidence, { color: cv.color }]}>{cv.label}</Text>
                        {m.matched_on.map((k) => (
                          <View key={k} style={st.matchTag}><Text style={st.matchTagTxt}>{MATCHED_ON_LABEL[k] || k}</Text></View>
                        ))}
                      </View>
                    </View>
                    {isPending && (
                      <ShojiButton
                        label="Usar esta pessoa"
                        variant="ghost"
                        icon="swap-horizontal"
                        onPress={() => { setSelectedMatch(m); setStage("transfer"); }}
                      />
                    )}
                  </View>
                );
              })
            )}
          </Card>
        </View>

        {isPending && (
          <Card style={{ marginTop: 16 }}>
            {stage === "none" && (
              <View style={st.actionsRow}>
                <ShojiButton label="Aprovar como criação" icon="person" variant="sumi" onPress={() => setStage("create")} />
                <ShojiButton label="Aprovar como transferência" icon="swap-horizontal" variant="ghost" onPress={() => setStage("transfer")} />
                <ShojiButton label="Editar antes de aprovar" icon="create" variant="ghost" onPress={() => setStage("edit")} />
                <ShojiButton label="Rejeitar" icon="close-circle" variant="ghost" onPress={() => setStage("reject")} />
              </View>
            )}

            {stage === "create" && (
              <View>
                <Text style={st.stageTitle}>Aprovar como criação</Text>
                <Body muted style={{ marginBottom: 10 }}>
                  Isso cria {detail.full_name} como praticante NOVO no dojô {detail.dojo_name || "da solicitação"}, ativo, e a faixa alegada
                  ({detail.claimed_belt || "não informada"}) vira o primeiro registro do histórico.
                </Body>
                <Field label="Número FPKT (obrigatório — emitido pela federação)" value={fpktNumber} onChangeText={setFpktNumber} placeholder="Ex.: 12345-D" />
                <View style={st.stageActions}>
                  <Pressable onPress={submitting ? undefined : closeStage} style={st.cancelBtn}><Text style={st.cancelTxt}>Cancelar</Text></Pressable>
                  <ShojiButton
                    label={submitting ? "Aprovando..." : "Confirmar criação"}
                    variant="accent"
                    onPress={fpktNumber.trim() && !submitting ? handleApproveCreate : undefined}
                    style={!fpktNumber.trim() ? { opacity: 0.5 } : undefined}
                  />
                </View>
              </View>
            )}

            {stage === "transfer" && (
              <View>
                <Text style={st.stageTitle}>Aprovar como transferência</Text>
                {selectedMatch ? (
                  <Body style={{ marginBottom: 10 }}>
                    Isso vincula a solicitação a <Text style={{ fontWeight: "700" }}>{selectedMatch.name}</Text>
                    {selectedMatch.karate_registration_number ? ` (matrícula ${selectedMatch.karate_registration_number})` : ""}
                    {selectedMatch.dojo_id && selectedMatch.dojo_id === detail.dojo_id ? (
                      // Origem === destino (ex.: recadastro, número FPKT bate com quem já
                      // está no dojô do sensei) — "move para onde já está" soa erro de
                      // cópia. Copy honesta: só vincula, sem mudança de dojô.
                      <> — já está em {detail.dojo_name || "este dojô"}. A solicitação só será vinculada a esta pessoa, sem mudança de dojô.</>
                    ) : (
                      <>, hoje em {selectedMatch.dojo_name || "outro dojô"}, e move para {detail.dojo_name || "o dojô da solicitação"}.</>
                    )}{" "}
                    <Text style={{ fontWeight: "700" }}>O histórico de faixa e a anuidade de {selectedMatch.name} NÃO mudam</Text> — a faixa alegada aqui
                    ({detail.claimed_belt || "não informada"}) é só para comparação, nunca é aplicada.
                  </Body>
                ) : (
                  <>
                    <Body muted style={{ marginBottom: 10 }}>
                      Escolha "Usar esta pessoa" numa correspondência acima, ou informe o ID do praticante já cadastrado. O histórico de faixa e
                      anuidade da pessoa NÃO muda — a faixa alegada é só para comparação.
                    </Body>
                    <Field label="ID do praticante existente" value={manualPractitionerId} onChangeText={setManualPractitionerId} placeholder="UUID do praticante" />
                  </>
                )}
                <View style={st.stageActions}>
                  <Pressable onPress={submitting ? undefined : closeStage} style={st.cancelBtn}><Text style={st.cancelTxt}>Cancelar</Text></Pressable>
                  <ShojiButton
                    label={submitting ? "Aprovando..." : "Confirmar transferência"}
                    variant="accent"
                    onPress={(selectedMatch || manualPractitionerId.trim()) && !submitting ? handleApproveTransfer : undefined}
                    style={!(selectedMatch || manualPractitionerId.trim()) ? { opacity: 0.5 } : undefined}
                  />
                </View>
              </View>
            )}

            {stage === "edit" && (
              <View>
                <Text style={st.stageTitle}>Editar antes de aprovar</Text>
                <Body muted style={{ marginBottom: 10 }}>Correção deliberada — fica registrada. Não afeta a ficha original enviada pelo sensei.</Body>
                <Field label="Nome completo" value={editForm.full_name || ""} onChangeText={(t) => setEditForm((p) => ({ ...p, full_name: t }))} />
                <Field label="Nascimento (AAAA-MM-DD)" value={editForm.birth_date || ""} onChangeText={(t) => setEditForm((p) => ({ ...p, birth_date: t || null }))} placeholder="2012-03-01" />
                <Field label="CPF" value={editForm.cpf || ""} onChangeText={(t) => setEditForm((p) => ({ ...p, cpf: t || null }))} />
                <Field label="RG" value={editForm.rg || ""} onChangeText={(t) => setEditForm((p) => ({ ...p, rg: t || null }))} />
                <Field label="Telefone" value={editForm.phone || ""} onChangeText={(t) => setEditForm((p) => ({ ...p, phone: t || null }))} />
                <Field label="E-mail" value={editForm.email || ""} onChangeText={(t) => setEditForm((p) => ({ ...p, email: t || null }))} />
                <Field label="Faixa alegada" value={editForm.claimed_belt || ""} onChangeText={(t) => setEditForm((p) => ({ ...p, claimed_belt: t || null }))} />
                <Field label="Número FPKT alegado" value={editForm.fpkt_number_claimed || ""} onChangeText={(t) => setEditForm((p) => ({ ...p, fpkt_number_claimed: t || null }))} />
                <View style={st.stageActions}>
                  <Pressable onPress={submitting ? undefined : closeStage} style={st.cancelBtn}><Text style={st.cancelTxt}>Cancelar</Text></Pressable>
                  <ShojiButton label={submitting ? "Salvando..." : "Salvar edição"} variant="sumi" onPress={submitting ? undefined : handleSaveEdit} />
                </View>
              </View>
            )}

            {stage === "reject" && (
              <View>
                <Text style={st.stageTitle}>Rejeitar solicitação</Text>
                <Body muted style={{ marginBottom: 10 }}>
                  O motivo fica visível para o sensei no link do dojô — o acesso é reaberto automaticamente para ele ver e reenviar corrigido.
                </Body>
                <Field label="Motivo (obrigatório)" value={rejectReason} onChangeText={setRejectReason} placeholder="Ex.: CPF inválido, foto ilegível..." multiline />
                <View style={st.stageActions}>
                  <Pressable onPress={submitting ? undefined : closeStage} style={st.cancelBtn}><Text style={st.cancelTxt}>Cancelar</Text></Pressable>
                  <ShojiButton
                    label={submitting ? "Rejeitando..." : "Confirmar rejeição"}
                    variant="accent"
                    onPress={rejectReason.trim() && !submitting ? handleReject : undefined}
                    style={!rejectReason.trim() ? { opacity: 0.5 } : undefined}
                  />
                </View>
              </View>
            )}

            {stage === "rejected-done" && rejectResult && (
              <View>
                <Text style={st.stageTitle}>Solicitação rejeitada</Text>
                <Body muted style={{ marginBottom: 10 }}>
                  Motivo enviado ao sensei: {rejectResult.reject_reason}
                  {rejectResult.dojo_access_reopened
                    ? " O link do dojô foi reaberto para ele ver e reenviar corrigido."
                    : ""}
                </Body>
                <DojoWhatsappNotice
                  fullName={detail.full_name}
                  reason={rejectResult.reject_reason}
                  whatsappPhone={rejectResult.dojo_whatsapp_phone}
                  rosterUrl={rejectResult.dojo_roster_update_url}
                  federationName={federationName}
                />
                <View style={st.stageActions}>
                  <ShojiButton label="Voltar para Solicitações" variant="ghost" onPress={() => router.back()} />
                </View>
              </View>
            )}
          </Card>
        )}
      </ScrollView>
    </ShojiBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: 40, paddingTop: 48, paddingBottom: 72, maxWidth: SP.contentMax, width: "100%", alignSelf: "center" } as ViewStyle,
});

const st = StyleSheet.create({
  back: { flexDirection: "row", alignItems: "center", gap: 2 } as ViewStyle,
  backText: { fontFamily: F.body, fontSize: 13, fontWeight: "700", color: P.red } as TextStyle,
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 16, flexWrap: "wrap" } as ViewStyle,
  eyebrow: { fontFamily: F.body, fontSize: 11.5, color: C.ink3 } as TextStyle,
  title: { fontFamily: F.heading, fontSize: 24, fontWeight: "400", color: C.ink, marginTop: 2 } as TextStyle,
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 5, paddingHorizontal: 11, borderRadius: R.pill } as ViewStyle,
  statusPillTxt: { fontFamily: F.body, fontSize: 11.5, fontWeight: "700" } as TextStyle,
  cardTitle: { fontFamily: F.heading, fontSize: 16, fontWeight: "400", color: C.ink } as TextStyle,
  identityStrip: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  identityChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: P.glass2, borderWidth: 1, borderColor: C.line2, borderRadius: R.pill, paddingVertical: 6, paddingHorizontal: 11 } as ViewStyle,
  identityChipText: { fontFamily: F.body, fontSize: 12, fontWeight: "600", color: C.ink } as TextStyle,
  identityChipClaimed: { backgroundColor: P.redWash, borderColor: P.redLine } as ViewStyle,
  identityChipClaimedText: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: P.red } as TextStyle,
  identityChipTag: { fontFamily: F.body, fontSize: 8.5, fontWeight: "800", color: P.red, opacity: 0.75, letterSpacing: 0.5 } as TextStyle,
  identityChipMono: { fontSize: 12, color: C.ink } as TextStyle,
  grid: { flexDirection: "column", gap: 0 } as ViewStyle,
  gridWide: { flexDirection: "row", gap: 16 } as ViewStyle,
  gridCol: { flex: 1 } as ViewStyle,
  matchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line, flexWrap: "wrap" } as ViewStyle,
  matchName: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: C.ink } as TextStyle,
  matchTags: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 } as ViewStyle,
  matchConfidence: { fontFamily: F.body, fontSize: 11, fontWeight: "700" } as TextStyle,
  matchTag: { backgroundColor: P.glass2, borderWidth: 1, borderColor: P.line2, borderRadius: R.pill, paddingVertical: 2, paddingHorizontal: 8 } as ViewStyle,
  matchTagTxt: { fontFamily: F.body, fontSize: 10, color: C.ink3 } as TextStyle,
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 } as ViewStyle,
  stageTitle: { fontFamily: F.heading, fontSize: 16, fontWeight: "400", color: C.ink, marginBottom: 8 } as TextStyle,
  stageActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 } as ViewStyle,
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: R.sm, justifyContent: "center" } as ViewStyle,
  cancelTxt: { fontFamily: F.body, fontSize: 12.5, fontWeight: "600", color: C.ink3 } as TextStyle,
  fieldLabel: { fontFamily: F.body, fontSize: 11, fontWeight: "600", color: C.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 } as TextStyle,
  input: { fontFamily: F.body, fontSize: 13, color: C.ink, backgroundColor: P.glass2, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 10 } as any,
});
