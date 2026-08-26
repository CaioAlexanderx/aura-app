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
  TouchableOpacity,
  View,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import {
  KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F,
} from "@/constants/karateTheme";
import {
  karateBracketsApi,
  BracketState,
  KataScore,
  DrawMethod,
} from "@/services/karateBracketsApi";
import { notify } from "@/utils/webAlert";
import { SorteioPanel, KataDrawPanel } from "@/components/karate/chaves/SorteioPanel";
import { BracketView } from "@/components/karate/chaves/BracketView";
import { KataView } from "@/components/karate/chaves/KataScoring";
import { NotasArbitros, NotasSubmit } from "@/components/karate/NotasArbitros";

// ── Seletor rápido de categoria (Hub P2 — bancada) ─────────────────
// Permite "movimentar entre chaves" (anterior/próxima categoria) sem
// voltar telas nem rolar até o rail/chips. Opcional: o painel continua
// funcionando sozinho quando o pai não fornece a navegação.
export type CategoryNav = {
  items: Array<{ id: string; name: string; modality: string }>;
  currentId: string;
  onSelect: (id: string) => void;
};

function CategoryQuickNav({ nav }: { nav: CategoryNav }) {
  const idx = nav.items.findIndex((i) => i.id === nav.currentId);
  if (idx < 0 || nav.items.length < 2) return null;
  const prev = idx > 0 ? nav.items[idx - 1] : null;
  const next = idx < nav.items.length - 1 ? nav.items[idx + 1] : null;

  return (
    <View style={styles.quickNav}>
      <TouchableOpacity
        style={[styles.quickNavBtn, !prev && styles.quickNavBtnDisabled]}
        disabled={!prev}
        onPress={() => prev && nav.onSelect(prev.id)}
        accessibilityRole="button"
        accessibilityLabel={prev ? `Chave anterior: ${prev.name}` : "Não há chave anterior"}
      >
        <Icon name="chevron-left" size={14} color={prev ? C.ink2 : C.ink4} />
        <Text style={[styles.quickNavBtnText, !prev && styles.quickNavBtnTextDisabled]} numberOfLines={1}>
          {prev ? prev.name : "Início"}
        </Text>
      </TouchableOpacity>
      <View style={styles.quickNavCenter}>
        <Text style={styles.quickNavPos}>{idx + 1} de {nav.items.length}</Text>
        <Text style={styles.quickNavLabel}>chaves</Text>
      </View>
      <TouchableOpacity
        style={[styles.quickNavBtn, styles.quickNavBtnRight, !next && styles.quickNavBtnDisabled]}
        disabled={!next}
        onPress={() => next && nav.onSelect(next.id)}
        accessibilityRole="button"
        accessibilityLabel={next ? `Próxima chave: ${next.name}` : "Não há próxima chave"}
      >
        <Text style={[styles.quickNavBtnText, !next && styles.quickNavBtnTextDisabled]} numberOfLines={1}>
          {next ? next.name : "Fim"}
        </Text>
        <Icon name="chevron-right" size={14} color={next ? C.ink2 : C.ink4} />
      </TouchableOpacity>
    </View>
  );
}

