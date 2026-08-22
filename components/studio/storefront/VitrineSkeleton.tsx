// ============================================================
// AURA STUDIO · vitrine — esqueleto de carregamento (fase 03)
//
// A vitrine abria com um spinner centralizado numa tela vazia. Num
// celular em rede fraca isso é um segundo ou dois de nada — e "nada"
// é indistinguível de "loja quebrada" para quem clicou no link do
// WhatsApp da lojista.
//
// O esqueleto desenha a MESMA composição que vai chegar: faixa do hero,
// barra de categorias, grade de cartões. Quando o conteúdo entra, ele
// ocupa o lugar que já estava marcado — a página não pula.
//
// Sem cor da loja de propósito: neste momento o payload ainda não
// chegou, então a cor dela é desconhecida. Inventar uma e trocar depois
// seria pior que começar neutro.
// ============================================================
import { useEffect, useRef } from "react";
import { View, Animated, Easing, Platform, useWindowDimensions } from "react-native";
import { T } from "./types";
import { AURA } from "./theme";

/** Pulso lento e único para a tela toda — vários timers desencontrados viram ruído. */
function usePulso() {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ciclo = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 720, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(v, { toValue: 0, duration: 720, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== "web" }),
      ]),
    );
    ciclo.start();
    return () => ciclo.stop();
  }, [v]);

  return v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
}

function Bloco({
  largura, altura, raio = 8, opacidade, style,
}: {
  largura: number | string;
  altura: number;
  raio?: number;
  opacidade: any;
  style?: any;
}) {
  return (
    <Animated.View
      style={[
        { width: largura as any, height: altura, borderRadius: raio, backgroundColor: T.border, opacity: opacidade },
        style,
      ]}
    />
  );
}

type PropsSkeleton = {
  /**
   * "grade" e a vitrine Studio (cartoes lado a lado). "lista" e o
   * cardapio, que e uma linha por item com miniatura a esquerda — desenhar
   * a grade la faria a tela reorganizar quando o conteudo chegasse, que e
   * exatamente o que o esqueleto existe pra evitar.
   */
  variante?: "grade" | "lista";
};

export function VitrineSkeleton({ variante = "grade" }: PropsSkeleton = {}) {
  const o = usePulso();
  const { width } = useWindowDimensions();

  const telaLarga = width >= 720;
  const GAP = 14;
  const LARGURA_MAX = 980;
  // Mesma conta do ProductList: se a grade fantasma tiver outra densidade
  // que a real, a página reorganiza quando o conteúdo chega.
  const colunas = width < 560 ? 2 : width < 900 ? 3 : 4;
  const larguraUtil = Math.min(width, LARGURA_MAX) - 28;
  const larguraCartao = Math.floor((larguraUtil - GAP * (colunas - 1)) / colunas);
  const cartoes = colunas * 2;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }} accessibilityLabel="Carregando a loja">
      {/* Hero */}
      <View style={{ backgroundColor: T.card, paddingHorizontal: telaLarga ? 20 : 14, paddingTop: 28, paddingBottom: 32 }}>
        <View style={{ width: "100%", maxWidth: LARGURA_MAX, alignSelf: "center", paddingHorizontal: telaLarga ? 20 : 0, gap: 12 }}>
          <Bloco largura={56} altura={56} raio={12} opacidade={o} />
          <Bloco largura={120} altura={10} raio={5} opacidade={o} />
          <Bloco largura={telaLarga ? 340 : "76%"} altura={30} raio={8} opacidade={o} />
          <Bloco largura={telaLarga ? 260 : "58%"} altura={13} raio={6} opacidade={o} />
        </View>
      </View>

      {/* Barra de categorias */}
      <View
        style={{
          borderBottomWidth: 1, borderBottomColor: T.border,
          paddingVertical: 12, paddingHorizontal: telaLarga ? 20 : 14,
        }}
      >
        <View style={{ width: "100%", maxWidth: LARGURA_MAX, alignSelf: "center", flexDirection: "row", gap: 18 }}>
          {[52, 74, 66, 88, 58].map((w, i) => (
            <Bloco key={i} largura={w} altura={11} raio={5} opacidade={o} />
          ))}
        </View>
      </View>

      {/* Lista (cardapio): linha com miniatura, titulo e preco. */}
      {variante === "lista" ? (
        <View style={{ padding: 12, gap: 10, width: "100%", maxWidth: LARGURA_MAX, alignSelf: "center" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row", gap: 12, alignItems: "center",
                backgroundColor: T.card, borderRadius: 12, padding: 12,
                borderWidth: 1, borderColor: T.border,
              }}
            >
              <Bloco largura={60} altura={60} raio={10} opacidade={o} />
              <View style={{ flex: 1, gap: 7 }}>
                <Bloco largura="64%" altura={12} raio={6} opacidade={o} />
                <Bloco largura="88%" altura={9} raio={5} opacidade={o} />
                <Bloco largura={72} altura={12} raio={6} opacidade={o} />
              </View>
              <Bloco largura={32} altura={32} raio={10} opacidade={o} />
            </View>
          ))}
        </View>
      ) : (
      /* Grade */
      <View style={{ padding: 14, alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: LARGURA_MAX, flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
          {Array.from({ length: cartoes }).map((_, i) => (
            <View
              key={i}
              style={{
                width: larguraCartao,
                backgroundColor: T.card,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: T.border,
                padding: 10,
                gap: 9,
              }}
            >
              <Bloco largura="100%" altura={larguraCartao - 20} raio={Math.round((larguraCartao - 20) * 0.06)} opacidade={o} />
              <Bloco largura="82%" altura={12} raio={6} opacidade={o} />
              <Bloco largura="46%" altura={12} raio={6} opacidade={o} />
            </View>
          ))}
        </View>
      </View>
      )}

      {/* Assinatura fantasma: o rodapé existe desde o primeiro frame, então
          a página não cresce por baixo do dedo de quem já começou a rolar. */}
      <View style={{ alignItems: "center", paddingVertical: 22 }}>
        <Bloco largura={160} altura={10} raio={5} opacidade={o} style={{ backgroundColor: AURA.violet, opacity: 0.12 }} />
      </View>
    </View>
  );
}
