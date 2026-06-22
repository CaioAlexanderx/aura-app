// ============================================================
// Chaves — KataScoring · Shoji
//
// Apuração de Kata por bateria: tabela da eliminatória + tabela
// da final (medalhas). Ranqueado por nota.
//
// FIDELIDADE: o ranqueamento (filter por phase + sort por nota
// desc com fallback -1), o cálculo de classificação (s.advances)
// e a atribuição de medalhas (i < 3) NÃO foram alterados — só o
// skin Shoji. onEditScore é repassado intacto ao orquestrador.
//
// NB: as cores de medalha (ouro/prata/bronze) são CONTEÚDO, não
// estrutura — mantidas como constante local (não há token de
// medalha no DS Shoji); não são o acento vermelho genérico.
// ============================================================
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors as C, ShojiPalette as P } from "@/constants/karateTheme";
import { KataScore } from "@/services/karateBracketsApi";
import { styles as S, initials, MiniAvatar } from "./shared";

const MEDALS = ["Ouro", "Prata", "Bronze"];
const MEDAL_COLORS = ["#9a7b1f", "#7d7d7d", "#8a5a2b"];

export function KataView({
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

  return (
    <View>
      <View style={S.sectionHead}>
        <View>
          <Text style={S.cardTitle}>Chave · Kata</Text>
          <Text style={S.cardSub}>{catName} · por bateria — não é confronto 1×1</Text>
        </View>
        <View style={[S.pill, S.pillAccent]}>
          <Text style={[S.pillText, S.pillTextAccent]}>Apurado</Text>
        </View>
      </View>

      <View style={S.infoRow}>
        <Ionicons name="information-circle-outline" size={13} color={C.ink3} />
        <Text style={S.infoText}>
          Cinco jurados; desconsidera a maior e a menor nota. Ordem de apresentação sorteada. Os melhores da eliminatória avançam à final.
        </Text>
      </View>

      <View style={S.kataGrid}>
        {/* Eliminatória */}
        <View style={S.card}>
          <View style={S.kataTableHead}>
            <Text style={S.kataTableTitle}>Eliminatória</Text>
            <Text style={S.kataTableSub}>{elim.length} atletas</Text>
          </View>
          {elim.map((s, i) => (
            <View key={s.entry_id} style={[S.kataRow, i === 0 && S.kataRowFirst]}>
              <Text style={S.kataPos}>{i + 1}</Text>
              <MiniAvatar name={s.student_name} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={S.athleteName} numberOfLines={1}>{s.student_name}</Text>
                <Text style={S.athleteDojo} numberOfLines={1}>{s.dojo_name}</Text>
              </View>
              <Text style={S.kataNota}>{s.nota !== null ? s.nota.toFixed(1).replace(".", ",") : "—"}</Text>
              <View style={[S.pill, s.advances ? S.pillAccent : S.pillNeutral]}>
                <Text style={[S.pillText, s.advances ? S.pillTextAccent : S.pillTextNeutral]}>
                  {s.advances ? "Classificada" : s.advances === false ? "Eliminada" : ""}
                </Text>
              </View>
              <TouchableOpacity onPress={() => onEditScore(s)} style={S.editScoreBtn}>
                <Ionicons name="create-outline" size={15} color={P.red} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Final */}
        {final.length > 0 && (
          <View style={S.card}>
            <View style={S.kataTableHead}>
              <Text style={S.kataTableTitle}>Final</Text>
              <Text style={S.kataTableSub}>{final.length} finalistas · medalhas</Text>
            </View>
            {final.map((s, i) => (
              <View key={s.entry_id} style={[S.kataRow, i === 0 && S.kataRowFirst]}>
                <Text style={[S.kataPos, i < 3 && { fontWeight: "800", color: C.ink }]}>{i + 1}º</Text>
                <MiniAvatar name={s.student_name} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={S.athleteName} numberOfLines={1}>{s.student_name}</Text>
                  <Text style={S.athleteDojo} numberOfLines={1}>{s.dojo_name}</Text>
                </View>
                <Text style={S.kataNota}>{s.nota !== null ? s.nota.toFixed(1).replace(".", ",") : "—"}</Text>
                {i < 3 && (
                  <Text style={[S.medalText, { color: MEDAL_COLORS[i] }]}>{MEDALS[i]}</Text>
                )}
                <TouchableOpacity onPress={() => onEditScore(s)} style={S.editScoreBtn}>
                  <Ionicons name="create-outline" size={15} color={P.red} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
