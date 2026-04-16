import { View, Text, StyleSheet, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { fmt, fmtK } from "./types";
import type { PeriodKey, Transaction } from "./types";
import { getPeriodRange } from "./types";
import { useMemo } from "react";

const W = Dimensions.get("window").width;
const NARROW = W < 480;
const isWeb = Platform.OS === "web";

type Summary = { income: number; expenses: number; balance: number };

type Props = {
  income: number;
  expenses: number;
  balance: number;
  txCount: number;
  period: PeriodKey;
  customStart?: string;
  customEnd?: string;
  previousSummary?: Summary | null;
  transactions?: Transaction[];
};

function delta(cur: number, prev: number): number | null {
  if (prev === 0 && cur === 0) return null;
  if (prev === 0) return cur > 0 ? 100 : -100;
  return Math.round(((cur - prev) / Math.abs(prev)) * 100);
}

function DeltaBadge({ value, invert }: { value: number | null; invert?: boolean }) {
  if (value === null) return null;
  var up = invert ? value < 0 : value > 0;
  var color = up ? Colors.green : value === 0 ? Colors.ink3 : Colors.red;
  var bg = up ? Colors.greenD : value === 0 ? Colors.bg4 : Colors.redD;
  var arrow = value > 0 ? "\u2191" : value < 0 ? "\u2193" : "";
  return (
    <View style={[ds.badge, { backgroundColor: bg }]}>
      <Text style={[ds.badgeText, { color: color }]}>{arrow}{Math.abs(value)}% vs anterior</Text>
    </View>
  );
}

var ds = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4, alignSelf: "center" },
  badgeText: { fontSize: 10, fontWeight: "700" },
});

