// ============================================================
// EligibilityChecklist — Aura Karatê Track C
//
// DECISÃO FPKT #1: a elegibilidade é APENAS AVISO.
// Exibe ✅/⚠️ por critério mas nunca bloqueia a inscrição.
// O botão "Inscrever mesmo assim" fica visível quando há avisos.
//
// Sempre usa ícone + texto (WCAG 1.4.1).
// ============================================================
import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { EligibilityResult } from "@/services/karateApi";

interface Props {
  eligibility: EligibilityResult;
  /** Mostrar o botão "inscrever mesmo assim" — default false */
  showEnrollAnyway?: boolean;
  onEnrollAnyway?: () => void;
  style?: ViewStyle;
}

export function EligibilityChecklist({ eligibility, showEnrollAnyway, onEnrollAnyway, style }: Props) {
  const hasWarnings = eligibility.warnings.length > 0 || eligibility.checks.some(c => !c.ok);

  return (
    <View style={[styles.container, style]}>
      {/* Decisao FPKT #1 — Banner apenas aviso */}
      {hasWarnings && (
        <View style={styles.advisoryBanner}>
          <Ionicons name="information-circle" size={14} color={KarateColors.warn} />
          <Text style={styles.advisoryText}>
            Elegibilidade com ressalvas — inscrição NÃO é bloqueada (Decisão FPKT #1).
          </Text>
        </View>
      )}

      {/* Lista de critérios */}
      {eligibility.checks.map((check, i) => (
        <View key={i} style={styles.checkRow}>
          <Ionicons
            name={check.ok ? "checkmark-circle" : "alert-circle"}
            size={16}
            color={check.ok ? KarateColors.ok : KarateColors.warn}
          />
          <View style={styles.checkInfo}>
            <Text style={styles.checkLabel}>{check.label}</Text>
            <Text style={styles.checkDetail}>
              Requerido: {String(check.required)} · Atual: {String(check.actual)}
            </Text>
          </View>
        </View>
      ))}

      {/* Avisos textuais */}
      {eligibility.warnings.map((w, i) => (
        <View key={`w-${i}`} style={styles.warningRow}>
          <Ionicons name="warning" size={14} color={KarateColors.warn} />
          <Text style={styles.warningText}>{w}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: KarateColors.border,
  } as ViewStyle,
  advisoryBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: KarateColors.warnSoft,
    padding: 8,
    borderRadius: KarateRadius.sm,
  } as ViewStyle,
  advisoryText: {
    fontSize: 11,
    color: KarateColors.warn,
    flex: 1,
    fontWeight: "600",
  } as TextStyle,
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  } as ViewStyle,
  checkInfo: { flex: 1, gap: 1 } as ViewStyle,
  checkLabel: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
  checkDetail: { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  warningRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  } as ViewStyle,
  warningText: { fontSize: 11, color: KarateColors.warn, flex: 1 } as TextStyle,
});
