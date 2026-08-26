// ============================================================
// Chaves — SorteioPanel · Shoji
//
// Painel de sorteio (método + opções) e pré-visualização do
// rascunho (DraftMatchCard). Estado/handlers vêm por props do
// orquestrador — este componente é só apresentação. A lógica de
// confrontos (bracket.rounds[0], byes, mesmo dojô) é preservada.
//
// Exporta TAMBÉM o KataDrawPanel (fim do arquivo): o equivalente
// para as modalidades apuradas por notas (kata/team_kata/enbu),
// onde não se sorteia chave e sim ORDEM DE APRESENTAÇÃO.
// ============================================================
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P } from "@/constants/karateTheme";
import { ShojiBadge, ShojiButton, Pill } from "@/components/karate/shoji";
import {
  BracketState, BracketMatch, BracketAthleteRef, DrawMethod,
} from "@/services/karateBracketsApi";
import {
  styles as S, ConfigRow, MiniAvatar, ByeText, PendingText, SameDojoBadge,
} from "./shared";

// ── Elegibilidade do sorteio (regra de produto) ───────────────────────────
// Só entra na chave quem está com a taxa paga. `eligible` vem do backend
// (eligible_count); em categoria gratuita ele já chega igual a `total`, e em
// backend antigo o chamador cai para `total` — a copy volta a ser a de antes.
// O QA pegou o oposto disso: a pill dizia "2 atletas confirmados" com 1 dos 2
// devendo a taxa. Nada aqui pode chamar de confirmado quem ainda deve.
function drawEligibility(total: number, eligible: number, pending: number) {
  const leftOut = Math.max(0, total - eligible);
  const canDraw = eligible >= 2;
  const countLabel = leftOut > 0
    ? `${eligible} de ${total} inscritos entram na chave`
    : eligible === 1
      ? "1 atleta entra na chave"
      : `${eligible} atletas entram na chave`;
  const blockedReason = eligible === 0
    ? pending > 0
      ? `Nenhum inscrito está com a taxa paga. ${pending} inscrito${pending > 1 ? "s" : ""} ${pending > 1 ? "entram" : "entra"} na chave depois que a federação confirmar o pagamento.`
      : "Nenhum atleta inscrito nesta categoria até agora."
    : pending > 0
      ? `Só 1 inscrito está com a taxa paga — o sorteio precisa de pelo menos 2. ${pending > 1 ? `Os outros ${pending} entram` : "O outro entra"} assim que a federação confirmar o pagamento.`
      : "Só 1 atleta inscrito — o sorteio precisa de pelo menos 2.";
  const blockedIcon = pending > 0 ? "clock" : "users";
  return { canDraw, countLabel, blockedReason, blockedIcon, leftOut };
}

