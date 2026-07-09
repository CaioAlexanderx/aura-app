// ============================================================
// Chaves — primitivos compartilhados · Shoji
//
// Helpers (initials, roundLabel), pequenos sub-componentes
// (Toggle, ConfigRow, AthleteCell, ByeText, PendingText) e a
// folha de estilo compartilhada entre SorteioPanel/BracketView/
// KataScoring. Tokens Shoji apenas — sem hex/rgba hardcoded de
// fora da paleta.
//
// NB: nenhuma lógica de bracket/kata vive aqui — só apresentação.
// ============================================================
import React from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import {
  KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F,
} from "@/constants/karateTheme";
import type { BracketAthleteRef } from "@/services/karateBracketsApi";

// ── Helpers ────────────────────────────────────────────────────────────
export function initials(name: string | null): string {
  if (!name) return "??";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// Rótulo de fase por NÚMERO DE CONFRONTOS na rodada (não por índice fixo),
// pra suportar chaves de qualquer tamanho (64/128/256+ atletas) sem cair
// em "R{n}": 1 confronto = Final, 2 = Semis, 4 = Quartas, 8 = Oitavas,
// 16+ = "{matches}-avos" (16-avos, 32-avos, 64-avos, 128-avos...).
export const ROUND_LABELS_BY_MATCHES: Record<number, string> = {
  1: "Final",
  2: "Semifinais",
  4: "Quartas",
  8: "Oitavas",
};
export function roundLabel(round: number, totalRounds: number): string {
  const matches = Math.pow(2, totalRounds - 1 - round);
  return ROUND_LABELS_BY_MATCHES[matches] ?? `${matches}-avos`;
}

// ── Toggle ─────────────────────────────────────────────────────────────
export function Toggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      style={[styles.toggle, value && styles.toggleOn]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
    </TouchableOpacity>
  );
}

// ── ConfigRow (label + descrição + toggle) ─────────────────────────────
export function ConfigRow({
  label, desc, value, onToggle,
}: { label: string; desc: string; value: boolean; onToggle: () => void }) {
  return (
    <View style={styles.configRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.configLabel}>{label}</Text>
        <Text style={styles.configDesc}>{desc}</Text>
      </View>
      <Toggle value={value} onToggle={onToggle} />
    </View>
  );
}

// ── Avatar compacto (iniciais) ─────────────────────────────────────────
export function MiniAvatar({ name }: { name: string | null }) {
  return (
    <View style={styles.av}>
      <Text style={styles.avText}>{initials(name)}</Text>
    </View>
  );
}

// ── Bloco de atleta (avatar + nome + dojô) ─────────────────────────────
export function AthleteCell({
  athlete, winner,
}: { athlete: BracketAthleteRef; winner?: boolean }) {
  return (
    <View style={styles.athleteRow}>
      <MiniAvatar name={athlete.student_name} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.athleteName, winner && styles.athleteNameWinner]} numberOfLines={1}>
          {athlete.student_name}
        </Text>
        <Text style={styles.athleteDojo} numberOfLines={1}>{athlete.dojo_name}</Text>
      </View>
      {winner && <Text style={styles.winMark}>✓</Text>}
    </View>
  );
}

export function ByeText() {
  return <Text style={styles.byeText}>BYE</Text>;
}
export function PendingText() {
  return <Text style={styles.pendingText}>a definir</Text>;
}

