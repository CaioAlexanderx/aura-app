import { StyleSheet, Platform } from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";

// QA 23/11/2026 (P2): contraste mínimo de 4,5:1 nos textos de 11–12 px da
// ficha. O ink3 do tema escuro (~3,9:1), o âmbar e o verde do tema claro
// (~3:1 e ~3,8:1) ficavam abaixo. Só a ficha muda; os tokens do app não.
export const CorDaFicha = {
  secundario: IS_DARK_MODE ? "rgba(196,188,245,0.86)" : Colors.ink3,
  ambarTexto: IS_DARK_MODE ? Colors.amber : "#92400e",
  verdeTexto: IS_DARK_MODE ? Colors.green : "#047857",
  // 25/11/2026 (cores por situação): texto do atraso e do "a conferir" com o
  // mesmo contraste dos dois de cima.
  vermelhoTexto: IS_DARK_MODE ? Colors.red : "#b91c1c",
  violetaTexto: IS_DARK_MODE ? Colors.violet4 : Colors.violet3,
};
import { Fonts } from "@/constants/fonts";

// 23/11/2026 (F1 da ficha): toda fonte da ficha vem de constants/fonts.
export const m = StyleSheet.create({
  // F3: backdrop unificado (0.72) — mesmo peso dos demais modais do fluxo.
  backdrop: { flex: 1, backgroundColor: "rgba(3,5,14,0.72)", justifyContent: "center", alignItems: "center", padding: 16 },
  // Item 3 (16/06): maxWidth 480 -> 700 para acomodar melhor o volume de info.
  // width "100%" mantem mobile full-bleed; maxWidth so morde no desktop.
  sheet: { backgroundColor: Colors.bg2, borderRadius: 20, width: "100%", maxWidth: 700, maxHeight: "90%", overflow: "hidden", borderWidth: 1, borderColor: Colors.border },

  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  crumb: { flexDirection: "row", alignItems: "center", gap: 5 },
  crumbTxt: { fontFamily: Fonts.body, fontSize: 13, fontWeight: "700", color: Colors.violet3 },
  // 23/11/2026 (F5): alvo de toque de 44 px.
  xBtn: { width: 44, height: 44, borderRadius: 11, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center" },

  // HOTFIX F4.2 (09/07): flexShrink 1 — quando um sheet inferior (Receber/Pix/
  // Renegociar) abre em tela baixa, o body cede espaço em vez de empurrar
  // o sheet para fora do modal (que tem overflow hidden).
  body: { flexGrow: 0, flexShrink: 1, minHeight: 80 },

  fixedHeader: { paddingHorizontal: 18, paddingTop: 12, backgroundColor: Colors.bg2, borderBottomWidth: 1, borderBottomColor: Colors.border },
  fixedMeta: { flexDirection: "row", gap: 8, marginBottom: 12 },
  fixedMetaItem: { flex: 1, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  fixedMetaLbl: { fontFamily: Fonts.body, fontSize: 8.5, fontWeight: "800", letterSpacing: 0.6, color: CorDaFicha.secundario },
  fixedMetaVal: { fontFamily: Fonts.body, fontSize: 14, fontWeight: "800", color: Colors.ink, marginTop: 3 },

  tabs: { flexDirection: "row", gap: 6, marginBottom: 14 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 9, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabOn: { backgroundColor: Colors.violet, borderColor: Colors.violet2 },
  tabTxt: { fontFamily: Fonts.body, fontSize: 11, fontWeight: "700", color: Colors.ink2 },
  tabTxtOn: { color: "#fff" },

  scoreBanner: { flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: Colors.amber + "18", borderWidth: 1, borderColor: Colors.amber + "44", borderRadius: 11, padding: 12, marginBottom: 13 },
  conferirBanner: { backgroundColor: Colors.violetD, borderColor: Colors.violet + "44" },
  scoreBannerTxt: { fontFamily: Fonts.body, flex: 1, fontSize: 12, color: CorDaFicha.ambarTexto, lineHeight: 17 },
  scorePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  scorePillTxt: { fontFamily: Fonts.body, fontSize: 10, fontWeight: "700" },

  cust: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 },
  custL: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontFamily: Fonts.body, fontSize: 18, fontWeight: "700", color: Colors.violet3 },
  custName: { fontFamily: Fonts.body, fontSize: 18, fontWeight: "700", color: Colors.ink },
  custSub: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  pillTxt: { fontFamily: Fonts.body, fontSize: 10, fontWeight: "700" },
  waBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(52,211,153,0.12)", borderWidth: 1, borderColor: "rgba(52,211,153,0.4)", borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9 },
  waTxt: { fontFamily: Fonts.body, fontSize: 12, fontWeight: "700", color: CorDaFicha.verdeTexto },

  card: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 14, marginBottom: 13 },

  heroCard: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, borderRadius: 16, padding: 18, marginBottom: 13, alignItems: "center" },
  heroLabel: { fontFamily: Fonts.body, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, color: Colors.violet3, textTransform: "uppercase", marginBottom: 6 },
  heroValue: { fontFamily: Fonts.body, fontSize: 34, fontWeight: "800", marginBottom: 4 },
  heroSub: { fontFamily: Fonts.body, fontSize: 12, color: CorDaFicha.secundario, textAlign: "center" },

  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  cardTitle: { fontFamily: Fonts.body, fontSize: 10, fontWeight: "800", letterSpacing: 1, color: CorDaFicha.secundario, textTransform: "uppercase" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 },
  rowK: { fontFamily: Fonts.body, fontSize: 13, fontWeight: "600", color: Colors.ink },
  rowKsub: { fontFamily: Fonts.body, fontSize: 11, color: CorDaFicha.secundario, marginTop: 1 },
  rowV: { fontFamily: Fonts.body, fontSize: 17, fontWeight: "800" },

  newAccBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  newAccTxt: { fontFamily: Fonts.body, fontSize: 11, fontWeight: "700", color: Colors.violet3 },
  newAccRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  newAccInput: { fontFamily: Fonts.body, flex: 1, borderWidth: 1, borderColor: Colors.border2, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, color: Colors.ink, fontSize: 13, backgroundColor: Colors.bg2 },
  newAccConfirm: { backgroundColor: Colors.violet, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8, alignItems: "center", justifyContent: "center" },
  newAccConfirmTxt: { fontFamily: Fonts.body, fontSize: 12, fontWeight: "700", color: "#fff" },

  accCard: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12, marginTop: 4, paddingBottom: 4 },
  accTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  accName: { fontFamily: Fonts.body, fontSize: 13, fontWeight: "700", color: Colors.ink },
  accMeta: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 5 },
  accBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  accBadgeTxt: { fontFamily: Fonts.body, fontSize: 10, fontWeight: "700" },
  accBalance: { fontFamily: Fonts.body, fontSize: 16, fontWeight: "800" },
  accNextDue: { fontFamily: Fonts.body, fontSize: 10, color: CorDaFicha.secundario, marginTop: 2 },
  accActions: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  accActionBtn: { backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 13, paddingVertical: 7 },
  accActionWa: { backgroundColor: "rgba(52,211,153,0.12)", borderWidth: 1, borderColor: "rgba(52,211,153,0.35)" },
  accActionTxt: { fontFamily: Fonts.body, fontSize: 12, fontWeight: "700", color: "#fff" },
  accInstList: { marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },

  parc: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 11, borderTopWidth: 1, borderTopColor: Colors.border },
  parcT: { fontFamily: Fonts.body, fontSize: 13, fontWeight: "700", color: Colors.ink },
  parcS: { fontFamily: Fonts.body, fontSize: 11, color: CorDaFicha.secundario, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeTxt: { fontFamily: Fonts.body, fontSize: 10, fontWeight: "700" },
  receberBtn: { backgroundColor: Colors.violet, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8 },
  receberTxt: { fontFamily: Fonts.body, fontSize: 12, fontWeight: "700", color: "#fff" },

  chargesBreakdown: { marginTop: 7, backgroundColor: Colors.bg2, borderRadius: 9, padding: 9, borderWidth: 1, borderColor: Colors.border2 },
  chargesRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  chargesLbl: { fontFamily: Fonts.body, fontSize: 11, color: CorDaFicha.secundario, flex: 1 },
  chargesVal: { fontFamily: Fonts.body, fontSize: 11, fontWeight: "700", color: Colors.ink },
  chargesDaysChip: { fontFamily: Fonts.body, fontSize: 10, color: Colors.amber, fontWeight: "700" },
  chargesTotalRow: { borderTopWidth: 1, borderTopColor: Colors.border2, paddingTop: 5, marginTop: 2, marginBottom: 0 },
  chargesTotalLbl: { fontFamily: Fonts.body, fontSize: 12, fontWeight: "700", color: Colors.ink, flex: 1 },
  chargesTotalVal: { fontFamily: Fonts.body, fontSize: 13, fontWeight: "800", color: Colors.red },

  chargesSummary: { marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: Colors.border2 },
  chargesSummaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 5 },
  chargesSummaryLbl: { fontFamily: Fonts.body, fontSize: 12, color: CorDaFicha.secundario },
  chargesSummaryVal: { fontFamily: Fonts.body, fontSize: 13, fontWeight: "800", color: Colors.ink },

  freeBox: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, borderRadius: 14, padding: 14, marginBottom: 13 },
  freeTitle: { fontFamily: Fonts.body, fontSize: 10, fontWeight: "800", letterSpacing: 1, color: Colors.violet3, textTransform: "uppercase", marginBottom: 10 },
  modeRow: { flexDirection: "row", gap: 7, marginBottom: 10 },
  modeChip: { flex: 1, alignItems: "center", backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 9, paddingVertical: 8 },
  modeChipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet2 },
  modeChipTxt: { fontFamily: Fonts.body, fontSize: 11, fontWeight: "700", color: Colors.ink2, textAlign: "center" },
  modeChipTxtOn: { color: "#fff" },
  fieldBlock: { marginTop: 4 },
  fieldLabel: { fontFamily: Fonts.body, fontSize: 11, fontWeight: "700", color: CorDaFicha.secundario, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 10 },
  chip: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 6 },
  chipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet2 },
  chipTxt: { fontFamily: Fonts.body, fontSize: 11, fontWeight: "700", color: Colors.ink2 },
  chipTxtOn: { color: "#fff" },
  distRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  distLabel: { fontFamily: Fonts.body, flex: 1, fontSize: 12, fontWeight: "600", color: Colors.ink },
  distInput: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 },
  distField: { fontFamily: Fonts.body, width: 80, color: Colors.ink, fontSize: 13, fontWeight: "700", paddingVertical: 0 },
  distTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border2 },
  distTotalLbl: { fontFamily: Fonts.body, fontSize: 12, color: CorDaFicha.secundario },
  distTotalVal: { fontFamily: Fonts.body, fontSize: 14, fontWeight: "800", color: Colors.amber },
  amountIn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg2, borderWidth: 1.5, borderColor: Colors.violet2, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 11 },
  amountPrefix: { fontFamily: Fonts.body, fontSize: 14, color: CorDaFicha.secundario, fontWeight: "600" },
  amountInput: { fontFamily: Fonts.body, flex: 1, color: Colors.ink, fontSize: 20, fontWeight: "800", paddingVertical: 0 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 },
  qChip: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 6 },
  qChipTxt: { fontFamily: Fonts.body, fontSize: 11, fontWeight: "700", color: Colors.ink2 },
  // QA 23/11 (P2): 16 px — abaixo disso o iOS dá zoom ao focar.
  dateInput: { fontFamily: Fonts.body, backgroundColor: Colors.bg2, borderColor: Colors.violet2, borderWidth: 1.5, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, color: Colors.ink },
  dateHint: { fontFamily: Fonts.body, fontSize: 11, color: CorDaFicha.secundario, marginTop: 6 },
  methods: { flexDirection: "row", gap: 7 },
  method: { flex: 1, alignItems: "center", backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 9, paddingVertical: 9 },
  methodActive: { backgroundColor: Colors.violet, borderColor: Colors.violet2 },
  methodTxt: { fontFamily: Fonts.body, fontSize: 12, fontWeight: "700", color: Colors.ink2 },
  after: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: Colors.border2 },
  afterK: { fontFamily: Fonts.body, fontSize: 12, color: CorDaFicha.secundario },
  afterV: { fontFamily: Fonts.body, fontSize: 14, fontWeight: "800", color: Colors.amber },

  tlItem: { flexDirection: "row", gap: 11, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  tlDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  tlLine: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  tlMain: { fontFamily: Fonts.body, fontSize: 13, fontWeight: "600", color: Colors.ink },
  tlAmt: { fontFamily: Fonts.body, fontSize: 13, fontWeight: "800" },
  tlSub: { fontFamily: Fonts.body, fontSize: 11, color: CorDaFicha.secundario, marginTop: 1 },
  tlAccTag: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 },
  tlAccTagTxt: { fontFamily: Fonts.body, fontSize: 10, fontWeight: "700", color: Colors.violet3 },
  emptyTxt: { fontFamily: Fonts.body, fontSize: 12, color: CorDaFicha.secundario, paddingVertical: 6 },

  termsHint: { fontFamily: Fonts.body, fontSize: 12, color: CorDaFicha.secundario, lineHeight: 17, marginBottom: 10 },
  termsEffRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.bg2, borderRadius: 9, padding: 10, borderWidth: 1, borderColor: Colors.border2 },
  termsEffLbl: { fontFamily: Fonts.body, fontSize: 12, color: CorDaFicha.secundario },
  termsEffVal: { fontFamily: Fonts.body, fontSize: 13, fontWeight: "700", color: Colors.violet3 },
  termsInput: { fontFamily: Fonts.body, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: Colors.ink, backgroundColor: Colors.bg2 },

  blockRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  blockLabel: { fontFamily: Fonts.body, fontSize: 14, fontWeight: "700", color: Colors.ink },
  blockReason: { fontFamily: Fonts.body, fontSize: 12, color: CorDaFicha.secundario, marginTop: 2 },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  cta: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  ctaTxt: { fontFamily: Fonts.body, fontSize: 14, fontWeight: "700", color: "#fff" },

  calBtn: {
    backgroundColor: Colors.violetD, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 6,
    minWidth: 30, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.violet + "44",
  },
  editDueDateSheet: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    padding: 16, backgroundColor: Colors.bg3,
  },
  editDueDateHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6,
  },
  editDueDateTitle: { fontFamily: Fonts.body, fontSize: 14, fontWeight: "800", color: Colors.ink },
  editDueDateSub: { fontFamily: Fonts.body, fontSize: 11, color: CorDaFicha.secundario, marginBottom: 10, lineHeight: 16 },

  tabSm: { paddingVertical: 5 },

  pixBtn: { backgroundColor: Colors.green + "22", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: Colors.green + "44" },
  pixBtnTxt: { fontFamily: Fonts.body, fontSize: 11, fontWeight: "700", color: CorDaFicha.verdeTexto },

  pixOverlay: { borderTopWidth: 1, borderTopColor: Colors.border, padding: 16, backgroundColor: Colors.bg2 },
  pixOverlayHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  pixAmtLabel: { fontFamily: Fonts.body, fontSize: 24, fontWeight: "800", color: Colors.ink, textAlign: "center", marginBottom: 2 },
  pixInstLabel: { fontFamily: Fonts.body, fontSize: 12, color: CorDaFicha.secundario, textAlign: "center", marginBottom: 12 },
  pixEmvBox: { backgroundColor: Colors.bg3, borderRadius: 9, padding: 10, borderWidth: 1, borderColor: Colors.border2, marginTop: 4 },
  pixEmvTxt: { fontSize: 11, color: CorDaFicha.secundario, fontFamily: Platform.OS === "web" ? "monospace" : undefined },

  previewBox: { backgroundColor: Colors.bg2, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border2, marginTop: 14 },
  previewTitle: { fontFamily: Fonts.body, fontSize: 10, fontWeight: "800", letterSpacing: 1, color: Colors.violet3, textTransform: "uppercase", marginBottom: 8 },
  previewRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 },
  previewLbl: { fontFamily: Fonts.body, fontSize: 12, color: CorDaFicha.secundario, flex: 1 },
  previewVal: { fontFamily: Fonts.body, fontSize: 12, fontWeight: "700", color: Colors.ink, textAlign: "right" },

  // ── Painéis de ação (task 03/08: telas pequenas) ──────────────────
  // Substituem os sub-sheets que empilhavam de baixo comprimindo o body
  // (editDueDateSheet/pixOverlay): agora cada ação desliza POR CIMA,
  // ocupando o sheet inteiro, com header próprio (‹ Voltar) e rodapé
  // fixo — nada de CTA dentro do scroll, nada de body com 80px.
  panel: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.bg2, zIndex: 10,
  },
  panelHead: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  panelBack: {
    flexDirection: "row", alignItems: "center", gap: 2,
    paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, minHeight: 44,
  },
  panelBackTxt: { fontFamily: Fonts.body, fontSize: 14, fontWeight: "600", color: Colors.violet3 },
  panelTitle: { fontFamily: Fonts.body, flex: 1, fontSize: 16, fontWeight: "800", color: Colors.ink },
  panelBody: { flexGrow: 1, flexShrink: 1, minHeight: 0 },
  panelFoot: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    padding: 16, backgroundColor: Colors.bg2,
  },

  // ── Item 2 (16/06): renegociacao de parcelas ──────────────────────
  // Botao "Renegociar" (acao secundaria, estilo outline violeta).
  renegActionBtn: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  renegActionTxt: { color: Colors.violet3 },
  // Stepper de numero de parcelas (− valor +).
  renegStepRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  renegStepBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  renegStepBtnDisabled: { opacity: 0.4 },
  renegStepVal: { fontFamily: Fonts.body, minWidth: 56, textAlign: "center", fontSize: 18, fontWeight: "800", color: Colors.ink },
  renegHint: { fontFamily: Fonts.body, fontSize: 11, color: CorDaFicha.secundario, marginTop: 6, lineHeight: 16 },
  // Linha de delta (desconto/acrescimo) no resumo.
  renegDeltaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border2 },
  renegDeltaLbl: { fontFamily: Fonts.body, fontSize: 12, color: CorDaFicha.secundario },
  renegDeltaVal: { fontFamily: Fonts.body, fontSize: 14, fontWeight: "800" },

} as any);
