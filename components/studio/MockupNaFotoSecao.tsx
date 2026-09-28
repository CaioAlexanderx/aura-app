// ============================================================
// AURA STUDIO · MockupNaFotoSecao — "Mockup na foto" na aba
// Personalização da edição do produto (28/09/2026)
//
// A lojista escolhe uma foto da peça (capa + galeria), arrasta os quatro
// cantos do quadrilátero até a área de impressão e vê, ao vivo, uma arte
// de exemplo assentada na luz e nas dobras da foto. "Salvar posição"
// grava `customization_config.mockup_foto[lado]` pelo MESMO salvamento
// da aba (o `save` do StudioPersonalizacaoPanel, com normalização e as
// validações de sempre) — não há um segundo caminho de escrita.
//
// Fiel ao mockup aprovado: docs/mockups/studio-mockup-na-foto.html.
// As regras (quad inicial, arraste, validação, o que se grava) moram em
// visualEngine/marcacaoDaFoto.ts; a prévia é o composeView do motor.
//
// Gestos: pointer events no web (o RNW não entrega PanResponder com a
// precisão de um ponteiro de mouse), PanResponder no nativo. Teclado no
// web: Tab até a alça, setas movem, Shift acelera. Alvos de 44 px.
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, Pressable, Image, PanResponder, Platform, StyleSheet, Linking,
  type LayoutChangeEvent,
} from "react-native";
import Svg, { Polygon } from "react-native-svg";
import { Icon } from "@/components/Icon";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import type { CustomizationConfig } from "@/services/studioApi";
import type { VisualQuad } from "@/services/studioVisualApi";
import { studioStorefrontUrl } from "@/utils/storefrontUrl";
import { blendDaVista, composeView, notaDaComposicao, type BlendDaArte } from "@/components/studio/visualEngine/compose2d";
import {
  areaImpressaDoLado, ladosDaPeca, vistaDaMarcacao, type LadoDaPeca,
} from "@/components/studio/visualEngine/specDaFotoDoProduto";
import {
  cantoEm, configComLado, configSemLado, ladoParaGravar, mesmaMarcacao, moverCanto, passoDaTecla,
  quadDaFotoValido, quadInicial, rascunhoDoGravado, temCampoDeCor, type RascunhoDoLado,
} from "@/components/studio/visualEngine/marcacaoDaFoto";

type Props = {
  config: CustomizationConfig;
  /** Capa + galeria do produto, já sem repetição (fotosDoProduto). */
  fotos: string[];
  /** Produto com modelo da Aura vinculado: ele tem precedência na vitrine. */
  temModeloVinculado: boolean;
  slug?: string | null;
  productId: string;
  salvando: boolean;
  /** O salvamento da aba. Recebe a config inteira com o lado novo; true se gravou. */
  onSalvar: (cfg: CustomizationConfig) => Promise<boolean>;
};

const ROTULO_DO_LADO: Record<LadoDaPeca, string> = { front: "Frente", back: "Verso", middle: "Meio" };
const DO_LADO: Record<LadoDaPeca, string> = { front: "da frente", back: "do verso", middle: "do meio" };
const NOME_DO_CANTO = ["superior esquerdo", "superior direito", "inferior direito", "inferior esquerdo"];

type ArteDeExemplo = "selo" | "nome" | "foto";

// ── Artes de exemplo (web) ───────────────────────────────────
// Desenhadas uma vez num canvas e passadas ao motor como imagem: a prévia
// usa o mesmo caminho de uma arte enviada pelo cliente.
let artesEmCache: { selo: string; foto: string } | null = null;
function artesDeExemplo(): { selo: string; foto: string } | null {
  if (artesEmCache) return artesEmCache;
  if (Platform.OS !== "web" || typeof document === "undefined") return null;
  try {
    const selo = document.createElement("canvas");
    selo.width = 400; selo.height = 400;
    const c = selo.getContext("2d");
    const foto = document.createElement("canvas");
    foto.width = 400; foto.height = 400;
    const f = foto.getContext("2d");
    if (!c || !f) return null;
    c.fillStyle = "#1E3A8A"; c.beginPath(); c.arc(200, 200, 190, 0, 7); c.fill();
    c.fillStyle = "#F59E0B"; c.beginPath(); c.arc(200, 200, 88, 0, 7); c.fill();
    c.strokeStyle = "#F59E0B"; c.lineWidth = 14; c.lineCap = "round";
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      c.beginPath();
      c.moveTo(200 + Math.cos(a) * 112, 200 + Math.sin(a) * 112);
      c.lineTo(200 + Math.cos(a) * 152, 200 + Math.sin(a) * 152);
      c.stroke();
    }
    const g = f.createLinearGradient(0, 0, 0, 400);
    g.addColorStop(0, "#F59E0B"); g.addColorStop(1, "#EC4899");
    f.fillStyle = g; f.fillRect(0, 0, 400, 400);
    f.fillStyle = "#FDE68A"; f.beginPath(); f.arc(200, 170, 70, 0, 7); f.fill();
    f.fillStyle = "#1E3A8A";
    f.beginPath(); f.moveTo(0, 400); f.lineTo(0, 290); f.lineTo(120, 220); f.lineTo(230, 300);
    f.lineTo(320, 240); f.lineTo(400, 290); f.lineTo(400, 400); f.fill();
    artesEmCache = { selo: selo.toDataURL("image/png"), foto: foto.toDataURL("image/png") };
    return artesEmCache;
  } catch (_e) {
    return null;
  }
}

