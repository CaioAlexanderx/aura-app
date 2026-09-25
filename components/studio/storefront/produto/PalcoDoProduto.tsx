// ============================================================
// components/studio/storefront/produto/PalcoDoProduto.tsx
//
// O carrossel da página do produto (Telas 1 e 4 do mockup): as fotos da
// galeria e, assim que a cliente personaliza, o MOCKUP como um slide —
// o primeiro, e o ativo. Antes o mockup era um bloco separado
// (ProductConfigurator.tsx:390) e a foto, outro; quem escolhia a cor lá
// embaixo não via a peça mudar (FASEAMENTO §3.1: "o que continua
// pendente é o mockup como slide do carrossel").
//
// Celular: bolinhas embaixo, "Foto 1 de N" dentro da foto, lupa no
// canto, arrastar para os lados. Desktop: miniaturas em coluna, setas e
// zoom que segue o mouse — que some em `hover: none` (touch), ficando a
// lupa.
//
// Troca sem piscar: as fotos ficam empilhadas e a nova entra POR CIMA da
// anterior (240 ms), que só some depois. O slide do mockup fica montado
// o tempo todo: o 3D não reabre a cada troca de slide.
// ============================================================
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Image, Platform, Pressable, View } from "react-native";
import { useTemaDaVitrine } from "../TemaDaVitrine";
import { Texto, Numero } from "../TipografiaVitrine";
import { wash } from "../theme";
import { proximoIndice } from "../CarrosselFoto";
import { useReduzirMovimento } from "../movimento";
import { BotaoIcone, Selo, sombraWeb, transicao, usePulso } from "./kitDaPagina";
import type { Lado } from "./regrasDaPagina";

const NOME_DO_LADO: Record<Lado, string> = { front: "Frente", back: "Verso", middle: "Meio" };

/** O navegador tem mouse de verdade? (zoom que segue o mouse) */
function temHover(): boolean {
  try {
    return Platform.OS === "web" && typeof window !== "undefined" && !!window.matchMedia?.("(hover: hover)").matches;
  } catch { return false; }
}

export type SlideDoPalco = { tipo: "mock" } | { tipo: "foto"; uri: string };

/** Os slides: o mockup primeiro (quando há), depois as fotos. */
export function slidesDoPalco(fotos: string[], comMockup: boolean): SlideDoPalco[] {
  return [
    ...(comMockup ? [{ tipo: "mock" } as const] : []),
    ...fotos.map((uri) => ({ tipo: "foto", uri } as const)),
  ];
}

