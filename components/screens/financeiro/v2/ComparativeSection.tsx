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
// v5 (12/11, p-112): o grafico escolhe a serie — Saldo (padrao, igual ao de
//   antes), Receita, Despesa ou Receita e despesa. Tocar (ou passar o mouse)
//   num dia mostra data e valores; a serie escolhida fica lembrada por usuario.
//   "Receita" e o mesmo termo dos cartoes: a serie income do backend soma todo
//   lancamento de entrada confirmado, nao so venda.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput, Platform } from "react-native";
import Svg, { Path, Line, Circle, Text as SvgText } from "react-native-svg";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import {
  useFinancialComparative,
  type CompareWith,
  type ComparativePeriod,
  type DailyPoint,
} from "@/hooks/useFinancialComparative";

// ── Serie do grafico ────────────────────────────────────────
export type SerieComparativo = "saldo" | "receita" | "despesa" | "ambos";

export var SERIE_OPTIONS: { value: SerieComparativo; label: string; title: string }[] = [
  { value: "saldo", label: "Saldo", title: "Saldo por dia" },
  { value: "receita", label: "Receita", title: "Receita por dia" },
  { value: "despesa", label: "Despesa", title: "Despesa por dia" },
  { value: "ambos", label: "Receita e despesa", title: "Receita e despesa por dia" },
];

type SerieKey = "net" | "income" | "expenses";
type SerieDef = {
  key: SerieKey;
  label: string;
  color: string;       // periodo atual (solido)
  prevColor: string;   // periodo anterior (tracejado)
  prevOpacity: number;
  prevPointOpacity: number;
};

// Cores lidas na chamada (Colors troca com o tema). Saldo mantem o violeta +
// cinza de antes; nas series isoladas o anterior segue cinza; no modo com duas
// series cada uma leva a sua cor tambem no tracejado, pra nao virar 2 cinzas.
function seriesFor(serie: SerieComparativo): SerieDef[] {
  if (serie === "receita") {
    return [{ key: "income", label: "Receita", color: Colors.green, prevColor: Colors.ink3, prevOpacity: 0.7, prevPointOpacity: 0.65 }];
  }
  if (serie === "despesa") {
    return [{ key: "expenses", label: "Despesa", color: Colors.red, prevColor: Colors.ink3, prevOpacity: 0.7, prevPointOpacity: 0.65 }];
  }
  if (serie === "ambos") {
    return [
      { key: "income", label: "Receita", color: Colors.green, prevColor: Colors.green, prevOpacity: 0.55, prevPointOpacity: 0.5 },
      { key: "expenses", label: "Despesa", color: Colors.red, prevColor: Colors.red, prevOpacity: 0.55, prevPointOpacity: 0.5 },
    ];
  }
  return [{ key: "net", label: "Saldo", color: Colors.violet, prevColor: Colors.ink3, prevOpacity: 0.7, prevPointOpacity: 0.65 }];
}

// Lembrada por usuario, mesmo padrao do CollapsibleSection e do seletor da
// Curva ABC (localStorage + try/catch em toda leitura e escrita). A chave leva
// o id do usuario: duas pessoas no mesmo navegador nao herdam a escolha.
var SERIE_STORAGE_PREFIX = "aura.financeiro.comparativo.serie.";

function isSerie(v: any): v is SerieComparativo {
  return v === "saldo" || v === "receita" || v === "despesa" || v === "ambos";
}

export function getInitialSerie(userId: string | null | undefined): SerieComparativo {
  if (!userId || typeof window === "undefined" || !window.localStorage) return "saldo";
  try {
    var raw = window.localStorage.getItem(SERIE_STORAGE_PREFIX + userId);
    return isSerie(raw) ? raw : "saldo";
  } catch {
    return "saldo";
  }
}

export function persistSerie(userId: string | null | undefined, serie: SerieComparativo) {
  if (!userId || typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(SERIE_STORAGE_PREFIX + userId, serie);
  } catch {
    // storage cheio ou desabilitado — silencioso
  }
}

// Valor cheio pro detalhe do dia ("R$ 1.234,50"); o eixo segue compacto.
function fmtBRLFull(v: number): string {
  try {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  } catch {
    return "R$ " + v.toFixed(2).replace(".", ",");
  }
}

type Props = {
  // Periodo corrente: vem do FinanceiroTopbar (mesma fonte que SmartBalance/etc)
  period: ComparativePeriod;
  customStart?: string;   // ISO YYYY-MM-DD
  customEnd?: string;
};

