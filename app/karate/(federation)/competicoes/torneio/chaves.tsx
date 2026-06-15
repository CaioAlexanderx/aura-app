// ============================================================
// Competições — Chaves (Track M)
//
// Tela de chaveamento por categoria:
//   Kata  : apuração por bateria (eliminatória + final, ranked by nota)
//   Kumite: bracket eliminatório single-elimination
//
// Acesso: /karate/(federation)/competicoes/torneio/chaves?id=<cid>
// Parâmetros: id (competition id), catId (category id), catName, modality
// [MOCK] fallback quando federation ainda é placeholder.
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
  TextStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { useKarateFederation } from "@/contexts/KarateFederation";
import {
  karateBracketsApi,
  BracketState,
  BracketMatch,
  BracketAthleteRef,
  KataScore,
  DrawMethod,
} from "@/services/karateBracketsApi";
import { karateCompetitionsApi } from "@/services/karateCompetitionsApi";

// ── Mock data ─────────────────────────────────────────────────────────
const MOCK_ATHLETES = [
  { entry_id: "e1", student_name: "Pedro Yamamoto", dojo_name: "Ren Bu Kan" },
  { entry_id: "e2", student_name: "Rafael Lima", dojo_name: "Vila Mariana" },
  { entry_id: "e3", student_name: "Caio Brandão", dojo_name: "Shotokan Centro" },
  { entry_id: "e4", student_name: "Tiago Abe", dojo_name: "Shotokan Centro" },
  { entry_id: "e5", student_name: "Lucas Mori", dojo_name: "Santo André" },
  { entry_id: "e6", student_name: "Bruno Tan", dojo_name: "Vila Mariana" },
];

const MOCK_BRACKET: BracketState = {
  bracket_id: "mock-bracket",
  status: "locked",
  modality: "kumite",
  seed: "42",
  options: { method: "ranking", separateSameDojo: true, thirdPlace: true },
  athletes_count: 6,
  bye_count: 2,
  rounds: [
    [
      { id: "r0-0", round: 0, slot: 0, aka: MOCK_ATHLETES[0], shiro: MOCK_ATHLETES[1], winner_entry_id: null, is_bye: false },
      { id: "r0-1", round: 0, slot: 1, aka: MOCK_ATHLETES[2], shiro: MOCK_ATHLETES[3], winner_entry_id: null, is_bye: false },
      { id: "r0-2", round: 0, slot: 2, aka: MOCK_ATHLETES[4], shiro: "bye", winner_entry_id: MOCK_ATHLETES[4].entry_id, is_bye: true },
      { id: "r0-3", round: 0, slot: 3, aka: MOCK_ATHLETES[5], shiro: "bye", winner_entry_id: MOCK_ATHLETES[5].entry_id, is_bye: true },
    ],
    [
      { id: "r1-0", round: 1, slot: 0, aka: null, shiro: MOCK_ATHLETES[4], winner_entry_id: null, is_bye: false },
      { id: "r1-1", round: 1, slot: 1, aka: null, shiro: MOCK_ATHLETES[5], winner_entry_id: null, is_bye: false },
    ],
    [
      { id: "r2-0", round: 2, slot: 0, aka: null, shiro: null, winner_entry_id: null, is_bye: false },
    ],
  ],
  third_place_match: { id: "third", round: 3, slot: 0, aka: null, shiro: null, winner_entry_id: null, is_bye: false },
  champion: null,
};

const MOCK_KATA_SCORES: KataScore[] = [
  { entry_id: "k1", student_name: "Ana Onishi", dojo_name: "Shotokan Centro", phase: "eliminatoria", nota: 26.2, presentation_order: 1, advances: true },
  { entry_id: "k2", student_name: "Marina Souza", dojo_name: "Santo André", phase: "eliminatoria", nota: 25.8, presentation_order: 2, advances: true },
  { entry_id: "k3", student_name: "Helena Dias", dojo_name: "Santo André", phase: "eliminatoria", nota: 25.6, presentation_order: 3, advances: true },
  { entry_id: "k4", student_name: "Júlia Costa", dojo_name: "Shotokan Centro", phase: "eliminatoria", nota: 25.4, presentation_order: 4, advances: true },
  { entry_id: "k5", student_name: "Fernanda Oka", dojo_name: "Vila Mariana", phase: "eliminatoria", nota: 25.2, presentation_order: 5, advances: false },
  { entry_id: "k1", student_name: "Ana Onishi", dojo_name: "Shotokan Centro", phase: "final", nota: 26.6, presentation_order: 1, advances: null },
  { entry_id: "k2", student_name: "Marina Souza", dojo_name: "Santo André", phase: "final", nota: 26.0, presentation_order: 2, advances: null },
  { entry_id: "k3", student_name: "Helena Dias", dojo_name: "Santo André", phase: "final", nota: null, presentation_order: 3, advances: null },
  { entry_id: "k4", student_name: "Júlia Costa", dojo_name: "Shotokan Centro", phase: "final", nota: null, presentation_order: 4, advances: null },
];

