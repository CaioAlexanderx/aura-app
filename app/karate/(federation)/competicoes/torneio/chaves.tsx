// ============================================================
// Competições — Chaves (Track M) · Shoji
//
// Orquestrador da tela de chaveamento por categoria:
//   Kata  : apuração por bateria (eliminatória + final, ranked by nota)
//   Kumite: bracket eliminatório single-elimination
//
// Acesso: /karate/(federation)/competicoes/torneio/chaves?id=<cid>
// Parâmetros: id (competition id), catId (category id), catName, modality
// Dados reais via karateBracketsApi; falhas mostram erro honesto.
//
// REFATORAÇÃO (re-skin Shoji + decomposição): TODO o data-fetching,
// state, effects e handlers permanecem inalterados. As sub-views
// (SorteioPanel, BracketView/MatchCard, KataView, DraftMatchCard) foram
// extraídas para components/karate/chaves/. A lógica de bracket/kata
// (avanço, byes, ranqueamento, medalhas, idempotência) NÃO foi tocada.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
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
import { Icon } from "@/components/Icon";
import {
  KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP,
} from "@/constants/karateTheme";
import { ShojiBackground, PageHead, ShojiButton } from "@/components/karate/shoji";
import { useKarateFederation } from "@/contexts/KarateFederation";
import {
  karateBracketsApi,
  BracketState,
  KataScore,
  DrawMethod,
} from "@/services/karateBracketsApi";
import { karateCompetitionsApi } from "@/services/karateCompetitionsApi";
import { notify } from "@/utils/webAlert";
import { SorteioPanel } from "@/components/karate/chaves/SorteioPanel";
import { BracketView } from "@/components/karate/chaves/BracketView";
import { KataView } from "@/components/karate/chaves/KataScoring";

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
      // sem categorias: mantém vazio
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
      // sem dado real: não fabricar — mantém estado vazio
      setBracket(null);
      setKataScores([]);
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
      setKataScores([]);
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
    } catch (e: any) {
      notify("Não foi possível gerar a chave", e?.message ?? "Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  const handleLock = async () => {
    setLocking(true);
    try {
      await karateBracketsApi.lockBracket(federationId, cid || "", selectedCatId);
      await loadBracket();
    } catch (e: any) {
      notify("Não foi possível travar a chave", e?.message ?? "Tente novamente.");
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
      await karateBracketsApi.advanceWinner(
        federationId, cid || "", selectedCatId,
        { match_id: matchId, winner_entry_id: winnerId }
      );
      await loadBracket();
    } catch (e: any) {
      notify("Não foi possível lançar o resultado", e?.message ?? "Tente novamente.");
      await loadBracket();
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
      setEditScore(null);
      setScoreInput("");
    } catch (e: any) {
      notify("Não foi possível salvar a nota", e?.message ?? "Tente novamente.");
    } finally {
      setSavingScore(false);
    }
  };

  const isKataMode = selectedModality === "kata" || selectedModality === "team_kata";
  const locked = bracket?.status === "locked";
  const hasDraft = bracket?.status === "draft";
  const notGenerated = !bracket;

  return (
    <ShojiBackground>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <Icon name="chevron-back" size={16} color={P.red} />
          <Text style={styles.backText}>Competição</Text>
        </TouchableOpacity>

        <PageHead
          title="Chaves"
          sub="Sorteio e visualização do chaveamento por categoria. O Kumite gera um bracket eliminatório; o Kata é apurado por bateria, ranqueado por nota."
        />

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
        {loading && <ActivityIndicator color={P.red} style={{ marginTop: 32 }} />}

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
                placeholderTextColor={C.ink4}
              />
              <View style={styles.sheetActions}>
                <ShojiButton label="Cancelar" variant="ghost" onPress={() => setEditScore(null)} style={{ flex: 1 }} />
                <ShojiButton label={savingScore ? "Salvando..." : "Salvar"} variant="sumi" onPress={handleSaveScore} style={{ flex: 1 }} />
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </ShojiBackground>
  );
}

// ── Styles (orquestrador: header + chips de categoria + modal) ─────────
const styles = StyleSheet.create({
  content: { padding: 40, paddingTop: 40, paddingBottom: 72, maxWidth: SP.contentMax, width: "100%", alignSelf: "center", gap: 12 } as ViewStyle,
  backRow: { flexDirection: "row", alignItems: "center", gap: 2 } as ViewStyle,
  backText: { fontFamily: F.body, fontSize: 13, fontWeight: "700", color: P.red } as TextStyle,
  catScroll: { flexGrow: 0 } as ViewStyle,
  catChip: {
    minWidth: 160, padding: 12, borderRadius: R.md,
    borderWidth: 1, borderColor: C.line, backgroundColor: P.glass2,
    marginRight: 8, gap: 6,
  } as ViewStyle,
  catChipActive: { borderColor: P.redLine, backgroundColor: P.redWash } as ViewStyle,
  catMod: {
    fontFamily: F.body, fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.2,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
    backgroundColor: P.glass2, color: C.ink3, alignSelf: "flex-start",
    borderWidth: 1, borderColor: C.line,
  } as TextStyle,
  catModKumite: { backgroundColor: C.ink, color: P.paperWarm, borderColor: C.ink } as TextStyle,
  catChipName: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: C.ink, lineHeight: 18 } as TextStyle,
  divider: { height: 1, backgroundColor: C.line, marginVertical: 8 } as ViewStyle,
  overlay: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 24 } as ViewStyle,
  sheet: { width: "100%", maxWidth: 360, backgroundColor: P.glassHi, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 20, gap: 8 } as ViewStyle,
  sheetTitle: { fontFamily: F.heading, fontSize: 18, fontWeight: "400", color: C.ink } as TextStyle,
  sheetSub: { fontFamily: F.body, fontSize: 13, color: C.ink3 } as TextStyle,
  sheetSub2: { fontFamily: F.body, fontSize: 11, color: C.ink3, textTransform: "uppercase", letterSpacing: 0.8 } as TextStyle,
  inputLabel: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: C.ink3, marginTop: 4 } as TextStyle,
  input: { borderWidth: 1, borderColor: C.line2, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 10, fontFamily: F.mono, fontSize: 20, color: C.ink, backgroundColor: P.glass2 } as TextStyle,
  sheetActions: { flexDirection: "row", gap: 8, marginTop: 12 } as ViewStyle,
});
