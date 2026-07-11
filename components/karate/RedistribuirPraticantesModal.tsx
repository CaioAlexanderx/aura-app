// ============================================================
// RedistribuirPraticantesModal — Aura Karatê (federação) · Shoji
//
// Alternativa a "Inativar todos" ao inativar um dojô: decide, praticante a
// praticante, entre TRANSFERIR para outro dojô ou INATIVAR (default). Ações
// em massa no topo agilizam o caso comum (mover todos para um dojô só).
// Ao confirmar, chama POST redistribute com as decisões + inactivate_dojo:
// true — o backend aplica tudo numa chamada só (ver services/karateApi.ts).
//
// fix/karate-redistribuir-modal: o modal era <Modal presentationStyle=
// "pageSheet"> (tela cheia, esconde a sidebar) e continha DOIS outros
// <Modal> aninhados (picker de destino + confirmAsync do ConfirmDialog).
// No RN Web um <Modal> aninhado renderiza ATRÁS do <Modal> pai — picker e
// confirmação nunca apareciam, então "Destino" e "Redistribuir e inativar
// dojô" pareciam não fazer nada. Correção:
//   1) Modal padrão do app (transparent + backdrop + card centrado via
//      ModalPop, mesmo padrão de PraticanteFichaModal/DojoFichaModal/
//      InactivateChoiceDialog) — a sidebar continua visível ao redor.
//   2) SEM <Modal> aninhado: o picker de destino virou uma camada interna
//      (View absoluta por cima do card, com backdrop próprio) e a
//      confirmação virou uma etapa inline (o rodapé vira uma barra de
//      confirmação com [Voltar]/[Confirmar] — sem confirmAsync).
//   3) Feedback real: painel de sucesso dentro do modal com os números da
//      resposta (transferred/inactivated/dojo_inactivated/skipped) e erro
//      inline com opção de tentar de novo (toast preservado como reforço).
//
// Polish de motion (feat/karate-polish-federacao) preservado: barra de
// acento por linha + Destino animam cor via Animated.Value.interpolate;
// hover só web com fallback touch; entrada em stagger nas primeiras
// linhas; chips do rodapé com micro pop quando a contagem muda.
// ============================================================
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Modal, View, Text, ScrollView, TextInput,
  ActivityIndicator, StyleSheet, ViewStyle, TextStyle, Pressable,
  Animated, Platform, Easing,
} from "react-native";
import { Icon } from "@/components/Icon";
import { ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { Motion, webTransition } from "@/constants/motion";
import { KarateButton } from "@/components/karate/KarateButton";
import { BeltBadge } from "@/components/karate/BeltBadge";
import { PressableScale } from "@/components/karate/anim/PressableScale";
import { ModalPop } from "@/components/karate/anim/ModalPop";
import { usePrefersReducedMotion } from "@/components/karate/anim/useReducedMotion";
import { karateApi, Dojo, DojoMemberStanding, RedistributeAction, RedistributeDecision, RedistributeDojoResult } from "@/services/karateApi";
import { toast } from "@/components/Toast";

const IS_WEB = Platform.OS === "web";
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
// Entrada em stagger só nas primeiras N linhas — o resto aparece direto
// (sem custo de animação) pra não travar dojôs com listas grandes.
const STAGGER_LIMIT = 12;
const OK = P.ok ?? "#2d8a4e";
// Item 3 (polish barra de acento): cores mais saturadas exclusivas da barra
// lateral + tint de fundo bem leve da linha, na cor da decisão. Mantém OK/
// P.red "puros" para o botão Destino (texto/ícone/borda), que já tinha
// contraste suficiente — só a barra e o fundo da linha ficam mais fortes.
const ACCENT_RED = P.red2 ?? "#9d3a30";
const ACCENT_OK = "#2f6b2c";
const ROW_TINT_INACTIVATE = "rgba(184,70,58,0.055)";
const ROW_TINT_TRANSFER = "rgba(47,107,44,0.06)";

interface Props {
  visible: boolean;
  onClose: () => void;
  federationId: string;
  dojoId: string;
  dojoName: string;
  /** Praticantes ATIVOS deste dojô — a tela host já busca via getDojoMembersStanding. */
  practitioners: DojoMemberStanding[];
  /** Chamado após o redistribute ter sucesso — a tela host recarrega o dojô/roster e fecha os dois modais. */
  onSuccess: () => void;
}

type Choice = { action: RedistributeAction; destinationId: string | null; destinationName: string | null };
const INACTIVATE_CHOICE: Choice = { action: "inactivate", destinationId: null, destinationName: null };
// edit: lista + decisões · confirm: barra de confirmação inline · success: painel de resultado
type Stage = "edit" | "confirm" | "success";

export function RedistribuirPraticantesModal({
  visible, onClose, federationId, dojoId, dojoName, practitioners, onSuccess,
}: Props) {
  const reducedMotion = usePrefersReducedMotion();
  // Estado por praticante — default "Inativar" (mesmo comportamento de hoje).
  const [decisions, setDecisions] = useState<Record<string, Choice>>({});
  const [dojos, setDojos] = useState<Dojo[]>([]);
  const [dojosLoading, setDojosLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage>("edit");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<RedistributeDojoResult | null>(null);
  // Picker: null (fechado) | "ALL" (ação em massa) | student_id (linha)
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  // Incrementa a cada abertura do modal — usado como parte da key das linhas
  // pra fazer a entrada em stagger tocar de novo em cada abertura.
  const [openSeq, setOpenSeq] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setOpenSeq((s) => s + 1);
    setStage("edit");
    setErrorMsg(null);
    setResult(null);
    setPickerFor(null);
    const initial: Record<string, Choice> = {};
    practitioners.forEach((p) => { initial[p.student_id] = INACTIVATE_CHOICE; });
    setDecisions(initial);
  }, [visible, practitioners]);

  useEffect(() => {
    if (!visible || !federationId) return;
    setDojosLoading(true);
    karateApi.listDojos(federationId, { status: "active", pageSize: 300 })
      .then((res) => setDojos((res.data || []).filter((d) => d.id !== dojoId)))
      .catch(() => setDojos([]))
      .finally(() => setDojosLoading(false));
  }, [visible, federationId, dojoId]);

  // O picker só faz sentido durante a edição — fecha se a etapa mudar.
  useEffect(() => {
    if (stage !== "edit") setPickerFor(null);
  }, [stage]);

  const applyChoice = useCallback((choice: Choice) => {
    if (pickerFor === "ALL") {
      setDecisions((prev) => {
        const next: Record<string, Choice> = {};
        Object.keys(prev).forEach((id) => { next[id] = choice; });
        return next;
      });
    } else if (pickerFor) {
      setDecisions((prev) => ({ ...prev, [pickerFor]: choice }));
    }
    setPickerFor(null);
  }, [pickerFor]);

  const transferCount = useMemo(() => Object.values(decisions).filter((d) => d.action === "transfer").length, [decisions]);
  const inactivateCount = useMemo(() => Object.values(decisions).filter((d) => d.action === "inactivate").length, [decisions]);

  const confirmMessage = useMemo(() => {
    if (transferCount > 0 && inactivateCount > 0) {
      return `${transferCount} praticante${transferCount === 1 ? "" : "s"} será${transferCount === 1 ? "" : "ão"} transferido${transferCount === 1 ? "" : "s"} e ${inactivateCount} será${inactivateCount === 1 ? "" : "ão"} inativado${inactivateCount === 1 ? "" : "s"}. O dojô "${dojoName}" será inativado. Esta ação não pode ser desfeita.`;
    }
    if (transferCount > 0) {
      return `${transferCount} praticante${transferCount === 1 ? "" : "s"} será${transferCount === 1 ? "" : "ão"} transferido${transferCount === 1 ? "" : "s"} para outro dojô. O dojô "${dojoName}" será inativado. Esta ação não pode ser desfeita.`;
    }
    return `${inactivateCount} praticante${inactivateCount === 1 ? "" : "s"} será${inactivateCount === 1 ? "" : "ão"} inativado${inactivateCount === 1 ? "" : "s"} junto com o dojô "${dojoName}". Esta ação não pode ser desfeita.`;
  }, [transferCount, inactivateCount, dojoName]);

  // Passo 1: sai da lista e entra na barra de confirmação inline (sem chamar a API ainda).
  const goToConfirm = useCallback(() => {
    if (busy || practitioners.length === 0) return;
    setErrorMsg(null);
    setStage("confirm");
  }, [busy, practitioners.length]);

  const backToEdit = useCallback(() => {
    if (busy) return;
    setErrorMsg(null);
    setStage("edit");
  }, [busy]);

  // Passo 2: dispara o POST de fato. Erro fica inline (com retry) em vez de sumir num toast.
  const submit = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const payload: RedistributeDecision[] = practitioners.map((p) => {
        const d = decisions[p.student_id] || INACTIVATE_CHOICE;
        return d.action === "transfer"
          ? { student_id: p.student_id, action: "transfer", destination_dojo_id: d.destinationId! }
          : { student_id: p.student_id, action: "inactivate" };
      });
      const res = await karateApi.redistributeDojo(federationId, dojoId, { decisions: payload, inactivate_dojo: true });
      setResult(res || {});
      setStage("success");
    } catch (e: any) {
      const msg = e?.message || "Não foi possível redistribuir. Tente novamente.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }, [busy, practitioners, decisions, federationId, dojoId]);

  // Depois do sucesso, qualquer forma de fechar (X, backdrop, "Concluir") precisa
  // recarregar o host — os dados já mudaram no backend.
  const handleDismiss = useCallback(() => {
    if (busy) return;
    if (stage === "success") onSuccess();
    else onClose();
  }, [busy, stage, onSuccess, onClose]);

  const pickerTitle = pickerFor === "ALL"
    ? "Transferir todos para…"
    : "Destino do praticante";

  const listBusy = busy || stage !== "edit";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
        <ModalPop visible={visible} style={styles.card} duration={reducedMotion ? 0 : 240}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Redistribuir praticantes</Text>
              <Text style={styles.headerSub}>{dojoName} · o dojô será inativado ao confirmar</Text>
            </View>
            <Pressable onPress={handleDismiss} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={10}>
              <Icon name="x" size={24} color={P.ink} />
            </Pressable>
          </View>

          {stage === "success" ? (
            <SuccessPanel result={result} onDone={handleDismiss} />
          ) : (
            <>
              <View style={styles.massActions}>
                <PressableScale
                  style={styles.massBtn}
                  disabled={listBusy || dojos.length === 0}
                  onPress={() => setPickerFor("ALL")}
                  accessibilityLabel="Transferir todos para…"
                >
                  <Icon name="arrow-forward" size={13} color={P.ink} />
                  <Text style={styles.massBtnTxt}>Transferir todos para…</Text>
                </PressableScale>
                <PressableScale
                  style={styles.massBtn}
                  disabled={listBusy}
                  accessibilityLabel="Inativar todos"
                  onPress={() => setDecisions((prev) => {
                    const next: Record<string, Choice> = {};
                    Object.keys(prev).forEach((id) => { next[id] = INACTIVATE_CHOICE; });
                    return next;
                  })}
                >
                  <Icon name="power" size={13} color={P.red} />
                  <Text style={styles.massBtnTxt}>Inativar todos</Text>
                </PressableScale>
              </View>

              <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
                {practitioners.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhum praticante ativo neste dojô — pode inativar direto.</Text>
                ) : (
                  practitioners.map((p, i) => {
                    const choice = decisions[p.student_id] || INACTIVATE_CHOICE;
                    return (
                      <PractitionerRow
                        key={`${openSeq}-${p.student_id}`}
                        index={i}
                        p={p}
                        choice={choice}
                        busy={listBusy}
                        reducedMotion={reducedMotion}
                        onPressDestino={() => setPickerFor(p.student_id)}
                      />
                    );
                  })
                )}
              </ScrollView>

              {stage === "confirm" ? (
                <ConfirmBar
                  message={confirmMessage}
                  busy={busy}
                  errorMsg={errorMsg}
                  onBack={backToEdit}
                  onConfirm={submit}
                />
              ) : (
                <View style={styles.footer}>
                  <View style={styles.footerSummary}>
                    <SummaryChip
                      count={transferCount}
                      label={transferCount === 1 ? "transferência" : "transferências"}
                      color={OK}
                      bg="#f0faf2"
                      borderColor="#b7e0c2"
                      reducedMotion={reducedMotion}
                    />
                    <SummaryChip
                      count={inactivateCount}
                      label={inactivateCount === 1 ? "inativação" : "inativações"}
                      color={P.red}
                      bg={P.redWash}
                      borderColor={P.redLine}
                      reducedMotion={reducedMotion}
                    />
                  </View>
                  <View style={styles.footerBtns}>
                    <KarateButton label="Cancelar" variant="ghost" size="md" onPress={onClose} disabled={busy} style={{ flex: 1 }} />
                    <KarateButton
                      label="Redistribuir e inativar dojô"
                      variant="primary"
                      size="md"
                      disabled={busy || practitioners.length === 0}
                      onPress={goToConfirm}
                      style={{ flex: 2 }}
                    />
                  </View>
                </View>
              )}
            </>
          )}

          {pickerFor && stage === "edit" ? (
            <DestinationPickerOverlay
              visible
              onClose={() => setPickerFor(null)}
              dojos={dojos}
              dojosLoading={dojosLoading}
              onPick={applyChoice}
              title={pickerTitle}
              reducedMotion={reducedMotion}
            />
          ) : null}
        </ModalPop>
      </View>
    </Modal>
  );
}

