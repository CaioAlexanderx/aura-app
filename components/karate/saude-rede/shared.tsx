// ============================================================
// Saúde da Rede — primitivos compartilhados · Shoji
//
// Helpers de formatação, skeleton, cabeçalho de seção (CSV + detalhe),
// gráfico de barras e estilos de card. Re-skin Shoji: papel opaco,
// sumi como estrutura, vermelhão (P.red) raro como acento.
// ============================================================
import React from "react";
import {
  View, Text, TouchableOpacity, Linking, Platform, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP,
} from "@/constants/karateTheme";
import { karateNetworkHealthApi } from "@/services/karateNetworkHealthApi";

// ── helpers ───────────────────────────────────────────────────

export function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toFixed(1).replace(".", ",") + "%";
}
export function fmtN(v: number): string {
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
export function dateSlice(s: string | null | undefined): string {
  if (!s) return "";
  return s.slice(0, 10).split("-").reverse().join("/");
}

// Download CSV via Linking (web: opens in new tab; native: opens browser)
export function downloadCsv(fedId: string, indicator: string, token?: string): void {
  let url = karateNetworkHealthApi.csvUrl(fedId, indicator);
  if (token) url += `&token=${encodeURIComponent(token)}`;
  Linking.openURL(url);
}

// ── Skeleton placeholder ────────────────────────────────────────

export function Sk({ h, mb }: { h: number; mb?: number }) {
  return (
    <View
      style={[st.skeletonBase, { height: h, marginBottom: mb || 0 }]}
      accessibilityLabel="carregando"
    />
  );
}

// ── Section header (título + sub + ações CSV / Ver detalhe) ──────

export function SectionRow({
  title,
  sub,
  onCsv,
  onDetail,
}: {
  title: string;
  sub: string;
  onCsv?: () => void;
  onDetail?: () => void;
}) {
  return (
    <View style={st.shRow}>
      <View style={{ flex: 1 }}>
        <Text style={st.shTitle}>{title}</Text>
        <View style={st.filete} />
        <Text style={st.shSub}>{sub}</Text>
      </View>
      <View style={st.shActions}>
        {onCsv && (
          <TouchableOpacity
            style={st.btnCsv}
            onPress={onCsv}
            accessibilityLabel={`Exportar CSV: ${title}`}
          >
            <Ionicons name="download-outline" size={13} color={C.ink3} />
            <Text style={st.btnCsvLabel}>CSV</Text>
          </TouchableOpacity>
        )}
        {onDetail && (
          <TouchableOpacity
            style={st.btnDetail}
            onPress={onDetail}
            accessibilityLabel={`Ver detalhe: ${title}`}
          >
            <Text style={st.btnDetailLabel}>Ver detalhe</Text>
            <Ionicons name="arrow-forward" size={13} color={P.red} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Chart empty state (discreto) ──────────────────────────────
// Mostrado quando a série não tem nenhum ponto (vão branco → empty).

export function ChartEmpty({ h, label }: { h: number; label?: string }) {
  return (
    <View style={[st.chartEmpty, { height: h }]} accessibilityLabel="Sem dados no período">
      <Ionicons name="bar-chart-outline" size={22} color={C.ink4} />
      <Text style={st.chartEmptyText}>{label || "Sem dados no período"}</Text>
    </View>
  );
}

// ── Bar chart helper ─────────────────────────────────────────
// Casos:
//  • 0 itens  → empty state (não deixa vão branco).
//  • 1 item   → barra de tamanho normal: largura fixa centralizada e
//               altura escalada por um teto sensato (não vira bloco
//               full-width/full-height).
//  • 2+ itens → comportamento original (colunas flex preenchendo a largura).

export function BarChart({
  items,
  maxVal,
  barColor,
  projColor,
  emptyLabel,
}: {
  items: Array<{ label: string; sublabel?: string; value: number; isProj?: boolean }>;
  maxVal: number;
  barColor: string;
  projColor?: string;
  emptyLabel?: string;
}) {
  const chartH = 120;
  const containerH = chartH + 28;

  // D2.2 — série vazia: empty state no lugar do plot em branco.
  if (!items || items.length === 0) {
    return <ChartEmpty h={containerH} label={emptyLabel} />;
  }

  const single = items.length === 1;
  // D2.1 — com 1 ponto, value/maxVal=1 colaria a barra no topo (bloco).
  // Teto de altura para uma barra única ficar com aparência normal.
  const SINGLE_H_CAP = 0.62;

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: containerH, gap: 4 }}>
      {items.map((item, i) => {
        const pct = maxVal > 0 ? item.value / maxVal : 0;
        const scaled = single ? pct * SINGLE_H_CAP : pct;
        const barH = item.value > 0 ? Math.max(4, Math.round(scaled * chartH)) : 4;
        const bg = item.isProj ? (projColor || barColor) : barColor;
        return (
          <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
            <Text style={st.barValLabel}>
              {item.value > 0 ? fmtN(Math.round(item.value)) : ""}
            </Text>
            <View
              style={[
                st.bar,
                single ? st.barSingle : null,
                {
                  height: barH,
                  backgroundColor: bg,
                  opacity: item.isProj ? 0.55 : 1,
                  borderStyle: item.isProj ? "dashed" : "solid",
                  borderWidth: item.isProj ? 1 : 0,
                  borderColor: item.isProj ? P.red : "transparent",
                },
              ]}
            />
            <Text style={st.barLabel}>{item.label}</Text>
            {item.sublabel && <Text style={st.barSublabel}>{item.sublabel}</Text>}
          </View>
        );
      })}
    </View>
  );
}

// ── StyleSheet compartilhado ──────────────────────────────────
// Top-level entries are OBJECTS (not strings/colors) to avoid the
// WeakMap pitfall (aura-app armadilha 08/06).

export const st = StyleSheet.create({
  // Cards / layout
  card:    { backgroundColor: P.glass, borderRadius: R.xl, borderWidth: 1, borderColor: C.line, padding: SP[6], gap: 10 } as ViewStyle,
  row2:    { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 12 } as ViewStyle,

  // Section header
  shRow:        { flexDirection: "row", alignItems: "flex-start", gap: 8 } as ViewStyle,
  shTitle:      { fontFamily: F.heading, fontSize: 20, fontWeight: "400", color: C.ink, lineHeight: 22 } as TextStyle,
  filete:       { width: 30, height: 2, backgroundColor: P.red, opacity: 0.7, marginTop: 8, marginBottom: 6 } as ViewStyle,
  shSub:        { fontFamily: F.body, fontSize: 12, color: C.ink3 } as TextStyle,
  shActions:    { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 } as ViewStyle,
  btnCsv:       { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 5, paddingHorizontal: 9, borderRadius: R.md, borderWidth: 1, borderColor: C.line2, backgroundColor: P.glass2 } as ViewStyle,
  btnCsvLabel:  { fontFamily: F.body, fontSize: 11, fontWeight: "500", color: C.ink3 } as TextStyle,
  btnDetail:    { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 5, paddingHorizontal: 9, borderRadius: R.md, backgroundColor: P.redWash, borderWidth: 1, borderColor: P.redLine } as ViewStyle,
  btnDetailLabel: { fontFamily: F.body, fontSize: 11, fontWeight: "700", color: P.red } as TextStyle,

  // Hero numbers
  heroRow: { flexDirection: "row", alignItems: "baseline", gap: 10 } as ViewStyle,
  heroNum: { fontFamily: F.heading, fontSize: 34, fontWeight: "400", color: C.ink, lineHeight: 38 } as TextStyle,
  heroSub: { fontFamily: F.body, fontSize: 11, color: C.ink3, flexShrink: 1 } as TextStyle,

  // Twin boxes
  twinBoxRow:    { flexDirection: "row", gap: 10 } as ViewStyle,
  twinBox:       { flex: 1, padding: 11, borderRadius: R.md, borderWidth: 1, borderColor: C.line, backgroundColor: P.glass2 } as ViewStyle,
  twinBoxOk:     { borderColor: P.okLine, backgroundColor: P.okWash } as ViewStyle,
  twinBoxDanger: { borderColor: P.redLine, backgroundColor: P.dangerWash } as ViewStyle,
  twinBoxWarn:   { borderColor: P.warnWash, backgroundColor: P.warnWash } as ViewStyle,
  twinBoxNum:    { fontFamily: F.heading, fontSize: 22, fontWeight: "400", color: C.ok } as TextStyle,
  twinBoxLabel:  { fontFamily: F.body, fontSize: 11, color: C.ink3, marginTop: 2 } as TextStyle,

  // Bar chart
  bar:          { borderRadius: 4, width: "100%" } as ViewStyle,
  barSingle:    { width: 56, maxWidth: 56, alignSelf: "center" } as ViewStyle,
  barValLabel:  { fontFamily: F.mono, fontSize: 9, color: C.ink3, marginBottom: 2, textAlign: "center" } as TextStyle,
  barLabel:     { fontFamily: F.body, fontSize: 10, color: C.ink3, marginTop: 4, textAlign: "center" } as TextStyle,
  barSublabel:  { fontFamily: F.body, fontSize: 9, color: C.ink4, textAlign: "center" } as TextStyle,

  // Chart empty state
  chartEmpty:     { alignItems: "center", justifyContent: "center", gap: 8, borderRadius: R.md, borderWidth: 1, borderColor: C.line, backgroundColor: P.glass2 } as ViewStyle,
  chartEmptyText: { fontFamily: F.body, fontSize: 12, color: C.ink4 } as TextStyle,

  // Coverage
  covRow:   { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  covLabel: { width: 88, fontFamily: F.body, fontSize: 12, color: C.ink2 } as TextStyle,
  covBarBg: { flex: 1, height: 7, borderRadius: 999, backgroundColor: "rgba(43,38,32,0.06)", overflow: "hidden" } as ViewStyle,
  covBarFill: { height: 7, borderRadius: 999, backgroundColor: C.ink2 } as ViewStyle,
  covCount:   { fontFamily: F.mono, fontSize: 12, color: C.ink, width: 24, textAlign: "right" } as TextStyle,
  gapBox:     { padding: 13, borderRadius: R.md, borderWidth: 1, borderColor: P.redLine, backgroundColor: P.redWash } as ViewStyle,
  gapTitle:   { fontFamily: F.body, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: P.red, marginBottom: 6 } as TextStyle,
  gapBody:    { fontFamily: F.body, fontSize: 12, color: C.ink, lineHeight: 18 } as TextStyle,

  // Inad
  stackBarWrap:    { flexDirection: "row", height: 14, borderRadius: 7, overflow: "hidden", borderWidth: 1, borderColor: C.line } as ViewStyle,
  stackBarSeg:     { height: "100%" } as ViewStyle,
  inadLegendRow:   { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  inadDot:         { width: 9, height: 9, borderRadius: 2 } as ViewStyle,
  inadLegLabel:    { fontFamily: F.body, fontSize: 12, color: C.ink2 } as TextStyle,
  inadLegN:        { fontFamily: F.mono, fontSize: 12, color: C.ink } as TextStyle,
  inadLegPct:      { fontFamily: F.body, fontSize: 11, color: C.ink3, width: 48, textAlign: "right" } as TextStyle,

  // Legend row
  legendRow:   { flexDirection: "row", gap: 14, marginTop: 8, flexWrap: "wrap" } as ViewStyle,
  legendItem:  { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  legendDot:   { width: 11, height: 11, borderRadius: 3 } as ViewStyle,
  legendLabel: { fontFamily: F.body, fontSize: 11, color: C.ink3 } as TextStyle,

  // Grad note
  gradNote:    { marginLeft: "auto", fontFamily: F.body, fontSize: 10, color: C.ink4 } as TextStyle,

  // Belt relation
  beltHero:      { paddingRight: 16, borderRightWidth: 1, borderRightColor: C.line, minWidth: 100 } as ViewStyle,
  beltHeroPct:   { fontFamily: F.heading, fontSize: 44, fontWeight: "400", color: C.ink, lineHeight: 48 } as TextStyle,
  beltHeroPctUnit: { fontFamily: F.heading, fontSize: 22, color: C.ink3 } as TextStyle,
  beltHeroSub:   { fontFamily: F.body, fontSize: 12, color: C.ink2, marginTop: 8, lineHeight: 16 } as TextStyle,
  beltHeroNote:  { fontFamily: F.body, fontSize: 10, color: C.ink4, marginTop: 8, lineHeight: 15 } as TextStyle,
  beltStat:      { fontFamily: F.mono, fontSize: 17, color: C.ink } as TextStyle,
  beltStatLabel: { fontFamily: F.body, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, color: C.ink3, marginTop: 2 } as TextStyle,
  beltRow:       { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  beltRowLabel:  { fontFamily: F.body, fontSize: 12, color: C.ink2, width: 110 } as TextStyle,
  beltBar:       { height: 20, borderRadius: 5, borderWidth: 1, borderColor: "rgba(43,38,32,0.12)" } as ViewStyle,
  beltRowCount:  { fontFamily: F.mono, fontSize: 13, color: C.ink, textAlign: "right" } as TextStyle,
  beltRowPct:    { fontFamily: F.body, fontSize: 11, color: C.ink3 } as TextStyle,

  // Skeleton
  skeletonBase: { backgroundColor: "rgba(43,38,32,0.06)", borderRadius: R.md } as ViewStyle,
});
