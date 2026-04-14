import { View, Text, StyleSheet, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { fmt, fmtK } from "./types";
import type { PeriodKey } from "./types";
import { getPeriodRange } from "./types";

const W = Dimensions.get("window").width;
const NARROW = W < 480;
const isWeb = Platform.OS === "web";

type Props = {
  income: number;
  expenses: number;
  balance: number;
  txCount: number;
  period: PeriodKey;
};

export function SmartBalance({ income, expenses, balance, txCount, period }: Props) {
  const healthy = balance > 0;
  const pct = income > 0 ? Math.round((expenses / income) * 100) : 0;
  const barWidth = Math.min(pct, 100);
  const { label: periodLabel } = getPeriodRange(period);

  const healthLabel = pct <= 50 ? "Excelente" : pct <= 70 ? "Saudavel" : pct <= 90 ? "Atencao" : "Critico";
  const healthColor = pct <= 50 ? Colors.green : pct <= 70 ? Colors.green : pct <= 90 ? Colors.amber : Colors.red;
  const healthBg = pct <= 50 ? Colors.greenD : pct <= 70 ? Colors.greenD : pct <= 90 ? Colors.amberD : Colors.redD;

  const margin = income > 0 ? Math.round((balance / income) * 100) : 0;

  return (
    <View style={[s.card, isWeb && { transition: "all 0.3s ease" } as any]}>
      {/* Period + Health */}
      <View style={s.topRow}>
        <Text style={s.period}>{periodLabel}</Text>
        <View style={[s.healthBadge, { backgroundColor: healthBg }]}>
          <View style={[s.healthDot, { backgroundColor: healthColor }]} />
          <Text style={[s.healthText, { color: healthColor }]}>{healthLabel}</Text>
        </View>
      </View>

      {/* Balance hero */}
      <Text style={s.balanceLabel}>Saldo do periodo</Text>
      <Text style={[s.balanceValue, { color: healthy ? Colors.green : Colors.red, fontSize: NARROW ? 28 : 38 }]}>
        {fmt(balance)}
      </Text>

      {/* Margin badge */}
      {income > 0 && (
        <View style={[s.marginBadge, { backgroundColor: margin >= 20 ? Colors.greenD : margin >= 0 ? Colors.amberD : Colors.redD }]}>
          <Text style={[s.marginText, { color: margin >= 20 ? Colors.green : margin >= 0 ? Colors.amber : Colors.red }]}>
            Margem: {margin}%
          </Text>
        </View>
      )}

      {/* Progress bar */}
      <View style={s.barSection}>
        <View style={s.barRow}>
          <View style={s.barTrack}>
            <View style={[
              s.barFill,
              { width: barWidth + "%", backgroundColor: pct > 90 ? Colors.red : pct > 70 ? Colors.amber : Colors.violet },
              isWeb && { transition: "width 0.6s ease" } as any
            ]} />
          </View>
          <Text style={[s.barPct, { color: healthColor }]}>{pct}%</Text>
        </View>
        <Text style={s.barHint}>despesas / receitas</Text>
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        <View style={s.stat}>
          <Text style={s.statLabel}>Entradas</Text>
          <Text style={[s.statValue, { color: Colors.green }]} numberOfLines={1}>
            {NARROW ? fmtK(income) : fmt(income)}
          </Text>
          <Text style={s.statCount}>{txCount > 0 ? txCount + " lanc." : ""}</Text>
        </View>
        <View style={[s.stat, s.statBorder]}>
          <Text style={s.statLabel}>Saidas</Text>
          <Text style={[s.statValue, { color: Colors.red }]} numberOfLines={1}>
            {NARROW ? fmtK(expenses) : fmt(expenses)}
          </Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statLabel}>Resultado</Text>
          <Text style={[s.statValue, { color: healthy ? Colors.green : Colors.red }]} numberOfLines={1}>
            {healthy ? "+" : ""}{NARROW ? fmtK(balance) : fmt(balance)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg3,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: Colors.border2,
    marginBottom: 20,
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 8 },
  period: { fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, flex: 1 },
  healthBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, flexShrink: 0 },
  healthDot: { width: 7, height: 7, borderRadius: 4 },
  healthText: { fontSize: 11, fontWeight: "700" },
  balanceLabel: { fontSize: 11, color: Colors.ink3, marginBottom: 2, letterSpacing: 0.3 },
  balanceValue: { fontWeight: "800", letterSpacing: -1, marginBottom: 8 },
  marginBadge: { alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 16 },
  marginText: { fontSize: 11, fontWeight: "700" },
  barSection: { marginBottom: 18 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  barTrack: { flex: 1, height: 6, backgroundColor: Colors.bg4, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  barPct: { fontSize: 12, fontWeight: "700", width: 36, textAlign: "right" },
  barHint: { fontSize: 9, color: Colors.ink3, marginTop: 3 },
  statsRow: { flexDirection: "row", backgroundColor: Colors.bg, borderRadius: 14, padding: 4 },
  stat: { flex: 1, alignItems: "center", paddingVertical: 12 },
  statBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border },
  statLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: "800", color: Colors.ink },
  statCount: { fontSize: 9, color: Colors.ink3, marginTop: 2 },
});

export default SmartBalance;
