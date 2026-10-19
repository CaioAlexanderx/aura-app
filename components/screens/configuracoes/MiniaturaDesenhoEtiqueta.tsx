import { View, StyleSheet } from "react-native";
import type { LabelDesign } from "@/components/screens/estoque/labels/buildLabelHtml";

// ============================================================
// Miniatura do desenho da etiqueta (18/10/2026, card p-36)
//
// Ilustração estática, só de tela, para a lojista reconhecer o desenho
// antes de escolher. Não é render da etiqueta real: não lê nem chama o
// buildLabelHtml e não interfere no que sai na impressão.
//   Clássico : loja no topo, código de barras no meio, nome e preço embaixo
//   Editorial: loja no topo, nome inteiro, preço em destaque, código no rodapé
// Papel sempre branco (é a etiqueta), nos dois temas. Proporção 33x21.
// ============================================================

const LARGURA = 66;
const ALTURA = 42;
const TINTA = "#1f2937";
const CINZA = "#9ca3af";

// Barras de larguras diferentes, só para lembrar um código de barras.
const BARRAS = [1, 1, 2, 1, 1, 3, 1, 2, 1, 1, 2, 1, 1, 3, 1, 1, 2, 1];

function Barras({ altura }: { altura: number }) {
  return (
    <View style={[st.barras, { height: altura }]}>
      {BARRAS.map(function(w, i) {
        return <View key={i} style={{ width: w, height: altura, backgroundColor: TINTA, marginRight: i === BARRAS.length - 1 ? 0 : 1 }} />;
      })}
    </View>
  );
}

function Traco({ largura, altura, cor, centro }: { largura: string | number; altura: number; cor: string; centro?: boolean }) {
  return <View style={{ width: largura as any, height: altura, borderRadius: 1, backgroundColor: cor, alignSelf: centro ? "center" : "flex-start" }} />;
}

export function MiniaturaDesenhoEtiqueta({ desenho }: { desenho: LabelDesign }) {
  return (
    <View
      style={st.papel}
      testID={"miniatura-etiqueta-" + desenho}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {desenho === "editorial" ? (
        <>
          <Traco largura="40%" altura={2} cor={CINZA} centro />
          <View style={{ gap: 2 }}>
            <Traco largura="92%" altura={3} cor={TINTA} />
            <Traco largura="64%" altura={3} cor={TINTA} />
          </View>
          <Traco largura="46%" altura={6} cor={TINTA} />
          <Barras altura={6} />
        </>
      ) : (
        <>
          <Traco largura="40%" altura={2} cor={CINZA} centro />
          <Barras altura={14} />
          <View style={st.linhaBaixo}>
            <Traco largura="56%" altura={3} cor={CINZA} />
            <Traco largura="28%" altura={4} cor={TINTA} />
          </View>
        </>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  papel: {
    width: LARGURA, height: ALTURA, borderRadius: 4, backgroundColor: "#ffffff",
    borderWidth: 1, borderColor: "#d1d5db", paddingHorizontal: 5, paddingVertical: 4,
    justifyContent: "space-between",
  },
  barras: { flexDirection: "row", alignSelf: "center", overflow: "hidden" },
  linhaBaixo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});

export default MiniaturaDesenhoEtiqueta;
