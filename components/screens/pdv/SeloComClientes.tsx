// ============================================================
// AURA. — Selo "N com clientes" da Venda condicional (C13)
//
// Mockup: chip de BORDA TRACEJADA em azul-petróleo, com o cabide. Fica ao
// lado do selo de reserva (azul, sólido) no cartão do Caixa, na linha do
// Estoque e na consulta. Sem peça com cliente devolve null: a tela é a de
// antes.
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { CondicionalCores as CD } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { TEXTOS_COM_CLIENTES as T } from "@/utils/comClientes";

export function SeloComClientes({ quantidade, testID }: { quantidade: number; testID?: string }) {
  if (!(quantidade > 0)) return null;
  return (
    <View style={s.selo} testID={testID}>
      <Icon name="hanger" size={11} color={TEXTO} />
      <Text style={s.txt}>{T.selo(quantidade)}</Text>
    </View>
  );
}

// Texto do mockup: #155e75 no claro, #67e8f9 no escuro. Cores da condicional
// numa fonte só (CondicionalCores, constants/colors.ts).
const TEXTO = CD.cdInk;

const s = StyleSheet.create({
  selo: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 7, paddingVertical: 1, borderRadius: 99,
    backgroundColor: CD.cdBg,
    borderWidth: 1, borderStyle: "dashed", borderColor: CD.cd,
  },
  txt: { fontSize: 11, fontWeight: "700", color: TEXTO },
});

export default SeloComClientes;
