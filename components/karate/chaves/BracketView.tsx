// ============================================================
// Chaves — BracketView + MatchCard · Shoji (Fase 2)
//
// Visualização do bracket Kumite (rounds em colunas + coluna do
// campeão + disputa de 3º lugar).
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
  styles as S, initials, roundLabel, ByeText, PendingText, SameDojoBadge,
} from "./shared";
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

      {/* Bracket — horizontal scroll */}
      <ScrollView horizontal showsHorizontalScrollIndicator style={S.bracketScroll}>
        <View style={[
          S.bracketInner,
          isWeb && zoom !== 1 && ({ transform: [{ scale: zoom }], transformOrigin: "top left" } as any),
        ]}>
          {bracket.rounds.map((round, rIdx) => (
            <View key={rIdx} style={S.bracketCol}>
              <View style={S.roundHead}>
                <Text style={S.roundLabel}>{roundLabel(rIdx, totalRounds)}</Text>
                <Text style={S.roundCount}>{round.length === 1 ? "1 luta" : `${round.length} lutas`}</Text>
              </View>
              {round.map((match) => {
                const liveMatch = editMode ? (findMatch(match.id) || match) : match;
                return (
                  <MatchCard
                    key={match.id}
                    match={liveMatch}
                    advancing={advancingMatch === match.id}
                    locked={locked}
                    editMode={editMode}
                    dnd={dnd}
                    onAdvance={openScoreModal}
                    sameDojo={sameDojoMatchIds.has(match.id)}
                    selectedSlot={selectedSlot}
                    movedFlash={movedFlash}
                    onSlotPress={handleSlotPress}
                  />
                );
              })}
            </View>
          ))}
          {/* Champion column */}
          <View style={S.champCol}>
            <View style={S.roundHead}>
              <Text style={S.roundLabel}>Campeão</Text>
            </View>
            {bracket.champion ? (
              <View style={S.champCard}>
                <Icon name="trophy" size={18} color={P.red} />
                <Text style={S.champLabel}>Campeão</Text>
                <Text style={S.champName}>{bracket.champion.student_name}</Text>
                <Text style={S.champDojo}>{bracket.champion.dojo_name}</Text>
              </View>
            ) : (
              <View style={S.champPending}>
                <Text style={S.champPendingLabel}>Campeão</Text>
                <Text style={S.champPendingName}>a definir</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={ctrlStyles.scrollHintRow}>
        <Text style={[S.scrollHint, { marginTop: 0 }]}>Role para o lado para ver as rodadas finais</Text>
        <Icon name="arrow-right" size={12} color={C.ink4} />
      </View>

      {/* 3rd place */}
      {bracket.third_place_match && (
        <View style={{ marginTop: 24 }}>
          <Text style={S.thirdLabel}>3º lugar</Text>
          <MatchCard
            match={editMode ? (findMatch(bracket.third_place_match.id) || bracket.third_place_match) : bracket.third_place_match}
            advancing={advancingMatch === "third"}
            locked={locked}
            editMode={editMode}
            dnd={dnd}
            onAdvance={openScoreModal}
            sameDojo={false}
            selectedSlot={selectedSlot}
            movedFlash={movedFlash}
            onSlotPress={handleSlotPress}
          />
        </View>
      )}

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

// ── MatchCard ────────────────────────────────────────────────────────────
function MatchCard({
  match, advancing, locked, editMode, dnd, onAdvance, sameDojo, selectedSlot, movedFlash, onSlotPress,
}: {
  match: BracketMatch;
  advancing: boolean;
  locked: boolean;
  editMode: boolean;
  dnd: ReturnType<typeof useBracketDragAndDrop>;
  onAdvance: (matchId: string, winnerId: string) => void;
  /** Confronto de 1ª rodada com os dois atletas do MESMO dojô (aviso). */
  sameDojo: boolean;
  selectedSlot: BracketSlotId | null;
  movedFlash: Record<string, number>;
  onSlotPress: (slot: BracketSlotId, hasAthlete: boolean) => void;
}) {
  const shared = { advancing, locked, editMode, dnd, onAdvance, selectedSlot, movedFlash, onSlotPress };
  return (
    <View style={[S.matchCard, { marginBottom: 8 }, sameDojo && ctrlStyles.matchCardClash]}>
      {sameDojo && (
        <View style={ctrlStyles.clashStrip}>
          <SameDojoBadge />
          <Text style={ctrlStyles.clashStripText}>na 1ª luta</Text>
        </View>
      )}
      <MatchSide
        matchId={match.id} side="aka" value={match.aka} border={P.red}
        winnerId={match.winner_entry_id} otherValue={match.shiro}
        score={match.aka_score}
        {...shared}
      />
      <View style={S.matchDivider} />
      <MatchSide
        matchId={match.id} side="shiro" value={match.shiro} border={C.ink3}
        winnerId={match.winner_entry_id} otherValue={match.aka}
        score={match.shiro_score}
        {...shared}
      />
    </View>
  );
}

function MatchSide({
  matchId, side, value, border, winnerId, otherValue, score, advancing, locked, editMode, dnd, onAdvance,
  selectedSlot, movedFlash, onSlotPress,
}: {
  matchId: string;
  side: "aka" | "shiro";
  value: BracketAthleteRef | "bye" | null;
  border: string;
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
    S.matchSide,
    { borderLeftColor: border },
    isWinner && S.matchSideWinner,
    isLoser && S.matchSideLoser,
    editMode && isDraggable && ctrlStyles.slotDraggable,
    isTargetable && ctrlStyles.slotTargetable,
    isHoverTarget && ctrlStyles.slotHover,
    isSelected && ctrlStyles.slotSelected,
    isDraggingThis && ctrlStyles.slotDragging,
  ];

  const content = (
    <>
      {isBye ? (
        <ByeText />
      ) : athlete ? (
        <View style={S.athleteRow}>
          {editMode && isWeb && (
            <Icon name="drag-handle" size={14} color={isSelected ? P.red : C.ink4} />
          )}
          <View style={S.av}>
            <Text style={S.avText}>{initials(athlete.student_name)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[S.athleteName, isWinner && S.athleteNameWinner]} numberOfLines={1}>
              {athlete.student_name}
            </Text>
            <Text style={S.athleteDojo} numberOfLines={2}>{athlete.dojo_name}</Text>
          </View>
          {isWinner && typeof score === "number" && (
            <Text style={ctrlStyles.scoreTag}>{score}</Text>
          )}
          {isWinner && <Icon name="check" size={13} color={P.red} />}
        </View>
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

  // Colisão de dojô no card (faixa fina no topo do confronto)
  matchCardClash: { borderColor: "rgba(122,87,36,0.35)" } as ViewStyle,
  clashStrip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: P.warnWash, borderBottomWidth: 1, borderBottomColor: "rgba(122,87,36,0.18)",
  } as ViewStyle,
  clashStripText: { fontFamily: F.body, fontSize: 9.5, color: P.warn } as TextStyle,

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
