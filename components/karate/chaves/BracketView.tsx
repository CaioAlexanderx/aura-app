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
//     modo edição mostra aviso e o clique-para-vencedor continua disponível.
// ============================================================
import React, { useCallback, useMemo, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Platform, StyleSheet, ViewStyle, TextStyle,
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
import {
  styles as S, initials, roundLabel, ByeText, PendingText,
} from "./shared";
import {
  useBracketDragAndDrop, useDraggableSlotRef, useSlotDropZoneRef, BracketSlotId,
} from "./useBracketDragAndDrop";

const isWeb = Platform.OS === "web";

// Slot vazio ("bye" ou null) não é arrastável nem carrega atleta.
type SlotValue = BracketAthleteRef | "bye" | null;

export function BracketView({
  bracket, advancingMatch, onAdvance, onReopen, catName, federationId, cid, catId, onReloaded,
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
}) {
  const totalRounds = bracket.rounds.length;
  const locked = bracket.status === "locked";

  // ── Modo edição total (drag-and-drop) ─────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  // Cópia local editável dos matches (achatado: todos os rounds + third).
  // Só existe enquanto editMode = true; ao sair sem salvar, é descartada.
  const [draftMatches, setDraftMatches] = useState<BracketMatch[] | null>(null);
  const [dirty, setDirty] = useState(false);

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

  // ── Entrar/sair do modo edição ─────────────────────────────────────
  const handleToggleEditMode = useCallback(() => {
    if (!locked) {
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
    } else {
      // Snapshot local (deep-ish copy) pra edição isolada do estado do servidor.
      setDraftMatches(allMatchesFlat.map((m) => ({ ...m })));
      setDirty(false);
      setEditMode(true);
    }
  }, [locked, editMode, dirty, allMatchesFlat]);

  // ── Troca (swap) de posições entre dois slots quaisquer ─────────────
  const handleSwap = useCallback((from: BracketSlotId, to: BracketSlotId) => {
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
  }, []);

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
      return;
    }

    setSaving(true);
    try {
      await karateBracketsApi.saveMatches(federationId, cid, catId, edits);
      toast.success("Chave salva com sucesso.");
      setEditMode(false);
      setDraftMatches(null);
      setDirty(false);
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
          style={[ctrlStyles.toggleBtn, editMode && ctrlStyles.toggleBtnActive]}
          onPress={handleToggleEditMode}
          disabled={saving}
        >
          <Icon name={editMode ? "unlock" : "edit"} size={14} color={editMode ? "#fdf8f2" : C.ink2} />
          <Text style={[ctrlStyles.toggleBtnText, editMode && ctrlStyles.toggleBtnTextActive]}>
            {editMode ? "Modo edição (ativo)" : "Modo edição"}
          </Text>
        </TouchableOpacity>

        {editMode ? (
          <ShojiButton
            label={saving ? "Salvando..." : "Salvar chave"}
            icon="save"
            variant="accent"
            onPress={handleSave}
            style={ctrlStyles.actionBtn}
          />
        ) : (
          <>
            <ShojiButton
              label={resetting ? "Limpando..." : "Limpar resultados"}
              icon="refresh"
              variant="ghost"
              onPress={handleReset}
              style={ctrlStyles.actionBtn}
            />
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
      </View>

      <View style={S.bracketHint}>
        <Icon name="info" size={14} color={P.red} />
        <Text style={S.bracketHintText}>
          {editMode
            ? (isWeb
              ? "Arraste um atleta sobre outro slot para trocar as posições. Depois clique em \"Salvar chave\"."
              : "Arrastar-e-soltar só funciona na versão web. Use a versão web para editar posições; no app, use apenas o clique para lançar vencedores.")
            : "Clique no vencedor para lançar o resultado."}
        </Text>
      </View>

      {/* Bracket — horizontal scroll */}
      <ScrollView horizontal showsHorizontalScrollIndicator style={S.bracketScroll}>
        <View style={S.bracketInner}>
          {bracket.rounds.map((round, rIdx) => (
            <View key={rIdx} style={S.bracketCol}>
              <Text style={S.roundLabel}>{roundLabel(rIdx, totalRounds)}</Text>
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
                  />
                );
              })}
            </View>
          ))}
          {/* Champion column */}
          <View style={S.champCol}>
            <Text style={S.roundLabel}>Campeão</Text>
            {bracket.champion ? (
              <View style={S.champCard}>
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

      <Text style={S.scrollHint}>Role para o lado para ver as rodadas finais →</Text>

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
    </View>
  );
}

