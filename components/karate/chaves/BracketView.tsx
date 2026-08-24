// ============================================================
// Chaves — BracketView · Shoji (Fase 2)
//
// Visualização do bracket Kumite no formato de CHAVE TRADICIONAL
// (folha oficial FPKT): duas asas espelhadas convergindo para a final
// no centro, campeão e disputa de 3º lugar na coluna central, pódio no
// rodapé. Ver o bloco "FOLHA TRADICIONAL" mais abaixo para a geometria.
//
// FASE 2 — Edição total + drag-and-drop:
//   - "Modo edição": reaproveita a MESMA técnica de DnD do Kanban de CRM
//     (refs + setAttribute("draggable") + listeners DOM nativos — ver
//     useBracketDragAndDrop.ts nesta mesma pasta) para permitir arrastar
//     um atleta de QUALQUER slot para QUALQUER outro slot do bracket
//     inteiro (troca de posições entre fases/rounds diferentes).
//     Estado editado fica local até "Salvar chave" (diff + saveMatches).
//   - Modo normal (fora da edição): clique no atleta = lança vencedor
//     (mantido, igual à Fase 1) — abre o modal de placar opcional.
//   - "Limpar resultados": reset via ConfirmDialog (confirmAsync) — destrutivo.
//   - "Destravar para editar": unlock quando bracket.status === "locked"
//     e o usuário quer reabrir para nova edição total.
//   - Mobile: sem drag nativo confiável fora da web — mesma decisão do
//     Kanban (useBracketDragAndDrop é no-op fora de Platform.OS==="web");
//     no mobile a movimentação usa o fluxo por CLIQUE (abaixo).
//
// BANCADA DE MONTAGEM (Hub P2) — passe de design/UX:
//   - Clique-para-mover: em modo edição, tocar num atleta o SELECIONA
//     (slot acende); tocar em qualquer outro slot troca as posições.
//     Funciona em web E mobile — é a alternativa robusta ao drag nativo.
//   - Desfazer: pilha local de trocas; "Desfazer" reverte a última
//     movimentação (só existe dentro do modo edição, antes de salvar).
//   - Flash de aterrissagem: os dois slots envolvidos na troca pulsam
//     suavemente ao soltar (Animated, sem libs novas).
//   - Aviso de colisão de dojô: confronto de 1ª rodada com os dois
//     atletas do MESMO dojô ganha badge de atenção — aviso, nunca bloqueio.
//   - Zoom da chave (web): 100/85/70% para enxergar chaves grandes
//     inteiras; cabeçalho de rodada mostra o nº de lutas da fase.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Platform, StyleSheet, ViewStyle, TextStyle, Animated,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { ShojiBadge, ShojiButton } from "@/components/karate/shoji";
import { confirmAsync } from "@/components/karate/ConfirmDialog";
import { toast } from "@/components/Toast";
import {
  karateBracketsApi,
  BracketState, BracketMatch, BracketAthleteRef, BracketMatchEdit,
} from "@/services/karateBracketsApi";
import { buildBracketHtml } from "@/components/karate/chaves/buildBracketHtml";
import { EventDayMode } from "@/components/karate/chaves/EventDayMode";
import {
  styles as S, roundLabel, ByeText, PendingText, SameDojoBadge,
} from "./shared";
import type { PhaseByRound } from "@/services/karateBracketsApi";
import {
  useBracketDragAndDrop, useDraggableSlotRef, useSlotDropZoneRef, BracketSlotId,
} from "./useBracketDragAndDrop";

const isWeb = Platform.OS === "web";

// Chave grande: acima de 16 confrontos na 1ª fase (> 32 atletas), o
// drag-and-drop de edição total fica impraticável e pesado (centenas de
// slots draggable simultâneos). Acima do limite, o modo edição/arrasto é
// desabilitado — clique-para-vencedor e impressão continuam normais, e
// "Refazer sorteio" é o caminho pra reorganizar a chave.
const LARGE_BRACKET_EDIT_LIMIT = 16;

// Slot vazio ("bye" ou null) não é arrastável nem carrega atleta.
type SlotValue = BracketAthleteRef | "bye" | null;

// Chave estável de um slot — usada por seleção (clique-para-mover),
// flash de aterrissagem e pilha de undo.
const slotKey = (s: BracketSlotId) => `${s.matchId}::${s.side}`;

// Níveis de zoom da chave (web-only): 100% → 85% → 70%. Aplicado via
// transform scale com origem no canto superior esquerdo; o scroll
// horizontal continua o mesmo (a área útil só encolhe).
const ZOOM_LEVELS = [1, 0.85, 0.7] as const;

// Uma troca registrada na pilha de undo.
type SwapRecord = { from: BracketSlotId; to: BracketSlotId };

