// ============================================================
// components/endereco/SecaoEndereco.tsx
//
// "Endereço para entrega" recolhido (mockup 09/11/2026, seção A): uma
// linha que diz o que já tem ("Av. Paulista, 1000 · Bela Vista") ou
// "Opcional", e abre o EnderecoForm ao tocar. Usado no formulário de
// cliente (Clientes › Novo/Editar) e no cadastro rápido do Caixa.
// ============================================================
import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { EnderecoForm, type EnderecoFormProps } from "./EnderecoForm";
import { enderecoComecado, resumoDoEndereco } from "./endereco";

type Props = EnderecoFormProps & {
  /** Começa aberta (padrão: recolhida). */
  abertaInicial?: boolean;
  titulo?: string;
};

export function SecaoEndereco({ abertaInicial = false, titulo = "Endereço para entrega", ...form }: Props) {
  const [aberta, setAberta] = useState(abertaInicial);
  const prefixo = form.testID || "endereco";
  const resumo = resumoDoEndereco(form.value);
  const sub = resumo || (enderecoComecado(form.value) ? "Endereço começado" : "Opcional · o CEP preenche o resto");

  return (
    <View style={s.wrap} testID={`${prefixo}-secao`}>
      <Pressable
        onPress={() => setAberta((a) => !a)}
        style={s.head}
        testID={`${prefixo}-abrir`}
        accessibilityRole="button"
        accessibilityState={{ expanded: aberta }}
        accessibilityLabel={titulo + (aberta ? ", recolher" : ", abrir")}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title}>{titulo}</Text>
          {!aberta && <Text style={s.sub} numberOfLines={1}>{sub}</Text>}
        </View>
        <Text style={s.acao}>{aberta ? "Recolher" : resumo ? "Editar" : "Adicionar"}</Text>
        <Icon name={aberta ? "chevron-up" : "chevron-down"} size={14} color={Colors.violet3} />
      </Pressable>
      {aberta && (
        <View style={s.body}>
          <EnderecoForm {...form} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    width: "100%", borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    backgroundColor: Colors.bg3, marginBottom: 16,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 },
  title: { fontSize: 12, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  sub: { fontSize: 13, color: Colors.ink2, marginTop: 2 },
  acao: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
  body: { width: "100%", paddingHorizontal: 14, paddingBottom: 14 },
});

export default SecaoEndereco;
