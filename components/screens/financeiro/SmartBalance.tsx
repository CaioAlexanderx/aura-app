import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { fmt } from "./types";

type Props = {
  income: number;
  expenses: number;
  balance: number;
  txCount: number;
  period: string;
};

export function SmartBalance({ income, expenses, balance, txCount, period }: Props) {
  const w = Platform.OS === "web";
  const healthy = balance > 0;
  const pct = income > 0 ? Math.round((expenses / income) * 100) : 0;
  const barWidth = Math.min(pct, 100);

  // Health status
  const healthLabel = pct <= 50 ? "Excelente" : pct <= 70 ? "Saudavel" : pct <= 90 ? "Atencao" : "Critico";
  const healthColor = pct <= 50 ? Colors.green : pct <= 70 ? Colors.green : pct <= 90 ? Colors.amber : Colors.red;
  const healthBg = pct <= 50 ? Colors.greenD : pct <= 70 ? Colors.greenD : pct <= 90 ? Colors.amberD : Colors.redD;

  // Smart message
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
        <Text style={s.period}>{period}</Text>
        <View style={[s.healthBadge, { backgroundColor: healthBg }]}>
          <View style={[s.healthDot, { backgroundColor: healthColor }]} />
          <Text style={[s.healthText, { color: healthColor }]}>{healthLabel}</Text>
        </View>
      </View>

      {/* Balance hero */}
      <Text style={s.balanceLabel}>Saldo disponivel</Text>
      <Text style={[s.balanceValue, { color: healthy ? Colors.green : Colors.red }]}>{fmt(balance)}</Text>

      {/* Smart message */}
      <Text style={s.message}>{message}</Text>

      {/* Income / Expenses bar */}
      <View style={s.barSection}>
        <View style={s.barRow}>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${barWidth}%`, backgroundColor: pct > 90 ? Colors.red : pct > 70 ? Colors.amber : Colors.violet }]} />
          </View>
          <Text style={[s.barPct, { color: healthColor }]}>{pct}%</Text>
        </View>
        <Text style={s.barHint}>despesas / receitas</Text>
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        <View style={s.stat}>
          <Text style={s.statLabel}>Entradas</Text>
          <Text style={[s.statValue, { color: Colors.green }]}>{fmt(income)}</Text>
        </View>
        <View style={[s.stat, s.statBorder]}>
          <Text style={s.statLabel}>Saidas</Text>
          <Text style={[s.statValue, { color: Colors.red }]}>{fmt(expenses)}</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statLabel}>Lancamentos</Text>
          <Text style={s.statValue}>{txCount}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.border2, marginBottom: 20 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  period: { fontSize: 12, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },
  healthBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  healthDot: { width: 8, height: 8, borderRadius: 4 },
  healthText: { fontSize: 11, fontWeight: "700" },
  balanceLabel: { fontSize: 12, color: Colors.ink3, marginBottom: 4 },
  balanceValue: { fontSize: 36, fontWeight: "800", letterSpacing: -1, marginBottom: 8 },
  message: { fontSize: 13, color: Colors.ink3, lineHeight: 20, marginBottom: 20 },
  barSection: { marginBottom: 20 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  barTrack: { flex: 1, height: 10, backgroundColor: Colors.bg4, borderRadius: 5, overflow: "hidden" },
  barFill: { height: 10, borderRadius: 5 },
  barPct: { fontSize: 13, fontWeight: "700", width: 40, textAlign: "right" },
  barHint: { fontSize: 10, color: Colors.ink3, marginTop: 4 },
  statsRow: { flexDirection: "row" },
  stat: { flex: 1, alignItems: "center", paddingVertical: 12 },
  statBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border },
  statLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: "800", color: Colors.ink },
});

export default SmartBalance;