export function BracketView({
  bracket, advancingMatch, onAdvance, onReopen, catName, federationId, cid, catId, onReloaded,
  competitionName, federationName,
}: {
  bracket: BracketState;
  advancingMatch: string | null;
  onAdvance: (matchId: string, winnerId: string, akaScore?: number, shiroScore?: number) => void;
  onReopen: () => void;
  catName: string;
  federationId: string;
  cid: string;
  catId: string;
  /** Chamado após save/reset/unlock bem-sucedidos para o orquestrador recarregar o bracket real. */
  onReloaded: () => void | Promise<void>;
  /** Nome da competição, usado no cabeçalho da folha impressa (opcional). */
  competitionName?: string;
  /** Nome da federação, usado no cabeçalho da folha impressa (opcional — cai para o contexto). */
  federationName?: string;
}) {
  const totalRounds = bracket.rounds.length;
  const locked = bracket.status === "locked";

  // Chave grande (> 16 confrontos na 1ª fase, ou seja, > 32 atletas):
  // desabilita o modo edição/arrasto (DnD pesado e impraticável em escala).
  // Clique-para-vencedor e impressão continuam disponíveis normalmente.
  const firstPhaseMatches = bracket.rounds[0]?.length ?? 0;
  const isLargeBracket = firstPhaseMatches > LARGE_BRACKET_EDIT_LIMIT;

  // ── Modo edição total (drag-and-drop) ─────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [eventMode, setEventMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  // Cópia local editável dos matches (achatado: todos os rounds + third).
  // Só existe enquanto editMode = true; ao sair sem salvar, é descartada.
  const [draftMatches, setDraftMatches] = useState<BracketMatch[] | null>(null);
  const [dirty, setDirty] = useState(false);

  // ── Bancada (Hub P2): clique-para-mover + undo + flash ─────────────
  // Slot selecionado como ORIGEM no fluxo por clique (só em modo edição).
  const [selectedSlot, setSelectedSlot] = useState<BracketSlotId | null>(null);
  // Slots que acabaram de receber uma troca → pulso visual de aterrissagem.
  // Mapa slotKey → timestamp da troca (o ts força o remount do flash).
  const [movedFlash, setMovedFlash] = useState<Record<string, number>>({});
  // Pilha de trocas para o Desfazer (última movimentação primeiro a sair).
  const [history, setHistory] = useState<SwapRecord[]>([]);
  // Zoom da chave (web): índice em ZOOM_LEVELS.
  const [zoomIdx, setZoomIdx] = useState(0);
  const zoom = ZOOM_LEVELS[zoomIdx];

  // Placar: modal Shoji reaproveitando o padrão do sheet de nota do Kata.
  const [scoreTarget, setScoreTarget] = useState<{ matchId: string; winnerId: string } | null>(null);
  const [akaScoreInput, setAkaScoreInput] = useState("");
  const [shiroScoreInput, setShiroScoreInput] = useState("");

  const allMatchesFlat = useMemo(() => {
    const flat: BracketMatch[] = [];
    bracket.rounds.forEach((round) => round.forEach((m) => flat.push(m)));
    if (bracket.third_place_match) flat.push(bracket.third_place_match);
    return flat;
  }, [bracket]);

  const activeMatches = draftMatches ?? allMatchesFlat;

  function findMatch(matchId: string): BracketMatch | undefined {
    return activeMatches.find((m) => m.id === matchId);
  }

  // ── Colisão de dojô na 1ª rodada (aviso, NUNCA bloqueio) ────────────
  // Recalculada sobre o estado ATIVO (rascunho em edição ou servidor):
  // enquanto o operador move atletas, o aviso acende/apaga em tempo real.
  const firstRoundIds = useMemo(
    () => new Set((bracket.rounds[0] || []).map((m) => m.id)),
    [bracket]
  );
  const sameDojoMatchIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of activeMatches) {
      if (!firstRoundIds.has(m.id)) continue;
      const aka = m.aka && m.aka !== "bye" ? (m.aka as BracketAthleteRef) : null;
      const shiro = m.shiro && m.shiro !== "bye" ? (m.shiro as BracketAthleteRef) : null;
      if (aka && shiro && aka.dojo_name && aka.dojo_name === shiro.dojo_name) ids.add(m.id);
    }
    return ids;
  }, [activeMatches, firstRoundIds]);

  // ── Entrar/sair do modo edição ─────────────────────────────────────
  const handleToggleEditMode = useCallback(() => {
    if (isLargeBracket) {
      toast.info("Chave grande — reorganize por \"Refazer sorteio\"; edição por arrasto fica para chaves menores.");
      return;
    }
    if (locked) {
      toast.info("Destrave a chave para editar as posições.");
      return;
    }
    if (editMode) {
      if (dirty) {
        toast.warning("Saia sem salvar? As trocas locais foram descartadas.");
      }
      setEditMode(false);
      setDraftMatches(null);
      setDirty(false);
      setSelectedSlot(null);
      setMovedFlash({});
      setHistory([]);
    } else {
      // Snapshot local (deep-ish copy) pra edição isolada do estado do servidor.
      setDraftMatches(allMatchesFlat.map((m) => ({ ...m })));
      setDirty(false);
      setHistory([]);
      setEditMode(true);
    }
  }, [locked, editMode, dirty, allMatchesFlat, isLargeBracket]);

  // ── Troca (swap) de posições entre dois slots quaisquer ─────────────
  // `record` = false quando a troca É o próprio undo (não re-empilha).
  const doSwap = useCallback((from: BracketSlotId, to: BracketSlotId, record: boolean) => {
    if (from.matchId === to.matchId && from.side === to.side) return;
    setDraftMatches((prev) => {
      if (!prev) return prev;
      const next = prev.map((m) => ({ ...m }));
      const fromMatch = next.find((m) => m.id === from.matchId);
      const toMatch = next.find((m) => m.id === to.matchId);
      if (!fromMatch || !toMatch) return prev;

      const fromVal = from.side === "aka" ? fromMatch.aka : fromMatch.shiro;
      const toVal = to.side === "aka" ? toMatch.aka : toMatch.shiro;

      if (from.side === "aka") fromMatch.aka = toVal; else fromMatch.shiro = toVal;
      if (to.side === "aka") toMatch.aka = fromVal; else toMatch.shiro = fromVal;

      return next;
    });
    setDirty(true);
    setSelectedSlot(null);
    if (record) setHistory((h) => [...h, { from, to }]);
    // Pulso de aterrissagem nos dois slots envolvidos.
    const ts = Date.now();
    setMovedFlash({ [slotKey(from)]: ts, [slotKey(to)]: ts });
  }, []);

  const handleSwap = useCallback((from: BracketSlotId, to: BracketSlotId) => {
    doSwap(from, to, true);
  }, [doSwap]);

  // ── Desfazer (última movimentação) ──────────────────────────────────
  // Refazer a mesma troca inverte a si mesma (swap é involutivo).
  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    doSwap(last.from, last.to, false);
    setHistory((h) => h.slice(0, -1));
  }, [history, doSwap]);

  // ── Clique-para-mover (alternativa robusta ao drag; funciona no mobile) ──
  // 1º clique num atleta seleciona a origem; clique em QUALQUER outro slot
  // (mesmo vazio) conclui a troca; clicar de novo na origem cancela.
  const handleSlotPress = useCallback((slot: BracketSlotId, hasAthlete: boolean) => {
    if (!selectedSlot) {
      if (hasAthlete) setSelectedSlot(slot);
      return;
    }
    if (selectedSlot.matchId === slot.matchId && selectedSlot.side === slot.side) {
      setSelectedSlot(null);
      return;
    }
    doSwap(selectedSlot, slot, true);
  }, [selectedSlot, doSwap]);

  const dnd = useBracketDragAndDrop(handleSwap);

  // ── Salvar chave (diff + PUT .../bracket/matches) ───────────────────
  const handleSave = useCallback(async () => {
    if (!draftMatches) return;
    const original = new Map(allMatchesFlat.map((m) => [m.id, m]));
    const edits: BracketMatchEdit[] = [];

    for (const m of draftMatches) {
      const before = original.get(m.id);
      if (!before) continue;
      const edit: BracketMatchEdit = { id: m.id };
      let changed = false;

      const beforeAkaId = before.aka && before.aka !== "bye" ? before.aka.entry_id : null;
      const afterAkaId = m.aka && m.aka !== "bye" ? m.aka.entry_id : null;
      if (beforeAkaId !== afterAkaId) { edit.aka_entry_id = afterAkaId; changed = true; }

      const beforeShiroId = before.shiro && before.shiro !== "bye" ? before.shiro.entry_id : null;
      const afterShiroId = m.shiro && m.shiro !== "bye" ? m.shiro.entry_id : null;
      if (beforeShiroId !== afterShiroId) { edit.shiro_entry_id = afterShiroId; changed = true; }

      if (changed) edits.push(edit);
    }

    if (edits.length === 0) {
      toast.info("Nenhuma alteração para salvar.");
      setEditMode(false);
      setDraftMatches(null);
      setDirty(false);
      setSelectedSlot(null);
      setHistory([]);
      setMovedFlash({});
      return;
    }

    setSaving(true);
    try {
      await karateBracketsApi.saveMatches(federationId, cid, catId, edits);
      toast.success("Chave salva com sucesso.");
      setEditMode(false);
      setDraftMatches(null);
      setDirty(false);
      setSelectedSlot(null);
      setHistory([]);
      setMovedFlash({});
      await onReloaded();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar a chave.");
    } finally {
      setSaving(false);
    }
  }, [draftMatches, allMatchesFlat, federationId, cid, catId, onReloaded]);

  // ── Limpar resultados (reset) ───────────────────────────────────────
  const handleReset = useCallback(async () => {
    const ok = await confirmAsync({
      title: "Limpar resultados?",
      message: "Os vencedores e placares lançados serão apagados. As posições dos atletas nos slots são mantidas. Esta ação não pode ser desfeita.",
      confirmLabel: "Limpar",
      destructive: true,
    });
    if (!ok) return;
    setResetting(true);
    try {
      await karateBracketsApi.resetBracket(federationId, cid, catId);
      toast.success("Resultados limpos.");
      await onReloaded();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível limpar os resultados.");
    } finally {
      setResetting(false);
    }
  }, [federationId, cid, catId, onReloaded]);

  // ── Destravar para editar ───────────────────────────────────────────
  const handleUnlock = useCallback(async () => {
    const ok = await confirmAsync({
      title: "Destravar a chave?",
      message: "A chave volta para rascunho e pode ser regenerada/editada. Resultados já lançados são preservados até uma nova ação.",
      confirmLabel: "Destravar",
      destructive: false,
    });
    if (!ok) return;
    setUnlocking(true);
    try {
      await karateBracketsApi.unlockBracket(federationId, cid, catId);
      toast.success("Chave destravada — voltou para rascunho.");
      await onReloaded();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível destravar a chave.");
    } finally {
      setUnlocking(false);
    }
  }, [federationId, cid, catId, onReloaded]);

  // ── Modo normal: clique no atleta abre modal de placar e lança vencedor ──
  const openScoreModal = useCallback((matchId: string, winnerId: string) => {
    setScoreTarget({ matchId, winnerId });
    setAkaScoreInput("");
    setShiroScoreInput("");
  }, []);

  const handleConfirmAdvance = useCallback(() => {
    if (!scoreTarget) return;
    const akaScore = akaScoreInput.trim() ? parseInt(akaScoreInput.trim(), 10) : undefined;
    const shiroScore = shiroScoreInput.trim() ? parseInt(shiroScoreInput.trim(), 10) : undefined;
    onAdvance(
      scoreTarget.matchId,
      scoreTarget.winnerId,
      Number.isFinite(akaScore as number) ? akaScore : undefined,
      Number.isFinite(shiroScore as number) ? shiroScore : undefined,
    );
    setScoreTarget(null);
  }, [scoreTarget, akaScoreInput, shiroScoreInput, onAdvance]);

  // ── Imprimir chave — Fase 3 ──────────────────────────────────────────
  // Mesmo padrão de CarteirinhaBatchTab.tsx: builder retorna HTML puro
  // (buildBracketHtml), abre via Blob + URL.createObjectURL + window.open,
  // com fallback document.write se o popup for bloqueado. Web-only.
  const handlePrint = useCallback(() => {
    if (!isWeb) {
      toast.error("Impressão da chave disponível apenas na versão web");
      return;
    }
    try {
      const html = buildBracketHtml(bracket, { competitionName, categoryName: catName, federationName });
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (!w) {
        const w2 = window.open("", "_blank");
        if (w2) { w2.document.write(html); w2.document.close(); }
        else { toast.error("Popup bloqueado — permita popups para app.getaura.com.br"); return; }
      }
      toast.success("Chave aberta para impressão");
    } catch (e: any) {
      console.error("[BracketView] Erro ao gerar impressão da chave:", e);
      toast.error(e?.message || "Erro ao gerar a chave para impressão");
    }
  }, [bracket, competitionName, catName, federationName]);

  return (
    <View>
      {/* Section head */}
      <View style={S.sectionHead}>
        <View>
          <Text style={S.cardTitle}>Chave · Kumite</Text>
          <Text style={S.cardSub}>{catName}</Text>
        </View>
        <View style={S.sectionHeadRight}>
          <ShojiBadge status={locked ? "ok" : "warn"} label={locked ? "Oficial · travada" : "Rascunho"} />
        </View>
      </View>

      {/* Barra de ações — edição total */}
      <View style={ctrlStyles.actionsRow}>
        <TouchableOpacity
          style={[
            ctrlStyles.toggleBtn,
            editMode && ctrlStyles.toggleBtnActive,
            isLargeBracket && ctrlStyles.toggleBtnDisabled,
          ]}
          onPress={handleToggleEditMode}
          disabled={saving || isLargeBracket}
        >
          <Icon name={editMode ? "unlock" : "edit"} size={14} color={editMode ? "#fdf8f2" : (isLargeBracket ? C.ink4 : C.ink2)} />
          <Text style={[
            ctrlStyles.toggleBtnText,
            editMode && ctrlStyles.toggleBtnTextActive,
            isLargeBracket && ctrlStyles.toggleBtnTextDisabled,
          ]}>
            {editMode ? "Modo edição (ativo)" : "Modo edição"}
          </Text>
        </TouchableOpacity>

        {editMode ? (
          <>
            <TouchableOpacity
              style={[ctrlStyles.undoBtn, history.length === 0 && ctrlStyles.undoBtnDisabled]}
              onPress={handleUndo}
              disabled={history.length === 0 || saving}
              accessibilityRole="button"
              accessibilityLabel="Desfazer última movimentação"
            >
              <Icon name="rotate-ccw" size={13} color={history.length === 0 ? C.ink4 : C.ink2} />
              <Text style={[ctrlStyles.undoBtnText, history.length === 0 && ctrlStyles.undoBtnTextDisabled]}>
                Desfazer
              </Text>
              {history.length > 0 && (
                <View style={ctrlStyles.undoCount}>
                  <Text style={ctrlStyles.undoCountText}>{history.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            <ShojiButton
              label={saving ? "Salvando..." : "Salvar chave"}
              icon="save"
              variant="accent"
              onPress={handleSave}
              style={ctrlStyles.actionBtn}
            />
          </>
        ) : (
          <>
            {!locked && (
              <ShojiButton
                label={resetting ? "Limpando..." : "Limpar resultados"}
                icon="refresh"
                variant="ghost"
                onPress={handleReset}
                style={ctrlStyles.actionBtn}
              />
            )}
            {locked && (
              <ShojiButton
                label={unlocking ? "Destravando..." : "Destravar para editar"}
                icon="unlock"
                variant="ghost"
                onPress={handleUnlock}
                style={ctrlStyles.actionBtn}
              />
            )}
            <TouchableOpacity style={S.reopenBtn} onPress={onReopen}>
              <Text style={S.reopenText}>Refazer sorteio</Text>
            </TouchableOpacity>
          </>
        )}
        {locked && !editMode && (
          <ShojiButton
            label="Modo evento"
            icon="pulse"
            variant="accent"
            onPress={() => setEventMode(true)}
            style={ctrlStyles.actionBtn}
          />
        )}
        <ShojiButton
          label="Imprimir chave"
          icon="print"
          variant="ghost"
          onPress={handlePrint}
          style={ctrlStyles.actionBtn}
        />
      </View>

      <View style={S.bracketHint}>
        <Icon name="info" size={14} color={P.red} />
        <Text style={S.bracketHintText}>
          {isLargeBracket
            ? "Chave grande — reorganize por \"Refazer sorteio\"; edição por arrasto fica para chaves menores. Clique no vencedor e a impressão continuam disponíveis normalmente."
            : editMode
              ? (selectedSlot
                ? "Atleta selecionado — clique no slot de destino para trocar as posições (ou clique nele de novo para cancelar)."
                : (isWeb
                  ? "Arraste um atleta pelo punho, ou clique nele e depois no destino — as duas posições trocam de lugar. Salve com \"Salvar chave\"."
                  : "Toque num atleta para selecioná-lo e toque no slot de destino para trocar as posições. Salve com \"Salvar chave\"."))
              : "Clique no vencedor para lançar o resultado."}
        </Text>
      </View>

      {/* Barra de visualização: aviso de colisões de dojô + zoom da chave */}
      {(sameDojoMatchIds.size > 0 || (isWeb && totalRounds > 2)) && (
        <View style={ctrlStyles.viewBar}>
          {sameDojoMatchIds.size > 0 ? (
            <View style={ctrlStyles.clashChip}>
              <Icon name="alert" size={13} color={P.warn} />
              <Text style={ctrlStyles.clashChipText}>
                {sameDojoMatchIds.size === 1
                  ? "1 confronto de 1ª rodada com atletas do mesmo dojô"
                  : `${sameDojoMatchIds.size} confrontos de 1ª rodada com atletas do mesmo dojô`}
                {editMode ? " — mova um deles se quiser separar." : ""}
              </Text>
            </View>
          ) : <View style={{ flex: 1 }} />}
          {isWeb && totalRounds > 2 && (
            <View style={ctrlStyles.zoomCluster}>
              <TouchableOpacity
                style={[ctrlStyles.zoomBtn, zoomIdx >= ZOOM_LEVELS.length - 1 && ctrlStyles.zoomBtnDisabled]}
                onPress={() => setZoomIdx((z) => Math.min(z + 1, ZOOM_LEVELS.length - 1))}
                disabled={zoomIdx >= ZOOM_LEVELS.length - 1}
                accessibilityRole="button"
                accessibilityLabel="Diminuir zoom da chave"
              >
                <Icon name="minus" size={13} color={zoomIdx >= ZOOM_LEVELS.length - 1 ? C.ink4 : C.ink2} />
              </TouchableOpacity>
              <Text style={ctrlStyles.zoomLabel}>{Math.round(zoom * 100)}%</Text>
              <TouchableOpacity
                style={[ctrlStyles.zoomBtn, zoomIdx === 0 && ctrlStyles.zoomBtnDisabled]}
                onPress={() => setZoomIdx((z) => Math.max(z - 1, 0))}
                disabled={zoomIdx === 0}
                accessibilityRole="button"
                accessibilityLabel="Aumentar zoom da chave"
              >
                <Icon name="plus" size={13} color={zoomIdx === 0 ? C.ink4 : C.ink2} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Bracket — folha tradicional (duas asas espelhadas → final no centro) */}
      <ScrollView horizontal showsHorizontalScrollIndicator style={S.bracketScroll}>
        <View style={[
          isWeb && zoom !== 1 && ({ transform: [{ scale: zoom }], transformOrigin: "top left" } as any),
        ]}>
          <TraditionalSheet
            rounds={bracket.rounds.map((round) =>
              round.map((m) => (editMode ? (findMatch(m.id) || m) : m))
            )}
            third={bracket.third_place_match
              ? (editMode ? (findMatch(bracket.third_place_match.id) || bracket.third_place_match) : bracket.third_place_match)
              : null}
            champion={bracket.champion}
            phasesByRound={bracket.phases_by_round}
            catName={catName}
            competitionName={competitionName}
            federationName={federationName}
            sameDojoMatchIds={sameDojoMatchIds}
            advancingMatch={advancingMatch}
            locked={locked}
            editMode={editMode}
            dnd={dnd}
            onAdvance={openScoreModal}
            selectedSlot={selectedSlot}
            movedFlash={movedFlash}
            onSlotPress={handleSlotPress}
          />
        </View>
      </ScrollView>

      <View style={ctrlStyles.scrollHintRow}>
        <Text style={[S.scrollHint, { marginTop: 0 }]}>Role para o lado para ver a chave inteira</Text>
        <Icon name="arrow-right" size={12} color={C.ink4} />
      </View>

      {/* Modal de placar (Shoji sheet — mesmo padrão do sheet de nota do Kata) */}
      <Modal visible={!!scoreTarget} transparent animationType="fade" onRequestClose={() => setScoreTarget(null)}>
        <View style={ctrlStyles.overlay}>
          <View style={ctrlStyles.sheet}>
            <Text style={ctrlStyles.sheetTitle}>Lançar resultado</Text>
            <Text style={ctrlStyles.sheetSub}>Placar opcional — pode deixar em branco.</Text>
            <View style={ctrlStyles.scoreRow}>
              <View style={{ flex: 1 }}>
                <Text style={ctrlStyles.inputLabel}>Aka</Text>
                <TextInput
                  style={ctrlStyles.input}
                  value={akaScoreInput}
                  onChangeText={setAkaScoreInput}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={C.ink4}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ctrlStyles.inputLabel}>Shiro</Text>
                <TextInput
                  style={ctrlStyles.input}
                  value={shiroScoreInput}
                  onChangeText={setShiroScoreInput}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={C.ink4}
                />
              </View>
            </View>
            <View style={ctrlStyles.sheetActions}>
              <ShojiButton label="Cancelar" variant="ghost" onPress={() => setScoreTarget(null)} style={{ flex: 1 }} />
              <ShojiButton label="Confirmar vencedor" variant="sumi" onPress={handleConfirmAdvance} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modo dia do evento — visão focada de tela cheia (Fase 5) */}
      {locked && (
        <EventDayMode
          visible={eventMode}
          onClose={() => setEventMode(false)}
          bracket={bracket}
          onAdvance={onAdvance}
          onReloaded={onReloaded}
          advancingMatch={advancingMatch}
          catName={catName}
          competitionName={competitionName}
          federationName={federationName}
        />
      )}
    </View>
  );
}

// ── Flash de aterrissagem ────────────────────────────────────────────────
// Pulso suave sobre o slot que acabou de participar de uma troca. Monta
// com key={ts} (remonta a cada troca) e desvanece sozinho via Animated.
function MovedFlash() {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.timing(a, { toValue: 0, duration: 850, useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [a]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(184,70,58,0.16)", opacity: a }]}
    />
  );
}

// ════════════════════════════════════════════════════════════════════════
// FOLHA TRADICIONAL — layout de chave oficial (referência: folha FPKT do
// Paulista JKA). Duas asas espelhadas convergindo para a FINAL no centro:
//   · asa esquerda flui esquerda→direita; asa direita é o ESPELHO
//     (mesmas células, conectores invertidos via x' = canvasW − x − w);
//   · rodada r com M lutas divide em slice(0, M/2) (esquerda) e
//     slice(M/2) (direita); a final (M = 1) é a célula central;
//   · posição vertical CALCULADA: coluna 0 em passos fixos
//     (MATCH_H + GAP0); coluna c centraliza cada luta na média dos
//     centros das duas alimentadoras da coluna c−1 (espaçamento 2^r
//     emerge sozinho dessa recorrência);
//   · conectores em cotovelo: Views absolutas de 1.5px (horizontal
//     saindo de cada dupla → vertical unindo o par → horizontal
//     entrando na luta seguinte); quando a alimentadora tem vencedor,
//     o segmento correspondente fica no vermelho do design system
//     (o "traço vermelho" da folha real);
//   · atleta = LINHA sublinhada (nome à esquerda, dojô à direita,
//     menor/atenuado) — vencedor sublinha em vermelho;
//   · número da luta em chip âmbar suave (o retângulo amarelo da
//     folha) no encontro das linhas; numeração igual à folha: rodada a
//     rodada, asa esquerda primeiro, final por último.
// Interações preservadas: clique-para-mover/drag no rascunho, lançar
// vencedor quando travada, flash, colisão de dojô, undo/zoom/imprimir.
// ════════════════════════════════════════════════════════════════════════

// Métricas da folha (px, antes do zoom).
const T = {
  SLOT_H: 30,    // altura da linha do atleta
  SLOT_GAP: 16,  // vão entre as duas linhas da luta (onde vive o chip)
  GAP0: 30,      // vão vertical entre lutas da 1ª coluna
  COL_W: 216,    // largura da célula de luta
  CONN_W: 30,    // corredor do conector entre colunas
  FINAL_W: 232,  // largura da coluna central (final/campeão/3º)
  PAD_TOP: 10,
  LINE: 1.5,     // espessura do conector
} as const;
const MATCH_H = T.SLOT_H * 2 + T.SLOT_GAP;
const CONNECT_COLOR = "rgba(43,38,32,0.45)";

// Props de interação compartilhadas por todos os slots (inalteradas da
// bancada de montagem — clique-para-mover, drag, flash, lançar vencedor).
type SlotSharedProps = {
  locked: boolean;
  editMode: boolean;
  dnd: ReturnType<typeof useBracketDragAndDrop>;
  onAdvance: (matchId: string, winnerId: string) => void;
  selectedSlot: BracketSlotId | null;
  movedFlash: Record<string, number>;
  onSlotPress: (slot: BracketSlotId, hasAthlete: boolean) => void;
};

const athleteOf = (v: SlotValue | undefined): BracketAthleteRef | null =>
  (v && v !== "bye" ? (v as BracketAthleteRef) : null);

function TraditionalSheet({
  rounds, third, champion, phasesByRound, catName, competitionName, federationName,
  sameDojoMatchIds, advancingMatch, ...slotShared
}: {
  /** Rounds já RESOLVIDOS (rascunho em edição ou estado do servidor). */
  rounds: BracketMatch[][];
  third: BracketMatch | null;
  champion: BracketAthleteRef | null;
  phasesByRound?: PhaseByRound[];
  catName: string;
  competitionName?: string;
  federationName?: string;
  sameDojoMatchIds: Set<string>;
  advancingMatch: string | null;
} & SlotSharedProps) {
  const totalRounds = rounds.length;
  if (totalRounds === 0 || !rounds[totalRounds - 1]?.[0]) return null;

  const hasWings = totalRounds >= 2;
  const wingRounds = totalRounds - 1;

  // ── Asas: metade esquerda / metade direita de cada rodada ──────────
  const wingL: BracketMatch[][] = [];
  const wingR: BracketMatch[][] = [];
  for (let c = 0; c < wingRounds; c++) {
    const half = Math.floor(rounds[c].length / 2);
    wingL.push(rounds[c].slice(0, half));
    wingR.push(rounds[c].slice(half));
  }

  // ── Centros verticais (recorrência: média das alimentadoras) ───────
  const centers: number[][] = [];
  for (let c = 0; c < wingRounds; c++) {
    const arr: number[] = [];
    for (let i = 0; i < wingL[c].length; i++) {
      if (c === 0) { arr.push(i * (MATCH_H + T.GAP0) + MATCH_H / 2); continue; }
      // Média dos centros das duas alimentadoras. Se a chave não for uma
      // potência de 2 exata, a segunda pode faltar — cai na primeira em vez
      // de virar NaN e destruir a geometria.
      const a = centers[c - 1][2 * i];
      const b = centers[c - 1][2 * i + 1];
      arr.push(b === undefined ? (a ?? i * (MATCH_H + T.GAP0) + MATCH_H / 2) : (a + b) / 2);
    }
    centers.push(arr);
  }

  const wingW = wingRounds * (T.COL_W + T.CONN_W);
  const finalCenterY = hasWings ? centers[wingRounds - 1][0] : MATCH_H / 2;
  const wingH = hasWings
    ? wingL[0].length * MATCH_H + (wingL[0].length - 1) * T.GAP0
    : MATCH_H;
  const canvasW = wingW * 2 + T.FINAL_W;
  const finalTopLocal = finalCenterY - MATCH_H / 2;
  // Pilha central: final + campeão + (3º lugar). Alturas estimadas por
  // cima — o canvas só precisa COMPORTAR a pilha, o layout interno é flex.
  const stackH = MATCH_H + 18 + 112 + (third ? 20 + 18 + MATCH_H : 0);
  const canvasH = T.PAD_TOP + Math.max(wingH, finalTopLocal + stackH) + 16;

  // ── Numeração das lutas (igual à folha: rodada a rodada, esquerda
  //    primeiro, final por último) ────────────────────────────────────
  const numberById: Record<string, number> = {};
  let seq = 1;
  for (let r = 0; r < totalRounds; r++) {
    const round = rounds[r];
    if (round.length === 1) { numberById[round[0].id] = seq++; continue; }
    const half = Math.floor(round.length / 2);
    for (let i = 0; i < half; i++) numberById[round[i].id] = seq++;
    for (let i = half; i < round.length; i++) numberById[round[i].id] = seq++;
  }

  // ── Células + conectores das duas asas ─────────────────────────────
  const cells: React.ReactNode[] = [];
  const lines: React.ReactNode[] = [];
  (["L", "R"] as const).forEach((side) => {
    const wing = side === "L" ? wingL : wingR;
    for (let c = 0; c < wingRounds; c++) {
      const localX = c * (T.COL_W + T.CONN_W);
      const gx = side === "L" ? localX : canvasW - localX - T.COL_W;
      wing[c].forEach((m, i) => {
        cells.push(
          <View
            key={`${side}-${m.id}`}
            style={{ position: "absolute", left: gx, top: T.PAD_TOP + centers[c][i] - MATCH_H / 2, width: T.COL_W }}
          >
            <TradMatch
              match={m} dir={side} number={numberById[m.id]}
              sameDojo={sameDojoMatchIds.has(m.id)}
              advancing={advancingMatch === m.id}
              {...slotShared}
            />
          </View>
        );
      });

      // Conectores desta coluna → próxima (ou → final, na última).
      const colRight = localX + T.COL_W;
      const midX = colRight + T.CONN_W / 2;
      // Convenção (mesma de buildBracketHtml): segmento HORIZONTAL passa
      // h = 0 (a espessura entra sozinha); segmento VERTICAL passa w = 0.
      // O espelho da asa direita reflete a BORDA no horizontal
      // (x' = canvasW − x − w) e o EIXO no vertical (x' = canvasW − x),
      // senão o traço vertical fica deslocado de uma espessura.
      const pushSeg = (x: number, y: number, w: number, h: number, red: boolean, key: string) => {
        const horizontal = h === 0;
        const mx = side === "L" ? x : canvasW - x - (horizontal ? w : 0);
        lines.push(
          <View
            key={key}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: horizontal ? mx : mx - T.LINE / 2,
              top: T.PAD_TOP + y - T.LINE / 2,
              width: horizontal ? w : T.LINE,
              height: horizontal ? T.LINE : h + T.LINE,
              backgroundColor: red ? P.red : CONNECT_COLOR,
            }}
          />
        );
      };
      if (c === wingRounds - 1) {
        // Asa → final: linha reta (o centro da final é o centro da semi).
        pushSeg(colRight, centers[c][0], T.CONN_W, 0, !!wing[c][0]?.winner_entry_id, `${side}-fin`);
      } else {
        // Percorre pelos CENTROS da coluna seguinte (não pelo array da asa):
        // garante que topY/botY existam mesmo em chave desbalanceada.
        for (let i = 0; i < centers[c + 1].length; i++) {
          const topY = centers[c][2 * i];
          const botY = centers[c][2 * i + 1];
          if (topY === undefined || botY === undefined) continue;
          const childY = (topY + botY) / 2;
          const topRed = !!wing[c][2 * i]?.winner_entry_id;
          const botRed = !!wing[c][2 * i + 1]?.winner_entry_id;
          pushSeg(colRight, topY, T.CONN_W / 2, 0, topRed, `${side}-${c}-${i}-a`);
          pushSeg(colRight, botY, T.CONN_W / 2, 0, botRed, `${side}-${c}-${i}-b`);
          pushSeg(midX, topY, 0, childY - topY, topRed, `${side}-${c}-${i}-v1`);
          pushSeg(midX, childY, 0, botY - childY, botRed, `${side}-${c}-${i}-v2`);
          pushSeg(midX, childY, T.CONN_W / 2, 0, topRed || botRed, `${side}-${c}-${i}-c`);
        }
      }
    }
  });

  // ── Cabeçalhos de rodada (nas duas asas + final no centro) ─────────
  const headerLabels: Array<{ x: number; w: number; label: string; count: number }> = [];
  for (let c = 0; c < wingRounds; c++) {
    const lx = c * (T.COL_W + T.CONN_W);
    headerLabels.push({ x: lx, w: T.COL_W, label: roundLabel(c, totalRounds), count: rounds[c].length });
    headerLabels.push({ x: canvasW - lx - T.COL_W, w: T.COL_W, label: roundLabel(c, totalRounds), count: rounds[c].length });
  }
  headerLabels.push({ x: wingW, w: T.FINAL_W, label: roundLabel(totalRounds - 1, totalRounds), count: 1 });

  // ── Pódio (rodapé da folha) ────────────────────────────────────────
  const finalMatch = rounds[totalRounds - 1][0];
  const finalWinnerId = finalMatch.winner_entry_id;
  const finalAka = athleteOf(finalMatch.aka);
  const finalShiro = athleteOf(finalMatch.shiro);
  const second = finalWinnerId
    ? (finalAka && finalAka.entry_id === finalWinnerId ? finalShiro : finalAka)
    : null;
  let thirds: (BracketAthleteRef | null)[] = [];
  if (third) {
    const w = third.winner_entry_id;
    const ta = athleteOf(third.aka);
    const ts = athleteOf(third.shiro);
    thirds = [w ? (ta && ta.entry_id === w ? ta : ts && ts.entry_id === w ? ts : null) : null];
  } else if (totalRounds >= 2) {
    // Sem disputa: os DOIS perdedores das semis são terceiros (folha FPKT).
    thirds = (rounds[totalRounds - 2] || []).map((m) => {
      if (!m.winner_entry_id) return null;
      const a = athleteOf(m.aka);
      const s = athleteOf(m.shiro);
      return a && a.entry_id === m.winner_entry_id ? s : a;
    });
  }

  // ── Observações de formato (phase_plan resolvido por rodada) ───────
  const formatLines: string[] = [];
  if (phasesByRound && phasesByRound.length > 0) {
    let start = 0;
    for (let r = 1; r <= phasesByRound.length; r++) {
      const cur = r < phasesByRound.length ? (phasesByRound[r]?.format_label || null) : null;
      const prev = phasesByRound[start]?.format_label || null;
      if (r === phasesByRound.length || cur !== prev) {
        if (prev) {
          const a = roundLabel(start, totalRounds);
          const b = roundLabel(r - 1, totalRounds);
          formatLines.push(a === b ? `${a}: ${prev}` : `${a} até ${b}: ${prev}`);
        }
        start = r;
      }
    }
  }

  const fedComp = [federationName, competitionName].filter(Boolean).join(" — ");

  return (
    <View style={tradStyles.sheet}>
      {/* Cabeçalho da folha: Koto · categoria centralizada · Data */}
      <View style={[tradStyles.headRow, { width: canvasW }]}>
        <Text style={tradStyles.headField}>KOTO: ________</Text>
        <View style={tradStyles.headCenter}>
          <Text style={tradStyles.headCat} numberOfLines={2}>{catName}</Text>
          {!!fedComp && <Text style={tradStyles.headComp} numberOfLines={1}>{fedComp}</Text>}
        </View>
        <Text style={[tradStyles.headField, { textAlign: "right" }]}>DATA: ___/___/___</Text>
      </View>

      {/* Cabeçalhos de rodada */}
      <View style={{ width: canvasW, height: 30, marginBottom: 2 }}>
        {headerLabels.map((h, i) => (
          <View key={i} style={{ position: "absolute", left: h.x, width: h.w, alignItems: "center" }}>
            <Text style={tradStyles.colLabel}>{h.label}</Text>
            <Text style={tradStyles.colCount}>{h.count === 1 ? "1 luta" : `${h.count} lutas`}</Text>
          </View>
        ))}
      </View>

      {/* Canvas da árvore (posições calculadas) */}
      <View style={{ width: canvasW, height: canvasH }}>
        {lines}
        {cells}
        {/* Coluna central: final → campeão → disputa de 3º */}
        <View style={{ position: "absolute", left: wingW, top: T.PAD_TOP + finalTopLocal, width: T.FINAL_W }}>
          <TradMatch
            match={finalMatch} dir="C" number={numberById[finalMatch.id]}
            sameDojo={false}
            advancing={advancingMatch === finalMatch.id}
            {...slotShared}
          />
          <View style={{ marginTop: 18 }}>
            {champion ? (
              <View style={S.champCard}>
                <Icon name="trophy" size={18} color={P.red} />
                <Text style={S.champLabel}>Campeão</Text>
                <Text style={S.champName}>{champion.student_name}</Text>
                <Text style={S.champDojo}>{champion.dojo_name}</Text>
              </View>
            ) : (
              <View style={S.champPending}>
                <Text style={S.champPendingLabel}>Campeão</Text>
                <Text style={S.champPendingName}>a definir</Text>
              </View>
            )}
          </View>
          {third && (
            <View style={{ marginTop: 20 }}>
              <Text style={tradStyles.thirdLabel}>Disputa de 3º lugar</Text>
              <TradMatch
                match={third} dir="C"
                sameDojo={false}
                advancing={advancingMatch === "third" || advancingMatch === third.id}
                {...slotShared}
              />
            </View>
          )}
        </View>
      </View>

      {/* Rodapé da folha: pódio + observações de formato */}
      <View style={[tradStyles.footRow, { width: canvasW }]}>
        <View style={tradStyles.podium}>
          <PodiumLine label="1º LUGAR" athlete={champion} />
          <PodiumLine label="2º LUGAR" athlete={second} />
          {thirds.map((t, i) => <PodiumLine key={i} label="3º LUGAR" athlete={t} />)}
        </View>
        <View style={tradStyles.footObs}>
          {formatLines.map((l) => <Text key={l} style={tradStyles.obsText}>{l}</Text>)}
          {!third && totalRounds >= 2 && (
            <Text style={tradStyles.obsText}>Não tem disputa de 3º lugar</Text>
          )}
        </View>
      </View>
    </View>
  );
}

// Linha do pódio: rótulo + nome (ou linha em branco pra preencher à mão).
function PodiumLine({ label, athlete }: { label: string; athlete: BracketAthleteRef | null }) {
  return (
    <View style={tradStyles.podiumLine}>
      <Text style={tradStyles.podiumLabel}>{label}</Text>
      <View style={tradStyles.podiumFill}>
        {athlete ? (
          <Text style={tradStyles.podiumName} numberOfLines={1}>
            {athlete.student_name}
            {athlete.dojo_name ? <Text style={tradStyles.podiumDojo}>  ·  {athlete.dojo_name}</Text> : null}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ── TradMatch — a "dupla" da folha: duas linhas de atleta + chip do nº ──
// `dir` controla o espelhamento: "L" (asa esquerda, conector à direita),
// "R" (asa direita, conector à esquerda), "C" (final/3º, centro).
function TradMatch({
  match, dir, number, sameDojo, advancing, locked, editMode, dnd, onAdvance,
  selectedSlot, movedFlash, onSlotPress,
}: {
  match: BracketMatch;
  dir: "L" | "R" | "C";
  number?: number;
  /** Confronto de 1ª rodada com os dois atletas do MESMO dojô (aviso). */
  sameDojo: boolean;
  advancing: boolean;
} & SlotSharedProps) {
  const shared = { advancing, locked, editMode, dnd, onAdvance, selectedSlot, movedFlash, onSlotPress };
  return (
    <View style={{ height: MATCH_H }}>
      <MatchSide
        matchId={match.id} side="aka" value={match.aka}
        winnerId={match.winner_entry_id} otherValue={match.shiro}
        score={match.aka_score}
        {...shared}
      />
      <View style={{ height: T.SLOT_GAP }} />
      <MatchSide
        matchId={match.id} side="shiro" value={match.shiro}
        winnerId={match.winner_entry_id} otherValue={match.aka}
        score={match.shiro_score}
        {...shared}
      />
      {typeof number === "number" && (
        <View
          pointerEvents="none"
          style={[
            tradStyles.numRow,
            { justifyContent: dir === "R" ? "flex-start" : dir === "L" ? "flex-end" : "center" },
          ]}
        >
          <View style={tradStyles.numChip}>
            <Text style={tradStyles.numChipText}>{number}</Text>
          </View>
        </View>
      )}
      {sameDojo && <View style={[tradStyles.clashBar, dir === "R" ? { right: -8 } : { left: -8 }]} />}
      {sameDojo && (
        <View style={[tradStyles.clashBadgeWrap, dir === "R" ? { right: 0 } : { left: 0 }]}>
          <SameDojoBadge compact />
        </View>
      )}
    </View>
  );
}

function MatchSide({
  matchId, side, value, winnerId, otherValue, score, advancing, locked, editMode, dnd, onAdvance,
  selectedSlot, movedFlash, onSlotPress,
}: {
  matchId: string;
  side: "aka" | "shiro";
  value: BracketAthleteRef | "bye" | null;
  winnerId: string | null;
  otherValue: BracketAthleteRef | "bye" | null;
  score?: number;
  advancing: boolean;
  locked: boolean;
  editMode: boolean;
  dnd: ReturnType<typeof useBracketDragAndDrop>;
  onAdvance: (matchId: string, winnerId: string) => void;
  selectedSlot: BracketSlotId | null;
  movedFlash: Record<string, number>;
  onSlotPress: (slot: BracketSlotId, hasAthlete: boolean) => void;
}) {
  const isBye = value === "bye";
  const athlete = !isBye && value !== null ? (value as BracketAthleteRef) : null;
  const otherAthlete = otherValue && otherValue !== "bye" ? (otherValue as BracketAthleteRef) : null;
  const isWinner = !!winnerId && !!athlete && winnerId === athlete.entry_id;
  const isLoser = !!winnerId && !!otherAthlete && winnerId === otherAthlete.entry_id;

  const slot: BracketSlotId = { matchId, side };
  const isDraggable = editMode && isWeb && !!athlete;
  const isHoverTarget = dnd.hoverSlot?.matchId === matchId && dnd.hoverSlot?.side === side;
  const isDraggingThis = dnd.draggingSlot?.matchId === matchId && dnd.draggingSlot?.side === side;

  // Clique-para-mover: este slot é a origem selecionada? Existe uma seleção
  // ativa em OUTRO slot (então este acende como destino válido)?
  const isSelected = !!selectedSlot && selectedSlot.matchId === matchId && selectedSlot.side === side;
  const isTargetable = editMode && !!selectedSlot && !isSelected;
  const flashTs = movedFlash[slotKey(slot)];

  const dragRef = useDraggableSlotRef(isDraggable, slot, dnd.onSlotDragStart, dnd.onSlotDragEnd);
  const dropRef = useSlotDropZoneRef(slot, dnd.onDrop, dnd.onHoverChange);

  // Combina os dois refs num único ref callback (o slot precisa ser
  // draggable E drop-zone ao mesmo tempo — troca em qualquer direção).
  const combinedRef = useCallback((node: any) => {
    (dragRef as any).current = node;
    (dropRef as any).current = node;
  }, [dragRef, dropRef]);

  const canClickAdvance = !editMode && locked && !advancing && !isBye && athlete !== null;

  const sideStyle = [
    tradStyles.slot,
    // AKA = linha VERMELHA (como na folha oficial da FPKT, onde o lado
    // aka é o traço vermelho) — pedido do produto: aka bem mais visual.
    side === "aka" && tradStyles.slotAka,
    isWinner && tradStyles.slotWinner,
    isLoser && tradStyles.slotLoser,
    editMode && isDraggable && ctrlStyles.slotDraggable,
    isTargetable && ctrlStyles.slotTargetable,
    isHoverTarget && ctrlStyles.slotHover,
    isSelected && ctrlStyles.slotSelected,
    isDraggingThis && ctrlStyles.slotDragging,
  ];

  // Linha sublinhada da folha: NOME à esquerda, DOJÔ à direita (menor/
  // atenuado) na MESMA linha; vencedor = sublinhado vermelho + negrito + ✓.
  const content = (
    <>
      {isBye ? (
        <ByeText />
      ) : athlete ? (
        <>
          {editMode && isWeb && (
            <Icon name="drag-handle" size={13} color={isSelected ? P.red : C.ink4} />
          )}
          <View style={[tradStyles.sideDot, side === "aka" ? tradStyles.sideDotAka : tradStyles.sideDotShiro]} />
          <Text style={[tradStyles.name, isWinner && tradStyles.nameWinner]} numberOfLines={1}>
            {athlete.student_name}
          </Text>
          {isWinner && typeof score === "number" && (
            <Text style={ctrlStyles.scoreTag}>{score}</Text>
          )}
          {isWinner && <Icon name="check" size={12} color={P.red} />}
          <Text style={tradStyles.dojo} numberOfLines={1}>{athlete.dojo_name || ""}</Text>
        </>
      ) : (
        <PendingText />
      )}
      {!!flashTs && <MovedFlash key={flashTs} />}
      {advancing && <ActivityIndicator size="small" color={P.red} style={{ position: "absolute", right: 6 }} />}
    </>
  );

  // Em web + modo edição: View com refs pro DnD via DOM nativo (mesma técnica
  // do LeadCard/KanbanColumn do CRM). O clique no slot alimenta o fluxo
  // clique-para-mover (selecionar origem → clicar destino).
  if (isWeb && editMode) {
    return (
      // @ts-ignore — RN Web aceita onClick em View
      <View ref={combinedRef} style={sideStyle} onClick={() => onSlotPress(slot, !!athlete)}>
        {content}
      </View>
    );
  }

  // Mobile em modo edição: mesmo fluxo clique-para-mover (sem drag nativo).
  // Fora do modo edição (qualquer plataforma): clique-para-vencedor.
  return (
    <TouchableOpacity
      disabled={editMode ? false : !canClickAdvance}
      onPress={
        editMode
          ? () => onSlotPress(slot, !!athlete)
          : (canClickAdvance && athlete ? () => onAdvance(matchId, athlete.entry_id) : undefined)
      }
      style={sideStyle}
    >
      {content}
    </TouchableOpacity>
  );
}

// ── Estilos locais (Fase 2: controles de edição + modal de placar) ──────
const ctrlStyles = StyleSheet.create({
  actionsRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 12 } as ViewStyle,
  actionBtn: { paddingHorizontal: 14 } as ViewStyle,
  toggleBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.md,
    borderWidth: 1, borderColor: C.line2, backgroundColor: P.glass2,
  } as ViewStyle,
  toggleBtnActive: { backgroundColor: C.ink, borderColor: C.ink } as ViewStyle,
  toggleBtnDisabled: { opacity: 0.5 } as ViewStyle,
  toggleBtnText: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: C.ink2 } as TextStyle,
  toggleBtnTextActive: { color: "#fdf8f2" } as TextStyle,
  toggleBtnTextDisabled: { color: C.ink4 } as TextStyle,

  // slot states (drag + clique-para-mover)
  slotDraggable: { cursor: "grab" as any },
  slotHover: { backgroundColor: P.redWash, borderLeftColor: P.red } as ViewStyle,
  slotDragging: { opacity: 0.5 } as ViewStyle,
  // Origem selecionada no fluxo por clique: acende firme.
  slotSelected: { backgroundColor: P.redWash, borderLeftColor: P.red } as ViewStyle,
  // Há uma origem selecionada → os demais slots acendem SUAVE como destino.
  slotTargetable: { backgroundColor: "rgba(184,70,58,0.04)", cursor: "pointer" as any } as ViewStyle,
  scoreTag: { fontFamily: F.mono, fontSize: 11, fontWeight: "700", color: C.ink2, marginLeft: 4, marginRight: 2 } as TextStyle,

  // Desfazer (só em modo edição)
  undoBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.md,
    borderWidth: 1, borderColor: C.line2, backgroundColor: P.glass2,
  } as ViewStyle,
  undoBtnDisabled: { opacity: 0.55 } as ViewStyle,
  undoBtnText: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: C.ink2 } as TextStyle,
  undoBtnTextDisabled: { color: C.ink4 } as TextStyle,
  undoCount: { minWidth: 16, height: 16, borderRadius: 8, backgroundColor: C.ink, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 } as ViewStyle,
  undoCountText: { fontFamily: F.mono, fontSize: 9, fontWeight: "700", color: P.paperWarm } as TextStyle,

  // Barra de visualização (colisões + zoom)
  viewBar: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 } as ViewStyle,
  clashChip: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.md,
    backgroundColor: P.warnWash, borderWidth: 1, borderColor: "rgba(122,87,36,0.24)",
  } as ViewStyle,
  clashChipText: { flex: 1, fontFamily: F.body, fontSize: 11.5, color: P.warn, lineHeight: 15 } as TextStyle,
  zoomCluster: { flexDirection: "row", alignItems: "center", gap: 4 } as ViewStyle,
  zoomBtn: {
    width: 26, height: 26, borderRadius: R.sm, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.line2, backgroundColor: P.glass2,
  } as ViewStyle,
  zoomBtnDisabled: { opacity: 0.45 } as ViewStyle,
  zoomLabel: { fontFamily: F.mono, fontSize: 11, color: C.ink3, width: 38, textAlign: "center", fontVariant: ["tabular-nums"] } as TextStyle,

  scrollHintRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 6 } as ViewStyle,

  // score modal (mesmo padrão do sheet de nota Kata em chaves.tsx)
  overlay: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 24 } as ViewStyle,
  sheet: { width: "100%", maxWidth: 360, backgroundColor: P.glassHi, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 20, gap: 8 } as ViewStyle,
  sheetTitle: { fontFamily: F.heading, fontSize: 18, fontWeight: "400", color: C.ink } as TextStyle,
  sheetSub: { fontFamily: F.body, fontSize: 12, color: C.ink3, marginBottom: 4 } as TextStyle,
  scoreRow: { flexDirection: "row", gap: 12 } as ViewStyle,
  inputLabel: { fontFamily: F.body, fontSize: 11, fontWeight: "700", color: C.ink3, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.6 } as TextStyle,
  input: { borderWidth: 1, borderColor: C.line2, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 10, fontFamily: F.mono, fontSize: 18, color: C.ink, backgroundColor: P.glass2 } as TextStyle,
  sheetActions: { flexDirection: "row", gap: 8, marginTop: 12 } as ViewStyle,
});

