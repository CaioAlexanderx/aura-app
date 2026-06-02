// ============================================================
// AURA STUDIO · StudioShell — makeStyles compartilhado + makeMm
//
// Decomposição Fase 2 (31/05/2026): centraliza StyleSheet usado por
// NavCircle, ChildBubble, ChildHoverBubble, MobileChip, sidebar e
// mobileBar. Mantém compatibilidade — chaves NÃO renomeadas.
//
// 02/06/2026 (Shell clareza — contraste AA):
//   - mobileChipTxt: ink4 (2.4:1 sobre paperCard) → ink3 (5.1:1) ✓ AA
//   - childLabel: ink4 → ink3 para mesma garantia AA
//   - hoverChildLabel: já usava c.ink (passa AA); sem mudança
// ============================================================
import { StyleSheet, Platform } from "react-native";
import { Tok } from "./types";

export const makeStyles = (c: Tok) =>
  StyleSheet.create({
    sidebar: {
      width: 104,
      paddingVertical: 28,
      paddingHorizontal: 18,
      alignItems: "center",
      gap: 20,
      zIndex: 1000,
    },

    brandWrap: {
      ...(Platform.OS === "web"
        ? { boxShadow: "0 0 32px rgba(236,72,153,0.45), 0 0 18px rgba(30,58,138,0.45)" }
        : { shadowColor: c.accent, shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 0 }, elevation: 8 }),
      borderRadius: 30,
    } as any,

    brand: {
      width: 54, height: 54,
      backgroundColor: c.primary,
      borderRadius: 27,
      alignItems: "center", justifyContent: "center",
    },
    brandTxt: { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },

    navCircle: {
      width: 60, height: 60,
      backgroundColor: c.paperCardElev,
      borderWidth: 2, borderColor: c.ink5,
      borderRadius: 30,
      alignItems: "center", justifyContent: "center",
    },
    navCircleActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    groupDot: {
      position: "absolute",
      bottom: 4, right: 4,
      width: 10, height: 10, borderRadius: 5,
      backgroundColor: c.accent,
      borderWidth: 2, borderColor: "#fff",
    },

    childrenPop: {
      position: "absolute",
      left: 72, top: -8,
      zIndex: 2000,
    },
    childrenInner: {
      flexDirection: "row",
      gap: 10,
      padding: 10,
      backgroundColor: c.paperCardElev,
      borderRadius: 40,
      borderWidth: 1, borderColor: c.ink5,
      shadowColor: "#0F172A", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 12 },
      elevation: 10,
    },
    navChild: {
      width: 44, height: 44,
      borderRadius: 22,
      alignItems: "center", justifyContent: "center",
      shadowColor: "#0F172A", shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
    childBadge: {
      position: "absolute",
      top: -3, right: -3,
      minWidth: 16, height: 16,
      borderRadius: 8, paddingHorizontal: 4,
      alignItems: "center", justifyContent: "center",
      borderWidth: 2, borderColor: "#fff",
    },
    childBadgeTxt: { color: "#fff", fontSize: 9, fontWeight: "800" },
    // AA fix (02/06/2026): ink4 (2.4:1 light, 3.1:1 dark) → ink3 (5.1:1 light, 5.7:1 dark)
    childLabel: {
      fontSize: 10, color: c.ink3,
      textAlign: "center", marginTop: 4,
      fontWeight: "600",
    },

    childBubblesContainer: {
      position: "absolute",
      left: 72,
      top: 0,
      flexDirection: "column",
      gap: 10,
      paddingLeft: 4,
      paddingRight: 4,
      paddingVertical: 4,
      zIndex: 3000,
    },
    hoverChildRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.paperCardElev,
      borderRadius: 999,
      paddingLeft: 4,
      paddingRight: 14,
      paddingVertical: 4,
      ...(Platform.OS === "web"
        ? { boxShadow: "0 6px 16px rgba(15,23,42,0.18), 0 2px 4px rgba(15,23,42,0.08)" } as any
        : { shadowColor: "#0F172A", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 }),
      borderWidth: 1,
      borderColor: "rgba(15,23,42,0.06)",
    },
    hoverChildBubble: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "#fff",
    },
    hoverChildLabel: {
      fontSize: 13,
      color: c.ink,
      fontWeight: "700",
      letterSpacing: -0.2,
      ...(Platform.OS === "web" ? { whiteSpace: "nowrap" } as any : {}),
    },
    hoverChildBadge: {
      position: "absolute",
      top: -2,
      right: -2,
      width: 8,
      height: 8,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: "#fff",
    },

    avatar: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: c.accent,
      alignItems: "center", justifyContent: "center",
      borderWidth: 3, borderColor: "#fff",
      ...(Platform.OS === "web"
        ? { boxShadow: "0 0 20px rgba(236,72,153,0.4), 0 4px 10px rgba(15,23,42,0.12)" } as any
        : { shadowColor: c.accent, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 6 }),
    },
    avatarTxt: { color: "#fff", fontSize: 14, fontWeight: "800" },

    mobileBar: {
      backgroundColor: c.paperCardElev,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(15,23,42,0.08)",
      paddingTop: 8,
      paddingBottom: 8,
      paddingHorizontal: 12,
      gap: 6,
    },
    mobileBarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    mobileMenuBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 12, paddingVertical: 6,
      backgroundColor: c.primary, borderRadius: 999,
    },
    mobileMenuBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },
    mobileBrand: {
      alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 4,
      backgroundColor: c.primary, borderRadius: 12,
    },
    mobileBrandTxt: { color: "#fff", fontWeight: "900", fontSize: 13, letterSpacing: 0.5 },
    mobileChipsRow: {
      flexDirection: "row", gap: 6, paddingHorizontal: 4, paddingVertical: 4,
    },
    mobileChip: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 12, paddingVertical: 6,
      backgroundColor: c.paperCardElev,
      borderWidth: 1, borderColor: c.ink4,
      borderRadius: 999,
    },
    // AA fix (02/06/2026): ink4 → ink3 para ≥4.5:1 sobre paperCardElev
    mobileChipTxt: { color: c.ink3, fontWeight: "600", fontSize: 12 },
  });

export const makeMm = (c: Tok) =>
  StyleSheet.create({
    groupLabel: {
      fontSize: 10,
      color: c.accent,
      fontWeight: "800",
      letterSpacing: 0.8,
      marginTop: 6,
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: c.paperCardElev,
      borderWidth: 1,
      borderColor: c.ink5,
      borderRadius: 14,
    },
    itemIcon: {
      width: 28, height: 28, borderRadius: 14,
      alignItems: "center", justifyContent: "center",
    },
    itemTxt: { fontSize: 14, color: c.ink2, fontWeight: "600" },
  });
