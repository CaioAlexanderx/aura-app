// ============================================================
// EmptyState — Aura Karatê
//
// Estado vazio genérico com icon, título e subtitulo.
// Reutiliza o padrão do EmptyState.tsx existente no repo.
// ============================================================
import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors } from "@/constants/karateTheme";

interface EmptyStateProps {
  icon?:      string;  // nome do Icon (SVG inline)
  title:      string;
  subtitle?:  string;
  action?:    React.ReactNode;
  style?:     ViewStyle;
}

export function KarateEmptyState({ icon = "package", title, subtitle, action, style }: EmptyStateProps) {
  return (
    <View style={[styles.container, style]} accessibilityLiveRegion="polite">
      <Icon name={icon as any} size={48} color={KarateColors.ink4} />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {action ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 48,
    paddingHorizontal: 24,
  } as ViewStyle,
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: KarateColors.ink2,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: KarateColors.ink3,
    textAlign: "center",
    lineHeight: 20,
  },
});
