import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { fmt } from "./types";

// Responsive check — safe fora do StyleSheet
const W = Dimensions.get("window").width;
const NARROW = W < 480;

type Props = {
  income: number;
  expenses: number;
  balance: number;
  txCount: number;
  period: string;
};

export function SmartBalance({ income, expenses, balance, txCount, period }: Props) {
  const healthy = balance > 0;
  const pct = income > 0 ? Math.round((expenses / income) * 100) : 0;
  const barWidth = Math.min(pct, 100);

  const healthLabel = pct <= 50 ? "Excelente" : pct <= 70 ? "Saudavel" : pct <= 90 ? "Atencao" : "Critico";
  const healthColor = pct <= 50 ? Colors.green : pct <= 70 ? Colors.green : pct <= 90 ? Colors.amber : Colors.red;
  const healthBg = pct <= 50 ? Colors.greenD : pct <= 70 ? Colors.greenD : pct <= 90 ? Colors.amberD : Colors.redD;

  const message = balance <= 0
    ? "Suas despesas superaram as receitas neste periodo."
    : pct >= 90
    ? `Atencao: ${pct}% da receita ja foi comprometida com despesas.`
    : pct >= 70
    ? `Voce pode usar ${fmt(balance)} hoje sem pressionar o caixa.`
    : `Seu caixa esta saudavel. ${fmt(balance)} disponiveis.`;

  return (
    <View style={s.card}>
      {/* Period + Health badge */}
      <View style={s.topRow}>
        <Text style={s.period} numberOfLines={1}>{period}</Text>
        <View style={[s.healthBadge, { backgroundColor: healthBg }]}>
          <View style={[s.healthDot, { backgroundColor: healthColor }]} />
          <Text style={[s.healthText, { color: healthColor }]}>{healthLabel}</Text>
        </View>
      </View>

      {/* Balance hero — smaller font on mobile */}
      <Text style={s.balanceLabel}>Saldo disponivel</Text>
      <Text style={[s.balanceValue, { color: healthy ? Colors.green : Colors.red, fontSize: NARROW ? 26 : 36 }]}>
        {fmt(balance)}
      </Text>

      <Text style={s.message}>{message}</Text>

      {/* Progress bar */}
      <View style={s.barSection}>
        <View style={s.barRow}>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${barWidth}%`, backgroundColor: pct > 90 ? Colors.red : pct > 70 ? Colors.amber : Colors.violet }]} />
          </View>
          <Text style={[s.barPct, { color: healthColor }]}>{pct}%</Text>
        </View>
        <Text style={s.barHint}>despesas / receitas</Text>
      </View>

      {/* N4 fix: Stats row com font responsiva */}
      <View style={s.statsRow}>
        <View style={s.stat}>
          <Text style={s.statLabel}>Entradas</Text>
          <Text style={[s.statValue, { color: Colors.green, fontSize: NARROW ? 12 : 16 }]} numberOfLines={1}>
            {fmt(income)}
          </Text>
        </View>
        <View style={[s.stat, s.statBorder]}>
          <Text style={s.statLabel}>Saidas</Text>
          <Text style={[s.statValue, { color: Colors.red, fontSize: NARROW ? 12 : 16 }]} numberOfLines={1}>
            {fmt(expenses)}
          </Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statLabel}>Lancamentos</Text>
          <Text style={[s.statValue, { fontSize: NARROW ? 12 : 16 }]} numberOfLines={1}>
            {txCount}
          </Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 20 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "nowrap", gap: 8 },
  period: { fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, flex: 1 },
  healthBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, flexShrink: 0 },
  healthDot: { width: 8, height: 8, borderRadius: 4 },
  healthText: { fontSize: 11, fontWeight: "700" },
  balanceLabel: { fontSize: 12, color: Colors.ink3, marginBottom: 4 },
  balanceValue: { fontWeight: "800", letterSpacing: -1, marginBottom: 8 },
  message: { fontSize: 12, color: Colors.ink3, lineHeight: 18, marginBottom: 16 },
  barSection: { marginBottom: 16 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  barTrack: { flex: 1, height: 8, backgroundColor: Colors.bg4, borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  barPct: { fontSize: 12, fontWeight: "700", width: 36, textAlign: "right" },
  barHint: { fontSize: 10, color: Colors.ink3, marginTop: 4 },
  statsRow: { flexDirection: "row" },
  stat: { flex: 1, alignItems: "center", paddingVertical: 10 },
  statBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border },
  statLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  statValue: { fontWeight: "800", color: Colors.ink },
});

export default SmartBalance;
