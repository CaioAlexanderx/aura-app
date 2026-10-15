// ============================================================
// AURA. -- PDV/Caixa · Faixa "Venda recuperada (N itens)"
//
// 14/10/2026: o carrinho em andamento sobrevive a trocar de página
// (utils/vendaGuardada). Ao abrir o Caixa com a venda guardada e o carrinho
// vazio, o useCart restaura em silêncio e esta faixa diz o que voltou, com o
// botão "Limpar" para recomeçar. Se algum preço de tabela mudou desde que a
// venda foi guardada, a faixa pede para conferir os valores (só avisa).
//
// Mesmo desenho do AvisoAssine: faixa inline no topo do catálogo, sem
// sobrepor nada. Em 375 px o texto quebra de linha; nada estoura a largura.
// ============================================================
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { TEXTO_CONFIRA_VALORES, tituloDaVendaRecuperada } from "@/utils/vendaRecuperada";

type Props = {
  itens: number;
  conferirValores?: boolean;
  /** Limpa a venda (Nova venda): carrinho, cliente, desconto e a guarda. */
  onLimpar: () => void;
  /** Esconde a faixa e mantém a venda. */
  onDispensar: () => void;
};

export function AvisoVendaRecuperada({ itens, conferirValores = false, onLimpar, onDispensar }: Props) {
  return (
    <View testID="caixa-venda-recuperada" style={s.faixa} accessibilityRole="alert">
      <View style={s.icone}>
        <Icon name="cart" size={16} color={Colors.violet3} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text testID="caixa-venda-recuperada-titulo" style={s.titulo}>{tituloDaVendaRecuperada(itens)}</Text>
        {conferirValores && (
          <Text testID="caixa-venda-recuperada-confira" style={s.corpo}>{TEXTO_CONFIRA_VALORES}</Text>
        )}
      </View>
      <Pressable
        testID="caixa-venda-recuperada-limpar"
        onPress={onLimpar}
        accessibilityRole="button"
        accessibilityLabel="Limpar a venda recuperada e começar do zero"
        style={[s.botao, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
      >
        <Text style={s.botaoTxt}>Limpar</Text>
      </Pressable>
      <Pressable
        testID="caixa-venda-recuperada-dispensar"
        onPress={onDispensar}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Fechar o aviso e manter a venda"
        style={[s.fechar, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
      >
        <Icon name="x" size={14} color={Colors.ink2} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  faixa: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    paddingLeft: 12,
    marginBottom: 14,
    borderRadius: 12,
    backgroundColor: Colors.violetD,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.35)",
  },
  icone: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(124,58,237,0.14)",
    flexShrink: 0,
  },
  titulo: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  corpo: { fontSize: 12, color: Colors.ink2, marginTop: 2, lineHeight: 16 },
  botao: {
    paddingHorizontal: 14, height: 34,
    borderRadius: 10,
    backgroundColor: Colors.violet,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  botaoTxt: { fontSize: 13, fontWeight: "700", color: "#fff" },
  fechar: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
});

export default AvisoVendaRecuperada;
