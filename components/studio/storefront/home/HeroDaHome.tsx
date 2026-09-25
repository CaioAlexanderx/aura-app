// ============================================================
// components/studio/storefront/home/HeroDaHome.tsx
//
// O destaque do topo da home nova (mockup 05, telas 1 e 2):
//
// COM BANNER — até 3 girando a cada 6 s. A bolinha ativa enche como
// barra de progresso. Para no toque, no mouse por cima e no foco do
// teclado; o botão de pausa segura de vez; com "reduzir movimento" não
// gira sozinho. Setas só no desktop; no celular, arrastar. Arte própria
// do celular quando há (`image_url_mobile`). Arte pronta (sem texto nosso
// e com destino) é o banner inteiro como link, sem véu. O botão leva ao
// destino interno (`#cat=`, `#vista=`) como na loja Negócio.
//
// SEM BANNER — o título da loja e, ao lado (embaixo no celular), a peça
// do destaque com o mockup e as artes trocando sozinhas. A peça é a
// escolhida na aba Design ou a primeira com prévia 3D (decisão 10 do
// PO). O 3D entra só depois que o motor carrega: até lá, e quando ele
// não carrega (sem rede para a CDN do three.js), a foto da peça com a
// arte ao lado — nunca o erro vermelho do visualizador no topo da loja.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Platform, Pressable, View } from "react-native";
import type { StorefrontState } from "../useStorefront";
import type { StudioStoreProduct } from "../types";
import { useTemaDaVitrine } from "../TemaDaVitrine";
import { Texto, Numero, useTipografia } from "../TipografiaVitrine";
import { Icon } from "@/components/Icon";
import { wash, SOBRE_FOTO } from "../theme";
import { dinheiro } from "../moeda";
import { precoNoPix } from "../precoNoPix";
import { useReduzirMovimento } from "../movimento";
import { LivePreview } from "../LivePreview";
import { artFontStack } from "@/constants/fonts";
import { loadThree } from "@/components/studio/visualEngine/threeLoader";
import { Botao, Rotulo, Selo, sombraWeb, transicao } from "../produto/kitDaPagina";
import { MarcaDaLoja, irParaDestino } from "./NavegacaoDaVitrine";
import {
  SEGUNDOS_POR_BANNER, TROCA_DA_ARTE_MS, alturaDoHero, arteGira, artesDoDestaque, bannerGira,
  conviteDaPeca, descontoDoPix, fraseDoDestaque, lugarDaLoja, pecaDoDestaque, proximoBanner,
  type BannerDaHome,
} from "./regrasDaHome";

/** O ícone de pausa/continuar (o conjunto do app não tem pausa). */
export function GlifoDePausa({ cor, pausado }: { cor: string; pausado: boolean }) {
  if (pausado) return <Icon name="play_circle" size={18} color={cor} />;
  return (
    <View style={{ flexDirection: "row", gap: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ width: 2.5, height: 12, borderRadius: 1, backgroundColor: cor }} />
      <View style={{ width: 2.5, height: 12, borderRadius: 1, backgroundColor: cor }} />
    </View>
  );
}

const WEB = Platform.OS === "web";

// ── Com banner ───────────────────────────────────────────────

