// ============================================================
// MODO MESÁRIO — tela operacional do koto (P2 do Hub de Campeonatos)
//
// Vivência de campo (Campeonato Paulista 2026): o mesário — quase sempre
// INEXPERIENTE — acumula 4 processos na mesa do koto:
//   1. chamar/organizar os atletas na ordem do dia;
//   2. anotar vencedores e AVISAR os árbitros quando o formato muda de
//      fase ("a partir da semi é Shobu Ippon") — regras mudam ENTRE
//      DIVISÕES do mesmo evento, impossível decorar o regulamento;
//   3. cronometrar SÓ a luta rolando e avisar o "Atoshi Baraku";
//   4. levar o resultado em papel até a mesa central → mesa de premiação.
//
// Esta tela resolve os 4: lista as categorias do koto NA ORDEM do board
// (1), painel da FASE ATUAL derivado do phase_plan com aviso quando a
// próxima fase muda de formato (2), cronômetro grande com alerta de
// Atoshi Baraku e modo corrido/efetivo (3), e "Fechar resultado" →
// finalize deriva o pódio e alimenta a fila de premiação sem papel (4).
//
// ROTA — decisão documentada: a tela de torneio existente é o ARQUIVO
// torneio/[id].tsx (não uma pasta). Criar torneio/[id]/koto/[areaId].tsx
// exigiria mover [id].tsx para [id]/index.tsx (risco de quebrar deep
// links e o histórico de navegação). Seguimos o precedente já existente
// nesta pasta (chaves.tsx): rota IRMÃ com query params —
//   /karate/competicoes/torneio/koto?id=<competitionId>&area=<areaId>
//
// Mobile-first: o mesário usa tablet/celular em pé, com pressa — coluna
// única, botões grandes, números em mono.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Pressable, Platform, Vibration,
  AccessibilityInfo, Animated, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { Skeleton } from "@/components/karate/Skeleton";
import { toast } from "@/components/Toast";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateCompetitionsApi } from "@/services/karateCompetitionsApi";
import {
  karateCompetitionP1Api, BoardArea, BoardCategory, FORMAT_LABEL, DECISION_LABEL,
  MatchFormat, DecisionMethod, formatEstMinutes,
} from "@/services/karateCompetitionP1Api";
import {
  karateBracketsApi, BracketState, BracketAthleteRef, PhaseByRound, PodiumEntry, KataScore,
} from "@/services/karateBracketsApi";
import { NotasArbitros, NotasBreakdown, NotasSubmit } from "@/components/karate/NotasArbitros";
import { findNextPendingMatch } from "@/components/karate/chaves/EventDayMode";
import { roundLabel } from "@/components/karate/chaves/shared";

// ── Constantes ──────────────────────────────────────────────
const ATOSHI_SEC = 30;          // reta final: aviso "Atoshi Baraku"
const DEFAULT_DURATION_SEC = 90; // sem phase_plan: 1'30 (padrão comum)

const MODALITY_LABEL: Record<string, string> = {
  kata: "Kata", kumite: "Kumite", kihon_ippon: "Kihon-Ippon",
  team_kata: "Kata Equipe", team_kumite: "Kumite Equipe",
  enbu: "Enbu", fukugo: "Fukugo",
};

const isKataModality = (m: string) => m === "kata" || m === "team_kata";

type CatStatus = "pendente" | "andamento" | "decidida" | "finalizada" | "desconhecido";

const STATUS_VIEW: Record<CatStatus, { label: string; color: string; bg: string; icon: string }> = {
  pendente:     { label: "Pendente",       color: P.neutral, bg: P.neutralWash, icon: "clock" },
  andamento:    { label: "Em andamento",   color: P.warn,    bg: P.warnWash,    icon: "play_circle" },
  decidida:     { label: "Fechar resultado", color: P.red2,  bg: P.redWash,     icon: "flag" },
  finalizada:   { label: "Finalizada",     color: P.ok,      bg: P.okWash,      icon: "check" },
  desconhecido: { label: "—",              color: C.ink3,    bg: P.neutralWash, icon: "info" },
};

// ── Helpers ─────────────────────────────────────────────────
function realAthlete(v: BracketAthleteRef | "bye" | null | undefined): BracketAthleteRef | null {
  return v && v !== "bye" ? v : null;
}

function vibrate(pattern: number | number[]) {
  try { Vibration.vibrate(pattern as any); } catch { /* sem vibração disponível */ }
}

function fmtClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** prefers-reduced-motion (web) / isReduceMotionEnabled (nativo). */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    if (Platform.OS === "web" && typeof window !== "undefined" && (window as any).matchMedia) {
      const mq = (window as any).matchMedia("(prefers-reduced-motion: reduce)");
      setReduced(!!mq.matches);
      const onChange = (e: any) => { if (mounted) setReduced(!!e.matches); };
      mq.addEventListener?.("change", onChange);
      return () => { mounted = false; mq.removeEventListener?.("change", onChange); };
    }
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => { if (mounted) setReduced(!!v); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);
  return reduced;
}