// F-11: Mini sparkline — ultimos 7 dias de receita vs despesa
function MiniSparkline({ transactions }: { transactions: Transaction[] }) {
  var days = useMemo(function() {
    var result: { income: number; expense: number; label: string }[] = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var iso = d.toISOString().slice(0, 10);
      var label = d.toLocaleDateString("pt-BR", { weekday: "narrow" });
      var inc = 0; var exp = 0;
      transactions.forEach(function(t) {
        var raw = (t as any).due_date || (t as any).created_at || "";
        if (raw && raw.slice(0, 10) === iso) {
          if (t.type === "income") inc += t.amount;
          else exp += t.amount;
        }
      });
      result.push({ income: inc, expense: exp, label: label });
    }
    return result;
  }, [transactions]);

  var max = Math.max(1, ...days.map(function(d) { return Math.max(d.income, d.expense); }));
  var BAR_H = 48;

  return (
    <View style={sk.container}>
      <Text style={sk.title}>Ultimos 7 dias</Text>
      <View style={sk.row}>
        {days.map(function(d, i) {
          var incH = Math.max(2, (d.income / max) * BAR_H);
          var expH = Math.max(d.expense > 0 ? 2 : 0, (d.expense / max) * BAR_H);
          var isToday = i === 6;
          return (
            <View key={i} style={sk.col}>
              <View style={sk.bars}>
                <View style={[sk.bar, { height: incH, backgroundColor: isToday ? Colors.green : Colors.green + "88" }]} />
                {expH > 0 && <View style={[sk.bar, { height: expH, backgroundColor: isToday ? Colors.red : Colors.red + "55" }]} />}
              </View>
              <Text style={[sk.label, isToday && { color: Colors.ink, fontWeight: "700" }]}>{d.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

var sk = StyleSheet.create({
  container: { marginBottom: 16, paddingTop: 4 },
  title: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 4 },
  col: { flex: 1, alignItems: "center", gap: 4 },
  bars: { height: 50, justifyContent: "flex-end", gap: 1, width: "100%" },
  bar: { borderRadius: 3, width: "100%", minHeight: 2 },
  label: { fontSize: 9, color: Colors.ink3, fontWeight: "500" },
});

export function SmartBalance({ income, expenses, balance, txCount, period, customStart, customEnd, previousSummary, transactions }: Props) {
  const healthy = balance > 0;
  const pct = income > 0 ? Math.round((expenses / income) * 100) : 0;
  const barWidth = Math.min(pct, 100);
  const { label: periodLabel } = getPeriodRange(period, customStart, customEnd);

  const healthLabel = pct <= 50 ? "Excelente" : pct <= 70 ? "Saudavel" : pct <= 90 ? "Atencao" : "Critico";
  const healthColor = pct <= 50 ? Colors.green : pct <= 70 ? Colors.green : pct <= 90 ? Colors.amber : Colors.red;
  const healthBg = pct <= 50 ? Colors.greenD : pct <= 70 ? Colors.greenD : pct <= 90 ? Colors.amberD : Colors.redD;
  const margin = income > 0 ? Math.round((balance / income) * 100) : 0;

  var revDelta = previousSummary ? delta(income, previousSummary.income) : null;
  var expDelta = previousSummary ? delta(expenses, previousSummary.expenses) : null;
  var balDelta = previousSummary ? delta(balance, previousSummary.balance) : null;

  return (
    <View style={[s.card, isWeb && { transition: "all 0.3s ease" } as any]}>
      <View style={s.topRow}>
        <Text style={s.period}>{periodLabel}</Text>
        <View style={[s.healthBadge, { backgroundColor: healthBg }]}>
          <View style={[s.healthDot, { backgroundColor: healthColor }]} />
          <Text style={[s.healthText, { color: healthColor }]}>{healthLabel}</Text>
        </View>
      </View>

      <Text style={s.balanceLabel}>Saldo do periodo</Text>
      <Text style={[s.balanceValue, { color: healthy ? Colors.green : Colors.red, fontSize: NARROW ? 28 : 38 }]}>
        {fmt(balance)}
      </Text>
      {balDelta !== null && <DeltaBadge value={balDelta} />}

      {income > 0 && (
        <View style={[s.marginBadge, { backgroundColor: margin >= 20 ? Colors.greenD : margin >= 0 ? Colors.amberD : Colors.redD }]}>
          <Text style={[s.marginText, { color: margin >= 20 ? Colors.green : margin >= 0 ? Colors.amber : Colors.red }]}>
            Margem: {margin}%
          </Text>
        </View>
      )}

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

      {/* F-11: Sparkline */}
      {transactions && transactions.length > 0 && period !== "all" && <MiniSparkline transactions={transactions} />}

      <View style={s.statsRow}>
        <View style={s.stat}>
          <Text style={s.statLabel}>Entradas</Text>
          <Text style={[s.statValue, { color: Colors.green }]} numberOfLines={1}>
            {NARROW ? fmtK(income) : fmt(income)}
          </Text>
          {revDelta !== null ? <DeltaBadge value={revDelta} /> : <Text style={s.statCount}>{txCount > 0 ? txCount + " lanc." : ""}</Text>}
        </View>
        <View style={[s.stat, s.statBorder]}>
          <Text style={s.statLabel}>Saidas</Text>
          <Text style={[s.statValue, { color: Colors.red }]} numberOfLines={1}>
            {NARROW ? fmtK(expenses) : fmt(expenses)}
          </Text>
          {expDelta !== null && <DeltaBadge value={expDelta} invert />}
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
  card: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: Colors.border2, marginBottom: 20 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 8 },
  period: { fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, flex: 1 },
  healthBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, flexShrink: 0 },
  healthDot: { width: 7, height: 7, borderRadius: 4 },
  healthText: { fontSize: 11, fontWeight: "700" },
  balanceLabel: { fontSize: 11, color: Colors.ink3, marginBottom: 2, letterSpacing: 0.3 },
  balanceValue: { fontWeight: "800", letterSpacing: -1, marginBottom: 4 },
  marginBadge: { alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 16, marginTop: 4 },
  marginText: { fontSize: 11, fontWeight: "700" },
  barSection: { marginBottom: 14 },
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
