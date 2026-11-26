// ============================================================
// AURA. — Selo "N para resolver" da Venda condicional (C16)
//
// Mockup: chip ÂMBAR com o alerta, ao lado dos selos "com clientes" e
// "reservado" (Estoque, consulta e cartão do Caixa). A peça voltou com defeito
// ou sem etiqueta: está na loja, mas não conta como livre. Fica fora de "com
// clientes" e de "livre". Sem peça para resolver devolve null: a tela é a de
// antes.
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { CondicionalCores as CD } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { TEXTOS_PARA_RESOLVER as T } from "@/utils/comClientes";

export function SeloParaResolver({ quantidade, testID }: { quantidade: number; testID?: string }) {
  if (!(quantidade > 0)) return null;
  return (
    <View style={s.selo} testID={testID}>
      <Icon name="alert" size={11} color={CD.warnInk} />
      <Text style={s.txt}>{T.selo(quantidade)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  selo: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 7, paddingVertical: 1, borderRadius: 99,
    backgroundColor: CD.warnBg,
    borderWidth: 1, borderColor: CD.warnLine,
  },
  txt: { fontSize: 11, fontWeight: "700", color: CD.warnInk },
});

export default SeloParaResolver;
