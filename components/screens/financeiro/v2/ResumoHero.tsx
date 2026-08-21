// components/screens/financeiro/v2/ResumoHero.tsx
//
// F3 (24/08/2026) — hero unificado da Visao Geral.
//
// Substitui o par HealthScoreHero + SmartBalance, que juntos colocavam ~20
// numeros e dois sistemas de "saude" concorrentes na primeira dobra. Aqui a
// tela responde a pergunta que o dono do negocio realmente faz:
//   quanto entrou · quanto saiu · quanto sobrou
// e uma unica frase de status no lugar do score 0-100 + 4 drivers com meta,
// gap e barra cada. O score continua existindo no hook e alimenta a frase e a
// cor — so nao ocupa mais a primeira dobra.
//
// Feedback do Caio (21/08) incorporado aqui:
//   · grafico animado ilustrando o resumo do mes (entradas x saidas por dia);
//   · barra de progresso colorida PELO RESULTADO, esverdeando conforme se
//     afasta da meta pra baixo (goalScale.ts);
//   · meta configuravel pelo usuario (useFinanceGoal), com default sugerido.
//
// Animacao: Animated + useNativeDriver:false (padrao web-safe do projeto,
// mesmo de components/anim/*). Respeita "reduzir movimento" do sistema.

import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Platform, Pressable, Animated, Easing, AccessibilityInfo, useWindowDimensions } from "react-native";
import type { DimensionValue } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { fmt, parseDateLocal } from "../types";
import type { Transaction, PeriodKey } from "../types";
import type { FinancialInsights } from "./types";
import { useFinanceGoal, GOAL_MIN, GOAL_MAX, DEFAULT_GOAL_PCT } from "@/hooks/useFinanceGoal";
import { goalColor, goalCaption } from "./goalScale";

var isWeb = Platform.OS === "web";
var MAX_BUCKETS = 14;

type Summary = { income: number; expenses: number; balance: number; pendingIncome?: number; pendingExpenses?: number };

type Props = {
  transactions: Transaction[];
  summary: Summary;
  previousSummary?: Summary | null;
  insights: FinancialInsights;
  period: PeriodKey;
  consolidated?: boolean;
};

type Bucket = { key: string; label: string; income: number; expenses: number };

// Agrupa o periodo em ate 14 baldes diarios pro grafico. Mais que isso vira
// serrilha ilegivel em mobile; menos perde o formato do mes.
function buildBuckets(transactions: Transaction[]): Bucket[] {
  var map: Record<string, Bucket> = {};
  transactions.forEach(function(t) {
    if (t.status !== "confirmed") return;
    var raw = (t as any).due_date || (t as any).created_at || t.date;
    if (!raw) return;
    var d = parseDateLocal(raw);
    if (isNaN(d.getTime())) return;
    var key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    if (!map[key]) {
      map[key] = {
        key: key,
        label: String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"),
        income: 0,
        expenses: 0,
      };
    }
    if (t.type === "income") map[key].income += t.amount;
    else map[key].expenses += t.amount;
  });
  var all = Object.keys(map).sort().map(function(k) { return map[k]; });
  return all.slice(-MAX_BUCKETS);
}

