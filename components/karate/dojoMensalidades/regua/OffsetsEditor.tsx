// ============================================================
// OffsetsEditor — chips de "quando enviar" da régua de cobrança (F3c)
//
// Presets prontos (3 dias antes / no vencimento / 3 dias depois / 7 dias
// depois) + campo numérico pra offset custom. Espelha as regras do
// backend: inteiros -15..30, no máx. 6 offsets, sem duplicar.
// ============================================================
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import {
  REMINDER_OFFSET_MAX, REMINDER_OFFSET_MAX_COUNT, REMINDER_OFFSET_MIN, REMINDER_OFFSET_PRESETS, offsetLabel,
} from "../helpers";

interface Props {
  offsets: number[];
  onChange: (offsets: number[]) => void;
}

export function OffsetsEditor({ offsets, onChange }: Props) {
  const [customValue, setCustomValue] = useState("");
  const [customErr, setCustomErr] = useState<string | null>(null);

  const extras = [...offsets]
    .filter((o) => !REMINDER_OFFSET_PRESETS.some((p) => p.value === o))
    .sort((a, b) => a - b);

  const atMax = offsets.length >= REMINDER_OFFSET_MAX_COUNT;

  function toggle(value: number) {
    if (offsets.includes(value)) {
      onChange(offsets.filter((o) => o !== value));
    } else {
      if (atMax) return;
      onChange([...offsets, value]);
    }
  }

  function remove(value: number) {
    onChange(offsets.filter((o) => o !== value));
  }

  function addCustom() {
    setCustomErr(null);
    if (!customValue.trim()) return;
    const n = parseInt(customValue, 10);
    if (!Number.isInteger(n)) { setCustomErr("Informe um número de dias."); return; }
    if (n < REMINDER_OFFSET_MIN || n > REMINDER_OFFSET_MAX) {
      setCustomErr(`Use um valor entre ${REMINDER_OFFSET_MIN} e ${REMINDER_OFFSET_MAX}.`);
      return;
    }
    if (offsets.includes(n)) { setCustomErr("Esse lembrete já está na lista."); return; }
    if (atMax) { setCustomErr(`Máximo de ${REMINDER_OFFSET_MAX_COUNT} lembretes.`); return; }
    onChange([...offsets, n]);
    setCustomValue("");
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.chips}>
        {REMINDER_OFFSET_PRESETS.map((p) => {
          const on = offsets.includes(p.value);
          return (
            <TouchableOpacity
              key={p.value}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => toggle(p.value)}
              disabled={!on && atMax}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
            >
              <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
        {extras.map((o) => (
          <TouchableOpacity
            key={o}
            style={[styles.chip, styles.chipOn]}
            onPress={() => remove(o)}
            accessibilityRole="button"
            accessibilityLabel={`Remover lembrete ${offsetLabel(o)}`}
          >
            <Text style={[styles.chipTxt, styles.chipTxtOn]}>{offsetLabel(o)}</Text>
            <Icon name="x" size={11} color={KarateColors.primary} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.customRow}>
        <TextInput
          style={[styles.customInput, atMax && { opacity: 0.5 }]}
          value={customValue}
          onChangeText={(v) => setCustomValue(v.replace(/[^0-9-]/g, ""))}
          placeholder="Outro (dias; use - p/ antes)"
          placeholderTextColor={KarateColors.ink4}
          editable={!atMax}
          accessibilityLabel="Offset custom em dias"
        />
        <TouchableOpacity
          style={[styles.addBtn, atMax && { opacity: 0.5 }]}
          onPress={addCustom}
          disabled={atMax}
          accessibilityRole="button"
        >
          <Icon name="plus" size={14} color={KarateColors.primary} />
          <Text style={styles.addTxt}>Adicionar</Text>
        </TouchableOpacity>
      </View>
      {!!customErr && <Text style={styles.errTxt}>{customErr}</Text>}
      {atMax && !customErr && <Text style={styles.hint}>Máximo de {REMINDER_OFFSET_MAX_COUNT} lembretes.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.surface } as ViewStyle,
  chipOn: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  chipTxt: { fontSize: 12.5, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  chipTxtOn: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  customRow: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" } as ViewStyle,
  customInput: { flex: 1, minWidth: 170, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: KarateColors.ink, backgroundColor: KarateColors.surface } as TextStyle,
  addBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 9, paddingHorizontal: 12, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  addTxt: { fontSize: 12.5, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  errTxt: { fontSize: 11.5, color: KarateColors.danger } as TextStyle,
  hint: { fontSize: 11.5, color: KarateColors.ink3 } as TextStyle,
});
