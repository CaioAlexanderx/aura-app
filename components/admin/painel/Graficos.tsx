// ============================================================
// Gestão Aura › Hoje — gráficos pequenos, sem dependência nova.
//
// Barras (verticais e horizontais) e funil são Views: o texto não escala
// com a largura e funcionam igual no nativo. Sparkline, linha e rosca usam
// react-native-svg, que o app já carrega (components/Icon.tsx).
// Todos recebem Ponto[] (ver tipos.ts).
// ============================================================
import { useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import Svg, { Path, Circle, Line, Text as SvgText } from "react-native-svg";
import { Colors } from "@/constants/colors";
import { Paleta, corDoTom } from "./paleta";
import type { Ponto, Tom, TipoGrafico } from "./tipos";

// Texto dentro do SVG não herda a fonte do app na web (cairia em serifa).
var FONTE_SVG = Platform.OS === "web" ? "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" : undefined;

function maximo(valores: number[]): number {
  var m = 0;
  for (var i = 0; i < valores.length; i++) if (valores[i] > m) m = valores[i];
  return m || 1;
}

// ── Sparkline ───────────────────────────────────────────────

export function Sparkline(props: { valores: number[]; tom?: Tom; largura?: number; altura?: number }) {
  var w = props.largura || 92, h = props.altura || 36;
  var v = props.valores;
  if (!v || v.length < 2) return <View style={{ width: w, height: h }} />;
  var mx = Math.max.apply(null, v), mn = Math.min.apply(null, v);
  var cor = corDoTom(props.tom);
  var pts = v.map(function(n, i) {
    return [i * (w - 4) / (v.length - 1) + 2, h - 3 - ((n - mn) / (mx - mn || 1)) * (h - 8)];
  });
  var d = "M" + pts.map(function(p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join("L");
  var fim = pts[pts.length - 1];
  return (
    <Svg width={w} height={h} viewBox={"0 0 " + w + " " + h}>
      <Path d={d + "L" + fim[0] + "," + h + "L" + pts[0][0] + "," + h + "Z"} fill={cor} opacity={0.12} />
      <Path d={d} fill="none" stroke={cor} strokeWidth={2} strokeLinejoin="round" />
      <Circle cx={fim[0]} cy={fim[1]} r={2.5} fill={cor} />
    </Svg>
  );
}

// ── Barras verticais com rótulos ────────────────────────────

export function BarrasVerticais(props: {
  pontos: Ponto[];
  altura?: number;
  valores?: "max" | "todos" | false;   // quais barras mostram o número em cima
  ultimoClaro?: boolean;               // período em curso
}) {
  var h = props.altura || 90;
  var areaBarras = h - 30;
  var mx = maximo(props.pontos.map(function(p) { return p.valor; }));
  var n = props.pontos.length;
  return (
    <View style={{ height: h }}>
      <View style={[g.linhaGrade, { top: 12 }]} />
      <View style={[g.linhaGrade, { top: 12 + areaBarras / 2 }]} />
      <View style={g.barrasRow}>
        {props.pontos.map(function(p, i) {
          var cor = props.ultimoClaro && i === n - 1 ? Paleta.accentClaro : corDoTom(p.tom);
          var mostra = props.valores === "todos" || (props.valores === "max" && p.valor === mx);
          return (
            <View key={i} style={g.barraCol}>
              <Text style={g.barraValor} numberOfLines={1}>{mostra ? p.valor : ""}</Text>
              <View style={{ height: areaBarras, justifyContent: "flex-end", alignSelf: "stretch", alignItems: "center" }}>
                <View style={{ width: "70%", height: Math.round(areaBarras * p.valor / mx), backgroundColor: cor, borderRadius: 3 }} />
              </View>
              <Text style={g.barraRotulo} numberOfLines={1}>{p.rotulo}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Linha com até 2 séries ──────────────────────────────────

export function Linhas(props: { pontos: Ponto[]; altura?: number; max?: number }) {
  var [w, setW] = useState(0);
  var h = props.altura || 110;
  var pontos = props.pontos;
  var n = pontos.length;
  var temSegunda = pontos.some(function(p) { return p.valor2 != null; });
  var series: { v: number[]; cor: string; area: boolean }[] = [
    { v: pontos.map(function(p) { return p.valor; }), cor: Paleta.accent, area: true },
  ];
  if (temSegunda) series.push({ v: pontos.map(function(p) { return p.valor2 || 0; }), cor: Paleta.teal, area: false });
  var mx = props.max || maximo(series[0].v.concat(temSegunda ? series[1].v : []));
  var padL = 26, padB = 16, topo = 14;
  function x(i: number) { return padL + i * (w - padL - 8) / (n - 1 || 1); }
  function y(v: number) { return h - padB - (h - padB - topo) * v / mx; }

  return (
    <View style={{ height: h }} onLayout={function(e) { setW(Math.round(e.nativeEvent.layout.width)); }}>
      {w > 0 && n > 1 && (
        <Svg width={w} height={h}>
          {[0, 0.5, 1].map(function(f) {
            var yy = y(mx * f);
            return [
              <Line key={"l" + f} x1={padL} x2={w} y1={yy} y2={yy} stroke={Paleta.grade} strokeWidth={1} />,
              <SvgText key={"t" + f} fontFamily={FONTE_SVG} x={padL - 5} y={yy + 3} textAnchor="end" fontSize={9} fill={Colors.ink3}>{String(Math.round(mx * f))}</SvgText>,
            ];
          })}
          {series.map(function(sr, si) {
            var pts = sr.v.map(function(v, i) { return [x(i), y(v)]; });
            var d = "M" + pts.map(function(p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join("L");
            var fim = pts[n - 1];
            return [
              sr.area ? <Path key={"a" + si} d={d + "L" + fim[0] + "," + (h - padB) + "L" + pts[0][0] + "," + (h - padB) + "Z"} fill={sr.cor} opacity={0.1} /> : null,
              <Path key={"p" + si} d={d} fill="none" stroke={sr.cor} strokeWidth={2.2} strokeLinejoin="round" />,
              pts.map(function(p, i) { return <Circle key={"c" + si + "-" + i} cx={p[0]} cy={p[1]} r={i === n - 1 ? 3.5 : 2.2} fill={sr.cor} />; }),
              <SvgText key={"v" + si} fontFamily={FONTE_SVG} x={fim[0] - 6} y={fim[1] - 7} textAnchor="end" fontSize={10} fontWeight="700" fill={sr.cor}>{String(sr.v[n - 1])}</SvgText>,
            ];
          })}
          {pontos.map(function(p, i) {
            if (!p.rotulo) return null;
            return <SvgText key={"x" + i} fontFamily={FONTE_SVG} x={x(i)} y={h - 3} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={9} fill={Colors.ink3}>{p.rotulo}</SvgText>;
          })}
        </Svg>
      )}
    </View>
  );
}

// ── Funil horizontal ────────────────────────────────────────

export function Funil(props: { pontos: Ponto[] }) {
  var mx = props.pontos.length ? props.pontos[0].valor || 1 : 1;
  return (
    <View style={{ gap: 5 }}>
      {props.pontos.map(function(p, i) {
        var pct = Math.max(0, Math.min(1, p.valor / mx));
        return (
          <View key={i} style={g.funilRow}>
            <Text style={g.funilRotulo} numberOfLines={1}>{p.rotulo}</Text>
            <View style={g.funilPista}>
              <View style={{ width: (pct * 68) + "%" as any, minWidth: 3, height: 14, borderRadius: 4, backgroundColor: corDoTom(p.tom), opacity: p.valor ? 1 : 0.25 }} />
              <Text style={g.funilValor} numberOfLines={1}>
                {p.valor}{p.texto ? <Text style={g.funilNota}>{"  ·  " + p.texto}</Text> : null}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Rosca com legenda ───────────────────────────────────────

export function Rosca(props: { pontos: Ponto[]; tamanho?: number }) {
  var t = props.tamanho || 104;
  var r = t / 2 - 9, c = t / 2, C = 2 * Math.PI * r;
  var total = props.pontos.reduce(function(a, p) { return a + p.valor; }, 0);
  var off = 0;
  return (
    <View style={g.roscaRow}>
      <View style={{ width: t, height: t, alignItems: "center", justifyContent: "center" }}>
        <Svg width={t} height={t} style={{ position: "absolute", top: 0, left: 0 }}>
          {props.pontos.map(function(p, i) {
            var len = total ? C * p.valor / total : 0;
            var el = (
              <Circle key={i} cx={c} cy={c} r={r} fill="none" stroke={corDoTom(p.tom)} strokeWidth={14}
                strokeDasharray={len + " " + (C - len)} strokeDashoffset={-off}
                transform={"rotate(-90 " + c + " " + c + ")"} />
            );
            off += len;
            return el;
          })}
        </Svg>
        <Text style={g.roscaTotal}>{total}</Text>
      </View>
      <View style={g.roscaLegenda}>
        {props.pontos.map(function(p, i) {
          return (
            <View key={i} style={g.roscaItem}>
              <View style={[g.amostra, { backgroundColor: corDoTom(p.tom) }]} />
              <Text style={g.roscaRotulo} numberOfLines={1}>{p.rotulo}</Text>
              <Text style={g.roscaValor} numberOfLines={1}>{p.valor}{p.texto ? " · " + p.texto : ""}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Barras horizontais com nome e valor ─────────────────────

export function BarrasHorizontais(props: { pontos: Ponto[]; max?: number }) {
  var mx = props.max || maximo(props.pontos.map(function(p) { return p.valor; }));
  return (
    <View style={{ gap: 6 }}>
      {props.pontos.map(function(p, i) {
        var pct = Math.max(0, Math.min(100, 100 * p.valor / mx));
        return (
          <View key={i} style={g.hbRow}>
            <Text style={g.hbNome} numberOfLines={1}>{p.rotulo}</Text>
            <View style={g.hbTrilho}>
              <View style={{ width: pct + "%" as any, height: "100%", borderRadius: 5, backgroundColor: corDoTom(p.tom) }} />
            </View>
            <Text style={g.hbValor} numberOfLines={1}>{p.texto != null ? p.texto : p.valor}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Seletor ─────────────────────────────────────────────────

export type OpcoesGrafico = {
  max?: number;
  altura?: number;
  valores?: "max" | "todos" | false;
  ultimoClaro?: boolean;
};

export function Grafico(props: { tipo: TipoGrafico; pontos: Ponto[]; opcoes?: OpcoesGrafico }) {
  var o = props.opcoes || {};
  if (!props.pontos || props.pontos.length === 0) return null;
  switch (props.tipo) {
    case "barras": return <BarrasVerticais pontos={props.pontos} altura={o.altura} valores={o.valores} ultimoClaro={o.ultimoClaro} />;
    case "linha": return <Linhas pontos={props.pontos} altura={o.altura} max={o.max} />;
    case "funil": return <Funil pontos={props.pontos} />;
    case "rosca": return <Rosca pontos={props.pontos} />;
    default: return <BarrasHorizontais pontos={props.pontos} max={o.max} />;
  }
}

var g = StyleSheet.create({
  linhaGrade: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: Paleta.grade },
  barrasRow: { flex: 1, flexDirection: "row", alignItems: "flex-end" },
  barraCol: { flex: 1, alignItems: "center", minWidth: 0 },
  barraValor: { height: 12, fontSize: 9, lineHeight: 12, fontWeight: "700", color: Colors.ink3 },
  barraRotulo: { height: 14, fontSize: 9, lineHeight: 14, marginTop: 4, color: Colors.ink3 },
  funilRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  funilRotulo: { width: 104, textAlign: "right", fontSize: 11, color: Colors.ink2 },
  funilPista: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 },
  funilValor: { flexShrink: 1, fontSize: 11, fontWeight: "700", color: Colors.ink },
  funilNota: { fontWeight: "500", color: Colors.ink3 },
  roscaRow: { flexDirection: "row", alignItems: "center", gap: 16, flexWrap: "wrap" },
  roscaTotal: { fontSize: 22, fontWeight: "800", color: Colors.ink },
  roscaLegenda: { flex: 1, minWidth: 150, gap: 8 },
  roscaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  amostra: { width: 10, height: 10, borderRadius: 3 },
  roscaRotulo: { flex: 1, fontSize: 12, color: Colors.ink2 },
  roscaValor: { fontSize: 12, fontWeight: "700", color: Colors.ink },
  hbRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  hbNome: { width: "36%", maxWidth: 150, fontSize: 12, color: Colors.ink2 },
  hbTrilho: { flex: 1, height: 10, borderRadius: 5, backgroundColor: Paleta.trilho, overflow: "hidden" },
  hbValor: { minWidth: 44, textAlign: "right", fontSize: 12, fontWeight: "600", color: Colors.ink },
});
