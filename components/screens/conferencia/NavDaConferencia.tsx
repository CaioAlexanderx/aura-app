// ============================================================
// AURA. — Conferência de estoque · navegação do topo (12/11/2026)
//
// Relato do Caio em produção: em "Preencher custos" não havia como voltar
// (só um texto pequeno "‹ Diferenças", que passava despercebido, e um
// router.back() que, na pilha aninhada nas abas da web, não é confiável).
//
// Este é o cabeçalho único de todas as telas da conferência:
//   · à esquerda, um BOTÃO de voltar de verdade (44 px, seta + texto), que
//     sempre leva a um caminho fixo com router.push — nunca router.back();
//   · ao lado, "Ir para o Estoque" (/estoque; a tela de Estoque não lê
//     ?loja=, então vai sem ele).
// Os dois ficam sempre visíveis (sem hover-reveal) e quebram de linha em
// 375 px se não couberem. Tema do app (Colors).
// ============================================================
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

export var ROTA_ESTOQUE = "/estoque";

export type VoltarDaConferencia = { rotulo: string; destino: string; testID?: string };

type Props = {
  /** Para onde o botão de voltar leva. Sem ele, só aparece "Ir para o Estoque". */
  voltar?: VoltarDaConferencia | null;
  testIDEstoque?: string;
  testID?: string;
  style?: any;
};

export function NavDaConferencia({ voltar, testIDEstoque, testID, style }: Props) {
  return (
    <View style={[n.barra, style]} testID={testID}>
      {voltar ? (
        <Pressable
          onPress={function () { router.push(voltar.destino as any); }}
          style={n.voltar}
          accessibilityRole="button"
          accessibilityLabel={voltar.rotulo}
          testID={voltar.testID}
        >
          <Icon name="arrow_left" size={18} color={Colors.violet3} />
          <Text style={n.voltarTxt} numberOfLines={1}>{voltar.rotulo}</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={function () { router.push(ROTA_ESTOQUE as any); }}
        style={n.estoque}
        accessibilityRole="link"
        accessibilityLabel="Ir para o Estoque"
        testID={testIDEstoque}
      >
        <Icon name="package" size={16} color={Colors.violet3} />
        <Text style={n.estoqueTxt} numberOfLines={1}>Ir para o Estoque</Text>
      </Pressable>
    </View>
  );
}

var n = StyleSheet.create({
  barra: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 },
  voltar: {
    minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 10, paddingRight: 14,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.violetD, flexShrink: 1, minWidth: 0,
  },
  voltarTxt: { color: Colors.violet3, fontSize: 14, fontWeight: "700", flexShrink: 1 },
  estoque: {
    minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10,
    borderRadius: 12, flexShrink: 1, minWidth: 0, marginLeft: "auto" as any,
  },
  estoqueTxt: { color: Colors.violet3, fontSize: 14, fontWeight: "700", textDecorationLine: "underline", flexShrink: 1 },
});

export default NavDaConferencia;
