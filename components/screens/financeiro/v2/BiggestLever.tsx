// components/screens/financeiro/v2/BiggestLever.tsx
//
// Banner de "Maior alavanca" — destaca a acao com maior impacto no caixa.
// Hoje so identifica "cobrar atrasados". Em ondas futuras pode incluir
// cortar despesa anomala, antecipar recebiveis, etc.

import { View, Text, StyleSheet, Pressable, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type { FinancialInsights } from "./types";

var W = Dimensions.get("window").width;
var NARROW = W < 480;
var isWeb = Platform.OS === "web";

type Props = {
  insights: FinancialInsights;
  onCta?: () => void; // navega pra Lancamentos com filtro de atrasados
};

export function BiggestLever({ insights, onCta }: Props) {
  var lever = insights.biggest_lever;

  // Sem alavanca = sem atrasados (parabens) — mostra um estado positivo
  if (!lever) {
    return (
      <View style={[s.card, s.cardOk, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
        <View style={[s.iconBox, { backgroundColor: Colors.greenD }]}>
          <Icon name="check" size={20} color={Colors.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.kickerOk}>SEM ALAVANCA URGENTE</Text>
          <Text style={[s.headlineOk, { color: Colors.ink }]}>
            Voce esta em dia com cobrancas e despesas
          </Text>
          <Text style={[s.subline, { color: Colors.ink3 }]}>
            Nenhuma conta atrasada por aqui. Continue acompanhando os indicadores.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onCta}
      style={({ hovered, pressed }: any) => [
        s.card,
        s.cardWarn,
        { backgroundColor: Colors.bg3, borderColor: Colors.amber + "55" },
        isWeb && hovered ? { transform: [{ translateY: -1 }], borderColor: Colors.amber } : null,
        pressed ? { opacity: 0.92 } : null,
        isWeb ? ({ transition: "all 0.2s ease", cursor: "pointer" } as any) : null,
      ]}
    >
      {/* Faixa decorativa amber no topo */}
      <View style={[s.topAccent, { backgroundColor: Colors.amber }]} />

      <View style={NARROW ? s.bodyNarrow : s.body}>
        <View style={[s.iconBox, { backgroundColor: Colors.amberD }]}>
          <Icon name="alert" size={20} color={Colors.amber} />
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <View style={s.kickerRow}>
            <Text style={[s.kicker, { color: Colors.amber }]}>MAIOR ALAVANCA · ESTA SEMANA</Text>
          </View>
          <Text style={[s.headline, { color: Colors.ink }]}>{lever.headline}</Text>

          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statLabel}>Contas atrasadas</Text>
              <Text style={[s.statVal, { color: Colors.ink }]}>{lever.count}</Text>
            </View>
            {lever.oldest_days != null && lever.oldest_days > 0 && (
              <View style={[s.stat, { borderLeftWidth: 1, borderLeftColor: Colors.border, paddingLeft: 12 }]}>
                <Text style={s.statLabel}>Mais antiga</Text>
                <Text style={[s.statVal, { color: Colors.ink }]}>{lever.oldest_days}d</Text>
              </View>
            )}
            <View style={[s.stat, { borderLeftWidth: 1, borderLeftColor: Colors.border, paddingLeft: 12 }]}>
              <Text style={s.statLabel}>Impacto</Text>
              <Text style={[s.statVal, { color: Colors.green }]}>+{lever.impact_days}d</Text>
            </View>
          </View>
        </View>

        {!NARROW && (
          <View style={s.ctaWrap}>
            <View style={[s.ctaBtn, { backgroundColor: Colors.violet }]}>
              <Text style={s.ctaText}>Ver atrasadas</Text>
              <Icon name="chevron_right" size={14} color="#fff" />
            </View>
          </View>
        )}
      </View>

      {NARROW && (
        <View style={[s.ctaBtn, s.ctaFull, { backgroundColor: Colors.violet }]}>
          <Text style={s.ctaText}>Ver atrasadas</Text>
          <Icon name="chevron_right" size={14} color="#fff" />
        </View>
      )}
    </Pressable>
  );
}

var s = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
    position: "relative",
  },
  cardWarn: {},
  cardOk: { flexDirection: "row", alignItems: "center", gap: 14 },
  topAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.85,
  },
  body: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 6,
  },
  bodyNarrow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 6,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  kicker: { fontSize: 9.5, fontWeight: "700", letterSpacing: 1.2 },
  kickerOk: { fontSize: 9.5, color: Colors.ink3, letterSpacing: 1.2, fontWeight: "600", textTransform: "uppercase" },
  headline: { fontSize: NARROW ? 15 : 17, fontWeight: "700", letterSpacing: -0.3, lineHeight: NARROW ? 20 : 22 },
  headlineOk: { fontSize: 14, fontWeight: "600" },
  subline: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  stat: { flex: 0 },
  statLabel: { fontSize: 9, color: Colors.ink3, letterSpacing: 0.5, fontWeight: "600", textTransform: "uppercase", marginBottom: 2 },
  statVal: { fontSize: 13, fontWeight: "800" },
  ctaWrap: { paddingLeft: 8 },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ctaFull: { marginTop: 12, justifyContent: "center" },
  ctaText: { color: "#fff", fontSize: 12.5, fontWeight: "700" },
});

export default BiggestLever;