export function HeroDeBanners({
  sf, banners, largura, desktop, rolarPara,
}: {
  sf: StorefrontState;
  banners: BannerDaHome[];
  largura: number;
  desktop: boolean;
  rolarPara?: (onde: "grade" | "queridinhos") => void;
}) {
  const t = useTemaDaVitrine();
  const tipo = useTipografia();
  const reduzir = useReduzirMovimento();
  const [atual, setAtual] = useState(0);
  const [segurado, setSegurado] = useState(false);
  const [sobre, setSobre] = useState(false);
  const inicioDoToque = useRef<number | null>(null);
  const n = banners.length;
  const i = Math.min(atual, Math.max(0, n - 1));
  const altura = alturaDoHero(largura, desktop, banners);
  const gira = bannerGira({ total: n, pausado: segurado || sobre, reduzirMovimento: reduzir });

  useEffect(() => {
    if (!gira) return;
    const id = setTimeout(() => setAtual((x) => proximoBanner(x, n)), SEGUNDOS_POR_BANNER * 1000);
    return () => clearTimeout(id);
  }, [gira, i, n]);

  const recuo = desktop ? Math.max(96, Math.round((largura - 1120) / 2)) : 20;
  const ir = (passo: 1 | -1) => setAtual((x) => proximoBanner(x, n, passo));

  // Arrastar no celular: 40 px para o lado troca o banner.
  const toque: any = {
    onTouchStart: (e: any) => { setSobre(true); inicioDoToque.current = e?.nativeEvent?.touches?.[0]?.pageX ?? e?.nativeEvent?.pageX ?? null; },
    onTouchEnd: (e: any) => {
      const fim = e?.nativeEvent?.changedTouches?.[0]?.pageX ?? e?.nativeEvent?.pageX ?? null;
      if (inicioDoToque.current != null && fim != null && n > 1) {
        const dx = fim - inicioDoToque.current;
        if (Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1);
      }
      inicioDoToque.current = null;
      setSobre(false);
    },
  };
  const pausaWeb: any = WEB ? {
    onMouseEnter: () => setSobre(true),
    onMouseLeave: () => setSobre(false),
    onFocus: () => setSobre(true),
    onBlur: () => setSobre(false),
  } : {};

  return (
    <View
      testID="hero-de-banners"
      accessibilityRole={"region" as any}
      accessibilityLabel="Destaques da loja"
      style={[{ height: altura, backgroundColor: "#1A1714", overflow: "hidden" }, WEB ? ({ touchAction: "pan-y", userSelect: "none" } as any) : null]}
      {...pausaWeb}
      {...toque}
    >
      {banners.map((b, k) => (
        <Slide
          key={k}
          sf={sf}
          b={b}
          ativo={k === i}
          desktop={desktop}
          recuo={recuo}
          altura={altura}
          reduzir={reduzir}
          fonte={tipo.display}
          indice={k}
          total={n}
          rolarPara={rolarPara}
        />
      ))}

      {n > 1 && desktop ? (
        <>
          <SetaDoHero lado="esquerda" onPress={() => ir(-1)} />
          <SetaDoHero lado="direita" onPress={() => ir(1)} />
        </>
      ) : null}

      {n > 1 ? (
        <View
          style={[{
            position: "absolute", zIndex: 4, left: desktop ? recuo : 14, bottom: desktop ? 26 : 14,
            flexDirection: "row", alignItems: "center", paddingHorizontal: 2, borderRadius: 999,
            backgroundColor: "rgba(20,17,14,.42)",
          }, WEB ? ({ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" } as any) : null]}
        >
          {banners.map((_, k) => {
            const ativo = k === i;
            return (
              <Pressable
                key={k}
                onPress={() => setAtual(k)}
                accessibilityRole="button"
                accessibilityLabel={`Ir para o banner ${k + 1}`}
                accessibilityState={{ selected: ativo }}
                style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center" }}
              >
                <View style={[{ width: ativo ? 30 : 8, height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: ativo ? "rgba(255,255,255,.34)" : "rgba(255,255,255,.55)" }, transicao("width")]}>
                  {ativo ? (
                    <View
                      key={`${i}-${gira ? "g" : "p"}`}
                      style={[
                        { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: SOBRE_FOTO, width: "100%" },
                        WEB && !reduzir && n > 1 ? ({
                          animationKeyframes: [{ from: { width: "0%" }, to: { width: "100%" } }],
                          animationDuration: `${SEGUNDOS_POR_BANNER}s`,
                          animationTimingFunction: "linear",
                          animationFillMode: "forwards",
                          animationPlayState: gira ? "running" : "paused",
                        } as any) : null,
                      ]}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
          {!reduzir ? (
            <Pressable
              onPress={() => setSegurado((s) => !s)}
              accessibilityRole="button"
              accessibilityLabel={segurado ? "Continuar os banners" : "Pausar os banners"}
              style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
            >
              <GlifoDePausa cor={SOBRE_FOTO} pausado={segurado} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {n > 1 ? (
        <Numero
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: "absolute", zIndex: 4, right: desktop ? 24 : 18, bottom: desktop ? 34 : 28, fontSize: 11, letterSpacing: 1.5, color: "rgba(255,255,255,.8)" }}
        >
          {`${String(i + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`}
        </Numero>
      ) : null}
    </View>
  );
}

function SetaDoHero({ lado, onPress }: { lado: "esquerda" | "direita"; onPress: () => void }) {
  const t = useTemaDaVitrine();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={lado === "esquerda" ? "Banner anterior" : "Próximo banner"}
      style={({ hovered, pressed }: any) => [{
        position: "absolute", zIndex: 4, top: "50%", marginTop: -24,
        [lado === "esquerda" ? "left" : "right"]: 24,
        width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center",
        backgroundColor: hovered ? t.bg2 : wash(t.bg, 0.9),
        transform: [{ scale: pressed ? 0.96 : 1 }],
      }, sombraWeb(2)]}
    >
      <Icon name={lado === "esquerda" ? "chevron_left" : "chevron_right"} size={20} color={t.ink} />
    </Pressable>
  );
}

function Slide({
  sf, b, ativo, desktop, recuo, altura, reduzir, fonte, indice, total, rolarPara,
}: {
  sf: StorefrontState;
  b: BannerDaHome;
  ativo: boolean;
  desktop: boolean;
  recuo: number;
  altura: number;
  reduzir: boolean;
  fonte: string;
  indice: number;
  total: number;
  rolarPara?: (onde: "grade" | "queridinhos") => void;
}) {
  const t = useTemaDaVitrine();
  const arte = (!desktop && b.image_url_mobile) || b.image_url;
  // Arte pronta larga no celular sem versão própria, numa composição alta
  // (há outro banner com texto): a arte inteira, sem cortar o texto dela.
  const inteira = !desktop && !b.image_url_mobile && !b.comTexto && altura > 200;
  const fundoSemFoto = b.tint === "accent" ? t.ink : t.marcaFill;
  const tinta = arte ? SOBRE_FOTO : t.sobreMarca;
  const botao = b.comTexto && !!String(b.cta || "").trim() && !!b.destino;

  return (
    <View
      accessibilityElementsHidden={!ativo}
      importantForAccessibility={ativo ? "auto" : "no-hide-descendants"}
      aria-hidden={!ativo}
      aria-label={total > 1 ? `${indice + 1} de ${total}` : undefined}
      pointerEvents={ativo ? "auto" : "none"}
      style={[
        { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: ativo ? 1 : 0, backgroundColor: arte ? "#1A1714" : fundoSemFoto },
        reduzir ? null : transicao("opacity", 600),
      ]}
    >
      {arte ? (
        <Image
          source={{ uri: arte }}
          resizeMode={inteira ? "contain" : "cover"}
          accessibilityIgnoresInvertColors
          style={[
            { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
            ativo && WEB && !reduzir ? ({
              animationKeyframes: [{ from: { transform: [{ scale: 1.035 }] }, to: { transform: [{ scale: 1 }] } }],
              animationDuration: "9s", animationFillMode: "both", animationTimingFunction: "cubic-bezier(.4,0,.2,1)",
            } as any) : null,
          ]}
        />
      ) : null}

      {b.soLink ? (
        <Pressable
          onPress={() => irParaDestino(sf, b.destino, rolarPara)}
          accessibilityRole="link"
          accessibilityLabel={b.rotulo}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 2 }}
        />
      ) : null}

      {b.comTexto ? (
        <>
          {arte ? (
            <View
              pointerEvents="none"
              style={[
                { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
                WEB
                  ? ({ backgroundImage: desktop
                      ? "linear-gradient(90deg,rgba(20,17,14,.74) 0%,rgba(20,17,14,.44) 36%,rgba(20,17,14,0) 60%)"
                      : "linear-gradient(0deg,rgba(20,17,14,.86) 0%,rgba(20,17,14,.55) 34%,rgba(20,17,14,0) 58%)" } as any)
                  : { backgroundColor: "rgba(20,17,14,.45)" },
              ]}
            />
          ) : null}
          <View
            style={[
              { position: "absolute", zIndex: 2, alignItems: "flex-start" },
              desktop
                ? { left: recuo, top: 0, bottom: 0, justifyContent: "center", maxWidth: 460, gap: 10, paddingBottom: 30 }
                : { left: 20, right: 20, bottom: 76, gap: 8 },
            ]}
          >
            {String(b.kicker || "").trim() ? (
              <Numero style={{ fontSize: 11, lineHeight: 13, letterSpacing: 1.8, textTransform: "uppercase", color: arte ? "rgba(255,255,255,.84)" : wash(tinta, 0.84) }}>
                {b.kicker}
              </Numero>
            ) : null}
            {String(b.headline || "").trim() ? (
              <Texto accessibilityRole="header" style={{ fontFamily: fonte, color: tinta, fontSize: desktop ? 48 : 32, lineHeight: desktop ? 50 : 34, letterSpacing: -0.6 }}>
                {b.headline}
              </Texto>
            ) : null}
            {String(b.body || "").trim() ? (
              <Texto style={{ color: arte ? "rgba(255,255,255,.9)" : tinta, fontSize: desktop ? 16 : 14.5, lineHeight: desktop ? 24 : 22, maxWidth: 420 }}>
                {b.body}
              </Texto>
            ) : null}
            {botao ? (
              <Pressable
                onPress={() => irParaDestino(sf, b.destino, rolarPara)}
                accessibilityRole={b.destino?.tipo === "externo" ? "link" : "button"}
                style={({ hovered, pressed }: any) => [{
                  marginTop: 10, minHeight: 48, paddingHorizontal: 20, borderRadius: 12,
                  flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.bg2,
                  transform: [{ translateY: hovered ? -1 : 0 }, { scale: pressed ? 0.98 : 1 }],
                }, WEB ? ({ boxShadow: "0 10px 24px -12px rgba(0,0,0,.6)" } as any) : null, transicao("transform")]}
              >
                <Texto style={{ fontSize: 15, fontWeight: "600", color: t.ink }}>{b.cta}</Texto>
                <Icon name={b.destino?.tipo === "externo" ? "external_link" : "arrow_right"} size={16} color={t.ink} />
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );
}

// ── Sem banner: a peça do destaque ───────────────────────────

/** O motor 3D carregou? Só tenta com a peça 3D, no web; cai fora sozinho. */
function useMotor3D(quer: boolean): boolean {
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    if (!quer || !WEB || typeof document === "undefined") return;
    let vivo = true;
    // O loader baixa o three.js da CDN só quando chamado (e uma vez só:
    // o motor da página do produto reaproveita o mesmo carregamento).
    loadThree()
      .then(() => { if (vivo) setPronto(true); })
      .catch(() => { /* sem 3D: fica a foto */ });
    return () => { vivo = false; };
  }, [quer]);
  return pronto;
}

/** A arte da vez, ao lado da foto, quando o 3D não está na tela. */
function CartaoDaArte({ values, produto }: { values: Record<string, any>; produto: StudioStoreProduct }) {
  const t = useTemaDaVitrine();
  const campos: any[] = (produto.customization_config as any)?.fields || [];
  const tpl = campos.find((f) => f.type === "template" && values[f.id]);
  const txt = campos.find((f) => f.type === "text" && values[f.id]);
  if (!tpl && !txt) return null;
  return (
    <View
      style={[{
        backgroundColor: t.bg2, borderRadius: 14, borderWidth: 1, borderColor: t.border,
        paddingVertical: 10, paddingHorizontal: 14, alignItems: "center", justifyContent: "center",
        minWidth: 120, maxWidth: 190, transform: [{ rotate: "-3deg" }],
      }, sombraWeb(2)]}
    >
      {tpl ? (
        <Image source={{ uri: values[tpl.id] }} style={{ width: 96, height: 96 }} resizeMode="contain" accessibilityIgnoresInvertColors />
      ) : (
        <Texto numberOfLines={2} style={{ fontFamily: artFontStack(txt?.config?.fonts?.[0]), fontSize: 24, lineHeight: 30, color: txt?.config?.colors?.[0] || t.ink, textAlign: "center" }}>
          {values[txt.id]}
        </Texto>
      )}
    </View>
  );
}

export function HeroDaPeca({
  sf, slug, desktop, onVerLoja,
}: {
  sf: StorefrontState;
  slug: string;
  desktop: boolean;
  onVerLoja: () => void;
}) {
  const t = useTemaDaVitrine();
  const tipo = useTipografia();
  const reduzir = useReduzirMovimento();
  const store: any = sf.store;
  const site = store?.site || {};
  const destaque = useMemo(() => pecaDoDestaque(store), [store]);
  const produto = destaque?.produto || null;
  const artes = useMemo(() => artesDoDestaque(produto, site.name), [produto, site.name]);
  const [k, setK] = useState(0);
  const [segurado, setSegurado] = useState(false);
  const [escolheu, setEscolheu] = useState(false);
  const gira = arteGira({ total: artes.length, pausado: segurado || escolheu, reduzirMovimento: reduzir });
  useEffect(() => {
    if (!gira) return;
    const id = setTimeout(() => setK((x) => (x + 1) % artes.length), TROCA_DA_ARTE_MS);
    return () => clearTimeout(id);
  }, [gira, k, artes.length]);
  const eh3D = produto?.visual_kind === "model3d";
  const motor = useMotor3D(!!produto && eh3D);
  const usaMotor = !!produto && ((eh3D && motor) || produto.visual_kind === "photo2d");

  const dias = Number(store?.sla?.total_estimate_days) || 0;
  const pix = descontoDoPix(store);
  const lugar = lugarDaLoja(site.endereco);
  const nomeDaCategoria = produto?.category_id
    ? (store?.categories || []).find((c: any) => String(c.id) === String(produto.category_id))?.name
    : produto?.category;
  const convite = conviteDaPeca(nomeDaCategoria);
  const values = artes[Math.min(k, Math.max(0, artes.length - 1))]?.values || {};
  const ladoDoPalco = desktop ? 470 : 318;
  const tamanhoDoMotor = desktop ? 400 : 250;

  const ctas = (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, width: desktop ? undefined : "100%" }}>
      {produto ? (
        <Botao rotulo={convite} icone="edit" onPress={() => sf.openConfigure(produto)} estilo={desktop ? undefined : { flexGrow: 1 }} />
      ) : null}
      {/* No celular os dois dividem a linha quando cabem; o convite longo
          ("Personalizar uma caneca") empurra o outro para baixo, inteiro. */}
      <Botao tipo="secundario" rotulo="Ver a loja toda" onPress={onVerLoja} estilo={desktop ? undefined : { flexGrow: 1 }} />
    </View>
  );
  const fatos = (
    <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 18, rowGap: 8 }}>
      {dias > 0 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="clock" size={15} color={t.marcaTexto} />
          <Texto style={{ fontSize: 13, color: t.ink2 }}>Pronto em {dias} {dias === 1 ? "dia útil" : "dias úteis"}</Texto>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name="eye" size={15} color={t.marcaTexto} />
        <Texto style={{ fontSize: 13, color: t.ink2 }}>Você aprova antes</Texto>
      </View>
      {pix > 0 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="pix" size={15} color={t.green} />
          <Texto style={{ fontSize: 13, color: t.ink2 }}>{String(pix).replace(".", ",")}% no Pix</Texto>
        </View>
      ) : null}
    </View>
  );

  const palco = produto ? (
    <View style={{ gap: 12, minWidth: 0, flex: desktop ? 1 : undefined, width: desktop ? undefined : "100%" }}>
      <View
        testID="palco-do-destaque"
        accessibilityLabel={`Prévia da ${produto.name}${artes.length ? " com artes de exemplo" : ""}`}
        style={[
          { borderRadius: desktop ? 28 : 22, overflow: "hidden", borderWidth: 1, borderColor: t.border, backgroundColor: t.bg3, alignItems: "center", justifyContent: "center" },
          desktop ? { aspectRatio: 1, maxHeight: ladoDoPalco } : { height: ladoDoPalco },
          WEB ? ({ backgroundImage: `radial-gradient(80% 70% at 50% 36%, ${t.bg2} 0%, ${t.bg3} 58%, ${t.bg4} 100%)` } as any) : null,
        ]}
      >
        {usaMotor ? (
          <View style={{ paddingBottom: artes.length > 1 ? 56 : 0 }}>
            <LivePreview
              config={produto.customization_config}
              values={values}
              size={tamanhoDoMotor}
              productName={produto.name}
              showLabel={false}
              slug={slug}
              productId={String(produto.id)}
              fotoProduto={produto.image_url}
            />
          </View>
        ) : (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: artes.length > 1 ? 64 : 0, alignItems: "center", justifyContent: "center" }}>
            <View
              style={[{ position: "absolute", left: "14%", right: "14%", bottom: "8%", height: "10%", borderRadius: 999 },
                WEB ? ({ backgroundImage: "radial-gradient(50% 50% at 50% 50%, rgba(26,23,20,.12), rgba(26,23,20,0) 70%)" } as any) : null]}
            />
            {produto.image_url ? (
              <Image
                source={{ uri: produto.image_url }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
                style={[{ width: "78%", height: "84%" }, WEB && !reduzir && gira ? ({
                  animationKeyframes: [{ "0%": { transform: [{ rotate: "-1.4deg" }] }, "100%": { transform: [{ rotate: "1.4deg" }, { translateY: -3 }] } }],
                  animationDuration: "7s", animationDirection: "alternate", animationIterationCount: "infinite", animationTimingFunction: "ease-in-out",
                } as any) : null]}
              />
            ) : (
              <Icon name="image" size={40} color={t.ink4} />
            )}
            <View style={{ position: "absolute", right: desktop ? 26 : 14, bottom: desktop ? 26 : 12 }}>
              <View key={k} style={WEB && !reduzir ? ({ animationKeyframes: [{ from: { opacity: 0, transform: [{ translateY: 6 }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } }], animationDuration: "420ms" } as any) : undefined}>
                <CartaoDaArte values={values} produto={produto} />
              </View>
            </View>
          </View>
        )}
        {usaMotor ? (
          <View style={{ position: "absolute", top: 14, left: 14 }}>
            <Selo texto={eh3D ? "Prévia 3D" : "Prévia da arte"} tom="suave" />
          </View>
        ) : null}
        {artes.length > 1 && !reduzir ? (
          <Pressable
            onPress={() => setSegurado((s) => !s)}
            accessibilityRole="button"
            accessibilityLabel={segurado ? "Continuar a troca de artes" : "Pausar a troca de artes"}
            style={{ position: "absolute", top: 6, right: 6, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          >
            <GlifoDePausa cor={t.ink2} pausado={segurado} />
          </Pressable>
        ) : null}
        {artes.length > 1 ? (
          <View
            accessibilityRole={"radiogroup" as any}
            accessibilityLabel="Arte de exemplo"
            style={[{
              position: "absolute", left: 12, right: 12, bottom: 12, flexDirection: "row", gap: 4, padding: 4,
              borderRadius: 16, borderWidth: 1, borderColor: t.border, backgroundColor: wash(t.bg2, 0.86),
            }, sombraWeb(1), WEB ? ({ backdropFilter: "blur(10px)" } as any) : null]}
          >
            {artes.map((a, j) => {
              const sel = j === k;
              return (
                <Pressable
                  key={a.rotulo + j}
                  onPress={() => { setK(j); setEscolheu(true); }}
                  accessibilityRole={"radio" as any}
                  accessibilityState={{ checked: sel }}
                  accessibilityLabel={a.rotulo}
                  style={[{ flex: 1, minWidth: 0, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, backgroundColor: sel ? t.marcaFill : "transparent" }, transicao("background-color")]}
                >
                  <Texto numberOfLines={1} style={{ fontSize: 13.5, fontWeight: sel ? "600" : "500", color: sel ? t.sobreMarca : t.ink2 }}>{a.rotulo}</Texto>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", columnGap: 12, paddingHorizontal: 4 }}>
        <Texto style={{ fontSize: 13, color: t.ink2, flexShrink: 1 }}>
          <Texto style={{ fontWeight: "600", color: t.ink }}>{produto.name}</Texto>
          {" · "}
          <Numero style={{ fontSize: 13, color: t.ink2 }}>{dinheiro(Number(produto.price))}</Numero>
          {precoNoPix(Number(produto.price), pix) != null ? (
            <>
              {" · "}
              <Numero style={{ fontSize: 13, fontWeight: "600", color: t.green }}>{dinheiro(precoNoPix(Number(produto.price), pix))}</Numero>
              <Texto style={{ fontSize: 13, fontWeight: "600", color: t.green }}> no Pix</Texto>
            </>
          ) : null}
        </Texto>
        <Pressable
          onPress={() => sf.openConfigure(produto)}
          accessibilityRole="link"
          style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          <Texto style={{ fontSize: 13.5, fontWeight: "600", color: t.marcaTexto }}>Personalizar esta</Texto>
          <Icon name="arrow_right" size={15} color={t.marcaTexto} />
        </Pressable>
      </View>
    </View>
  ) : null;

  return (
    <View
      testID="hero-da-peca"
      style={[
        { backgroundColor: t.bg, overflow: "hidden" },
        WEB ? ({ backgroundImage: `radial-gradient(110% 60% at 85% 0%, ${wash(t.marca, 0.12)} 0%, transparent 55%)` } as any) : null,
      ]}
    >
      <View
        style={[
          { width: "100%", maxWidth: 1280, alignSelf: "center" },
          desktop
            ? { flexDirection: "row", alignItems: "center", gap: 64, paddingHorizontal: 80, paddingTop: 56, paddingBottom: 64 }
            : { paddingHorizontal: 16, paddingTop: 26, paddingBottom: 30, gap: 16 },
        ]}
      >
        <View style={{ flex: desktop ? 1.02 : undefined, gap: 16, alignItems: "flex-start" }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 10 }}>
            <MarcaDaLoja sf={sf} tamanho={19} />
            <Rotulo>{lugar ? `Personalizados · ${lugar}` : "Personalizados"}</Rotulo>
          </View>
          <Texto accessibilityRole="header" style={{ fontFamily: tipo.display, fontSize: desktop ? 64 : 36, lineHeight: desktop ? 63 : 38, letterSpacing: desktop ? -1.3 : -0.7, color: t.ink }}>
            Presentes que ninguém mais tem.
          </Texto>
          <Texto style={{ fontSize: desktop ? 18 : 15.5, lineHeight: desktop ? 28 : 24, color: t.ink2, maxWidth: 470 }}>
            {fraseDoDestaque(store)}
          </Texto>
          {desktop ? ctas : null}
          {desktop ? fatos : null}
        </View>
        {palco}
        {!desktop ? ctas : null}
        {!desktop ? fatos : null}
      </View>
    </View>
  );
}