export default RedistribuirPraticantesModal;

// ── Barra de confirmação inline (substitui confirmAsync) ──────────────────
// Rodapé vira a confirmação — mostra a contagem real (regra do time: ação
// irreversível sempre confirmada) e, se o POST falhar, o erro aparece aqui
// mesmo, com o botão virando "Tentar novamente" (mesmo Confirmar, sem sair
// da etapa).
function ConfirmBar({
  message, busy, errorMsg, onBack, onConfirm,
}: {
  message: string;
  busy: boolean;
  errorMsg: string | null;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <View style={styles.confirmBar}>
      <View style={styles.confirmMsgRow}>
        <Icon name="alert_circle" size={16} color={P.red} />
        <Text style={styles.confirmMsgTxt}>{message}</Text>
      </View>
      {errorMsg ? (
        <View style={styles.errBox}>
          <Icon name="alert_circle" size={15} color={P.red} />
          <Text style={styles.errTxt}>{errorMsg}</Text>
        </View>
      ) : null}
      <View style={styles.footerBtns}>
        <KarateButton label="Voltar" variant="ghost" size="md" onPress={onBack} disabled={busy} style={{ flex: 1 }} />
        <KarateButton
          label={busy ? "Redistribuindo..." : errorMsg ? "Tentar novamente" : "Confirmar"}
          variant="primary"
          size="md"
          loading={busy}
          disabled={busy}
          onPress={onConfirm}
          style={{ flex: 2 }}
        />
      </View>
    </View>
  );
}

