// components/screens/financeiro/v2/TabDespesas.tsx
//
// Aba "Despesas" do Financeiro v2. Onda 2: KPI Strip + DRE Waterfall (per-company)
// + Top 5 + formas de pagamento + tendencia diaria + categorias + timeline a pagar
// + Gauge despesa/receita + AnomalyAlerts (categorias acima da media 3m).
// Onda 3: + Evolucao mensal 12m.
//
// Em consolidated, DRE Waterfall fica bloqueado (precisa contexto fiscal).
// Onda 4 vai adicionar: fixo x variavel 6m.

import { View, Text, StyleSheet, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type { Transaction } from "../types";
import { fmt, fmtK } from "../types";
import { useMemo } from "react";
import { useFinancialInsights } from "@/hooks/useFinancialInsights";
import { Top5List, HBarList, Timeline, Gauge, AnomalyAlerts } from "./SharedCards";
// Onda 3: evolução mensal 12m
import { MonthlyEvolution } from "./Onda3Cards";

var W = Dimensions.get("window").width;
var NARROW = W < 480;
var IS_WIDE = W > 768;
var isWeb = Platform.OS === "web";

type Summary = { income: number; expenses: number; balance: number; pendingIncome?: number; pendingExpenses?: number };

type Props = {
  transactions: Transaction[];
  summary: Summary;
  previousSummary?: Summary | null;
  period: string;
  consolidated: boolean;
};

function groupExpenseByCategory(txs: Transaction[]): { label: string; value: number; pct: number }[] {
  var groups: Record<string, number> = {};
  txs.filter(function(t) { return t.type === "expense" && t.status === "confirmed"; })
    .forEach(function(t) { groups[t.category || "Outros"] = (groups[t.category || "Outros"] || 0) + t.amount; });
  var total = Object.values(groups).reduce(function(s, v) { return s + v; }, 0);
  var rows = Object.keys(groups).map(function(k) { return { label: k, value: groups[k], pct: total > 0 ? (groups[k] / total) * 100 : 0 }; });
  rows.sort(function(a, b) { return b.value - a.value; });
  return rows.slice(0, 6);
}

function dailyExpenseSeries(txs: Transaction[]): { day: number; value: number }[] {
  var map: Record<number, number> = {};
  txs.filter(function(t) { return t.type === "expense" && t.status === "confirmed"; })
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

export function TabDespesas({ transactions, summary, previousSummary, period, consolidated }: Props) {
  var expenseCount = useMemo(function() {
    return transactions.filter(function(t) { return t.type === "expense"; }).length;
  }, [transactions]);
  var payable = summary.pendingExpenses || 0;
  var paid = summary.expenses;
  var marginPct = summary.income > 0 ? ((summary.income - summary.expenses) / summary.income) * 100 : 0;

  var expenseDelta = previousSummary && previousSummary.expenses > 0
    ? ((summary.expenses - previousSummary.expenses) / previousSummary.expenses) * 100
    : null;

  // Insights enriquecidos (Onda 2/3): top5, payment_methods, timeline, anomalies, gauge, monthly_evolution
  var insights = useFinancialInsights({
    transactions: transactions,
    summary: summary,
    previousSummary: previousSummary,
    period: period,
  });
  var eb = insights.expense_breakdown;

  var categories = useMemo(function() { return groupExpenseByCategory(transactions); }, [transactions]);
  var catColors = ["#f87171", "#fbbf24", "#a78bfa", "#5b8cff", "#7c3aed", "#34d399"];

  var daily = useMemo(function() { return dailyExpenseSeries(transactions); }, [transactions]);
  var maxDaily = Math.max(1, ...daily.map(function(d) { return d.value; }));
  var avgDaily = daily.length > 0 ? daily.reduce(function(s, d) { return s + d.value; }, 0) / daily.length : 0;

  return (
    <View>
      {/* KPI Strip */}
      <View style={[s.kpiStrip, NARROW ? s.kpiStripNarrow : null]}>
        <KpiCard label="Total pago" value={fmtK(paid)} delta={expenseDelta} invert color={Colors.red} />
        <KpiCard label="A pagar" value={fmtK(payable)} delta={null} color={Colors.amber} />
        <KpiCard label="Margem liquida" value={marginPct.toFixed(1).replace(".", ",") + "%"} delta={null} color={marginPct >= 20 ? Colors.green : marginPct >= 10 ? Colors.amber : Colors.red} />
        <KpiCard label="Lancamentos" value={String(expenseCount)} delta={null} color={Colors.violet3} />
      </View>

      {/* DRE Waterfall — bloqueado em consolidado */}
      {consolidated ? (
        <View style={[s.card, s.lockedCard, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
          <View style={[s.lockIconWrap, { backgroundColor: Colors.violetD, borderColor: Colors.border2 }]}>
            <Icon name="lock" size={20} color={Colors.violet3} />
          </View>
          <Text style={[s.lockedTitle, { color: Colors.ink }]}>DRE Waterfall indisponivel em modo consolidado</Text>
          <Text style={[s.lockedDesc, { color: Colors.ink3 }]}>
            O DRE precisa do contexto fiscal de uma empresa especifica (regime tributario, Fator R, etc).
            Selecione uma empresa no seletor pra visualizar o waterfall.
          </Text>
        </View>
      ) : (
        <View style={[s.card, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
          <Text style={[s.kicker, { color: Colors.ink3 }]}>DRE SIMPLIFICADO · WATERFALL</Text>
          <Text style={[s.cardTitle, { color: Colors.ink }]}>Da receita ao resultado liquido</Text>
          <DreWaterfall income={summary.income} categories={categories} netResult={summary.income - summary.expenses} marginPct={marginPct} />
        </View>
      )}

      {/* Onda 2: Top 5 + Formas de pagamento (lado a lado em wide) */}
      <View style={IS_WIDE ? s.row2 : s.col}>
        <View style={[s.card, IS_WIDE ? { flex: 1 } : null, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
          <Text style={[s.kicker, { color: Colors.ink3 }]}>TOP 5 DESPESAS</Text>
          <Text style={[s.cardTitle, { color: Colors.ink }]}>Os pagamentos mais pesados</Text>
          <Top5List items={eb?.top5 || []} kind="expense" showCompanyBadge={consolidated} />
        </View>

        <View style={[s.card, IS_WIDE ? { flex: 1 } : null, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
          <Text style={[s.kicker, { color: Colors.ink3 }]}>FORMAS DE PAGAMENTO</Text>
          <Text style={[s.cardTitle, { color: Colors.ink }]}>Como o dinheiro saiu</Text>
          <HBarList items={eb?.payment_methods || []} kind="expense" />
        </View>
      </View>

      {/* Tendencia diaria */}
      <View style={[s.card, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
        <Text style={[s.kicker, { color: Colors.ink3 }]}>TENDENCIA DIARIA</Text>
        <Text style={[s.cardTitle, { color: Colors.ink }]}>Despesa por dia</Text>
        {daily.length === 0 ? (
          <View style={s.empty}>
            <Text style={[s.emptyText, { color: Colors.ink3 }]}>Sem despesas confirmadas no periodo</Text>
          </View>
        ) : (
          <View style={s.bars}>
            {daily.map(function(d, i) {
              var h = Math.max(2, (d.value / maxDaily) * 100);
              return (
                <View key={i} style={s.barCol}>
                  <View style={[s.barTrack, { backgroundColor: Colors.bg4 }]}>
                    <View style={[s.barFill, { height: h + "%", backgroundColor: Colors.red }]} />
                  </View>
                  <Text style={[s.barLabel, { color: Colors.ink3 }]}>{d.day}</Text>
                </View>
              );
            })}
          </View>
        )}
        {avgDaily > 0 && (
          <Text style={[s.barFooter, { color: Colors.ink3 }]}>
            Media diaria: <Text style={{ color: Colors.red, fontWeight: "700" }}>{fmt(avgDaily)}</Text>
          </Text>
        )}
      </View>

      {/* Onda 2: Timeline a pagar + Gauge despesa/receita */}
      <View style={IS_WIDE ? s.row2 : s.col}>
        <View style={[s.card, IS_WIDE ? { flex: 1 } : null, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
          <Text style={[s.kicker, { color: Colors.ink3 }]}>A PAGAR</Text>
          <Text style={[s.cardTitle, { color: Colors.ink }]}>Timeline de pagamentos</Text>
          {eb?.timeline ? <Timeline buckets={eb.timeline} kind="payable" /> : (
            <View style={s.empty}>
              <Text style={[s.emptyText, { color: Colors.ink3 }]}>Carregando timeline…</Text>
            </View>
          )}
        </View>

        <View style={[s.card, IS_WIDE ? { flex: 1 } : null, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
          <Text style={[s.kicker, { color: Colors.ink3 }]}>DESPESAS / RECEITA</Text>
          <Text style={[s.cardTitle, { color: Colors.ink }]}>Quanto da receita vira despesa</Text>
          {eb?.gauge ? <Gauge data={eb.gauge} benchmark={62} /> : (
            <View style={s.empty}>
              <Text style={[s.emptyText, { color: Colors.ink3 }]}>Carregando gauge…</Text>
            </View>
          )}
        </View>
      </View>

      {/* Categorias de despesa (cliente) */}
      <View style={[s.card, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
        <Text style={[s.kicker, { color: Colors.ink3 }]}>CATEGORIAS DE DESPESA</Text>
        <Text style={[s.cardTitle, { color: Colors.ink }]}>Pra onde o dinheiro foi</Text>
        {categories.length === 0 ? (
          <View style={s.empty}>
            <Text style={[s.emptyText, { color: Colors.ink3 }]}>Nenhuma categoria de despesa no periodo</Text>
          </View>
        ) : (
          categories.map(function(c, i) {
            var color = catColors[i % catColors.length];
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

      {/* Onda 2: Anomalias */}
      <View style={[s.card, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
        <Text style={[s.kicker, { color: Colors.ink3 }]}>ALERTAS DE ANOMALIA</Text>
        <Text style={[s.cardTitle, { color: Colors.ink }]}>Categorias com gasto incomum vs media de 3 meses</Text>
        <AnomalyAlerts items={eb?.anomalies || []} />
      </View>

      {/* Onda 3: Evolução mensal 12m */}
      <View style={[s.card, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
        <Text style={[s.kicker, { color: Colors.ink3 }]}>EVOLUCAO MENSAL · 12 MESES</Text>
        <Text style={[s.cardTitle, { color: Colors.ink }]}>Despesa vs receita ao longo do tempo</Text>
        <MonthlyEvolution items={insights.monthly_evolution || []} />
      </View>

      {/* Roadmap card — Onda 4 */}
      <View style={[s.card, s.roadmap, { backgroundColor: Colors.bg3, borderColor: Colors.border2 }]}>
        <Text style={[s.kicker, { color: Colors.violet3 }]}>EM CONSTRUCAO · ONDA 4</Text>
        <Text style={[s.cardTitle, { color: Colors.ink }]}>Mais analise chegando</Text>
        <Text style={[s.roadmapText, { color: Colors.ink2 }]}>
          Fixo x variavel 6m chega na proxima onda — depende de categorizacao "fixo/variavel"
          que vamos adicionar nas categorias de despesa.
        </Text>
      </View>
    </View>
  );
}

function DreWaterfall({ income, categories, netResult, marginPct }: {
  income: number;
  categories: { label: string; value: number; pct: number }[];
  netResult: number;
  marginPct: number;
}) {
  if (income <= 0) {
    return (
      <View style={s.empty}>
        <Text style={[s.emptyText, { color: Colors.ink3 }]}>Sem receita confirmada pra calcular DRE</Text>
      </View>
    );
  }
  var max = income;

  return (
    <View style={dre.wrap}>
      <View style={dre.row}>
        <Text style={[dre.label, { color: Colors.ink }]}>Receita bruta</Text>
        <View style={[dre.bar, { width: "100%", backgroundColor: Colors.green }]} />
        <Text style={[dre.value, { color: Colors.green }]}>+{fmtK(income)}</Text>
      </View>
      {categories.map(function(c) {
        var w = (c.value / max) * 100;
        return (
          <View key={c.label} style={dre.row}>
            <Text style={[dre.label, { color: Colors.ink2 }]} numberOfLines={1}>− {c.label}</Text>
            <View style={[dre.bar, { width: w + "%", backgroundColor: Colors.red, opacity: 0.85 }]} />
            <Text style={[dre.value, { color: Colors.red }]}>−{fmtK(c.value)}</Text>
          </View>
        );
      })}
      <View style={[dre.row, dre.totalRow, { borderTopColor: Colors.border }]}>
        <Text style={[dre.label, { color: Colors.ink, fontWeight: "800" }]}>Resultado liquido</Text>
        <View style={[dre.bar, { width: Math.max(2, (Math.abs(netResult) / max) * 100) + "%", backgroundColor: netResult >= 0 ? Colors.violet : Colors.red }]} />
        <Text style={[dre.value, { color: netResult >= 0 ? Colors.violet3 : Colors.red, fontWeight: "800" }]}>
          {netResult >= 0 ? "+" : ""}{fmtK(netResult)}
        </Text>
      </View>
      <Text style={[dre.margin, { color: Colors.ink3 }]}>
        Margem: <Text style={{ color: marginPct >= 20 ? Colors.green : marginPct >= 10 ? Colors.amber : Colors.red, fontWeight: "700" }}>{marginPct.toFixed(1).replace(".", ",")}%</Text>
      </Text>
    </View>
  );
}

function KpiCard({ label, value, delta, color, invert }: { label: string; value: string; delta: number | null; color: string; invert?: boolean }) {
  var deltaGood = invert ? (delta != null && delta < 0) : (delta != null && delta >= 0);
  return (
    <View style={[k.card, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
      <View style={[k.accent, { backgroundColor: color }]} />
      <Text style={[k.label, { color: Colors.ink3 }]}>{label}</Text>
      <Text style={[k.value, { color: Colors.ink }]} numberOfLines={1}>{value}</Text>
      {delta !== null && (
        <Text style={[k.delta, { color: deltaGood ? Colors.green : Colors.red }]}>
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1).replace(".", ",")}% vs ant.
        </Text>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  kpiStrip: { flexDirection: "row", gap: 10, marginBottom: 14, flexWrap: "wrap" },
  kpiStripNarrow: { gap: 8 },
  row2: { flexDirection: "row", gap: 14 },
  col: { flexDirection: "column" },
  card: { borderRadius: 16, padding: 18, borderWidth: 1, marginBottom: 14 },
  lockedCard: { alignItems: "center", paddingVertical: 28 },
  lockIconWrap: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, marginBottom: 12,
  },
  lockedTitle: { fontSize: 14, fontWeight: "700", textAlign: "center", marginBottom: 6 },
  lockedDesc: { fontSize: 12, textAlign: "center", lineHeight: 17, maxWidth: 420 },
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
  catRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
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

var dre = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  totalRow: { borderTopWidth: 1, marginTop: 6, paddingTop: 12 },
  label: { fontSize: 12, width: 130, flexShrink: 0 },
  bar: { height: 14, borderRadius: 4, flex: 1 },
  value: { fontSize: 12, fontWeight: "700", minWidth: 80, textAlign: "right" },
  margin: { fontSize: 12, marginTop: 6, alignSelf: "flex-end" },
});

export default TabDespesas;
