// ============================================================
// ErrorState — Aura Karatê
//
// Estado de erro honesto (substitui o antigo fallback silencioso
// para dados mock). Mostra mensagem + botão "Tentar de novo".
// ============================================================
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";

interface ErrorStateProps {
  title?:    string;
  message?:  string;
  onRetry?:  () => void;
  style?:    ViewStyle;
}

export function KarateErrorState({
  title = "Não foi possível carregar",
  message = "Verifique sua conexão e tente novamente.",
  onRetry,
  style,
}: ErrorStateProps) {
  return (
    <View style={[styles.container, style]} accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={44} color={KarateColors.ink4} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity style={styles.retry} onPress={onRetry} accessibilityRole="button">
          <Ionicons name="refresh" size={15} color={KarateColors.primary} />
          <Text style={styles.retryText}>Tentar de novo</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 48,
    paddingHorizontal: 24,
  } as ViewStyle,
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: KarateColors.ink2,
    textAlign: "center",
  },
  message: {
    fontSize: 13,
    color: KarateColors.ink3,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 340,
  },
  retry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: KarateRadius.sm,
    borderWidth: 1,
    borderColor: KarateColors.primaryLine,
    backgroundColor: KarateColors.primarySoft,
  } as ViewStyle,
  retryText: {
    fontSize: 13,
    fontWeight: "700",
    color: KarateColors.primary,
  },
});
