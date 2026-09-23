// ============================================================
// AURA. — Matcon: a esteira (M1)
//
// 22/09/2026. Peça compartilhada pelas DUAS esteiras do Matcon:
// /matcon/orcamentos (Abertos → Vencendo → Aprovados → Perdidos) e, em
// seguida, /matcon/entregas (Separando → Pronto → Saiu → Entregue hoje).
// Por isso nada aqui sabe o que é um orçamento: a estação é só
// { rótulo, contagem, dinheiro, tom } e o card é um container.
//
// Mockup aprovado: docs/mockups/matcon-modulo.html (.rail/.st, .card,
// .acts, .empty) e o molde de código da casa é o Laboratório da Ótica
// (app/(tabs)/otica/index.tsx). Matcon NÃO tem paleta própria — tokens de
// Colors/Fonts do shell de varejo, violeta (§4 do faseamento).
//
// Três regras de desenho que este arquivo existe para garantir:
//   1. A esteira mostra O DINHEIRO parado em cada estação, não só a
//      contagem (§4b regra 2) — é o número que faz o dono abrir a tela.
//   2. Regra 7 do CLAUDE.md: nada de hover-reveal. As ações do card ficam
//      SEMPRE visíveis, no desktop e no toque.
//   3. No celular a esteira vira coluna rolável horizontal com snap
//      (estação a ~62% da largura, sem as setas "›"); a PÁGINA continua
//      sem rolar de lado.
// ============================================================
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, useWindowDimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";

// Mesmo ponto de quebra do mockup (@media max-width: 860px).
const BP_ESTREITO = 860;
const GAP = 8;

export type EsteiraTom = "violet" | "amber" | "green" | "muted";

export type EsteiraEstacao = {
  key: string;
  label: string;
  /** null enquanto o resumo não chegou — a estação mostra "–" e não zero. */
  count: number | null;
  /** Número grande já formatado no lugar da contagem (ex.: "R$ 12.480"),
   *  para a estação cujo número é dinheiro. Ganha de `count`. */
  valorPrincipal?: string | null;
  /** Dinheiro parado na estação, já formatado ("R$ 18.400"). */
  money?: string | null;
  tone?: EsteiraTom;
  active?: boolean;
  onPress?: () => void;
};

const COR_DO_TOM: Record<EsteiraTom, string> = {
  violet: Colors.violet3,
  amber: Colors.amber,
  green: Colors.green,
  muted: Colors.ink3,
};

export function EsteiraMatcon({ stations, testID }: { stations: EsteiraEstacao[]; testID?: string }) {
  const { width } = useWindowDimensions();
  const estreito = width > 0 && width < BP_ESTREITO;
  const larguraEstacao = estreito ? Math.round(width * 0.62) : 0;

  const estacoes = stations.map((s, i) => (
    <Estacao
      key={s.key}
      estacao={s}
      ultima={i === stations.length - 1}
      estreito={estreito}
      largura={larguraEstacao}
    />
  ));

  if (estreito) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Snap na largura da estação + o respiro entre elas: o dedo para
        // sempre com uma estação inteira na tela.
        snapToInterval={larguraEstacao + GAP}
        decelerationRate="fast"
        contentContainerStyle={st.railMobile}
        style={st.railMobileWrap}
        testID={testID}
      >
        {estacoes}
      </ScrollView>
    );
  }

  return <View style={st.rail} testID={testID}>{estacoes}</View>;
}

function Estacao({ estacao, ultima, estreito, largura }: {
  estacao: EsteiraEstacao;
  ultima: boolean;
  estreito: boolean;
  largura: number;
}) {
  const tom = estacao.tone || "violet";
  const cor = COR_DO_TOM[tom];
  const conteudo = (
    <>
      <Text style={[st.estN, tom !== "violet" && { color: cor }]}>
        {estacao.valorPrincipal ? estacao.valorPrincipal : estacao.count === null ? "–" : estacao.count}
      </Text>
      <Text style={st.estL} numberOfLines={2}>{estacao.label}</Text>
      {!!estacao.money && (
        <Text style={[st.estMoney, tom === "amber" && { color: Colors.amber }]}>{estacao.money}</Text>
      )}
      {/* A seta só existe no desktop: no celular a rolagem já conta a história. */}
      {!estreito && !ultima && <Text style={st.estSeta}>›</Text>}
    </>
  );

  const estilo = [
    st.est,
    estreito ? { width: largura, flexGrow: 0, flexBasis: "auto" as const } : null,
    tom === "amber" && st.estAmber,
    tom === "green" && st.estGreen,
    estacao.active && st.estAtiva,
  ];

  if (!estacao.onPress) {
    return <View style={estilo} testID={`matcon-estacao-${estacao.key}`}>{conteudo}</View>;
  }
  return (
    <Pressable
      onPress={estacao.onPress}
      style={estilo}
      accessibilityRole="button"
      accessibilityLabel={`${estacao.label}: ${estacao.valorPrincipal || (estacao.count === null ? "sem número" : estacao.count)}`}
      testID={`matcon-estacao-${estacao.key}`}
    >
      {conteudo}
    </Pressable>
  );
}

/**
 * O card da esteira. `tone` pinta a faixa lateral (o "▲ vencendo" de
 * verdade é texto, no conteúdo — cor sozinha não informa). `actions`
 * renderiza SEMPRE, sem hover (regra 7).
 */