export function SorteioPanel({
  method, setMethod, separateSameDojo, setSeparateSameDojo,
  thirdPlace, setThirdPlace, bracket, catName, generating, locking,
  athletesCount = 0, eligibleCount = 0, pendingPayment = 0,
  onGenerate, onLock,
}: {
  method: DrawMethod; setMethod: (m: DrawMethod) => void;
  separateSameDojo: boolean; setSeparateSameDojo: (v: boolean) => void;
  thirdPlace: boolean; setThirdPlace: (v: boolean) => void;
  bracket: BracketState | null; catName: string;
  generating: boolean; locking: boolean;
  /** TODOS os inscritos não-desistentes (athletes_count). */
  athletesCount?: number;
  /** Os que de fato entram no sorteio — taxa paga (eligible_count). */
  eligibleCount?: number;
  /** Inscritos aguardando confirmação de pagamento pela federação. */
  pendingPayment?: number;
  onGenerate: () => void; onLock: () => void;
}) {
  const hasDraft = bracket?.status === "draft";
  const statusLabel = hasDraft ? "Pré-visualização gerada" : "Chave não gerada";
  const el = drawEligibility(athletesCount, eligibleCount, pendingPayment);

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

        {/* Contagem honesta ANTES de sortear: quem entra, e quantos ficaram
            de fora por taxa pendente. */}
        {!hasDraft && athletesCount > 0 && (
          <View style={S.pills}>
            <Pill label={el.countLabel} accent={el.leftOut > 0} />
          </View>
        )}

        {!hasDraft && !el.canDraw && (
          <View style={S.infoRow}>
            <Icon name={el.blockedIcon} size={13} color={C.ink3} />
            <Text style={S.infoText}>{el.blockedReason}</Text>
          </View>
        )}

        {!hasDraft ? (
          <View
            style={el.canDraw ? undefined : K.actionDisabled}
            pointerEvents={el.canDraw && !generating ? "auto" : "none"}
            accessibilityState={{ disabled: !el.canDraw }}
          >
            <ShojiButton
              label={generating ? "Gerando..." : "Gerar chave"}
              variant="sumi"
              onPress={onGenerate}
              style={S.fullBtn}
            />
          </View>
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

// ── KataDrawPanel (kata / team_kata / enbu, chave ainda não gerada) ───────
// Em kata não se "sorteia chave": sorteia-se a ORDEM DE APRESENTAÇÃO da
// bateria. Por isso este bloco NÃO reaproveita o SorteioPanel acima — todas
// as opções dele (método de chaveamento, separar mesmo dojô, disputa de 3º
// lugar) são de kumite, e o backend as ignora nas modalidades por notas:
// lá só o seed é usado. Mesmo skin Shoji, apenas com o que é verdade aqui.
export function KataDrawPanel({
  catName, athletesCount, eligibleCount, pendingPayment, generating, onGenerate,
}: {
  catName: string;
  /** TODOS os inscritos não-desistentes (athletes_count). */
  athletesCount: number;
  /** Os que de fato entram na bateria — taxa paga (eligible_count). */
  eligibleCount: number;
  /** Inscritos ainda aguardando confirmação de pagamento pela federação. */
  pendingPayment: number;
  generating: boolean;
  onGenerate: () => void;
}) {
  const el = drawEligibility(athletesCount, eligibleCount, pendingPayment);
  // Estado vazio honesto: o texto diz o motivo REAL de não dar para sortear.
  const helper = el.canDraw
    ? "O sorteio define a ordem em que os atletas se apresentam na eliminatória. Depois de sortear, a ordem pode ser ajustada à mão em \"Ordem de apresentação\"."
    : el.blockedReason;
  const helperIcon = el.canDraw ? "info" : el.blockedIcon;

  return (
    <View style={[S.card, K.card]}>
      <View style={S.cardHead}>
        <View style={K.headText}>
          <Text style={S.cardTitle}>Ordem de apresentação</Text>
          <Text style={S.cardSub}>{catName} · apuração por notas</Text>
        </View>
        <ShojiBadge status="neutral" label="Chave não gerada" />
      </View>

      {athletesCount > 0 && (
        <View style={S.pills}>
          <Pill label={el.countLabel} accent={el.leftOut > 0} />
        </View>
      )}

      <View style={S.infoRow}>
        <Icon name={helperIcon} size={13} color={C.ink3} />
        <Text style={S.infoText}>{helper}</Text>
      </View>

      <View
        style={[K.action, !el.canDraw && K.actionDisabled]}
        pointerEvents={el.canDraw && !generating ? "auto" : "none"}
        accessibilityState={{ disabled: !el.canDraw }}
      >
        <ShojiButton
          label={generating ? "Sorteando..." : "Sortear ordem de apresentação"}
          icon="list"
          variant="sumi"
          onPress={onGenerate}
        />
      </View>
    </View>
  );
}

// Largura máxima: bloco de ação lê melhor em coluna estreita; o botão é
// dimensionado pelo conteúdo (alignSelf), nunca esticado na tela.
const K = StyleSheet.create({
  card: { maxWidth: 560 } as ViewStyle,
  headText: { flex: 1, minWidth: 0, paddingRight: 8 } as ViewStyle,
  action: { alignSelf: "flex-start", marginTop: 2 } as ViewStyle,
  actionDisabled: { opacity: 0.45 } as ViewStyle,
});

// ── DraftMatchCard ────────────────────────────────────────────────────────
function DraftMatchCard({ match, idx }: { match: BracketMatch; idx: number }) {
  const akaRef = match.aka === "bye" ? null : match.aka as BracketAthleteRef | null;
  const shiroRef = match.shiro === "bye" ? null : match.shiro as BracketAthleteRef | null;
  const sameDojo = akaRef && shiroRef && akaRef.dojo_name === shiroRef.dojo_name && akaRef.dojo_name !== null;

  return (
    <View style={[S.matchCard, { marginBottom: 8 }]}>
      <View style={S.matchCardHead}>
        <Text style={S.matchCardIdx}>Chave {idx}</Text>
        {sameDojo && <SameDojoBadge compact />}
      </View>
      {[{ ref: akaRef, isBye: match.aka === "bye", border: P.red },
        { ref: shiroRef, isBye: match.shiro === "bye", border: C.ink3 }].map(({ ref, isBye, border }, si) => (
        <View key={si} style={[S.matchSide, { borderLeftColor: border }, si === 1 && S.matchSideShiro]}>
          {isBye ? (
            <ByeText />
          ) : ref ? (
            <View style={S.athleteRow}>
              <MiniAvatar name={ref.student_name} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={S.athleteName} numberOfLines={1}>{ref.student_name}</Text>
                <Text style={S.athleteDojo} numberOfLines={2}>{ref.dojo_name}</Text>
              </View>
            </View>
          ) : (
            <PendingText />
          )}
        </View>
      ))}
    </View>
  );
}
