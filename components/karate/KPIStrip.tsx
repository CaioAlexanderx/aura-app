// ============================================================
// KPIStrip — Aura Karatê
//
// Faixa horizontal de KPIs (dojôs, praticantes, receita, inadimplência).
// KPI individual exportado separadamente para uso isolado.
// ============================================================
import React from "react";
import { View, Text, StyleSheet, ScrollView, ViewStyle } from "react-native";
import { KarateColors, KarateRadius, ShojiPalette } from "@/constants/karateTheme";

export interface KPIData {
  label:     string;
  value:     string | number;
  sub?:      string;
  accent?:   "primary" | "ok" | "warn" | "danger";
}

const ACCENT_COLORS: Record<string, string> = {
  primary: KarateColors.primary,
  ok:      ShojiPalette.ok,
  warn:    ShojiPalette.warn,
  danger:  ShojiPalette.danger,
};

export function KPI({ label, value, sub, accent = "primary" }: KPIData) {
  const accentColor = ACCENT_COLORS[accent] ?? KarateColors.primary;
  return (
    <View style={styles.kpi} accessibilityLabel={`${label}: ${value}${sub ? ` (${sub})` : ""}`}>
      <Text style={[styles.value, { color: accentColor }]}>
        {String(value)}
      </Text>
      <Text style={styles.label}>{label}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

interface KPIStripProps {
  kpis:  KPIData[];
  style?: ViewStyle;
}

export function KPIStrip({ kpis, style }: KPIStripProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.strip, style]}
    >
      {kpis.map((kpi, i) => (
        <View key={i} style={styles.kpiWrapper}>
          <KPI {...kpi} />
          {i < kpis.length - 1 && <View style={styles.divider} />}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 0,
    backgroundColor: KarateColors.bg,
    borderRadius: KarateRadius.md,
    borderWidth: 1,
    borderColor: KarateColors.border,
    paddingVertical: 8,
    paddingHorizontal: 4,
  } as ViewStyle,
  kpiWrapper: {
    flexDirection: "row",
    alignItems: "stretch",
  } as ViewStyle,
  kpi: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    minWidth: 90,
  } as ViewStyle,
  value: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 11,
    color: KarateColors.ink3,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 2,
  },
  sub: {
    fontSize: 10,
    color: KarateColors.ink4,
    textAlign: "center",
    marginTop: 1,
  },
  divider: {
    width: 1,
    backgroundColor: KarateColors.border,
    marginVertical: 4,
  } as ViewStyle,
});
