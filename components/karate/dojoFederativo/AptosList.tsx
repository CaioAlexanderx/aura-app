// ============================================================
// AptosList — grid de graduações aptas a certificado (F5b)
//
// A UNIDADE é a GRADUAÇÃO (belt_history_id), não o aluno — um aluno pode
// aparecer 2x se tiver 2 graduações sem pedido ainda. Por isso a chave
// (React key + Set de seleção) é sempre belt_history_id.
//
// StyleSheet: todos os top-level são objetos (WeakMap safe).
// ============================================================
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { AptoRow } from "@/services/karateDojoFederativoApi";
import { fmtDataCurta } from "./helpers";

interface Props {
  aptos: AptoRow[];
  selected: Set<string>;
  onToggle: (beltHistoryId: string) => void;
}

export function AptosList({ aptos, selected, onToggle }: Props) {
  return (
    <View style={st.grid}>
      {aptos.map((a) => {
        const on = selected.has(a.belt_history_id);
        return (
          <TouchableOpacity
            key={a.belt_history_id}
            style={[st.cardGridItem, st.card, on && st.cardOn]}
            onPress={() => onToggle(a.belt_history_id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${a.name} — ${a.belt_label ?? "faixa"}`}
          >
            <View style={st.topRow}>
              <View style={[st.checkbox, on && st.checkboxOn]}>
                {on && <Icon name="check" size={12} color="#fff" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.name} numberOfLines={1}>{a.name}</Text>
                <Text style={st.belt}>{a.belt_label ?? "Sem faixa"}</Text>
              </View>
            </View>
            <View style={st.metaRow}>
              <Icon name="calendar" size={12} color={KarateColors.ink3} />
              <Text style={st.meta}>Graduado em {fmtDataCurta(a.graduated_at)}</Text>
            </View>
            {!!a.exam_name && (
              <View style={st.metaRow}>
                <Icon name="ribbon" size={12} color={KarateColors.ink3} />
                <Text style={st.meta} numberOfLines={1}>Banca: {a.exam_name}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 } as ViewStyle,
  cardGridItem: { flexBasis: 280, flexGrow: 1, maxWidth: 380 } as ViewStyle,
  card: { backgroundColor: "#fff", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 8 } as ViewStyle,
  cardOn: { borderColor: KarateColors.primary, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: KarateColors.border2, alignItems: "center", justifyContent: "center", flexShrink: 0 } as ViewStyle,
  checkboxOn: { backgroundColor: KarateColors.primary, borderColor: KarateColors.primary } as ViewStyle,
  name: { fontSize: 13.5, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  belt: { fontSize: 12, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  meta: { fontSize: 11.5, color: KarateColors.ink3, flexShrink: 1 } as TextStyle,
});
