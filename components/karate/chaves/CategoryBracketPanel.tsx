// ============================================================
// CategoryBracketPanel — Aura Karatê (Workspace do campeonato, Fase 1)
//
// Extraído de app/karate/(federation)/competicoes/torneio/chaves.tsx:
// TODO o data-fetching, state, effects e handlers de bracket/kata de UMA
// categoria específica (bracket, kataScores, pendingPayment, sorteio,
// generate/lock/reopen/advance, editScore/saveScore) foram movidos para
// cá, agora escopados pela categoria recebida via props (federationId,
// cid, catId, catName, modality, competitionName, federationName) — sem
// estado interno de "categoria selecionada". A lógica de
// avanço/byes/ranqueamento/medalhas/idempotência NÃO foi tocada.
//
// Usado por:
//   - chaves.tsx (rota antiga, mantida para deep-link): dono do próprio
//     seletor de categoria, renderiza este painel para a categoria
//     escolhida.
//   - torneio/[id].tsx (workspace novo): aba "Chaves & Resultados" /
//     "Apuração Kata" dentro do painel da categoria selecionada no rail.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import {
  KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F,
} from "@/constants/karateTheme";
import { ShojiButton } from "@/components/karate/shoji";
import {
  karateBracketsApi,
  BracketState,
  KataScore,
  DrawMethod,
} from "@/services/karateBracketsApi";
import { notify } from "@/utils/webAlert";
import { SorteioPanel } from "@/components/karate/chaves/SorteioPanel";
import { BracketView } from "@/components/karate/chaves/BracketView";
import { KataView } from "@/components/karate/chaves/KataScoring";