// ── Helpers ────────────────────────────────────────────────────────────
function initials(name: string | null): string {
  if (!name) return "??";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

const ROUND_LABELS = ["Oitavas", "Quartas", "Semifinais", "Final"];
function roundLabel(round: number, totalRounds: number): string {
  const idx = totalRounds - 1 - round;
  return ROUND_LABELS[idx] ?? `R${round + 1}`;
}

const PRIMARY = KarateColors.primary;
const BORDER = KarateColors.border;
const INK = KarateColors.ink;
const INK3 = KarateColors.ink3;
const INK4 = KarateColors.ink4;
const SURFACE = KarateColors.surface;
const BG = KarateColors.bg;

// ── Component ─────────────────────────────────────────────────────────
export default function ChavesScreen() {
  const { id: cid, catId, catName, modality } = useLocalSearchParams<{
    id: string; catId: string; catName: string; modality: string;
  }>();
  const router = useRouter();
  const { federationId } = useKarateFederation();

  const isKata = modality === "kata" || modality === "team_kata";

  // ── Sorteio panel state
  const [method, setMethod] = useState<DrawMethod>("ranking");
  const [separateSameDojo, setSeparateSameDojo] = useState(true);
  const [thirdPlace, setThirdPlace] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [locking, setLocking] = useState(false);

  // ── Bracket state
  const [bracket, setBracket] = useState<BracketState | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancingMatch, setAdvancingMatch] = useState<string | null>(null);

  // ── Kata state
  const [kataScores, setKataScores] = useState<KataScore[]>([]);
  const [editScore, setEditScore] = useState<KataScore | null>(null);
  const [scoreInput, setScoreInput] = useState("");
  const [savingScore, setSavingScore] = useState(false);

  // ── Category list state (pick category)
  const [categories, setCategories] = useState<Array<{ id: string; name: string; modality: string }>>([]);
  const [selectedCatId, setSelectedCatId] = useState(catId || "");
  const [selectedModality, setSelectedModality] = useState(modality || "");
  const [selectedCatName, setSelectedCatName] = useState(catName || "");

  // Load categories for the competition
  const loadCategories = useCallback(async () => {
    try {
      const cats = await karateCompetitionsApi.listCategories(federationId, cid || "");
      if (cats && cats.length) {
        setCategories(cats.map((c) => ({ id: c.id, name: c.name, modality: c.modality })));
        if (!selectedCatId && cats.length > 0) {
          setSelectedCatId(cats[0].id);
          setSelectedModality(cats[0].modality);
          setSelectedCatName(cats[0].name);
        }
      }
    } catch {
      // [MOCK] keep empty
    }
  }, [federationId, cid, selectedCatId]);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  // Load bracket when category changes
  const loadBracket = useCallback(async () => {
    if (!selectedCatId) return;
    setLoading(true);
    try {
      const resp = await karateBracketsApi.getBracket(federationId, cid || "", selectedCatId);
      if (resp && resp.status !== "not_generated" && resp.bracket !== null) {
        const bs = resp as BracketState;
        setBracket(bs);
        if (bs.options) {
          setMethod(bs.options.method || "ranking");
          setSeparateSameDojo(bs.options.separateSameDojo ?? true);
          setThirdPlace(bs.options.thirdPlace ?? true);
        }
      } else {
        setBracket(null);
      }
    } catch {
      // [MOCK] use mock data
      if (selectedModality === "kata" || selectedModality === "team_kata") {
        setKataScores(MOCK_KATA_SCORES);
      } else {
        setBracket(MOCK_BRACKET);
      }
    } finally {
      setLoading(false);
    }
  }, [federationId, cid, selectedCatId, selectedModality]);

  const loadKata = useCallback(async () => {
    if (!selectedCatId) return;
    try {
      const scores = await karateBracketsApi.getKataScores(federationId, cid || "", selectedCatId);
      if (scores) setKataScores(scores);
    } catch {
      setKataScores(MOCK_KATA_SCORES);
    }
  }, [federationId, cid, selectedCatId]);

  useEffect(() => {
    if (selectedModality === "kata" || selectedModality === "team_kata") {
      loadKata();
    } else {
      loadBracket();
    }
  }, [selectedCatId, selectedModality, loadBracket, loadKata]);

  // ── Actions
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await karateBracketsApi.generateBracket(federationId, cid || "", selectedCatId, {
        method, separateSameDojo, thirdPlace,
      });
      await loadBracket();
    } catch {
      await loadBracket();
    } finally {
      setGenerating(false);
    }
  };

  const handleLock = async () => {
    setLocking(true);
    try {
      await karateBracketsApi.lockBracket(federationId, cid || "", selectedCatId);
      await loadBracket();
    } catch {
      setBracket((prev) => prev ? { ...prev, status: "locked" } : prev);
    } finally {
      setLocking(false);
    }
  };

  const handleReopen = () => {
    setBracket((prev) => prev ? { ...prev, status: "draft" } : null);
  };

  const handleAdvance = async (matchId: string, winnerId: string) => {
    if (!bracket || bracket.status !== "locked") return;
    setAdvancingMatch(matchId);
    try {
      const result = await karateBracketsApi.advanceWinner(
        federationId, cid || "", selectedCatId,
        { match_id: matchId, winner_entry_id: winnerId }
      );
      // Optimistic: reload bracket
      await loadBracket();
      if (result.champion_entry_id) {
        // show champion (bracket will reflect it on reload)
      }
    } catch {
      // Optimistic local update
      setBracket((prev) => {
        if (!prev) return prev;
        const rounds = prev.rounds.map((r) =>
          r.map((m) => m.id === matchId ? { ...m, winner_entry_id: winnerId } : m)
        );
        return { ...prev, rounds };
      });
    } finally {
      setAdvancingMatch(null);
    }
  };

  const handleSaveScore = async () => {
    if (!editScore || !scoreInput) return;
    const nota = parseFloat(scoreInput.replace(",", "."));
    if (isNaN(nota)) return;
    setSavingScore(true);
    try {
      await karateBracketsApi.putKataScore(federationId, cid || "", selectedCatId, {
        entry_id: editScore.entry_id, phase: editScore.phase, nota,
      });
      setKataScores((prev) =>
        prev.map((s) =>
          s.entry_id === editScore.entry_id && s.phase === editScore.phase
            ? { ...s, nota } : s
        )
      );
    } catch {
      // local update only
      setKataScores((prev) =>
        prev.map((s) =>
          s.entry_id === editScore.entry_id && s.phase === editScore.phase
            ? { ...s, nota } : s
        )
      );
    } finally {
      setSavingScore(false);
      setEditScore(null);
      setScoreInput("");
    }
  };

  const isKataMode = selectedModality === "kata" || selectedModality === "team_kata";
  const locked = bracket?.status === "locked";
  const hasDraft = bracket?.status === "draft";
  const notGenerated = !bracket;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Header */}
      <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={16} color={PRIMARY} />
        <Text style={styles.backText}>Competição</Text>
      </TouchableOpacity>

      <View style={styles.pageHead}>
        <Text style={styles.pageTitle}>Chaves<Text style={{ color: PRIMARY }}>.</Text></Text>
        <Text style={styles.pageSub}>
          Sorteio e visualização do chaveamento por categoria. O Kumite gera um bracket eliminatório; o Kata é apurado por bateria, ranqueado por nota.
        </Text>
      </View>

      {/* Category selector */}
      {categories.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catChip, selectedCatId === cat.id && styles.catChipActive]}
              onPress={() => {
                setSelectedCatId(cat.id);
                setSelectedModality(cat.modality);
                setSelectedCatName(cat.name);
                setBracket(null);
                setKataScores([]);
              }}
            >
              <Text style={[styles.catMod, cat.modality === "kumite" && styles.catModKumite]}>
                {cat.modality === "kata" || cat.modality === "team_kata" ? "Kata" : "Kumite"}
              </Text>
              <Text style={styles.catChipName} numberOfLines={2}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.divider} />

      {/* Loading */}
      {loading && <ActivityIndicator color={PRIMARY} style={{ marginTop: 32 }} />}

      {/* ============= KATA VIEW ============= */}
      {!loading && isKataMode && (
        <KataView
          catName={selectedCatName}
          scores={kataScores}
          onEditScore={(s) => { setEditScore(s); setScoreInput(s.nota !== null ? String(s.nota).replace(".", ",") : ""); }}
        />
      )}

      {/* ============= SORTEIO PANEL (not generated or draft) ============= */}
      {!loading && !isKataMode && (notGenerated || hasDraft) && (
        <SorteioPanel
          method={method}
          setMethod={setMethod}
          separateSameDojo={separateSameDojo}
          setSeparateSameDojo={setSeparateSameDojo}
          thirdPlace={thirdPlace}
          setThirdPlace={setThirdPlace}
          bracket={bracket}
          catName={selectedCatName}
          generating={generating}
          locking={locking}
          onGenerate={handleGenerate}
          onLock={handleLock}
        />
      )}

      {/* ============= BRACKET VIEW (locked) ============= */}
      {!loading && !isKataMode && locked && bracket && (
        <BracketView
          bracket={bracket}
          advancingMatch={advancingMatch}
          onAdvance={handleAdvance}
          onReopen={handleReopen}
          catName={selectedCatName}
        />
      )}

      {/* Kata score modal */}
      <Modal visible={!!editScore} transparent animationType="fade" onRequestClose={() => setEditScore(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Lançar nota</Text>
            <Text style={styles.sheetSub}>{editScore?.student_name}</Text>
            <Text style={styles.sheetSub2}>
              {editScore?.phase === "eliminatoria" ? "Eliminatória" : "Final"}
            </Text>
            <Text style={styles.inputLabel}>Nota (ex: 26,4)</Text>
            <TextInput
              style={styles.input}
              value={scoreInput}
              onChangeText={setScoreInput}
              keyboardType="decimal-pad"
              placeholder="0,0"
              placeholderTextColor={INK4}
            />
            <View style={styles.sheetActions}>
              <KarateButton label="Cancelar" variant="ghost" size="md" onPress={() => setEditScore(null)} style={{ flex: 1 }} />
              <KarateButton label={savingScore ? "Salvando..." : "Salvar"} variant="primary" size="md" onPress={handleSaveScore} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ── SorteioPanel ───────────────────────────────────────────────────────
function SorteioPanel({
  method, setMethod, separateSameDojo, setSeparateSameDojo,
  thirdPlace, setThirdPlace, bracket, catName, generating, locking,
  onGenerate, onLock,
}: {
  method: DrawMethod; setMethod: (m: DrawMethod) => void;
  separateSameDojo: boolean; setSeparateSameDojo: (v: boolean) => void;
  thirdPlace: boolean; setThirdPlace: (v: boolean) => void;
  bracket: BracketState | null; catName: string;
  generating: boolean; locking: boolean;
  onGenerate: () => void; onLock: () => void;
}) {
  const hasDraft = bracket?.status === "draft";
  const statusLabel = hasDraft ? "Pré-visualização gerada" : "Chave não gerada";

  return (
    <View style={styles.grid2}>
      {/* Options card */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View>
            <Text style={styles.cardTitle}>Gerar chave</Text>
            <Text style={styles.cardSub}>{catName} · eliminatório simples</Text>
          </View>
          <View style={[styles.badge, hasDraft ? styles.badgeDraft : styles.badgeNeutral]}>
            <View style={[styles.badgeDot, hasDraft ? styles.badgeDotOk : styles.badgeDotNeutral]} />
            <Text style={styles.badgeText}>{statusLabel}</Text>
          </View>
        </View>

        <Text style={styles.fieldLabel}>Método</Text>
        <View style={styles.segRow}>
          {(["ranking", "random"] as DrawMethod[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.segBtn, method === m && styles.segBtnActive]}
              onPress={() => setMethod(m)}
            >
              <Text style={[styles.segBtnText, method === m && styles.segBtnTextActive]}>
                {m === "ranking" ? "Sementes por ranking" : "Aleatório"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.methodDesc}>
          {method === "ranking"
            ? "Cabeças posicionadas pelo ranking; os 2 primeiros recebem bye."
            : "Posições totalmente aleatórias; byes distribuídos no sorteio."}
        </Text>

        <ConfigRow
          label="Separar mesmo dojô na 1ª rodada"
          desc="Evita que atletas do mesmo dojô se enfrentem na estreia."
          value={separateSameDojo}
          onToggle={() => setSeparateSameDojo(!separateSameDojo)}
        />
        <ConfigRow
          label="Disputa de 3º lugar"
          desc="Os dois perdedores das semifinais disputam o bronze."
          value={thirdPlace}
          onToggle={() => setThirdPlace(!thirdPlace)}
        />

        {!hasDraft ? (
          <KarateButton
            label={generating ? "Gerando..." : "Gerar chave"}
            variant="primary"
            size="md"
            onPress={onGenerate}
            style={styles.fullBtn}
          />
        ) : (
          <View style={styles.draftActions}>
            <KarateButton
              label="Regenerar"
              variant="ghost"
              size="md"
              onPress={onGenerate}
              style={{ flex: 1 }}
            />
            <KarateButton
              label={locking ? "Travando..." : "Travar chave"}
              variant="primary"
              size="md"
              onPress={onLock}
              style={{ flex: 1 }}
            />
          </View>
        )}

        {hasDraft && (
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={13} color={INK3} />
            <Text style={styles.infoText}>
              Pode regenerar quantas vezes quiser. Travar torna a chave oficial e libera o lançamento de resultados.
            </Text>
          </View>
        )}
      </View>

      {/* Preview: athletes or draft matches */}
      {hasDraft && bracket ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Resultado do sorteio</Text>
          <Text style={styles.cardSub}>Pré-visualização — confrontos da 1ª rodada</Text>
          <View style={styles.pills}>
            <PillBadge label={`${bracket.athletes_count} atletas`} />
            <PillBadge label={`${bracket.bye_count} byes`} />
            {bracket.options.thirdPlace && <PillBadge label="3º lugar: Incluída" />}
          </View>
          {(bracket.rounds[0] || []).map((m, i) => (
            <DraftMatchCard key={m.id} match={m} idx={i + 1} />
          ))}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Inscritos</Text>
          <Text style={styles.cardSub}>Os atletas aparecerão aqui após gerar o sorteio</Text>
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={32} color={INK4} />
            <Text style={styles.emptyText}>Gere o sorteio para ver os confrontos</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ── BracketView ──────────────────────────────────────────────────────────
function BracketView({
  bracket, advancingMatch, onAdvance, onReopen, catName,
}: {
  bracket: BracketState;
  advancingMatch: string | null;
  onAdvance: (matchId: string, winnerId: string) => void;
  onReopen: () => void;
  catName: string;
}) {
  const totalRounds = bracket.rounds.length;

  return (
    <View>
      {/* Section head */}
      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.cardTitle}>Chave · Kumite</Text>
          <Text style={styles.cardSub}>{catName}</Text>
        </View>
        <View style={styles.sectionHeadRight}>
          <View style={styles.badgeOk}>
            <View style={styles.badgeDotOk} />
            <Text style={styles.badgeText}>Oficial · travada</Text>
          </View>
          <TouchableOpacity style={styles.reopenBtn} onPress={onReopen}>
            <Text style={styles.reopenText}>Refazer sorteio</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bracketHint}>
        <Ionicons name="hand-left-outline" size={14} color={PRIMARY} />
        <Text style={styles.bracketHintText}>
          Clique no vencedor para lançar o resultado.
        </Text>
      </View>

      {/* Bracket — horizontal scroll */}
      <ScrollView horizontal showsHorizontalScrollIndicator style={styles.bracketScroll}>
        <View style={styles.bracketInner}>
          {bracket.rounds.map((round, rIdx) => (
            <View key={rIdx} style={styles.bracketCol}>
              <Text style={styles.roundLabel}>{roundLabel(rIdx, totalRounds)}</Text>
              {round.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  advancing={advancingMatch === match.id}
                  locked={bracket.status === "locked"}
                  onAdvance={onAdvance}
                />
              ))}
            </View>
          ))}
          {/* Champion column */}
          <View style={styles.champCol}>
            <Text style={styles.roundLabel}>Campeão</Text>
            {bracket.champion ? (
              <View style={styles.champCard}>
                <Text style={styles.champLabel}>Campeão</Text>
                <Text style={styles.champName}>{bracket.champion.student_name}</Text>
                <Text style={styles.champDojo}>{bracket.champion.dojo_name}</Text>
              </View>
            ) : (
              <View style={styles.champPending}>
                <Text style={styles.champPendingLabel}>Campeão</Text>
                <Text style={styles.champPendingName}>a definir</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <Text style={styles.scrollHint}>Role para o lado para ver as rodadas finais →</Text>

      {/* 3rd place */}
      {bracket.third_place_match && (
        <View style={{ marginTop: 24 }}>
          <Text style={styles.thirdLabel}>3º lugar</Text>
          <MatchCard
            match={bracket.third_place_match}
            advancing={advancingMatch === "third"}
            locked={bracket.status === "locked"}
            onAdvance={onAdvance}
          />
        </View>
      )}
    </View>
  );
}

// ── MatchCard ────────────────────────────────────────────────────────────
function MatchCard({
  match, advancing, locked, onAdvance,
}: {
  match: BracketMatch; advancing: boolean; locked: boolean;
  onAdvance: (matchId: string, winnerId: string) => void;
}) {
  function renderSide(side: BracketAthleteRef | "bye" | null, border: string, isWinner: boolean, isLoser: boolean) {
    const isBye = side === "bye";
    const athlete = !isBye && side !== null ? side as BracketAthleteRef : null;
    const canClick = locked && !advancing && !isBye && athlete !== null;

    return (
      <TouchableOpacity
        disabled={!canClick}
        onPress={canClick && athlete ? () => onAdvance(match.id, athlete.entry_id) : undefined}
        style={[
          styles.matchSide,
          { borderLeftColor: border },
          isWinner && styles.matchSideWinner,
          isLoser && styles.matchSideLoser,
        ]}
      >
        {isBye ? (
          <Text style={styles.byeText}>BYE</Text>
        ) : athlete ? (
          <View style={styles.athleteRow}>
            <View style={styles.av}>
              <Text style={styles.avText}>{initials(athlete.student_name)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.athleteName, isWinner && styles.athleteNameWinner]} numberOfLines={1}>
                {athlete.student_name}
              </Text>
              <Text style={styles.athleteDojo} numberOfLines={1}>{athlete.dojo_name}</Text>
            </View>
            {isWinner && <Text style={styles.winMark}>✓</Text>}
          </View>
        ) : (
          <Text style={styles.pendingText}>a definir</Text>
        )}
        {advancing && <ActivityIndicator size="small" color={PRIMARY} style={{ position: "absolute", right: 6 }} />}
      </TouchableOpacity>
    );
  }

  const akaRef = match.aka === "bye" ? null : match.aka as BracketAthleteRef | null;
  const shiroRef = match.shiro === "bye" ? null : match.shiro as BracketAthleteRef | null;
  const winnerId = match.winner_entry_id;
  const akaWin = !!winnerId && !!akaRef && winnerId === akaRef.entry_id;
  const shiroWin = !!winnerId && !!shiroRef && winnerId === shiroRef.entry_id;

  return (
    <View style={[styles.matchCard, { marginBottom: 8 }]}>
      {renderSide(match.aka, PRIMARY, akaWin, shiroWin)}
      <View style={styles.matchDivider} />
      {renderSide(match.shiro, INK3, shiroWin, akaWin)}
    </View>
  );
}

// ── DraftMatchCard ────────────────────────────────────────────────────────
function DraftMatchCard({ match, idx }: { match: BracketMatch; idx: number }) {
  const akaRef = match.aka === "bye" ? null : match.aka as BracketAthleteRef | null;
  const shiroRef = match.shiro === "bye" ? null : match.shiro as BracketAthleteRef | null;
  const sameDojo = akaRef && shiroRef && akaRef.dojo_name === shiroRef.dojo_name && akaRef.dojo_name !== null;

  return (
    <View style={[styles.matchCard, { marginBottom: 8 }]}>
      <View style={styles.matchCardHead}>
        <Text style={styles.matchCardIdx}>Chave {idx}</Text>
        {sameDojo && <Text style={styles.sameDojoWarn}>mesmo dojô</Text>}
      </View>
      {[{ ref: akaRef, isBye: match.aka === "bye", border: PRIMARY },
        { ref: shiroRef, isBye: match.shiro === "bye", border: INK3 }].map(({ ref, isBye, border }, si) => (
        <View key={si} style={[styles.matchSide, { borderLeftColor: border }, si === 1 && styles.matchSideShiro]}>
          {isBye ? (
            <Text style={styles.byeText}>BYE</Text>
          ) : ref ? (
            <View style={styles.athleteRow}>
              <View style={styles.av}><Text style={styles.avText}>{initials(ref.student_name)}</Text></View>
              <Text style={styles.athleteName} numberOfLines={1}>{ref.student_name}</Text>
              <Text style={styles.athleteDojo} numberOfLines={1}>{ref.dojo_name}</Text>
            </View>
          ) : (
            <Text style={styles.pendingText}>a definir</Text>
          )}
        </View>
      ))}
    </View>
  );
}

// ── KataView ─────────────────────────────────────────────────────────────
function KataView({
  catName, scores, onEditScore,
}: {
  catName: string;
  scores: KataScore[];
  onEditScore: (s: KataScore) => void;
}) {
  const elim = scores
    .filter((s) => s.phase === "eliminatoria")
    .sort((a, b) => ((b.nota ?? -1) - (a.nota ?? -1)));
  const final = scores
    .filter((s) => s.phase === "final")
    .sort((a, b) => ((b.nota ?? -1) - (a.nota ?? -1)));

  const MEDALS = ["Ouro", "Prata", "Bronze"];
  const MEDAL_COLORS = ["#9a7b1f", "#7d7d7d", "#8a5a2b"];

  return (
    <View>
      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.cardTitle}>Chave · Kata</Text>
          <Text style={styles.cardSub}>{catName} · por bateria — não é confronto 1×1</Text>
        </View>
        <View style={styles.badgeOk}>
          <View style={styles.badgeDotOk} />
          <Text style={styles.badgeText}>Apurado</Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="information-circle-outline" size={13} color={INK3} />
        <Text style={styles.infoText}>
          Cinco jurados; desconsidera a maior e a menor nota. Ordem de apresentação sorteada. Os melhores da eliminatória avançam à final.
        </Text>
      </View>

      <View style={styles.kataGrid}>
        {/* Eliminatória */}
        <View style={styles.card}>
          <View style={styles.kataTableHead}>
            <Text style={styles.kataTableTitle}>Eliminatória</Text>
            <Text style={styles.kataTableSub}>{elim.length} atletas</Text>
          </View>
          {elim.map((s, i) => (
            <View key={s.entry_id} style={[styles.kataRow, i === 0 && styles.kataRowFirst]}>
              <Text style={styles.kataPos}>{i + 1}</Text>
              <View style={styles.av}><Text style={styles.avText}>{initials(s.student_name)}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.athleteName} numberOfLines={1}>{s.student_name}</Text>
                <Text style={styles.athleteDojo} numberOfLines={1}>{s.dojo_name}</Text>
              </View>
              <Text style={styles.kataNota}>{s.nota !== null ? s.nota.toFixed(1).replace(".", ",") : "—"}</Text>
              <View style={[styles.pill, s.advances ? styles.pillAccent : styles.pillNeutral]}>
                <Text style={[styles.pillText, s.advances ? styles.pillTextAccent : styles.pillTextNeutral]}>
                  {s.advances ? "Classificada" : s.advances === false ? "Eliminada" : ""}
                </Text>
              </View>
              <TouchableOpacity onPress={() => onEditScore(s)} style={styles.editScoreBtn}>
                <Ionicons name="create-outline" size={15} color={PRIMARY} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Final */}
        {final.length > 0 && (
          <View style={styles.card}>
            <View style={styles.kataTableHead}>
              <Text style={styles.kataTableTitle}>Final</Text>
              <Text style={styles.kataTableSub}>{final.length} finalistas · medalhas</Text>
            </View>
            {final.map((s, i) => (
              <View key={s.entry_id} style={[styles.kataRow, i === 0 && styles.kataRowFirst]}>
                <Text style={[styles.kataPos, i < 3 && { fontWeight: "800", color: INK }]}>{i + 1}º</Text>
                <View style={styles.av}><Text style={styles.avText}>{initials(s.student_name)}</Text></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.athleteName} numberOfLines={1}>{s.student_name}</Text>
                  <Text style={styles.athleteDojo} numberOfLines={1}>{s.dojo_name}</Text>
                </View>
                <Text style={styles.kataNota}>{s.nota !== null ? s.nota.toFixed(1).replace(".", ",") : "—"}</Text>
                {i < 3 && (
                  <Text style={[styles.medalText, { color: MEDAL_COLORS[i] }]}>{MEDALS[i]}</Text>
                )}
                <TouchableOpacity onPress={() => onEditScore(s)} style={styles.editScoreBtn}>
                  <Ionicons name="create-outline" size={15} color={PRIMARY} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ── Small sub-components ───────────────────────────────────────────────────
function Toggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      style={[styles.toggle, value && styles.toggleOn]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
    </TouchableOpacity>
  );
}

function ConfigRow({
  label, desc, value, onToggle,
}: { label: string; desc: string; value: boolean; onToggle: () => void }) {
  return (
    <View style={styles.configRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.configLabel}>{label}</Text>
        <Text style={styles.configDesc}>{desc}</Text>
      </View>
      <Toggle value={value} onToggle={onToggle} />
    </View>
  );
}

function PillBadge({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: BG } as ViewStyle,
  content: { padding: 16, paddingBottom: 48, gap: 12 } as ViewStyle,
  backRow: { flexDirection: "row", alignItems: "center", gap: 2 } as ViewStyle,
  backText: { fontSize: 13, fontWeight: "700", color: PRIMARY } as TextStyle,
  pageHead: { gap: 6 } as ViewStyle,
  pageTitle: { fontSize: 28, fontWeight: "300", color: INK } as TextStyle,
  pageSub: { fontSize: 12, color: INK3, lineHeight: 18 } as TextStyle,
  catScroll: { flexGrow: 0 } as ViewStyle,
  catChip: {
    minWidth: 160, padding: 12, borderRadius: KarateRadius.md,
    borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE,
    marginRight: 8, gap: 6,
  } as ViewStyle,
  catChipActive: { borderColor: PRIMARY, backgroundColor: "rgba(185,28,28,0.06)" } as ViewStyle,
  catMod: {
    fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.2,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
    backgroundColor: SURFACE, color: INK3, alignSelf: "flex-start",
    borderWidth: 1, borderColor: BORDER,
  } as TextStyle,
  catModKumite: { backgroundColor: INK, color: BG, borderColor: INK } as TextStyle,
  catChipName: { fontSize: 13, fontWeight: "600", color: INK, lineHeight: 18 } as TextStyle,
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 8 } as ViewStyle,
  grid2: { gap: 16 } as ViewStyle,
  card: {
    backgroundColor: SURFACE, borderRadius: KarateRadius.lg,
    borderWidth: 1, borderColor: BORDER, padding: 16, gap: 10,
  } as ViewStyle,
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 } as ViewStyle,
  cardTitle: { fontSize: 17, fontWeight: "700", color: INK } as TextStyle,
  cardSub: { fontSize: 11, color: INK3, marginTop: 2 } as TextStyle,
  badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 } as ViewStyle,
  badgeNeutral: { backgroundColor: "rgba(107,114,128,0.08)", borderWidth: 1, borderColor: BORDER } as ViewStyle,
  badgeDraft: { backgroundColor: "rgba(185,28,28,0.08)", borderWidth: 1, borderColor: "rgba(185,28,28,0.2)" } as ViewStyle,
  badgeOk: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(21,128,61,0.08)", borderWidth: 1, borderColor: "rgba(21,128,61,0.2)" } as ViewStyle,
  badgeDot: { width: 6, height: 6, borderRadius: 3 } as ViewStyle,
  badgeDotOk: { backgroundColor: KarateColors.ok } as ViewStyle,
  badgeDotNeutral: { backgroundColor: KarateColors.neutral } as ViewStyle,
  badgeText: { fontSize: 11, fontWeight: "600", color: INK3 } as TextStyle,
  fieldLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.0, color: INK3 } as TextStyle,
  segRow: { flexDirection: "row", gap: 4, backgroundColor: "rgba(0,0,0,0.04)", borderRadius: 8, padding: 3 } as ViewStyle,
  segBtn: { flex: 1, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 6, alignItems: "center" } as ViewStyle,
  segBtnActive: { backgroundColor: INK } as ViewStyle,
  segBtnText: { fontSize: 11, fontWeight: "600", color: INK3 } as TextStyle,
  segBtnTextActive: { color: BG } as TextStyle,
  methodDesc: { fontSize: 11, color: INK3, lineHeight: 16 } as TextStyle,
  configRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6, borderTopWidth: 1, borderTopColor: BORDER } as ViewStyle,
  configLabel: { fontSize: 12, fontWeight: "600", color: INK } as TextStyle,
  configDesc: { fontSize: 11, color: INK3, marginTop: 2, lineHeight: 15 } as TextStyle,
  toggle: { width: 40, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.12)", padding: 2 } as ViewStyle,
  toggleOn: { backgroundColor: PRIMARY } as ViewStyle,
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff" } as ViewStyle,
  toggleThumbOn: { transform: [{ translateX: 18 }] } as ViewStyle,
  fullBtn: { marginTop: 4 } as ViewStyle,
  draftActions: { flexDirection: "row", gap: 10, marginTop: 4 } as ViewStyle,
  infoRow: { flexDirection: "row", gap: 6, alignItems: "flex-start" } as ViewStyle,
  infoText: { flex: 1, fontSize: 11, color: INK3, lineHeight: 15 } as TextStyle,
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 } as ViewStyle,
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.05)", borderWidth: 1, borderColor: BORDER } as ViewStyle,
  pillAccent: { backgroundColor: "rgba(185,28,28,0.08)", borderColor: "rgba(185,28,28,0.25)" } as ViewStyle,
  pillNeutral: { backgroundColor: "rgba(107,114,128,0.06)", borderColor: BORDER } as ViewStyle,
  pillText: { fontSize: 11, color: INK3, fontWeight: "500" } as TextStyle,
  pillTextAccent: { color: PRIMARY, fontWeight: "700" } as TextStyle,
  pillTextNeutral: { color: INK3 } as TextStyle,
  emptyBox: { alignItems: "center", gap: 8, padding: 24 } as ViewStyle,
  emptyText: { fontSize: 12, color: INK4, textAlign: "center" } as TextStyle,
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 } as ViewStyle,
  sectionHeadRight: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  reopenBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE } as ViewStyle,
  reopenText: { fontSize: 11, fontWeight: "600", color: INK3 } as TextStyle,
  bracketHint: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 } as ViewStyle,
  bracketHintText: { fontSize: 11.5, color: INK3 } as TextStyle,
  bracketScroll: { borderWidth: 1, borderColor: BORDER, borderRadius: KarateRadius.lg, backgroundColor: SURFACE } as ViewStyle,
  bracketInner: { flexDirection: "row", padding: 22, gap: 60, minWidth: 400 } as ViewStyle,
  bracketCol: { gap: 8, width: 200 } as ViewStyle,
  champCol: { width: 180, justifyContent: "center" } as ViewStyle,
  roundLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.4, color: INK3, textAlign: "center", marginBottom: 8 } as TextStyle,
  matchCard: { backgroundColor: BG, borderRadius: 10, borderWidth: 1, borderColor: BORDER, overflow: "hidden" } as ViewStyle,
  matchCardHead: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 5, backgroundColor: SURFACE, borderBottomWidth: 1, borderBottomColor: BORDER } as ViewStyle,
  matchCardIdx: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.0, color: INK3 } as TextStyle,
  sameDojoWarn: { fontSize: 9, color: PRIMARY } as TextStyle,
  matchSide: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderLeftWidth: 3, minHeight: 38 } as ViewStyle,
  matchSideShiro: { borderTopWidth: 1, borderTopColor: BORDER } as ViewStyle,
  matchSideWinner: { backgroundColor: "rgba(185,28,28,0.07)" } as ViewStyle,
  matchSideLoser: { opacity: 0.42 } as ViewStyle,
  matchDivider: { height: 1, backgroundColor: BORDER } as ViewStyle,
  athleteRow: { flexDirection: "row", alignItems: "center", gap: 7, flex: 1 } as ViewStyle,
  av: { width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.07)", alignItems: "center", justifyContent: "center", flexShrink: 0 } as ViewStyle,
  avText: { fontSize: 9, fontWeight: "700", color: INK } as TextStyle,
  athleteName: { fontSize: 12, fontWeight: "500", color: INK } as TextStyle,
  athleteNameWinner: { fontWeight: "700" } as TextStyle,
  athleteDojo: { fontSize: 9.5, color: INK3, marginTop: 1 } as TextStyle,
  winMark: { fontSize: 11, fontWeight: "700", color: PRIMARY, marginLeft: 4 } as TextStyle,
  byeText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.2, color: INK4 } as TextStyle,
  pendingText: { fontSize: 11, color: INK4, fontStyle: "italic" } as TextStyle,
  champCard: { backgroundColor: "rgba(185,28,28,0.07)", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: PRIMARY, padding: 16, alignItems: "center", gap: 4 } as ViewStyle,
  champLabel: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.4, color: INK3 } as TextStyle,
  champName: { fontSize: 16, fontWeight: "800", color: INK } as TextStyle,
  champDojo: { fontSize: 11, color: INK3 } as TextStyle,
  champPending: { padding: 16, alignItems: "center", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: BORDER, borderStyle: "dashed" } as ViewStyle,
  champPendingLabel: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.4, color: INK4 } as TextStyle,
  champPendingName: { fontSize: 16, color: INK3, marginTop: 4 } as TextStyle,
  thirdLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.0, color: INK3, marginBottom: 6 } as TextStyle,
  scrollHint: { fontSize: 11, color: INK4, textAlign: "right", marginTop: 6 } as TextStyle,
  kataGrid: { gap: 16 } as ViewStyle,
  kataTableHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 8 } as ViewStyle,
  kataTableTitle: { fontSize: 18, fontWeight: "300", color: INK } as TextStyle,
  kataTableSub: { fontSize: 11, color: INK3 } as TextStyle,
  kataRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: BORDER } as ViewStyle,
  kataRowFirst: { backgroundColor: "rgba(185,28,28,0.04)" } as ViewStyle,
  kataPos: { fontSize: 13, fontWeight: "600", color: INK3, width: 24, textAlign: "right" } as TextStyle,
  kataNota: { fontSize: 14, fontWeight: "700", color: INK, fontVariant: ["tabular-nums"] } as TextStyle,
  medalText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 } as TextStyle,
  editScoreBtn: { padding: 5, borderRadius: 8, backgroundColor: "rgba(185,28,28,0.08)" } as ViewStyle,
  overlay: { flex: 1, backgroundColor: "rgba(28,23,20,0.45)", alignItems: "center", justifyContent: "center", padding: 24 } as ViewStyle,
  sheet: { width: "100%", maxWidth: 360, backgroundColor: BG, borderRadius: KarateRadius.lg, padding: 20, gap: 8 } as ViewStyle,
  sheetTitle: { fontSize: 16, fontWeight: "800", color: INK } as TextStyle,
  sheetSub: { fontSize: 13, color: INK3 } as TextStyle,
  sheetSub2: { fontSize: 11, color: INK3, textTransform: "uppercase", letterSpacing: 0.8 } as TextStyle,
  inputLabel: { fontSize: 12, fontWeight: "700", color: INK3, marginTop: 4 } as TextStyle,
  input: { borderWidth: 1, borderColor: BORDER, borderRadius: KarateRadius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 20, color: INK, backgroundColor: SURFACE } as TextStyle,
  sheetActions: { flexDirection: "row", gap: 8, marginTop: 12 } as ViewStyle,
});
