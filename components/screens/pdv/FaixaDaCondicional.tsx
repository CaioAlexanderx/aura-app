// ============================================================
// AURA. — Caixa · faixa "Cobrando a condicional C-0007 · Nome" (C12)
//
// Mockup da Venda condicional (tela 5, Caixa): faixa petróleo com o cabide,
// "Cobrando a condicional ..." e o botão Sair. Mora no topo do Caixa
// (catálogo no computador, topo da página no celular). Quando a cobrança não
// pode seguir (peça já cobrada, condicional fechada, outra loja) a faixa diz
// a frase do servidor e oferece "Voltar à condicional" (ou "Trocar de loja").
// ============================================================
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Colors, CondicionalCores as CD } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { TEXTOS_DO_CAIXA_CONDICIONAL as T } from "@/utils/condicionalNoCaixa";

type Props = {
  estado: { tipo: "carregando" | "pronta" | "bloqueada" | "outra_loja" | "erro" } | null;
  numero: string;
  cliente: string | null;
  /** Frase de recusa (do servidor) ou do estado bloqueado. */
  aviso: string | null;
  onSair: () => void;
  onVoltar: () => void;
  onTrocarDeLoja: () => void;
  onTentarDeNovo: () => void;
  compact?: boolean;
};

export function FaixaDaCondicional({ estado, numero, cliente, aviso, onSair, onVoltar, onTrocarDeLoja, onTentarDeNovo, compact }: Props) {
  if (!estado) return null;
  const pronta = estado.tipo === "pronta";
  const titulo = estado.tipo === "carregando"
    ? T.carregando
    : numero ? T.faixa(numero, cliente) : "Cobrando a condicional";
  const web = Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null;
  return (
    <View testID="caixa-condicional-faixa" style={s.faixa} accessibilityRole="alert">
      <View style={s.icone}><Icon name="hanger" size={16} color={CD.cd} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text testID="caixa-condicional-titulo" style={s.titulo}>{titulo}</Text>
        {pronta && !aviso ? <Text testID="caixa-condicional-sub" style={s.corpo}>{T.faixaSub}</Text> : null}
        {aviso ? <Text testID="caixa-condicional-aviso" style={s.aviso}>{aviso}</Text> : null}
        {(aviso || estado.tipo === "erro" || estado.tipo === "outra_loja") ? (
          <View style={[s.acoes, compact && { flexWrap: "wrap" }]}>
            {estado.tipo === "outra_loja" ? (
              <Pressable testID="caixa-condicional-trocar" onPress={onTrocarDeLoja} accessibilityRole="button" style={[s.botao, web]}>
                <Text style={s.botaoTxt}>{T.trocarDeLoja}</Text>
              </Pressable>
            ) : null}
            {estado.tipo === "erro" ? (
              <Pressable testID="caixa-condicional-tentar" onPress={onTentarDeNovo} accessibilityRole="button" style={[s.botao, web]}>
                <Text style={s.botaoTxt}>{T.tentarDeNovo}</Text>
              </Pressable>
            ) : null}
            {estado.tipo !== "outra_loja" && estado.tipo !== "erro" ? (
              <Pressable testID="caixa-condicional-voltar" onPress={onVoltar} accessibilityRole="button" style={[s.botao, web]}>
                <Text style={s.botaoTxt}>{T.voltarACondicional}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
      <Pressable
        testID="caixa-condicional-sair"
        onPress={onSair}
        accessibilityRole="button"
        accessibilityLabel={T.sairDaCondicional}
        style={[s.sair, web]}
      >
        <Text style={s.sairTxt}>{T.sair}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  faixa: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    padding: 10, paddingLeft: 12, marginBottom: 14, borderRadius: 12,
    backgroundColor: CD.cdBg, borderWidth: 1, borderColor: CD.cdLine,
  },
  icone: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: CD.cdBg, flexShrink: 0 },
  titulo: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  corpo: { fontSize: 12, color: Colors.ink2, marginTop: 2, lineHeight: 16 },
  aviso: { fontSize: 12.5, color: CD.badInk, marginTop: 3, lineHeight: 17, fontWeight: "600" },
  acoes: { flexDirection: "row", gap: 8, marginTop: 8 },
  botao: { paddingHorizontal: 12, height: 34, borderRadius: 10, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
  botaoTxt: { fontSize: 13, fontWeight: "700", color: "#fff" },
  sair: { paddingHorizontal: 14, height: 34, borderRadius: 10, borderWidth: 1, borderColor: CD.cdLine, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sairTxt: { fontSize: 13, fontWeight: "700", color: CD.cdInk },
});

export default FaixaDaCondicional;