export function CategoryBracketPanel({
  federationId, cid, catId, catName, modality, competitionName, federationName,
}: {
  federationId: string;
  cid: string;
  catId: string;
  catName: string;
  modality: string;
  /** Nome da competição, usado no cabeçalho da folha impressa (opcional). */
  competitionName?: string;
  /** Nome da federação, usado no cabeçalho da folha impressa (opcional — cai para o contexto). */
  federationName?: string;
}) {
  const isKataMode = modality === "kata" || modality === "team_kata";

  // ── Sorteio panel state
  const [method, setMethod] = useState<DrawMethod>("ranking");
  const [separateSameDojo, setSeparateSameDojo] = useState(true);
  const [thirdPlace, setThirdPlace] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [locking, setLocking] = useState(false);

  // ── Bracket state
  const [bracket, setBracket] = useState<BracketState | null>(null);
  // Inscritos com pagamento pendente (aguardando confirmação da federação).
  const [pendingPayment, setPendingPayment] = useState(0);
  const [loading, setLoading] = useState(true);
  const [advancingMatch, setAdvancingMatch] = useState<string | null>(null);

  // ── Kata state
  const [kataScores, setKataScores] = useState<KataScore[]>([]);
  const [editScore, setEditScore] = useState<KataScore | null>(null);
  const [scoreInput, setScoreInput] = useState("");
  const [savingScore, setSavingScore] = useState(false);

  // Load bracket for this category (Kumite)
  const loadBracket = useCallback(async () => {
    if (!catId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const resp = await karateBracketsApi.getBracket(federationId, cid || "", catId);
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
  }, [federationId, cid, catId]);

  // Load kata scores for this category (Kata)
  const loadKata = useCallback(async () => {
    if (!catId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const scores = await karateBracketsApi.getKataScores(federationId, cid || "", catId);
      if (scores) setKataScores(scores);
    } catch {
      setKataScores([]);
    } finally {
      setLoading(false);
    }
  }, [federationId, cid, catId]);

  useEffect(() => {
    if (!catId) {
      setLoading(false);
      return;
    }
    if (isKataMode) {
      loadKata();
    } else {
      loadBracket();
    }
  }, [catId, isKataMode, loadBracket, loadKata]);

  // Pending de pagamento: GET /bracket retorna pending_payment_count para kata
  // e kumite (inclusive not_generated). Independente do fluxo kata/kumite.
  const loadPending = useCallback(async () => {
    if (!catId) { setPendingPayment(0); return; }
    try {
      const resp = await karateBracketsApi.getBracket(federationId, cid || "", catId);
      setPendingPayment((resp as any)?.pending_payment_count ?? 0);
    } catch { setPendingPayment(0); }
  }, [federationId, cid, catId]);
  useEffect(() => { loadPending(); }, [loadPending]);

  // ── Actions
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await karateBracketsApi.generateBracket(federationId, cid || "", catId, {
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
      await karateBracketsApi.lockBracket(federationId, cid || "", catId);
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

  const handleAdvance = async (matchId: string, winnerId: string, akaScore?: number, shiroScore?: number) => {
    if (!bracket || bracket.status !== "locked") return;
    setAdvancingMatch(matchId);
    try {
      await karateBracketsApi.advanceWinner(
        federationId, cid || "", catId,
        { match_id: matchId, winner_entry_id: winnerId, aka_score: akaScore, shiro_score: shiroScore }
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
      await karateBracketsApi.putKataScore(federationId, cid || "", catId, {
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

  const locked = bracket?.status === "locked";
  const hasDraft = bracket?.status === "draft";
  const notGenerated = !bracket;

  return (
    <View>
      {/* Loading */}
      {loading && !!catId && <ActivityIndicator color={P.red} style={{ marginTop: 32 }} />}

      {/* ============= AVISO: inscritos aguardando pagamento ============= */}
      {!loading && !!catId && pendingPayment > 0 && (
        <View style={styles.pendingBanner}>
          <Icon name="time-outline" size={16} color={P.red} />
          <Text style={styles.pendingText}>
            {pendingPayment} inscrito{pendingPayment > 1 ? "s" : ""} aguardando confirmação de pagamento — {pendingPayment > 1 ? "entram" : "entra"} na chave após a federação confirmar.
          </Text>
        </View>
      )}

      {/* ============= KATA VIEW ============= */}
      {!loading && !!catId && isKataMode && (
        <KataView
          catName={catName}
          scores={kataScores}
          onEditScore={(s) => { setEditScore(s); setScoreInput(s.nota !== null ? String(s.nota).replace(".", ",") : ""); }}
          federationId={federationId}
          cid={cid || ""}
          catId={catId}
          competitionName={competitionName ?? catName}
          federationName={federationName}
          onReloaded={loadKata}
        />
      )}

      {/* ============= SORTEIO PANEL (not generated or draft) ============= */}
      {!loading && !!catId && !isKataMode && (notGenerated || hasDraft) && (
        <SorteioPanel
          method={method}
          setMethod={setMethod}
          separateSameDojo={separateSameDojo}
          setSeparateSameDojo={setSeparateSameDojo}
          thirdPlace={thirdPlace}
          setThirdPlace={setThirdPlace}
          bracket={bracket}
          catName={catName}
          generating={generating}
          locking={locking}
          onGenerate={handleGenerate}
          onLock={handleLock}
        />
      )}

      {/* ============= BRACKET VIEW (locked) ============= */}
      {!loading && !!catId && !isKataMode && locked && bracket && (
        <BracketView
          bracket={bracket}
          advancingMatch={advancingMatch}
          onAdvance={handleAdvance}
          onReopen={handleReopen}
          catName={catName}
          federationId={federationId}
          cid={cid || ""}
          catId={catId}
          onReloaded={loadBracket}
          competitionName={competitionName}
          federationName={federationName}
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
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  pendingBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.redWash, borderWidth: 1, borderColor: P.redLine, borderRadius: R.md, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 14 } as ViewStyle,
  pendingText: { flex: 1, fontFamily: F.body, fontSize: 12.5, color: C.ink2, lineHeight: 17 } as TextStyle,
  overlay: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 24 } as ViewStyle,
  sheet: { width: "100%", maxWidth: 360, backgroundColor: P.glassHi, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 20, gap: 8 } as ViewStyle,
  sheetTitle: { fontFamily: F.heading, fontSize: 18, fontWeight: "400", color: C.ink } as TextStyle,
  sheetSub: { fontFamily: F.body, fontSize: 13, color: C.ink3 } as TextStyle,
  sheetSub2: { fontFamily: F.body, fontSize: 11, color: C.ink3, textTransform: "uppercase", letterSpacing: 0.8 } as TextStyle,
  inputLabel: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: C.ink3, marginTop: 4 } as TextStyle,
  input: { borderWidth: 1, borderColor: C.line2, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 10, fontFamily: F.mono, fontSize: 20, color: C.ink, backgroundColor: P.glass2 } as TextStyle,
  sheetActions: { flexDirection: "row", gap: 8, marginTop: 12 } as ViewStyle,
});
