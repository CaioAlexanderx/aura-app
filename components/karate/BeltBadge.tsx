// ============================================================
// BeltBadge — Aura Karatê
//
// Exibe a cor da faixa com o label.
// Quando is_legacy=true exibe um chip adicional "Histórico" (pequeno).
// ============================================================
import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import {
  KarateBelts,
  KarateColors,
  KarateRadius,
  resolveBeltKey,
} from "@/constants/karateTheme";

interface BeltBadgeProps {
  beltLevel: string;
  beltName?: string;
  isLegacy?: boolean;
  style?: ViewStyle;
}

export function BeltBadge({ beltLevel, beltName, isLegacy = false, style }: BeltBadgeProps) {
  const key = resolveBeltKey(beltLevel);
  const belt = key ? KarateBelts[key] : null;
  const label = beltName ?? belt?.label ?? beltLevel;
  const beltColor = belt?.color ?? KarateColors.neutral;
  const beltText  = belt?.textColor ?? "#fff";

  return (
    <View style={[styles.row, style]}>
      <View
        style={[styles.chip, { backgroundColor: beltColor, borderColor: "rgba(0,0,0,0.12)" }]}
        accessibilityLabel={`Faixa ${label}${isLegacy ? " (registro histórico)" : ""}`}
      >
        <Text style={[styles.chipLabel, { color: beltText }]}>{label}</Text>
      </View>
      {isLegacy && (
        <View style={styles.legacyChip}>
          <Text style={styles.legacyLabel}>Histórico</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  } as ViewStyle,
  chip: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: KarateRadius.sm,
    borderWidth: 1,
  } as ViewStyle,
  chipLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  legacyChip: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: KarateRadius.sm,
    backgroundColor: KarateColors.neutralSoft,
    borderWidth: 1,
    borderColor: KarateColors.border,
  } as ViewStyle,
  legacyLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: KarateColors.neutral,
    letterSpacing: 0.4,
  },
});
