// ============================================================
// Chaves — KataScoring · Shoji (Fase 4: ordem de apresentação + impressão)
//
// Apuração de Kata por bateria: tabela da eliminatória + tabela
// da final (medalhas). Ranqueado por nota, MAS com um segundo modo
// "Ordem de apresentação" (por fase) que mostra a lista na ordem
// atual (presentation_order) e permite reordenar por arrasto —
// MESMA técnica de useBracketDragAndDrop.ts (refs + DOM, web-only)
// já usada no Kanban/bracket de Kumite.
//
// FIDELIDADE: o ranqueamento por nota do modo normal (filter por
// phase + sort por nota desc com fallback -1), o cálculo de
// classificação (s.advances) e a atribuição de medalhas (i < 3)
// NÃO foram alterados — só o skin Shoji e o novo modo de ordem.
// onEditScore é repassado intacto ao orquestrador.
//
// Mobile (sem DnD web-only): o modo "Ordem de apresentação" cai
// para fallback de setas mover-para-cima/baixo (mesma decisão do
// Kumite: DnD é no-op fora de Platform.OS==="web", clique/toque
// continua disponível).
//
// NB: as cores de medalha (ouro/prata/bronze) são CONTEÚDO, não
// estrutura — mantidas como constante local (não há token de
// medalha no DS Shoji); não são o acento vermelho genérico.
// ============================================================
import React, { useCallback, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, Platform, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { ShojiButton } from "@/components/karate/shoji";
import { toast } from "@/components/Toast";
import { karateBracketsApi, KataScore, KataPhase } from "@/services/karateBracketsApi";
import { buildKataHtml } from "@/components/karate/chaves/buildKataHtml";
import { styles as S, MiniAvatar } from "./shared";
import {
  useBracketDragAndDrop, useDraggableSlotRef, useSlotDropZoneRef, BracketSlotId,
} from "./useBracketDragAndDrop";

const isWeb = Platform.OS === "web";

const MEDALS = ["Ouro", "Prata", "Bronze"];
const MEDAL_COLORS = ["#9a7b1f", "#7d7d7d", "#8a5a2b"];

type ViewMode = "notas" | "ordem";

export function KataView({
  catName, scores, onEditScore, federationId, cid, catId, competitionName, federationName, onReloaded,
}: {
  catName: string;
  scores: KataScore[];
  onEditScore: (s: KataScore) => void;
  /** Necessários para salvar ordem (PUT) e montar o cabeçalho da impressão. */
  federationId?: string;
  cid?: string;
  catId?: string;
  competitionName?: string;
  federationName?: string;
  /** Chamado após salvar a ordem com sucesso, para o orquestrador recarregar getKataScores. */
  onReloaded?: () => void | Promise<void>;
}) {
  const [mode, setMode] = useState<ViewMode>("notas");
  const [orderPhase, setOrderPhase] = useState<KataPhase>("eliminatoria");
  const [savingOrder, setSavingOrder] = useState(false);
  // Cópia local editável da ordem (só existe enquanto o usuário reordena
  // antes de salvar); undefined = usar a ordem vinda do servidor.
  const [draftOrder, setDraftOrder] = useState<KataScore[] | null>(null);
  const [dirtyOrder, setDirtyOrder] = useState(false);

  const elim = scores
    .filter((s) => s.phase === "eliminatoria")
    .sort((a, b) => ((b.nota ?? -1) - (a.nota ?? -1)));
  const final = scores
    .filter((s) => s.phase === "final")
    .sort((a, b) => ((b.nota ?? -1) - (a.nota ?? -1)));

  // ── Ordem de apresentação (lista ordenada por presentation_order) ────
  const orderedByPhase = useMemo(() => {
    return scores
      .filter((s) => s.phase === orderPhase)
      .sort((a, b) => {
        const ao = a.presentation_order;
        const bo = b.presentation_order;
        if (ao !== null && ao !== undefined && bo !== null && bo !== undefined) return ao - bo;
        return (b.nota ?? -1) - (a.nota ?? -1);
      });
  }, [scores, orderPhase]);

  const activeOrder = draftOrder ?? orderedByPhase;

  // Entrar no modo "ordem" sempre reinicia o rascunho a partir do servidor.
  const handleEnterOrderMode = useCallback(() => {
    setMode("ordem");
    setDraftOrder(null);
    setDirtyOrder(false);
  }, []);

  const handlePhaseChange = useCallback((phase: KataPhase) => {
    setOrderPhase(phase);
    setDraftOrder(null);
    setDirtyOrder(false);
  }, []);

  // ── Swap de posições (drag-and-drop web) ──────────────────────────────
  const handleSwap = useCallback((from: BracketSlotId, to: BracketSlotId) => {
    // Reaproveita BracketSlotId só como veículo de índice: matchId carrega
    // o entry_id de origem/destino (side é ignorado, sempre "aka").
    if (from.matchId === to.matchId) return;
    setDraftOrder((prev) => {
      const base = prev ?? orderedByPhase;
      const list = base.map((s) => ({ ...s }));
      const fromIdx = list.findIndex((s) => s.entry_id === from.matchId);
      const toIdx = list.findIndex((s) => s.entry_id === to.matchId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      return list;
    });
    setDirtyOrder(true);
  }, [orderedByPhase]);

  const dnd = useBracketDragAndDrop(handleSwap);

  // ── Fallback mobile: mover uma posição para cima/baixo ────────────────
  const moveItem = useCallback((entryId: string, direction: -1 | 1) => {
    setDraftOrder((prev) => {
      const base = prev ?? orderedByPhase;
      const list = base.map((s) => ({ ...s }));
      const idx = list.findIndex((s) => s.entry_id === entryId);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= list.length) return prev;
      const [item] = list.splice(idx, 1);
      list.splice(target, 0, item);
      return list;
    });
    setDirtyOrder(true);
  }, [orderedByPhase]);

  // ── Salvar ordem (PUT .../kata-scores/order) ──────────────────────────
  const handleSaveOrder = useCallback(async () => {
    if (!federationId || !cid || !catId) {
      toast.error("Não foi possível salvar a ordem — contexto da competição ausente.");
      return;
    }
    const list = draftOrder ?? orderedByPhase;
    if (!list.length) return;
    const order = list.map((s, i) => ({ entry_id: s.entry_id, presentation_order: i + 1 }));
    setSavingOrder(true);
    try {
      await karateBracketsApi.saveKataOrder(federationId, cid, catId, orderPhase, order);
      toast.success("Ordem de apresentação salva.");
      setDraftOrder(null);
      setDirtyOrder(false);
      await onReloaded?.();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar a ordem.");
    } finally {
      setSavingOrder(false);
    }
  }, [federationId, cid, catId, draftOrder, orderedByPhase, orderPhase, onReloaded]);

  // ── Imprimir bateria — Fase 4 ──────────────────────────────────────────
  const handlePrint = useCallback(() => {
    if (!isWeb) {
      toast.error("Impressão da bateria disponível apenas na versão web");
      return;
    }
    try {
      const html = buildKataHtml(scores, { competitionName, categoryName: catName, federationName });
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (!w) {
        const w2 = window.open("", "_blank");
        if (w2) { w2.document.write(html); w2.document.close(); }
        else { toast.error("Popup bloqueado — permita popups para app.getaura.com.br"); return; }
      }
      toast.success("Bateria aberta para impressão");
    } catch (e: any) {
      console.error("[KataView] Erro ao gerar impressão da bateria:", e);
      toast.error(e?.message || "Erro ao gerar a bateria para impressão");
    }
  }, [scores, competitionName, catName, federationName]);

  return (
    <View>
      <View style={S.sectionHead}>
        <View>
          <Text style={S.cardTitle}>Chave · Kata</Text>
          <Text style={S.cardSub}>{catName} · por bateria — não é confronto 1×1</Text>
        </View>
        <View style={[S.pill, S.pillAccent]}>
          <Text style={[S.pillText, S.pillTextAccent]}>Apurado</Text>
        </View>
      </View>

      {/* Barra de ações — modos + impressão */}
      <View style={ctrlStyles.actionsRow}>
        <TouchableOpacity
          style={[ctrlStyles.toggleBtn, mode === "notas" && ctrlStyles.toggleBtnActive]}
          onPress={() => { setMode("notas"); setDraftOrder(null); setDirtyOrder(false); }}
        >
          <Icon name="edit" size={14} color={mode === "notas" ? "#fdf8f2" : C.ink2} />
          <Text style={[ctrlStyles.toggleBtnText, mode === "notas" && ctrlStyles.toggleBtnTextActive]}>Notas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[ctrlStyles.toggleBtn, mode === "ordem" && ctrlStyles.toggleBtnActive]}
          onPress={handleEnterOrderMode}
        >
          <Icon name="drag-handle" size={14} color={mode === "ordem" ? "#fdf8f2" : C.ink2} />
          <Text style={[ctrlStyles.toggleBtnText, mode === "ordem" && ctrlStyles.toggleBtnTextActive]}>Ordem de apresentação</Text>
        </TouchableOpacity>

        {mode === "ordem" && (
          <ShojiButton
            label={savingOrder ? "Salvando..." : "Salvar ordem"}
            icon="save"
            variant="accent"
            onPress={handleSaveOrder}
            style={ctrlStyles.actionBtn}
          />
        )}

        <ShojiButton
          label="Imprimir bateria"
          icon="print"
          variant="ghost"
          onPress={handlePrint}
          style={ctrlStyles.actionBtn}
        />
      </View>

      {mode === "notas" && (
        <>
          <View style={S.infoRow}>
            <Icon name="info" size={13} color={C.ink3} />
            <Text style={S.infoText}>
              Cinco jurados; desconsidera a maior e a menor nota. Ordem de apresentação sorteada. Os melhores da eliminatória avançam à final.
            </Text>
          </View>

          <View style={S.kataGrid}>
            {/* Eliminatória */}
            <View style={S.card}>
              <View style={S.kataTableHead}>
                <Text style={S.kataTableTitle}>Eliminatória</Text>
                <Text style={S.kataTableSub}>{elim.length} atletas</Text>
              </View>
              {elim.map((s, i) => (
                <View key={s.entry_id} style={[S.kataRow, i === 0 && S.kataRowFirst]}>
                  <Text style={S.kataPos}>{i + 1}</Text>
                  <MiniAvatar name={s.student_name} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={S.athleteName} numberOfLines={1}>{s.student_name}</Text>
                    <Text style={S.athleteDojo} numberOfLines={1}>{s.dojo_name}</Text>
                  </View>
                  <Text style={S.kataNota}>{s.nota !== null ? s.nota.toFixed(1).replace(".", ",") : "—"}</Text>
                  <View style={[S.pill, s.advances ? S.pillAccent : S.pillNeutral]}>
                    <Text style={[S.pillText, s.advances ? S.pillTextAccent : S.pillTextNeutral]}>
                      {s.advances ? "Classificada" : s.advances === false ? "Eliminada" : ""}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => onEditScore(s)} style={S.editScoreBtn}>
                    <Icon name="edit" size={15} color={P.red} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Final */}
            {final.length > 0 && (
              <View style={S.card}>
                <View style={S.kataTableHead}>
                  <Text style={S.kataTableTitle}>Final</Text>
                  <Text style={S.kataTableSub}>{final.length} finalistas · medalhas</Text>
                </View>
                {final.map((s, i) => (
                  <View key={s.entry_id} style={[S.kataRow, i === 0 && S.kataRowFirst]}>
                    <Text style={[S.kataPos, i < 3 && { fontWeight: "800", color: C.ink }]}>{i + 1}º</Text>
                    <MiniAvatar name={s.student_name} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={S.athleteName} numberOfLines={1}>{s.student_name}</Text>
                      <Text style={S.athleteDojo} numberOfLines={1}>{s.dojo_name}</Text>
                    </View>
                    <Text style={S.kataNota}>{s.nota !== null ? s.nota.toFixed(1).replace(".", ",") : "—"}</Text>
                    {i < 3 && (
                      <Text style={[S.medalText, { color: MEDAL_COLORS[i] }]}>{MEDALS[i]}</Text>
                    )}
                    <TouchableOpacity onPress={() => onEditScore(s)} style={S.editScoreBtn}>
                      <Icon name="edit" size={15} color={P.red} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}

      {mode === "ordem" && (
        <>
          <View style={S.infoRow}>
            <Icon name="info" size={13} color={C.ink3} />
            <Text style={S.infoText}>
              {isWeb
                ? "Arraste um atleta sobre outro para trocar a ordem de apresentação. Depois clique em \"Salvar ordem\"."
                : "Arrastar-e-soltar só funciona na versão web. Use as setas para reordenar; no app, o clique/toque continua disponível para lançar notas."}
            </Text>
          </View>

          <View style={ctrlStyles.phaseRow}>
            <TouchableOpacity
              style={[ctrlStyles.phaseChip, orderPhase === "eliminatoria" && ctrlStyles.phaseChipActive]}
              onPress={() => handlePhaseChange("eliminatoria")}
            >
              <Text style={[ctrlStyles.phaseChipText, orderPhase === "eliminatoria" && ctrlStyles.phaseChipTextActive]}>Eliminatória</Text>
            </TouchableOpacity>
            {final.length > 0 && (
              <TouchableOpacity
                style={[ctrlStyles.phaseChip, orderPhase === "final" && ctrlStyles.phaseChipActive]}
                onPress={() => handlePhaseChange("final")}
              >
                <Text style={[ctrlStyles.phaseChipText, orderPhase === "final" && ctrlStyles.phaseChipTextActive]}>Final</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={S.card}>
            <View style={S.kataTableHead}>
              <Text style={S.kataTableTitle}>{orderPhase === "eliminatoria" ? "Eliminatória" : "Final"}</Text>
              <Text style={S.kataTableSub}>{activeOrder.length} atletas · ordem de apresentação</Text>
            </View>
            {activeOrder.map((s, i) => (
              <OrderRow
                key={s.entry_id}
                score={s}
                index={i}
                total={activeOrder.length}
                dnd={dnd}
                onMove={moveItem}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

// ── OrderRow ─────────────────────────────────────────────────────────────
// Linha arrastável (web) com fallback de setas mover-para-cima/baixo (mobile
// ou qualquer plataforma — as setas sempre funcionam, o drag é reforço web).
function OrderRow({
  score, index, total, dnd, onMove,
}: {
  score: KataScore;
  index: number;
  total: number;
  dnd: ReturnType<typeof useBracketDragAndDrop>;
  onMove: (entryId: string, direction: -1 | 1) => void;
}) {
  const slot: BracketSlotId = { matchId: score.entry_id, side: "aka" };
  const isHoverTarget = dnd.hoverSlot?.matchId === score.entry_id;
  const isDraggingThis = dnd.draggingSlot?.matchId === score.entry_id;

  const dragRef = useDraggableSlotRef(isWeb, slot, dnd.onSlotDragStart, dnd.onSlotDragEnd);
  const dropRef = useSlotDropZoneRef(slot, dnd.onDrop, dnd.onHoverChange);

  const combinedRef = useCallback((node: any) => {
    (dragRef as any).current = node;
    (dropRef as any).current = node;
  }, [dragRef, dropRef]);

  const rowStyle = [
    S.kataRow,
    index === 0 && S.kataRowFirst,
    isHoverTarget && ctrlStyles.orderRowHover,
    isDraggingThis && ctrlStyles.orderRowDragging,
  ];

  const rowContent = (
    <>
      <Text style={S.kataPos}>{score.presentation_order ?? index + 1}</Text>
      {isWeb && <Icon name="drag-handle" size={14} color={C.ink4} />}
      <MiniAvatar name={score.student_name} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={S.athleteName} numberOfLines={1}>{score.student_name}</Text>
        <Text style={S.athleteDojo} numberOfLines={1}>{score.dojo_name}</Text>
      </View>
      <Text style={S.kataNota}>{score.nota !== null ? score.nota.toFixed(1).replace(".", ",") : "—"}</Text>
      <View style={ctrlStyles.moveArrows}>
        <TouchableOpacity
          disabled={index === 0}
          onPress={() => onMove(score.entry_id, -1)}
          style={[ctrlStyles.arrowBtn, index === 0 && ctrlStyles.arrowBtnDisabled]}
        >
          <Icon name="chevron-up" size={14} color={index === 0 ? C.ink4 : C.ink2} />
        </TouchableOpacity>
        <TouchableOpacity
          disabled={index === total - 1}
          onPress={() => onMove(score.entry_id, 1)}
          style={[ctrlStyles.arrowBtn, index === total - 1 && ctrlStyles.arrowBtnDisabled]}
        >
          <Icon name="chevron-down" size={14} color={index === total - 1 ? C.ink4 : C.ink2} />
        </TouchableOpacity>
      </View>
    </>
  );

  if (isWeb) {
    return (
      // @ts-ignore — RN Web aceita ref de View para DOM nativo (DnD)
      <View ref={combinedRef} style={rowStyle}>
        {rowContent}
      </View>
    );
  }

  return <View style={rowStyle}>{rowContent}</View>;
}

// ── Estilos locais (Fase 4: modos + ordem de apresentação) ──────────────
const ctrlStyles = StyleSheet.create({
  actionsRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 12 } as ViewStyle,
  actionBtn: { paddingHorizontal: 14 } as ViewStyle,
  toggleBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.md,
    borderWidth: 1, borderColor: C.line2, backgroundColor: P.glass2,
  } as ViewStyle,
  toggleBtnActive: { backgroundColor: C.ink, borderColor: C.ink } as ViewStyle,
  toggleBtnText: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: C.ink2 } as TextStyle,
  toggleBtnTextActive: { color: "#fdf8f2" } as TextStyle,

  phaseRow: { flexDirection: "row", gap: 8, marginBottom: 12 } as ViewStyle,
  phaseChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, backgroundColor: P.glass2 } as ViewStyle,
  phaseChipActive: { backgroundColor: P.redWash, borderColor: P.redLine } as ViewStyle,
  phaseChipText: { fontFamily: F.body, fontSize: 12, fontWeight: "600", color: C.ink3 } as TextStyle,
  phaseChipTextActive: { color: P.red, fontWeight: "700" } as TextStyle,

  orderRowHover: { backgroundColor: P.redWash } as ViewStyle,
  orderRowDragging: { opacity: 0.5 } as ViewStyle,

  moveArrows: { flexDirection: "column", gap: 2 } as ViewStyle,
  arrowBtn: { padding: 3, borderRadius: 6, backgroundColor: P.glass2 } as ViewStyle,
  arrowBtnDisabled: { opacity: 0.4 } as ViewStyle,
});
