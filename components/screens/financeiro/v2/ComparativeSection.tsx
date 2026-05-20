// ============================================================
// ComparativeSection — Fase A redesign Financeiro (19/05/2026)
//
// Mostra grafico sobreposto + KPIs delta na Visao Geral.
// Consome /financeiro/comparative do backend via useFinancialComparative.
//
// Modos: mes anterior (default), YoY, custom-vs-custom.
// Tudo dentro de uma CollapsibleSection na TabVisaoGeral.
//
// v2 (19/05 noite): eixo Y rotulado + grid + pontos + delta absoluto
// v3 (20/05 manha): fix esticamento via onLayout (sem viewBox)
// v4 (20/05 tarde): eixo X com datas DD/MM + KPI 2 colunas (Atual/Anterior)
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput, Platform } from "react-native";
import Svg, { Path, Line, Circle, Text as SvgText } from "react-native-svg";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import {
  useFinancialComparative,
  type CompareWith,
  type ComparativePeriod,
  type DailyPoint,
} from "@/hooks/useFinancialComparative";

type Props = {
  // Periodo corrente: vem do FinanceiroTopbar (mesma fonte que SmartBalance/etc)
  period: ComparativePeriod;
  customStart?: string;   // ISO YYYY-MM-DD
  customEnd?: string;
};

var COMPARE_OPTIONS: { value: CompareWith; label: string; short: string }[] = [
  { value: "previous_period", label: "Periodo anterior", short: "vs anterior" },
  { value: "yoy", label: "Ano passado (YoY)", short: "vs ano passado" },
  { value: "custom", label: "Periodo customizado", short: "vs custom" },
];

function fmtBRLCompact(v: number): string {
  if (Math.abs(v) >= 1000000) return "R$ " + (v / 1000000).toFixed(1).replace(".", ",") + "M";
  if (Math.abs(v) >= 1000) return "R$ " + (v / 1000).toFixed(1).replace(".", ",") + "k";
  return "R$ " + Math.round(v).toLocaleString("pt-BR");
}

function fmtDelta(v: number | null): { text: string; color: string; arrow: "up" | "down" | "flat" } {
  if (v == null || !isFinite(v)) return { text: "—", color: Colors.ink3, arrow: "flat" };
  if (Math.abs(v) < 0.1) return { text: "0%", color: Colors.ink3, arrow: "flat" };
  var arrow: "up" | "down" = v > 0 ? "up" : "down";
  var sign = v > 0 ? "+" : "";
  return { text: sign + v.toFixed(1).replace(".", ",") + "%", color: v > 0 ? Colors.green : Colors.red, arrow };
}

// Formata o delta absoluto em R$ com sinal: "+R$ 5,0k" ou "−R$ 17,8k" ou "—"
function fmtDeltaAbs(current: number, previous: number): { text: string; arrow: "up" | "down" | "flat" } {
  var diff = current - previous;
  if (Math.abs(diff) < 1) return { text: "—", arrow: "flat" };
  var arrow: "up" | "down" = diff > 0 ? "up" : "down";
  var sign = diff > 0 ? "+" : "−";
  return { text: sign + fmtBRLCompact(Math.abs(diff)), arrow };
}

// "2026-05-19" → "19/05"
function fmtDM(iso: string): string {
  if (!iso) return "";
  var parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return parts[2] + "/" + parts[1];
}

// dd/mm/aaaa → yyyy-mm-dd (null se invalido)
function brToISO(br: string): string | null {
  var parts = br.split("/");
  if (parts.length !== 3 || parts[2].length !== 4) return null;
  var d = parseInt(parts[0]); var m = parseInt(parts[1]); var y = parseInt(parts[2]);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2020) return null;
  return y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}
function maskDate(v: string): string {
  var d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length >= 5) return d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4);
  if (d.length >= 3) return d.slice(0, 2) + "/" + d.slice(2);
  return d;
}