export function EsteiraCard({ tone, dim, right, actions, children, onPress, testID }: {
  tone?: "amber" | "red" | "violet" | "green";
  /** Card de coisa encerrada (perdido, entregue): o cartão inteiro recua. */
  dim?: boolean;
  /** Coluna da direita: selo e dinheiro, acima das ações. */
  right?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  const { width } = useWindowDimensions();
  const estreito = width > 0 && width < BP_ESTREITO;
  const corDaFaixa = tone === "amber" ? Colors.amber
    : tone === "red" ? Colors.red
      : tone === "green" ? Colors.green
        : tone === "violet" ? Colors.violet : null;

  const corpo = (
    <>
      <View style={st.cardMain}>{children}</View>
      <View style={[st.cardRight, estreito && st.cardRightMobile]}>
        {right}
        {!!actions && (
          <View style={[st.acts, estreito && st.actsMobile]} testID={testID ? `${testID}-acoes` : undefined}>
            {actions}
          </View>
        )}
      </View>
    </>
  );

  const estilo = [
    st.card,
    estreito && st.cardMobile,
    !!corDaFaixa && { borderLeftWidth: 3, borderLeftColor: corDaFaixa },
    dim && st.cardDim,
  ];

  if (!onPress) return <View style={estilo} testID={testID}>{corpo}</View>;
  return <Pressable onPress={onPress} style={estilo} testID={testID}>{corpo}</Pressable>;
}

/**
 * Esteira vazia: título serifado + UMA frase que nomeia o botão do
 * próximo passo (§4b regra 5 — "primeiro dia sem tela vazia"). A frase é
 * ReactNode para o nome do botão sair destacado no meio dela.
 */
export function EsteiraVazia({ titulo, frase, acao, testID }: {
  titulo: string;
  frase: React.ReactNode;
  acao?: React.ReactNode;
  testID?: string;
}) {
  return (
    <View style={st.vazia} testID={testID}>
      <Text style={st.vaziaTitulo}>{titulo}</Text>
      <Text style={st.vaziaFrase}>{frase}</Text>
      {!!acao && <View style={st.vaziaAcao}>{acao}</View>}
    </View>
  );
}

/**
 * A chamada falhou (QA 23/09/2026): nunca mostrar a lista vazia no lugar
 * do erro. Título diz O QUE não carregou; a frase diz o que fazer; o botão
 * "Tentar de novo" fica sempre visível (regra 7, nada de hover).
 */
export function EsteiraErro({ titulo, frase, onTentarDeNovo, tentando, testID }: {
  titulo: string;
  frase: string;
  onTentarDeNovo: () => void;
  tentando?: boolean;
  testID?: string;
}) {
  return (
    <View style={[st.vazia, st.erro]} testID={testID} accessibilityRole="alert">
      <Text style={st.erroTitulo}>{titulo}</Text>
      <Text style={st.vaziaFrase}>{frase}</Text>
      <Pressable
        onPress={tentando ? undefined : onTentarDeNovo}
        disabled={!!tentando}
        style={[st.erroBtn, tentando && { opacity: 0.6 }]}
        accessibilityRole="button"
        testID={testID ? `${testID}-tentar` : undefined}
      >
        {tentando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={st.erroBtnTexto}>Tentar de novo</Text>}
      </Pressable>
    </View>
  );
}

/** Palavra destacada dentro da frase do estado vazio ("Orçamento"). */
export function EsteiraVaziaDestaque({ children }: { children: React.ReactNode }) {
  return <Text style={st.vaziaDestaque}>{children}</Text>;
}

const st = StyleSheet.create({
  rail: { flexDirection: "row", gap: GAP, marginTop: 6, marginBottom: 18 },
  railMobileWrap: { marginTop: 6, marginBottom: 18, marginHorizontal: -16 },
  railMobile: { gap: GAP, paddingHorizontal: 16, paddingBottom: 4 },

  est: {
    flexGrow: 1, flexBasis: 0, minWidth: 0,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, position: "relative",
  },
  estAtiva: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  estAmber: { borderColor: Colors.amber + "73" },
  estGreen: { borderColor: Colors.green + "66" },
  estN: { fontFamily: Fonts.heading, fontSize: 34, lineHeight: 36, color: Colors.ink },
  estL: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: Colors.ink3, marginTop: 6 },
  estMoney: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.ink2, marginTop: 6 },
  estSeta: { position: "absolute", right: -7, top: "42%", color: Colors.ink3, fontSize: 18 },

  card: {
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    padding: 14, flexDirection: "row", gap: 12, alignItems: "flex-start",
  },
  cardMobile: { flexDirection: "column", alignItems: "stretch" },
  cardDim: { opacity: 0.72 },
  cardMain: { flex: 1, minWidth: 0 },
  cardRight: { alignItems: "flex-end", gap: 8, minWidth: 0 },
  cardRightMobile: { alignItems: "stretch", width: "100%" },

  // Regra 7: visíveis sempre, no desktop e no toque.
  acts: { flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "100%" },
  actsMobile: { justifyContent: "flex-start", width: "100%" },

  vazia: { borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border2, borderRadius: 14, paddingVertical: 26, paddingHorizontal: 18, alignItems: "center", gap: 6 },
  vaziaTitulo: { fontFamily: Fonts.heading, fontSize: 24, color: Colors.ink, textAlign: "center" },
  vaziaFrase: { fontSize: 13, color: Colors.ink2, textAlign: "center", maxWidth: 420, lineHeight: 19 },
  vaziaDestaque: { color: Colors.violet3, fontWeight: "700" },
  vaziaAcao: { marginTop: 8 },

  erro: { borderStyle: "solid", borderColor: Colors.amber + "73", backgroundColor: Colors.amberD },
  erroTitulo: { fontSize: 16, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  erroBtn: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", minWidth: 150, backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  erroBtnTexto: { fontSize: 13, color: "#fff", fontWeight: "700" },
});
