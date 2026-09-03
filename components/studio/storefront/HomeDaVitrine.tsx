// ============================================================
// components/studio/storefront/HomeDaVitrine.tsx
//
// Os blocos da home, desenhados. QUEM aparece é decisão de
// blocosDaHome.ts — aqui é só layout, e cada bloco devolve null quando
// não tem o que mostrar.
//
// A ordem é a do handoff: faixa de avisos, hero, como funciona,
// categorias, mais pedidos, artes prontas, B2B, confiança. O que a loja
// não tem, ela pula — e a home encurta em vez de mostrar caixa vazia.
// ============================================================
import { View, Image, Pressable, Platform, useWindowDimensions } from "react-native";
import { Texto, useTipografia } from "./TipografiaVitrine";
import { usePaletaDaVitrine, useTemaDaVitrine } from "./TemaDaVitrine";
import { Fonts } from "@/constants/fonts";
import type { BlocosDaHome, PassoDaLoja } from "./blocosDaHome";
import type { StudioStoreProduct } from "./types";
import { CapaProduto } from "./CapaProduto";

const LARGURA_MAX = 980;

/** Rótulo monoespaçado em caixa alta — a voz de etiqueta do sistema. */
export function Etiqueta({ children, cor }: { children: React.ReactNode; cor?: string }) {
  const T = usePaletaDaVitrine();
  return (
    <Texto style={{
      fontFamily: Fonts.mono, fontSize: 10.5, letterSpacing: 1.6,
      textTransform: "uppercase", color: cor || T.ink3,
    }}>
      {children}
    </Texto>
  );
}

function Secao({
  etiqueta, titulo, children, semLinha,
}: { etiqueta?: string; titulo?: string; children: React.ReactNode; semLinha?: boolean }) {
  const T = usePaletaDaVitrine();
  const tipo = useTipografia();
  return (
    <View style={{
      width: "100%", maxWidth: LARGURA_MAX, alignSelf: "center",
      paddingHorizontal: 18, paddingVertical: 26, gap: 14,
      borderTopWidth: semLinha ? 0 : 1, borderTopColor: T.border,
    }}>
      {etiqueta ? <Etiqueta>{etiqueta}</Etiqueta> : null}
      {titulo ? (
        <Texto style={{ fontFamily: tipo.display, fontSize: 27, lineHeight: 32, color: T.ink }}>
          {titulo}
        </Texto>
      ) : null}
      {children}
    </View>
  );
}

// ── Faixa de avisos ───────────────────────────────────────────
// O desenho tem um letreiro rolante. Rolagem infinita é animação
// permanente, que a diretriz de movimento do sistema evita e que
// prefers-reduced-motion teria de desligar de qualquer jeito. Aqui os
// avisos ficam parados, separados por ponto médio — o mesmo conteúdo,
// legível de uma vez.
export function FaixaDeAvisos({ avisos }: { avisos: string[] }) {
  const tema = useTemaDaVitrine();
  if (!avisos.length) return null;
  return (
    <View style={{ backgroundColor: tema.marcaFill, paddingVertical: 7, paddingHorizontal: 14 }}>
      <View style={{ width: "100%", maxWidth: LARGURA_MAX, alignSelf: "center",
                     flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
        {avisos.map((a, i) => (
          <Texto key={i} style={{
            fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1.1,
            textTransform: "uppercase", color: tema.sobreMarca,
          }}>
            {i > 0 ? "· " : ""}{a}
          </Texto>
        ))}
      </View>
    </View>
  );
}

// ── Hero ──────────────────────────────────────────────────────
export function Hero({
  hero, sla, totalProdutos, mockup,
}: {
  hero: BlocosDaHome["hero"];
  sla: number;
  totalProdutos: number;
  /** O mockup 3D, montado pelo chamador — a home não conhece o motor visual. */
  mockup?: React.ReactNode;
}) {
  const T = usePaletaDaVitrine();
  const tema = useTemaDaVitrine();
  const tipo = useTipografia();
  const { width } = useWindowDimensions();
  const larga = width >= 720;
  const b = hero.banner;

  // Com banner, ele é o fundo e o texto vai por cima com véu escuro.
  // Sem banner, papel quente e o mockup ao lado — nada de gradiente da
  // marca cobrindo a tela, que era o que fazia toda loja parecer igual.
  const comBanner = !!(b && b.image_url);

  return (
    <View style={{
      backgroundColor: comBanner ? "#1A1714" : T.bg,
      paddingHorizontal: larga ? 20 : 14,
      paddingTop: comBanner ? 0 : 26,
      paddingBottom: comBanner ? 0 : 30,
      ...(comBanner && Platform.OS === "web"
        ? ({
            backgroundImage:
              "linear-gradient(90deg, rgba(26,23,20,0.78) 0%, rgba(26,23,20,0.35) 55%, rgba(26,23,20,0.15) 100%), url(" +
              (width < 720 && b!.image_url_mobile ? b!.image_url_mobile : b!.image_url) + ")",
            backgroundSize: "cover",
            backgroundPosition: "center",
            minHeight: larga ? 340 : 300,
            display: "flex",
            alignItems: "center",
          } as any)
        : {}),
    }}>
      <View style={{
        width: "100%", maxWidth: LARGURA_MAX, alignSelf: "center",
        paddingVertical: comBanner ? 40 : 0,
        flexDirection: larga && !comBanner ? "row" : "column",
        alignItems: larga && !comBanner ? "center" : "flex-start",
        gap: larga && !comBanner ? 32 : 0,
      }}>
        <View style={{ flex: larga && !comBanner ? 1 : undefined }}>
          {hero.logo && !comBanner ? (
            <Image
              source={{ uri: hero.logo }}
              style={{ width: 58, height: 58, borderRadius: 12, marginBottom: 14 }}
              resizeMode="contain"
              accessibilityLabel={hero.nome}
            />
          ) : null}

          <Etiqueta cor={comBanner ? "rgba(255,255,255,0.72)" : undefined}>
            {hero.nome} · Personalizados
          </Etiqueta>

          <Texto style={{
            fontFamily: tipo.display,
            color: comBanner ? "#fff" : T.ink,
            fontSize: larga ? 46 : 34,
            lineHeight: larga ? 50 : 38,
            marginTop: 8,
            maxWidth: 560,
          }}>
            {b?.headline || "Presentes que ninguém mais tem."}
          </Texto>

          {(b?.body || hero.tagline) ? (
            <Texto style={{
              color: comBanner ? "rgba(255,255,255,0.86)" : T.ink2,
              fontSize: 14.5, lineHeight: 21, marginTop: 10, maxWidth: 480,
            }}>
              {b?.body || hero.tagline}
            </Texto>
          ) : null}

          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 18 }}>
            <Texto style={{
              fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 0.8,
              color: comBanner ? "rgba(255,255,255,0.8)" : T.ink3,
            }}>
              {sla > 0 ? `Pronto em ${sla} ${sla === 1 ? "dia útil" : "dias úteis"}` : "Feito sob encomenda"}
              {totalProdutos > 0 ? `  ·  ${totalProdutos} ${totalProdutos === 1 ? "modelo" : "modelos"}` : ""}
            </Texto>
          </View>
        </View>

        {hero.usarMockup && mockup && larga ? (
          <View style={{ flex: 1, alignItems: "center" }}>{mockup}</View>
        ) : null}
      </View>
    </View>
  );
}

