// ============================================================
// Campo de matricula (FPKT) do praticante — cadastro e edicao.
//
// Decisao do Caio (16/07/2026): o numero FPKT volta a ser OBRIGATORIO em
// ambos os modos. A tentativa anterior de torna-lo opcional (Aura-app #589 +
// Aura-backend #393) foi revertida — o PR de backend foi fechado sem merge,
// entao o `main` do backend segue exigindo o numero: 422 FPKT_NUMBER_REQUIRED
// no POST sem numero, 422 "A matricula nao pode ficar vazia." no PATCH com
// matricula vazia. O frontend precisa estar coerente com isso.
//
// O numero e emitido pela FEDERACAO, fora do sistema — aqui o app apenas
// registra o que ja foi emitido. NUNCA geramos numero automaticamente (por
// isso o seletor "Gerar automatico" x "Informar manualmente" foi removido —
// ele prometia um comportamento que o backend nunca teve).
//
// Quem NAO tem o numero em maos usa o fluxo de SOLICITACAO de praticante
// (POST /federation/:id/dojo/practitioner-requests): o dojo solicita, a
// federacao valida e emite o numero, o praticante entra pela fila de
// aprovacao ja com FPKT atribuido. Por isso o campo obrigatorio aqui NAO e
// um beco sem saida — so precisa apontar para essa saida na copy.
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
      <Text style={styles.label}>
        Número de matrícula (FPKT) <Text style={{ color: P.red }}>*</Text>
      </Text>
      <Field
        label="Número da matrícula"
        mono
        value={value}
        onChangeText={onChange}
        placeholder="Ex.: 000123"
      />
      <View style={styles.guardianNote}>
        <Icon name="info" size={13} color={P.ink3} />
        <Text style={styles.guardianNoteTxt}>
          {isEdit
            ? "Emitida pela federação, fora do sistema — aqui só se registra. Alterar aqui muda o número exibido na carteirinha."
            : "Emitida pela federação, fora do sistema — aqui só se registra. Sem o número em mãos? Use o fluxo de solicitação de praticante: o dojô solicita e a federação valida e emite."}
        </Text>
      </View>
    </View>
  );
}
