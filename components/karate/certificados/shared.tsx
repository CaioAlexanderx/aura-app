// ============================================================
// Certificados (Track J) — tipos, constantes, helpers e estilos
// compartilhados entre os subcomponentes da caixa de certificados.
//
// Design System Shoji: papel opaco, sumi (ink), vermelhão raro.
// StyleSheet: todos os top-level entries são objetos (WeakMap safe).
// ============================================================
import { StyleSheet, ViewStyle, TextStyle } from "react-native";
import {
  KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F,
} from "@/constants/karateTheme";
import { CertOrderStatus } from "@/components/karate/EstadoSelo";

// ── Sub-tabs ──────────────────────────────────────────────────
// "Bancas" foi removida (fora do escopo atual). "Carteirinhas" (F5:
// impressão em lote, 30/06/2026) foi promovida a tela própria —
// /karate/carteirinhas (sisteminha de gestão da fila de impressão, ver
// app/karate/(federation)/carteirinhas/index.tsx). Restam Graduações e
// Certificados aqui.
export type SubTab = "graduacoes" | "certificados";

export const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "graduacoes",   label: "Graduações" },
  { id: "certificados", label: "Certificados" },
];

// ── Estado filter pills ───────────────────────────────────────
export const STATUS_FILTERS: { id: CertOrderStatus | "all"; label: string }[] = [
  { id: "all",          label: "Todos" },
  { id: "requested",    label: "Solicitado" },
  { id: "in_production",label: "Em produção" },
  { id: "printed",      label: "Impresso" },
  { id: "shipped",      label: "Enviado" },
  { id: "refused",      label: "Recusado" },
];

export const ADVANCE_OPTIONS: { value: CertOrderStatus; label: string }[] = [
  { value: "in_production", label: "Em produção" },
  { value: "printed",       label: "Impresso" },
  { value: "shipped",       label: "Enviado" },
];

// ── StatusSelectRow (dropdown simulado como radio) ────────────
export const STATUS_SELECT_OPTIONS: { value: CertOrderStatus | "refused_trigger"; label: string }[] = [
  { value: "requested",    label: "Solicitado" },
  { value: "in_production",label: "Em produção" },
  { value: "printed",      label: "Impresso" },
  { value: "shipped",      label: "Enviado" },
  { value: "refused_trigger", label: "Recusado…" },
];

// ── Helpers ───────────────────────────────────────────────────
export function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function fmtDate(iso: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
}

