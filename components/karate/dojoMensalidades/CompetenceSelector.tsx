// ============================================================
// CompetenceSelector — navegação de mês (F3a Mensalidades)
// tz-safe: competência é string 'YYYY-MM', navegação por shiftCompetence
// (parse manual, nunca new Date direto).
// ============================================================
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { competenceLabel, currentCompetence, shiftCompetence } from "./helpers";

interface Props {
  competence: string;
  onChange: (competence: string) => void;
}

export function CompetenceSelector({ competence, onChange }: Props) {
  const isCurrent = competence === currentCompetence();

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.navBtn}
        onPress={() => onChange(shiftCompetence(competence, -1))}
        accessibilityRole="button"
        accessibilityLabel="Mês anterior"
      >
        <Icon name="chevron-left" size={16} color={KarateColors.ink2} />
      </TouchableOpacity>

      <View style={styles.labelBox}>
        <Icon name="calendar" size={14} color={KarateColors.ink3} />
        <Text style={styles.label}>{competenceLabel(competence)}</Text>
      </View>

      <TouchableOpacity
        style={styles.navBtn}
        onPress={() => onChange(shiftCompetence(competence, 1))}
        accessibilityRole="button"
        accessibilityLabel="Próximo mês"
      >
        <Icon name="chevron-right" size={16} color={KarateColors.ink2} />
      </TouchableOpacity>

      {!isCurrent && (
        <TouchableOpacity
          style={styles.todayBtn}
          onPress={() => onChange(currentCompetence())}
          accessibilityRole="button"
        >
          <Text style={styles.todayTxt}>Mês atual</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  navBtn: {
    width: 32, height: 32, borderRadius: KarateRadius.sm,
    alignItems: "center", justifyContent: "center",
    backgroundColor: KarateColors.surface, borderWidth: 1, borderColor: KarateColors.border,
  } as ViewStyle,
  labelBox: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: KarateColors.surface, borderRadius: KarateRadius.sm,
    borderWidth: 1, borderColor: KarateColors.border, minWidth: 150, justifyContent: "center",
  } as ViewStyle,
  label: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  todayBtn: {
    paddingVertical: 7, paddingHorizontal: 10, borderRadius: KarateRadius.sm,
    backgroundColor: KarateColors.primarySoft,
  } as ViewStyle,
  todayTxt: { fontSize: 11.5, fontWeight: "700", color: KarateColors.primary } as TextStyle,
});