export function PalcoDoProduto({
  fotos, nome, selo, largura, altura, desktop,
  comMockup, mockupPersonalizado, mockup, rotuloDoMock,
  lados, lado, onLado,
  slide, onSlide, onAmpliar, brilho,
}: {
  fotos: string[];
  nome: string;
  selo: { texto: string; tom: "marca" | "novo" } | null;
  largura: number;
  altura: number;
  desktop: boolean;
  /** Há slide de mockup (a cliente personalizou, ou a peça não tem foto). */
  comMockup: boolean;
  /** O mockup já tem algo da cliente: ganha a etiqueta "Sua caneca". */
  mockupPersonalizado: boolean;
  /** O LivePreview, já no tamanho do palco. */
  mockup: ReactNode;
  rotuloDoMock: string;
  lados: Lado[];
  lado: Lado;
  onLado: (l: Lado) => void;
  slide: number;
  onSlide: (i: number) => void;
  /** Lupa: `null` = o mockup; número = a foto (índice na galeria). */
  onAmpliar: (fotoIndice: number | null) => void;
  /** Muda quando o mockup entra pela primeira vez: o palco acende. */
  brilho: unknown;
}) {
  const t = useTemaDaVitrine();
  const reduzir = useReduzirMovimento();
  const slides = slidesDoPalco(fotos, comMockup);
  const total = slides.length;
  const atual = Math.min(Math.max(0, slide), Math.max(0, total - 1));
  const s = slides[atual];
  const nFotos = fotos.length;
  const indiceDaFoto = comMockup ? atual - 1 : atual;

  // A camada que sai fica visível embaixo da que entra, até ela chegar.
  const [anterior, setAnterior] = useState<number | null>(null);
  const ultimo = useRef(atual);
  useEffect(() => {
    if (ultimo.current === atual) return;
    setAnterior(ultimo.current);
    ultimo.current = atual;
    const id = setTimeout(() => setAnterior(null), reduzir ? 0 : 300);
    return () => clearTimeout(id);
  }, [atual, reduzir]);

  const acende = usePulso(brilho, 1200);

  // Troca de MODELO: as fotos mudam de uma vez. A foto que estava na tela
  // fica embaixo (o "fantasma") enquanto a nova entra por cima — a prévia
  // não pisca em branco enquanto a imagem nova carrega (Tela 2).
  const uriAtual = s?.tipo === "foto" ? s.uri : null;
  const uriAnterior = useRef<string | null>(uriAtual);
  const [fantasma, setFantasma] = useState<string | null>(null);
  useEffect(() => {
    const antes = uriAnterior.current;
    uriAnterior.current = uriAtual;
    if (!antes || !uriAtual || antes === uriAtual || fotos.includes(antes)) return;
    setFantasma(antes);
    const id = setTimeout(() => setFantasma(null), reduzir ? 0 : 320);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uriAtual]);
  const entrando: any = reduzir || Platform.OS !== "web" ? null : {
    animationKeyframes: [{ from: { opacity: 0 }, to: { opacity: 1 } }],
    animationDuration: "240ms",
    animationTimingFunction: "cubic-bezier(.4,0,.2,1)",
  };

  // Zoom que segue o mouse: só no desktop, só em foto, só com mouse.
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const podeZoom = desktop && s?.tipo === "foto" && temHover();

  // Arrastar para os lados (toque). No slide do mockup o arraste é do 3D
  // (girar a peça), então lá a troca é pelas bolinhas e setas.
  const toque = useRef<number | null>(null);
  const mover = (d: 1 | -1) => onSlide(proximoIndice(atual, total, d));

  // Teclado no desktop: ← e → trocam o slide, a não ser que a cliente
  // esteja escrevendo num campo (o texto da caneca, o CEP).
  const moverRef = useRef(mover);
  moverRef.current = mover;
  useEffect(() => {
    if (!desktop || total < 2 || Platform.OS !== "web" || typeof document === "undefined") return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const alvo = e.target as HTMLElement | null;
      const tag = String(alvo?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || alvo?.isContentEditable) return;
      if (document.querySelector("[aria-modal='true']")) return;
      moverRef.current(e.key === "ArrowRight" ? 1 : -1);
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [desktop, total]);

  const camadas = slides.map((sl, i) => {
    const visivel = i === atual || i === anterior;
    const estilo: any = {
      position: "absolute", left: 0, top: 0, right: 0, bottom: 0,
      alignItems: "center", justifyContent: "center",
      opacity: visivel ? 1 : 0,
      zIndex: i === atual ? 2 : i === anterior ? 1 : 0,
      ...(reduzir ? null : transicao("opacity", 240)),
    };
    if (sl.tipo === "mock") {
      return (
        <View key="mock" style={[estilo, { backgroundColor: t.bg3 }, Platform.OS === "web" ? ({ backgroundImage: `radial-gradient(120% 90% at 50% 30%, ${t.bg2} 0%, ${t.bg3} 62%, ${t.bg4} 100%)` } as any) : null]}
          pointerEvents={i === atual ? "auto" : "none"}
          accessibilityElementsHidden={i !== atual}
        >
          {mockup}
        </View>
      );
    }
    const n = comMockup ? i : i + 1;
    return (
      <View key={"f" + i + sl.uri} style={[estilo, { backgroundColor: t.bg3, overflow: "hidden" }, i === atual ? entrando : null]} pointerEvents="none">
        <Image
          source={{ uri: sl.uri }}
          resizeMode="cover"
          accessibilityLabel={`${nome} — foto ${n} de ${nFotos}`}
          style={[
            { width: "100%", height: "100%" },
            i === atual && zoom
              ? ({ transform: [{ scale: 1.9 }], transformOrigin: `${zoom.x}% ${zoom.y}%` } as any)
              : null,
            reduzir ? null : transicao("transform", 240),
          ]}
        />
      </View>
    );
  });

  const eventosDeMouse: any = podeZoom
    ? {
        onMouseMove: (e: any) => {
          const r = e?.currentTarget?.getBoundingClientRect?.();
          if (!r) return;
          const x = ((e.clientX - r.left) / r.width) * 100;
          const y = ((e.clientY - r.top) / r.height) * 100;
          setZoom({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
        },
        onMouseLeave: () => setZoom(null),
      }
    : {};
  const eventosDeToque: any = s?.tipo === "foto" && total > 1
    ? {
        onTouchStart: (e: any) => { toque.current = e?.nativeEvent?.pageX ?? null; },
        onTouchEnd: (e: any) => {
          const x0 = toque.current;
          toque.current = null;
          const x1 = e?.nativeEvent?.pageX;
          if (x0 == null || x1 == null) return;
          if (Math.abs(x1 - x0) > 40) mover(x1 < x0 ? 1 : -1);
        },
      }
    : {};

  const palco = (
    <View
      testID="palco-do-produto"
      accessibilityRole={"region" as any}
      accessibilityLabel={s?.tipo === "mock" ? `${rotuloDoMock}, ${NOME_DO_LADO[lado].toLowerCase()}` : `Fotos de ${nome}`}
      style={[
        {
          width: largura, height: altura, borderRadius: 20, overflow: "hidden",
          backgroundColor: t.bg3, position: "relative",
        },
        acende && Platform.OS === "web" ? ({ boxShadow: `0 0 0 6px ${t.marcaWashForte}` } as any) : null,
        transicao("box-shadow", 600),
        podeZoom ? ({ cursor: "zoom-in" } as any) : null,
      ]}
      {...eventosDeMouse}
      {...eventosDeToque}
    >
      {fantasma ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, zIndex: 0, backgroundColor: t.bg3 }}>
          <Image source={{ uri: fantasma }} resizeMode="cover" style={{ width: "100%", height: "100%" }} accessibilityElementsHidden />
        </View>
      ) : null}
      {camadas}

      {/* Sobre o palco */}
      <View pointerEvents="box-none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, zIndex: 3 }}>
        {s?.tipo === "mock" ? (
          <>
            {mockupPersonalizado ? (
              <View style={{ position: "absolute", top: 12, left: 12 }}>
                <Selo texto={rotuloDoMock} />
              </View>
            ) : null}
            <View style={{ position: "absolute", top: 8, right: 8, flexDirection: "row", gap: 6 }}>
              {lados.length > 1 ? (
                <BotaoIcone
                  vidro icone="refresh" rotulo={`Girar: ver ${NOME_DO_LADO[lados[(lados.indexOf(lado) + 1) % lados.length]].toLowerCase()}`}
                  onPress={() => onLado(lados[(lados.indexOf(lado) + 1) % lados.length])}
                />
              ) : null}
              <BotaoIcone vidro icone="search" rotulo="Ver a prévia em tela cheia" onPress={() => onAmpliar(null)} />
            </View>
            {lados.length > 1 ? (
              <View style={{ position: "absolute", bottom: 10, left: 0, right: 0, alignItems: "center" }} pointerEvents="box-none">
                <View
                  accessibilityRole={"radiogroup" as any}
                  accessibilityLabel="Lado da peça"
                  style={[{ flexDirection: "row", padding: 2, gap: 2, borderRadius: 999, backgroundColor: wash(t.bg2, 0.9) }, sombraWeb(1)]}
                >
                  {lados.map((l) => {
                    const sel = l === lado;
                    return (
                      <Pressable
                        key={l}
                        onPress={() => onLado(l)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: sel }}
                        accessibilityLabel={"Ver " + NOME_DO_LADO[l].toLowerCase()}
                        style={[{ height: 40, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center", backgroundColor: sel ? t.marcaFill : "transparent" }, transicao("background-color")]}
                      >
                        <Texto style={{ fontSize: 13, fontWeight: "600", color: sel ? t.sobreMarca : t.ink2 }}>{NOME_DO_LADO[l]}</Texto>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </>
        ) : s?.tipo === "foto" ? (
          <>
            {selo ? (
              <View style={{ position: "absolute", top: 12, left: 12 }}>
                <Selo texto={selo.texto} tom={selo.tom === "novo" ? "suave" : "marca"} />
              </View>
            ) : null}
            <View style={{ position: "absolute", top: 8, right: 8 }}>
              <BotaoIcone vidro icone="search" rotulo="Ampliar a foto" onPress={() => onAmpliar(indiceDaFoto)} />
            </View>
            {nFotos > 1 ? (
              <View style={[{ position: "absolute", left: 12, bottom: 12, height: 24, paddingHorizontal: 9, borderRadius: 999, justifyContent: "center", backgroundColor: t.bg2 }, sombraWeb(1)]}>
                <Texto style={{ fontSize: 12, fontWeight: "500", color: t.ink }}>
                  Foto <Numero style={{ fontSize: 12 }}>{indiceDaFoto + 1}</Numero> de <Numero style={{ fontSize: 12 }}>{nFotos}</Numero>
                </Texto>
              </View>
            ) : null}
          </>
        ) : null}

        {desktop && total > 1 ? (
          <>
            <View style={{ position: "absolute", left: 12, top: altura / 2 - 22 }}>
              <BotaoIcone vidro icone="chevron_left" rotulo="Foto anterior" onPress={() => mover(-1)} />
            </View>
            <View style={{ position: "absolute", right: 12, top: altura / 2 - 22 }}>
              <BotaoIcone vidro icone="chevron_right" rotulo="Próxima foto" onPress={() => mover(1)} />
            </View>
          </>
        ) : null}
      </View>
    </View>
  );

  const legenda = s?.tipo === "mock"
    ? "Prévia. A loja manda o mockup final para você aprovar."
    : podeZoom ? "Passe o mouse sobre a foto para ver de perto." : "";

  if (!desktop) {
    return (
      <View style={{ alignItems: "center" }}>
        {palco}
        {total > 1 ? (
          <View style={{ flexDirection: "row", justifyContent: "center", minHeight: 32 }} accessibilityRole={"tablist" as any}>
            {slides.map((sl, i) => {
              const sel = i === atual;
              const mock = sl.tipo === "mock";
              return (
                <Pressable
                  key={i}
                  onPress={() => onSlide(i)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={mock ? rotuloDoMock : `Foto ${comMockup ? i : i + 1}`}
                  style={{ width: 24, height: 36, alignItems: "center", justifyContent: "center" }}
                >
                  <View
                    style={[
                      mock
                        ? { width: sel ? 20 : 9, height: 9, borderRadius: 5, backgroundColor: sel ? t.marcaFill : "transparent", borderWidth: sel ? 0 : 1.5, borderColor: t.marcaTexto }
                        : { width: sel ? 20 : 7, height: 7, borderRadius: 4, backgroundColor: sel ? t.ink : t.ink4 },
                      reduzir ? null : transicao("width, background-color"),
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {legenda ? (
          <Texto style={{ fontSize: 12.5, color: t.ink3, textAlign: "center", paddingHorizontal: 24, marginTop: total > 1 ? -2 : 8 }}>{legenda}</Texto>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
      <View style={{ gap: 10, width: 72 }}>
        {slides.map((sl, i) => {
          const sel = i === atual;
          return (
            <Pressable
              key={i}
              onPress={() => onSlide(i)}
              accessibilityRole="button"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={sl.tipo === "mock" ? rotuloDoMock : `Foto ${comMockup ? i : i + 1}`}
              style={[
                {
                  width: 72, height: 72, borderRadius: 12, overflow: "hidden", backgroundColor: t.bg3,
                  borderWidth: 2, borderColor: sel ? t.marcaTexto : "transparent",
                },
                transicao("border-color"),
              ]}
            >
              {sl.tipo === "foto" ? (
                <Image source={{ uri: sl.uri }} resizeMode="cover" style={{ width: "100%", height: "100%" }} accessibilityIgnoresInvertColors />
              ) : (
                <View style={{ flex: 1 }}>
                  {fotos[0] ? (
                    <Image source={{ uri: fotos[0] }} resizeMode="cover" style={{ width: "100%", height: "100%", opacity: 0.85 }} accessibilityIgnoresInvertColors />
                  ) : null}
                  <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: t.marcaFill, alignItems: "center" }}>
                    <Numero style={{ fontSize: 9.5, lineHeight: 16, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase", color: t.sobreMarca }}>
                      {rotuloDoMock.split(" ")[0]}
                    </Numero>
                  </View>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      <View>
        {palco}
        {legenda ? <Texto style={{ fontSize: 12.5, color: t.ink3, paddingTop: 10 }}>{legenda}</Texto> : null}
      </View>
    </View>
  );
}