// ── Estilos da FOLHA TRADICIONAL (referência: folha oficial FPKT) ───────
const tradStyles = StyleSheet.create({
  // A folha em si: papel Shoji elevado dentro da moldura de scroll.
  sheet: { backgroundColor: P.glassHi, borderRadius: R.lg, padding: 20 } as ViewStyle,

  // Cabeçalho da folha (KOTO · categoria/competição · DATA)
  headRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 14, gap: 12 } as ViewStyle,
  headField: { flex: 1, fontFamily: F.mono, fontSize: 10, color: C.ink3, letterSpacing: 0.4 } as TextStyle,
  headCenter: { flex: 2, alignItems: "center", gap: 2 } as ViewStyle,
  headCat: { fontFamily: F.heading, fontSize: 17, color: C.ink, textAlign: "center" } as TextStyle,
  headComp: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", color: P.red, letterSpacing: 0.6, textTransform: "uppercase", textAlign: "center" } as TextStyle,

  // Cabeçalhos de rodada
  colLabel: { fontFamily: F.body, fontSize: 9.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.2, color: C.ink2 } as TextStyle,
  colCount: { fontFamily: F.body, fontSize: 8.5, color: C.ink4 } as TextStyle,

  // Linha do atleta (o "sublinhado" da folha)
  slot: {
    height: T.SLOT_H, flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 3, paddingBottom: 2,
    borderBottomWidth: 1.5, borderBottomColor: "rgba(43,38,32,0.55)",
  } as ViewStyle,
  slotAka: { borderBottomColor: P.red } as ViewStyle,
  slotWinner: { borderBottomWidth: 2, borderBottomColor: P.red } as ViewStyle,
  slotLoser: { opacity: 0.45 } as ViewStyle,
  sideDot: { width: 5, height: 5, borderRadius: 2.5, flexShrink: 0 } as ViewStyle,
  sideDotAka: { backgroundColor: P.red, width: 7, height: 7, borderRadius: 3.5 } as ViewStyle,
  sideDotShiro: { backgroundColor: C.ink3 } as ViewStyle,
  name: { flexShrink: 1, fontFamily: F.body, fontSize: 12.5, fontWeight: "600", color: C.ink, lineHeight: 16 } as TextStyle,
  nameWinner: { fontWeight: "700" } as TextStyle,
  dojo: {
    marginLeft: "auto", maxWidth: "44%", fontFamily: F.body, fontSize: 9,
    color: C.ink3, letterSpacing: 0.4, textTransform: "uppercase", textAlign: "right",
  } as TextStyle,

  // Chip do número da luta (o retângulo amarelo da folha, em âmbar Shoji)
  numRow: {
    position: "absolute", left: 0, right: 0,
    top: T.SLOT_H + T.SLOT_GAP / 2 - 9,
    flexDirection: "row", paddingHorizontal: 2,
  } as ViewStyle,
  numChip: {
    minWidth: 24, height: 18, paddingHorizontal: 5, borderRadius: 4,
    backgroundColor: P.warnWash, borderWidth: 1, borderColor: "rgba(122,87,36,0.35)",
    alignItems: "center", justifyContent: "center",
  } as ViewStyle,
  numChipText: { fontFamily: F.mono, fontSize: 10, fontWeight: "700", color: P.warn, fontVariant: ["tabular-nums"] } as TextStyle,

  // Colisão de dojô na dupla: barra âmbar no flanco externo + badge abaixo
  clashBar: { position: "absolute", top: 2, bottom: 2, width: 3, borderRadius: 2, backgroundColor: P.warn, opacity: 0.45 } as ViewStyle,
  clashBadgeWrap: { position: "absolute", top: MATCH_H + 3, flexDirection: "row" } as ViewStyle,

  thirdLabel: { fontFamily: F.body, fontSize: 9.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.2, color: C.ink2, textAlign: "center", marginBottom: 6 } as TextStyle,

  // Rodapé da folha: pódio + observações
  footRow: { flexDirection: "row", gap: 24, marginTop: 16, alignItems: "flex-start" } as ViewStyle,
  podium: { flex: 1, maxWidth: 380, gap: 8 } as ViewStyle,
  podiumLine: { flexDirection: "row", alignItems: "flex-end", gap: 10 } as ViewStyle,
  podiumLabel: { fontFamily: F.mono, fontSize: 10, fontWeight: "700", color: C.ink2, width: 74 } as TextStyle,
  podiumFill: { flex: 1, minHeight: 16, borderBottomWidth: 1, borderBottomColor: C.line2, paddingBottom: 2, justifyContent: "flex-end" } as ViewStyle,
  podiumName: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: C.ink } as TextStyle,
  podiumDojo: { fontFamily: F.body, fontSize: 10, fontWeight: "400", color: C.ink3 } as TextStyle,
  footObs: { flex: 1, alignItems: "flex-end", gap: 4 } as ViewStyle,
  obsText: { fontFamily: F.body, fontSize: 10, fontWeight: "700", color: P.red, letterSpacing: 0.4, textTransform: "uppercase", textAlign: "right" } as TextStyle,
});
