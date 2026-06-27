// ============================================================
// Chaves — BracketView + MatchCard · Shoji
//
// Visualização do bracket Kumite (rounds em colunas + coluna do
// campeão + disputa de 3º lugar) e o MatchCard clicável que
// lança o vencedor.
//
// FIDELIDADE: a lógica de vencedor/perdedor (akaWin/shiroWin via
// winner_entry_id), o gating de clique (locked && !advancing &&
// !isBye), o roundLabel e o avanço NÃO foram alterados — só o
// skin Shoji. onAdvance é repassado intacto ao orquestrador.
// ============================================================
import React from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P } from "@/constants/karateTheme";
import { ShojiBadge } from "@/components/karate/shoji";
import {
  BracketState, BracketMatch, BracketAthleteRef,
} from "@/services/karateBracketsApi";
import {
  styles as S, initials, roundLabel, ByeText, PendingText,
} from "./shared";

export function BracketView({
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
      <View style={S.sectionHead}>
        <View>
          <Text style={S.cardTitle}>Chave · Kumite</Text>
          <Text style={S.cardSub}>{catName}</Text>
        </View>
        <View style={S.sectionHeadRight}>
          <ShojiBadge status="ok" label="Oficial · travada" />
          <TouchableOpacity style={S.reopenBtn} onPress={onReopen}>
            <Text style={S.reopenText}>Refazer sorteio</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={S.bracketHint}>
        <Icon name="info" size={14} color={P.red} />
        <Text style={S.bracketHintText}>
          Clique no vencedor para lançar o resultado.
        </Text>
      </View>

      {/* Bracket — horizontal scroll */}
      <ScrollView horizontal showsHorizontalScrollIndicator style={S.bracketScroll}>
        <View style={S.bracketInner}>
          {bracket.rounds.map((round, rIdx) => (
            <View key={rIdx} style={S.bracketCol}>
              <Text style={S.roundLabel}>{roundLabel(rIdx, totalRounds)}</Text>
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
          S.matchSide,
          { borderLeftColor: border },
          isWinner && S.matchSideWinner,
          isLoser && S.matchSideLoser,
        ]}
      >
        {isBye ? (
          <ByeText />
        ) : athlete ? (
          <View style={S.athleteRow}>
            <View style={S.av}>
              <Text style={S.avText}>{initials(athlete.student_name)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[S.athleteName, isWinner && S.athleteNameWinner]} numberOfLines={1}>
                {athlete.student_name}
              </Text>
              <Text style={S.athleteDojo} numberOfLines={1}>{athlete.dojo_name}</Text>
            </View>
            {isWinner && <Text style={S.winMark}>✓</Text>}
          </View>
        ) : (
          <PendingText />
        )}
        {advancing && <ActivityIndicator size="small" color={P.red} style={{ position: "absolute", right: 6 }} />}
      </TouchableOpacity>
    );
  }

  const akaRef = match.aka === "bye" ? null : match.aka as BracketAthleteRef | null;
  const shiroRef = match.shiro === "bye" ? null : match.shiro as BracketAthleteRef | null;
  const winnerId = match.winner_entry_id;
  const akaWin = !!winnerId && !!akaRef && winnerId === akaRef.entry_id;
  const shiroWin = !!winnerId && !!shiroRef && winnerId === shiroRef.entry_id;

  return (
    <View style={[S.matchCard, { marginBottom: 8 }]}>
      {renderSide(match.aka, P.red, akaWin, shiroWin)}
      <View style={S.matchDivider} />
      {renderSide(match.shiro, C.ink3, shiroWin, akaWin)}
    </View>
  );
}