// ── Estilos Shoji compartilhados ──────────────────────────────
export const cs = StyleSheet.create({
  // ── Sub-tabs ──
  subTabBar: { borderBottomWidth: 1, borderBottomColor: C.line, marginBottom: 20 } as ViewStyle,
  subTab: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: "transparent", marginBottom: -1 } as ViewStyle,
  subTabActive: { borderBottomColor: P.red } as ViewStyle,
  subTabText: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: C.ink3 } as TextStyle,
  subTabTextActive: { color: P.red, fontWeight: "700" } as TextStyle,

  stubBox: { paddingVertical: 48, alignItems: "center" } as ViewStyle,
  stubText: { fontFamily: F.body, fontSize: 13, color: C.ink3 } as TextStyle,

  // ── Empty state (limpo) ──
  emptyState: { alignItems: "center", paddingVertical: 56, gap: 10 } as ViewStyle,
  emptyStateTitle: { fontFamily: F.heading, fontSize: 17, color: C.ink, marginTop: 4 } as TextStyle,
  emptyStateText: { fontFamily: F.body, fontSize: 13, color: C.ink3, textAlign: "center", maxWidth: 380, lineHeight: 19 } as TextStyle,

  // ── Section / alert badge ──
  alertBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: P.redWash, borderRadius: R.pill, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: P.redLine } as ViewStyle,
  alertDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.danger } as ViewStyle,
  alertBadgeText: { fontFamily: F.body, fontSize: 11, fontWeight: "700", color: C.danger } as TextStyle,

  // ── Batch toolbar ──
  batchBar: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", padding: 14, borderRadius: R.md, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, marginBottom: 14 } as ViewStyle,
  batchCount: { fontFamily: F.heading, fontSize: 18, color: C.ink } as TextStyle,
  batchLabel: { fontFamily: F.body, fontSize: 12, color: C.ink2 } as TextStyle,
  batchForLabel: { fontFamily: F.body, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.08, color: C.ink3 } as TextStyle,
  batchOpt: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: R.sm, borderWidth: 1, borderColor: C.line2, backgroundColor: P.glass2 } as ViewStyle,
  batchOptSel: { backgroundColor: P.ink, borderColor: P.ink } as ViewStyle,
  batchOptText: { fontFamily: F.body, fontSize: 12, color: C.ink3 } as TextStyle,
  batchOptTextSel: { color: P.paperWarm, fontWeight: "700" } as TextStyle,

  // ── Order row ──
  orderRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  orderRowSel: { backgroundColor: P.redWash } as ViewStyle,
  checkbox: { padding: 4 } as ViewStyle,
  checkboxBox: { width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, borderColor: C.line2, alignItems: "center", justifyContent: "center" } as ViewStyle,
  checkboxBoxSel: { backgroundColor: P.ink, borderColor: P.ink } as ViewStyle,
  name: { fontFamily: F.body, fontSize: 13, fontWeight: "700", color: C.ink } as TextStyle,
  orderMeta: { fontFamily: F.mono, fontSize: 11, color: C.ink3, marginTop: 2 } as TextStyle,
  detailBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: R.sm, borderWidth: 1, borderColor: C.line2, backgroundColor: P.glass2 } as ViewStyle,
  detailBtnText: { fontFamily: F.body, fontSize: 11.5, fontWeight: "600", color: C.ink2 } as TextStyle,

  empty: { alignItems: "center", paddingVertical: 40, gap: 8 } as ViewStyle,
  emptyText: { fontFamily: F.body, fontSize: 13, color: C.ink4 } as TextStyle,

  hint: { fontFamily: F.body, fontSize: 11.5, color: C.ink4, marginTop: 14, lineHeight: 18 } as TextStyle,

  // ── Botões ──
  btnPrimary: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: P.ink, borderRadius: R.sm, paddingVertical: 8, paddingHorizontal: 14 } as ViewStyle,
  btnPrimaryText: { fontFamily: F.body, fontSize: 12.5, fontWeight: "700", color: P.paperWarm } as TextStyle,
  btnGhost: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: R.sm, borderWidth: 1, borderColor: C.line2, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: P.glass2 } as ViewStyle,
  btnGhostText: { fontFamily: F.body, fontSize: 12, fontWeight: "600", color: C.ink2 } as TextStyle,
  btnDanger: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.danger, borderRadius: R.sm, paddingVertical: 8, paddingHorizontal: 14 } as ViewStyle,
  btnDangerText: { fontFamily: F.body, fontSize: 12.5, fontWeight: "700", color: "#fdf8f2" } as TextStyle,

  // ── Campos ──
  fieldLabel: { fontFamily: F.body, fontSize: 10.5, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.06, color: C.ink3, marginBottom: 6 } as TextStyle,
  field: { borderWidth: 1, borderColor: C.line2, borderRadius: R.sm, padding: 11, fontFamily: F.body, fontSize: 13, color: C.ink, backgroundColor: P.glass2 } as ViewStyle,

  // ── Overlay (modais) ──
  overlay: { flex: 1, backgroundColor: "rgba(43,38,32,0.34)", alignItems: "center", justifyContent: "center", padding: 20 } as ViewStyle,

  // ── Recusar modal ──
  recusarCard: { backgroundColor: P.glassHi, borderRadius: R.lg, padding: 24, width: "100%", maxWidth: 460, borderWidth: 1, borderColor: C.line } as ViewStyle,
  recusarTitle: { fontFamily: F.heading, fontSize: 19, color: C.ink, marginBottom: 4 } as TextStyle,
  recusarSub: { fontFamily: F.body, fontSize: 12.5, color: C.ink3, marginBottom: 16 } as TextStyle,
  recusarHint: { fontFamily: F.body, fontSize: 11, color: C.ink3, marginTop: 10 } as TextStyle,
  recusarFooter: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 20 } as ViewStyle,

  // ── Detalhe drawer ──
  drawer: { backgroundColor: P.glassHi, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, width: "100%", maxHeight: "90%", overflow: "hidden", borderWidth: 1, borderColor: C.line } as ViewStyle,
  drawerHeader: { flexDirection: "row", alignItems: "flex-start", padding: 20, borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  drawerMono: { fontFamily: F.mono, fontSize: 10, color: C.ink3, letterSpacing: 0.04 } as TextStyle,
  drawerName: { fontFamily: F.heading, fontSize: 21, color: C.ink, marginTop: 4 } as TextStyle,
  drawerBelt: { fontFamily: F.body, fontSize: 12, color: C.ink3, marginTop: 4 } as TextStyle,

  kvList: { gap: 0, borderWidth: 1, borderColor: C.line, borderRadius: R.sm, overflow: "hidden" } as ViewStyle,
  kvRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 10, borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  kLabel: { fontFamily: F.body, fontSize: 11, fontWeight: "700", color: C.ink3, width: 90, flexShrink: 0, paddingTop: 1 } as TextStyle,
  kValue: { fontFamily: F.body, fontSize: 13, color: C.ink, flex: 1 } as TextStyle,
  kAddr: { fontFamily: F.mono, fontSize: 11, color: C.ink3, marginTop: 4, lineHeight: 18 } as TextStyle,

  refusalBox: { padding: 12, borderWidth: 1, borderColor: P.redLine, borderRadius: R.sm, backgroundColor: P.redWash, marginBottom: 14 } as ViewStyle,
  refusalTitle: { fontFamily: F.body, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.1, color: C.danger, marginBottom: 6 } as TextStyle,
  refusalText: { fontFamily: F.body, fontSize: 12.5, color: C.ink, lineHeight: 19 } as TextStyle,

  tlRow: { flexDirection: "row", gap: 12 } as ViewStyle,
  tlDotCol: { width: 18, alignItems: "center" } as ViewStyle,
  tlDot: { width: 9, height: 9, borderRadius: 4.5, marginTop: 6 } as ViewStyle,
  tlLine: { width: 1, flex: 1, backgroundColor: C.line, marginVertical: 2 } as ViewStyle,
  tlWho: { fontFamily: F.body, fontSize: 12, fontWeight: "600", color: C.ink, marginTop: 6 } as TextStyle,
  tlOrg: { fontFamily: F.mono, fontSize: 11, color: C.ink3, marginTop: 2 } as TextStyle,

  processBox: { marginTop: 20, padding: 14, borderWidth: 1, borderColor: C.line, borderRadius: R.sm, backgroundColor: C.surface } as ViewStyle,
  processOpt: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  processOptText: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: C.ink2 } as TextStyle,
});
