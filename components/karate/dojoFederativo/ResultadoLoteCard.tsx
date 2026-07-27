// ============================================================
// ResultadoLoteCard — resultado de uma operação em lote (F5b):
// certificados pedidos, alunos inscritos ou candidatos enviados. Mostra
// quantos deram certo + a lista de pulados com o motivo em pt-BR
// (helpers.mapSkipReason). Quando algum pulo é "não federado", oferece
// um atalho único para a tela de Alunos (federar lá).
//
// StyleSheet: todos os top-level são objetos (WeakMap safe).
// ============================================================
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { SkippedItem } from "@/services/karateDojoFederativoApi";
import { mapSkipReason, isNaoFederadoReason } from "./helpers";

interface Props {
  successCount: number;
  successLabel: string;
  skipped: SkippedItem[];
  onGoFederar?: () => void;
  onClose: () => void;
}

export function ResultadoLoteCard({ successCount, successLabel, skipped, onGoFederar, onClose }: Props) {
  const temNaoFederado = skipped.some((s) => isNaoFederadoReason(s.reason));

  return (
    <View style={st.card}>
      <View style={st.headRow}>
        <View style={st.okIco}><Icon name="check" size={16} color={KarateColors.ok} /></View>
        <Text style={st.headTxt}>{successCount} {successLabel}</Text>
      </View>

      {skipped.length > 0 && (
        <View style={st.skipBox}>
          <Text style={st.skipTitle}>
            {skipped.length === 1 ? "1 item não processado" : `${skipped.length} itens não processados`}
          </Text>
          {skipped.map((s, i) => (
            <Text key={`${s.student_id ?? "x"}-${i}`} style={st.skipLine}>
              {s.name || "Aluno"} — {mapSkipReason(s.reason, s.message)}
            </Text>
          ))}
          {temNaoFederado && !!onGoFederar && (
            <TouchableOpacity style={st.linkBtn} onPress={onGoFederar} accessibilityRole="button">
              <Icon name="link" size={13} color={KarateColors.primary} />
              <Text style={st.linkTxt}>Federar alunos pendentes</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <TouchableOpacity style={st.closeBtn} onPress={onClose} accessibilityRole="button">
        <Text style={st.closeTxt}>Fechar</Text>
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 16, gap: 12 } as ViewStyle,
  headRow: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  okIco: { width: 30, height: 30, borderRadius: 15, backgroundColor: KarateColors.okSoft, alignItems: "center", justifyContent: "center" } as ViewStyle,
  headTxt: { fontSize: 14, fontWeight: "800", color: KarateColors.ink, flex: 1 } as TextStyle,
  skipBox: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.sm, padding: 12, gap: 6 } as ViewStyle,
  skipTitle: { fontSize: 11.5, fontWeight: "700", color: KarateColors.ink3, textTransform: "uppercase", letterSpacing: 0.3 } as TextStyle,
  skipLine: { fontSize: 12.5, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, alignSelf: "flex-start" } as ViewStyle,
  linkTxt: { fontSize: 12.5, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  closeBtn: { alignSelf: "flex-end", paddingVertical: 8, paddingHorizontal: 14 } as ViewStyle,
  closeTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
});
