// ============================================================
// FormField — Aura Karatê
//
// Wrapper de campo de formulário: label + TextInput + error.
// Tema Shoji (paper + ink).
// ============================================================
import React from "react";
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";

interface FormFieldProps extends TextInputProps {
  label:    string;
  error?:   string;
  required?: boolean;
  hint?:    string;
  style?:   ViewStyle;
}

export function FormField({
  label,
  error,
  required,
  hint,
  style,
  ...inputProps
}: FormFieldProps) {
  return (
    <View style={[styles.wrapper, style]}>
      <Text style={styles.label}>
        {label}{required && <Text style={styles.req}> *</Text>}
      </Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        placeholderTextColor={KarateColors.ink4}
        accessibilityLabel={label}
        {...inputProps}
      />
      {hint && !error ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:    { gap: 4 } as ViewStyle,
  label:      { fontSize: 12, fontWeight: "700", color: KarateColors.ink2, letterSpacing: 0.2 },
  req:        { color: KarateColors.danger },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: KarateColors.border,
    borderRadius: KarateRadius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: KarateColors.ink,
    minHeight: 44,
  } as ViewStyle,
  inputError: { borderColor: KarateColors.danger } as ViewStyle,
  hint:  { fontSize: 11, color: KarateColors.ink4 },
  error: { fontSize: 11, color: KarateColors.danger, fontWeight: "600" },
});
