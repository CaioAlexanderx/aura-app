// ============================================================
// CanaisAsaas — canais de atendimento da Asaas visíveis (RA-03, 12/11/2026)
//
// O playbook da Asaas manda o cliente final ver os canais da Asaas nas telas
// do serviço financeiro. Caixa fixa do mockup aprovado: "A operação
// financeira é da Asaas. Dúvidas sobre saldo, saque e tarifa: ...".
// Só os canais confirmados em página oficial (CANAIS_ASAAS).
//
// Só aparece dentro das telas do Recebe na Aura (RA-06 em diante), que já
// ficam atrás da flag RECEBE_NA_AURA_ENABLED. Não decide visibilidade.
// ============================================================
import React from "react";
import { View, Text, Pressable, Linking, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { CANAIS_ASAAS } from "@/constants/termosRecebeNaAura";

type Props = { testID?: string };

export function CanaisAsaas({ testID = "canais-asaas" }: Props) {
  return (
    <View style={s.caixa} testID={testID} accessibilityRole="summary">
      <Text style={s.titulo}>A operação financeira é da Asaas.</Text>
      <Text style={s.sub}>Dúvidas sobre saldo, saque e tarifa:</Text>
      {CANAIS_ASAAS.map((c) => {
        const conteudo = (
          <Text style={s.canal}>
            {c.rotulo}: <Text style={s.valor}>{c.valor}</Text>
            {c.observacao ? <Text style={s.obs}> ({c.observacao})</Text> : null}
          </Text>
        );
        if (!c.link) {
          return <View key={c.tipo} testID={`${testID}-${c.tipo}`}>{conteudo}</View>;
        }
        const link = c.link;
        return (
          <Pressable
            key={c.tipo}
            testID={`${testID}-${c.tipo}`}
            accessibilityRole="link"
            onPress={() => { Linking.openURL(link).catch(() => {}); }}
          >
            {conteudo}
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  caixa: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, backgroundColor: Colors.bg2, gap: 3 },
  titulo: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 12.5, color: Colors.ink2 },
  canal: { fontSize: 12.5, color: Colors.ink2, marginTop: 2 },
  valor: { fontWeight: "700", color: Colors.ink },
  obs: { color: Colors.ink3 },
} as any);

export default CanaisAsaas;