// ── Estilos compartilhados ─────────────────────────────────────────────
export const styles = StyleSheet.create({
  // layout
  grid2: { gap: 16 } as ViewStyle,

  // cards / heads
  card: {
    backgroundColor: P.glass, borderRadius: R.lg,
    borderWidth: 1, borderColor: C.line, padding: 16, gap: 10,
  } as ViewStyle,
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 } as ViewStyle,
  cardTitle: { fontFamily: F.heading, fontSize: 18, fontWeight: "400", color: C.ink } as TextStyle,
  cardSub: { fontFamily: F.body, fontSize: 11, color: C.ink3, marginTop: 2 } as TextStyle,
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 } as ViewStyle,
  sectionHeadRight: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,

  // info row
  infoRow: { flexDirection: "row", gap: 6, alignItems: "flex-start" } as ViewStyle,
  infoText: { flex: 1, fontFamily: F.body, fontSize: 11, color: C.ink3, lineHeight: 15 } as TextStyle,

  // fields / segmented
  fieldLabel: { fontFamily: F.body, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.0, color: C.ink3 } as TextStyle,
  segRow: { flexDirection: "row", gap: 4, backgroundColor: P.neutralWash, borderRadius: 8, padding: 3 } as ViewStyle,
  segBtn: { flex: 1, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 6, alignItems: "center" } as ViewStyle,
  segBtnActive: { backgroundColor: C.ink } as ViewStyle,
  segBtnText: { fontFamily: F.body, fontSize: 11, fontWeight: "600", color: C.ink3 } as TextStyle,
  segBtnTextActive: { color: P.paperWarm } as TextStyle,
  methodDesc: { fontFamily: F.body, fontSize: 11, color: C.ink3, lineHeight: 16 } as TextStyle,

  // config / toggle
  configRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.line } as ViewStyle,
  configLabel: { fontFamily: F.body, fontSize: 12, fontWeight: "600", color: C.ink } as TextStyle,
  configDesc: { fontFamily: F.body, fontSize: 11, color: C.ink3, marginTop: 2, lineHeight: 15 } as TextStyle,
  toggle: { width: 40, height: 22, borderRadius: 11, backgroundColor: C.line2, padding: 2 } as ViewStyle,
  toggleOn: { backgroundColor: P.red } as ViewStyle,
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: P.glassHi } as ViewStyle,
  toggleThumbOn: { transform: [{ translateX: 18 }] } as ViewStyle,

  // buttons (layout helpers; visual via ShojiButton)
  fullBtn: { marginTop: 4 } as ViewStyle,
  draftActions: { flexDirection: "row", gap: 10, marginTop: 4 } as ViewStyle,

  // pills (badges informativos)
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 } as ViewStyle,

  // empty
  emptyBox: { alignItems: "center", gap: 8, padding: 24 } as ViewStyle,
  emptyText: { fontFamily: F.body, fontSize: 12, color: C.ink4, textAlign: "center" } as TextStyle,

  // match primitives (compartilhado bracket + draft)
  matchCard: { backgroundColor: P.paper, borderRadius: 10, borderWidth: 1, borderColor: C.line, overflow: "hidden" } as ViewStyle,
  matchCardHead: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 5, backgroundColor: P.glass2, borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  matchCardIdx: { fontFamily: F.body, fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.0, color: C.ink3 } as TextStyle,
  sameDojoWarn: { fontFamily: F.body, fontSize: 9, color: P.red } as TextStyle,
  matchSide: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderLeftWidth: 3, minHeight: 38 } as ViewStyle,
  matchSideShiro: { borderTopWidth: 1, borderTopColor: C.line } as ViewStyle,
  matchSideWinner: { backgroundColor: P.redWash } as ViewStyle,
  matchSideLoser: { opacity: 0.42 } as ViewStyle,
  matchDivider: { height: 1, backgroundColor: C.line } as ViewStyle,

  // athlete block
  athleteRow: { flexDirection: "row", alignItems: "center", gap: 7, flex: 1 } as ViewStyle,
  av: { width: 22, height: 22, borderRadius: 11, backgroundColor: P.neutralWash, alignItems: "center", justifyContent: "center", flexShrink: 0 } as ViewStyle,
  avText: { fontFamily: F.body, fontSize: 9, fontWeight: "700", color: C.ink } as TextStyle,
  athleteName: { fontFamily: F.body, fontSize: 12, fontWeight: "500", color: C.ink } as TextStyle,
  athleteNameWinner: { fontWeight: "700" } as TextStyle,
  athleteDojo: { fontFamily: F.body, fontSize: 9.5, color: C.ink3, marginTop: 1 } as TextStyle,
  winMark: { fontFamily: F.body, fontSize: 11, fontWeight: "700", color: P.red, marginLeft: 4 } as TextStyle,
  byeText: { fontFamily: F.body, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.2, color: C.ink4 } as TextStyle,
  pendingText: { fontFamily: F.body, fontSize: 11, color: C.ink4, fontStyle: "italic" } as TextStyle,

  // ── bracket-only ──
  reopenBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: C.line, backgroundColor: P.glass2 } as ViewStyle,
  reopenText: { fontFamily: F.body, fontSize: 11, fontWeight: "600", color: C.ink3 } as TextStyle,
  bracketHint: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 } as ViewStyle,
  bracketHintText: { fontFamily: F.body, fontSize: 11.5, color: C.ink3 } as TextStyle,
  bracketScroll: { borderWidth: 1, borderColor: C.line, borderRadius: R.lg, backgroundColor: P.glass2 } as ViewStyle,
  bracketInner: { flexDirection: "row", padding: 22, gap: 60, minWidth: 400 } as ViewStyle,
  bracketCol: { gap: 8, width: 200 } as ViewStyle,
  champCol: { width: 180, justifyContent: "center" } as ViewStyle,
  roundLabel: { fontFamily: F.body, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.4, color: C.ink3, textAlign: "center", marginBottom: 8 } as TextStyle,
  champCard: { backgroundColor: P.redWash, borderRadius: R.md, borderWidth: 1, borderColor: P.red, padding: 16, alignItems: "center", gap: 4 } as ViewStyle,
  champLabel: { fontFamily: F.body, fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.4, color: C.ink3 } as TextStyle,
  champName: { fontFamily: F.heading, fontSize: 16, fontWeight: "700", color: C.ink } as TextStyle,
  champDojo: { fontFamily: F.body, fontSize: 11, color: C.ink3 } as TextStyle,
  champPending: { padding: 16, alignItems: "center", borderRadius: R.md, borderWidth: 1, borderColor: C.line, borderStyle: "dashed" } as ViewStyle,
  champPendingLabel: { fontFamily: F.body, fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.4, color: C.ink4 } as TextStyle,
  champPendingName: { fontFamily: F.heading, fontSize: 16, color: C.ink3, marginTop: 4 } as TextStyle,
  thirdLabel: { fontFamily: F.body, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.0, color: C.ink3, marginBottom: 6 } as TextStyle,
  scrollHint: { fontFamily: F.body, fontSize: 11, color: C.ink4, textAlign: "right", marginTop: 6 } as TextStyle,

  // ── kata-only ──
  kataGrid: { gap: 16 } as ViewStyle,
  kataTableHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 8 } as ViewStyle,
  kataTableTitle: { fontFamily: F.heading, fontSize: 18, fontWeight: "400", color: C.ink } as TextStyle,
  kataTableSub: { fontFamily: F.body, fontSize: 11, color: C.ink3 } as TextStyle,
  kataRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line } as ViewStyle,
  kataRowFirst: { backgroundColor: P.redWash } as ViewStyle,
  kataPos: { fontFamily: F.mono, fontSize: 13, fontWeight: "600", color: C.ink3, width: 24, textAlign: "right" } as TextStyle,
  kataNota: { fontFamily: F.mono, fontSize: 14, fontWeight: "700", color: C.ink, fontVariant: ["tabular-nums"] } as TextStyle,
  medalText: { fontFamily: F.body, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 } as TextStyle,
  editScoreBtn: { padding: 5, borderRadius: 8, backgroundColor: P.redWash } as ViewStyle,

  // kata classification pill
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: R.pill, backgroundColor: P.neutralWash, borderWidth: 1, borderColor: C.line } as ViewStyle,
  pillAccent: { backgroundColor: P.redWash, borderColor: P.redLine } as ViewStyle,
  pillNeutral: { backgroundColor: P.neutralWash, borderColor: C.line } as ViewStyle,
  pillText: { fontFamily: F.body, fontSize: 11, color: C.ink3, fontWeight: "500" } as TextStyle,
  pillTextAccent: { color: P.red, fontWeight: "700" } as TextStyle,
  pillTextNeutral: { color: C.ink3 } as TextStyle,
});