// ════════════════════════════════════════════════════════════
// Tela
// ════════════════════════════════════════════════════════════
export default function ModoMesarioScreen() {
  const { id, area } = useLocalSearchParams<{ id: string; area: string }>();
  const cid = String(id || "");
  const areaId = String(area || "");
  const router = useRouter();
  const { federationId } = useKarateFederation();

  const [boardArea, setBoardArea] = useState<BoardArea | null>(null);
  const [competitionName, setCompetitionName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, CatStatus>>({});
  // QA pós-Paulista: o painel é decidido pelo kata_mode do BRACKET, não pela
  // modalidade — kata em hantei_tree (bandeirada, o formato dominante até 13
  // anos) opera como ÁRVORE de lutas. true = notas (score_rounds).
  const [scoreModes, setScoreModes] = useState<Record<string, boolean>>({});
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  const categories = boardArea?.categories ?? [];
  const selectedCat: BoardCategory | null = useMemo(
    () => categories.find((c) => c.id === selectedCatId) || null,
    [categories, selectedCatId]
  );

  // ── Carga do koto: board (ordem do dia) + nome da competição ──
  const load = useCallback(async () => {
    if (!cid || !areaId) { setError("Link incompleto — abra o Modo Mesário a partir da aba Kotos."); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [board, comp] = await Promise.all([
        karateCompetitionP1Api.getScheduleBoard(federationId, cid),
        karateCompetitionsApi.getCompetition(federationId, cid).catch(() => null),
      ]);
      const found = board.areas.find((a) => a.id === areaId) || null;
      if (!found) {
        setError("Este koto não existe mais neste campeonato (pode ter sido removido).");
        setBoardArea(null);
      } else {
        setBoardArea(found);
      }
      if (comp?.name) setCompetitionName(comp.name);
    } catch (e: any) {
      setError(e?.message || "Não foi possível carregar o koto.");
    } finally {
      setLoading(false);
    }
  }, [federationId, cid, areaId]);
  useEffect(() => { load(); }, [load]);

  // ── Estado de cada categoria do koto (paralelo, falha vira "desconhecido") ──
  const loadStatuses = useCallback(async (cats: BoardCategory[]) => {
    if (!cats.length) { setStatuses({}); return; }
    // Fila de premiação: categorias com pódio computado = finalize já rodou.
    let finalizedIds = new Set<string>();
    try {
      const awards = await karateCompetitionP1Api.getAwardsQueue(federationId, cid);
      if (!awards.schema_pending) finalizedIds = new Set(awards.data.map((a) => a.category_id));
    } catch { /* fila indisponível não bloqueia o status básico */ }

    // O BRACKET decide o fluxo: kata_mode === 'score_rounds' → notas; qualquer
    // outra coisa (inclusive kata hantei_tree = bandeirada) → árvore de lutas.
    // Sem chave gerada ainda, cai na heurística da modalidade (só afeta a
    // mensagem de "pendente"; o modo re-resolve quando a chave existir).
    const entries = await Promise.all(cats.map(async (cat): Promise<[string, CatStatus, boolean]> => {
      const fallbackScore = isKataModality(cat.modality);
      try {
        const resp = await karateBracketsApi.getBracket(federationId, cid, cat.id);
        if (!resp || resp.status === "not_generated") {
          return [cat.id, finalizedIds.has(cat.id) ? "finalizada" : "pendente", fallbackScore];
        }
        const b = resp as BracketState;
        const scoreMode = b.kata_mode === "score_rounds";
        if (finalizedIds.has(cat.id)) return [cat.id, "finalizada", scoreMode];
        if (scoreMode) {
          const scores = await karateBracketsApi.getKataScores(federationId, cid, cat.id);
          if (!scores || !scores.length) return [cat.id, "pendente", true];
          const hasFinalNota = scores.some((s) => s.phase === "final" && s.nota != null);
          const hasAnyNota = scores.some((s) => s.nota != null);
          return [cat.id, hasFinalNota ? "decidida" : hasAnyNota ? "andamento" : "pendente", true];
        }
        if (b.status !== "locked") return [cat.id, "pendente", false];
        const next = findNextPendingMatch(b);
        if (next) return [cat.id, "andamento", false];
        return [cat.id, b.champion ? "decidida" : "andamento", false];
      } catch {
        return [cat.id, "desconhecido", fallbackScore];
      }
    }));
    setStatuses(Object.fromEntries(entries.map(([id, st]) => [id, st])));
    setScoreModes(Object.fromEntries(entries.map(([id, , sm]) => [id, sm])));
  }, [federationId, cid]);

  useEffect(() => {
    if (boardArea) loadStatuses(boardArea.categories);
  }, [boardArea, loadStatuses]);

  const markStatus = useCallback((catId: string, st: CatStatus) => {
    setStatuses((prev) => ({ ...prev, [catId]: st }));
  }, []);

  // ── Render ──────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.screen}>
        <View style={s.content}>
          <Skeleton width={140} height={16} />
          <Skeleton width={260} height={30} style={{ marginTop: 8 }} />
          <Skeleton height={72} radius={R.md} style={{ marginTop: 16 }} />
          <Skeleton height={72} radius={R.md} style={{ marginTop: 8 }} />
          <Skeleton height={72} radius={R.md} style={{ marginTop: 8 }} />
        </View>
      </View>
    );
  }
  if (error || !boardArea) {
    return (
      <View style={s.screen}>
        <View style={s.content}>
          <BackRow onPress={() => router.back()} />
          <KarateErrorState message={error || "Koto não encontrado."} onRetry={load} />
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <BackRow onPress={() => router.back()} />

        {/* Cabeçalho do koto */}
        <View style={s.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.eyebrow}>Modo Mesário{competitionName ? ` · ${competitionName}` : ""}</Text>
            <Text style={s.title}>{boardArea.name}</Text>
            <Text style={s.headerMeta}>
              {categories.length} categoria{categories.length === 1 ? "" : "s"} · {boardArea.entry_count} atleta{boardArea.entry_count === 1 ? "" : "s"} · {formatEstMinutes(boardArea.est_minutes)}
            </Text>
          </View>
          <TouchableOpacity
            style={s.refreshBtn}
            onPress={() => { load(); }}
            accessibilityRole="button"
            accessibilityLabel="Atualizar o koto"
          >
            <Icon name="refresh" size={16} color={C.ink2} />
          </TouchableOpacity>
        </View>

        {/* Ordem do dia deste koto */}
        {categories.length === 0 ? (
          <View style={s.emptyBox}>
            <Icon name="layers" size={18} color={C.ink3} />
            <Text style={s.emptyTitle}>Nenhuma categoria alocada neste koto</Text>
            <Text style={s.emptyTxt}>Distribua as categorias na aba Kotos da tela do torneio.</Text>
          </View>
        ) : (
          <View style={s.catList}>
            {categories.map((cat, idx) => {
              const st = statuses[cat.id] ?? "desconhecido";
              const v = STATUS_VIEW[st];
              const active = selectedCatId === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setSelectedCatId(active ? null : cat.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={(state) => [s.catRow, (state as { hovered?: boolean }).hovered && s.catRowHover, active && s.catRowActive]}
                >
                  <Text style={s.catOrder}>{idx + 1}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.catName} numberOfLines={2}>{cat.name}</Text>
                    <Text style={s.catMeta} numberOfLines={1}>
                      {MODALITY_LABEL[cat.modality] || cat.modality}
                      {cat.group_label ? ` · ${cat.group_label}` : ""}
                      {cat.division_name ? ` · ${cat.division_name}` : ""}
                      {` · ${cat.entry_count} atleta${cat.entry_count === 1 ? "" : "s"}`}
                    </Text>
                  </View>
                  <View style={[s.statusChip, { backgroundColor: v.bg }]}>
                    <Icon name={v.icon} size={12} color={v.color} />
                    <Text style={[s.statusChipTxt, { color: v.color }]}>{v.label}</Text>
                  </View>
                  <Icon name={active ? "chevron-up" : "chevron-down"} size={15} color={C.ink4} />
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Painel operacional da categoria aberta — decidido pelo kata_mode
            do bracket (scoreModes), com fallback pela modalidade só enquanto
            a chave não existe. Kata bandeirada (hantei_tree) opera em árvore. */}
        {selectedCat && (
          (scoreModes[selectedCat.id] ?? isKataModality(selectedCat.modality)) ? (
            <KataPanel
              key={selectedCat.id}
              federationId={federationId}
              cid={cid}
              cat={selectedCat}
              onFinalized={() => markStatus(selectedCat.id, "finalizada")}
              onOpenTorneio={() => router.push(`/karate/competicoes/torneio/chaves?id=${cid}&catId=${selectedCat.id}&catName=${encodeURIComponent(selectedCat.name)}&modality=${selectedCat.modality}` as any)}
            />
          ) : (
            <KumitePanel
              key={selectedCat.id}
              federationId={federationId}
              cid={cid}
              cat={selectedCat}
              onStatus={(st) => markStatus(selectedCat.id, st)}
              onOpenTorneio={() => router.push(`/karate/competicoes/torneio/chaves?id=${cid}&catId=${selectedCat.id}&catName=${encodeURIComponent(selectedCat.name)}&modality=${selectedCat.modality}` as any)}
            />
          )
        )}
      </ScrollView>
    </View>
  );
}

function BackRow({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={s.backRow} onPress={onPress} accessibilityRole="button" accessibilityLabel="Voltar">
      <Icon name="chevron-back" size={16} color={C.primary} />
      <Text style={s.backTxt}>Torneio</Text>
    </TouchableOpacity>
  );
}

// ════════════════════════════════════════════════════════════
// Painel Kumite (e demais modalidades em árvore): fase atual +
// próxima luta + cronômetro + fechar resultado.
// ════════════════════════════════════════════════════════════
function KumitePanel({
  federationId, cid, cat, onStatus, onOpenTorneio,
}: {
  federationId: string;
  cid: string;
  cat: BoardCategory;
  onStatus: (st: CatStatus) => void;
  onOpenTorneio: () => void;
}) {
  const [bracket, setBracket] = useState<BracketState | null>(null);
  const [notGenerated, setNotGenerated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [absentPicker, setAbsentPicker] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [podium, setPodium] = useState<PodiumEntry[] | null>(null);

  const loadBracket = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await karateBracketsApi.getBracket(federationId, cid, cat.id);
      if (!resp || resp.status === "not_generated") {
        setBracket(null);
        setNotGenerated(true);
      } else {
        setBracket(resp as BracketState);
        setNotGenerated(false);
      }
    } catch {
      setBracket(null);
      setNotGenerated(false);
    } finally {
      setLoading(false);
    }
  }, [federationId, cid, cat.id]);
  useEffect(() => { loadBracket(); }, [loadBracket]);

  const totalRounds = bracket?.rounds.length ?? 0;
  const next = useMemo(() => (bracket ? findNextPendingMatch(bracket) : null), [bracket]);
  const phases: PhaseByRound[] = bracket?.phases_by_round ?? [];
  const hasPlan = phases.some((p) => p && p.format);

  // Fase corrente: a da rodada da próxima luta (disputa de 3º usa a fase
  // final — mesma semântica do backend).
  const currentPhase: PhaseByRound | null = next
    ? (next.isThird ? phases[totalRounds - 1] ?? null : phases[next.roundIdx] ?? null)
    : null;

  // Aviso forte: a PRÓXIMA fase muda de formato.
  const upcomingChange = useMemo(() => {
    if (!next || next.isThird || !currentPhase?.format) return null;
    const after = phases[next.roundIdx + 1];
    if (after?.format && after.format !== currentPhase.format) {
      return { round: next.roundIdx + 1, phase: after };
    }
    return null;
  }, [next, currentPhase, phases]);

  const akaAthlete = next ? realAthlete(next.match.aka) : null;
  const shiroAthlete = next ? realAthlete(next.match.shiro) : null;

  const advance = useCallback(async (winnerEntryId: string, decision?: { method: DecisionMethod; note?: string }) => {
    if (!next || !bracket || bracket.status !== "locked") return;
    setAdvancing(true);
    try {
      await karateBracketsApi.advanceWinner(federationId, cid, cat.id, {
        match_id: next.match.id,
        winner_entry_id: winnerEntryId,
        decision,
      });
      setAbsentPicker(false);
      await loadBracket();
      onStatus("andamento");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível lançar o resultado.");
      await loadBracket();
    } finally {
      setAdvancing(false);
    }
  }, [next, bracket, federationId, cid, cat.id, loadBracket, onStatus]);

  const handleAbsent = useCallback((absentSide: "aka" | "shiro") => {
    const winner = absentSide === "aka" ? shiroAthlete : akaAthlete;
    if (!winner) return;
    advance(winner.entry_id, { method: "kiken" });
  }, [advance, akaAthlete, shiroAthlete]);

  const handleFinalize = useCallback(async () => {
    setFinalizing(true);
    try {
      const result = await karateBracketsApi.finalizeBracket(federationId, cid, cat.id);
      setPodium(result.podium);
      onStatus("finalizada");
      toast.success("Resultado fechado — categoria enviada à fila de premiação.");
    } catch (e: any) {
      const code = e?.data?.code;
      if (code === "FINAL_PENDENTE") {
        toast.error("A final ainda não foi decidida — lance o resultado da final antes de fechar.");
      } else if (code === "TERCEIRO_PENDENTE") {
        toast.error("A disputa de 3º lugar ainda não foi decidida — lance esse resultado antes de fechar.");
      } else if (code === "BRACKET_NOT_LOCKED" || e?.status === 409) {
        toast.error("A chave precisa estar travada (oficial) para fechar o resultado. Trave a chave na tela do torneio.");
      } else {
        toast.error(e?.message || "Não foi possível fechar o resultado.");
      }
      await loadBracket();
    } finally {
      setFinalizing(false);
    }
  }, [federationId, cid, cat.id, loadBracket, onStatus]);

  if (loading) {
    return (
      <View style={s.panel}>
        <Skeleton width={200} height={18} />
        <Skeleton height={110} radius={R.md} style={{ marginTop: 10 }} />
        <Skeleton height={180} radius={R.md} style={{ marginTop: 10 }} />
      </View>
    );
  }

  // Chave inexistente ou em rascunho: o mesário não gera/trava daqui.
  if (notGenerated || !bracket || bracket.status !== "locked") {
    return (
      <View style={s.panel}>
        <View style={s.noticeBox}>
          <Icon name="lock" size={16} color={C.ink3} />
          <View style={{ flex: 1 }}>
            <Text style={s.noticeTitle}>
              {notGenerated || !bracket ? "Chave ainda não gerada" : "Chave em rascunho (não travada)"}
            </Text>
            <Text style={s.noticeTxt}>
              O Modo Mesário opera sobre a chave oficial (travada). Gere e trave a chave na tela do torneio.
            </Text>
          </View>
        </View>
        <KarateButton label="Abrir a chave na tela do torneio" variant="secondary" size="md" onPress={onOpenTorneio} />
      </View>
    );
  }

  // Pódio recém-fechado: card celebratório sóbrio.
  if (podium) {
    return <PodiumCard catName={cat.name} podium={podium} />;
  }

  return (
    <View style={s.panel}>
      {/* ── Painel da fase atual — o anti-"decorar regulamento" ── */}
      {next && (
        <View style={s.phaseCard}>
          <Text style={s.phaseEyebrow}>
            {next.isThird ? "Disputa de 3º lugar" : roundLabel(next.roundIdx, totalRounds)} · fase atual
          </Text>
          {hasPlan && currentPhase?.format ? (
            <>
              <Text style={s.phaseFormat}>
                {currentPhase.format_label || FORMAT_LABEL[currentPhase.format as MatchFormat] || currentPhase.format}
              </Text>
              <View style={s.phaseMetaRow}>
                {!!currentPhase.decision && (
                  <View style={s.phaseMetaChip}>
                    <Icon name="flag" size={12} color={C.ink2} />
                    <Text style={s.phaseMetaTxt}>
                      Decisão: {DECISION_LABEL[currentPhase.decision as DecisionMethod] || currentPhase.decision}
                    </Text>
                  </View>
                )}
                {!!bracket.phase_plan?.required_kata && (
                  <View style={s.phaseMetaChip}>
                    <Icon name="layers" size={12} color={C.ink2} />
                    <Text style={s.phaseMetaTxt}>Kata: {bracket.phase_plan.required_kata}</Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <View style={s.planMissing}>
              <Icon name="info" size={14} color={C.ink3} />
              <Text style={s.planMissingTxt}>
                Formato não configurado para esta categoria — confira o regulamento com o árbitro central (o plano de fases pode ser definido na tela do torneio).
              </Text>
            </View>
          )}

          {upcomingChange && (
            <View style={s.changeAlert}>
              <Icon name="alert" size={16} color={P.red2} />
              <Text style={s.changeAlertTxt}>
                Atenção — na {roundLabel(upcomingChange.round, totalRounds).toLowerCase()} muda para{" "}
                <Text style={{ fontWeight: "700" }}>
                  {upcomingChange.phase.format_label || FORMAT_LABEL[upcomingChange.phase.format as MatchFormat] || upcomingChange.phase.format}
                </Text>
                . Avise os árbitros antes da fase começar.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Próxima luta ── */}
      {next && akaAthlete && shiroAthlete ? (
        <View style={s.fightCard}>
          <Text style={s.fightEyebrow}>Próxima luta</Text>

          <View style={s.sideBlock}>
            <SideHeader label="AKA" tone="aka" name={akaAthlete.student_name} dojo={akaAthlete.dojo_name} />
            <SideHeader label="SHIRO" tone="shiro" name={shiroAthlete.student_name} dojo={shiroAthlete.dojo_name} />
          </View>

          <View style={s.winnerBtns}>
            <TouchableOpacity
              style={[s.winBtn, s.winBtnAka, advancing && s.btnDisabled]}
              disabled={advancing}
              onPress={() => advance(akaAthlete.entry_id)}
              accessibilityRole="button"
              accessibilityLabel={`Vencedor AKA: ${akaAthlete.student_name || "atleta"}`}
            >
              <Text style={s.winBtnTxtAka}>Vencedor AKA</Text>
              <Text style={s.winBtnSubAka} numberOfLines={1}>{akaAthlete.student_name || "—"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.winBtn, s.winBtnShiro, advancing && s.btnDisabled]}
              disabled={advancing}
              onPress={() => advance(shiroAthlete.entry_id)}
              accessibilityRole="button"
              accessibilityLabel={`Vencedor SHIRO: ${shiroAthlete.student_name || "atleta"}`}
            >
              <Text style={s.winBtnTxtShiro}>Vencedor SHIRO</Text>
              <Text style={s.winBtnSubShiro} numberOfLines={1}>{shiroAthlete.student_name || "—"}</Text>
            </TouchableOpacity>
          </View>

          {!absentPicker ? (
            <TouchableOpacity
              style={[s.absentBtn, advancing && s.btnDisabled]}
              disabled={advancing}
              onPress={() => setAbsentPicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Registrar ausência (W.O.)"
            >
              <Icon name="users" size={15} color={C.ink2} />
              <Text style={s.absentBtnTxt}>Ausente (W.O. / Kiken)</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.absentPicker}>
              <Text style={s.absentTitle}>Quem faltou? O atleta presente vence por Kiken.</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={[s.absentChoice, advancing && s.btnDisabled]}
                  disabled={advancing}
                  onPress={() => handleAbsent("aka")}
                  accessibilityRole="button"
                >
                  <Text style={s.absentChoiceTxt} numberOfLines={1}>Faltou {akaAthlete.student_name || "AKA"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.absentChoice, advancing && s.btnDisabled]}
                  disabled={advancing}
                  onPress={() => handleAbsent("shiro")}
                  accessibilityRole="button"
                >
                  <Text style={s.absentChoiceTxt} numberOfLines={1}>Faltou {shiroAthlete.student_name || "SHIRO"}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setAbsentPicker(false)} accessibilityRole="button">
                <Text style={s.absentCancel}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}

          {advancing && <Text style={s.advancingTxt}>Lançando resultado…</Text>}

          {/* ── Cronômetro da luta ── */}
          <PhaseTimer
            matchKey={next.match.id}
            durationSec={currentPhase?.duration_sec ?? DEFAULT_DURATION_SEC}
            timeMode={currentPhase?.time_mode ?? null}
          />
        </View>
      ) : next ? (
        // Pendência sem os dois lados prontos (aguardando resultado anterior).
        <View style={s.noticeBox}>
          <Icon name="clock" size={16} color={C.ink3} />
          <Text style={[s.noticeTxt, { flex: 1 }]}>Aguardando os vencedores das lutas anteriores para montar o próximo confronto.</Text>
        </View>
      ) : (
        // ── Sem pendências: fechar o resultado ──
        <View style={s.finalizeCard}>
          <View style={s.finalizeHead}>
            <Icon name="trophy" size={20} color={P.red2} />
            <Text style={s.finalizeTitle}>Todas as lutas decididas</Text>
          </View>
          <Text style={s.finalizeTxt}>
            Feche o resultado para computar o pódio (1º/2º/3º) e enviar a categoria direto à fila de premiação — sem papel até a mesa central.
          </Text>
          <KarateButton
            label={finalizing ? "Fechando..." : "Fechar resultado"}
            variant="sumi"
            size="lg"
            loading={finalizing}
            disabled={finalizing}
            onPress={handleFinalize}
          />
        </View>
      )}
    </View>
  );
}

function SideHeader({ label, tone, name, dojo }: {
  label: string; tone: "aka" | "shiro"; name: string | null; dojo: string | null;
}) {
  const aka = tone === "aka";
  return (
    <View style={[s.sideHead, aka ? s.sideHeadAka : s.sideHeadShiro]}>
      <Text style={[s.sideTag, aka ? s.sideTagAka : s.sideTagShiro]}>{label}</Text>
      <Text style={s.sideName} numberOfLines={2}>{name || "—"}</Text>
      {!!dojo && <Text style={s.sideDojo} numberOfLines={1}>{dojo}</Text>}
    </View>
  );
}

// ════════════════════════════════════════════════════════════
// Cronômetro da fase — client-side, start/pause/reset grandes,
// Atoshi Baraku aos 30s restantes (visual + vibração leve) e no zero.
// ════════════════════════════════════════════════════════════
function PhaseTimer({ matchKey, durationSec, timeMode }: {
  matchKey: string;
  durationSec: number;
  timeMode: "corrido" | "efetivo" | null;
}) {
  const duration = Number.isFinite(durationSec) && durationSec > 0 ? Math.round(durationSec) : DEFAULT_DURATION_SEC;
  const [remaining, setRemaining] = useState(duration);
  const [running, setRunning] = useState(false);
  const endAtRef = useRef<number | null>(null);
  const atoshiFired = useRef(false);
  const zeroFired = useRef(false);
  const reducedMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(1)).current;

  // Nova luta ou nova duração: zera tudo.
  useEffect(() => {
    setRunning(false);
    endAtRef.current = null;
    setRemaining(duration);
    atoshiFired.current = false;
    zeroFired.current = false;
  }, [matchKey, duration]);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil(((endAtRef.current ?? 0) - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) setRunning(false);
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [running]);

  // Alertas: Atoshi Baraku (reta final) e tempo encerrado.
  const inAtoshi = remaining <= ATOSHI_SEC && remaining > 0;
  const isZero = remaining === 0;
  useEffect(() => {
    if (running && inAtoshi && !atoshiFired.current) {
      atoshiFired.current = true;
      vibrate(200);
    }
    if (isZero && endAtRef.current != null && !zeroFired.current) {
      zeroFired.current = true;
      vibrate([0, 300, 150, 300]);
    }
  }, [running, inAtoshi, isZero]);

  // Pulso visual da reta final — desligado com prefers-reduced-motion.
  useEffect(() => {
    if (reducedMotion || !(running && inAtoshi)) { pulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.55, duration: 500, useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reducedMotion, running, inAtoshi, pulse]);

  const start = () => {
    if (remaining <= 0) return;
    endAtRef.current = Date.now() + remaining * 1000;
    setRunning(true);
  };
  const pauseTimer = () => setRunning(false);
  const reset = () => {
    setRunning(false);
    endAtRef.current = null;
    setRemaining(duration);
    atoshiFired.current = false;
    zeroFired.current = false;
  };

  return (
    <View style={[s.timerBox, inAtoshi && s.timerBoxAtoshi, isZero && endAtRef.current != null && s.timerBoxZero]}>
      <View style={s.timerHeadRow}>
        <Text style={s.timerLabel}>Cronômetro · {fmtClock(duration)} de luta</Text>
        {timeMode === "corrido" && (
          <View style={s.timeModeChip}>
            <Icon name="clock" size={11} color={C.ink2} />
            <Text style={s.timeModeTxt}>Tempo corrido — deixe rodando</Text>
          </View>
        )}
        {timeMode === "efetivo" && (
          <View style={s.timeModeChip}>
            <Icon name="clock" size={11} color={C.ink2} />
            <Text style={s.timeModeTxt}>Tempo efetivo — pause a cada YAME</Text>
          </View>
        )}
      </View>

      <Text style={[s.timerClock, inAtoshi && s.timerClockAtoshi, isZero && endAtRef.current != null && s.timerClockZero]}>
        {fmtClock(remaining)}
      </Text>

      {inAtoshi && (
        <Animated.View style={[s.atoshiBadge, { opacity: pulse }]}>
          <Icon name="alert" size={15} color={P.paperWarm} />
          <Text style={s.atoshiTxt}>ATOSHI BARAKU — avise o árbitro central</Text>
        </Animated.View>
      )}
      {isZero && endAtRef.current != null && (
        <View style={s.zeroBadge}>
          <Icon name="alert" size={15} color={P.paperWarm} />
          <Text style={s.atoshiTxt}>TEMPO ENCERRADO</Text>
        </View>
      )}

      <View style={s.timerBtns}>
        {!running ? (
          <TouchableOpacity style={[s.timerBtn, s.timerBtnStart]} onPress={start} accessibilityRole="button" accessibilityLabel="Iniciar cronômetro">
            <Icon name="play_circle" size={18} color={P.paperWarm} />
            <Text style={s.timerBtnTxtLight}>{remaining < duration && remaining > 0 ? "Retomar" : "Iniciar"}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.timerBtn, s.timerBtnPause]} onPress={pauseTimer} accessibilityRole="button" accessibilityLabel="Pausar cronômetro">
            <Icon name="clock" size={18} color={C.ink} />
            <Text style={s.timerBtnTxtDark}>Pausar</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[s.timerBtn, s.timerBtnReset]} onPress={reset} accessibilityRole="button" accessibilityLabel="Zerar cronômetro">
          <Icon name="refresh" size={17} color={C.ink2} />
          <Text style={s.timerBtnTxtDark}>Zerar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════
// Painel Kata (por notas): ordem da bateria + lançamento das notas
// dos árbitros (Onda B — 5 notas, o TOTAL é do backend). O atalho
// para a tela do torneio segue disponível para sorteio/impressão.
// O finalize funciona igual após as notas da final.
// ════════════════════════════════════════════════════════════
function KataPanel({
  federationId, cid, cat, onFinalized, onOpenTorneio,
}: {
  federationId: string;
  cid: string;
  cat: BoardCategory;
  onFinalized: () => void;
  onOpenTorneio: () => void;
}) {
  const [scores, setScores] = useState<KataScore[] | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [podium, setPodium] = useState<PodiumEntry[] | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null); // `${entry_id}:${phase}`
  const [savingNota, setSavingNota] = useState(false);

  const loadScores = useCallback(async () => {
    try {
      const rows = await karateBracketsApi.getKataScores(federationId, cid, cat.id);
      setScores(rows || []);
    } catch {
      setScores([]);
    }
  }, [federationId, cid, cat.id]);

  useEffect(() => { loadScores(); }, [loadScores]);

  // Onda B: uma nota por árbitro. O TOTAL é computado pelo BACKEND —
  // aqui só recarregamos a bateria depois do PUT.
  const handleSaveNota = useCallback(async (row: KataScore, payload: NotasSubmit) => {
    setSavingNota(true);
    try {
      await karateBracketsApi.putKataScore(federationId, cid, cat.id, {
        entry_id: row.entry_id, phase: row.phase, ...payload,
      });
      setEditingKey(null);
      await loadScores();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar a nota.");
    } finally {
      setSavingNota(false);
    }
  }, [federationId, cid, cat.id, loadScores]);

  const handleFinalize = useCallback(async () => {
    setFinalizing(true);
    try {
      const result = await karateBracketsApi.finalizeBracket(federationId, cid, cat.id);
      setPodium(result.podium);
      onFinalized();
      toast.success("Resultado fechado — categoria enviada à fila de premiação.");
    } catch (e: any) {
      const code = e?.data?.code;
      if (code === "FINAL_PENDENTE") {
        toast.error("Nenhuma nota lançada na fase final ainda — lance as notas da final antes de fechar.");
      } else if (code === "BRACKET_NOT_LOCKED" || e?.status === 409) {
        toast.error("A apuração precisa estar travada (oficial) para fechar o resultado. Trave na tela do torneio.");
      } else {
        toast.error(e?.message || "Não foi possível fechar o resultado.");
      }
    } finally {
      setFinalizing(false);
    }
  }, [federationId, cid, cat.id, onFinalized]);

  if (podium) return <PodiumCard catName={cat.name} podium={podium} />;

  if (scores === null) {
    return (
      <View style={s.panel}>
        <Skeleton width={200} height={18} />
        <Skeleton height={140} radius={R.md} style={{ marginTop: 10 }} />
      </View>
    );
  }

  const eliminatoria = scores
    .filter((r) => r.phase === "eliminatoria")
    .sort((a, b) => (a.presentation_order ?? 999) - (b.presentation_order ?? 999));
  const final = scores
    .filter((r) => r.phase === "final")
    .sort((a, b) => (a.presentation_order ?? 999) - (b.presentation_order ?? 999));
  const hasFinalNota = final.some((r) => r.nota != null);

  return (
    <View style={s.panel}>
      <View style={s.noticeBox}>
        <Icon name="info" size={15} color={C.ink3} />
        <Text style={[s.noticeTxt, { flex: 1 }]}>
          Kata por notas: toque no atleta para lançar as cinco notas dos árbitros. O total (soma cortando a maior e a menor) é computado pelo sistema. O sorteio da ordem e a impressão ficam na tela do torneio.
        </Text>
      </View>

      {scores.length === 0 ? (
        <View style={s.emptyBox}>
          <Icon name="layers" size={16} color={C.ink3} />
          <Text style={s.emptyTitle}>Ordem de apresentação ainda não gerada</Text>
          <Text style={s.emptyTxt}>Gere a ordem na tela do torneio para começar a bateria.</Text>
        </View>
      ) : (
        <>
          <KataPhaseList
            title={`Eliminatória · ${eliminatoria.length}`}
            rows={eliminatoria}
            editingKey={editingKey}
            saving={savingNota}
            onToggle={setEditingKey}
            onSave={handleSaveNota}
          />
          {final.length > 0 && (
            <KataPhaseList
              title={`Final · ${final.length}`}
              rows={final}
              editingKey={editingKey}
              saving={savingNota}
              onToggle={setEditingKey}
              onSave={handleSaveNota}
            />
          )}
        </>
      )}

      <KarateButton label="Abrir a bateria na tela do torneio" variant="secondary" size="md" onPress={onOpenTorneio} />

      {hasFinalNota && (
        <View style={s.finalizeCard}>
          <View style={s.finalizeHead}>
            <Icon name="trophy" size={20} color={P.red2} />
            <Text style={s.finalizeTitle}>Notas da final lançadas</Text>
          </View>
          <Text style={s.finalizeTxt}>
            Feche o resultado para computar o pódio pela nota da final e enviar a categoria à fila de premiação.
          </Text>
          <KarateButton
            label={finalizing ? "Fechando..." : "Fechar resultado"}
            variant="sumi"
            size="lg"
            loading={finalizing}
            disabled={finalizing}
            onPress={handleFinalize}
          />
        </View>
      )}
    </View>
  );
}

function KataPhaseList({
  title, rows, editingKey, saving, onToggle, onSave,
}: {
  title: string;
  rows: KataScore[];
  editingKey: string | null;
  saving: boolean;
  onToggle: (key: string | null) => void;
  onSave: (row: KataScore, payload: NotasSubmit) => void | Promise<void>;
}) {
  return (
    <View style={s.kataList}>
      <Text style={s.kataListTitle}>{title}</Text>
      {rows.map((r) => {
        const key = `${r.entry_id}:${r.phase}`;
        const editing = editingKey === key;
        return (
          <View key={key}>
            <Pressable
              onPress={() => onToggle(editing ? null : key)}
              accessibilityRole="button"
              accessibilityLabel={`Lançar notas de ${r.student_name}`}
              accessibilityState={{ expanded: editing }}
              style={(state) => [
                s.kataRow,
                s.kataRowTouch,
                (state as { hovered?: boolean }).hovered && s.kataRowHover,
                editing && s.kataRowEditing,
              ]}
            >
              <Text style={s.kataOrder}>{r.presentation_order ?? "—"}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.kataName} numberOfLines={1}>{r.student_name}</Text>
                {!!r.dojo_name && <Text style={s.kataDojo} numberOfLines={1}>{r.dojo_name}</Text>}
              </View>
              {r.advances === true && (
                <View style={s.kataAdvChip}>
                  <Icon name="check" size={11} color={P.ok} />
                  <Text style={s.kataAdvTxt}>Classificou</Text>
                </View>
              )}
              <NotasBreakdown nota={r.nota} notas={r.notas} style={s.kataNotaBox} />
              <Icon name="edit" size={14} color={editing ? P.red2 : C.ink4} />
            </Pressable>

            {editing && (
              <View style={s.kataEditorWrap}>
                <NotasArbitros
                  athleteName={r.student_name}
                  phaseLabel={r.phase === "eliminatoria" ? "Eliminatória" : "Final"}
                  initialNotas={r.notas}
                  initialNota={r.nota}
                  saving={saving}
                  onSubmit={(payload) => onSave(r, payload)}
                  onCancel={() => onToggle(null)}
                />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ════════════════════════════════════════════════════════════
// Card do pódio (após o finalize) — celebratório, sóbrio.
// ════════════════════════════════════════════════════════════
function PodiumCard({ catName, podium }: { catName: string; podium: PodiumEntry[] }) {
  return (
    <View style={s.podiumCard}>
      <View style={s.podiumSeal}>
        <Icon name="trophy" size={22} color={P.paperWarm} />
      </View>
      <Text style={s.podiumTitle}>Pódio fechado</Text>
      <Text style={s.podiumSub}>{catName}</Text>
      <View style={{ gap: 8, alignSelf: "stretch", marginTop: 12 }}>
        {podium.map((p) => (
          <View key={p.entry_id} style={s.podiumRow}>
            <View style={[s.placeTile, p.placement === 1 && s.placeTileGold]}>
              <Text style={[s.placeTxt, p.placement === 1 && s.placeTxtGold]}>{p.placement}º</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.podiumName} numberOfLines={1}>{p.name || "—"}</Text>
              {!!p.dojo && <Text style={s.podiumDojo} numberOfLines={1}>{p.dojo}</Text>}
            </View>
            {p.points_awarded > 0 && <Text style={s.podiumPts}>{p.points_awarded} pts</Text>}
          </View>
        ))}
      </View>
      <View style={s.podiumMsg}>
        <Icon name="ribbon" size={14} color={P.ok} />
        <Text style={s.podiumMsgTxt}>Categoria enviada à fila de premiação.</Text>
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════
// Styles — kit Shoji (papel opaco, sumi, vermelhão raro, Mincho leve)
// ════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg } as ViewStyle,
  content: { padding: 16, paddingBottom: 64, width: "100%", maxWidth: 720, alignSelf: "center", gap: 14 } as ViewStyle,
  backRow: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start" } as ViewStyle,
  backTxt: { fontFamily: F.body, fontSize: 13, fontWeight: "700", color: C.primary } as TextStyle,

  header: { flexDirection: "row", alignItems: "flex-start", gap: 10 } as ViewStyle,
  eyebrow: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 1.1, textTransform: "uppercase", color: C.ink3 } as TextStyle,
  title: { fontFamily: F.heading, fontSize: 27, fontWeight: "400", color: C.ink, marginTop: 2 } as TextStyle,
  headerMeta: { fontFamily: F.body, fontSize: 12.5, color: C.ink3, marginTop: 3 } as TextStyle,
  refreshBtn: { width: 40, height: 40, borderRadius: R.sm, borderWidth: 1, borderColor: C.border2, backgroundColor: C.glassHi, alignItems: "center", justifyContent: "center" } as ViewStyle,

  emptyBox: { alignItems: "center", gap: 6, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border, borderRadius: R.md, paddingVertical: 26, paddingHorizontal: 18 } as ViewStyle,
  emptyTitle: { fontFamily: F.heading, fontSize: 15, fontWeight: "600", color: C.ink } as TextStyle,
  emptyTxt: { fontFamily: F.body, fontSize: 12.5, color: C.ink3, textAlign: "center", lineHeight: 18, maxWidth: 400 } as TextStyle,

  catList: { gap: 6 } as ViewStyle,
  catRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: R.md, paddingVertical: 12, paddingHorizontal: 12, minHeight: 60 } as ViewStyle,
  catRowHover: { borderColor: C.border2 } as ViewStyle,
  catRowActive: { borderColor: P.redLine, backgroundColor: P.redWash } as ViewStyle,
  catOrder: { fontFamily: F.mono, fontSize: 14, color: C.ink3, width: 24, textAlign: "center" } as TextStyle,
  catName: { fontFamily: F.body, fontSize: 14, fontWeight: "600", color: C.ink, lineHeight: 19 } as TextStyle,
  catMeta: { fontFamily: F.body, fontSize: 11.5, color: C.ink3, marginTop: 2 } as TextStyle,
  statusChip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 } as ViewStyle,
  statusChipTxt: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700" } as TextStyle,

  panel: { gap: 12 } as ViewStyle,
  noticeBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 13 } as ViewStyle,
  noticeTitle: { fontFamily: F.body, fontSize: 13.5, fontWeight: "700", color: C.ink } as TextStyle,
  noticeTxt: { fontFamily: F.body, fontSize: 12.5, color: C.ink2, lineHeight: 18, marginTop: 2 } as TextStyle,

  // Painel da fase
  phaseCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border2, borderRadius: R.lg, padding: 16, gap: 8 } as ViewStyle,
  phaseEyebrow: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: C.ink3 } as TextStyle,
  phaseFormat: { fontFamily: F.heading, fontSize: 23, fontWeight: "600", color: C.ink } as TextStyle,
  phaseMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 } as ViewStyle,
  phaseMetaChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 } as ViewStyle,
  phaseMetaTxt: { fontFamily: F.body, fontSize: 11.5, color: C.ink2 } as TextStyle,
  planMissing: { flexDirection: "row", alignItems: "flex-start", gap: 8 } as ViewStyle,
  planMissingTxt: { flex: 1, fontFamily: F.body, fontSize: 12.5, color: C.ink2, lineHeight: 18 } as TextStyle,
  changeAlert: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: P.redWash, borderWidth: 1, borderColor: P.redLine, borderRadius: R.md, padding: 11, marginTop: 2 } as ViewStyle,
  changeAlertTxt: { flex: 1, fontFamily: F.body, fontSize: 13, color: P.red3, lineHeight: 19 } as TextStyle,

  // Próxima luta
  fightCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border2, borderRadius: R.lg, padding: 16, gap: 12 } as ViewStyle,
  fightEyebrow: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: C.ink3 } as TextStyle,
  sideBlock: { gap: 8 } as ViewStyle,
  sideHead: { borderRadius: R.md, borderWidth: 1, padding: 12, gap: 2 } as ViewStyle,
  sideHeadAka: { backgroundColor: P.redWash, borderColor: P.redLine } as ViewStyle,
  sideHeadShiro: { backgroundColor: P.glassHi, borderColor: C.border2 } as ViewStyle,
  sideTag: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", letterSpacing: 1.4 } as TextStyle,
  sideTagAka: { color: P.red2 } as TextStyle,
  sideTagShiro: { color: C.ink2 } as TextStyle,
  sideName: { fontFamily: F.heading, fontSize: 18, fontWeight: "600", color: C.ink, lineHeight: 24 } as TextStyle,
  sideDojo: { fontFamily: F.body, fontSize: 11.5, color: C.ink3 } as TextStyle,

  winnerBtns: { flexDirection: "row", gap: 8 } as ViewStyle,
  winBtn: { flex: 1, minHeight: 72, borderRadius: R.md, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, paddingVertical: 12, gap: 2 } as ViewStyle,
  winBtnAka: { backgroundColor: P.red, borderColor: P.red3 } as ViewStyle,
  winBtnShiro: { backgroundColor: P.glassHi, borderColor: C.ink } as ViewStyle,
  winBtnTxtAka: { fontFamily: F.body, fontSize: 15, fontWeight: "700", color: P.paperWarm } as TextStyle,
  winBtnSubAka: { fontFamily: F.body, fontSize: 11, color: "rgba(246,241,231,0.85)" } as TextStyle,
  winBtnTxtShiro: { fontFamily: F.body, fontSize: 15, fontWeight: "700", color: C.ink } as TextStyle,
  winBtnSubShiro: { fontFamily: F.body, fontSize: 11, color: C.ink3 } as TextStyle,
  btnDisabled: { opacity: 0.5 } as ViewStyle,

  absentBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 48, borderRadius: R.md, borderWidth: 1, borderColor: C.border2, backgroundColor: C.glassHi } as ViewStyle,
  absentBtnTxt: { fontFamily: F.body, fontSize: 13.5, fontWeight: "700", color: C.ink2 } as TextStyle,
  absentPicker: { gap: 8, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border2, borderRadius: R.md, padding: 12 } as ViewStyle,
  absentTitle: { fontFamily: F.body, fontSize: 12.5, color: C.ink2 } as TextStyle,
  absentChoice: { flex: 1, minHeight: 52, borderRadius: R.sm, borderWidth: 1, borderColor: C.border2, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 } as ViewStyle,
  absentChoiceTxt: { fontFamily: F.body, fontSize: 12.5, fontWeight: "700", color: C.ink } as TextStyle,
  absentCancel: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: C.ink3, textAlign: "center", paddingVertical: 4 } as TextStyle,
  advancingTxt: { fontFamily: F.body, fontSize: 12, color: C.ink3, textAlign: "center" } as TextStyle,

  // Cronômetro
  timerBox: { borderRadius: R.lg, borderWidth: 1, borderColor: C.border2, backgroundColor: C.glassHi, padding: 16, gap: 10, alignItems: "center" } as ViewStyle,
  timerBoxAtoshi: { borderColor: P.redLine, backgroundColor: P.redWash } as ViewStyle,
  timerBoxZero: { borderColor: P.red3, backgroundColor: P.redWash } as ViewStyle,
  timerHeadRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: "stretch" } as ViewStyle,
  timerLabel: { fontFamily: F.body, fontSize: 11.5, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: C.ink3 } as TextStyle,
  timeModeChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 } as ViewStyle,
  timeModeTxt: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", color: C.ink2 } as TextStyle,
  timerClock: { fontFamily: F.mono, fontSize: 64, color: C.ink, fontVariant: ["tabular-nums"] } as TextStyle,
  timerClockAtoshi: { color: P.red2 } as TextStyle,
  timerClockZero: { color: P.red3 } as TextStyle,
  atoshiBadge: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: P.red2, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 } as ViewStyle,
  zeroBadge: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: P.red3, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 } as ViewStyle,
  atoshiTxt: { fontFamily: F.body, fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: P.paperWarm } as TextStyle,
  timerBtns: { flexDirection: "row", gap: 8, alignSelf: "stretch" } as ViewStyle,
  timerBtn: { flex: 1, minHeight: 56, borderRadius: R.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1 } as ViewStyle,
  timerBtnStart: { backgroundColor: C.sumi, borderColor: C.sumi } as ViewStyle,
  timerBtnPause: { backgroundColor: C.surface, borderColor: C.ink } as ViewStyle,
  timerBtnReset: { backgroundColor: C.glassHi, borderColor: C.border2 } as ViewStyle,
  timerBtnTxtLight: { fontFamily: F.body, fontSize: 15, fontWeight: "700", color: P.paperWarm } as TextStyle,
  timerBtnTxtDark: { fontFamily: F.body, fontSize: 15, fontWeight: "700", color: C.ink } as TextStyle,

  // Fechar resultado
  finalizeCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: P.redLine, borderRadius: R.lg, padding: 16, gap: 10 } as ViewStyle,
  finalizeHead: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  finalizeTitle: { fontFamily: F.heading, fontSize: 19, fontWeight: "600", color: C.ink } as TextStyle,
  finalizeTxt: { fontFamily: F.body, fontSize: 13, color: C.ink2, lineHeight: 19 } as TextStyle,

  // Pódio
  podiumCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: P.redLine, borderRadius: R.lg, padding: 20, alignItems: "center", gap: 4 } as ViewStyle,
  podiumSeal: { width: 48, height: 48, borderRadius: 999, backgroundColor: P.red, alignItems: "center", justifyContent: "center", marginBottom: 6 } as ViewStyle,
  podiumTitle: { fontFamily: F.heading, fontSize: 23, fontWeight: "400", color: C.ink } as TextStyle,
  podiumSub: { fontFamily: F.body, fontSize: 12.5, color: C.ink3, textAlign: "center" } as TextStyle,
  podiumRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 10 } as ViewStyle,
  placeTile: { width: 38, height: 32, borderRadius: R.sm, borderWidth: 1, borderColor: C.border2, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" } as ViewStyle,
  placeTileGold: { backgroundColor: P.redWash, borderColor: P.redLine } as ViewStyle,
  placeTxt: { fontFamily: F.mono, fontSize: 14, color: C.ink2 } as TextStyle,
  placeTxtGold: { color: P.red2 } as TextStyle,
  podiumName: { fontFamily: F.body, fontSize: 14, fontWeight: "600", color: C.ink } as TextStyle,
  podiumDojo: { fontFamily: F.body, fontSize: 11.5, color: C.ink3 } as TextStyle,
  podiumPts: { fontFamily: F.mono, fontSize: 12.5, color: C.ink3 } as TextStyle,
  podiumMsg: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: P.okWash, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 10 } as ViewStyle,
  podiumMsgTxt: { fontFamily: F.body, fontSize: 12.5, fontWeight: "700", color: P.ok } as TextStyle,

  // Kata
  kataList: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 12, gap: 8 } as ViewStyle,
  kataListTitle: { fontFamily: F.body, fontSize: 11.5, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: C.ink3 } as TextStyle,
  kataRow: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  // Onda B: a linha virou alvo de toque (abre o lançamento das 5 notas).
  kataRowTouch: { borderRadius: R.sm, paddingVertical: 8, paddingHorizontal: 6, minHeight: 52, borderWidth: 1, borderColor: "transparent" } as ViewStyle,
  kataRowHover: { backgroundColor: C.glassHi } as ViewStyle,
  kataRowEditing: { backgroundColor: P.redWash, borderColor: P.redLine } as ViewStyle,
  kataNotaBox: { minWidth: 60 } as ViewStyle,
  kataEditorWrap: { marginTop: 4, marginBottom: 4 } as ViewStyle,
  kataOrder: { fontFamily: F.mono, fontSize: 13, color: C.ink3, width: 24, textAlign: "center" } as TextStyle,
  kataName: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: C.ink } as TextStyle,
  kataDojo: { fontFamily: F.body, fontSize: 11, color: C.ink3 } as TextStyle,
  kataAdvChip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: P.okWash, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 } as ViewStyle,
  kataAdvTxt: { fontFamily: F.body, fontSize: 10, fontWeight: "700", color: P.ok } as TextStyle,
});
