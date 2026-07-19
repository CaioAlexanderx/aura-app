// ============================================================
// SummaryCards — resumo de mensalidades do mês (F3a)
// 4 cards a partir do summary de GET /charges: a receber, recebido,
// pendentes, vencidas. Puramente apresentacional.
// ============================================================
import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { DojoChargesSummary } from "@/services/karateDojoBillingApi";
import { fmtBRL } from "./helpers";

interface Props {
  summary: DojoChargesSummary | null;
  loading: boolean;
}

interface CardDef {
  key: string;
  icon: string;
  label: string;
  value: string;
  color: string;
}

export function SummaryCards({ summary, loading }: Props) {
  if (loading) {
    return (
      <View style={styles.grid}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.card, styles.cardSkeleton]} />
        ))}
      </View>
    );
  }

  if (!summary) return null;

  const cards: CardDef[] = [
    { key: "receber", icon: "wallet", label: "A receber no mês", value: fmtBRL(summary.total_amount), color: KarateColors.ink },
    { key: "recebido", icon: "check_circle", label: "Recebido", value: fmtBRL(summary.paid_amount), color: KarateColors.ok },
    { key: "pendentes", icon: "clock", label: "Pendentes", value: String(summary.pending_count), color: KarateColors.warn },
    { key: "vencidas", icon: "alert", label: "Vencidas", value: String(summary.overdue_count), color: KarateColors.danger },
  ];

  return (
    <View style={styles.grid}>
      {cards.map((c) => (
        <View key={c.key} style={styles.card}>
          <View style={styles.cardHead}>
            <Icon name={c.icon as any} size={15} color={c.color} />
            <Text style={styles.cardLabel}>{c.label}</Text>
          </View>
          <Text style={[styles.cardValue, { color: c.color }]}>{c.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 } as ViewStyle,
  card: {
    flexGrow: 1, flexBasis: 150,
    backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md,
    borderWidth: 1, borderColor: KarateColors.border, padding: 12, gap: 8,
  } as ViewStyle,
  cardSkeleton: { minHeight: 64, opacity: 0.5 } as ViewStyle,
  cardHead: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  cardLabel: { fontSize: 11.5, fontWeight: "700", color: KarateColors.ink3 } as TextStyle,
  cardValue: { fontSize: 19, fontWeight: "800", fontFamily: "monospace" } as TextStyle,
});