// ── MatchCard ────────────────────────────────────────────────────────────
function MatchCard({
  match, advancing, locked, editMode, dnd, onAdvance,
}: {
  match: BracketMatch;
  advancing: boolean;
  locked: boolean;
  editMode: boolean;
  dnd: ReturnType<typeof useBracketDragAndDrop>;
  onAdvance: (matchId: string, winnerId: string) => void;
}) {
  return (
    <View style={[S.matchCard, { marginBottom: 8 }]}>
      <MatchSide
        matchId={match.id} side="aka" value={match.aka} border={P.red}
        winnerId={match.winner_entry_id} otherValue={match.shiro}
        score={match.aka_score}
        advancing={advancing} locked={locked} editMode={editMode} dnd={dnd} onAdvance={onAdvance}
      />
      <View style={S.matchDivider} />
      <MatchSide
        matchId={match.id} side="shiro" value={match.shiro} border={C.ink3}
        winnerId={match.winner_entry_id} otherValue={match.aka}
        score={match.shiro_score}
        advancing={advancing} locked={locked} editMode={editMode} dnd={dnd} onAdvance={onAdvance}
      />
    </View>
  );
}

function MatchSide({
  matchId, side, value, border, winnerId, otherValue, score, advancing, locked, editMode, dnd, onAdvance,
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
    isHoverTarget && ctrlStyles.slotHover,
    isDraggingThis && ctrlStyles.slotDragging,
  ];

  const content = (
    <>
      {isBye ? (
        <ByeText />
      ) : athlete ? (
        <View style={S.athleteRow}>
          {editMode && isWeb && (
            <Icon name="drag-handle" size={14} color={C.ink4} />
          )}
          <View style={S.av}>
            <Text style={S.avText}>{initials(athlete.student_name)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[S.athleteName, isWinner && S.athleteNameWinner]} numberOfLines={1}>
              {athlete.student_name}
            </Text>
            <Text style={S.athleteDojo} numberOfLines={1}>{athlete.dojo_name}</Text>
          </View>
          {isWinner && typeof score === "number" && (
            <Text style={ctrlStyles.scoreTag}>{score}</Text>
          )}
          {isWinner && <Text style={S.winMark}>✓</Text>}
        </View>
      ) : (
        <PendingText />
      )}
      {advancing && <ActivityIndicator size="small" color={P.red} style={{ position: "absolute", right: 6 }} />}
    </>
  );

  // Em web + modo edição: View com refs pro DnD via DOM nativo (mesma técnica
  // do LeadCard/KanbanColumn do CRM). Fora do modo edição (ou fora da web),
  // TouchableOpacity comum cuida só do clique-para-vencedor.
  if (isWeb && editMode) {
    return (
      // @ts-ignore — RN Web aceita onClick em View
      <View ref={combinedRef} style={sideStyle} onClick={canClickAdvance && athlete ? () => onAdvance(matchId, athlete.entry_id) : undefined}>
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      disabled={!canClickAdvance}
      onPress={canClickAdvance && athlete ? () => onAdvance(matchId, athlete.entry_id) : undefined}
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
  toggleBtnText: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: C.ink2 } as TextStyle,
  toggleBtnTextActive: { color: "#fdf8f2" } as TextStyle,

  // slot states (drag)
  slotDraggable: { cursor: "grab" as any },
  slotHover: { backgroundColor: P.redWash, borderLeftColor: P.red } as ViewStyle,
  slotDragging: { opacity: 0.5 } as ViewStyle,
  scoreTag: { fontFamily: F.mono, fontSize: 11, fontWeight: "700", color: C.ink2, marginLeft: 4, marginRight: 2 } as TextStyle,

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