// ── Painel de sucesso — números reais da resposta do backend ──────────────
function SuccessPanel({ result, onDone }: { result: RedistributeDojoResult | null; onDone: () => void }) {
  const transferred = Number(result?.transferred ?? 0);
  const inactivated = Number(result?.inactivated ?? 0);
  const dojoInactivated = !!result?.dojo_inactivated;
  const skippedRaw = (result as any)?.skipped;
  const skippedList: Array<{ student_id?: string; full_name?: string; reason?: string }> | null =
    Array.isArray(skippedRaw) ? skippedRaw : null;
  const skippedCount = skippedList ? skippedList.length : (typeof skippedRaw === "number" ? skippedRaw : 0);

  return (
    <View style={styles.successWrap}>
      <View style={styles.successIconWrap}>
        <Icon name="check_circle" size={28} color={OK} />
      </View>
      <Text style={styles.successTitle}>Redistribuição concluída</Text>

      <View style={styles.successChips}>
        <View style={[styles.chip, { backgroundColor: "#f0faf2", borderColor: "#b7e0c2" }]}>
          <Text style={[styles.chipTxt, { color: OK }]}>{transferred} transferido{transferred === 1 ? "" : "s"}</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: P.redWash, borderColor: P.redLine }]}>
          <Text style={[styles.chipTxt, { color: P.red }]}>{inactivated} inativado{inactivated === 1 ? "" : "s"}</Text>
        </View>
        {dojoInactivated ? (
          <View style={[styles.chip, { backgroundColor: P.glass2, borderColor: P.line2 }]}>
            <Text style={[styles.chipTxt, { color: P.ink }]}>Dojô inativado</Text>
          </View>
        ) : null}
      </View>

      {skippedCount > 0 ? (
        <View style={styles.skippedBox}>
          <Icon name="alert_circle" size={14} color={P.red2 ?? P.red} />
          <View style={{ flex: 1 }}>
            <Text style={styles.skippedTitle}>
              {skippedCount} não p{"ô"}de{skippedCount === 1 ? "" : "ram"} ser processado{skippedCount === 1 ? "" : "s"}
            </Text>
            {skippedList ? skippedList.slice(0, 6).map((item, i) => (
              <Text key={item.student_id || i} style={styles.skippedItem} numberOfLines={1}>
                {(item?.full_name || item?.student_id || "Praticante")}{item?.reason ? ` — ${item.reason}` : ""}
              </Text>
            )) : null}
          </View>
        </View>
      ) : null}

      <KarateButton label="Concluir" variant="sumi" size="md" onPress={onDone} style={{ marginTop: 20, alignSelf: "stretch" }} />
    </View>
  );
}

