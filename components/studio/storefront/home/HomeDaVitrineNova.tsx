// ============================================================
// components/studio/storefront/home/HomeDaVitrineNova.tsx
//
// A home nova da vitrine Studio (Fase 5 · Home e navegação), atrás da
// chave `vitrine_v2`. Especificação visual: docs/mockups/
// studio-vitrine-05-home.html, telas 1, 2, 3 e 6. Sem a chave, a home de
// hoje (ProductList.tsx) fica intocada.
//
// A ordem é a da home de hoje (HomeDaVitrine.tsx), com as decisões do PO
// de 25/09: sai a tira "O que a gente personaliza" (a barra presa e a
// grade agrupada já levam às categorias), a faixa de números entra nos
// selos. Cada bloco nasce da configuração ou do que a loja pode provar,
// ou não existe (regrasDaHome.ts, blocosDaHome.ts).
//
// Não entram (JORNADA §4.2 e §5): "últimas unidades", "mais vendidos em
// 90 dias", filtros laterais de tamanho/cor/preço e paginação de 24.
// ============================================================
import { useCallback, useMemo, useRef, useState } from "react";
import { Image, Linking, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import type { StorefrontState } from "../useStorefront";
import { useTemaDaVitrine } from "../TemaDaVitrine";
import { Texto, Numero, useTipografia } from "../TipografiaVitrine";
import { Icon } from "@/components/Icon";
import { dinheiro } from "../moeda";
import { precoNoPix } from "../precoNoPix";
import { ProductCard } from "../ProductCard";
import { fotosDoGrupo, fotosDoProduto } from "../CarrosselFoto";
import { precoMinimo } from "../categoryGrouping";
import { seloDoProduto, chipsDoProduto, linhaDeEscada, pecaMaisPedida } from "../selosDoProduto";
import { maisPedidos, passosDaLoja } from "../blocosDaHome";
import { AncoraWhatsApp } from "../AncoraWhatsApp";
import { BarraDeCookies } from "../ConsentimentoDaVitrine";
import { RodapeDaVitrine } from "../RodapeDaVitrine";
import { FaixaDaTemporada } from "../FaixaDaTemporada";
import { Botao, Rotulo, Selo, sombraWeb, transicao } from "../produto/kitDaPagina";
import { abrirCategoria, linkDoWhatsApp, useCamadas, CabecalhoDaVitrine, CamadasDaNavegacao } from "./NavegacaoDaVitrine";
import { HeroDaPeca, HeroDeBanners } from "./HeroDaHome";
import {
  artesDaHome, bannersDaHome, blocoParaEmpresas, descontoDoPix, gradeDaHome, itensDaFaixa, mostrarTirarDuvida,
  selosDaHome, type ArteDaHome,
} from "./regrasDaHome";

const LARGURA_MAX = 1120;
/** A partir daqui o layout é o do desktop (o mesmo corte da Fase 3). */
export const LARGURA_DO_DESKTOP = 900;

// ── Faixa de anúncio ─────────────────────────────────────────

/**
 * Parada, sem letreiro (decisão já registrada em HomeDaVitrine.tsx): os
 * itens com um visto, quebrando inteiros no celular.
 */
export function FaixaDeAnuncio({ itens, desktop }: { itens: string[]; desktop: boolean }) {
  const t = useTemaDaVitrine();
  if (!itens.length) return null;
  return (
    <View
      testID="faixa-de-anuncio"
      accessibilityRole={"note" as any}
      style={{
        backgroundColor: t.marcaFill, paddingVertical: desktop ? 10 : 8, paddingHorizontal: desktop ? 24 : 16,
        flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: desktop ? 28 : 16, rowGap: 2,
      }}
    >
      {itens.map((a, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="check" size={12} color={t.sobreMarca} />
          <Numero style={{ fontSize: desktop ? 11 : 10.5, lineHeight: 17, letterSpacing: 0.9, textTransform: "uppercase", fontWeight: "500", color: t.sobreMarca }}>
            {a}
          </Numero>
        </View>
      ))}
    </View>
  );
}

// ── Seção ────────────────────────────────────────────────────

function Secao({
  etiqueta, titulo, direita, desktop, linha = true, children, testID, onLayout,
}: {
  etiqueta?: string;
  titulo?: string;
  direita?: React.ReactNode;
  desktop: boolean;
  linha?: boolean;
  children: React.ReactNode;
  testID?: string;
  onLayout?: (e: any) => void;
}) {
  const t = useTemaDaVitrine();
  const tipo = useTipografia();
  return (
    <View testID={testID} onLayout={onLayout} style={{ borderTopWidth: linha ? 1 : 0, borderTopColor: t.border }}>
      <View style={{ width: "100%", maxWidth: LARGURA_MAX, alignSelf: "center", paddingHorizontal: desktop ? 0 : 16, paddingVertical: desktop ? 72 : 40, gap: 20 }}>
        {etiqueta || titulo ? (
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
            <View style={{ gap: 8, flexShrink: 1 }}>
              {etiqueta ? <Rotulo>{etiqueta}</Rotulo> : null}
              {titulo ? (
                <Texto accessibilityRole="header" style={{ fontFamily: tipo.display, fontSize: desktop ? 36 : 26, lineHeight: desktop ? 40 : 30, letterSpacing: -0.3, color: t.ink }}>
                  {titulo}
                </Texto>
              ) : null}
            </View>
            {direita}
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );
}

function Quadradinho({ icone, redondo, tamanho = 44 }: { icone: string; redondo?: boolean; tamanho?: number }) {
  const t = useTemaDaVitrine();
  return (
    <View style={{ width: tamanho, height: tamanho, borderRadius: redondo ? tamanho / 2 : 12, backgroundColor: t.marcaWashForte, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Icon name={icone as any} size={20} color={t.marcaTexto} />
    </View>
  );
}

// ── Como funciona ────────────────────────────────────────────

const ICONES_DOS_PASSOS = ["edit", "whatsapp", "box"];

function ComoFunciona({ sf, desktop }: { sf: StorefrontState; desktop: boolean }) {
  const t = useTemaDaVitrine();
  const passos = passosDaLoja(sf.store as any);
  return (
    <Secao testID="como-funciona" etiqueta="Como funciona" titulo="Três passos até o presente pronto" desktop={desktop} linha={false}>
      <View style={{ flexDirection: desktop ? "row" : "column", gap: desktop ? 20 : 10 }}>
        {passos.map((p, i) => (
          <View
            key={p.n}
            style={{
              flex: desktop ? 1 : undefined, backgroundColor: t.bg2, borderRadius: 14, borderWidth: 1, borderColor: t.border,
              padding: desktop ? 26 : 16, gap: desktop ? 16 : 14, flexDirection: desktop ? "column" : "row", alignItems: "flex-start",
            }}
          >
            <Quadradinho icone={ICONES_DOS_PASSOS[i] || "check"} />
            <View style={{ flex: desktop ? undefined : 1, gap: 4 }}>
              <Numero style={{ fontSize: 11, letterSpacing: 1.3, fontWeight: "500", color: t.marcaTexto }}>{"0" + p.n}</Numero>
              <Texto style={{ fontSize: desktop ? 17 : 15.5, fontWeight: "600", color: t.ink }}>{p.titulo}</Texto>
              <Texto style={{ fontSize: 13.5, lineHeight: 20, color: t.ink2 }}>{p.curto ?? p.texto}</Texto>
              {p.prazo ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", marginTop: 8, height: 24, paddingHorizontal: 9, borderRadius: 999, backgroundColor: t.bg3 }}>
                  <Icon name="clock" size={12} color={t.ink} />
                  <Numero style={{ fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", fontWeight: "500", color: t.ink }}>{p.prazo}</Numero>
                </View>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </Secao>
  );
}

// ── A grade agrupada ─────────────────────────────────────────

function GradeDaHome({ sf, desktop, largura, onLayout }: { sf: StorefrontState; desktop: boolean; largura: number; onLayout?: (e: any) => void }) {
  const t = useTemaDaVitrine();
  const tipo = useTipografia();
  const store: any = sf.store;
  const estilo = ((store?.site?.card_style || "editorial") as "editorial" | "minimal" | "image-heavy");
  const colunas = desktop ? 3 : largura >= 640 ? 3 : 2;
  const gap = desktop ? 22 : 12;
  const util = Math.min(largura, LARGURA_MAX) - (desktop ? 0 : 32);
  const larguraCartao = Math.floor((util - gap * (colunas - 1)) / colunas);
  const campea = pecaMaisPedida(store?.products || []);
  const pix = descontoDoPix(store);
  const total = (store?.products || []).length;

  if (!total) {
    return (
      <Secao desktop={desktop} onLayout={onLayout}>
        <View style={{ paddingVertical: 24, alignItems: "center", gap: 10 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.bg3, alignItems: "center", justifyContent: "center" }}>
            <Icon name="package" size={26} color={t.ink3} />
          </View>
          <Texto style={{ fontFamily: tipo.display, fontSize: 22, color: t.ink, textAlign: "center" }}>A vitrine está sendo arrumada</Texto>
          <Texto style={{ fontSize: 14, color: t.ink2, textAlign: "center", maxWidth: 340 }}>As peças personalizáveis desta loja ainda não foram publicadas. Volte em breve.</Texto>
        </View>
      </Secao>
    );
  }

  return (
    <Secao
      testID="grade-da-home"
      onLayout={onLayout}
      etiqueta="A loja"
      titulo="Escolha a peça. A arte é sua."
      desktop={desktop}
      direita={desktop ? <Numero style={{ fontSize: 12.5, color: t.ink3 }}>{total} {total === 1 ? "peça" : "peças"}</Numero> : null}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
        {gradeDaHome(store).map((e) => {
          if (e.kind === "category") {
            const min = precoMinimo(e.products);
            return (
              <ProductCard
                key={"cat-" + e.category.id}
                nome={e.category.name}
                preco={min}
                precoPix={precoNoPix(min, pix)}
                fotos={fotosDoGrupo(e.products)}
                selo={`${e.products.length} modelos para escolher`}
                largura={larguraCartao}
                corDaLoja={store?.site?.primary_color}
                fonteDisplay={tipo.display}
                estilo={estilo}
                onPress={() => abrirCategoria(sf, e.category) || sf.abrirGrupo(e.category, e.products)}
              />
            );
          }
          const p = e.product;
          return (
            <ProductCard
              key={p.id}
              nome={p.name}
              preco={Number(p.price)}
              precoPix={precoNoPix(Number(p.price), pix)}
              fotos={fotosDoProduto((p as any).gallery_urls, p.image_url)}
              descricao={p.description}
              largura={larguraCartao}
              corDaLoja={store?.site?.primary_color}
              fonteDisplay={tipo.display}
              estilo={estilo}
              destaque={seloDoProduto(p, campea)}
              chips={chipsDoProduto(p)}
              escada={linhaDeEscada(p)}
              onPress={() => sf.openConfigure(p)}
            />
          );
        })}
      </View>
    </Secao>
  );
}

// ── Os queridinhos ───────────────────────────────────────────

function Queridinhos({ sf, desktop, largura, onLayout }: { sf: StorefrontState; desktop: boolean; largura: number; onLayout?: (e: any) => void }) {
  const t = useTemaDaVitrine();
  const store: any = sf.store;
  const lista = maisPedidos(store?.products || []);
  if (!lista.length) return null;
  const campea = pecaMaisPedida(store?.products || []);
  const pix = descontoDoPix(store);
  const lado = desktop ? Math.floor((Math.min(largura, LARGURA_MAX) - 22 * 3) / 4) : Math.round(largura * 0.58);
  const itens = lista.map((p) => {
    const foto = fotosDoProduto((p as any).gallery_urls, p.image_url)[0];
    const noPix = precoNoPix(Number(p.price), pix);
    return (
      <Pressable key={p.id} onPress={() => sf.openConfigure(p)} accessibilityRole="button" accessibilityLabel={`${p.name}, ${dinheiro(Number(p.price))}`} style={{ width: lado, gap: 8 }}>
        {({ hovered }: any) => (
          <>
            <View style={[{ width: lado, height: lado, borderRadius: 14, overflow: "hidden", backgroundColor: t.bg3 }, hovered ? ({ transform: [{ translateY: -2 }] } as any) : null, transicao("transform")]}>
              {foto ? <Image source={{ uri: foto }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
              {p.id === campea ? <View style={{ position: "absolute", top: 10, left: 10 }}><Selo texto="Mais pedido" /></View> : null}
            </View>
            <Texto numberOfLines={2} style={{ fontSize: 14, fontWeight: "500", lineHeight: 18, color: t.ink }}>{p.name}</Texto>
            <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 8 }}>
              <Numero style={{ fontSize: 14, fontWeight: "600", color: t.ink }}>{dinheiro(Number(p.price))}</Numero>
              {noPix != null ? <Texto style={{ fontSize: 12.5, fontWeight: "600", color: t.green }}>{dinheiro(noPix)} no Pix</Texto> : null}
            </View>
          </>
        )}
      </Pressable>
    );
  });
  return (
    <Secao testID="queridinhos" onLayout={onLayout} etiqueta="Mais pedidos" titulo={`Os queridinhos da ${store?.site?.name || "loja"}`} desktop={desktop}>
      {desktop ? (
        <View style={{ flexDirection: "row", gap: 22 }}>{itens}</View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 6 }} snapToInterval={lado + 12} decelerationRate="fast">
          {itens}
        </ScrollView>
      )}
    </Secao>
  );
}

// ── Artes da loja ────────────────────────────────────────────

/** Abre a peça com a arte pronta já aplicada (pergunta e do mockup). */
export function abrirComArte(sf: StorefrontState, arte: ArteDaHome) {
  sf.openConfigure(arte.produto);
  // Depois de abrir: openConfigure começa os valores do zero (e a cor
  // da louça na primeira), e este toque entra por cima deles.
  sf.setFieldValue(arte.campoId, arte.valor);
}

function ArtesDaLoja({ sf, desktop }: { sf: StorefrontState; desktop: boolean }) {
  const t = useTemaDaVitrine();
  const artes = artesDaHome((sf.store as any)?.products || [], desktop ? 6 : 6);
  if (!artes.length) return null;
  return (
    <Secao testID="artes-da-loja" etiqueta="Artes da loja" titulo="Não tem arte pronta? Escolha uma das nossas" desktop={desktop}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: desktop ? 16 : 10 }}>
        {artes.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => abrirComArte(sf, a)}
            accessibilityRole="button"
            accessibilityLabel={`${a.nome}: abrir ${a.produto.name} com esta arte`}
            style={{ width: desktop ? `${(100 - 5 * 1.5) / 6}%` as any : "31%", gap: 6 }}
          >
            {({ hovered }: any) => (
              <>
                <View style={[{ aspectRatio: 1, borderRadius: 10, backgroundColor: t.bg2, borderWidth: 1, borderColor: hovered ? t.marcaTexto : t.border, alignItems: "center", justifyContent: "center", overflow: "hidden" }, hovered ? ({ transform: [{ translateY: -2 }] } as any) : null, hovered ? sombraWeb(2) : null, transicao("transform, border-color")]}>
                  <Image source={{ uri: a.imagem }} style={{ width: "82%", height: "82%" }} resizeMode="contain" accessibilityIgnoresInvertColors />
                </View>
                <Texto numberOfLines={1} style={{ fontSize: 12.5, color: t.ink2 }}>{a.nome}</Texto>
              </>
            )}
          </Pressable>
        ))}
      </View>
    </Secao>
  );
}

// ── Para empresas ────────────────────────────────────────────

function ParaEmpresas({ sf, desktop }: { sf: StorefrontState; desktop: boolean }) {
  const t = useTemaDaVitrine();
  const tipo = useTipografia();
  const store: any = sf.store;
  const b = useMemo(() => blocoParaEmpresas(store), [store]);
  if (!(store?.products || []).length) return null;
  const zap = linkDoWhatsApp(store?.site?.whatsapp, "Olá! Queria um orçamento para uma empresa ou evento.");
  const leque = b.fotos.slice(0, desktop ? 5 : 4);
  return (
    <Secao testID="para-empresas" desktop={desktop}>
      <View style={{ borderRadius: 20, backgroundColor: t.marcaWash, borderWidth: 1, borderColor: t.marcaWashForte, padding: desktop ? 48 : 20, paddingHorizontal: desktop ? 52 : 20, flexDirection: desktop ? "row" : "column", alignItems: desktop ? "center" : "stretch", gap: desktop ? 40 : 18, overflow: "hidden" }}>
        <View style={{ flex: desktop ? 1.08 : undefined, gap: 12, alignItems: "flex-start" }}>
          <Rotulo cor={t.marcaTexto}>Para empresas e eventos</Rotulo>
          <Texto accessibilityRole="header" style={{ fontFamily: tipo.display, fontSize: desktop ? 34 : 25, lineHeight: desktop ? 38 : 29, color: t.ink, letterSpacing: -0.3 }}>{b.titulo}</Texto>
          <Texto style={{ fontSize: 14, lineHeight: 21, color: t.ink2, maxWidth: 480 }}>
            Cole a lista de nomes. Cada linha vira uma peça personalizada, o desconto por quantidade cai sozinho e você recebe um mockup por pessoa para aprovar.
          </Texto>
          {b.degraus.length ? (
            <View style={{ flexDirection: "row", gap: 8, width: desktop ? undefined : "100%" }}>
              {b.degraus.map((d) => (
                <View key={d.minimo} style={{ flex: desktop ? undefined : 1, minWidth: desktop ? 120 : 0, backgroundColor: t.bg2, borderWidth: 1, borderColor: t.border, borderRadius: 12, paddingVertical: desktop ? 10 : 8, paddingHorizontal: desktop ? 14 : 10, gap: 1 }}>
                  <Numero style={{ fontSize: 10.5, letterSpacing: 0.8, textTransform: "uppercase", color: t.ink3 }}>{d.minimo}+ un</Numero>
                  <Numero style={{ fontSize: 14, fontWeight: "500", color: t.ink }}>{dinheiro(d.preco)}</Numero>
                  <Texto style={{ fontSize: 12, fontWeight: "600", color: t.marcaTexto }}>−{d.pct}% cada</Texto>
                </View>
              ))}
            </View>
          ) : null}
          {b.legenda ? <Texto style={{ fontSize: 12.5, lineHeight: 18, color: t.ink3 }}>{b.legenda}</Texto> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4, width: desktop ? undefined : "100%" }}>
            <Botao rotulo="Pedir orçamento em lote" icone="users" onPress={() => sf.goTo("lote")} estilo={desktop ? undefined : { width: "100%" }} />
            {zap ? <Botao tipo="fantasma" rotulo="Prefiro falar no WhatsApp" onPress={() => Linking.openURL(zap)} estilo={desktop ? undefined : { width: "100%" }} /> : null}
          </View>
        </View>
        {leque.length >= 2 ? (
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flex: desktop ? 1 : undefined, height: desktop ? 300 : 150 }}>
            {leque.map((f, i) => {
              const meio = (leque.length - 1) / 2;
              const dist = Math.abs(i - meio);
              const escala = 1 - dist * 0.07;
              const larg = desktop ? 32 : 30;
              const esquerda = leque.length === 1 ? 35 : (i * (100 - larg)) / (leque.length - 1);
              return (
                <View key={f + i} style={[{ position: "absolute", bottom: 0, left: `${esquerda}%` as any, width: `${larg}%` as any, aspectRatio: 0.8, zIndex: 10 - Math.round(dist * 2), borderRadius: 14, overflow: "hidden", backgroundColor: t.bg3, borderWidth: 2, borderColor: t.bg2, transform: [{ scale: escala }] }, sombraWeb(2)]}>
                  <Image source={{ uri: f }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityIgnoresInvertColors />
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    </Secao>
  );
}

// ── Selos de confiança ───────────────────────────────────────

function Selos({ sf, desktop }: { sf: StorefrontState; desktop: boolean }) {
  const t = useTemaDaVitrine();
  const selos = selosDaHome(sf.store as any);
  if (!selos.length) return null;
  return (
    <Secao testID="selos-de-confianca" desktop={desktop}>
      <Texto style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0 }}>Por que comprar aqui</Texto>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: desktop ? 16 : 10 }}>
        {selos.map((s) => (
          <View
            key={s.titulo + s.texto}
            style={{
              width: desktop ? `${(100 - 3 * 1.5) / 4}%` as any : "48.5%", flexGrow: desktop ? 1 : 0,
              flexDirection: desktop ? "row" : "column", gap: desktop ? 14 : 10, padding: desktop ? 20 : 16,
              borderRadius: 14, backgroundColor: t.bg2, borderWidth: 1, borderColor: t.border,
            }}
          >
            <Quadradinho icone={s.icone} redondo tamanho={40} />
            <View style={{ flex: desktop ? 1 : undefined, gap: 2 }}>
              <Texto style={{ fontSize: 14, fontWeight: "600", color: t.ink }}>{s.titulo}</Texto>
              {s.texto ? <Texto style={{ fontSize: 12.5, lineHeight: 18, color: t.ink2 }}>{s.texto}</Texto> : null}
            </View>
          </View>
        ))}
      </View>
    </Secao>
  );
}

// ── A página ─────────────────────────────────────────────────

export function HomeDaVitrineNova({ sf, slug }: { sf: StorefrontState; slug: string }) {
  const t = useTemaDaVitrine();
  const { width, height } = useWindowDimensions();
  const desktop = width >= LARGURA_DO_DESKTOP;
  const store: any = sf.store;
  const camadas = useCamadas();
  const rolagem = useRef<ScrollView | null>(null);
  const posicoes = useRef<{ grade: number; queridinhos: number; cabecalho: number }>({ grade: 0, queridinhos: 0, cabecalho: 0 });
  const [fimDoTopo, setFimDoTopo] = useState(0);
  const [y, setY] = useState(0);

  const banners = useMemo(() => bannersDaHome(store), [store]);
  const itens = useMemo(() => itensDaFaixa(store), [store]);

  const rolarPara = useCallback((onde: "grade" | "queridinhos") => {
    const alvo = posicoes.current[onde] || posicoes.current.grade;
    rolagem.current?.scrollTo({ y: Math.max(0, alvo - posicoes.current.cabecalho + 1), animated: true });
  }, []);
  const verLoja = useCallback(() => rolarPara("grade"), [rolarPara]);

  const zapVisivel = mostrarTirarDuvida({ rolagem: y, fimDoTopo, alturaDaTela: height });
  // A margem livre à direita do conteúdo (1120 px no centro). A pílula
  // "Tirar dúvida" (~150 px) só quando cabe inteira nela; senão o círculo
  // — no desktop, centrado na margem, fora do conteúdo.
  const margem = desktop ? Math.max(0, (width - LARGURA_MAX) / 2) : 0;
  const cabeNaMargem = margem >= 190;
  // Só os limiares importam para a tela: evita um render por quadro.
  const aoRolar = (e: any) => {
    const novo = e?.nativeEvent?.contentOffset?.y || 0;
    const antes = y;
    if ((novo > 4) !== (antes > 4) || mostrarTirarDuvida({ rolagem: novo, fimDoTopo, alturaDaTela: height }) !== zapVisivel) setY(novo);
  };

  return (
    <View testID="home-da-vitrine-nova" style={{ flex: 1, backgroundColor: t.bg }}>
      <FaixaDaTemporada store={store} lugar="topo" />
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={rolagem}
          style={{ flex: 1 }}
          stickyHeaderIndices={[1]}
          scrollEventThrottle={32}
          onScroll={aoRolar}
          
        >
          <FaixaDeAnuncio itens={itens} desktop={desktop} />
          <View onLayout={(e) => { posicoes.current.cabecalho = e.nativeEvent.layout.height; }} style={{ zIndex: 20 }}>
            <CabecalhoDaVitrine sf={sf} desktop={desktop} camadas={camadas} rolou={y > 4} onVerLoja={verLoja} />
          </View>
          <View onLayout={(e) => setFimDoTopo(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
            {banners.length ? (
              <HeroDeBanners sf={sf} banners={banners} largura={width} desktop={desktop} rolarPara={rolarPara} />
            ) : (
              <HeroDaPeca sf={sf} slug={slug} desktop={desktop} onVerLoja={verLoja} />
            )}
          </View>
          <ComoFunciona sf={sf} desktop={desktop} />
          <GradeDaHome sf={sf} desktop={desktop} largura={width} onLayout={(e) => { posicoes.current.grade = e.nativeEvent.layout.y; }} />
          <Queridinhos sf={sf} desktop={desktop} largura={width} onLayout={(e) => { posicoes.current.queridinhos = e.nativeEvent.layout.y; }} />
          <ArtesDaLoja sf={sf} desktop={desktop} />
          <ParaEmpresas sf={sf} desktop={desktop} />
          <Selos sf={sf} desktop={desktop} />
          <RodapeDaVitrine store={store} variante="nova" onAbrirCategoria={(porta) => {
            const c = (store?.categories || []).find((x: any) => String(x.id) === porta.id);
            abrirCategoria(sf, c);
          }} />
          {/* A folga do fim (o "Tirar dúvida" não cobre a assinatura) no tom do rodapé. */}
          <View style={{ height: 96, backgroundColor: t.bg3 }} />
        </ScrollView>
        {zapVisivel && !camadas.aberta ? (
          <AncoraWhatsApp
            numero={store?.site?.whatsapp}
            nomeDaLoja={store?.site?.name}
            corDaLoja={store?.site?.primary_color}
            compacto={!cabeNaMargem}
            direita={cabeNaMargem ? 16 : desktop ? Math.max(12, Math.round((margem - 56) / 2)) : 16}
          />
        ) : null}
        <CamadasDaNavegacao sf={sf} camadas={camadas} desktop={desktop} onVerLoja={verLoja} />
      </View>
      <BarraDeCookies />
    </View>
  );
}
