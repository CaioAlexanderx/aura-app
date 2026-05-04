// components/screens/financeiro/v2/TabReceitas.tsx
//
// Aba "Receitas" do Financeiro v2. Onda 1: KPI Strip + tendencia diaria (DailyBars
// reaproveitando lógica do SparklineBar) + breakdown por categoria.
// Onda 2 vai adicionar: Top 5 recebimentos, formas de recebimento, timeline a receber,
// dia da semana, ranking profissionais, evolucao mensal 12m.

import { View, Text, StyleSheet, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import type { Transaction } from "../types";
import { fmt, fmtK } from "../types";
import { useMemo } from "react";

var W = Dimensions.get("window").width;
var NARROW = W < 480;
var IS_WIDE = W > 768;
var isWeb = Platform.OS === "web";

type Summary = { income: number; expenses: number; balance: number; pendingIncome?: number; pendingExpenses?: number };

type Props = {
  transactions: Transaction[];
  summary: Summary;
  previousSummary?: Summary | null;
  consolidated: boolean;
};

// Categorias de receita agrupadas
function groupIncomeByCategory(txs: Transaction[]): { label: string; value: number; pct: number }[] {
  var groups: Record<string, number> = {};
  txs.filter(function(t) { return t.type === "income" && t.status === "confirmed"; })
    .forEach(function(t) { groups[t.category || "Outros"] = (groups[t.category || "Outros"] || 0) + t.amount; });
  var total = Object.values(groups).reduce(function(s, v) { return s + v; }, 0);
  var rows = Object.keys(groups).map(function(k) { return { label: k, value: groups[k], pct: total > 0 ? (groups[k] / total) * 100 : 0 }; });
  rows.sort(function(a, b) { return b.value - a.value; });
  return rows.slice(0, 6);
}

function dailyIncomeSeries(txs: Transaction[]): { day: number; value: number }[] {
  var map: Record<number, number> = {};
  txs.filter(function(t) { return t.type === "income" && t.status === "confirmed"; })
    .forEach(function(t) {
      var raw = (t as any).due_date || (t as any).created_at;
      if (!raw) return;
      var d = new Date(raw);
      var k = d.getDate();
      map[k] = (map[k] || 0) + t.amount;
    });
  return Object.keys(map).sort(function(a, b) { return Number(a) - Number(b); }).map(function(k) {
    return { day: Number(k), value: map[Number(k)] };
  });
}

export function TabReceitas({ transactions, summary, previousSummary, consolidated }: Props) {
  var incomeCount = useMemo(function() {
    return transactions.filter(function(t) { return t.type === "income"; }).length;
  }, [transactions]);
  var avgTicket = incomeCount > 0 ? summary.income / incomeCount : 0;

  var incomeDelta = previousSummary && previousSummary.income > 0
    ? ((summary.income - previousSummary.income) / previousSummary.income) * 100
    : null;

  var receivable = summary.pendingIncome || 0;
  var collected = summary.income;

  var categories = useMemo(function() { return groupIncomeByCategory(transactions); }, [transactions]);
  var topCategoryColor = ["#7c3aed", "#a78bfa", "#34d399", "#5b8cff", "#fbbf24", "#f87171"];

  var daily = useMemo(function() { return dailyIncomeSeries(transactions); }, [transactions]);
  var maxDaily = Math.max(1, ...daily.map(function(d) { return d.value; }));
  var avgDaily = daily.length > 0 ? daily.reduce(function(s, d) { return s + d.value; }, 0) / daily.length : 0;

  return (
    <View>
      {/* KPI Strip */}
      <View style={[s.kpiStrip, NARROW ? s.kpiStripNarrow : null]}>
        <KpiCard label="Total recebido" value={fmtK(collected)} delta={incomeDelta} color={Colors.green} />
        <KpiCard label="A receber" value={fmtK(receivable)} delta={null} color={Colors.amber} />
        <KpiCard label="Ticket medio" value={fmtK(avgTicket)} delta={null} color={Colors.violet3} />
        <KpiCard label="Lancamentos" value={String(incomeCount)} delta={null} color={Colors.violet3} />
      </View>

      {/* Tendencia diaria */}
      <View style={[s.card, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
        <Text style={[s.kicker, { color: Colors.ink3 }]}>TENDENCIA DIARIA</Text>
        <Text style={[s.cardTitle, { color: Colors.ink }]}>Receita por dia</Text>
        {daily.length === 0 ? (
          <View style={s.empty}>
            <Text style={[s.emptyText, { color: Colors.ink3 }]}>Sem receitas confirmadas no periodo</Text>
          </View>
        ) : (
          <View style={s.bars}>
            {daily.map(function(d, i) {
              var h = Math.max(2, (d.value / maxDaily) * 100);
              return (
                <View key={i} style={s.barCol}>
                  <View style={[s.barTrack, { backgroundColor: Colors.bg4 }]}>
                    <View style={[s.barFill, { height: h + "%", backgroundColor: Colors.green }]} />
                  </View>
                  <Text style={[s.barLabel, { color: Colors.ink3 }]}>{d.day}</Text>
                </View>
              );
            })}
          </View>
        )}
        {avgDaily > 0 && (
          <Text style={[s.barFooter, { color: Colors.ink3 }]}>
            Media diaria: <Text style={{ color: Colors.green, fontWeight: "700" }}>{fmt(avgDaily)}</Text>
          </Text>
        )}
      </View>

      {/* Categorias de receita */}
      <View style={[s.card, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
        <Text style={[s.kicker, { color: Colors.ink3 }]}>CATEGORIAS DE RECEITA</Text>
        <Text style={[s.cardTitle, { color: Colors.ink }]}>Onde a receita nasce</Text>
        {categories.length === 0 ? (
          <View style={s.empty}>
            <Text style={[s.emptyText, { color: Colors.ink3 }]}>Nenhuma categoria de receita no periodo</Text>
          </View>
        ) : (
          categories.map(function(c, i) {
            var color = topCategoryColor[i % topCategoryColor.length];
            return (
              <View key={c.label} style={s.catRow}>
                <View style={[s.catDot, { backgroundColor: color }]} />
                <Text style={[s.catLabel, { color: Colors.ink }]} numberOfLines={1}>{c.label}</Text>
                <View style={[s.catBarTrack, { backgroundColor: Colors.bg4 }]}>
                  <View style={[s.catBarFill, { width: c.pct + "%", backgroundColor: color }]} />
                </View>
                <Text style={[s.catValue, { color: Colors.ink2 }]}>{fmtK(c.value)}</Text>
                <Text style={[s.catPct, { color: Colors.ink3 }]}>{c.pct.toFixed(0)}%</Text>
              </View>
            );
          })
        )}
      </View>

      {/* Roadmap card — comunica que mais cards estao chegando */}
      <View style={[s.card, s.roadmap, { backgroundColor: Colors.bg3, borderColor: Colors.border2 }]}>
        <Text style={[s.kicker, { color: Colors.violet3 }]}>EM CONSTRUCAO · ONDA 2</Text>
        <Text style={[s.cardTitle, { color: Colors.ink }]}>Mais cards chegando</Text>
        <Text style={[s.roadmapText, { color: Colors.ink2 }]}>
          Top 5 maiores recebimentos, formas de recebimento, timeline "a receber", faturamento por dia
          da semana, ranking de profissionais e evolucao mensal de 12 meses sao a proxima onda
          do redesign.{consolidated ? " Em modo consolidado, alguns desses ficarao agregados." : ""}
        </Text>
      </View>
    </View>
  );
}

function KpiCard({ label, value, delta, color }: { label: string; value: string; delta: number | null; color: string }) {
  return (
    <View style={[k.card, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
      <View style={[k.accent, { backgroundColor: color }]} />
      <Text style={[k.label, { color: Colors.ink3 }]}>{label}</Text>
      <Text style={[k.value, { color: Colors.ink }]} numberOfLines={1}>{value}</Text>
      {delta !== null && (
        <Text style={[k.delta, { color: delta >= 0 ? Colors.green : Colors.red }]}>
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1).replace(".", ",")}% vs ant.
        </Text>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  kpiStrip: { flexDirection: "row", gap: 10, marginBottom: 14, flexWrap: "wrap" },
  kpiStripNarrow: { gap: 8 },
  card: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    marginBottom: 14,
  },
  roadmap: { borderStyle: "dashed" },
  kicker: { fontSize: 9.5, letterSpacing: 1.2, fontWeight: "600", textTransform: "uppercase" },
  cardTitle: { fontSize: 16, fontWeight: "700", marginTop: 4, marginBottom: 14, letterSpacing: -0.3 },
  empty: { paddingVertical: 32, alignItems: "center" },
  emptyText: { fontSize: 12, fontStyle: "italic" },
  bars: { flexDirection: "row", height: 140, gap: 3, alignItems: "flex-end" },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  barTrack: { width: "100%", flex: 1, borderRadius: 4, overflow: "hidden", justifyContent: "flex-end" },
  barFill: { width: "100%", borderRadius: 4 },
  barLabel: { fontSize: 9 },
  barFooter: { fontSize: 11, marginTop: 10 },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catLabel: { fontSize: 13, fontWeight: "600", flex: 1, minWidth: 0 },
  catBarTrack: { flex: 1.4, height: 6, borderRadius: 3, overflow: "hidden" },
  catBarFill: { height: 6, borderRadius: 3 },
  catValue: { fontSize: 12, fontWeight: "700", minWidth: 56, textAlign: "right" },
  catPct: { fontSize: 11, minWidth: 38, textAlign: "right", fontWeight: "600" },
  roadmapText: { fontSize: 12, lineHeight: 18, fontStyle: "italic" },
});

var k = StyleSheet.create({
  card: {
    flex: NARROW ? undefined : 1,
    minWidth: NARROW ? "47%" : 0,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    overflow: "hidden",
    position: "relative",
  },
  accent: { position: "absolute", top: 0, left: 0, right: 0, height: 2, opacity: 0.85 },
  label: { fontSize: 9, letterSpacing: 0.6, fontWeight: "600", textTransform: "uppercase" },
  value: { fontSize: 20, fontWeight: "800", marginTop: 8, letterSpacing: -0.4 },
  delta: { fontSize: 11, fontWeight: "700", marginTop: 6 },
});

export default TabReceitas;
