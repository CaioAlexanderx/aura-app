// ============================================================
// ReminderLogList — log recente de lembretes enviados (F3c)
//
// Lista compacta: aluno, offset legível ("3d antes"/"no vencimento"/
// "5d depois"), badge de status (icon+texto, WCAG 1.4.1) e data. Filtro
// por competência é responsabilidade do dono (ReguaSection, via
// CompetenceSelector) — este componente só renderiza o que recebe.
// ============================================================
import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { DojoReminderLogItem } from "@/services/karateDojoBillingApi";
import { fmtDateBR, offsetLabel, reminderLogStatusView } from "../helpers";

interface Props {
  items: DojoReminderLogItem[];
}

export function ReminderLogList({ items }: Props) {
  if (items.length === 0) {
    return (
      <View style={styles.stateBox}>
        <Icon name="bell" size={20} color={KarateColors.ink3} />
        <Text style={styles.stateTxt}>Nenhum lembrete enviado para esta competência ainda.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {items.map((item) => {
        const sv = reminderLogStatusView(item.status);
        return (
          <View key={item.id} style={styles.row}>
            <View style={{ flex: 1, minWidth: 140 }}>
              <Text style={styles.nome} numberOfLines={1}>{item.student_name}</Text>
              <Text style={styles.meta}>{offsetLabel(item.offset)} · {fmtDateBR(item.sent_at)}</Text>
            </View>
            <View style={[styles.statusChip, { backgroundColor: sv.bg }]}>
              <Icon name={sv.icon as any} size={12} color={sv.color} />
              <Text style={[styles.statusTxt, { color: sv.color }]}>{sv.label}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap",
    backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md,
    borderWidth: 1, borderColor: KarateColors.border, padding: 12,
  } as ViewStyle,
  nome: { fontSize: 13.5, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  meta: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  statusChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999 } as ViewStyle,
  statusTxt: { fontSize: 11, fontWeight: "700" } as TextStyle,
  stateBox: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 24 } as ViewStyle,
  stateTxt: { fontSize: 13, fontWeight: "600", color: KarateColors.ink2, textAlign: "center" } as TextStyle,
});