var COMPARE_OPTIONS: { value: CompareWith; label: string; short: string }[] = [
  { value: "previous_period", label: "Período anterior", short: "vs anterior" },
  { value: "yoy", label: "Ano passado (YoY)", short: "vs ano passado" },
  { value: "custom", label: "Período personalizado", short: "vs custom" },
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

  var userId = useAuthStore(function (state: any) { return state.user && state.user.id; }) as string | undefined;
  var [serie, setSerie] = useState<SerieComparativo>(function () { return getInitialSerie(userId); });
  // O usuario pode chegar depois do primeiro render (hidratacao do /auth/me).
  useEffect(function () {
    var stored = getInitialSerie(userId);
    setSerie(function (cur) { return cur === stored ? cur : stored; });
  }, [userId]);
  function chooseSerie(next: SerieComparativo) {
    setSerie(next);
    persistSerie(userId, next);
  }
  var serieOpt = SERIE_OPTIONS.find(function (o) { return o.value === serie; }) || SERIE_OPTIONS[0];
  var serieDefs = seriesFor(serie);

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
            <Text style={s.customLabel}>Até</Text>
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
        <View style={s.placeholder}><Text style={s.placeholderText}>Sem dados para comparar neste período.</Text></View>
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
            {/* Titulo diz a serie; seletor logo acima do grafico */}
            <View style={s.chartHeader}>
              <Text style={s.chartTitle} testID="comparativo-titulo">{serieOpt.title}</Text>
              <View style={s.serieGroup} accessibilityRole="radiogroup">
                {SERIE_OPTIONS.map(function (opt) {
                  var active = serie === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      testID={"comparativo-serie-" + opt.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      onPress={function () { chooseSerie(opt.value); }}
                      style={[s.serieBtn, active && s.selectorBtnActive]}
                    >
                      <Text style={[s.serieBtnText, active && s.selectorBtnTextActive]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <ComparativeChart
              current={data.current.daily}
              previous={data.previous.daily}
              serie={serie}
              defs={serieDefs}
            />
            {/* Legenda */}
            {serieDefs.length === 1 ? (
              <View style={s.legendRow}>
                <LegendItem dot={serieDefs[0].color} dashed={false} label={data.current.label || "Atual"} />
                <LegendItem dot={Colors.ink3} dashed={true} label={data.previous.label || "Comparativo"} />
              </View>
            ) : (
              <View style={s.legendRow}>
                {serieDefs.map(function (d) {
                  return <LegendItem key={d.key} dot={d.color} dashed={false} label={d.label} />;
                })}
                <LegendItem dot={Colors.ink2} dashed={false} label={"Atual · " + (data.current.label || "período")} />
                <LegendItem dot={Colors.ink3} dashed={true} label={"Anterior · " + (data.previous.label || "comparativo")} />
              </View>
            )}
            <Text style={s.chartHint}>Toque num dia do gráfico para ver a data e os valores.</Text>
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
    changeText = "Sem variação";
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
// Renderiza, pra cada serie escolhida, 2 linhas sobrepostas (current solida e
// previous tracejada) com escala alinhada pelo maior valor de todas as linhas.
// Eixo X mostra datas DD/MM (5 labels) do periodo atual.
//
// Modo Saldo desenha exatamente o SVG de antes do p-112 (prova em
// __tests__/financeiroComparativoSeries.test.tsx). As outras series mudam so a
// escala: valores nao negativos comecam o eixo em R$ 0, sem a folga de 5% pra
// baixo que fazia aparecer um rotulo negativo num grafico de receita.
//
// Detalhe do dia: cada dia tem uma faixa tocavel (Pressable) por cima do SVG.
// Toque fixa o dia (toque de novo solta); no web o mouse tambem mostra, mas o
// toque e o caminho principal — nada depende de hover (regra 7 do CLAUDE.md).
type SeriePlot = {
  def: SerieDef;
  curVals: number[];
  prevVals: number[];
  currentPath: string;
  previousPath: string;
  currentPoints: Array<{ x: number; y: number; value: number }>;
  previousPoints: Array<{ x: number; y: number; value: number }>;
  curMaxIdx: number;
  prevMaxIdx: number;
  curMaxValue: number;
  prevMaxValue: number;
};

var TOOLTIP_W = 196;

function ComparativeChart({
  current, previous, serie, defs,
}: {
  current: DailyPoint[];
  previous: DailyPoint[];
  serie: SerieComparativo;
  defs: SerieDef[];
}) {
  // W comeca em 600 (fallback) e atualiza no primeiro render pos-layout.
  var [W, setW] = useState<number>(600);
  var H = 240;
  var PAD = { top: 20, right: 24, bottom: 40, left: 60 };

  // Dia em destaque: fixado por toque/clique, ou sob o mouse (so web).
  var [pinnedIdx, setPinnedIdx] = useState<number | null>(null);
  var [hoverIdx, setHoverIdx] = useState<number | null>(null);
  useEffect(function () {
    setPinnedIdx(null);
    setHoverIdx(null);
  }, [current, previous]);

  var chart = useMemo(function () {
    var n = Math.max(current.length, previous.length);
    if (n === 0) return null;

    var plots: SeriePlot[] = defs.map(function (def) {
      return {
        def: def,
        curVals: current.map(function (d) { return d[def.key]; }),
        prevVals: previous.map(function (d) { return d[def.key]; }),
      } as SeriePlot;
    });

    var allVals: number[] = [0]; // sempre inclui 0 no range pra grafico nao ficar "flutuando"
    plots.forEach(function (p) { allVals = p.curVals.concat(p.prevVals).concat(allVals); });
    var maxV = Math.max.apply(null, allVals);
    var minV = Math.min.apply(null, allVals);
    var paddedMax: number;
    var paddedMin: number;
    if (serie === "saldo") {
      // Mesma conta de antes do p-112.
      if (maxV === minV) { maxV += 1; minV -= 1; }
      var span = maxV - minV;
      paddedMax = maxV + span * 0.15;
      paddedMin = minV - span * 0.05;
    } else {
      // Receita/despesa: eixo a partir de R$ 0 quando nao ha valor negativo.
      if (maxV === minV) { maxV = minV + 1; }
      var spanZ = maxV - minV;
      paddedMax = maxV + spanZ * 0.15;
      paddedMin = minV < 0 ? minV - spanZ * 0.05 : 0;
    }
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

    plots.forEach(function (p) {
      p.currentPath = buildPath(p.curVals);
      p.previousPath = buildPath(p.prevVals);
      p.currentPoints = p.curVals.map(function (v, i) { return { x: x(i), y: y(v), value: v }; });
      p.previousPoints = p.prevVals.map(function (v, i) { return { x: x(i), y: y(v), value: v }; });
      // Indices do MAX de cada linha (label ancorado no pico)
      var cm = 0;
      for (var k = 1; k < p.curVals.length; k++) { if (p.curVals[k] > p.curVals[cm]) cm = k; }
      var pm = 0;
      for (var k2 = 1; k2 < p.prevVals.length; k2++) { if (p.prevVals[k2] > p.prevVals[pm]) pm = k2; }
      p.curMaxIdx = cm;
      p.prevMaxIdx = pm;
      p.curMaxValue = p.curVals.length > 0 ? p.curVals[cm] : 0;
      p.prevMaxValue = p.prevVals.length > 0 ? p.prevVals[pm] : 0;
    });

    // Faixas tocaveis: uma por dia, centrada no x do dia.
    var colW = n === 1 ? (W - PAD.left - PAD.right) : (W - PAD.left - PAD.right) / (n - 1);
    var columns: Array<{ i: number; x: number; left: number; width: number }> = [];
    for (var c = 0; c < n; c++) {
      var cx = x(c);
      var left = Math.max(0, cx - colW / 2);
      var right = Math.min(W, cx + colW / 2);
      columns.push({ i: c, x: cx, left: left, width: Math.max(1, right - left) });
    }

    return { n: n, ticks: ticks, xLabels: xLabels, plots: plots, columns: columns };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, previous, W, serie, defs]);

  var selIdx = hoverIdx != null ? hoverIdx : pinnedIdx;
  if (chart && selIdx != null && selIdx >= chart.n) selIdx = null;

  function dayLabel(i: number): string {
    var cur = current[i];
    var prev = previous[i];
    var parts: string[] = [];
    defs.forEach(function (d) {
      parts.push(d.label + " " + (cur ? fmtBRLFull(cur[d.key]) : "sem dado"));
      if (prev) parts.push("anterior " + fmtBRLFull(prev[d.key]));
    });
    return "Dia " + (cur ? fmtDM(cur.date) : prev ? fmtDM(prev.date) : String(i + 1)) + ": " + parts.join(", ");
  }

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

          {/* Previous (comparativo) — tracejado, atras de todas as current */}
          {chart.plots.flatMap(function (p) {
            var k = p.def.key;
            return [
              <Path key={"prev-path-" + k} d={p.previousPath} stroke={p.def.prevColor} strokeWidth={1.8} strokeDasharray="4,4" fill="none" opacity={p.def.prevOpacity} />,
            ].concat(p.previousPoints.map(function (pt, i) {
              return <Circle key={"prev-pt-" + k + "-" + i} cx={pt.x} cy={pt.y} r={i === p.prevMaxIdx ? 3 : 1.5} fill={p.def.prevColor} opacity={p.def.prevPointOpacity} />;
            }));
          })}

          {/* Current — solido, na frente */}
          {chart.plots.flatMap(function (p) {
            var k = p.def.key;
            return [
              <Path key={"cur-path-" + k} d={p.currentPath} stroke={p.def.color} strokeWidth={2.4} fill="none" />,
            ].concat(p.currentPoints.map(function (pt, i) {
              var isMax = i === p.curMaxIdx;
              var isLast = i === p.currentPoints.length - 1;
              return (
                <Circle
                  key={"cur-pt-" + k + "-" + i}
                  cx={pt.x}
                  cy={pt.y}
                  r={isMax || isLast ? 4 : 2.2}
                  fill={p.def.color}
                  stroke={isMax || isLast ? "#fff" : "transparent"}
                  strokeWidth={isMax || isLast ? 1.4 : 0}
                />
              );
            }));
          })}

          {chart.plots.length === 1 ? (
            <>
              {/* Label do MAX da current (sobre o pico) */}
              {chart.plots[0].currentPoints.length > 0 && chart.plots[0].curMaxValue > 0 && (
                <SvgText
                  x={chart.plots[0].currentPoints[chart.plots[0].curMaxIdx].x}
                  y={Math.max(PAD.top + 8, chart.plots[0].currentPoints[chart.plots[0].curMaxIdx].y - 10)}
                  fontSize="11"
                  fontWeight="700"
                  fill={chart.plots[0].def.color}
                  textAnchor="middle"
                >
                  {fmtBRLCompact(chart.plots[0].curMaxValue)}
                </SvgText>
              )}
              {/* Label do MAX da previous (sutil) — so renderiza se nao colidir com label da current */}
              {chart.plots[0].previousPoints.length > 0 && chart.plots[0].prevMaxValue > 0 && Math.abs(chart.plots[0].curMaxIdx - chart.plots[0].prevMaxIdx) > 2 && (
                <SvgText
                  x={chart.plots[0].previousPoints[chart.plots[0].prevMaxIdx].x}
                  y={Math.max(PAD.top + 8, chart.plots[0].previousPoints[chart.plots[0].prevMaxIdx].y - 10)}
                  fontSize="10"
                  fontWeight="600"
                  fill={Colors.ink3}
                  textAnchor="middle"
                  opacity={0.85}
                >
                  {fmtBRLCompact(chart.plots[0].prevMaxValue)}
                </SvgText>
              )}
            </>
          ) : (
            // Duas series: so o pico da current de cada uma; o segundo cai fora
            // se ficaria em cima do primeiro (o detalhe do dia mostra os dois).
            chart.plots.map(function (p, idx) {
              if (p.currentPoints.length === 0 || p.curMaxValue <= 0) return null;
              var pt = p.currentPoints[p.curMaxIdx];
              if (idx > 0) {
                var first = chart!.plots[0];
                if (first.currentPoints.length > 0 && first.curMaxValue > 0) {
                  var fp = first.currentPoints[first.curMaxIdx];
                  if (Math.abs(fp.x - pt.x) < 48 && Math.abs(fp.y - pt.y) < 14) return null;
                }
              }
              return (
                <SvgText
                  key={"max-" + p.def.key}
                  x={pt.x}
                  y={Math.max(PAD.top + 8, pt.y - 10)}
                  fontSize="11"
                  fontWeight="700"
                  fill={p.def.color}
                  textAnchor="middle"
                >
                  {fmtBRLCompact(p.curMaxValue)}
                </SvgText>
              );
            })
          )}

          {/* Dia em destaque: guia vertical + pontos realcados */}
          {selIdx != null && (
            <>
              <Line
                x1={chart.columns[selIdx].x}
                x2={chart.columns[selIdx].x}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke={Colors.ink3}
                strokeWidth={1}
                strokeDasharray="3,3"
                opacity={0.8}
              />
              {chart.plots.flatMap(function (p) {
                var out: any[] = [];
                var pp = p.previousPoints[selIdx as number];
                var cp = p.currentPoints[selIdx as number];
                if (pp) out.push(<Circle key={"sel-prev-" + p.def.key} cx={pp.x} cy={pp.y} r={4} fill={p.def.prevColor} stroke="#fff" strokeWidth={1.2} />);
                if (cp) out.push(<Circle key={"sel-cur-" + p.def.key} cx={cp.x} cy={cp.y} r={5.5} fill={p.def.color} stroke="#fff" strokeWidth={1.6} />);
                return out;
              })}
            </>
          )}
        </Svg>
      ) : (
        <View style={s.chartEmpty}>
          <Text style={s.placeholderText}>Sem movimentação neste período.</Text>
        </View>
      )}

      {/* Faixas tocaveis por dia (toque fixa; mouse no web so mostra) */}
      {chart && chart.columns.map(function (col) {
        return (
          <Pressable
            key={"hit-" + col.i}
            testID={"comparativo-ponto-" + col.i}
            accessibilityRole="button"
            accessibilityLabel={dayLabel(col.i)}
            onPress={function () {
              setPinnedIdx(function (cur) { return cur === col.i ? null : col.i; });
            }}
            onHoverIn={Platform.OS === "web" ? function () { setHoverIdx(col.i); } : undefined}
            onHoverOut={Platform.OS === "web" ? function () { setHoverIdx(function (cur) { return cur === col.i ? null : cur; }); } : undefined}
            style={[s.hitCol, { left: col.left, width: col.width, height: H - PAD.bottom }]}
          />
        );
      })}

      {/* Detalhe do dia */}
      {chart && selIdx != null && (
        <DayTooltip
          idx={selIdx}
          x={chart.columns[selIdx].x}
          W={W}
          current={current}
          previous={previous}
          defs={defs}
        />
      )}
    </View>
  );
}

function DayTooltip({
  idx, x, W, current, previous, defs,
}: {
  idx: number;
  x: number;
  W: number;
  current: DailyPoint[];
  previous: DailyPoint[];
  defs: SerieDef[];
}) {
  var cur = current[idx];
  var prev = previous[idx];
  // Fica do lado oposto ao meio do grafico pra nao cobrir o dia escolhido.
  var left = x > W / 2 ? x - 12 - TOOLTIP_W : x + 12;
  left = Math.max(0, Math.min(W - TOOLTIP_W, left));
  return (
    <View testID="comparativo-tooltip" style={[s.tooltip, { left: left, width: TOOLTIP_W }]}>
      <Text style={s.tooltipDate}>
        {cur ? fmtDM(cur.date) : "—"}
        {prev ? <Text style={s.tooltipDatePrev}>{"  ·  anterior " + fmtDM(prev.date)}</Text> : null}
      </Text>
      {defs.map(function (d) {
        return (
          <View key={d.key} style={s.tooltipSerie}>
            <View style={s.tooltipRow}>
              <View style={[s.tooltipDot, { backgroundColor: d.color }]} />
              <Text style={s.tooltipLabel}>{d.label}</Text>
              <Text style={s.tooltipValue}>{cur ? fmtBRLFull(cur[d.key]) : "—"}</Text>
            </View>
            {prev ? (
              <View style={s.tooltipRow}>
                <View style={[s.tooltipDot, s.tooltipDotPrev, { borderColor: d.prevColor }]} />
                <Text style={s.tooltipLabelPrev}>Anterior</Text>
                <Text style={s.tooltipValuePrev}>{fmtBRLFull(prev[d.key])}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
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

  // p-112: titulo + seletor de serie + detalhe do dia
  chartHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 },
  chartTitle: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  serieGroup: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  // minHeight 32: alvo de toque confortavel no celular
  serieBtn: { paddingHorizontal: 10, paddingVertical: 6, minHeight: 32, justifyContent: "center", borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  serieBtnText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  chartHint: { fontSize: 10.5, color: Colors.ink3, marginTop: 6 },
  hitCol: { position: "absolute", top: 0, backgroundColor: "transparent" },
  tooltip: {
    position: "absolute",
    pointerEvents: "none",
    top: 4,
    backgroundColor: Colors.bg2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border2,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 6,
    ...(Platform.OS === "web" ? ({ boxShadow: "0 6px 18px rgba(0,0,0,0.18)" } as any) : {}),
  },
  tooltipDate: { fontSize: 11, color: Colors.ink, fontWeight: "700" },
  tooltipDatePrev: { fontSize: 10.5, color: Colors.ink3, fontWeight: "500" },
  tooltipSerie: { gap: 2 },
  tooltipRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tooltipDot: { width: 8, height: 8, borderRadius: 4 },
  tooltipDotPrev: { backgroundColor: "transparent", borderWidth: 1.5, borderStyle: "dashed" },
  tooltipLabel: { flex: 1, fontSize: 11, color: Colors.ink2, fontWeight: "600" },
  tooltipValue: { fontSize: 12, color: Colors.ink, fontWeight: "800" },
  tooltipLabelPrev: { flex: 1, fontSize: 10.5, color: Colors.ink3, fontWeight: "500" },
  tooltipValuePrev: { fontSize: 11, color: Colors.ink2, fontWeight: "600" },
});