// ── Como funciona ─────────────────────────────────────────────
export function ComoFunciona({ passos }: { passos: PassoDaLoja[] }) {
  const T = usePaletaDaVitrine();
  const tema = useTemaDaVitrine();
  const { width } = useWindowDimensions();
  if (!passos.length) return null;
  const emLinha = width >= 720;
  return (
    <Secao etiqueta="Como funciona" semLinha>
      <View style={{ flexDirection: emLinha ? "row" : "column", gap: 12 }}>
        {passos.map((p) => (
          <View key={p.n} style={{
            flex: emLinha ? 1 : undefined,
            backgroundColor: T.card, borderRadius: 16, padding: 16,
            borderWidth: 1, borderColor: T.border, gap: 6,
          }}>
            <Texto style={{ fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1.4, color: tema.marcaTexto }}>
              {"0" + p.n}
            </Texto>
            <Texto style={{ fontSize: 14.5, fontWeight: "700", color: T.ink }}>{p.titulo}</Texto>
            <Texto style={{ fontSize: 12.5, lineHeight: 18, color: T.ink2 }}>{p.texto}</Texto>
          </View>
        ))}
      </View>
    </Secao>
  );
}

// ── Tira de categorias ────────────────────────────────────────
export function TiraDeCategorias({
  categorias, onEscolher,
}: {
  categorias: BlocosDaHome["categorias"];
  onEscolher: (slug: string) => void;
}) {
  const T = usePaletaDaVitrine();
  const tema = useTemaDaVitrine();
  if (!categorias.length) return null;
  return (
    <Secao etiqueta="Escolha por onde começar" titulo="O que a gente personaliza">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {categorias.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => onEscolher(c.slug)}
            accessibilityRole="button"
            accessibilityLabel={`${c.nome}, ${c.total} modelos`}
            style={{
              paddingVertical: 12, paddingHorizontal: 16,
              borderRadius: 14, borderWidth: 1, borderColor: T.border,
              backgroundColor: T.card, gap: 3, minWidth: 140,
            }}
          >
            <Texto style={{ fontSize: 14.5, fontWeight: "700", color: T.ink }}>{c.nome}</Texto>
            <Texto style={{ fontFamily: Fonts.mono, fontSize: 10.5, color: tema.marcaTexto }}>
              {c.total} {c.total === 1 ? "modelo" : "modelos"}
            </Texto>
          </Pressable>
        ))}
      </View>
    </Secao>
  );
}