// ── Linha de praticante — acento + Destino animados, hover, stagger ───────
function PractitionerRow({
  index, p, choice, busy, onPressDestino, reducedMotion,
}: {
  index: number;
  p: DojoMemberStanding;
  choice: Choice;
  busy: boolean;
  onPressDestino: () => void;
  reducedMotion: boolean;
}) {
  const isTransfer = choice.action === "transfer";
  const willStagger = !reducedMotion && index < STAGGER_LIMIT;

  // 0 = inativar (vermelho) · 1 = transferir (verde) — transiciona ao alternar.
  const accent = useRef(new Animated.Value(isTransfer ? 1 : 0)).current;
  // Entrada da lista: fade + slide sutil, só nas primeiras STAGGER_LIMIT linhas.
  const enter = useRef(new Animated.Value(willStagger ? 0 : 1)).current;
  const [hovered, setHovered] = useState(false);
  const [destHovered, setDestHovered] = useState(false);

  useEffect(() => {
    Animated.timing(accent, {
      toValue: isTransfer ? 1 : 0,
      duration: Motion.base,
      useNativeDriver: false,
    }).start();
  }, [isTransfer, accent]);

  useEffect(() => {
    if (!willStagger) return;
    const anim = Animated.timing(enter, {
      toValue: 1,
      duration: 220,
      delay: index * 26,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
    // mount-only: a entrada toca uma vez quando a linha aparece.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accentColor = accent.interpolate({ inputRange: [0, 1], outputRange: [ACCENT_RED, ACCENT_OK] });
  const rowTint = accent.interpolate({ inputRange: [0, 1], outputRange: [ROW_TINT_INACTIVATE, ROW_TINT_TRANSFER] });
  const destBorder = accent.interpolate({ inputRange: [0, 1], outputRange: [P.line2, "#b7e0c2"] });
  const destBg = accent.interpolate({ inputRange: [0, 1], outputRange: [P.glass2, "#f0faf2"] });
  const destTxt = accent.interpolate({ inputRange: [0, 1], outputRange: [P.red, OK] });

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      <AnimatedPressable
        onHoverIn={IS_WEB ? () => setHovered(true) : undefined}
        onHoverOut={IS_WEB ? () => setHovered(false) : undefined}
        style={[
          styles.row,
          // Item 3: tint de fundo bem leve na cor da decisão (some quando o
          // hover assume o destaque de P.glassHi abaixo).
          { backgroundColor: rowTint },
          hovered && ({
            transform: [{ translateY: -1 }],
            backgroundColor: P.glassHi,
            ...(IS_WEB ? ({ boxShadow: "0 4px 14px -6px rgba(43,38,32,0.22)" } as any) : null),
          } as any),
          IS_WEB ? (webTransition(["transform", "box-shadow", "background-color"], Motion.fast) as any) : null,
        ]}
      >
        <Animated.View style={[styles.rowAccent, { backgroundColor: accentColor }]} />
        <View style={{ flex: 1, minWidth: 140 }}>
          <Text style={styles.rowName} numberOfLines={1}>{p.full_name}</Text>
          <Text style={styles.rowReg} numberOfLines={1}>
            {p.karate_registration_number || "Sem matrícula"}
          </Text>
        </View>
        {p.belt_level ? <BeltBadge beltLevel={p.belt_level} beltName={p.belt_name || undefined} /> : null}
        <AnimatedPressable
          disabled={busy}
          onPress={onPressDestino}
          onHoverIn={IS_WEB ? () => setDestHovered(true) : undefined}
          onHoverOut={IS_WEB ? () => setDestHovered(false) : undefined}
          accessibilityRole="button"
          accessibilityLabel={`Destino de ${p.full_name}`}
          style={[
            styles.destBtn,
            { borderColor: destBorder, backgroundColor: destBg },
            destHovered && !busy && ({
              transform: [{ translateY: -1 }],
              ...(IS_WEB ? ({ boxShadow: "0 3px 10px -4px rgba(43,38,32,0.28)" } as any) : null),
            } as any),
            IS_WEB ? (webTransition(["transform", "box-shadow"], Motion.fast) as any) : null,
          ]}
        >
          {isTransfer ? (
            <Icon name="arrow-forward" size={12} color={OK} />
          ) : (
            <Icon name="power" size={12} color={P.red} />
          )}
          <Animated.Text style={[styles.destBtnTxt, { color: destTxt }]} numberOfLines={1}>
            {isTransfer ? choice.destinationName : "Inativar"}
          </Animated.Text>
          <Icon name="chevron_down" size={12} color={P.ink3} />
        </AnimatedPressable>
      </AnimatedPressable>
    </Animated.View>
  );
}

// ── Chip de resumo (rodapé) — pop sutil quando a contagem muda ───────────
function SummaryChip({
  count, label, color, bg, borderColor, reducedMotion,
}: {
  count: number; label: string; color: string; bg: string; borderColor: string; reducedMotion: boolean;
}) {
  const pop = useRef(new Animated.Value(1)).current;
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (reducedMotion) return;
    Animated.sequence([
      Animated.timing(pop, { toValue: 1.14, duration: 90, useNativeDriver: false }),
      Animated.timing(pop, { toValue: 1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: false }),
    ]).start();
  }, [count, reducedMotion, pop]);

  return (
    <Animated.View style={[styles.chip, { backgroundColor: bg, borderColor, transform: [{ scale: pop }] }]}>
      <Text style={[styles.chipTxt, { color }]}>{count} {label}</Text>
    </Animated.View>
  );
}

// ── Picker de destino — camada interna do CARD (NÃO é <Modal>) ────────────
// "Inativar" ou um dos dojôs de destino, com busca — mesmo padrão do
// DojoSelectSection (components/karate/praticante-ficha), agora como View
// absoluta por cima do conteúdo do próprio card (com backdrop próprio),
// já que um <Modal> aninhado dentro do <Modal> de redistribuição renderiza
// atrás dele no RN Web (causa raiz do bug original). Card entra em
// scale+fade (ModalPop), mesmo primitivo de antes.
function DestinationPickerOverlay({
  visible, onClose, dojos, dojosLoading, onPick, title, reducedMotion,
}: {
  visible: boolean;
  onClose: () => void;
  dojos: Dojo[];
  dojosLoading: boolean;
  onPick: (choice: Choice) => void;
  title: string;
  reducedMotion: boolean;
}) {
  const [q, setQ] = useState("");
  useEffect(() => { if (visible) setQ(""); }, [visible]);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return dojos;
    return dojos.filter((d) => d.name.toLowerCase().includes(term));
  }, [dojos, q]);

  return (
    <View style={pickerStyles.overlay} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar seleção de destino" />
      <ModalPop visible={visible} style={pickerStyles.card} duration={reducedMotion ? 0 : 200}>
        <Text style={pickerStyles.title}>{title}</Text>

        <PressableScale style={pickerStyles.inactivateOption} onPress={() => onPick(INACTIVATE_CHOICE)} accessibilityLabel="Inativar">
          <Icon name="power" size={14} color={P.red} />
          <Text style={pickerStyles.inactivateTxt}>Inativar</Text>
        </PressableScale>

        <TextInput
          style={pickerStyles.search}
          placeholder="Buscar dojô por nome"
          placeholderTextColor={P.ink4}
          value={q}
          onChangeText={setQ}
          autoFocus
          accessibilityLabel="Buscar dojô de destino"
        />

        {dojosLoading ? (
          <ActivityIndicator style={{ marginVertical: 16 }} color={P.red} />
        ) : filtered.length === 0 ? (
          <Text style={pickerStyles.empty}>Nenhum dojô encontrado</Text>
        ) : (
          <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled">
            {filtered.map((d) => (
              <PressableScale
                key={d.id}
                style={pickerStyles.item}
                onPress={() => onPick({ action: "transfer", destinationId: d.id, destinationName: d.name })}
                accessibilityLabel={`Transferir para ${d.name}`}
              >
                <Icon name="arrow-forward" size={13} color={P.ink2} />
                <Text style={pickerStyles.itemTxt} numberOfLines={1}>{d.name}</Text>
              </PressableScale>
            ))}
          </ScrollView>
        )}

        <Pressable style={pickerStyles.cancelBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancelar">
          <Text style={pickerStyles.cancelTxt}>Cancelar</Text>
        </Pressable>
      </ModalPop>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 16 } as ViewStyle,
  card: { backgroundColor: P.paper, borderRadius: R.xl, borderWidth: 1, borderColor: P.line2, width: "92%", maxWidth: 760, maxHeight: "85%", overflow: "hidden" } as ViewStyle,

  header:      { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
  headerTitle: { fontFamily: F.heading, fontSize: 19, color: P.ink } as TextStyle,
  headerSub:   { fontFamily: F.body, fontSize: 12.5, color: P.ink3, marginTop: 2 } as TextStyle,

  massActions: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 12, flexWrap: "wrap" } as ViewStyle,
  massBtn:     { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, backgroundColor: P.glass2 } as ViewStyle,
  massBtnTxt:  { fontFamily: F.body, fontSize: 12.5, fontWeight: "600", color: P.ink } as TextStyle,

  body:        { marginTop: 8 } as ViewStyle,
  bodyContent: { paddingHorizontal: 16, paddingBottom: 24 } as ViewStyle,
  emptyText:   { textAlign: "center", color: P.ink3, paddingVertical: 24, fontSize: 13, fontFamily: F.body } as TextStyle,

  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingLeft: 10, paddingRight: 2, borderBottomWidth: 1, borderBottomColor: P.line, flexWrap: "wrap", position: "relative" } as ViewStyle,
  rowAccent: { position: "absolute", left: 0, top: 6, bottom: 6, width: 4, borderRadius: 2 } as ViewStyle,
  rowName: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: P.ink } as TextStyle,
  rowReg:  { fontFamily: F.body, fontSize: 11, color: P.ink3, marginTop: 2 } as TextStyle,

  destBtn:    { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 7, paddingHorizontal: 10, borderRadius: R.md, borderWidth: 1, minWidth: 118, maxWidth: 200 } as ViewStyle,
  destBtnTxt: { flex: 1, fontFamily: F.body, fontSize: 12.5, fontWeight: "600" } as TextStyle,

  footer:         { padding: 16, borderTopWidth: 1, borderTopColor: P.line, gap: 10 } as ViewStyle,
  footerSummary:  { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: 8 } as ViewStyle,
  footerBtns:     { flexDirection: "row", gap: 8 } as ViewStyle,

  chip:    { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 12, borderRadius: R.pill, borderWidth: 1 } as ViewStyle,
  chipTxt: { fontFamily: F.body, fontSize: 12, fontWeight: "700" } as TextStyle,

  // Barra de confirmação inline (substitui o rodapé padrão em stage==="confirm").
  confirmBar:     { padding: 16, borderTopWidth: 1, borderTopColor: P.redLine, backgroundColor: P.redWash, gap: 10 } as ViewStyle,
  confirmMsgRow:  { flexDirection: "row", alignItems: "flex-start", gap: 8 } as ViewStyle,
  confirmMsgTxt:  { flex: 1, fontFamily: F.body, fontSize: 12.5, color: P.ink, lineHeight: 18 } as TextStyle,

  errBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(184,70,58,0.08)", borderWidth: 1, borderColor: P.redLine, borderRadius: 12, padding: 11 } as ViewStyle,
  errTxt: { fontFamily: F.body, fontSize: 12.5, color: P.red2, flex: 1 } as TextStyle,

  // Painel de sucesso — substitui lista+rodapé quando stage==="success".
  successWrap:      { alignItems: "center", paddingHorizontal: 24, paddingVertical: 28 } as ViewStyle,
  successIconWrap:  { width: 52, height: 52, borderRadius: 26, backgroundColor: "#f0faf2", alignItems: "center", justifyContent: "center", marginBottom: 12 } as ViewStyle,
  successTitle:     { fontFamily: F.heading, fontSize: 18, color: P.ink, textAlign: "center" } as TextStyle,
  successChips:     { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 14 } as ViewStyle,

  skippedBox:   { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "rgba(184,70,58,0.08)", borderWidth: 1, borderColor: P.redLine, borderRadius: 12, padding: 12, marginTop: 16, width: "100%" } as ViewStyle,
  skippedTitle: { fontFamily: F.body, fontSize: 12.5, fontWeight: "700", color: P.red2 } as TextStyle,
  skippedItem:  { fontFamily: F.body, fontSize: 11.5, color: P.ink3, marginTop: 3 } as TextStyle,
});