function deltaPct(current: number, previous?: number | null): number | null {
  if (previous == null || !isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

// ─── Numero com contagem animada ────────────────────────────
function AnimatedAmount({ value, style, reduceMotion }: { value: number; style: any; reduceMotion: boolean }) {
  var [shown, setShown] = useState(reduceMotion ? value : 0);
  var anim = useRef(new Animated.Value(0)).current;
  var target = useRef(value);

  useEffect(function() {
    target.current = value;
    if (reduceMotion) { setShown(value); return; }
    anim.setValue(0);
    var id = anim.addListener(function(state) {
      setShown(target.current * state.value);
    });
    var animation = Animated.timing(anim, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return function() {
      animation.stop();
      anim.removeListener(id);
    };
  }, [value, reduceMotion, anim]);

  return <Text style={style} numberOfLines={1}>{fmt(shown)}</Text>;
}

// ─── Grafico animado: entradas x saidas por dia ─────────────
function DailyBars({ buckets, reduceMotion }: { buckets: Bucket[]; reduceMotion: boolean }) {
  var grow = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(function() {
    if (reduceMotion) { grow.setValue(1); return; }
    grow.setValue(0);
    var animation = Animated.timing(grow, {
      toValue: 1,
      duration: 850,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return function() { animation.stop(); };
  }, [buckets.length, reduceMotion, grow]);

  var max = useMemo(function() {
    return buckets.reduce(function(m, b) { return Math.max(m, b.income, b.expenses); }, 0);
  }, [buckets]);

  if (buckets.length < 2 || max <= 0) return null;

  // FIX 24/08/2026 (QA no app rodando): com poucos dias de movimento o grafico
  // ficava feio e ilegivel — 3 colunas em `flex: 1` viravam blocos de um terco
  // da largura cada, e as barras do lado sem valor, presas no minHeight de 2px,
  // viravam uma linha vermelha continua atravessando a tela, que parecia um
  // eixo ou um erro de render. Agora as colunas tem largura maxima e a barra
  // sem valor simplesmente nao existe.
  var sparse = buckets.length < 8;

  return (
    <View style={g.wrap} accessibilityLabel="Gráfico de entradas e saídas por dia no período">
      <View style={g.chart}>
        {buckets.map(function(b) {
          var inH = b.income > 0 ? Math.max(3, (b.income / max) * 100) : 0;
          var outH = b.expenses > 0 ? Math.max(3, (b.expenses / max) * 100) : 0;
          return (
            <View key={b.key} style={[g.col, sparse ? g.colSparse : null]}>
              <View style={g.pair}>
                {b.income > 0 && (
                  <Animated.View
                    style={[
                      g.bar,
                      {
                        backgroundColor: Colors.green,
                        height: grow.interpolate({ inputRange: [0, 1], outputRange: ["0%", inH + "%"] }),
                      },
                    ]}
                  />
                )}
                {b.expenses > 0 && (
                  <Animated.View
                    style={[
                      g.bar,
                      {
                        backgroundColor: Colors.red,
                        opacity: 0.85,
                        height: grow.interpolate({ inputRange: [0, 1], outputRange: ["0%", outH + "%"] }),
                      },
                    ]}
                  />
                )}
              </View>
            </View>
          );
        })}
      </View>
      <View style={g.legendRow}>
        <View style={g.legendItem}>
          <View style={[g.legendDot, { backgroundColor: Colors.green }]} />
          <Text style={g.legendText}>Entrou</Text>
        </View>
        <View style={g.legendItem}>
          <View style={[g.legendDot, { backgroundColor: Colors.red }]} />
          <Text style={g.legendText}>Saiu</Text>
        </View>
        <Text style={g.legendRange}>{buckets[0].label} — {buckets[buckets.length - 1].label}</Text>
      </View>
    </View>
  );
}

// ─── Barra de gasto colorida pelo resultado ─────────────────
function GoalBar({
  expenseRatio, goalPct, isCustom, onEditGoal, reduceMotion,
}: {
  expenseRatio: number;
  goalPct: number;
  isCustom: boolean;
  onEditGoal: () => void;
  reduceMotion: boolean;
}) {
  var width = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  var pct = Math.max(0, Math.min(100, expenseRatio));
  var color = goalColor(expenseRatio, goalPct, { green: Colors.green, amber: Colors.amber, red: Colors.red });

  useEffect(function() {
    if (reduceMotion) { width.setValue(1); return; }
    width.setValue(0);
    var animation = Animated.timing(width, {
      toValue: 1,
      duration: 950,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return function() { animation.stop(); };
  }, [pct, reduceMotion, width]);

  return (
    <View style={gb.wrap}>
      <View style={[gb.track, { backgroundColor: Colors.bg4 }]}>
        <Animated.View
          style={[
            gb.fill,
            {
              backgroundColor: color,
              width: width.interpolate({ inputRange: [0, 1], outputRange: ["0%", pct + "%"] }),
            },
          ]}
        />
        {/* Marcador da meta — referencia visual de onde e o limite */}
        {goalPct > 0 && goalPct < 100 && (
          <View style={[gb.goalMark, { left: (goalPct + "%") as DimensionValue, backgroundColor: Colors.ink3 }]} />
        )}
      </View>

      <View style={gb.captionRow}>
        <Text style={[gb.caption, { color: Colors.ink2 }]}>
          Você gastou <Text style={{ color: color, fontWeight: "800" }}>{Math.round(pct)}%</Text> do que entrou
        </Text>
        <Pressable
          onPress={onEditGoal}
          accessibilityRole="button"
          accessibilityLabel={"Ajustar meta de gasto, hoje em " + goalPct + " por cento"}
          hitSlop={8}
          style={({ hovered }: any) => [
            gb.goalBtn,
            { borderColor: Colors.border },
            isWeb && hovered ? { borderColor: Colors.violet3 } : null,
            isWeb ? ({ transition: "all 0.18s ease", cursor: "pointer" } as any) : null,
          ]}
        >
          <Text style={[gb.goalBtnText, { color: Colors.ink3 }]}>
            meta: até {goalPct}%
          </Text>
          <Icon name="edit" size={10} color={Colors.violet3} />
        </Pressable>
      </View>

      <Text style={[gb.hint, { color: Colors.ink3 }]}>
        {goalCaption(expenseRatio, goalPct)}
        {!isCustom ? "  Meta sugerida — ajuste pra realidade do seu negócio." : ""}
      </Text>
    </View>
  );
}

// ─── Editor da meta ─────────────────────────────────────────
function GoalEditor({
  goalPct, onChange, onClose,
}: {
  goalPct: number;
  onChange: (v: number) => void;
  onClose: () => void;
}) {
  var steps = [50, 60, 65, 70, 75, 80, 85];
  return (
    <View style={[ge.wrap, { backgroundColor: Colors.bg4, borderColor: Colors.border2 }]}>
      <View style={ge.header}>
        <Text style={[ge.title, { color: Colors.ink }]}>Qual seu limite de gasto?</Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar ajuste de meta" hitSlop={8}>
          <Icon name="x" size={14} color={Colors.ink3} />
        </Pressable>
      </View>
      <Text style={[ge.desc, { color: Colors.ink3 }]}>
        Do que entra no mês, no máximo quanto pode virar despesa? O que sobra paga sua retirada,
        os impostos e o reinvestimento.
      </Text>
      <View style={ge.chips}>
        {steps.map(function(v) {
          var active = v === goalPct;
          return (
            <Pressable
              key={v}
              onPress={function() { onChange(v); }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={"Meta de " + v + " por cento"}
              style={[
                ge.chip,
                { borderColor: Colors.border, backgroundColor: Colors.bg3 },
                active ? { backgroundColor: Colors.violet, borderColor: Colors.violet } : null,
                isWeb ? ({ transition: "all 0.15s ease", cursor: "pointer" } as any) : null,
              ]}
            >
              <Text style={[ge.chipText, { color: active ? "#fff" : Colors.ink2 }, active ? { fontWeight: "800" } : null]}>
                {v}%
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={ge.footer}>
        <Pressable onPress={function() { onChange(DEFAULT_GOAL_PCT); }} hitSlop={6} accessibilityRole="button">
          <Text style={[ge.reset, { color: Colors.violet3 }]}>Usar a sugestão ({DEFAULT_GOAL_PCT}%)</Text>
        </Pressable>
        <Text style={[ge.range, { color: Colors.ink3 }]}>Entre {GOAL_MIN}% e {GOAL_MAX}%</Text>
      </View>
    </View>
  );
}

// ─── Hero ───────────────────────────────────────────────────
export function ResumoHero({ transactions, summary, previousSummary, insights, period, consolidated }: Props) {
  var { width: vw } = useWindowDimensions();
  // FIX M8: breakpoint reativo. Os cards do Financeiro liam Dimensions.get no
  // escopo do modulo e ficavam presos no tamanho do primeiro load.
  var NARROW = vw < 640;

  var { goalPct, isCustom, setGoal } = useFinanceGoal();
  var [editing, setEditing] = useState(false);
  var [reduceMotion, setReduceMotion] = useState(false);

  useEffect(function() {
    var mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(function(enabled) {
      if (mounted) setReduceMotion(!!enabled);
    }).catch(function() { /* plataforma sem suporte — mantem animado */ });
    return function() { mounted = false; };
  }, []);

  var buckets = useMemo(function() { return buildBuckets(transactions); }, [transactions]);

  var expenseRatio = summary.income > 0 ? (summary.expenses / summary.income) * 100 : 0;
  var marginPct = summary.income > 0 ? ((summary.income - summary.expenses) / summary.income) * 100 : 0;
  var balanceDelta = deltaPct(summary.balance, previousSummary?.balance);

  var incomeCount = transactions.filter(function(t) { return t.type === "income" && t.status === "confirmed"; }).length;
  var expenseCount = transactions.filter(function(t) { return t.type === "expense" && t.status === "confirmed"; }).length;

  // FIX (QA pos-F7): sem receita, expenseRatio e 0 e goalColor devolvia VERDE
  // — a faixa de acento do card ficava verde num periodo que so teve despesa.
  // Sem receita nao ha o que comparar com a meta: a cor passa a refletir o
  // resultado bruto (sobrou/nao sobrou).
  var hasIncome = summary.income > 0;
  var barColor = hasIncome
    ? goalColor(expenseRatio, goalPct, { green: Colors.green, amber: Colors.amber, red: Colors.red })
    : summary.expenses > 0 ? Colors.red : Colors.violet;
  var positive = summary.balance >= 0;

  return (
    <View style={[h.card, { backgroundColor: Colors.bg3, borderColor: Colors.border2 }]}>
      <View style={[h.accent, { backgroundColor: barColor }]} />

      <View style={h.headerRow}>
        <Text style={h.kicker}>
          RESUMO {periodLabel(period)}
          {consolidated ? " · TODAS AS EMPRESAS" : ""}
        </Text>
      </View>

      {/* Uma frase no lugar do score 0-100 + 4 drivers */}
      <Text style={[h.phrase, NARROW ? h.phraseNarrow : null, { color: Colors.ink }]}>
        {insights.health.narrative.headline}
      </Text>
      {/* A subline diz o que fazer com o fato acima. Estava sendo montada e
          descartada desde o F3 — o hero so lia o headline. */}
      {!!insights.health.narrative.subline && (
        <Text style={[h.subphrase, { color: Colors.ink3 }]}>
          {insights.health.narrative.subline}
        </Text>
      )}

      {/* entrou · saiu · sobrou */}
      <View style={NARROW ? h.gridNarrow : h.grid}>
        <View style={[h.cell, { borderLeftColor: Colors.border }]}>
          <View style={h.cellLabelRow}>
            <Icon name="trending_up" size={12} color={Colors.green} />
            <Text style={h.cellLabel}>Entrou</Text>
          </View>
          <AnimatedAmount value={summary.income} reduceMotion={reduceMotion} style={[h.cellValue, { color: Colors.ink }]} />
          <Text style={h.cellMeta}>{incomeCount} entrada{incomeCount === 1 ? "" : "s"}</Text>
        </View>

        <View style={[h.cell, { borderLeftColor: Colors.border }]}>
          <View style={h.cellLabelRow}>
            <Icon name="trending_down" size={12} color={Colors.red} />
            <Text style={h.cellLabel}>Saiu</Text>
          </View>
          <AnimatedAmount value={summary.expenses} reduceMotion={reduceMotion} style={[h.cellValue, { color: Colors.ink }]} />
          <Text style={h.cellMeta}>{expenseCount} saída{expenseCount === 1 ? "" : "s"}</Text>
        </View>

        <View style={[h.cell, h.cellMain, { borderLeftColor: Colors.border }]}>
          <View style={h.cellLabelRow}>
            <Icon name="wallet" size={12} color={Colors.violet3} />
            <Text style={h.cellLabel}>Sobrou</Text>
          </View>
          <View style={h.mainValueRow}>
            <AnimatedAmount
              value={summary.balance}
              reduceMotion={reduceMotion}
              style={[h.cellValue, h.cellValueMain, { color: positive ? Colors.green : Colors.red }]}
            />
            {balanceDelta != null && (
              <View style={[h.deltaChip, { backgroundColor: balanceDelta >= 0 ? Colors.greenD : Colors.redD }]}>
                <Icon name={balanceDelta >= 0 ? "trending_up" : "trending_down"} size={9} color={balanceDelta >= 0 ? Colors.green : Colors.red} />
                <Text style={[h.deltaText, { color: balanceDelta >= 0 ? Colors.green : Colors.red }]}>
                  {Math.abs(balanceDelta).toFixed(0)}%
                </Text>
              </View>
            )}
          </View>
          <Text style={h.cellMeta}>
            {summary.income > 0 ? "sobra de " + marginPct.toFixed(0) + "% do que entrou" : "sem receita no período"}
          </Text>
        </View>
      </View>

      {/* Grafico animado do periodo */}
      <DailyBars buckets={buckets} reduceMotion={reduceMotion} />

      {/* Barra colorida pelo resultado + meta configuravel. So faz sentido
          com receita no periodo — a meta e "quanto do que ENTRA pode virar
          despesa". */}
      {hasIncome && (
        <GoalBar
          expenseRatio={expenseRatio}
          goalPct={goalPct}
          isCustom={isCustom}
          reduceMotion={reduceMotion}
          onEditGoal={function() { setEditing(function(v) { return !v; }); }}
        />
      )}

      {editing && (
        <GoalEditor
          goalPct={goalPct}
          onChange={function(v) { setGoal(v); }}
          onClose={function() { setEditing(false); }}
        />
      )}
    </View>
  );
}

function periodLabel(period: PeriodKey): string {
  switch (period) {
    case "today": return "DE HOJE";
    case "week": return "DA SEMANA";
    case "month": return "DO MÊS";
    case "year": return "DO ANO";
    case "prev_year": return "DO ANO PASSADO";
    case "all": return "GERAL";
    default: return "DO PERÍODO";
  }
}

var h = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    marginBottom: 14,
    overflow: "hidden",
    position: "relative",
  },
  accent: { position: "absolute", top: 0, left: 0, right: 0, height: 3, opacity: 0.9 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  kicker: { fontSize: 9.5, color: Colors.ink3, letterSpacing: 1.4, fontWeight: "700" },
  phrase: {
    fontSize: 21,
    fontWeight: "700",
    letterSpacing: -0.4,
    lineHeight: 28,
    marginTop: 8,
    marginBottom: 18,
    maxWidth: 620,
  },
  phraseNarrow: { fontSize: 17, lineHeight: 23, marginBottom: 14 },
  subphrase: { fontSize: 12.5, lineHeight: 18, marginTop: -12, marginBottom: 18, maxWidth: 620 },

  grid: { flexDirection: "row", gap: 18 },
  gridNarrow: { flexDirection: "column", gap: 12 },
  cell: { flex: 1, borderLeftWidth: 2, paddingLeft: 12 },
  cellMain: { flex: 1.25 },
  cellLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  cellLabel: { fontSize: 9.5, color: Colors.ink3, letterSpacing: 1.2, fontWeight: "800", textTransform: "uppercase" },
  cellValue: { fontSize: 22, fontWeight: "800", letterSpacing: -0.6, marginTop: 4 },
  cellValueMain: { fontSize: 26 },
  cellMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  mainValueRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  deltaChip: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  deltaText: { fontSize: 10.5, fontWeight: "800" },
});

var g = StyleSheet.create({
  wrap: { marginTop: 18 },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 56 },
  col: { flex: 1, height: "100%", justifyContent: "flex-end" },
  // Com poucos dias, limita a largura pra nao virar bloco gigante.
  colSparse: { maxWidth: 54 },
  pair: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: "100%" },
  bar: { flex: 1, borderRadius: 2, minHeight: 2 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 10.5, color: Colors.ink3, fontWeight: "600" },
  legendRange: { fontSize: 10.5, color: Colors.ink3, marginLeft: "auto" },
});

var gb = StyleSheet.create({
  wrap: { marginTop: 18 },
  track: { height: 8, borderRadius: 999, overflow: "hidden", position: "relative" },
  fill: { height: 8, borderRadius: 999 },
  goalMark: { position: "absolute", top: -2, width: 2, height: 12, opacity: 0.55, borderRadius: 1 },
  captionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 9, flexWrap: "wrap" },
  caption: { fontSize: 12.5, fontWeight: "600" },
  goalBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  goalBtnText: { fontSize: 11, fontWeight: "700" },
  hint: { fontSize: 11, marginTop: 6, lineHeight: 15 },
});

var ge = StyleSheet.create({
  wrap: { marginTop: 14, borderRadius: 14, borderWidth: 1, padding: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  title: { fontSize: 14, fontWeight: "700" },
  desc: { fontSize: 11.5, lineHeight: 16, marginBottom: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 7 },
  chipText: { fontSize: 12.5, fontWeight: "600" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 10, flexWrap: "wrap" },
  reset: { fontSize: 11.5, fontWeight: "700" },
  range: { fontSize: 10.5 },
});

export default ResumoHero;
