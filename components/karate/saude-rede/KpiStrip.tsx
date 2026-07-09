// ============================================================
// Saúde da Rede — KPI strip · Shoji
// Faixa de indicadores-chave da rede (filiação, inadimplência, etc.).
// ============================================================
import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import {
  KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F,
} from "@/constants/karateTheme";
import { NetworkSummary, NetworkKpi } from "@/services/karateNetworkHealthApi";
import { fmtBRL, fmtPct, fmtN, Sk } from "./shared";
import { useCountUp } from "@/hooks/useCountUp";

type KpiEntry = NetworkKpi;

// Anima o NÚMERO cru do KPI (count-up) e só então reformata (moeda/%/inteiro)
// — nunca anima a string já formatada com símbolo.
function KpiCard({ k }: { k: KpiEntry }) {
  const isNumeric = Number.isFinite(k.value);
  const animated = useCountUp(isNumeric ? k.value : 0, 700);
  const display = isNumeric ? animated : k.value;
  return (
    <View style={kst.kpiCard}>
      <Text style={kst.kpiLabel}>{k.label}</Text>
      <Text style={[kst.kpiValue, k.key === "inadimplencia" && k.value > 10 && { color: P.red }]}>
        {k.unit === "BRL" ? fmtBRL(display) : k.unit === "%" ? fmtPct(display) : fmtN(Math.round(display))}
        {k.unit && k.unit !== "BRL" && k.unit !== "%" && (
          <Text style={kst.kpiUnit}> {k.unit}</Text>
        )}
      </Text>
    </View>
  );
}

export function KpiStrip({ data }: { data: NetworkSummary | null }) {
  const items = data?.kpis || [];
  if (!items.length) {
    return (
      <View style={kst.kpiRow}>
        {[1, 2, 3, 4, 5].map((k) => <View key={k} style={kst.kpiCard}><Sk h={40} /></View>)}
      </View>
    );
  }
  return (
    <View style={kst.kpiRow}>
      {items.map((k) => (
        <KpiCard key={k.key} k={k} />
      ))}
    </View>
  );
}

const kst = StyleSheet.create({
  kpiRow:   { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  kpiCard:  { flex: 1, minWidth: 100, backgroundColor: P.glass, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 14 } as ViewStyle,
  kpiLabel: { fontFamily: F.body, fontSize: 10, color: C.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 } as TextStyle,
  kpiValue: { fontFamily: F.heading, fontSize: 22, fontWeight: "400", color: C.ink } as TextStyle,
  kpiUnit:  { fontFamily: F.body, fontSize: 11, fontWeight: "400", color: C.ink3 } as TextStyle,
});
