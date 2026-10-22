import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import {
  LABEL_DESIGN_SIZES, DEFAULT_LABEL_SIZE, labelDesignEfetivo,
  type LabelDesign, type LabelSizeKey,
} from "@/components/screens/estoque/labels/buildLabelHtml";
import { customLabelPreset, type CustomLabelSpec } from "@/components/screens/estoque/labels/customLabel";
import { rotaDeConfiguracoesNaSecao } from "@/utils/focoNaSecao";

// ============================================================
// "Desenho: Editorial · mudar" na aba Etiquetas (18/10/2026, card p-36)
//
// A escolha do desenho mora em Configurações › Políticas do Caixa ›
// Etiquetas (app#1094), longe de onde a loja imprime. Esta linha mostra o
// desenho que SAI NA IMPRESSÃO do modelo atual e leva até a escolha
// (/configuracoes?foco=desenho-etiqueta, utils/focoNaSecao).
//
// Só tela: lê as mesmas regras do buildLabelHtml (labelDesignEfetivo e o
// preset da Minha medida) sem mudar nada do que é impresso.
// ============================================================

// "tagVertical" (22/10/2026): só a Minha medida em pé (customLabel.ts,
// altura >= 1,5 x largura) sai nele; não é uma escolha da loja.
export type DesenhoImpresso = LabelDesign | "tagVertical";
export const NOME_DO_DESENHO: Record<DesenhoImpresso, string> = { classico: "Clássico", editorial: "Editorial", tagVertical: "Tag vertical" };

export type ResumoDoDesenho = {
  desenho: DesenhoImpresso;
  // O modelo atual aceita a escolha da loja (33x21 e 30x25)?
  escolhivel: boolean;
};

/** O desenho que sai na impressão, pela mesma regra do buildLabelHtml:
 *  Minha medida usa o desenho do próprio preset; os modelos fixos usam
 *  labelDesignEfetivo (a escolha da loja quando o modelo aceita, senão o
 *  padrão do modelo). */
export function resumoDoDesenho(
  labelSize: LabelSizeKey | undefined,
  labelDesign: string | null | undefined,
  medida: CustomLabelSpec | null | undefined,
): ResumoDoDesenho {
  if (medida) {
    const d = customLabelPreset(medida).design;
    return { desenho: d === "editorial" || d === "tagVertical" ? d : "classico", escolhivel: false };
  }
  const key = labelSize || DEFAULT_LABEL_SIZE;
  return { desenho: labelDesignEfetivo(key, labelDesign), escolhivel: LABEL_DESIGN_SIZES.indexOf(key) >= 0 };
}

export const ROTA_ESCOLHA_DO_DESENHO = rotaDeConfiguracoesNaSecao("desenho-etiqueta");

export function DesenhoDaEtiquetaLinha({ labelSize, labelDesign, medida, podeMudar }: {
  labelSize: LabelSizeKey;
  labelDesign: string | null | undefined;
  medida: CustomLabelSpec | null;
  // Quem não abre Configurações (vendedora sem a permissão) só vê o desenho.
  podeMudar: boolean;
}) {
  const r = resumoDoDesenho(labelSize, labelDesign, medida);
  const nome = NOME_DO_DESENHO[r.desenho];
  return (
    <View style={s.linha} testID="etiquetas-desenho">
      <Text style={s.txt}>
        Desenho: <Text style={s.nome}>{nome}</Text>
        {!r.escolhivel ? <Text style={s.obs}>{" · fixo neste modelo"}</Text> : null}
      </Text>
      {r.escolhivel && podeMudar ? (
        <Pressable
          onPress={function() { router.push(ROTA_ESCOLHA_DO_DESENHO as any); }}
          style={s.mudar}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={"Mudar o desenho da etiqueta (hoje: " + nome + ")"}
          testID="etiquetas-desenho-mudar"
        >
          <Text style={s.sep}>·</Text>
          <Text style={s.mudarTxt}>mudar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", paddingHorizontal: 4, minHeight: 32 },
  txt: { fontSize: 12, color: Colors.ink3 },
  nome: { color: Colors.ink, fontWeight: "700" },
  obs: { color: Colors.ink3 },
  mudar: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 6, minHeight: 32 },
  sep: { fontSize: 12, color: Colors.ink3 },
  mudarTxt: { fontSize: 12, color: Colors.violet3, fontWeight: "700", textDecorationLine: "underline" },
});

export default DesenhoDaEtiquetaLinha;