function valoresDaArte(arte: ArteDeExemplo): Record<string, any> {
  const a = artesDeExemplo();
  if (arte === "nome") return { text: "Maria Luísa" };
  if (arte === "foto") return a ? { image: a.foto } : { text: "Foto do cliente" };
  return a ? { image: a.selo, text: "EQUIPE SOL" } : { text: "EQUIPE SOL" };
}

// ── Medida da foto ───────────────────────────────────────────
function medirFotoNativa(url: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    try {
      Image.getSize(url, (w, h) => resolve(w > 0 && h > 0 ? { w, h } : null), () => resolve(null));
    } catch (_e) {
      resolve(null);
    }
  });
}

// ── Largura de um bloco ──────────────────────────────────────
// No web, ResizeObserver próprio: o onLayout do RNW não disparou para o
// editor montado depois do estado vazio (visto no Chrome, 28/09/2026 —
// o observador compartilhado do RNW nunca chamou o handler desse nó), e
// sem largura não há alças. No nativo, o onLayout de sempre.
function useLargura(): [number, (el: any) => void, ((e: LayoutChangeEvent) => void) | undefined] {
  const [largura, setLargura] = useState(0);
  const observador = useRef<any>(null);
  const refDoBloco = useCallback((el: any) => {
    if (Platform.OS !== "web") return;
    if (observador.current) { observador.current.disconnect(); observador.current = null; }
    if (!el || typeof (globalThis as any).ResizeObserver === "undefined") return;
    const ro = new (globalThis as any).ResizeObserver(() => {
      const w = Math.round(el.getBoundingClientRect().width);
      setLargura((atual) => (atual === w ? atual : w));
    });
    ro.observe(el);
    observador.current = ro;
  }, []);
  const onLayout = Platform.OS === "web"
    ? undefined
    : (e: LayoutChangeEvent) => setLargura(Math.round(e.nativeEvent.layout.width));
  return [largura, refDoBloco, onLayout];
}

// ── Alça de canto ────────────────────────────────────────────
function Alca({
  indice, x, y, t, s, onInicio, onArrastar, onFim, onTecla,
}: {
  indice: number;
  x: number; y: number;
  t: StudioPalette;
  s: ReturnType<typeof buildStyles>;
  onInicio: (i: number) => void;
  onArrastar: (i: number, dxPx: number, dyPx: number) => void;
  onFim: (i: number) => void;
  onTecla: (i: number, tecla: string, shift: boolean) => boolean;
}) {
  const ref = useRef<any>(null);
  const [ativa, setAtiva] = useState(false);
  // Callbacks sempre frescos para os ouvintes do DOM, que são presos uma vez.
  const cb = useRef({ onInicio, onArrastar, onFim, onTecla });
  cb.current = { onInicio, onArrastar, onFim, onTecla };

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const el: any = ref.current;
    if (!el || typeof el.addEventListener !== "function") return;
    let inicio: { x: number; y: number } | null = null;
    const down = (ev: any) => {
      ev.preventDefault();
      try { el.setPointerCapture(ev.pointerId); } catch (_e) { /* ponteiro sintético */ }
      try { el.focus({ preventScroll: true }); } catch (_e) { /* sem foco */ }
      inicio = { x: ev.clientX, y: ev.clientY };
      setAtiva(true);
      cb.current.onInicio(indice);
    };
    const move = (ev: any) => {
      if (!inicio) return;
      cb.current.onArrastar(indice, ev.clientX - inicio.x, ev.clientY - inicio.y);
    };
    const up = () => {
      if (!inicio) return;
      inicio = null;
      setAtiva(false);
      cb.current.onFim(indice);
    };
    const key = (ev: any) => {
      if (cb.current.onTecla(indice, ev.key, !!ev.shiftKey)) ev.preventDefault();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("keydown", key);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("keydown", key);
    };
  }, [indice]);

  const pan = useMemo(
    () => Platform.OS === "web" ? null : PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { setAtiva(true); cb.current.onInicio(indice); },
      onPanResponderMove: (_e, g) => cb.current.onArrastar(indice, g.dx, g.dy),
      onPanResponderRelease: () => { setAtiva(false); cb.current.onFim(indice); },
      onPanResponderTerminate: () => { setAtiva(false); cb.current.onFim(indice); },
    }),
    [indice]
  );

  return (
    <View
      ref={ref}
      testID={"alca-" + indice}
      {...(pan ? pan.panHandlers : {})}
      focusable
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={"Canto " + NOME_DO_CANTO[indice]}
      accessibilityHint="Arraste, ou use as setas do teclado. Shift move mais rápido."
      style={[
        s.alca,
        { left: x - 22, top: y - 22 },
        Platform.OS === "web" ? ({ cursor: ativa ? "grabbing" : "grab", touchAction: "none", outlineStyle: "none" } as any) : null,
      ]}
    >
      <View style={[s.alcaPonto, { backgroundColor: ativa ? t.primary : t.accent, borderColor: t.paperCardElev }]} />
    </View>
  );
}

