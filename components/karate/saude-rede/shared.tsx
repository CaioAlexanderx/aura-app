// ============================================================
// Saúde da Rede — primitivos compartilhados · Shoji
//
// Helpers de formatação, skeleton, cabeçalho de seção (CSV + detalhe),
// gráfico de barras e estilos de card. Re-skin Shoji: papel opaco,
// sumi como estrutura, vermelhão (P.red) raro como acento.
// ============================================================
import React, { useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, Platform, StyleSheet, ViewStyle, TextStyle, Animated, Easing,
} from "react-native";
import { Icon } from "@/components/Icon";
import {
  KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP,
} from "@/constants/karateTheme";
import { useAuthStore } from "@/stores/auth";
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
  const str = String(s);
  // ISO yyyy-mm-dd (com ou sem hora) -> dd/mm/yyyy
  const iso = str.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return iso.split("-").reverse().join("/");
  }
  // Qualquer outra string de data parseavel (ex.: "Sun Feb 01 2026...") -> dd/mm/yyyy
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  }
  return "";
}
export function fmtMesAno(mes: string, ano: string | number): string {
  // NUNCA usar new Date aqui: `new Date("fev 1, 26")` NÃO é inválido no V8 —
  // ele vira silenciosamente uma data de JANEIRO, transformando "fev" em "jan"
  // (raiz do bug recorrente das Graduações). Mapeamento puro por string, tz-safe.
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const EN: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  let m = String(mes ?? "").trim().toLowerCase().replace(/\./g, "");
  let yy = String(ano ?? "");
  if (yy.length > 2) yy = yy.slice(2);
  const iso = m.match(/^(\d{4})-(\d{2})$/); // "YYYY-MM"
  if (iso) return `${MESES[parseInt(iso[2], 10) - 1] ?? iso[2]}/${iso[1].slice(2)}`;
  const num = m.match(/^\d{1,2}$/); // "2" ou "02"
  if (num) return `${MESES[parseInt(m, 10) - 1] ?? m}/${yy}`;
  const en3 = EN[m.slice(0, 3)]; // "Feb" (inglês) → pt
  if (en3) m = MESES[en3 - 1];
  return `${m}/${yy}`;
}

// ── CSV export client-side ─────────────────────────────────────
// Gera um CSV em memória e dispara download via Blob + anchor.
// BOM UTF-8 para abrir corretamente no Excel.
// Sem window.open de rota autenticada.

