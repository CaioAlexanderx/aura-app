// "Transferir para outra loja" na barra da seleção do Estoque (10/11/2026).
// Só existe quando lojasDaTransferencia() devolve lojas (2+ lojas do grupo,
// numa loja específica). Mesmo visual dos outros botões da barra.
import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import type { LojasDaTransferencia } from "@/utils/transferenciaEstoque";

type Props = { lojas: LojasDaTransferencia | null; selecionados: number; onPress: () => void };

export function BotaoTransferir({ lojas, selecionados, onPress }: Props) {
  if (!lojas) return null;
  var vazio = selecionados === 0;
  return (
    <Pressable
      onPress={function () { if (!vazio) onPress(); }}
      disabled={vazio}
      style={[s.btn, vazio && { opacity: 0.4 }]}
      accessibilityRole="button"
      accessibilityState={{ disabled: vazio }}
      testID="estoque-transferir"
    >
      <Text style={s.txt}>Transferir para outra loja</Text>
    </Pressable>
  );
}

// Igual a s.bulkAction / s.bulkActionText de app/(tabs)/estoque.tsx.
var s = StyleSheet.create({
  btn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  txt: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
});

export default BotaoTransferir;