const pickerStyles = StyleSheet.create({
  // absoluta DENTRO do card (não um <Modal>) — cobre o conteúdo do card
  // (header incluso) com backdrop próprio, exatamente onde o <Modal>
  // aninhado renderizaria atrás no RN Web.
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 16 } as ViewStyle,
  card: { backgroundColor: P.paper, borderRadius: R.xl, borderWidth: 1, borderColor: P.line2, padding: 18, width: "100%", maxWidth: 380 } as ViewStyle,
  title: { fontFamily: F.body, fontSize: 13, fontWeight: "700", color: P.ink, marginBottom: 10 } as TextStyle,
  inactivateOption: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 10, borderRadius: R.md, borderWidth: 1, borderColor: "#e3c3bd", backgroundColor: "#fbf1ef", marginBottom: 10 } as ViewStyle,
  inactivateTxt: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: P.red } as TextStyle,
  search: { fontFamily: F.body, fontSize: 13.5, color: P.ink, backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8 } as TextStyle,
  empty: { fontFamily: F.body, fontSize: 12.5, color: P.ink3, textAlign: "center", paddingVertical: 16 } as TextStyle,
  item: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: P.line } as ViewStyle,
  itemTxt: { flex: 1, fontFamily: F.body, fontSize: 13.5, color: P.ink } as TextStyle,
  cancelBtn: { alignItems: "center", paddingVertical: 10, marginTop: 8 } as ViewStyle,
  cancelTxt: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: P.ink2 } as TextStyle,
});
