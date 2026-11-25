// ============================================================
// SeloDaSituacao — Aura · Crediário (cores por situação, 25/11/2026)
//
// Mockup aprovado docs/mockups/crediario-cores-e-movimento.html (seção 1):
// um selo por linha, no desenho do selo de situação dos Pedidos
// (components/screens/vendas/pedidos/LinhaDoPedido.tsx): ponto de 7 px,
// texto 12/700, fundo no token D, raio 99. O texto vai no tom de contraste
// da ficha (fichaStyles.CorDaFicha) para passar no tema claro.
//
// A situação vem de utils/crediarioSituacao (regra única).
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { CorDaFicha } from "./fichaStyles";
import { Motion, webTransition } from "@/constants/motion";
import { ROTULO_DA_SITUACAO, type SituacaoDoCrediario } from "@/utils/crediarioSituacao";

/** Ponto, texto e fundo de cada situação (claro e escuro pelos tokens). */
export const COR_DA_SITUACAO: Record<SituacaoDoCrediario, { ponto: string; texto: string; fundo: string }> = {
  em_dia: { ponto: Colors.green, texto: CorDaFicha.verdeTexto, fundo: Colors.greenD },
  a_vencer: { ponto: Colors.amber, texto: CorDaFicha.ambarTexto, fundo: Colors.amberD },
  atrasado: { ponto: Colors.red, texto: CorDaFicha.vermelhoTexto, fundo: Colors.redD },
  a_conferir: { ponto: Colors.violet, texto: CorDaFicha.violetaTexto, fundo: Colors.violetD },
};

export function SeloDaSituacao({ situacao, testID }: { situacao: SituacaoDoCrediario; testID?: string }) {
  const c = COR_DA_SITUACAO[situacao];
  return (
    <View
      style={[s.selo, { backgroundColor: c.fundo }, TRANSICAO]}
      testID={testID ?? `crediario-selo-${situacao}`}
      accessibilityLabel={ROTULO_DA_SITUACAO[situacao]}
    >
      <View style={[s.ponto, { backgroundColor: c.ponto }, TRANSICAO]} />
      <Text style={[s.texto, { color: c.texto }, TRANSICAO_DO_TEXTO]} numberOfLines={1}>{ROTULO_DA_SITUACAO[situacao]}</Text>
    </View>
  );
}

// 25/11/2026 (movimento): a troca de situação pinta em 200 ms (web).
const TRANSICAO = webTransition("background-color", Motion.base);
const TRANSICAO_DO_TEXTO = webTransition("color", Motion.base);

const s = StyleSheet.create({
  selo: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99 },
  ponto: { width: 7, height: 7, borderRadius: 4 },
  texto: { fontFamily: Fonts.body, fontSize: 12, fontWeight: "700" },
});

export default SeloDaSituacao;