export function CategoryBracketPanel({
  federationId, cid, catId, catName, modality, competitionName, federationName, categoryNav,
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
  /** Navegação rápida anterior/próxima entre categorias (opcional). */
  categoryNav?: CategoryNav;
}) {
  // Enbu também é apurado por notas (regra real FPKT) — alinhado ao backend.
  const isKataMode = modality === "kata" || modality === "team_kata" || modality === "enbu";

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
  // TODOS os inscritos não-desistentes (athletes_count) — inclui quem ainda
  // deve a taxa. NÃO é "confirmados": esse era exatamente o erro que o QA
  // pegou (pill dizia "2 atletas confirmados" com 1 devendo).
  const [athletesCount, setAthletesCount] = useState(0);
  // Os que de fato entram na chave/bateria: taxa paga (eligible_count).
  const [eligibleCount, setEligibleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [advancingMatch, setAdvancingMatch] = useState<string | null>(null);

  // ── Kata state
  const [kataScores, setKataScores] = useState<KataScore[]>([]);
  const [editScore, setEditScore] = useState<KataScore | null>(null);
  const [savingScore, setSavingScore] = useState(false);

  // Leitura ÚNICA do GET /bracket — vale para kumite E kata. Devolve
  // `status` ("not_generated" ou não), `athletes_count`, `eligible_count` e
  // `pending_payment_count` mesmo quando a chave ainda não existe. Antes o
  // modo kata só lia getKataScores e por isso não sabia distinguir "chave
  // não gerada" de "chave gerada e ainda sem notas"; e o pending vinha de
  // uma TERCEIRA chamada ao mesmo endpoint. Agora é uma só.
  const fetchBracketState = useCallback(async () => {
    if (!catId) {
      setBracket(null);
      setPendingPayment(0);
      setAthletesCount(0);
      setEligibleCount(0);
      return;
    }
    try {
      const resp = await karateBracketsApi.getBracket(federationId, cid || "", catId);
      const total = (resp as any)?.athletes_count ?? 0;
      setPendingPayment((resp as any)?.pending_payment_count ?? 0);
      setAthletesCount(total);
      // Fallback para backend antigo (sem eligible_count): volta ao
      // comportamento anterior — todo inscrito conta como elegível.
      setEligibleCount((resp as any)?.eligible_count ?? total);
      if (resp && resp.status !== "not_generated" && (resp as any).bracket !== null) {
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
      setPendingPayment(0);
      setAthletesCount(0);
      setEligibleCount(0);
    }
  }, [federationId, cid, catId]);

  // Load bracket for this category (Kumite)
  const loadBracket = useCallback(async () => {
    if (!catId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await fetchBracketState();
    } finally {
      setLoading(false);
    }
  }, [catId, fetchBracketState]);

  // Load kata scores for this category (Kata) — notas da bateria E estado da
  // chave, em paralelo: sem o segundo não há como oferecer o sorteio.
  const loadKata = useCallback(async () => {
    if (!catId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [scores] = await Promise.all([
        karateBracketsApi.getKataScores(federationId, cid || "", catId).catch(() => null),
        fetchBracketState(),
      ]);
      setKataScores(scores ?? []);
    } finally {
      setLoading(false);
    }
  }, [federationId, cid, catId, fetchBracketState]);

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

  // ── Actions
  // Kata (inclui team_kata/enbu): o mesmo endpoint gera a ORDEM DE
  // APRESENTAÇÃO (linhas de karate_kata_scores com presentation_order). O
  // backend só usa o seed nessas modalidades — método/mesmo dojô/3º lugar
  // são de kumite e não são enviados.
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await karateBracketsApi.generateBracket(
        federationId, cid || "", catId,
        isKataMode ? {} : { method, separateSameDojo, thirdPlace },
      );
      if (isKataMode) await loadKata(); else await loadBracket();
    } catch (e: any) {
      const title = isKataMode ? "Não foi possível sortear a ordem" : "Não foi possível gerar a chave";
      // 422 PAGAMENTO_PENDENTE: o backend manda o texto pronto em pt-BR e já
      // diz onde resolver. Repetir com palavra nossa só confundiria — e o
      // estado local está velho, então recarrega a contagem junto.
      if (e?.data?.code === "PAGAMENTO_PENDENTE") {
        notify(title, e?.data?.error ?? e?.message ?? "Tente novamente.");
        await fetchBracketState();
      } else {
        notify(title, e?.message ?? "Tente novamente.");
      }
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

  // Onda B: o payload vem do NotasArbitros ({ notas } ou { nota } legado).
  // O TOTAL é do BACKEND — a resposta do PUT é o que entra na lista.
  const handleSaveScore = async (payload: NotasSubmit) => {
    if (!editScore) return;
    setSavingScore(true);
    try {
      const saved = await karateBracketsApi.putKataScore(federationId, cid || "", catId, {
        entry_id: editScore.entry_id, phase: editScore.phase, ...payload,
      });
      setKataScores((prev) =>
        prev.map((s) =>
          s.entry_id === editScore.entry_id && s.phase === editScore.phase
            ? { ...s, nota: saved.nota, notas: saved.notas ?? ("notas" in payload ? payload.notas : null) } : s
        )
      );
      setEditScore(null);
    } catch (e: any) {
      notify("Não foi possível salvar a nota", e?.message ?? "Tente novamente.");
    } finally {
      setSavingScore(false);
    }
  };

  const locked = bracket?.status === "locked";
  const hasDraft = bracket?.status === "draft";
  const notGenerated = !bracket;
  // Kata: a bateria só existe depois de gerada. Sem isso a tela desenhava
  // "Eliminatória — 0 atletas" e não oferecia nada para clicar. Fallback
  // para dados legados que tenham notas sem linha de bracket.
  const kataReady = !notGenerated || kataScores.length > 0;
  // Nesse estado o próprio bloco de sorteio já explica o pendente de
  // pagamento — não repetir o mesmo aviso duas vezes na mesma tela.
  const pendingShownByDraw = isKataMode && !kataReady && eligibleCount === 0;

  return (
    <View>
      {/* Seletor rápido: anterior/próxima categoria sem voltar telas */}
      {categoryNav && <CategoryQuickNav nav={categoryNav} />}

      {/* Loading */}
      {loading && !!catId && <ActivityIndicator color={P.red} style={{ marginTop: 32 }} />}

      {/* ============= AVISO: inscritos aguardando pagamento ============= */}
      {!loading && !!catId && pendingPayment > 0 && !pendingShownByDraw && (
        <View style={styles.pendingBanner}>
          <Icon name="time-outline" size={16} color={P.red} />
          <Text style={styles.pendingText}>
            {pendingPayment} inscrito{pendingPayment > 1 ? "s" : ""} aguardando confirmação de pagamento — {pendingPayment > 1 ? "entram" : "entra"} na chave após a federação confirmar.
          </Text>
        </View>
      )}

      {/* ===== SORTEIO DA ORDEM (kata/team_kata/enbu, chave não gerada) ===== */}
      {!loading && !!catId && isKataMode && !kataReady && (
        <KataDrawPanel
          catName={catName}
          athletesCount={athletesCount}
          eligibleCount={eligibleCount}
          pendingPayment={pendingPayment}
          generating={generating}
          onGenerate={handleGenerate}
        />
      )}

      {/* ============= KATA VIEW ============= */}
      {!loading && !!catId && isKataMode && kataReady && (
        <KataView
          catName={catName}
          scores={kataScores}
          onEditScore={(s) => setEditScore(s)}
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
          athletesCount={athletesCount}
          eligibleCount={eligibleCount}
          pendingPayment={pendingPayment}
          onGenerate={handleGenerate}
          onLock={handleLock}
        />
      )}

      {/* ============= BRACKET VIEW (draft + locked) ============= */}
      {/* No rascunho é a BANCADA DE MONTAGEM (mover atletas, colisão de
          dojô, undo — PUT /matches só aceita draft); travada é a chave
          oficial (lançar vencedores). Antes só renderizava locked, o que
          tornava o modo de edição INALCANÇÁVEL: no rascunho ninguém via o
          editor e, travada, ele recusava editar. */}
      {!loading && !!catId && !isKataMode && (locked || hasDraft) && bracket && (
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

      {/* Kata score modal — Onda B: uma nota por árbitro (5 no padrão) */}
      <Modal visible={!!editScore} transparent animationType="fade" onRequestClose={() => setEditScore(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Lançar notas</Text>
            <Text style={styles.sheetSub}>{editScore?.student_name}</Text>
            {!!editScore && (
              <NotasArbitros
                key={`${editScore.entry_id}:${editScore.phase}`}
                phaseLabel={editScore.phase === "eliminatoria" ? "Eliminatória" : "Final"}
                initialNotas={editScore.notas}
                initialNota={editScore.nota}
                saving={savingScore}
                onSubmit={handleSaveScore}
                onCancel={() => setEditScore(null)}
                style={{ marginTop: 6 }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Seletor rápido de categoria (bancada)
  quickNav: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 } as ViewStyle,
  quickNavBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: R.md,
    borderWidth: 1, borderColor: C.line2, backgroundColor: P.glass2,
    maxWidth: 260,
  } as ViewStyle,
  quickNavBtnRight: { justifyContent: "flex-end" } as ViewStyle,
  quickNavBtnDisabled: { opacity: 0.45 } as ViewStyle,
  quickNavBtnText: { fontFamily: F.body, fontSize: 12, fontWeight: "600", color: C.ink2, flexShrink: 1 } as TextStyle,
  quickNavBtnTextDisabled: { color: C.ink4 } as TextStyle,
  quickNavCenter: { alignItems: "center", minWidth: 64 } as ViewStyle,
  quickNavPos: { fontFamily: F.mono, fontSize: 12, fontWeight: "700", color: C.ink, fontVariant: ["tabular-nums"] } as TextStyle,
  quickNavLabel: { fontFamily: F.body, fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.0, color: C.ink3 } as TextStyle,

  pendingBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.redWash, borderWidth: 1, borderColor: P.redLine, borderRadius: R.md, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 14 } as ViewStyle,
  pendingText: { flex: 1, fontFamily: F.body, fontSize: 12.5, color: C.ink2, lineHeight: 17 } as TextStyle,
  overlay: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 24 } as ViewStyle,
  // Onda B: o modal ficou mais largo — cinco campos de nota lado a lado.
  sheet: { width: "100%", maxWidth: 460, backgroundColor: P.glassHi, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 20, gap: 8 } as ViewStyle,
  sheetTitle: { fontFamily: F.heading, fontSize: 18, fontWeight: "400", color: C.ink } as TextStyle,
  sheetSub: { fontFamily: F.body, fontSize: 13, color: C.ink3 } as TextStyle,
});