// ── Mais pedidos ──────────────────────────────────────────────
export function MaisPedidos({
  produtos, onAbrir, nomeDaLoja,
}: {
  produtos: StudioStoreProduct[];
  onAbrir: (p: StudioStoreProduct) => void;
  nomeDaLoja: string;
}) {
  const T = usePaletaDaVitrine();
  const tema = useTemaDaVitrine();
  const { width } = useWindowDimensions();
  if (!produtos.length) return null;
  const colunas = width < 560 ? 2 : 4;
  const largura = Math.floor((Math.min(width, LARGURA_MAX) - 36 - 12 * (colunas - 1)) / colunas);
  return (
    <Secao etiqueta="Mais pedidos" titulo={`Os queridinhos da ${nomeDaLoja}`}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {produtos.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => onAbrir(p)}
            accessibilityRole="button"
            accessibilityLabel={p.name}
            style={{ width: largura, gap: 7 }}
          >
            <CapaProduto
              uri={p.image_url || undefined}
              nome={p.name}
              tamanho={largura}
              corDaLoja={tema.marca}
              altura={largura}
            />
            <Texto numberOfLines={2} style={{ fontSize: 12.5, color: T.ink, lineHeight: 17 }}>
              {p.name}
            </Texto>
            <Texto style={{ fontFamily: Fonts.mono, fontSize: 12, color: T.ink }}>
              R$ {Number(p.price).toFixed(2)}
            </Texto>
          </Pressable>
        ))}
      </View>
    </Secao>
  );
}

// ── Artes prontas ─────────────────────────────────────────────
export function ArtesProntas({ artes }: { artes: BlocosDaHome["artes"] }) {
  const T = usePaletaDaVitrine();
  const { width } = useWindowDimensions();
  if (!artes.length) return null;
  const colunas = width < 560 ? 3 : 6;
  const lado = Math.floor((Math.min(width, LARGURA_MAX) - 36 - 10 * (colunas - 1)) / colunas);
  return (
    <Secao etiqueta="Não tem arte pronta?" titulo="É só escolher uma das nossas">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {artes.slice(0, colunas).map((a) => (
          <View key={a.id} style={{ width: lado, gap: 5 }}>
            <Image
              source={{ uri: a.thumb }}
              style={{ width: lado, height: lado, borderRadius: 12, backgroundColor: T.bg,
                       borderWidth: 1, borderColor: T.border }}
              resizeMode="cover"
              accessibilityLabel={a.name}
            />
            <Texto numberOfLines={1} style={{ fontSize: 11, color: T.ink3 }}>{a.name}</Texto>
          </View>
        ))}
      </View>
    </Secao>
  );
}

// ── Bloco B2B ─────────────────────────────────────────────────
export function BlocoB2B({ onAbrir }: { onAbrir: () => void }) {
  const T = usePaletaDaVitrine();
  const tema = useTemaDaVitrine();
  const tipo = useTipografia();
  return (
    <Secao>
      <View style={{
        backgroundColor: tema.marcaWash, borderRadius: 20, padding: 22,
        borderWidth: 1, borderColor: tema.borderAccent, gap: 10,
      }}>
        <Etiqueta cor={tema.marcaTexto}>Para empresas e eventos</Etiqueta>
        <Texto style={{ fontFamily: tipo.display, fontSize: 25, lineHeight: 30, color: T.ink, maxWidth: 540 }}>
          50 canecas com o nome de cada convidado? Preço na hora.
        </Texto>
        <Texto style={{ fontSize: 13.5, lineHeight: 20, color: T.ink2, maxWidth: 520 }}>
          Cole a lista de nomes. Cada linha vira uma peça personalizada, o desconto por
          quantidade cai sozinho e você recebe um mockup por pessoa para aprovar.
        </Texto>
        <Pressable
          onPress={onAbrir}
          accessibilityRole="button"
          accessibilityLabel="Pedir orçamento em lote"
          style={{
            alignSelf: "flex-start", marginTop: 6,
            backgroundColor: tema.marcaFill, paddingVertical: 12, paddingHorizontal: 20,
            borderRadius: 12,
          }}
        >
          <Texto style={{ color: tema.sobreMarca, fontSize: 13.5, fontWeight: "700" }}>
            Pedir orçamento em lote
          </Texto>
        </Pressable>
      </View>
    </Secao>
  );
}

// ── Faixa de confiança ────────────────────────────────────────
export function FaixaDeConfianca({ numeros }: { numeros: BlocosDaHome["confianca"] }) {
  const T = usePaletaDaVitrine();
  const tipo = useTipografia();
  if (!numeros.length) return null;
  return (
    <Secao>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 28 }}>
        {numeros.map((n) => (
          <View key={n.rotulo} style={{ gap: 2 }}>
            <Texto style={{ fontFamily: tipo.display, fontSize: 30, lineHeight: 34, color: T.ink }}>
              {n.valor}
            </Texto>
            <Texto style={{ fontFamily: Fonts.mono, fontSize: 10.5, letterSpacing: 0.8,
                            textTransform: "uppercase", color: T.ink3 }}>
              {n.rotulo}
            </Texto>
          </View>
        ))}
      </View>
    </Secao>
  );
}
