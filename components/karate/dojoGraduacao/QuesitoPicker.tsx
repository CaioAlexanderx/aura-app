// ============================================================
// QuesitoPicker — Aura Karatê (dojô) · F10
//
// Marcação de UM quesito (Kihon | Kata | Kumite) no sistema japonês
// tradicional: 〇 círculo > △ triângulo > □ quadrado. O SÍMBOLO é
// apresentação; o valor que sobe pro estado do formulário é o nome
// ('circulo'|'triangulo'|'quadrado') — nunca o caractere.
//
// Opcional de propósito: tocar no valor já selecionado desmarca (volta a
// null). Dado ausente é neutro ("Não avaliado"), nunca pendência — não
// existe estado de erro aqui.
//
// StyleSheet: todos os top-level são objetos (WeakMap safe).
// ============================================================
import React from "react";
import { View, Text, Pressable, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { ShojiPalette as P, KarateFonts as F, KarateRadius as R } from "@/constants/karateTheme";
import { QuesitoValue } from "@/services/karateDojoBeltExamApi";
import { QUESITO_ORDER, QUESITO_SYMBOL, QUESITO_LABEL } from "./helpers";

interface Props {
  label: string;
  value: QuesitoValue | null;
  onChange: (v: QuesitoValue | null) => void;
  disabled?: boolean;
}

export function QuesitoPicker({ label, value, onChange, disabled }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {QUESITO_ORDER.map((q) => {
          const active = value === q;
          return (
            <Pressable
              key={q}
              onPress={disabled ? undefined : () => onChange(active ? null : q)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled: !!disabled }}
              accessibilityLabel={`${label}: ${QUESITO_LABEL[q]}`}
              style={[styles.cell, active && styles.cellActive, disabled && styles.cellDisabled]}
            >
              <Text style={[styles.symbol, active && styles.symbolActive]}>{QUESITO_SYMBOL[q]}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint} numberOfLines={1}>
        {value ? QUESITO_LABEL[value] : "Não avaliado"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 5, minWidth: 74 } as ViewStyle,
  label: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", letterSpacing: 0.3, color: P.ink3, textTransform: "uppercase" } as TextStyle,
  row: { flexDirection: "row", gap: 5 } as ViewStyle,
  cell: {
    width: 30, height: 30, borderRadius: R.sm, borderWidth: 1, borderColor: P.line2,
    backgroundColor: P.glassHi, alignItems: "center", justifyContent: "center",
  } as ViewStyle,
  cellActive: { borderColor: P.red, backgroundColor: P.redWash } as ViewStyle,
  cellDisabled: { opacity: 0.5 } as ViewStyle,
  symbol: { fontFamily: F.heading, fontSize: 16, color: P.ink3, lineHeight: 18 } as TextStyle,
  symbolActive: { color: P.red } as TextStyle,
  hint: { fontFamily: F.body, fontSize: 10.5, color: P.ink3 } as TextStyle,
});
