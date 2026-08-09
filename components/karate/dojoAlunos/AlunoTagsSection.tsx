// ============================================================
// AlunoTagsSection — seção "Tags" da ficha do aluno (F11)
//
// Sub-componente importado por AlunoFichaModal.tsx (edição cirúrgica —
// NUNCA modal aninhado; bloco inline dentro do modal existente, mesmo
// racional das outras seções aqui: AlunoTurmaSection/AlunoAssinaturaSection).
//
// SOMENTE LEITURA: atribuir/remover tag acontece pelo Editar (mesmo
// caminho de todos os outros campos de identidade da ficha — o form em
// AlunoFormModal.tsx tem o seletor múltiplo). Esta seção só mostra o que
// o aluno já tem.
//
// Tag NÃO é turma — turma (AlunoTurmaSection, logo acima) tem dia,
// horário e controla presença; tag é rótulo livre, sem horário. As duas
// seções ficam lado a lado na ficha para a distinção ficar visível.
//
// Tag desativada continua aparecendo aqui SE o aluno já estiver marcado
// com ela — é histórico ("este aluno treinou nesta academia"), nunca
// escondido nem apagado; só ganha o selo "desativada" para o sensei
// entender por que ela não aparece mais no formulário de novas
// atribuições.
//
// Silenciosa em erro/indisponibilidade — mesmo racional de
// AlunoQrSection/AlunoPresencasSection: uma seção opcional não pode
// gerar aviso de erro na ficha inteira.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { karateDojoTagsApi, DojoTag } from "@/services/karateDojoTagsApi";

interface Props {
  federationId: string;
  studentId: string;
}

export function AlunoTagsSection({ federationId, studentId }: Props) {
  const [tags, setTags] = useState<DojoTag[] | null>(null);

  const load = useCallback(() => {
    karateDojoTagsApi
      .listStudentTags(federationId, studentId)
      .then((r) => setTags(r.data ?? []))
      .catch(() => setTags([]));
  }, [federationId, studentId]);

  useEffect(() => {
    setTags(null);
    load();
  }, [load]);

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Tags</Text>
      <Text style={styles.subtitle}>
        Rótulos livres do dojô (local de treino, turma da manhã, bolsista…) — diferente de Turma, que tem dia/horário e controla presença. Atribua ou remova pelo Editar.
      </Text>

      {tags === null ? (
        <ActivityIndicator size="small" color={KarateColors.primary} style={{ marginTop: 4 }} />
      ) : tags.length === 0 ? (
        <Text style={styles.hint}>Nenhuma tag atribuída a este aluno.</Text>
      ) : (
        <View style={styles.chips}>
          {tags.map((t) => (
            <View key={t.id} style={[styles.chip, !t.active && styles.chipInactive]}>
              <Text style={[styles.chipTxt, !t.active && styles.chipTxtInactive]}>
                {t.name}{!t.active ? " · desativada" : ""}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, padding: 12, backgroundColor: KarateColors.surface, marginTop: 4 } as ViewStyle,
  title: { fontSize: 12, fontWeight: "800", color: KarateColors.ink2 } as TextStyle,
  subtitle: { fontSize: 11.5, color: KarateColors.ink3, lineHeight: 16 } as TextStyle,
  hint: { fontSize: 12, color: KarateColors.ink3, lineHeight: 17 } as TextStyle,
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.primaryLine, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  chipInactive: { borderColor: KarateColors.border, borderStyle: "dashed", backgroundColor: KarateColors.bg2 } as ViewStyle,
  chipTxt: { fontSize: 12, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  chipTxtInactive: { color: KarateColors.ink3, fontWeight: "600" } as TextStyle,
});
