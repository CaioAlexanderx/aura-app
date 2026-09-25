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
import { useEffect, useMemo, useState } from "react";
import { Image, Linking, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Icon } from "@/components/Icon";
import { wash } from "../theme";
import { CabecalhoDaVitrine, CamadasDaNavegacao, abrirCategoria, linkDoWhatsApp, useCamadas } from "../home/NavegacaoDaVitrine";
import { itensDaFaixa, produtosDaArvore, subcategorias, trilhaDaCategoria } from "../home/regrasDaHome";
import { FaixaDeAnuncio } from "../home/HomeDaVitrineNova";
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
import { Trilha } from "./CabecalhoDaLoja";
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
  const produtosDoGrupo = grupo?.produtos || [];
  // Fase 5: a página da categoria ganha o cabeçalho da home nova (busca,
  // gaveta, barra de categorias presa), a trilha com os ancestrais, as
  // filhas como opções e o "não achou?" com o WhatsApp (mockup 05, tela 5).
  const camadas = useCamadas();
  const [sub, setSub] = useState<string | null>(null);
  useEffect(() => { setSub(null); }, [categoria?.id]);
  const filhas = useMemo(() => subcategorias(categoria, store), [categoria, store]);
  const filhaAtiva = filhas.find((f) => String(f.categoria.id) === sub)?.categoria || null;
  const produtos = filhaAtiva ? produtosDaArvore(filhaAtiva.id, store) : produtosDoGrupo;
  const ancestrais = useMemo(() => trilhaDaCategoria(categoria, store?.categories), [categoria, store]);
  const raiz = ancestrais[0] || categoria;

  const titulo = tituloDaPagina({ stage: "modelos", nomeDaLoja: store?.site?.name, categoria: categoria?.name });
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") document.title = titulo;
  }, [titulo]);
  // O foco vai para o título ao abrir (mockup 05, tela 5): quem navega
  // pelo teclado ou leitor de tela começa a página do começo.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const el = document.getElementById("titulo-da-categoria") as HTMLElement | null;
    if (el) { el.setAttribute("tabindex", "-1"); try { el.focus({ preventScroll: true } as any); } catch { /* ok */ } }
  }, [categoria?.id]);

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
  const nomeDaVez = filhaAtiva?.name || categoria?.name || "Modelos";
  const zap = linkDoWhatsApp(store?.site?.whatsapp, `Olá! Vi as ${String(categoria?.name || "peças").toLowerCase()} na loja e queria um modelo que não achei.`);

  const cabeca = (
    <View style={[{ gap: 6 }, desktop ? { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 40, paddingTop: 8, paddingBottom: 30 } : { paddingTop: 2, paddingBottom: 22 }]}>
      <View style={{ gap: 6, flexShrink: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <Texto nativeID="titulo-da-categoria" accessibilityRole="header" style={[{ fontFamily: tipo.display, fontSize: desktop ? 40 : 32, lineHeight: desktop ? 44 : 36, color: t.ink, letterSpacing: -0.4 }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]}>
            {nomeDaVez}
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

  const niveis = [
    { rotulo: "Início", onPress: () => sf.goTo("list") },
    ...ancestrais.slice(0, -1).map((c) => ({ rotulo: c.name, onPress: () => { abrirCategoria(sf, c); } })),
    ...(filhaAtiva
      ? [{ rotulo: categoria?.name || "Modelos", onPress: () => setSub(null) }, { rotulo: filhaAtiva.name }]
      : [{ rotulo: categoria?.name || "Modelos" }]),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }} testID="grade-de-modelos-v2">
      <ScrollView style={{ flex: 1 }} stickyHeaderIndices={[1]} contentContainerStyle={{ paddingBottom: 24 }}>
        <FaixaDeAnuncio itens={itensDaFaixa(store)} desktop={desktop} />
        <View style={{ zIndex: 20 }}>
          <CabecalhoDaVitrine sf={sf} desktop={desktop} camadas={camadas} categoriaAtiva={raiz ? String(raiz.slug || raiz.id || "") : null} rolou />
        </View>
        <View style={{ width: "100%", maxWidth: LARGURA_MAX, alignSelf: "center", paddingHorizontal: desktop ? 40 : 16, paddingTop: desktop ? 20 : 12 }}>
          <View style={{ paddingVertical: desktop ? 8 : 0, marginHorizontal: desktop ? 0 : -16 }}>
            <Trilha desktop={desktop} niveis={niveis} />
          </View>
          {cabeca}
          {filhas.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: desktop ? 0 : -16, marginBottom: 22 }} contentContainerStyle={{ gap: 8, paddingHorizontal: desktop ? 0 : 16 }} accessibilityRole={"radiogroup" as any} accessibilityLabel={`Tipos de ${String(categoria?.name || "").toLowerCase()}`}>
              {[{ id: null as string | null, nome: "Todas", total: produtosDoGrupo.length }, ...filhas.map((f) => ({ id: String(f.categoria.id), nome: f.categoria.name, total: f.total }))].map((o) => {
                const sel = sub === o.id;
                return (
                  <Pressable
                    key={o.id || "todas"}
                    onPress={() => setSub(o.id)}
                    accessibilityRole={"radio" as any}
                    accessibilityState={{ checked: sel }}
                    style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: sel ? t.marcaTexto : wash(t.ink, 0.16), backgroundColor: sel ? t.marcaWash : t.bg2 }}
                  >
                    <Texto style={{ fontSize: 13.5, color: t.ink, fontWeight: sel ? "600" : "500" }}>{o.nome}</Texto>
                    <Numero style={{ fontSize: 11.5, color: t.ink3 }}>{o.total}</Numero>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: gap, rowGap: desktop ? 40 : 24 }}>
            {modelos.map((m) => (
              <Cartao
                key={m.produto.id}
                produto={m.produto}
                largura={larguraCartao}
                selo={seloDoProduto(m.produto, campeao)}
                pixPct={pixPct}
                onPress={() => sf.openConfigure(m.produto, produtosDoGrupo)}
              />
            ))}
          </View>
          {zap ? (
            <View style={{ marginTop: desktop ? 40 : 28, marginBottom: desktop ? 56 : 40, padding: 18, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: wash(t.ink, 0.16), flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <Texto style={{ fontSize: 14, color: t.ink2, flexShrink: 1 }}>
                Não achou o modelo que queria? {store?.site?.name ? `A ${store.site.name}` : "A loja"} faz sob encomenda.
              </Texto>
              <Pressable onPress={() => Linking.openURL(zap)} accessibilityRole="link" style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: wash(t.ink, 0.16), backgroundColor: t.bg2, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name="whatsapp" size={15} color={t.ink} />
                <Texto style={{ fontSize: 14, fontWeight: "600", color: t.ink }}>Perguntar no WhatsApp</Texto>
              </Pressable>
            </View>
          ) : <View style={{ height: desktop ? 56 : 40 }} />}
        </View>
        <RodapeDaVitrine store={store} variante="nova" onAbrirCategoria={(porta) => abrirCategoria(sf, (store?.categories || []).find((c: any) => String(c.id) === porta.id))} />
      </ScrollView>
      <CamadasDaNavegacao sf={sf} camadas={camadas} desktop={desktop} />
      <BarraDeCookies />
    </View>
  );
}
