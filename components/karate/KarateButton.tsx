// ============================================================
// KarateButton — Aura Karatê primitive
//
// Variantes:
//   sumi      — CTA primário do guia Shoji (sumi/ink escuro, mesmo do
//               "Salvar ficha"). Use para ações primárias afirmativas.
//   primary   — vermelhão (P.red). RARO: reservado a ações destrutivas/
//               críticas (cancelar/excluir/recusar). Não usar como CTA padrão.
//   secondary — contorno (outline) discreto.
//   ghost     — texto, sem caixa.
// Sizes: sm | md | lg
// Sempre acessível: accessibilityRole="button" + states.
// ============================================================
import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";

export type KarateButtonVariant = "sumi" | "primary" | "secondary" | "ghost";
export type KarateButtonSize    = "sm" | "md" | "lg";

interface KarateButtonProps {
  label:     string;
  onPress:   () => void;
  variant?:  KarateButtonVariant;
  size?:     KarateButtonSize;
  loading?:  boolean;
  disabled?: boolean;
  style?:    ViewStyle;
}

export function KarateButton({
  label,
  onPress,
  variant  = "sumi",
  size     = "md",
  loading  = false,
  disabled = false,
  style,
}: KarateButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        styles[variant],
        styles[size],
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "sumi" || variant === "primary" ? "#fdf8f2" : KarateColors.primary}
        />
      ) : (
        <Text style={[styles.label, styles[`label_${variant}`], styles[`label_${size}`]]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: KarateRadius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  } as ViewStyle,

  // Variant
  sumi: {
    backgroundColor: KarateColors.ink,
  } as ViewStyle,
  primary: {
    backgroundColor: KarateColors.primary,
  } as ViewStyle,
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: KarateColors.primary,
  } as ViewStyle,
  ghost: {
    backgroundColor: "transparent",
  } as ViewStyle,

  // Size
  sm: { paddingVertical: 6,  paddingHorizontal: 12 } as ViewStyle,
  md: { paddingVertical: 10, paddingHorizontal: 20 } as ViewStyle,
  lg: { paddingVertical: 14, paddingHorizontal: 28 } as ViewStyle,

  disabled: { opacity: 0.45 } as ViewStyle,

  // Labels
  label:           { fontWeight: "700", letterSpacing: 0.2 } as TextStyle,
  label_sumi:      { color: "#fdf8f2"                       } as TextStyle,
  label_primary:   { color: "#fff"                         } as TextStyle,
  label_secondary: { color: KarateColors.primary           } as TextStyle,
  label_ghost:     { color: KarateColors.primary           } as TextStyle,

  label_sm: { fontSize: 13 } as TextStyle,
  label_md: { fontSize: 15 } as TextStyle,
  label_lg: { fontSize: 17 } as TextStyle,
});
