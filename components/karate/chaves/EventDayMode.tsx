// ============================================================
// Chaves — Modo dia do evento · Shoji (Fase 5)
//
// Visão FOCADA em tela cheia para rodar as lutas de Kumite AO VIVO,
// sobre o bracket já existente. Não reimplementa avanço/placar —
// reutiliza `onAdvance` (== handleAdvance de chaves.tsx, que chama
// karateBracketsApi.advanceWinner) e `onReloaded` (== loadBracket)
// já recebidos pelo BracketView.
//
// "Próxima luta pendente": primeira partida, na ORDEM NATURAL dos
// rounds (round 0 → round N, slot crescente dentro do round — a
// mesma ordem em que os rounds já são renderizados no BracketView),
// cujo winner_entry_id é nulo E que tem os dois lados preenchidos
// com atleta real (não bye, não null). Byes já são resolvidos pelo
// backend antes de chegar aqui (avançam sozinhos), então não entram
// como "pendente". A disputa de 3º lugar entra no fim da fila, se
// existir e ainda não tiver os dois lados prontos+vencedor.
//
// Sem lutas pendentes (todas decididas) → mostra o Campeão em
// destaque grande (bracket.champion). Se o campeão ainda não foi
// calculado mas também não há pendente elegível (ex.: falta o 3º
// lugar), mostra um estado neutro "aguardando o próximo confronto".
//
// Kata: FORA de escopo (só kumite) — TODO: um "Modo evento" para
// Kata (fila de baterias por nota) pode reaproveitar o mesmo shell
// (cabeçalho + card grande), mas fica para um PR futuro.
// ============================================================
import React, { useCallback, useMemo, useState } from "react";
import {
  View, Text, Modal, ScrollView, TouchableOpacity, TextInput, Platform, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { ShojiBadge, ShojiButton } from "@/components/karate/shoji";
import { toast } from "@/components/Toast";
import { BracketState, BracketMatch, BracketAthleteRef } from "@/services/karateBracketsApi";
import { buildBracketHtml } from "@/components/karate/chaves/buildBracketHtml";
import { initials, roundLabel } from "./shared";

const isWeb = Platform.OS === "web";

type NextMatch = { match: BracketMatch; roundIdx: number; isThird: boolean };

/** Um atleta "real" no slot (não bye, não vazio). */
function realAthlete(v: BracketAthleteRef | "bye" | null): BracketAthleteRef | null {
  return v && v !== "bye" ? v : null;
}

/**
 * Calcula a próxima luta pendente na ordem natural dos rounds
 * (mesma ordem em que o BracketView renderiza as colunas):
 * round 0..N, slot crescente dentro do round. Uma partida é
 * "pendente" quando: winner_entry_id é null, e AMBOS os lados
 * já têm atleta real definido (não bye, não null — ou seja, o
 * confronto já está pronto para acontecer, só falta o resultado).
 * A disputa de 3º lugar é avaliada por último.
 */
export function findNextPendingMatch(bracket: BracketState): NextMatch | null {
  for (let rIdx = 0; rIdx < bracket.rounds.length; rIdx++) {
    const round = bracket.rounds[rIdx];
    for (const match of round) {
      if (match.winner_entry_id) continue;
      if (match.is_bye) continue;
      const aka = realAthlete(match.aka);
      const shiro = realAthlete(match.shiro);
      if (aka && shiro) return { match, roundIdx: rIdx, isThird: false };
    }
  }
  if (bracket.third_place_match) {
    const m = bracket.third_place_match;
    if (!m.winner_entry_id && !m.is_bye) {
      const aka = realAthlete(m.aka);
      const shiro = realAthlete(m.shiro);
      if (aka && shiro) return { match: m, roundIdx: bracket.rounds.length, isThird: true };
    }
  }
  return null;
}

export function EventDayMode({
  visible, onClose, bracket, onAdvance, onReloaded, advancingMatch,
  catName, competitionName, federationName,
}: {
  visible: boolean;
  onClose: () => void;
  bracket: BracketState;
  /** Mesmo handler de chaves.tsx — chama karateBracketsApi.advanceWinner + recarrega. */
  onAdvance: (matchId: string, winnerId: string, akaScore?: number, shiroScore?: number) => void;
  /** Recarrega o bracket real (== loadBracket). Chamado após onAdvance concluir a atualização. */
  onReloaded?: () => void | Promise<void>;
  advancingMatch: string | null;
  catName: string;
  competitionName?: string;
  federationName?: string;
}) {
  const [akaScoreInput, setAkaScoreInput] = useState("");
  const [shiroScoreInput, setShiroScoreInput] = useState("");

  const next = useMemo(() => findNextPendingMatch(bracket), [bracket]);
  const totalRounds = bracket.rounds.length;

  // Fila compacta de "próximas" (contexto) — todas as pendentes elegíveis,
  // sem a que já está em destaque.
  const upcoming = useMemo(() => {
    const flat: NextMatch[] = [];
    bracket.rounds.forEach((round, rIdx) => {
      round.forEach((match) => {
        if (match.winner_entry_id || match.is_bye) return;
        const aka = realAthlete(match.aka);
        const shiro = realAthlete(match.shiro);
        if (aka && shiro) flat.push({ match, roundIdx: rIdx, isThird: false });
      });
    });
    if (bracket.third_place_match) {
      const m = bracket.third_place_match;
      if (!m.winner_entry_id && !m.is_bye) {
        const aka = realAthlete(m.aka);
        const shiro = realAthlete(m.shiro);
        if (aka && shiro) flat.push({ match: m, roundIdx: bracket.rounds.length, isThird: true });
      }
    }
    return flat.slice(1); // remove a atual (index 0 == next)
  }, [bracket]);

  const handlePick = useCallback((side: "aka" | "shiro") => {
    if (!next) return;
    const athlete = side === "aka" ? realAthlete(next.match.aka) : realAthlete(next.match.shiro);
    if (!athlete) return;
    const akaScore = akaScoreInput.trim() ? parseInt(akaScoreInput.trim(), 10) : undefined;
    const shiroScore = shiroScoreInput.trim() ? parseInt(shiroScoreInput.trim(), 10) : undefined;
    onAdvance(
      next.match.id,
      athlete.entry_id,
      Number.isFinite(akaScore as number) ? akaScore : undefined,
      Number.isFinite(shiroScore as number) ? shiroScore : undefined,
    );
    setAkaScoreInput("");
    setShiroScoreInput("");
  }, [next, akaScoreInput, shiroScoreInput, onAdvance]);

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
      toast.error(e?.message || "Erro ao gerar a chave para impressão");
    }
  }, [bracket, competitionName, catName, federationName]);

  const isAdvancingCurrent = !!next && advancingMatch === next.match.id;
  const akaAthlete = next ? realAthlete(next.match.aka) : null;
  const shiroAthlete = next ? realAthlete(next.match.shiro) : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Cabeçalho compacto */}
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.headerEyebrow}>Modo evento · Kumite</Text>
              <Text style={styles.headerTitle} numberOfLines={1}>{catName}</Text>
            </View>
            <View style={styles.headerRight}>
              <ShojiBadge status={bracket.status === "locked" ? "ok" : "warn"} label={bracket.status === "locked" ? "Oficial · travada" : "Rascunho"} />
              <TouchableOpacity style={styles.iconBtn} onPress={handlePrint} accessibilityLabel="Imprimir chave">
                <Icon name="print" size={16} color={C.ink2} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, styles.exitBtn]} onPress={onClose} accessibilityLabel="Sair do modo evento">
                <Icon name="close" size={18} color={P.paperWarm} />
                <Text style={styles.exitBtnText}>Sair</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Card "Próxima luta" ou Campeão */}
          {next ? (
            <View style={styles.fightCard}>
              <Text style={styles.fightCardEyebrow}>
                {next.isThird ? "3º lugar" : roundLabel(next.roundIdx, totalRounds)} · Próxima luta
              </Text>

              <View style={styles.sidesRow}>
                <FighterSide
                  athlete={akaAthlete}
                  label="Aka"
                  color={P.red}
                  disabled={isAdvancingCurrent}
                  onPress={() => handlePick("aka")}
                />
                <View style={styles.vsWrap}>
                  <Text style={styles.vsText}>vs</Text>
                </View>
                <FighterSide
                  athlete={shiroAthlete}
                  label="Shiro"
                  color={C.ink3}
                  disabled={isAdvancingCurrent}
                  onPress={() => handlePick("shiro")}
                />
              </View>

              {/* Placar opcional */}
              <View style={styles.scoreRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.scoreLabel}>Placar Aka (opcional)</Text>
                  <TextInput
                    style={styles.scoreInput}
                    value={akaScoreInput}
                    onChangeText={setAkaScoreInput}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={C.ink4}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.scoreLabel}>Placar Shiro (opcional)</Text>
                  <TextInput
                    style={styles.scoreInput}
                    value={shiroScoreInput}
                    onChangeText={setShiroScoreInput}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={C.ink4}
                  />
                </View>
              </View>

              <Text style={styles.fightCardHint}>
                {isAdvancingCurrent ? "Lançando resultado…" : "Toque em \"Venceu\" no lado do vencedor. O placar acima é opcional."}
              </Text>
            </View>
          ) : (
            <ChampionCard champion={bracket.champion} />
          )}

          {/* Mini fila de próximas lutas (contexto) */}
          {upcoming.length > 0 && (
            <View style={styles.upcomingWrap}>
              <Text style={styles.upcomingTitle}>Depois desta ({upcoming.length})</Text>
              {upcoming.slice(0, 5).map((u) => (
                <View key={u.match.id} style={styles.upcomingRow}>
                  <Text style={styles.upcomingRound}>
                    {u.isThird ? "3º" : roundLabel(u.roundIdx, totalRounds)}
                  </Text>
                  <Text style={styles.upcomingNames} numberOfLines={1}>
                    {realAthlete(u.match.aka)?.student_name ?? "?"} vs {realAthlete(u.match.shiro)?.student_name ?? "?"}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Lado do atleta (botão grande de toque) ──────────────────────────
function FighterSide({
  athlete, label, color, disabled, onPress,
}: {
  athlete: BracketAthleteRef | null;
  label: string;
  color: string;
  disabled: boolean;
  onPress: () => void;
}) {
  if (!athlete) {
    return (
      <View style={[styles.fighterSide, styles.fighterSideEmpty]}>
        <Text style={styles.fighterSideEmptyText}>a definir</Text>
      </View>
    );
  }
  return (
    <View style={[styles.fighterSide, { borderTopColor: color }]}>
      <Text style={[styles.fighterLabel, { color }]}>{label}</Text>
      <View style={styles.fighterAvatar}>
        <Text style={styles.fighterAvatarText}>{initials(athlete.student_name)}</Text>
      </View>
      <Text style={styles.fighterName} numberOfLines={2}>{athlete.student_name}</Text>
      <Text style={styles.fighterDojo} numberOfLines={1}>{athlete.dojo_name}</Text>
      <TouchableOpacity
        style={[styles.winBtn, { backgroundColor: color }, disabled && styles.winBtnDisabled]}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${athlete.student_name} venceu`}
      >
        <Icon name="checkmark-circle" size={18} color="#fdf8f2" />
        <Text style={styles.winBtnText}>Venceu</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Campeão (sem lutas pendentes) ─────────────────────────────────────
function ChampionCard({ champion }: { champion: BracketAthleteRef | null }) {
  if (champion) {
    return (
      <View style={styles.champCard}>
        <Icon name="trophy-outline" size={40} color={P.red} />
        <Text style={styles.champEyebrow}>Campeão da categoria</Text>
        <Text style={styles.champName}>{champion.student_name}</Text>
        <Text style={styles.champDojo}>{champion.dojo_name}</Text>
      </View>
    );
  }
  return (
    <View style={styles.champPendingCard}>
      <Icon name="time-outline" size={32} color={C.ink3} />
      <Text style={styles.champPendingText}>
        Aguardando o próximo confronto ficar pronto (ex.: disputa de 3º lugar).
      </Text>
    </View>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.paperWarm } as ViewStyle,
  scrollContent: { padding: 20, paddingBottom: 60, gap: 16, maxWidth: 820, width: "100%", alignSelf: "center" } as ViewStyle,

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12,
    borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 14, marginBottom: 4,
  } as ViewStyle,
  headerEyebrow: { fontFamily: F.body, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.2, color: P.red } as TextStyle,
  headerTitle: { fontFamily: F.heading, fontSize: 22, fontWeight: "400", color: C.ink, marginTop: 2 } as TextStyle,
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 } as ViewStyle,
  iconBtn: {
    width: 40, height: 40, borderRadius: R.md, alignItems: "center", justifyContent: "center",
    backgroundColor: P.glass2, borderWidth: 1, borderColor: C.line2,
  } as ViewStyle,
  exitBtn: {
    width: "auto", flexDirection: "row", gap: 6, paddingHorizontal: 14,
    backgroundColor: C.ink, borderColor: C.ink,
  } as ViewStyle,
  exitBtnText: { fontFamily: F.body, fontSize: 13, fontWeight: "700", color: P.paperWarm } as TextStyle,

  // Fight card
  fightCard: {
    backgroundColor: P.glassHi, borderRadius: R.xl, borderWidth: 1, borderColor: C.line,
    padding: 20, gap: 16,
  } as ViewStyle,
  fightCardEyebrow: {
    fontFamily: F.body, fontSize: 11, fontWeight: "700", textTransform: "uppercase",
    letterSpacing: 1.2, color: C.ink3, textAlign: "center",
  } as TextStyle,
  sidesRow: { flexDirection: "row", alignItems: "stretch", gap: 12 } as ViewStyle,
  vsWrap: { alignItems: "center", justifyContent: "center", paddingHorizontal: 4 } as ViewStyle,
  vsText: { fontFamily: F.heading, fontSize: 16, color: C.ink3 } as TextStyle,

  fighterSide: {
    flex: 1, alignItems: "center", gap: 6, padding: 16, borderRadius: R.lg,
    borderWidth: 1, borderColor: C.line, borderTopWidth: 4, backgroundColor: P.paper,
  } as ViewStyle,
  fighterSideEmpty: {
    justifyContent: "center", borderStyle: "dashed", borderTopWidth: 1,
  } as ViewStyle,
  fighterSideEmptyText: { fontFamily: F.body, fontSize: 13, color: C.ink4, fontStyle: "italic" } as TextStyle,
  fighterLabel: {
    fontFamily: F.body, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.2,
  } as TextStyle,
  fighterAvatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: P.neutralWash,
    alignItems: "center", justifyContent: "center", marginTop: 2,
  } as ViewStyle,
  fighterAvatarText: { fontFamily: F.body, fontSize: 18, fontWeight: "700", color: C.ink } as TextStyle,
  fighterName: { fontFamily: F.heading, fontSize: 19, fontWeight: "400", color: C.ink, textAlign: "center", marginTop: 4 } as TextStyle,
  fighterDojo: { fontFamily: F.body, fontSize: 12, color: C.ink3, textAlign: "center" } as TextStyle,
  winBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    minHeight: 56, width: "100%", borderRadius: R.md, marginTop: 8, paddingHorizontal: 16,
  } as ViewStyle,
  winBtnDisabled: { opacity: 0.5 } as ViewStyle,
  winBtnText: { fontFamily: F.body, fontSize: 16, fontWeight: "700", color: "#fdf8f2" } as TextStyle,

  scoreRow: { flexDirection: "row", gap: 12 } as ViewStyle,
  scoreLabel: { fontFamily: F.body, fontSize: 11, fontWeight: "700", color: C.ink3, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.6 } as TextStyle,
  scoreInput: {
    borderWidth: 1, borderColor: C.line2, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 12,
    fontFamily: F.mono, fontSize: 20, color: C.ink, backgroundColor: P.glass2, textAlign: "center",
  } as TextStyle,
  fightCardHint: { fontFamily: F.body, fontSize: 12, color: C.ink3, textAlign: "center" } as TextStyle,

  // Champion
  champCard: {
    alignItems: "center", gap: 6, padding: 40, borderRadius: R.xl,
    backgroundColor: P.redWash, borderWidth: 1, borderColor: P.red,
  } as ViewStyle,
  champEyebrow: { fontFamily: F.body, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.4, color: C.ink3, marginTop: 6 } as TextStyle,
  champName: { fontFamily: F.heading, fontSize: 28, fontWeight: "400", color: C.ink, marginTop: 4, textAlign: "center" } as TextStyle,
  champDojo: { fontFamily: F.body, fontSize: 14, color: C.ink3 } as TextStyle,
  champPendingCard: {
    alignItems: "center", gap: 10, padding: 32, borderRadius: R.xl,
    borderWidth: 1, borderColor: C.line, borderStyle: "dashed",
  } as ViewStyle,
  champPendingText: { fontFamily: F.body, fontSize: 13, color: C.ink3, textAlign: "center", maxWidth: 360 } as TextStyle,

  // Upcoming
  upcomingWrap: {
    backgroundColor: P.glass2, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 14, gap: 8,
  } as ViewStyle,
  upcomingTitle: { fontFamily: F.body, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.0, color: C.ink3 } as TextStyle,
  upcomingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 } as ViewStyle,
  upcomingRound: { fontFamily: F.body, fontSize: 10, fontWeight: "700", color: C.ink4, textTransform: "uppercase", width: 70 } as TextStyle,
  upcomingNames: { flex: 1, fontFamily: F.body, fontSize: 12.5, color: C.ink2 } as TextStyle,
});
