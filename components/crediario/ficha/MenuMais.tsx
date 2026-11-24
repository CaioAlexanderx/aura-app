// ============================================================
// MenuMais — o "⋯" da ficha do crediário (F4, 23/11/2026)
//
// O raro mora no "⋯" (mockup aprovado): no cabeçalho da ficha (Editar
// cadastro, Limite e regras, Imprimir todos, Juntar, Criar carnê vazio) e em
// cada carnê (Mudar as parcelas, Receber o carnê inteiro, Excluir).
//
// Abre com TOQUE (nada de hover, regra 7) e a lista entra no fluxo logo
// abaixo da linha — não flutua: dentro de cartão com overflow hidden e de
// ScrollView um menu absoluto seria cortado. Mesmo padrão do "⋯" das
// Movimentações (TabHistorico).
// ============================================================
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";

export type ItemDoMenu = {
  rotulo: string;
  onPress: () => void;
  destrutivo?: boolean;
  testID?: string;
};

export function BotaoMais({ aberto, onPress, rotulo = "Mais ações", testID }: {
  aberto: boolean;
  onPress: () => void;
  rotulo?: string;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }: any) => [s.botao, (aberto || pressed) && s.botaoOn]}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ expanded: aberto }}
      hitSlop={4}
      testID={testID}
    >
      <Text style={s.botaoTxt}>⋯</Text>
    </Pressable>
  );
}

export function ListaDoMenu({ itens, onEscolher, testID }: {
  itens: ItemDoMenu[];
  /** Chamado antes da ação (o pai fecha o menu). */
  onEscolher?: () => void;
  testID?: string;
}) {
  return (
    <View style={s.lista} testID={testID}>
      {itens.map((it) => (
        <Pressable
          key={it.rotulo}
          onPress={() => { onEscolher?.(); it.onPress(); }}
          style={({ pressed, hovered }: any) => [s.item, (pressed || hovered) && { backgroundColor: Colors.violetD }]}
          accessibilityRole="button"
          accessibilityLabel={it.rotulo}
          testID={it.testID}
        >
          <Text style={[s.itemTxt, it.destrutivo && { color: Colors.red }]}>{it.rotulo}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  botao: {
    width: 44, height: 44, borderRadius: 11, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border2,
  },
  botaoOn: { backgroundColor: Colors.violetD, borderColor: Colors.violet2 },
  botaoTxt: { fontFamily: Fonts.body, fontSize: 17, fontWeight: "800", color: Colors.ink2, marginTop: -2 },
  lista: {
    alignSelf: "flex-end", minWidth: 226, maxWidth: "100%", padding: 6, gap: 2,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3,
  },
  item: { minHeight: 44, justifyContent: "center", paddingHorizontal: 11, borderRadius: 8 },
  itemTxt: { fontFamily: Fonts.body, fontSize: 13, fontWeight: "600", color: Colors.ink },
});
