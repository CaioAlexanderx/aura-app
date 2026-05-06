// components/screens/financeiro/v2/TabReceitas.tsx
//
// Aba "Receitas" do Financeiro v2. Onda 2: KPI Strip + tendencia diaria +
// breakdown por categoria (cliente) + Top 5 + formas de pagamento + timeline
// a receber + dia da semana (do server, via useFinancialInsights).
//
// Onda 3 vai adicionar: ranking profissionais (employees JOIN), evolucao 12m.
// Multi-CNPJ aware: passa flag pros componentes mostrarem badges/dicas.
//
// 06/05/2026: AbcCurveCard adicionado depois de "Categorias de receita" —
// curva ABC migrou do Estoque pra cá, calculada via useProductsRanking.
// Wrapper recebe nativeID="abc-curve-card" pro deep-link `?focus=abc`
// auto-rolar ate o card no web (document.getElementById).

import { View, Text, StyleSheet, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import type { Transaction } from "../types";
import { fmt, fmtK } from "../types";
import { useMemo } from "react";
import { useFinancialInsights } from "@/hooks/useFinancialInsights";
import { Top5List, HBarList, Timeline, DowBars } from "./SharedCards";
// Onda 3: ranking + evolução mensal 12m
import { ProfessionalsRanking, MonthlyEvolution } from "./Onda3Cards";
// 06/05: Curva ABC migrada do Estoque
import { AbcCurveCard } from "./AbcCurveCard";

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

export function TabReceitas({ transactions, summary, previousSummary, period, consolidated }: Props) {
  var incomeCount = useMemo(function() {
    return transactions.filter(function(t) { return t.type === "income"; }).length;
  }, [transactions]);
  var avgTicket = incomeCount > 0 ? summary.income / incomeCount : 0;

  var incomeDelta = previousSummary && previousSummary.income > 0
    ? ((summary.income - previousSummary.income) / previousSummary.income) * 100
    : null;

  var receivable = summary.pendingIncome || 0;
  var collected = summary.income;

  // Insights enriquecidos (Onda 2): top5, payment_methods, timeline, dow do server
  var insights = useFinancialInsights({
    transactions: transactions,
    summary: summary,
    previousSummary: previousSummary,
    period: period,
  });
  var ib = insights.income_breakdown;

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

      {/* Onda 2: Top 5 + Formas de recebimento (lado a lado em wide, stack em mobile) */}
      <View style={IS_WIDE ? s.row2 : s.col}>
        <View style={[s.card, IS_WIDE ? { flex: 1 } : null, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
          <Text style={[s.kicker, { color: Colors.ink3 }]}>TOP 5 RECEBIMENTOS</Text>
          <Text style={[s.cardTitle, { color: Colors.ink }]}>Os clientes que mais movimentaram</Text>
          <Top5List items={ib?.top5 || []} kind="income" showCompanyBadge={consolidated} />
        </View>

        <View style={[s.card, IS_WIDE ? { flex: 1 } : null, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
          <Text style={[s.kicker, { color: Colors.ink3 }]}>FORMAS DE RECEBIMENTO</Text>
          <Text style={[s.cardTitle, { color: Colors.ink }]}>Como o dinheiro entra</Text>
          <HBarList items={ib?.payment_methods || []} kind="income" />
        </View>
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

      {/* Onda 2: Timeline a receber + dia da semana */}
      <View style={IS_WIDE ? s.row2 : s.col}>
        <View style={[s.card, IS_WIDE ? { flex: 1 } : null, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
          <Text style={[s.kicker, { color: Colors.ink3 }]}>A RECEBER</Text>
          <Text style={[s.cardTitle, { color: Colors.ink }]}>Timeline de recebiveis</Text>
          {ib?.timeline ? <Timeline buckets={ib.timeline} kind="receivable" /> : (
            <View style={s.empty}>
              <Text style={[s.emptyText, { color: Colors.ink3 }]}>Carregando timeline…</Text>
            </View>
          )}
        </View>

        <View style={[s.card, IS_WIDE ? { flex: 1 } : null, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
          <Text style={[s.kicker, { color: Colors.ink3 }]}>DIA DA SEMANA</Text>
          <Text style={[s.cardTitle, { color: Colors.ink }]}>Faturamento por dia</Text>
          <DowBars items={ib?.dow || []} kind="income" />
        </View>
      </View>

      {/* Categorias de receita (cliente, sem dependencia de server) */}
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

      {/* Curva ABC dos produtos — calculada a partir de vendas reais.
          Migrou do Estoque (era decorativa, sempre 'C') pra cá em 06/05.
          nativeID pro deep-link `/financeiro?tab=receitas&focus=abc` poder
          rolar até o card via document.getElementById no web. */}
      <View nativeID="abc-curve-card" style={{ marginBottom: 14 }}>
        <AbcCurveCard />
      </View>

      {/* Onda 3: Ranking de profissionais — só per-company */}
      <View style={[s.card, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
        <Text style={[s.kicker, { color: Colors.ink3 }]}>RANKING DE PROFISSIONAIS</Text>
        <Text style={[s.cardTitle, { color: Colors.ink }]}>
          {consolidated ? "Disponivel ao selecionar empresa" : "Quem mais movimentou no periodo"}
        </Text>
        <ProfessionalsRanking items={insights.professional_ranking || []} consolidated={consolidated} />
      </View>

      {/* Onda 3: Evolução mensal 12m */}
      <View style={[s.card, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
        <Text style={[s.kicker, { color: Colors.ink3 }]}>EVOLUCAO MENSAL · 12 MESES</Text>
        <Text style={[s.cardTitle, { color: Colors.ink }]}>Receita ao longo do tempo</Text>
        <MonthlyEvolution items={insights.monthly_evolution || []} />
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
  row2: { flexDirection: "row", gap: 14 },
  col: { flexDirection: "column" },
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
