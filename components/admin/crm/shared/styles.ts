// ─── CRM Comercial — Styles compartilhados ───────────────────────────────────
// Mantemos os styles aqui pra:
//  1) DRY entre views/components que compartilham seções, chips, badges
//  2) Evitar drift de design entre KanbanColumn/LeadCard/LeadDetailView
//  3) Facilitar futuro switch pra theme tokens (Colors -> useAccent())

import { Platform, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

export const isWeb = Platform.OS === "web";

export const crmStyles = StyleSheet.create({
  // ── Sections / containers ──────────────────────────────────────────────────
  section: {
    backgroundColor: Colors.bg3,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: Colors.ink, marginBottom: 10 },
  hintText: { fontSize: 11, color: Colors.ink3, lineHeight: 16, marginBottom: 14 },

  // ── Chips (filtros, canais, status) ────────────────────────────────────────
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  chipText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  chipTextActive: { color: Colors.violet3, fontWeight: "700" },

  // ── Badges (status, plano) ─────────────────────────────────────────────────
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "700" },

  // ── Action buttons ─────────────────────────────────────────────────────────
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg3,
  },
  actionBtnText: { fontSize: 12, fontWeight: "600", color: Colors.ink3 },

  // ── Inputs ─────────────────────────────────────────────────────────────────
  searchInput: {
    backgroundColor: Colors.bg3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 13,
    color: Colors.ink,
  },
  noteInput: {
    backgroundColor: Colors.bg4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: Colors.ink,
    minHeight: 70,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 10,
    color: Colors.ink3,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 6,
  },

  // ── Lead row / card ────────────────────────────────────────────────────────
  leadRow: {
    backgroundColor: Colors.bg3,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 6,
    position: "relative",
  },
  leadRowOverdue: { borderColor: Colors.red + "44", backgroundColor: Colors.red + "06" },
  leadRowRotten:  { borderColor: Colors.ink3 + "44", backgroundColor: Colors.bg4, opacity: 0.85 },
  leadRowSelected: { borderColor: Colors.violet3, backgroundColor: Colors.violetD },
  leadName: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  leadMeta: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  rowBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg4,
  },
  rowBtnText: { fontSize: 10, fontWeight: "700", color: Colors.ink3 },

  // ── Status dot (avatar circular) ───────────────────────────────────────────
  statusDot: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  statusDotText: { fontSize: 20, fontWeight: "800" },
  statusDotSm: { width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center" },

  // ── Filtros / barra superior ───────────────────────────────────────────────
  filterToggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.violet,
    fontSize: 8,
    color: "#fff",
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 14,
  } as any,

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyState: { alignItems: "center", padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginTop: 12 },
  emptyText: { fontSize: 12, color: Colors.ink3, textAlign: "center", marginTop: 6, lineHeight: 18 },

  // ── Buttons primarios (importar, etc) ──────────────────────────────────────
  importBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  importBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // ── Modal ──────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalBox: {
    backgroundColor: Colors.bg2,
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 480,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: Colors.ink, marginBottom: 16 },

  // ── Score badge ────────────────────────────────────────────────────────────
  scoreText: { fontSize: 10, fontWeight: "700" },

  // ── Rotten / overdue chips ─────────────────────────────────────────────────
  overdueBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.red + "15",
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.red + "33",
  },
  overdueText: { fontSize: 11, color: Colors.red, fontWeight: "600" },
  overdueChip: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: Colors.red + "18",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  overdueChipText: { fontSize: 9, color: Colors.red, fontWeight: "700", textTransform: "uppercase" },
  rottenChip: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: Colors.ink3 + "22",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rottenChipText: { fontSize: 9, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase" },

  // ── Info rows (key-value em detalhe) ───────────────────────────────────────
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600" },
  infoVal: { fontSize: 11, color: Colors.ink, fontWeight: "500", maxWidth: "60%" },

  // ── Timeline notes ─────────────────────────────────────────────────────────
  noteRow: {
    backgroundColor: Colors.bg4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    marginBottom: 8,
  },
  noteHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  noteAuthor: { fontSize: 10, color: Colors.violet3, fontWeight: "700" },
  noteDate: { fontSize: 10, color: Colors.ink3 },
  noteBody: { fontSize: 12, color: Colors.ink, lineHeight: 18 },
});