// ── Seção ────────────────────────────────────────────────────
export function MockupNaFotoSecao({
  config, fotos, temModeloVinculado, slug, productId, salvando, onSalvar,
}: Props) {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const lados = ladosDaPeca(config);
  const [lado, setLado] = useState<LadoDaPeca>("front");
  const ladoAtivo: LadoDaPeca = lados.includes(lado) ? lado : "front";
  const gravado: any = (config as any).mockup_foto || {};

  const [rascunhos, setRascunhos] = useState<Record<LadoDaPeca, RascunhoDoLado>>(() => ({
    front: rascunhoDoGravado(gravado.front),
    back: rascunhoDoGravado(gravado.back),
    middle: rascunhoDoGravado(gravado.middle),
  }));
  const r = rascunhos[ladoAtivo];
  const cm = areaImpressaDoLado(config, ladoAtivo);
  const [arte, setArte] = useState<ArteDeExemplo>("selo");
  const [blend, setBlend] = useState<BlendDaArte | null>(null);
  const [falhaDaFoto, setFalhaDaFoto] = useState(false);
  // "Remover marcação" (achado do QA, 28/09/2026): não existia como
  // desfazer o mockup salvo — a única saída era marcar em cima de novo.
  const [removendo, setRemovendo] = useState(false);
  const [larguraDoPalco, refDoPalco, onLayoutDoPalco] = useLargura();
  const [larguraDoEditor, refDoEditor, onLayoutDoEditor] = useLargura();

  // Desligou o lado que estava aberto: volta para a frente.
  useEffect(() => { if (lado !== ladoAtivo) setLado(ladoAtivo); }, [lado, ladoAtivo]);

  function patch(l: LadoDaPeca, p: Partial<RascunhoDoLado>) {
    setRascunhos((atual) => ({ ...atual, [l]: { ...atual[l], ...p } }));
  }

  // Foto marcada antes sem w/h (ou gravada por outro caminho): mede.
  useEffect(() => {
    if (!r.photo_url || (r.w && r.h)) return;
    let vivo = true;
    const l = ladoAtivo;
    const url = r.photo_url;
    medirFotoNativa(url).then((m) => {
      if (!vivo) return;
      if (!m) { setFalhaDaFoto(true); return; }
      setRascunhos((atual) => {
        const a = atual[l];
        if (a.photo_url !== url) return atual;
        return { ...atual, [l]: { ...a, w: m.w, h: m.h, quad: a.quad || quadInicial(l, m, areaImpressaDoLado(config, l)) } };
      });
    });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.photo_url, r.w, r.h, ladoAtivo]);

  async function escolherFoto(url: string) {
    const l = ladoAtivo;
    setFalhaDaFoto(false);
    if (rascunhos[l].photo_url === url && rascunhos[l].quad) return;
    const m = await medirFotoNativa(url);
    if (!m) setFalhaDaFoto(true);
    const medida = m || { w: 1, h: 1 };
    patch(l, {
      photo_url: url,
      w: m ? m.w : null,
      h: m ? m.h : null,
      quad: quadInicial(l, medida, areaImpressaDoLado(config, l)),
    });
  }

  function refazer() {
    if (!r.photo_url) return;
    patch(ladoAtivo, { quad: quadInicial(ladoAtivo, { w: r.w || 1, h: r.h || 1 }, cm) });
  }

  // ── Arraste ─────────────────────────────────────────────
  const aspecto = r.w && r.h ? r.h / r.w : 1.2;
  const alturaDoEditor = Math.round(larguraDoEditor * aspecto);
  const noInicio = useRef<VisualQuad | null>(null);
  const medidas = useRef({ w: 0, h: 0, quad: r.quad as VisualQuad | null, lado: ladoAtivo });
  medidas.current = { w: larguraDoEditor, h: alturaDoEditor, quad: r.quad, lado: ladoAtivo };

  function onInicio() { noInicio.current = medidas.current.quad; }
  function onArrastar(i: number, dxPx: number, dyPx: number) {
    const q0 = noInicio.current;
    const { w, h, lado: l } = medidas.current;
    if (!q0 || !w || !h) return;
    const q = cantoEm(q0, i, { x: q0[i].x + dxPx / w, y: q0[i].y + dyPx / h });
    patch(l, { quad: q });
  }
  function onFim() { noInicio.current = null; }
  function onTecla(i: number, tecla: string, shift: boolean): boolean {
    const passo = passoDaTecla(tecla, shift);
    const { quad, lado: l } = medidas.current;
    if (!passo || !quad) return false;
    patch(l, { quad: moverCanto(quad, i, passo.dx, passo.dy) });
    return true;
  }

  // ── Estado derivado ─────────────────────────────────────
  const valido = quadDaFotoValido(r.quad);
  const paraGravar = ladoParaGravar(r);
  const salvo = !!paraGravar && mesmaMarcacao(paraGravar, gravado[ladoAtivo]);
  const semFotos = fotos.length === 0;
  const vazio = !r.photo_url;
  const podeSalvar = !!paraGravar && !salvo && !salvando;

  async function salvar() {
    if (!paraGravar) return;
    await onSalvar(configComLado(config, ladoAtivo, paraGravar));
  }

  const temMarcacaoGravada = !!gravado[ladoAtivo];

  async function remover() {
    if (!temMarcacaoGravada || salvando || removendo) return;
    setRemovendo(true);
    try {
      const ok = await onSalvar(configSemLado(config, ladoAtivo));
      // Volta o rascunho local ao vazio: sem isto, a marcação recém-
      // removida reaparecia como "há o que salvar" (o rascunho local ainda
      // tinha a foto e o quad de antes, comparando contra um `gravado`
      // agora vazio).
      if (ok) patch(ladoAtivo, rascunhoDoGravado(undefined));
    } finally {
      setRemovendo(false);
    }
  }

  function verComoCliente() {
    if (!slug) return;
    const url = studioStorefrontUrl(slug) + "/p/" + encodeURIComponent(productId);
    if (Platform.OS === "web") {
      try { window.open(url, "_blank"); } catch (e) { console.error("[MockupNaFoto] window.open failed", e); }
    } else {
      Linking.openURL(url).catch(() => undefined);
    }
  }

  // ── Prévia ao vivo (motor) ──────────────────────────────
  const canvasRef = useRef<any>(null);
  const vista = useMemo(() => {
    if (!r.photo_url || !r.quad) return null;
    const natural = { w: r.w || 1000, h: r.h || Math.round(1000 * aspecto) };
    if (valido) {
      return vistaDaMarcacao(ladoAtivo, { photo_url: r.photo_url, quad: r.quad, shading: r.forca }, natural, cm);
    }
    // Cantos cruzados: a prévia mostra só a foto, sem arte deformada.
    return {
      id: ladoAtivo, label: ROTULO_DO_LADO[ladoAtivo], base: { w: natural.w, h: natural.h },
      photo_url: r.photo_url, garment: null, areas: [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.photo_url, JSON.stringify(r.quad), r.forca, r.w, r.h, valido, ladoAtivo, cm.width_cm, cm.height_cm]);

  // A foto que entrou sem a luz (sem CORS) ou não entrou: a prévia diz,
  // em vez de mostrar a arte num quadro cinza (QA 28/09/2026).
  const [notaDaPrevia, setNotaDaPrevia] = useState<string | null>(null);
  useEffect(() => {
    if (Platform.OS !== "web" || !vista || !canvasRef.current) return;
    let vivo = true;
    // Um quadro por vez: o arraste gera dezenas de quads por segundo e o
    // motor descarta composições velhas, mas não precisa recebê-las.
    const id = requestAnimationFrame(() => {
      composeView(canvasRef.current, vista as any, valido ? valoresDaArte(arte) : {}, {
        pixelWidth: 720, artColor: "#BE185D", font: "Georgia, serif",
      }).then((r) => { if (vivo && r) setNotaDaPrevia(notaDaComposicao(r)); })
        .catch((e) => console.error("[MockupNaFoto] composeView error", e?.message || e));
    });
    return () => { vivo = false; cancelAnimationFrame(id); };
  }, [vista, arte, valido]);

  useEffect(() => {
    if (!vista || !valido) { setBlend(null); return; }
    let vivo = true;
    blendDaVista(vista as any).then((b) => { if (vivo) setBlend(b); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [vista, valido]);

  const larga = larguraDoPalco >= 640;
  const forcaPct = Math.round(r.forca * 100);

  // ── Render ──────────────────────────────────────────────
  return (
    <View style={s.secao} testID="mockup-na-foto">
      <View style={s.cabeca}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <View style={s.tituloLinha}>
            <Text style={s.titulo} accessibilityRole="header">Mockup na foto</Text>
            <View style={s.novo}><Text style={s.novoTxt}>NOVO</Text></View>
          </View>
          <Text style={s.ajuda}>
            Marque na foto onde a arte cai. O cliente vê a arte dele exatamente aí, com a luz e as dobras da sua foto.
          </Text>
        </View>
        {lados.length > 1 ? (
          <View style={s.lados} accessibilityRole="tablist">
            {lados.map((l) => {
              const sel = l === ladoAtivo;
              const marcado = !!gravado[l];
              return (
                <Pressable
                  key={l}
                  onPress={() => setLado(l)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={ROTULO_DO_LADO[l] + (marcado ? ", marcado" : "")}
                  style={[s.ladoBtn, sel && { backgroundColor: t.primary }]}
                >
                  <Text style={[s.ladoTxt, sel && { color: "#fff" }]}>{ROTULO_DO_LADO[l]}</Text>
                  {marcado ? <View style={[s.marca, { backgroundColor: t.success }]} /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {temModeloVinculado ? (
        <View style={[s.aviso, { backgroundColor: t.infoSoft }]} testID="aviso-modelo">
          <Icon name="info" size={15} color={t.infoInk} />
          <Text style={[s.avisoTxt, { color: t.infoInk }]}>
            Este produto usa um modelo da Aura (3D ou foto de estúdio), e é ele que a vitrine mostra. A marcação na foto passa a valer se você escolher “Sem mockup” em Mockup do produto.
          </Text>
        </View>
      ) : null}

      {semFotos ? (
        <View style={[s.vazio, { minHeight: 180 }]} testID="sem-fotos">
          <View style={s.vazioIcone}><Icon name="image" size={24} color={t.primary} /></View>
          <Text style={s.vazioTitulo}>Este produto ainda não tem foto</Text>
          <Text style={s.vazioTxt}>Adicione as fotos da peça na aba Dados. Depois volte aqui para marcar onde a arte cai.</Text>
        </View>
      ) : (
        <>
          <Text style={s.rotulo}>{"Foto " + DO_LADO[ladoAtivo]}</Text>
          <View style={s.galeria}>
            {fotos.map((u, i) => {
              const sel = r.photo_url === u;
              return (
                <Pressable
                  key={u}
                  testID={"foto-" + i}
                  onPress={() => escolherFoto(u)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={"Usar a foto " + (i + 1)}
                  style={[s.miniatura, sel && { borderColor: t.accent, borderWidth: 2.5 }]}
                >
                  <Image source={{ uri: u }} style={s.miniaturaImg} resizeMode="cover" />
                  {i === 0 ? <View style={s.capa}><Text style={s.capaTxt}>Capa</Text></View> : null}
                </Pressable>
              );
            })}
            <Text style={s.dica}>As fotos da galeria do produto. Prefira a peça inteira, de frente.</Text>
          </View>

          <View
            style={[s.palco, larga && { flexDirection: "row" }]}
            ref={refDoPalco}
            onLayout={onLayoutDoPalco}
          >
            <View style={[s.quadro, larga && { flex: 1.25 }]}>
              <View style={s.quadroCab}>
                <Text style={s.quadroTitulo}>Onde a arte cai</Text>
                <Text style={s.quadroSub}>Arraste os quatro cantos até as bordas da área de impressão.</Text>
              </View>
              {vazio ? (
                <View style={s.vazio} testID="vazio">
                  <View style={s.vazioIcone}><Icon name="camera" size={24} color={t.primary} /></View>
                  <Text style={s.vazioTitulo}>Escolha uma foto da peça para começar</Text>
                  <Text style={s.vazioTxt}>Use uma foto de frente, com a peça inteira e bem iluminada.</Text>
                </View>
              ) : (
                <View
                  style={s.editor}
                  ref={refDoEditor}
                  onLayout={onLayoutDoEditor}
                >
                  <View style={{ width: "100%", height: alturaDoEditor || 320 }}>
                    <Image source={{ uri: r.photo_url as string }} style={s.fotoGrande} resizeMode="stretch" />
                    {r.quad && larguraDoEditor > 0 ? (
                      <>
                        <Svg width={larguraDoEditor} height={alturaDoEditor} style={StyleSheet.absoluteFill as any} pointerEvents="none">
                          <Polygon
                            points={r.quad.map((p) => p.x * larguraDoEditor + "," + p.y * alturaDoEditor).join(" ")}
                            fill={valido ? "rgba(236,72,153,0.10)" : "rgba(220,38,38,0.12)"}
                            stroke={valido ? t.accent : t.danger}
                            strokeWidth={2}
                            strokeDasharray="7,5"
                          />
                        </Svg>
                        <View
                          pointerEvents="none"
                          style={[s.rotuloCm, {
                            left: ((r.quad[0].x + r.quad[1].x) / 2) * larguraDoEditor - 48,
                            top: Math.min(r.quad[0].y, r.quad[1].y) * alturaDoEditor - 36,
                          }]}
                        >
                          <Text style={s.rotuloCmTxt} numberOfLines={1}>{cm.width_cm + " × " + cm.height_cm + " cm"}</Text>
                        </View>
                        {r.quad.map((p, i) => (
                          <Alca
                            key={i}
                            indice={i}
                            x={p.x * larguraDoEditor}
                            y={p.y * alturaDoEditor}
                            t={t}
                            s={s}
                            onInicio={onInicio}
                            onArrastar={onArrastar}
                            onFim={onFim}
                            onTecla={onTecla}
                          />
                        ))}
                      </>
                    ) : null}
                  </View>
                </View>
              )}
            </View>

            <View style={[s.quadro, larga && { flex: 1 }]}>
              <View style={s.quadroCab}>
                <Text style={s.quadroTitulo}>Prévia ao vivo</Text>
                <Text style={s.quadroSub}>Como o cliente vê na vitrine</Text>
              </View>
              <View style={s.previa}>
                {Platform.OS === "web" && vista ? (
                  // @ts-ignore — canvas DOM no web (motor compose2d)
                  <>
                    <canvas ref={canvasRef} style={{ width: "100%", display: "block", borderRadius: 10 } as any} />
                    {notaDaPrevia ? <Text style={[s.quadroSub, { marginTop: 6, textAlign: "center" }]}>{notaDaPrevia}</Text> : null}
                  </>
                ) : (
                  <View style={s.previaVazia}>
                    <Text style={s.previaVaziaTxt}>
                      {Platform.OS === "web" ? "A prévia aparece aqui" : "A prévia ao vivo aparece no painel pelo navegador"}
                    </Text>
                  </View>
                )}
              </View>
              <View style={s.artes} accessibilityRole="radiogroup" accessibilityLabel="Arte de exemplo">
                {([["selo", "Arte de exemplo"], ["nome", "Só o nome"], ["foto", "Foto do cliente"]] as Array<[ArteDeExemplo, string]>).map(([id, rot]) => {
                  const sel = arte === id;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => setArte(id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: sel }}
                      style={[s.arteBtn, sel && { borderColor: t.primary, backgroundColor: t.primaryGhost }]}
                    >
                      <Text style={[s.arteTxt, sel && { color: t.primary }]}>{rot}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={[s.controles, larga && { flexDirection: "row", alignItems: "flex-end" }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={s.assentarLinha}>
                <Text style={s.assentarRot} nativeID="rotulo-assentar">Assentar na foto</Text>
                <Text style={s.assentarValor}>{forcaPct + "%"}</Text>
              </View>
              {Platform.OS === "web" ? (
                // @ts-ignore — input nativo do navegador: teclado, toque e leitor de tela de graça
                <input
                  type="range" min={0} max={100} step={5} value={forcaPct}
                  aria-labelledby="rotulo-assentar"
                  aria-describedby="ajuda-assentar"
                  data-testid="assentar"
                  onChange={(e: any) => patch(ladoAtivo, { forca: Number(e.target.value) / 100 })}
                  disabled={vazio}
                  style={{ width: "100%", accentColor: t.accent, margin: "8px 0 2px", minHeight: 28 } as any}
                />
              ) : (
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <Pressable
                    onPress={() => patch(ladoAtivo, { forca: Math.max(0, Math.round(r.forca * 20 - 1) / 20) })}
                    accessibilityLabel="Menos sombreado" style={s.passoBtn} disabled={vazio}
                  >
                    <Icon name="minus" size={16} color={t.ink2} />
                  </Pressable>
                  <View style={s.trilho}><View style={[s.trilhoCheio, { width: forcaPct + "%" as any, backgroundColor: t.accent }]} /></View>
                  <Pressable
                    onPress={() => patch(ladoAtivo, { forca: Math.min(1, Math.round(r.forca * 20 + 1) / 20) })}
                    accessibilityLabel="Mais sombreado" style={s.passoBtn} disabled={vazio}
                  >
                    <Icon name="plus" size={16} color={t.ink2} />
                  </Pressable>
                </View>
              )}
              <View style={s.extremos}>
                <Text style={s.extremoTxt}>Arte chapada</Text>
                <Text style={s.extremoTxt}>Luz e dobras fortes</Text>
              </View>
              <Text style={s.assentarAjuda} nativeID="ajuda-assentar">Quanto da luz e das dobras da sua foto aparece por cima da arte.</Text>
            </View>
            <View style={s.acoes}>
              {slug ? (
                <Pressable
                  onPress={verComoCliente}
                  style={[s.botao, s.botaoLink]}
                  accessibilityRole="link"
                  accessibilityLabel="Ver a peça como cliente, na vitrine"
                >
                  <Icon name="external_link" size={14} color={t.primary} />
                  <Text style={[s.botaoTxt, { color: t.primary }]}>Ver como cliente</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={refazer}
                disabled={vazio}
                accessibilityLabel="Refazer marcação"
                style={[s.botao, s.botaoSecundario, vazio && { opacity: 0.5 }]}
                accessibilityRole="button"
              >
                <Text style={[s.botaoTxt, { color: t.ink2 }]}>Refazer marcação</Text>
              </Pressable>
              {temMarcacaoGravada ? (
                <Pressable
                  testID="remover-marcacao"
                  onPress={remover}
                  disabled={salvando || removendo}
                  accessibilityLabel="Remover marcação"
                  style={[s.botao, s.botaoSecundario, (salvando || removendo) && { opacity: 0.5 }]}
                  accessibilityRole="button"
                >
                  <Text style={[s.botaoTxt, { color: t.dangerInk }]}>
                    {removendo ? "Removendo..." : "Remover marcação"}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                testID="salvar-posicao"
                onPress={salvar}
                disabled={!podeSalvar}
                style={[s.botao, { backgroundColor: podeSalvar ? t.primary : t.ink5 }]}
                accessibilityRole="button"
                accessibilityState={{ disabled: !podeSalvar }}
                accessibilityLabel={salvando ? "Salvando..." : salvo ? "Posição salva" : "Salvar posição"}
              >
                <Text style={[s.botaoTxt, { color: podeSalvar ? "#fff" : t.ink3 }]}>
                  {salvando ? "Salvando..." : salvo ? "Posição salva" : "Salvar posição"}
                </Text>
              </Pressable>
            </View>
          </View>

          {!vazio ? (
            <View style={s.chips}>
              <View style={s.chip}><Text style={s.chipTxt}>{"Área " + DO_LADO[ladoAtivo] + ": " + cm.width_cm + " × " + cm.height_cm + " cm"}</Text></View>
              {blend ? (
                <View style={s.chip}>
                  <Text style={s.chipTxt}>
                    {blend.modo === "multiply"
                      ? "Peça clara: a arte entra como tinta no tecido"
                      : "Peça escura: a arte entra por cima, levemente translúcida"}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Achado do QA (28/09/2026): a foto marcada mostra a peça na cor
              em que foi fotografada, mas a produção segue a cor que a
              cliente escolher na compra — sem isto a lojista podia achar
              que a prévia já reflete a cor escolhida. */}
          {!vazio && temCampoDeCor(config) ? (
            <View style={[s.aviso, { backgroundColor: t.infoSoft }]} testID="aviso-cor">
              <Icon name="info" size={15} color={t.infoInk} />
              <Text style={[s.avisoTxt, { color: t.infoInk }]}>
                A foto mostra a peça na cor fotografada; a cor escolhida pela cliente vai na produção.
              </Text>
            </View>
          ) : null}
          {falhaDaFoto ? (
            <View style={[s.aviso, { backgroundColor: t.warningSoft }]}>
              <Icon name="alert_circle" size={15} color={t.warningInk} />
              <Text style={[s.avisoTxt, { color: t.warningInk }]}>
                Não foi possível medir esta foto. A marcação vale, mas a prévia pode sair com a proporção errada.
              </Text>
            </View>
          ) : null}
          {!vazio && r.quad && !valido ? (
            <View style={[s.aviso, { backgroundColor: t.warningSoft }]} testID="aviso-cruzado">
              <Icon name="alert_circle" size={15} color={t.warningInk} />
              <Text style={[s.avisoTxt, { color: t.warningInk }]}>
                Os cantos se cruzaram. Arraste até formar um quadrilátero, cada canto no seu lado.
              </Text>
            </View>
          ) : null}
          {salvo && !temModeloVinculado ? (
            <View style={[s.aviso, { backgroundColor: t.successSoft }]} accessibilityLiveRegion="polite">
              <Icon name="check" size={15} color={t.successInk} />
              <Text style={[s.avisoTxt, { color: t.successInk }]}>
                Posição salva. A vitrine já mostra a arte do cliente nesta foto.
              </Text>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
    secao: {
      backgroundColor: t.paperCard, borderColor: t.primarySoft, borderWidth: 1.5, borderRadius: 16,
      padding: 16, gap: 12,
    },
    cabeca: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
    tituloLinha: { flexDirection: "row", alignItems: "center", gap: 8 },
    titulo: { fontSize: 16, fontWeight: "800", color: t.ink, letterSpacing: -0.2 },
    novo: { backgroundColor: t.accentSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
    novoTxt: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.4, color: t.accentInk },
    ajuda: { marginTop: 6, color: t.ink2, fontSize: 13, lineHeight: 19, maxWidth: 620 },

    lados: { flexDirection: "row", backgroundColor: t.bgSoft, borderRadius: 999, padding: 3, gap: 2 },
    ladoBtn: {
      minHeight: 44, minWidth: 64, paddingHorizontal: 16, borderRadius: 999,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    },
    ladoTxt: { fontSize: 13, fontWeight: "700", color: t.ink3 },
    marca: { width: 7, height: 7, borderRadius: 4 },

    aviso: { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 12, borderRadius: 12 },
    avisoTxt: { flex: 1, fontSize: 13, lineHeight: 18 },

    rotulo: { fontSize: 11.5, fontWeight: "800", color: t.ink3, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 4 },
    galeria: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
    miniatura: {
      width: 76, height: 92, borderRadius: 12, overflow: "hidden",
      borderWidth: 2, borderColor: t.ink5, backgroundColor: t.bgSoft,
    },
    miniaturaImg: { width: "100%", height: "100%" },
    capa: { position: "absolute", left: 4, top: 4, backgroundColor: "rgba(15,23,42,0.72)", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
    capaTxt: { color: "#fff", fontSize: 9.5, fontWeight: "800" },
    dica: { color: t.ink3, fontSize: 12.5, maxWidth: 240 },

    palco: { gap: 14 },
    quadro: { backgroundColor: t.bgSoft, borderRadius: 14, overflow: "hidden", minWidth: 0 },
    quadroCab: {
      flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center",
      gap: 4, paddingHorizontal: 12, paddingTop: 10,
    },
    quadroTitulo: { fontSize: 13, fontWeight: "700", color: t.ink },
    quadroSub: { fontSize: 12, color: t.ink3 },

    editor: { margin: 12, marginTop: 10 },
    fotoGrande: { width: "100%", height: "100%", borderRadius: 10 },
    alca: { position: "absolute", width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    alcaPonto: { width: 20, height: 20, borderRadius: 10, borderWidth: 3 },
    rotuloCm: {
      position: "absolute", width: 96, alignItems: "center",
    },
    rotuloCmTxt: {
      backgroundColor: t.primary, color: "#fff", fontSize: 11, fontWeight: "700",
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden",
    },

    vazio: {
      margin: 12, marginTop: 10, minHeight: 320, borderRadius: 12, borderWidth: 2, borderStyle: "dashed",
      borderColor: t.ink4, alignItems: "center", justifyContent: "center", padding: 24, gap: 4,
    },
    vazioIcone: {
      width: 52, height: 52, borderRadius: 16, backgroundColor: t.primarySoft,
      alignItems: "center", justifyContent: "center", marginBottom: 6,
    },
    vazioTitulo: { fontSize: 15, fontWeight: "700", color: t.ink, textAlign: "center" },
    vazioTxt: { fontSize: 13, color: t.ink3, textAlign: "center", maxWidth: 360 },

    previa: { margin: 12, marginTop: 10 },
    previaVazia: {
      minHeight: 240, borderRadius: 10, backgroundColor: "#ECEAE4",
      alignItems: "center", justifyContent: "center", padding: 16,
    },
    previaVaziaTxt: { color: "#94A3B8", fontSize: 14, fontWeight: "600", textAlign: "center" },
    artes: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 12, paddingBottom: 12 },
    arteBtn: {
      minHeight: 44, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: t.ink5,
      backgroundColor: t.paperCardElev, alignItems: "center", justifyContent: "center",
    },
    arteTxt: { fontSize: 12.5, fontWeight: "600", color: t.ink2 },

    controles: { gap: 14 },
    assentarLinha: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    assentarRot: { fontSize: 13.5, fontWeight: "700", color: t.ink },
    assentarValor: { fontSize: 13.5, fontWeight: "700", color: t.primary },
    extremos: { flexDirection: "row", justifyContent: "space-between" },
    extremoTxt: { fontSize: 12, color: t.ink3 },
    assentarAjuda: { fontSize: 12.5, color: t.ink3 },
    passoBtn: {
      width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: t.ink4,
      alignItems: "center", justifyContent: "center",
    },
    trilho: { flex: 1, height: 6, borderRadius: 3, backgroundColor: t.ink5, overflow: "hidden" },
    trilhoCheio: { height: 6 },

    acoes: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" },
    botao: {
      minHeight: 44, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1.5, borderColor: "transparent",
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    },
    botaoSecundario: { borderColor: t.ink4, backgroundColor: "transparent" },
    botaoLink: { borderColor: t.primaryBorder, backgroundColor: t.primaryGhost },
    botaoTxt: { fontSize: 13.5, fontWeight: "700" },

    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { backgroundColor: t.bgSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    chipTxt: { fontSize: 12, color: t.ink2 },
  });
}

export default MockupNaFotoSecao;
