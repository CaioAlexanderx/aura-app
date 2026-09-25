// ============================================================
// components/studio/storefront/produto/GradeDeModelosV2.tsx
//
// A grade de modelos da categoria na vitrine nova (Tela 9 do mockup,
// JORNADA §4.3): a tela antes do produto, para comparar os modelos por
// foto e preço sem abrir um por um. Atrás da chave `vitrine_v2`; sem
// ela, a GradeDeModelos de hoje.
//
// A LÓGICA é a mesma da GradeDeModelos: a ordem, o que varia e o resumo
// saem de modelosDoGrupo.ts; as etiquetas de chipsDoProduto e o selo de
// seloDoProduto. Muda o desenho: cartão de foto grande, no máximo um
// selo de canto, até três etiquetas em texto, "a partir de" quando o
// preço pode mudar na página, e o Pix. A trilha substitui o "← Voltar
// para a loja".
// ============================================================
import { useEffect } from "react";
import { Image, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import type { StorefrontState } from "../useStorefront";
import type { StudioStoreProduct } from "../types";
import { useTemaDaVitrine } from "../TemaDaVitrine";
import { Texto, Numero, useTipografia } from "../TipografiaVitrine";
import { BarraDeCookies } from "../ConsentimentoDaVitrine";
import { RodapeDaVitrine } from "../RodapeDaVitrine";
import { CapaProduto } from "../CapaProduto";
import { fotosDoProduto } from "../CarrosselFoto";
import { chipsDoProduto, seloDoProduto, pecaMaisPedida } from "../selosDoProduto";
import { precoNoPix } from "../precoNoPix";
import { modelosOrdenados, eixoQueVaria, faixaDePrecos, resumoDoGrupo } from "../modelosDoGrupo";
import { tituloDaPagina } from "../rotasDaVitrine";
import { dinheiro } from "../moeda";
import { precoPodeMudar } from "./regrasDaPagina";
import { CabecalhoDaLoja, Trilha } from "./CabecalhoDaLoja";
import { Selo, transicao } from "./kitDaPagina";

const LARGURA_MAX = 1200;

function Cartao({
  produto, largura, selo, pixPct, onPress,
}: {
  produto: StudioStoreProduct;
  largura: number;
  selo: { texto: string; tom: "marca" | "novo" } | null;
  pixPct: number;
  onPress: () => void;
}) {
  const t = useTemaDaVitrine();
  const tipo = useTipografia();
  const foto = fotosDoProduto((produto as any).gallery_urls, produto.image_url)[0] || null;
  const preco = Number(produto.price) || 0;
  const pix = precoNoPix(preco, pixPct);
  const etiquetas = chipsDoProduto(produto).map((c) => c.texto).join(" · ");
  const altura = Math.round(largura * 1.25);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${produto.name}, ${dinheiro(preco)}`}
      style={{ width: largura, gap: 3 }}
    >
      {({ hovered }: any) => (
        <>
          <View style={[{ width: largura, height: altura, borderRadius: 14, overflow: "hidden", backgroundColor: t.bg3, marginBottom: 8 },
            hovered && Platform.OS === "web" ? ({ transform: [{ translateY: -3 }], boxShadow: "0 8px 24px -10px rgba(26,23,20,.22)" } as any) : null,
            transicao("transform, box-shadow")]}>
            {foto ? (
              <Image source={{ uri: foto }} resizeMode="cover" style={{ width: "100%", height: "100%" }} accessibilityIgnoresInvertColors />
            ) : (
              <CapaProduto nome={produto.name} tamanho={largura} altura={altura} preencher corDaLoja={t.marca} fonteDisplay={tipo.display} />
            )}
            {selo ? (
              <View style={{ position: "absolute", top: 10, left: 10 }}>
                <Selo texto={selo.texto} tom={selo.tom === "novo" ? "suave" : "marca"} />
              </View>
            ) : null}
          </View>
          <Texto numberOfLines={2} style={{ fontFamily: tipo.display, fontSize: largura > 200 ? 18 : 16.5, lineHeight: largura > 200 ? 22 : 20, color: t.ink }}>
            {produto.name}
          </Texto>
          {etiquetas ? <Texto numberOfLines={2} style={{ fontSize: 12, lineHeight: 17, color: t.ink3 }}>{etiquetas}</Texto> : null}
          <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 5, marginTop: 4 }}>
            {precoPodeMudar(produto) ? <Texto style={{ fontSize: 12, color: t.ink3 }}>a partir de</Texto> : null}
            <Numero style={{ fontSize: 15, fontWeight: "600", color: t.ink }}>{dinheiro(preco)}</Numero>
          </View>
          {pix != null ? (
            <Texto style={{ fontSize: 12.5, fontWeight: "600", color: t.green }}>
              <Numero style={{ fontSize: 12.5, fontWeight: "600", color: t.green }}>{dinheiro(pix)}</Numero> no Pix
            </Texto>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

export function GradeDeModelosV2({ sf }: { sf: StorefrontState }) {
  const t = useTemaDaVitrine();
  const tipo = useTipografia();
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const grupo = sf.grupoAberto;
  const store: any = sf.store;
  const categoria = grupo?.categoria || null;
  const produtos = grupo?.produtos || [];

  const titulo = tituloDaPagina({ stage: "modelos", nomeDaLoja: store?.site?.name, categoria: categoria?.name });
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") document.title = titulo;
  }, [titulo]);

  const modelos = modelosOrdenados(produtos);
  const eixo = eixoQueVaria(modelos);
  const faixa = faixaDePrecos(modelos);
  const resumo = resumoDoGrupo(modelos);
  const campeao = pecaMaisPedida(store?.products || []);
  const pixPct = store?.payment?.has_pix ? Number(store?.payment?.pix_discount_pct) || 0 : 0;

  const util = Math.min(width, LARGURA_MAX) - (desktop ? 80 : 32);
  const colunas = desktop ? 4 : width >= 700 ? 3 : 2;
  const gap = desktop ? 24 : 12;
  const larguraCartao = Math.floor((util - gap * (colunas - 1)) / colunas);
  const n = modelos.length;
  const dica = eixo === "preco"
    ? "Cada modelo tem um preço. Toque para ver a peça de perto."
    : eixo === "cor"
    ? "Mesmo preço; o que muda é a cor disponível em cada um."
    : "Mesmo preço; o que muda é o acabamento da peça.";
  // "Todos com prévia em 3D da sua arte." — só a parte depois do "·"
  // do resumo, que já diz quantos têm 3D (modelosDoGrupo.resumoDoGrupo).
  const sobre3D = resumo.includes("·") ? resumo.split("·")[1].trim() : "";
  const frase3D = sobre3D ? sobre3D.charAt(0).toUpperCase() + sobre3D.slice(1) + " da sua arte." : "";

  const cabeca = (
    <View style={[{ gap: 6 }, desktop ? { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 40, paddingTop: 8, paddingBottom: 30 } : { paddingTop: 2, paddingBottom: 22 }]}>
      <View style={{ gap: 6, flexShrink: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <Texto accessibilityRole="header" style={{ fontFamily: tipo.display, fontSize: desktop ? 40 : 32, lineHeight: desktop ? 44 : 36, color: t.ink, letterSpacing: -0.4 }}>
            {categoria?.name || "Modelos"}
          </Texto>
          <Selo texto={`${n} ${n === 1 ? "modelo" : "modelos"}`} tom="suave" />
        </View>
        {frase3D ? <Texto style={{ fontSize: 13.5, color: t.ink2 }}>{frase3D}</Texto> : null}
      </View>
      <View style={{ gap: 4, maxWidth: desktop ? 360 : undefined }}>
        {faixa ? (
          <Numero style={{ fontSize: 15, fontWeight: "600", color: t.ink2, marginTop: desktop ? 0 : 4 }}>
            {`De ${dinheiro(faixa.min)} a ${dinheiro(faixa.max)}`}
          </Numero>
        ) : null}
        <Texto style={{ fontSize: 13.5, lineHeight: 20, color: t.ink3 }}>{dica}</Texto>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }} testID="grade-de-modelos-v2">
      <CabecalhoDaLoja sf={sf} desktop={desktop} onVoltar={() => sf.goTo("list")} categoriaAtiva={categoria ? String(categoria.slug || categoria.id || "") : null} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ width: "100%", maxWidth: LARGURA_MAX, alignSelf: "center", paddingHorizontal: desktop ? 40 : 16 }}>
          <View style={{ paddingVertical: desktop ? 8 : 0, marginHorizontal: desktop ? 0 : -16 }}>
            <Trilha desktop={desktop} niveis={[{ rotulo: "Início", onPress: () => sf.goTo("list") }, { rotulo: categoria?.name || "Modelos" }]} />
          </View>
          {cabeca}
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: gap, rowGap: desktop ? 40 : 24, paddingBottom: desktop ? 56 : 40 }}>
            {modelos.map((m) => (
              <Cartao
                key={m.produto.id}
                produto={m.produto}
                largura={larguraCartao}
                selo={seloDoProduto(m.produto, campeao)}
                pixPct={pixPct}
                onPress={() => sf.openConfigure(m.produto, produtos)}
              />
            ))}
          </View>
        </View>
        <RodapeDaVitrine store={store} />
      </ScrollView>
      <BarraDeCookies />
    </View>
  );
}
