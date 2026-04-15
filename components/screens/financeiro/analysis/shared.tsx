import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { fmt, fmtK } from "../types";

var isWeb = Platform.OS === "web";

export var PAL = { green: Colors.green, red: Colors.red, amber: Colors.amber, violet: "#7c3aed", violet2: "#a78bfa", violet3: Colors.violet3, violetD: Colors.violetD, teal: "#0d9488" };
export var EMP_COLORS = [PAL.violet, PAL.teal, "#6366f1", PAL.amber, PAL.violet2];
export var BAR_COLORS = [PAL.violet, "#6366f1", PAL.teal, PAL.amber, PAL.violet2, "#818cf8", "#2dd4bf"];
export var CHART_H = 140;

export function Card({ children, style }: any) {
  var [h, sH] = useState(false);
  return <Pressable onHoverIn={isWeb ? function() { sH(true); } : undefined} onHoverOut={isWeb ? function() { sH(false); } : undefined}
    style={[cs.card, h && { borderColor: Colors.border2, transform: [{ translateY: -1 }] }, isWeb && { transition: "all 0.25s ease" } as any, style]}>{children}</Pressable>;
}

export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return <View style={{ marginBottom: 8 }}><Text style={cs.secTitle}>{title}</Text>{hint && <Text style={cs.secHint}>{hint}</Text>}</View>;
}

export function HoverBar({ height, maxH, value, label, color, width }: { height: number; maxH: number; value: string; label: string; color: string; width?: number }) {
  var [h, sH] = useState(false);
  var barH = Math.max((height / Math.max(maxH, 1)) * CHART_H, 4);
  return (
    <Pressable onHoverIn={isWeb ? function() { sH(true); } : undefined} onHoverOut={isWeb ? function() { sH(false); } : undefined}
      style={{ alignItems: "center", gap: 4, width: width || 56, position: "relative" as any }}>
      {h && <View style={cs.tooltip}><Text style={cs.tooltipText}>{value}</Text></View>}
      <View style={[cs.chartBar, { height: barH, backgroundColor: color, opacity: h ? 1 : 0.8 }, isWeb && { transition: "height 0.4s ease, opacity 0.2s ease" } as any]} />
      {label ? <Text style={cs.chartLabel}>{label}</Text> : null}
    </Pressable>
  );
}

export var cs = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 0 },
  secTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  secHint: { fontSize: 10, color: Colors.ink3, marginTop: 2 },
  chartBar: { width: 20, borderRadius: 4 },
  chartLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "500" },
  tooltip: { position: "absolute" as any, top: -28, backgroundColor: Colors.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border2, zIndex: 10 },
  tooltipText: { fontSize: 9, color: Colors.ink, fontWeight: "700", whiteSpace: "nowrap" as any },
  legendRow: { flexDirection: "row", gap: 16, marginTop: 8, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: Colors.ink3, fontWeight: "500" },
  dowRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, paddingHorizontal: 4, borderRadius: 8 },
  dowLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "500", width: 30 },
  dowBarBg: { flex: 1, height: 10, borderRadius: 5, backgroundColor: Colors.bg4, overflow: "hidden" },
  dowBarFill: { height: 10, borderRadius: 5 },
  dowVal: { fontSize: 10, color: Colors.ink3, fontWeight: "600", minWidth: 28, textAlign: "right" },
  dowTooltip: { fontSize: 9, color: Colors.violet3, fontWeight: "600", marginLeft: 4 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  disclaimer: { padding: 12, backgroundColor: Colors.bg3, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  disclaimerText: { fontSize: 10, color: Colors.ink3, textAlign: "center", fontStyle: "italic" as any },
});
