// ============================================================
// Badge — Aura Karatê
//
// Sempre usa icon + texto (nunca cor sozinha).
// Aceita KarateStatusKey ou DojoStatus / AffiliationStatus.
// ============================================================
import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  KarateStatus,
  KarateStatusKey,
  KarateDojoStatus,
  KarateAffiliationStatus,
  DojoStatus,
  AffiliationStatus,
  KarateRadius,
} from "@/constants/karateTheme";

interface BadgeProps {
  /** Chave semântica Shoji (ok | warn | alert | danger | neutral) */
  status?: KarateStatusKey;
  /** Ou status do dojô direto da API */
  dojoStatus?: DojoStatus;
  /** Ou status de afiliação direto da API */
  affiliationStatus?: AffiliationStatus;
  /** Override do label (usa o do status se não passado) */
  label?: string;
  style?: ViewStyle;
}

export function Badge({ status, dojoStatus, affiliationStatus, label, style }: BadgeProps) {
  let color: string, bg: string, icon: string, resolvedLabel: string;

  if (dojoStatus) {
    const s = KarateDojoStatus[dojoStatus];
    color = s.color; bg = s.bg; icon = s.icon; resolvedLabel = label ?? s.label;
  } else if (affiliationStatus) {
    const s = KarateAffiliationStatus[affiliationStatus];
    color = s.color; bg = s.bg; icon = s.icon; resolvedLabel = label ?? s.label;
  } else {
    const key: KarateStatusKey = status ?? "neutral";
    const s = KarateStatus[key];
    color = s.color; bg = s.bg; icon = s.icon; resolvedLabel = label ?? key;
  }

  return (
    <View
      style={[styles.container, { backgroundColor: bg }, style]}
      accessibilityLabel={resolvedLabel}
    >
      <Ionicons name={icon as any} size={12} color={color} />
      <Text style={[styles.text, { color }]}>{resolvedLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: KarateRadius.sm,
    alignSelf: "flex-start",
  } as ViewStyle,
  text: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