export function ComparativeSection({ period, customStart, customEnd }: Props) {
  var [compareWith, setCompareWith] = useState<CompareWith>("previous_period");
  var [compareStartBR, setCompareStartBR] = useState("");
  var [compareEndBR, setCompareEndBR] = useState("");

  var compareStart = brToISO(compareStartBR) || undefined;
  var compareEnd = brToISO(compareEndBR) || undefined;

  var query = useFinancialComparative({
    period,
    compareWith,
    start: customStart,
    end: customEnd,
    compareStart,
    compareEnd,
  });

  var data = query.data;
  var loading = query.isLoading || query.isFetching;
  var customComparePending = compareWith === "custom" && (!compareStart || !compareEnd);

  return (
    <View>
      {/* Selector + custom dates (quando aplicavel) */}
      <View style={s.selectorRow}>
        <Text style={s.selectorLabel}>Comparar com</Text>
        <View style={s.selectorGroup}>
          {COMPARE_OPTIONS.map(function (opt) {
            var active = compareWith === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={function () { setCompareWith(opt.value); }}
                style={[s.selectorBtn, active && s.selectorBtnActive]}
              >
                <Text style={[s.selectorBtnText, active && s.selectorBtnTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {compareWith === "custom" && (
        <View style={s.customRow}>
          <View style={s.customField}>
            <Text style={s.customLabel}>De</Text>
            <TextInput
              style={s.customInput}
              value={compareStartBR}
              onChangeText={function (v) { setCompareStartBR(maskDate(v)); }}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={Colors.ink3}
              keyboardType="number-pad"
              maxLength={10}
            />
          </View>
          <View style={s.customField}>
            <Text style={s.customLabel}>Ate</Text>
            <TextInput
              style={s.customInput}
              value={compareEndBR}
              onChangeText={function (v) { setCompareEndBR(maskDate(v)); }}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={Colors.ink3}
              keyboardType="number-pad"
              maxLength={10}
            />
          </View>
          {customComparePending && (
            <Text style={s.customHint}>Informe as duas datas pra carregar o comparativo.</Text>
          )}
        </View>
      )}

      {/* Loading */}
      {loading && !data && (
        <View style={s.placeholder}><Text style={s.placeholderText}>Carregando comparativo...</Text></View>
      )}

      {/* Empty / erro */}
      {!loading && !data && !customComparePending && (
        <View style={s.placeholder}><Text style={s.placeholderText}>Sem dados pra comparar nesse periodo.</Text></View>
      )}

      {/* Conteudo */}
      {data && (
        <View>
          {/* KPI Row — agora com Atual/Anterior explicitos */}
          <View style={s.kpiRow}>
            <KpiCard
              label="Receita"
              current={data.current.totals.income}
              previous={data.previous.totals.income}
              delta={data.delta.income_pct}
              currentLabel={data.current.label}
              previousLabel={data.previous.label}
              positiveIsGood
            />
            <KpiCard
              label="Despesa"
              current={data.current.totals.expenses}
              previous={data.previous.totals.expenses}
              delta={data.delta.expenses_pct}
              currentLabel={data.current.label}
              previousLabel={data.previous.label}
              positiveIsGood={false}
            />
            <KpiCard
              label="Saldo"
              current={data.current.totals.net}
              previous={data.previous.totals.net}
              delta={data.delta.net_pct}
              currentLabel={data.current.label}
              previousLabel={data.previous.label}
              positiveIsGood
            />
          </View>

          {/* Chart */}
          <View style={s.chartCard}>
            <ComparativeChart current={data.current.daily} previous={data.previous.daily} />
            {/* Legenda */}
            <View style={s.legendRow}>
              <LegendItem dot={Colors.violet} dashed={false} label={data.current.label || "Atual"} />
              <LegendItem dot={Colors.ink3} dashed={true} label={data.previous.label || "Comparativo"} />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ----- Sub-componentes -----

function KpiCard({
  label, current, previous, delta, currentLabel, previousLabel, positiveIsGood,
}: {
  label: string;
  current: number;
  previous: number;
  delta: number | null;
  currentLabel: string;
  previousLabel: string;
  positiveIsGood: boolean;
}) {
  var d = fmtDelta(delta);
  var dAbs = fmtDeltaAbs(current, previous);
  // Pra despesa, "subiu" é ruim (vermelho), "caiu" é bom (verde). Inverte a cor logica do delta.
  var deltaColor = d.color;
  if (!positiveIsGood && d.arrow !== "flat") {
    deltaColor = d.arrow === "up" ? Colors.red : Colors.green;
  }

  // Linha resumo: "↓ −R$ 17,8k (−65,8%)" ou "—"
  var changeText: string;
  if (d.arrow === "flat" || dAbs.arrow === "flat") {
    changeText = "Sem variacao";
  } else {
    changeText = dAbs.text + " (" + d.text + ")";
  }

  return (
    <View style={s.kpiCard}>
      <Text style={s.kpiCategory}>{label}</Text>

      {/* 2 colunas: Atual | Anterior */}
      <View style={s.kpiTwoCol}>
        <View style={s.kpiCol}>
          <Text style={s.kpiColLabel} numberOfLines={1}>Atual{currentLabel ? " · " + currentLabel : ""}</Text>
          <Text style={s.kpiColValueCurrent}>{fmtBRLCompact(current)}</Text>
        </View>
        <View style={s.kpiColDivider} />
        <View style={s.kpiCol}>
          <Text style={s.kpiColLabel} numberOfLines={1}>Anterior{previousLabel ? " · " + previousLabel : ""}</Text>
          <Text style={s.kpiColValuePrevious}>{fmtBRLCompact(previous)}</Text>
        </View>
      </View>

      {/* Linha de variacao destacada */}
      <View style={[s.kpiChangePill, { backgroundColor: deltaColor + "18", borderColor: deltaColor + "40" }]}>
        <Icon
          name={d.arrow === "up" ? "arrow_up_right" : d.arrow === "down" ? "arrow_down_right" : "minus"}
          size={12}
          color={deltaColor}
        />
        <Text style={[s.kpiChangeText, { color: deltaColor }]}>{changeText}</Text>
      </View>
    </View>
  );
}

function LegendItem({ dot, dashed, label }: { dot: string; dashed: boolean; label: string }) {
  return (
    <View style={s.legendItem}>
      <View style={[s.legendLine, { backgroundColor: dashed ? "transparent" : dot, borderColor: dot, borderStyle: dashed ? "dashed" : "solid", borderWidth: dashed ? 1.5 : 0 }]} />
      <Text style={s.legendLabel}>{label}</Text>
    </View>
  );
}

// ----- Chart SVG -----
// Renderiza 2 linhas sobrepostas (current e previous) com escala alinhada
// pelo maior valor das 2 series. Eixo X mostra datas DD/MM (5 labels) do
// periodo atual.
function ComparativeChart({ current, previous }: { current: DailyPoint[]; previous: DailyPoint[] }) {
  // W comeca em 600 (fallback) e atualiza no primeiro render pos-layout.
  var [W, setW] = useState<number>(600);
  var H = 240;
  var PAD = { top: 20, right: 24, bottom: 40, left: 60 };

  var chart = useMemo(function () {
    var n = Math.max(current.length, previous.length);
    if (n === 0) return null;

    // Usa "net" como linha principal (saldo dia a dia).
    var curVals = current.map(function (d) { return d.net; });
    var prevVals = previous.map(function (d) { return d.net; });

    var allVals = curVals.concat(prevVals).concat([0]); // sempre inclui 0 no range pra grafico nao ficar "flutuando"
    var maxV = Math.max.apply(null, allVals);
    var minV = Math.min.apply(null, allVals);
    if (maxV === minV) { maxV += 1; minV -= 1; }
    var span = maxV - minV;
    var paddedMax = maxV + span * 0.15;
    var paddedMin = minV - span * 0.05;
    var paddedSpan = paddedMax - paddedMin;

    function x(i: number): number {
      if (n === 1) return PAD.left + (W - PAD.left - PAD.right) / 2;
      return PAD.left + (i / (n - 1)) * (W - PAD.left - PAD.right);
    }
    function y(val: number): number {
      var ratio = (val - paddedMin) / paddedSpan;
      return PAD.top + (1 - ratio) * (H - PAD.top - PAD.bottom);
    }

    function buildPath(vals: number[]): string {
      if (vals.length === 0) return "";
      var parts: string[] = [];
      vals.forEach(function (v, i) {
        var px = x(i);
        var py = y(v);
        parts.push((i === 0 ? "M" : "L") + px.toFixed(1) + "," + py.toFixed(1));
      });
      return parts.join(" ");
    }

    // Ticks Y igualmente espacados entre paddedMin e paddedMax
    var ticks: Array<{ value: number; y: number }> = [];
    var TICK_COUNT = 4;
    for (var i = 0; i <= TICK_COUNT; i++) {
      var v = paddedMin + (i / TICK_COUNT) * paddedSpan;
      ticks.push({ value: v, y: y(v) });
    }

    // Labels X: 5 datas do periodo atual (primeiro, 25%, 50%, 75%, ultimo).
    // Se a current tem menos de 5 pontos, usa todos.
    var xLabels: Array<{ x: number; label: string }> = [];
    var nCur = current.length;
    if (nCur > 0) {
      var positions: number[];
      if (nCur <= 5) {
        positions = current.map(function (_, i) { return i; });
      } else {
        positions = [0, Math.floor(nCur * 0.25), Math.floor(nCur * 0.5), Math.floor(nCur * 0.75), nCur - 1];
      }
      // dedup (caso nCur=1 ou floor colisao)
      var seen: Record<number, boolean> = {};
      positions = positions.filter(function (p) { if (seen[p]) return false; seen[p] = true; return true; });
      xLabels = positions.map(function (i) {
        return { x: x(i), label: fmtDM(current[i].date) };
      });
    }

    // Pontos por indice (current + previous)
    var currentPoints = curVals.map(function (v, i) { return { x: x(i), y: y(v), value: v }; });
    var previousPoints = prevVals.map(function (v, i) { return { x: x(i), y: y(v), value: v }; });

    // Indices do MAX de cada serie (label ancorado no pico)
    var curMaxIdx = 0;
    for (var i = 1; i < curVals.length; i++) { if (curVals[i] > curVals[curMaxIdx]) curMaxIdx = i; }
    var prevMaxIdx = 0;
    for (var i = 1; i < prevVals.length; i++) { if (prevVals[i] > prevVals[prevMaxIdx]) prevMaxIdx = i; }

    var zeroY = y(0);
    return {
      currentPath: buildPath(curVals),
      previousPath: buildPath(prevVals),
      zeroY: zeroY > PAD.top && zeroY < H - PAD.bottom ? zeroY : null,
      ticks: ticks,
      xLabels: xLabels,
      currentPoints: currentPoints,
      previousPoints: previousPoints,
      curMaxIdx: curMaxIdx,
      prevMaxIdx: prevMaxIdx,
      curMaxValue: curVals.length > 0 ? curVals[curMaxIdx] : 0,
      prevMaxValue: prevVals.length > 0 ? prevVals[prevMaxIdx] : 0,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, previous, W]);

  return (
    <View
      style={{ width: "100%", height: H }}
      onLayout={function (e) {
        var w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - W) > 1) setW(w);
      }}
    >
      {chart ? (
        <Svg width={W} height={H}>
          {/* Grid horizontal + labels Y */}
          {chart.ticks.flatMap(function (t, i) {
            var isZero = Math.abs(t.value) < 0.5;
            return [
              <Line
                key={"tick-line-" + i}
                x1={PAD.left}
                x2={W - PAD.right}
                y1={t.y}
                y2={t.y}
                stroke={isZero ? Colors.ink3 : Colors.border}
                strokeWidth={isZero ? 1 : 0.5}
                strokeDasharray={isZero ? "4,3" : "2,4"}
                opacity={isZero ? 0.7 : 0.4}
              />,
              <SvgText
                key={"tick-text-" + i}
                x={PAD.left - 8}
                y={t.y + 3}
                fontSize="10"
                fontWeight="600"
                fill={Colors.ink3}
                textAnchor="end"
              >
                {fmtBRLCompact(t.value)}
              </SvgText>,
            ];
          })}

          {/* Eixo X — linha sutil + labels DD/MM */}
          <Line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={H - PAD.bottom}
            y2={H - PAD.bottom}
            stroke={Colors.border}
            strokeWidth={0.8}
            opacity={0.6}
          />
          {chart.xLabels.map(function (xl, i) {
            return (
              <SvgText
                key={"xlabel-" + i}
                x={xl.x}
                y={H - PAD.bottom + 18}
                fontSize="10"
                fontWeight="600"
                fill={Colors.ink3}
                textAnchor="middle"
              >
                {xl.label}
              </SvgText>
            );
          })}

          {/* Previous (comparativo) — cinza pontilhado, atras */}
          <Path d={chart.previousPath} stroke={Colors.ink3} strokeWidth={1.8} strokeDasharray="4,4" fill="none" opacity={0.7} />
          {/* Pontos da previous (sutis) */}
          {chart.previousPoints.map(function (p, i) {
            return <Circle key={"prev-pt-" + i} cx={p.x} cy={p.y} r={i === chart.prevMaxIdx ? 3 : 1.5} fill={Colors.ink3} opacity={0.65} />;
          })}

          {/* Current — violeta solido, na frente */}
          <Path d={chart.currentPath} stroke={Colors.violet} strokeWidth={2.4} fill="none" />
          {/* Pontos da current */}
          {chart.currentPoints.map(function (p, i) {
            var isMax = i === chart.curMaxIdx;
            var isLast = i === chart.currentPoints.length - 1;
            return (
              <Circle
                key={"cur-pt-" + i}
                cx={p.x}
                cy={p.y}
                r={isMax || isLast ? 4 : 2.2}
                fill={Colors.violet}
                stroke={isMax || isLast ? "#fff" : "transparent"}
                strokeWidth={isMax || isLast ? 1.4 : 0}
              />
            );
          })}

          {/* Label do MAX da current (sobre o pico) */}
          {chart.currentPoints.length > 0 && chart.curMaxValue > 0 && (
            <SvgText
              x={chart.currentPoints[chart.curMaxIdx].x}
              y={Math.max(PAD.top + 8, chart.currentPoints[chart.curMaxIdx].y - 10)}
              fontSize="11"
              fontWeight="700"
              fill={Colors.violet}
              textAnchor="middle"
            >
              {fmtBRLCompact(chart.curMaxValue)}
            </SvgText>
          )}
          {/* Label do MAX da previous (sutil) — so renderiza se nao colidir com label da current */}
          {chart.previousPoints.length > 0 && chart.prevMaxValue > 0 && Math.abs(chart.curMaxIdx - chart.prevMaxIdx) > 2 && (
            <SvgText
              x={chart.previousPoints[chart.prevMaxIdx].x}
              y={Math.max(PAD.top + 8, chart.previousPoints[chart.prevMaxIdx].y - 10)}
              fontSize="10"
              fontWeight="600"
              fill={Colors.ink3}
              textAnchor="middle"
              opacity={0.85}
            >
              {fmtBRLCompact(chart.prevMaxValue)}
            </SvgText>
          )}
        </Svg>
      ) : (
        <View style={s.chartEmpty}>
          <Text style={s.placeholderText}>Sem pontos no periodo.</Text>
        </View>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  selectorRow: { gap: 10, marginBottom: 12 },
  selectorLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  selectorGroup: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  selectorBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  selectorBtnActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  selectorBtnText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  selectorBtnTextActive: { color: "#fff", fontWeight: "600" },
  customRow: { flexDirection: "row", gap: 10, marginBottom: 12, backgroundColor: Colors.bg3, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", flexWrap: "wrap" },
  customField: { flex: 1, minWidth: 130 },
  customLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 },
  customInput: { backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.ink, textAlign: "center" },
  customHint: { fontSize: 11, color: Colors.amber, fontStyle: "italic", flexBasis: "100%" },

  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 14, flexWrap: "wrap" },
  kpiCard: {
    flex: 1,
    minWidth: 230,
    backgroundColor: Colors.bg3,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  kpiCategory: {
    fontSize: 10,
    color: Colors.ink3,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  kpiTwoCol: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 12,
  },
  kpiCol: {
    flex: 1,
    gap: 3,
  },
  kpiColDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 10,
  },
  kpiColLabel: {
    fontSize: 9.5,
    color: Colors.ink3,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  kpiColValueCurrent: {
    fontSize: 18,
    color: Colors.ink,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  kpiColValuePrevious: {
    fontSize: 16,
    color: Colors.ink2,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  kpiChangePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  kpiChangeText: { fontSize: 12, fontWeight: "700" },

  chartCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  chartEmpty: { padding: 24, alignItems: "center", justifyContent: "center" },
  legendRow: { flexDirection: "row", gap: 18, marginTop: 10, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendLine: { width: 18, height: 2.5, borderRadius: 1.5 },
  legendLabel: { fontSize: 11, color: Colors.ink2, fontWeight: "500" },
  placeholder: { padding: 24, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg3, borderRadius: 14, borderWidth: 1, borderColor: Colors.border },
  placeholderText: { fontSize: 12, color: Colors.ink3 },
});
