// ============================================================
// Chaves — SorteioPanel · Shoji
//
// Painel de sorteio (método + opções) e pré-visualização do
// rascunho (DraftMatchCard). Estado/handlers vêm por props do
// orquestrador — este componente é só apresentação. A lógica de
// confrontos (bracket.rounds[0], byes, mesmo dojô) é preservada.
// ============================================================
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P } from "@/constants/karateTheme";
import { ShojiBadge, ShojiButton, Pill } from "@/components/karate/shoji";
import {
  BracketState, BracketMatch, BracketAthleteRef, DrawMethod,
} from "@/services/karateBracketsApi";
import {
  styles as S, ConfigRow, MiniAvatar, ByeText, PendingText,
} from "./shared";

export function SorteioPanel({
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
    <View style={S.grid2}>
      {/* Options card */}
      <View style={S.card}>
        <View style={S.cardHead}>
          <View>
            <Text style={S.cardTitle}>Gerar chave</Text>
            <Text style={S.cardSub}>{catName} · eliminatório simples</Text>
          </View>
          <ShojiBadge status={hasDraft ? "ok" : "neutral"} label={statusLabel} />
        </View>

        <Text style={S.fieldLabel}>Método</Text>
        <View style={S.segRow}>
          {(["ranking", "random"] as DrawMethod[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[S.segBtn, method === m && S.segBtnActive]}
              onPress={() => setMethod(m)}
            >
              <Text style={[S.segBtnText, method === m && S.segBtnTextActive]}>
                {m === "ranking" ? "Sementes por ranking" : "Aleatório"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={S.methodDesc}>
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
          <ShojiButton
            label={generating ? "Gerando..." : "Gerar chave"}
            variant="sumi"
            onPress={onGenerate}
            style={S.fullBtn}
          />
        ) : (
          <View style={S.draftActions}>
            <ShojiButton
              label="Regenerar"
              variant="ghost"
              onPress={onGenerate}
              style={{ flex: 1 }}
            />
            <ShojiButton
              label={locking ? "Travando..." : "Travar chave"}
              variant="sumi"
              onPress={onLock}
              style={{ flex: 1 }}
            />
          </View>
        )}

        {hasDraft && (
          <View style={S.infoRow}>
            <Icon name="info" size={13} color={C.ink3} />
            <Text style={S.infoText}>
              Pode regenerar quantas vezes quiser. Travar torna a chave oficial e libera o lançamento de resultados.
            </Text>
          </View>
        )}
      </View>

      {/* Preview: athletes or draft matches */}
      {hasDraft && bracket ? (
        <View style={S.card}>
          <Text style={S.cardTitle}>Resultado do sorteio</Text>
          <Text style={S.cardSub}>Pré-visualização — confrontos da 1ª rodada</Text>
          <View style={S.pills}>
            <Pill label={`${bracket.athletes_count} atletas`} />
            <Pill label={`${bracket.bye_count} byes`} />
            {bracket.options.thirdPlace && <Pill label="3º lugar: Incluída" />}
          </View>
          {(bracket.rounds[0] || []).map((m, i) => (
            <DraftMatchCard key={m.id} match={m} idx={i + 1} />
          ))}
        </View>
      ) : (
        <View style={S.card}>
          <Text style={S.cardTitle}>Inscritos</Text>
          <Text style={S.cardSub}>Os atletas aparecerão aqui após gerar o sorteio</Text>
          <View style={S.emptyBox}>
            <Icon name="users" size={32} color={C.ink4} />
            <Text style={S.emptyText}>Gere o sorteio para ver os confrontos</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ── DraftMatchCard ────────────────────────────────────────────────────────
function DraftMatchCard({ match, idx }: { match: BracketMatch; idx: number }) {
  const akaRef = match.aka === "bye" ? null : match.aka as BracketAthleteRef | null;
  const shiroRef = match.shiro === "bye" ? null : match.shiro as BracketAthleteRef | null;
  const sameDojo = akaRef && shiroRef && akaRef.dojo_name === shiroRef.dojo_name && akaRef.dojo_name !== null;

  return (
    <View style={[S.matchCard, { marginBottom: 8 }]}>
      <View style={S.matchCardHead}>
        <Text style={S.matchCardIdx}>Chave {idx}</Text>
        {sameDojo && <Text style={S.sameDojoWarn}>mesmo dojô</Text>}
      </View>
      {[{ ref: akaRef, isBye: match.aka === "bye", border: P.red },
        { ref: shiroRef, isBye: match.shiro === "bye", border: C.ink3 }].map(({ ref, isBye, border }, si) => (
        <View key={si} style={[S.matchSide, { borderLeftColor: border }, si === 1 && S.matchSideShiro]}>
          {isBye ? (
            <ByeText />
          ) : ref ? (
            <View style={S.athleteRow}>
              <MiniAvatar name={ref.student_name} />
              <Text style={S.athleteName} numberOfLines={1}>{ref.student_name}</Text>
              <Text style={S.athleteDojo} numberOfLines={1}>{ref.dojo_name}</Text>
            </View>
          ) : (
            <PendingText />
          )}
        </View>
      ))}
    </View>
  );
}