export function exportRowsToCsv(
  filename: string,
  headers: string[],
  rows: string[][],
): void {
  if (Platform.OS !== "web") return; // nativo: sem-op (não há filesystem público)
  const BOM = "﻿";
  const escape = (cell: string) => {
    const s = String(cell ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ];
  const csv = BOM + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── CSV export server-side (download autenticado) ───────────────
// Usado pelos botões "CSV" e "ver detalhes" do painel: baixa o CSV
// do indicador direto do backend (?export=csv), que já traz o dataset
// completo (não só a página carregada na tela). Mesmo padrão de
// ExportButton.tsx / FiscalPdfButton.tsx: fetch manual com o Bearer
// token do auth store (a rota é autenticada, não dá pra usar
// window.open/Linking direto) + download via Blob.

export async function downloadCsv(federationId: string, indicator: string): Promise<void> {
  if (Platform.OS !== "web") return; // nativo: sem-op (não há filesystem público)
  const token = useAuthStore.getState().token;
  if (!token) return;
  const url = karateNetworkHealthApi.csvUrl(federationId, indicator);
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Erro ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `saude-rede_${indicator}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error("[saude-rede] downloadCsv error:", err);
  }
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

// ── Fade-in do conteúdo ao sair do loading (skeleton → dado) ──────────
// Envolve o conteúdo carregado dos cards da Saúde da Rede: opacity 0→1
// (~300ms) quando o `loading` vira false. Não reserva/altera layout —
// só a opacidade anima. useNativeDriver:false (web-safe).
export function FadeIn({ children, style }: { children: React.ReactNode; style?: any }) {
  const anim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    anim.setValue(0);
    const timer = Animated.timing(anim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    });
    timer.start();
    return () => { timer.stop(); };
  }, [anim]);

  return <Animated.View style={[{ opacity: anim }, style]}>{children}</Animated.View>;
}

// ── Section header (título + sub + ações CSV / Ver detalhe) ──────
// csvData: quando fornecido, o export é feito client-side via Blob.
//          Quando ausente, chama onCsv() (backward-compat).

export function SectionRow({
  title,
  sub,
  onCsv,
  onDetail,
  csvData,
}: {
  title: string;
  sub: string;
  onCsv?: () => void;
  onDetail?: () => void;
  csvData?: { filename?: string; headers: string[]; rows: string[][] };
}) {
  function handleCsv() {
    if (csvData) {
      exportRowsToCsv(csvData.filename ?? title, csvData.headers, csvData.rows);
    } else if (onCsv) {
      onCsv();
    }
  }

  const showCsv = !!(onCsv || csvData);

  return (
    <View style={st.shRow}>
      <View style={{ flex: 1 }}>
        <Text style={st.shTitle}>{title}</Text>
        <View style={st.filete} />
        <Text style={st.shSub}>{sub}</Text>
      </View>
      <View style={st.shActions}>
        {showCsv && (
          <TouchableOpacity
            style={st.btnCsv}
            onPress={handleCsv}
            accessibilityLabel={`Exportar CSV: ${title}`}
          >
            <Icon name="download" size={13} color={C.ink3} />
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
            <Icon name="arrow_right" size={13} color={P.red} />
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
      <Icon name="bar_chart" size={22} color={C.ink4} />
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
//  • 2+ itens → colunas flex, MAS com largura máxima por barra (não viram
//               blocos largos quando há poucas barras) e um teto de altura
//               (headroom) pra a barra mais alta não estourar o card.
//
// Item 6 (proporção entre VÁRIAS barras): antes, com 2–3 pontos as barras
// ocupavam toda a largura da coluna (flex:1 + width:100%) e a maior subia
// até o topo do plot — três blocões dominando o card. Agora cada barra tem
// maxWidth e a escala de altura usa MULTI_H_CAP de headroom. O #311 (barra de
// período ÚNICO) continua intacto via SINGLE_H_CAP/barSingle.

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
  // Item 6 — com 2+ barras, headroom pra a maior (value/maxVal=1) não bater no
  // topo do plot. Mantém a proporção RELATIVA (todas escalam pelo mesmo fator).
  const MULTI_H_CAP = 0.82;
  // Item 3 (back#252) — a barra-valor (barValLabel) é renderizada DENTRO da
  // coluna, ACIMA da barra. Sem reservar esse espaço, a barra mais alta
  // (value/maxVal=1) somada ao rótulo estourava o plot e saía desproporcional
  // ("1ª barra fora de proporção"). Escalamos a altura contra a área ÚTIL
  // (plot menos a reserva do rótulo), preservando a proporção entre as barras.
  const VALUE_LABEL_RESERVE = 16;
  const plotH = Math.max(1, chartH - VALUE_LABEL_RESERVE);

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: containerH, gap: 4 }}>
      {items.map((item, i) => {
        const pct = maxVal > 0 ? Math.min(1, item.value / maxVal) : 0;
        const scaled = single ? pct * SINGLE_H_CAP : pct * MULTI_H_CAP;
        const barH = item.value > 0 ? Math.max(4, Math.round(scaled * plotH)) : 4;
        const bg = item.isProj ? (projColor || barColor) : barColor;
        return (
          <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
            <Text style={st.barValLabel}>
              {item.value > 0 ? fmtN(Math.round(item.value)) : ""}
            </Text>
            <AnimatedBar
              index={i}
              height={barH}
              style={[
                st.bar,
                single ? st.barSingle : st.barMulti,
                {
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

// ── Barra horizontal animada por LARGURA (%) ──────────────────────────
// Usada na pirâmide de faixas (RelacaoFaixasCard): cresce de 0% até o
// pct final, com stagger por índice. useNativeDriver:false (width).
export function AnimatedWidthBar({
  index,
  pct,
  style,
}: {
  index: number;
  pct: number;
  style: any;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    const delay = Math.min(index, 20) * 60;
    const timer = Animated.timing(anim, {
      toValue: pct,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    timer.start();
    return () => { timer.stop(); };
  }, [pct, index, anim]);

  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });

  return <Animated.View style={[style, { width }]} />;
}

// ── Barra individual animada (cresce de 0 até a altura final) ────────
// Stagger por índice (delay incremental ~60ms) — reanima quando `height`
// muda (recarga/troca de filtro), pois o valor final entra nas deps do
// effect. useNativeDriver:false (anima "height", não suportado no driver
// nativo do RN Web).
function AnimatedBar({
  index,
  height,
  style,
}: {
  index: number;
  height: number;
  style: any;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    const delay = Math.min(index, 20) * 60;
    const timer = Animated.timing(anim, {
      toValue: height,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    timer.start();
    return () => { timer.stop(); };
  }, [height, index, anim]);

  return <Animated.View style={[style, { height: anim }]} />;
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
  // Item 6 — largura sensata por barra (não estica em bloco com poucas barras).
  barMulti:     { maxWidth: 44, alignSelf: "center" } as ViewStyle,
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
  beltBarTrack:  { flex: 1, minWidth: 0 } as ViewStyle,
  beltBar:       { height: 20, borderRadius: 5, borderWidth: 1, borderColor: "rgba(43,38,32,0.12)" } as ViewStyle,
  beltRowCount:  { fontFamily: F.mono, fontSize: 13, color: C.ink, textAlign: "right" } as TextStyle,
  beltRowPct:    { fontFamily: F.body, fontSize: 11, color: C.ink3 } as TextStyle,

  // Skeleton
  skeletonBase: { backgroundColor: "rgba(43,38,32,0.06)", borderRadius: R.md } as ViewStyle,
});
