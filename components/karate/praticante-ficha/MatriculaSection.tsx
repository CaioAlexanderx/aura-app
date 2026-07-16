// ============================================================
// Campo de matricula (FPKT) do praticante — cadastro e edicao.
//
// Decisao do Caio (16/07/2026): removida a geracao automatica de matricula
// no modal. O backend nao gera mais numero nenhum (422 FPKT_NUMBER_REQUIRED
// se enviado vazio); o numero e emitido pela federacao, fora do sistema —
// aqui o app apenas registra o que ja foi emitido.
//
// Campo OPCIONAL em ambos os modos: o praticante pode existir sem FPKT
// (quem nao tem o numero em maos usa o fluxo de solicitacao, onde a
// federacao emite). Vazio nunca bloqueia o salvamento e nunca e enviado ao
// backend como string vazia — o chamador (PraticanteFichaModal) omite o
// campo do body quando em branco.
//
// Um unico componente serve cadastro e edicao (mesma UI: label + campo +
// nota) — so o texto da nota muda (isEdit) porque o efeito de alterar um
// numero ja existente é diferente de registrar um numero pela primeira vez.
// ============================================================
import React from "react";
import { View, Text } from "react-native";
import { Icon } from "@/components/Icon";
import { ShojiPalette as P } from "@/constants/karateTheme";
import { Field, styles } from "./shared-styles";

interface MatriculaFieldProps {
  value: string;
  onChange: (v: string) => void;
  isEdit?: boolean;
}

export function MatriculaField({ value, onChange, isEdit }: MatriculaFieldProps) {
  return (
    <View style={{ marginBottom: 11 }}>
      <Text style={styles.label}>Número de matrícula (FPKT)</Text>
      <Field
        label="Número da matrícula"
        mono
        value={value}
        onChangeText={onChange}
        placeholder="Ex.: 000123 (opcional)"
      />
      <View style={styles.guardianNote}>
        <Icon name="info" size={13} color={P.ink3} />
        <Text style={styles.guardianNoteTxt}>
          {isEdit
            ? "Emitida pela federação — alterar aqui muda o número exibido na carteirinha. Pode ficar em branco; sem matrícula, não há carteirinha."
            : "Emitida pela federação (FPKT), fora do sistema — aqui você só registra. Sem o número em mãos? Deixe em branco e preencha depois; sem matrícula, a carteirinha não é emitida."}
        </Text>
      </View>
    </View>
  );
}
