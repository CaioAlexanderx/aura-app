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
// seria pior que começar neutro. (Por isso a assinatura fantasma do pé
// também deixou de ser violeta — era a cor da Aura, não neutra.)
//
// 25/09/2026 (Fase 1A, D10): com "reduzir movimento" ligado o pulso não
// roda — os blocos ficam parados num cinza médio. Quem pediu menos
// movimento continua vendo que a página está chegando.
// ============================================================
import { useEffect, useRef } from "react";
import { View, Animated, Easing, Platform, useWindowDimensions } from "react-native";
import { usePaletaDaVitrine, useTemaDaVitrine } from "./TemaDaVitrine";
import { useReduzirMovimento } from "./movimento";

/** Opacidade fixa dos blocos quando o movimento está reduzido. */
const OPACIDADE_PARADA = 0.8;

/** Pulso lento e único para a tela toda — vários timers desencontrados viram ruído. */
function usePulso(parado: boolean) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (parado) return;
    const ciclo = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 720, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(v, { toValue: 0, duration: 720, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== "web" }),
      ]),
    );
    ciclo.start();
    return () => ciclo.stop();
  }, [v, parado]);

  return parado ? OPACIDADE_PARADA : v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
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
  const T = usePaletaDaVitrine();
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
  variante?: "grade" | "lista" | "home";
};

export function VitrineSkeleton({ variante = "grade" }: PropsSkeleton = {}) {
  if (variante === "home") return <EsqueletoDaHome />;
  return <EsqueletoAtual variante={variante} />;
}

/**
 * Fase 5 (home nova, mockup 05 tela 7): a MESMA composição que vai
 * chegar — faixa, cabeçalho, barra de categorias, destaque, passos e
 * grade — no tom do papel (bg3/bg4), sem a cor da loja: o payload ainda
 * não chegou. Um pulso lento só, para a tela toda; com "reduzir
 * movimento", parado. O leitor de tela ouve "Carregando a loja" uma vez.
 */
function EsqueletoDaHome() {
  const tema = useTemaDaVitrine();
  const reduzir = useReduzirMovimento();
  const o = usePulso(reduzir);
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const B = ({ w, h, r = 8, forte, style }: { w: number | string; h: number; r?: number; forte?: boolean; style?: any }) => (
    <Animated.View style={[{ width: w as any, height: h, borderRadius: r, backgroundColor: forte ? tema.border : tema.bg4, opacity: o }, style]} />
  );
  const colunas = desktop ? 3 : 2;
  const util = Math.min(width, 1120) - (desktop ? 0 : 32);
  const larg = Math.floor((util - (desktop ? 22 : 12) * (colunas - 1)) / colunas);
  return (
    <View
      testID="vitrine-esqueleto"
      style={{ flex: 1, backgroundColor: tema.bg, overflow: "hidden" }}
      accessibilityRole="progressbar"
      accessibilityLabel="Carregando a loja"
      accessibilityState={{ busy: true }}
      aria-busy
    >
      <View style={{ height: desktop ? 38 : 34, backgroundColor: tema.bg3, alignItems: "center", justifyContent: "center" }}>
        <B w={desktop ? 420 : "70%"} h={9} r={5} />
      </View>
      <View style={{ borderBottomWidth: 1, borderBottomColor: tema.border }}>
        <View style={{ width: "100%", maxWidth: 1180, alignSelf: "center", height: desktop ? 76 : 58, flexDirection: "row", alignItems: "center", gap: desktop ? 24 : 12, paddingHorizontal: desktop ? 20 : 16 }}>
          {desktop ? null : <B w={28} h={28} r={8} />}
          <B w={desktop ? 150 : 130} h={20} r={6} />
          <View style={{ flex: 1, alignItems: "center" }}>{desktop ? <B w={"100%"} h={46} r={999} style={{ maxWidth: 520 }} /> : null}</View>
          {desktop ? <B w={130} h={14} r={6} /> : <B w={28} h={28} r={8} />}
          <B w={28} h={28} r={8} />
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: tema.border, height: 44, flexDirection: "row", alignItems: "center", justifyContent: desktop ? "center" : "flex-start", gap: desktop ? 34 : 22, paddingHorizontal: 16 }}>
          {[58, 72, 44, 60, 56].map((w, i) => <B key={i} w={w} h={10} r={5} />)}
        </View>
      </View>
      <View style={{ width: "100%", maxWidth: 1280, alignSelf: "center", flexDirection: desktop ? "row" : "column", gap: desktop ? 64 : 16, paddingHorizontal: desktop ? 80 : 16, paddingTop: desktop ? 56 : 26, paddingBottom: desktop ? 64 : 30 }}>
        <View style={{ flex: desktop ? 1 : undefined, gap: 14, justifyContent: "center" }}>
          <B w={150} h={10} r={5} />
          <B w={desktop ? "80%" : "86%"} h={desktop ? 54 : 32} />
          <B w={desktop ? "60%" : "62%"} h={desktop ? 54 : 32} />
          <B w={desktop ? "72%" : "90%"} h={12} r={6} />
          <B w={desktop ? "54%" : "70%"} h={12} r={6} />
          <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
            <B w={desktop ? 200 : "48%"} h={48} r={12} />
            <B w={desktop ? 140 : "48%"} h={48} r={12} />
          </View>
        </View>
        <View style={{ flex: desktop ? 1 : undefined }}>
          <B w={"100%"} h={desktop ? 440 : 300} r={desktop ? 28 : 22} style={{ backgroundColor: tema.bg3 }} />
        </View>
      </View>
      <View style={{ width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: desktop ? 0 : 16, flexDirection: desktop ? "row" : "column", gap: desktop ? 20 : 10 }}>
        {[0, 1, 2].map((i) => <B key={i} w={desktop ? undefined as any : "100%"} h={desktop ? 150 : 88} r={14} style={[{ backgroundColor: tema.bg3 }, desktop ? { flex: 1 } : null]} />)}
      </View>
      <View style={{ width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: desktop ? 0 : 16, paddingTop: 40, flexDirection: "row", flexWrap: "wrap", gap: desktop ? 22 : 12 }}>
        {Array.from({ length: colunas * 2 }).map((_, i) => <B key={i} w={larg} h={Math.round(larg * 1.2)} r={14} style={{ backgroundColor: tema.bg3 }} />)}
      </View>
    </View>
  );
}

function EsqueletoAtual({ variante }: { variante: "grade" | "lista" }) {
  const T = usePaletaDaVitrine();
  const reduzir = useReduzirMovimento();
  const o = usePulso(reduzir);
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
    <View
      testID="vitrine-esqueleto"
      style={{ flex: 1, backgroundColor: T.bg }}
      accessibilityRole="progressbar"
      accessibilityLabel="Carregando a loja"
      accessibilityState={{ busy: true }}
    >
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
        <Bloco largura={160} altura={10} raio={5} opacidade={o} style={{ opacity: 0.5 }} />
      </View>
    </View>
  );
}
