// ============================================================
// AURA. — Novo lançamento do crediário: estilos comuns (12/10/2026)
//
// Os blocos que as três telas do redesenho repetem (rótulo, campo, chip,
// botão), com as medidas do mockup aprovado
// (docs/mockups/crediario-lancamento-manual.html). Só tokens de Colors.
// ============================================================
import { StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

export const e = StyleSheet.create({
  body: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 16 },
  gap: { gap: 14 },
  label: { fontSize: 12, fontWeight: "600", color: Colors.ink2, marginBottom: 6 },
  labelOptional: { fontWeight: "400", color: Colors.ink3 },
  hint: { fontSize: 11.5, color: Colors.ink3, marginTop: 5 },
  sec: {
    fontSize: 10.5, fontWeight: "600", color: Colors.ink3, letterSpacing: 0.8,
    textTransform: "uppercase", marginHorizontal: 2, marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minHeight: 44,
    fontSize: 14,
    color: Colors.ink,
    backgroundColor: Colors.bg2,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 44,
    backgroundColor: Colors.bg2,
  },
  inputRowText: { flex: 1, paddingVertical: 11, fontSize: 14, color: Colors.ink },
  two: { flexDirection: "row", gap: 12 },
  col: { flex: 1, minWidth: 0 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minWidth: 48, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2, alignItems: "center",
  },
  chipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet2 },
  chipGhost: { backgroundColor: "transparent", borderStyle: "dashed" },
  chipTxt: { fontSize: 13, fontWeight: "700", color: Colors.ink2 },
  chipTxtOn: { color: "#fff" },
  chipTxtGhost: { color: Colors.violet3 },
  quick: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  quickBtn: {
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  quickTxt: { fontSize: 11.5, fontWeight: "600", color: Colors.violet3 },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    minHeight: 48, borderRadius: 12, backgroundColor: Colors.violet, paddingHorizontal: 14,
  },
  ctaTxt: { fontSize: 14, fontWeight: "800", color: "#fff" },
  ctaSec: { backgroundColor: "transparent", borderWidth: 1, borderColor: Colors.border2 },
  ctaSecTxt: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  pressed: { opacity: 0.75 },
});
