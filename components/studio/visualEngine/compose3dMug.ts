// ============================================================
// AURA STUDIO · visualEngine/compose3dMug — F4 (motor 3D caneca)
//
// Módulo puro (sem React): monta a cena three.js da peça com a
// personalização aplicada como CanvasTexture. A caneca é PROCEDURAL
// (corpo torneado + alça + borda); desde 27/09/2026 qualquer outra peça
// entra como GLB (`model.kind = 'glb'` + url), com a camiseta como
// primeiro caso — a cena de estúdio, o update, o snapshot e o vídeo são
// os mesmos para as duas.
//
// Áreas painel/wrap (e front/back na camiseta) vêm da spec (uv por
// área). Mesmo contrato de values do 2D: { text, image, ... }
// (fieldId → valor).
//
// Handle devolvido: update(), snapshot(px), recordTurntable(ms),
// dispose(). Drag pra girar + auto-rotate até o 1º toque.
//
// F5 (03/07/2026): recordTurntable — grava uma volta completa (~4s)
// via canvas.captureStream + MediaRecorder (webm). Zero infra: o
// vídeo nasce no browser do lojista, igual ao demo aprovado.
//
// 04/09/2026 — acabamento de estúdio. A cena era um cilindro sobre um
// fundo chapado, com uma ambiente e duas direcionais, sem sombra e sem
// reflexo: a Imperial dourada renderizava PRETA (metal sem ambiente
// para refletir) e a Chopp sumia. Agora: fundo em gradiente (papel
// quente, o tom da vitrine), chão com sombra de contato e sombra
// projetada macia, luz de três pontos e um mapa de ambiente gerado de
// uma "sala de softbox" procedural (PMREM do core do r128 — sem script
// extra do CDN). Saída em sRGB, com as cores do modelo convertidas, para
// o hex escolhido pelo cliente aparecer na tela como o hex que ele viu.
//
// 27/09/2026 — peça em GLB. O GLTFLoader do r128 é baixado do CDN só
// quando a spec pede; a peça é centrada e escalada para a altura da
// caneca (a cena inteira foi afinada para esse tamanho), a câmera recua
// pela caixa do modelo (uma camiseta de mangas abertas é mais larga que
// alta), e o mesh de impressão recebe a mesma CanvasTexture — com a cor
// do tecido e uma trama fina gerada em canvas por baixo da arte.
//
// 27/09/2026 (realismo) — a camiseta deixou de parecer plástico low-poly.
// A malha vem refinada do arquivo (scripts/studio/gerar-camiseta-glb.mjs:
// modelo original da Aura, com subdivisão, dobras e oclusão por vértice em
// COLOR_0). Aqui: a trama em
// escala real (fios por cm medidos pela área da spec, não "8 por
// ladrilho"), um relevo de dobras finas assado no mapa de normais junto
// com a trama, material físico de algodão (aspereza alta, sheen de veludo
// do r128 para o preto ter leitura), a arte assentada só onde há tinta
// (sem o retângulo escurecido da área) e o estúdio ajustado para peça
// vertical: luz principal mais alta e mancha de contato em elipse sob a
// barra.
//
// 28/09/2026 (realismo da caneca + cenário) — a caneca deixou de ser um
// cilindro fosco com um fio de borda: louça com lábio de espessura real
// (lathe de meio círculo), interior contínuo com filete no fundo e
// oclusão por vértice (mais escuro no fundo), filete arredondado na base,
// raízes onde a alça encontra o corpo, e material físico de esmalte
// (MeshPhysicalMaterial com clearcoat: a arte fica DEBAIXO do brilho,
// como sublimação, e o fresnel do verniz dá o reflexo suave nas bordas).
// O material do corpo não multiplica mais a textura pela cor do corpo —
// a textura já nasce com essa cor, e a arte clara numa caneca preta saía
// cinza. O ambiente virou um estúdio com strip vertical (o reflexo alto e
// fino da louça) e chão escuro. E o fundo 2D em gradiente deu lugar a um
// CICLORAMA 3D (chão que sobe em curva e vira parede), comum à caneca e
// à camiseta, que recebe a sombra projetada; `cenario: "nenhum"` desliga
// tudo isso e deixa o canvas transparente (miniaturas). A aritmética do
// cenário mora em mugScene.ts. Os chips Frente/Costas passaram a levar a
// um ângulo absoluto (antes só trocavam a área pintada).
//
// 03/07/2026 — F4/F5 do escopo Visualização 2D/3D (contrato no chat)
// ============================================================
import type { VisualArea, VisualTemplateSpec } from "@/services/studioVisualApi";
import { loadThree, loadGLTFLoader, loadDRACOLoader, DRACO_DECODER_PATH } from "./threeLoader";
import {
  readMugGeometry, heartPath, readMugMaterials, applyCustomerColor,
  readMugAccessories, latheProfile, squarePath, type MugMaterial,
  perfilDoLabio, perfilDoInterior, malhaDaAlca,
} from "./mugGeometry";
import {
  backdropPalette, cameraDistance, contactShadowRadius, floorLevel,
  hexToRgba, CAMERA_FOV_GRAUS,
  cenarioPalette, perfilDoCiclorama, brilhoDoCiclorama, CICLORAMA, giroMaisCurto,
} from "./mugScene";
import {
  readGlbModel, escalaDoModelo, cameraDistanceParaCaixa, floorLevelParaCaixa,
  sombraDeContatoParaCaixa, uvParaRetangulo, escolherMeshDeImpressao,
  recebeCorDoCliente, pixelsPorCm, fiosDoLadrilho,
  type GlbModel, type Caixa, type SombraDeContato,
} from "./glbModel";
// 28/09/2026 — formatação da arte: com `values.__arte` (vitrine) ou
// `values.__artePorArea` (render de aprovação com frente e verso) quem
// pinta a área é o pintor único; sem elas, o desenho de sempre.
import { arteDosValores, precarregarArte, pintarArteNaArea } from "./pintarArte";
import { misturaDaTecnica, type ArteDoLado } from "./layoutDaArte";

export type Mug3DOptions = {
  garmentColor?: string;  // cor ESCOLHIDA pelo cliente (incide onde o modelo mandar)
  bodyColor?: string;     // cor do corpo do modelo — fundo da textura (S11)
  bodyTopBand?: { color: string; height: number } | null;
  /** Opacidade do corpo: vidro pinta o fundo da textura translúcido e a arte opaca. */
  bodyOpacity?: number;
  artColor?: string;      // cor do texto/emblema
  font?: string;
  areaId?: string;        // 'panel' | 'wrap' | 'front' | 'back'
  /**
   * Cor base do fundo: o fundo da página onde o mockup está (o papel
   * quente da vitrine, ou o escuro). O cenário deriva a paleta dela.
   */
  backdrop?: string;
  /**
   * O que há em volta da peça (28/09/2026):
   *   "estudio"   — ciclorama 3D com chão, curva e parede, que recebe a
   *                 sombra da peça (padrão);
   *   "gradiente" — o fundo 2D de antes (gradiente de papel + halo);
   *   "nenhum"    — canvas transparente, só a peça e a sombra de contato
   *                 (miniaturas, lugares onde o cenário não cabe).
   * Só vale na criação do viewer; `update` e `trocarPeca` ignoram.
   */
  cenario?: Cenario;
  /**
   * Pixel ratio fixo do renderer. Sem ele, o do aparelho (até 2). A render
   * de aprovação passa 1: o canvas fora da tela já tem o tamanho do vídeo,
   * e o dpr 2 quadruplicava o trabalho por quadro (28/09/2026).
   */
  pixelRatio?: number;
};

export type Cenario = "estudio" | "gradiente" | "nenhum";

/**
 * O MIME do vídeo da aprovação. É um identificador de protocolo, não
 * texto para gente: o PR de acentuação (#822) pôs acento no "video" do
 * MIME, `MediaRecorder.isTypeSupported` passou a recusar e o vídeo saía
 * sem o bitrate configurado — e um blob sem tipo levava 400 no upload.
 * Guardado por __tests__/studioMimeDoVideo.
 */
export const MIME_DO_VIDEO = "video/webm";

/** Ponto do ponteiro na área de impressão, em fração da área (0..1; fora disso, fora da área). */
export type PontoNaArea = {
  u: number; v: number;
  /** Altura ÷ largura do retângulo da área na textura. */
  aspecto: number;
  /** A medida da área no modelo (spec), quando há. */
  areaCm: { w: number; h: number } | null;
  /** A área do produto pode passar do retângulo do modelo (a textura continua em volta). */
  transborda: boolean;
  /** Pixel não quadrado na peça (caneca); null no GLB. */
  pixel: number | null;
  /** Pixels de tela para 1,0 de u no ponto (derivada por um segundo raio). */
  pxPorU: number | null;
};

/**
 * Arraste da arte na peça (edição da vitrine). `tocar` decide se o
 * toque é da arte (true) ou do giro (false); enquanto for da arte, todo
 * ponteiro vai para `tocar`/`mover`/`soltar` — inclusive o segundo dedo
 * da pinça. `soltar` devolve true enquanto ainda houver dedo na arte.
 */
export type ArrasteDaPeca = {
  tocar: (p: PontoNaArea | null, e: PointerEvent) => boolean;
  mover: (p: PontoNaArea | null, e: PointerEvent) => void;
  soltar: (e: PointerEvent) => boolean;
};

export type Mug3DHandle = {
  update: (values: Record<string, any>, opts?: Mug3DOptions) => Promise<void>;
  /** Giro automático ligado/desligado (liga de novo mesmo depois de um toque). */
  giroAutomatico: (ligado: boolean) => void;
  /** Onde o ponteiro cai na área de impressão (raycast → UV → área); null fora da peça. */
  pontoNaArea: (clientX: number, clientY: number, areaId?: string) => PontoNaArea | null;
  /** Liga/desliga o arraste da arte (null = arrastar só gira a peça). */
  definirArraste: (a: ArrasteDaPeca | null) => void;
  /** Vira a peça para a área ficar de frente para a câmera. */
  mostrarArea: (areaId?: string) => void;
  /**
   * Troca a peça na MESMA cena e no mesmo WebGLRenderer (28/09/2026). A
   * vitrine continua criando um viewer por spec (Mug3DPreview); a prévia
   * da aba Aparência, que passa por vários modelos seguidos, reaproveita
   * um só — navegador tem teto de contextos WebGL por página.
   */
  trocarPeca: (spec: VisualTemplateSpec, values: Record<string, any>, opts?: Mug3DOptions) => Promise<void>;
  /** Remede o canvas (quem mudou o tamanho dele por fora chama). */
  resize: () => void;
  snapshot: (pixelWidth?: number) => string | null;
  recordTurntable: (durationMs?: number) => Promise<Blob | null>;
  /**
   * Gira a peça para `rotacaoY` radianos a partir da vista de repouso (a
   * frente) e renderiza na hora, no mesmo tick (28/09/2026, orçamento em
   * vídeo 3D). Para o giro automático; quem grava quadro a quadro (WebCodecs)
   * controla o ângulo exato de cada quadro e lê o canvas logo depois.
   */
  renderizarQuadro: (rotacaoY: number) => void;
  dispose: () => void;
};

const DEFAULTS: Required<Pick<Mug3DOptions, "garmentColor" | "artColor" | "font" | "areaId" | "backdrop" | "cenario">> = {
  garmentColor: "#F5F2EA",
  artColor: "#D85A30",
  font: "Georgia, serif",
  areaId: "panel",
  // O papel da vitrine: o mockup senta na página em vez de parecer colado.
  backdrop: "#FBF8F3",
  cenario: "estudio",
};

type Opcoes = typeof DEFAULTS & Mug3DOptions;

// Com teto de espera: uma imagem que nunca responde (rede presa, CDN
// sem CORS que o navegador decide reprocessar) deixava a pintura
// pendurada no `await` — e a textura, já apagada, nunca mais ganhava a
// arte. Sem a foto a caneca ainda mostra o texto; sem resposta, também.
function loadImg(url: string, limiteMs = 8000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const t = setTimeout(() => resolve(null), limiteMs);
    img.onload = () => { clearTimeout(t); resolve(img); };
    img.onerror = () => { clearTimeout(t); resolve(null); };
    img.src = url;
  });
}

function pickArea(spec: VisualTemplateSpec, areaId: string): VisualArea | null {
  const areas = spec.areas || [];
  return areas.find((a) => a.id === areaId) || areas[0] || null;
}

/**
 * A arte (foto + texto, ou só o texto) na área escolhida. É o mesmo desenho
 * para a caneca e para o GLB: o que muda entre eles é o fundo, pintado
 * antes por quem chama.
 */
async function paintArt(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  spec: VisualTemplateSpec,
  values: Record<string, any>,
  o: Opcoes
) {
  if (arteDosValores(values) || (values && values.__artePorArea)) {
    await pintarArteDaVitrine(ctx, W, H, spec, values, o);
    return;
  }
  const area = pickArea(spec, o.areaId);
  if (!area || !area.uv) return;
  const r = uvParaRetangulo(area.uv, W, H);
  const ax = r.x, aw = r.w, ay = r.y, ah = r.h;

  const text: string = values.text != null ? String(values.text) : "";
  const imageUrl: string | null = values.image || values.template || null;
  const cx = ax + aw / 2;
  const imgBoxH = ah * (text ? 0.55 : 0.85);

  if (imageUrl) {
    const img = await loadImg(imageUrl);
    if (img && img.width > 0) {
      const r = Math.min((aw * 0.9) / img.width, imgBoxH / img.height);
      const dw = img.width * r, dh = img.height * r;
      ctx.drawImage(img, cx - dw / 2, ay + (imgBoxH - dh) / 2, dw, dh);
    }
  }
  // QA 28/09 (item 10/CL-32): sem imagem da cliente, o motor desenhava um
  // "emblema" (sol e montanha, na cor da arte) acima do texto. Na peça ele
  // parecia parte da arte que seria impressa — e não é. Sem imagem, só o
  // texto, no meio da área (o mesmo que o 2D faz).

  if (text) {
    ctx.fillStyle = o.artColor;
    ctx.textAlign = "center";
    let fontPx = ah * 0.28;
    ctx.font = "600 " + Math.round(fontPx) + "px " + o.font;
    while (fontPx > 12 && ctx.measureText(text).width > aw * 0.92) {
      fontPx -= 4;
      ctx.font = "600 " + Math.round(fontPx) + "px " + o.font;
    }
    const ty = imageUrl
      ? ay + imgBoxH + (ah - imgBoxH) * 0.6 + fontPx * 0.3
      : ay + ah / 2 + fontPx * 0.35;
    ctx.fillText(text, cx, ty);
  }
}

/** A arte da vitrine, pelo pintor único — uma área, ou várias (frente e verso). */
async function pintarArteDaVitrine(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  spec: VisualTemplateSpec,
  values: Record<string, any>,
  o: Opcoes
) {
  const porArea = values && values.__artePorArea && typeof values.__artePorArea === "object"
    ? (values.__artePorArea as Record<string, ArteDoLado>)
    : null;
  const lista: Array<[VisualArea | null, ArteDoLado | null]> = porArea
    ? Object.keys(porArea).map((id) => [(spec.areas || []).find((a) => a.id === id) || null, arteDosValores({ __arte: porArea[id] })])
    : [[pickArea(spec, o.areaId), arteDosValores(values)]];
  const pixel = pixelDaTextura(spec, W, H);
  for (const [area, arte] of lista) {
    if (!area || !area.uv || !arte) continue;
    const r = uvParaRetangulo(area.uv, W, H);
    const imgs = await precarregarArte(arte, (u) => loadImg(u));
    pintarArteNaArea(ctx, r, arte, imgs, {
      mistura: misturaDaTecnica(arte.tecnica) === "multiply" ? "multiply" : null,
      areaCmDoMotor: area.width_cm > 0 && area.height_cm > 0 ? { w: area.width_cm, h: area.height_cm } : null,
      transbordar: true,
      pixel,
      // A textura inteira aparece pequena na tela: a guia acompanha ela.
      linha: Math.max(W, H) * 0.004,
    });
  }
}

/**
 * Caneca: quanto um pixel da textura vale na horizontal em relação à
 * vertical, na louça (a textura dá a volta no corpo e sobe a altura
 * dele). O GLB vem com a UV já em proporção (null = pixel quadrado).
 */
export function pixelDaTextura(spec: VisualTemplateSpec, W: number, H: number): number | null {
  if (readGlbModel(spec)) return null;
  const G = readMugGeometry(spec);
  const raio = (G.body.topRadius + G.body.bottomRadius) / 2;
  if (!(raio > 0) || !(G.body.height > 0) || !(W > 0) || !(H > 0)) return null;
  return (W / (2 * Math.PI * raio)) / (H / G.body.height);
}

async function paintTexture(
  texCv: HTMLCanvasElement,
  spec: VisualTemplateSpec,
  values: Record<string, any>,
  o: Opcoes
) {
  const ctx = texCv.getContext("2d");
  if (!ctx) return;
  const W = texCv.width, H = texCv.height;
  // S11 — o fundo da textura e a cor do CORPO do modelo, nao a escolha do
  // cliente. Numa caneca de alca colorida o corpo e branco e so a alca
  // segue a cor escolhida; pintar tudo apagava o produto.
  //
  // Vidro: o fundo leva a opacidade do corpo e a arte fica opaca por
  // cima — e um adesivo colado num copo, nao um copo pintado. Antes a
  // opacidade era do material inteiro e a arte sumia junto com o vidro.
  const alpha = typeof o.bodyOpacity === "number" ? o.bodyOpacity : 1;
  const fundo = o.bodyColor || o.garmentColor;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = alpha < 1 ? hexToRgba(fundo, alpha) : fundo;
  ctx.fillRect(0, 0, W, H);
  // Faixa esmaltada no topo (S11). v cresce pra cima na UV e o canvas pra
  // baixo, entao o topo da caneca e y=0 aqui.
  if (o.bodyTopBand && o.bodyTopBand.height > 0) {
    ctx.fillStyle = o.bodyTopBand.color;
    ctx.fillRect(0, 0, W, Math.round(H * o.bodyTopBand.height));
  }

  await paintArt(ctx, W, H, spec, values, o);
}

// ── Tecido (GLB) ─────────────────────────────────────────────

/** O que a peça de tecido gera uma vez e reusa a cada pintura. */
type Tecido = {
  /** Ladrilho da trama (64 px, `fios` fios por lado, repete sem emenda). */
  trama: HTMLCanvasElement;
  /** Relevo das dobras finas no tamanho da textura, em cinza (128 = plano). */
  dobras: HTMLCanvasElement;
};

/** Gerador determinístico: o mesmo pedido rende sempre o mesmo pixel (o hash da aprovação depende disso). */
function criarRnd(semente: number) {
  let s = semente;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

/**
 * Um ladrilho de trama: fios de urdidura e de trama alternando por cima
 * e por baixo, em cinza médio com variação pequena. Gerado em canvas —
 * nada é baixado — e com semente fixa. `fios` por lado vem da escala da
 * peça (fiosDoLadrilho): num algodão são ~8 por cm, e o ladrilho de 64 px
 * cobre ~3,5 cm de tecido — cada fio tem 2 px e a trama vira um grão
 * fino, como numa foto de produto, em vez de um xadrez.
 */
function tramaDoTecido(fios = 8): HTMLCanvasElement {
  const N = 64;
  const cv = document.createElement("canvas");
  cv.width = N; cv.height = N;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#6e6e6e"; // o vão entre os fios
  ctx.fillRect(0, 0, N, N);
  const passo = N / fios;
  const rnd = criarRnd(7);
  for (let y = 0; y < fios; y++) {
    for (let x = 0; x < fios; x++) {
      const porCima = (x + y) % 2 === 0;
      const b = 128 + (porCima ? 12 : -6) + Math.round((rnd() - 0.5) * 14);
      ctx.fillStyle = "rgb(" + b + "," + b + "," + b + ")";
      // Fios com 3/4 do passo: o quarto que sobra é o vão, e o canvas
      // interpola as frações de pixel.
      if (porCima) ctx.fillRect(x * passo + passo * 0.12, y * passo, passo * 0.76, passo);
      else ctx.fillRect(x * passo, y * passo + passo * 0.12, passo, passo * 0.76);
    }
  }
  return cv;
}

/**
 * Relevo das dobras finas do tecido: ruído de valor em duas oitavas, em
 * baixa resolução (1/8) e ampliado com interpolação — sai liso por
 * construção, nunca "amassado". O comprimento de onda é em centímetros
 * de tecido (pela escala da spec), para a dobra ter o tamanho de uma
 * dobra e não de um pixel. Cinza 128 é plano.
 */
function relevoDasDobras(W: number, H: number, pxPorCm: number | null, semente = 11): HTMLCanvasElement {
  const REDUCAO = 8;
  const w = Math.max(8, Math.round(W / REDUCAO)), h = Math.max(8, Math.round(H / REDUCAO));
  // ~4,5 cm por onda; sem escala conhecida, 1/24 da largura da textura.
  const onda = (pxPorCm ? pxPorCm * 4.5 : W / 24) / REDUCAO;
  const rnd = criarRnd(semente);
  const grade = 64;
  const valores = new Float32Array(grade * grade);
  for (let i = 0; i < valores.length; i++) valores[i] = rnd() * 2 - 1;
  const suave = (t: number) => t * t * (3 - 2 * t);
  const ruido = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), tx = suave(x - xi), ty = suave(y - yi);
    const v = (a: number, b: number) => valores[((b % grade) + grade) % grade * grade + ((a % grade) + grade) % grade];
    const cima = v(xi, yi) + (v(xi + 1, yi) - v(xi, yi)) * tx;
    const baixo = v(xi, yi + 1) + (v(xi + 1, yi + 1) - v(xi, yi + 1)) * tx;
    return cima + (baixo - cima) * ty;
  };
  const pequeno = document.createElement("canvas");
  pequeno.width = w; pequeno.height = h;
  const pctx = pequeno.getContext("2d")!;
  const img = pctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Dobras de roupa pendurada correm na vertical: a onda é 2× mais longa em y.
      const n = ruido(x / onda, y / (onda * 2)) + 0.5 * ruido(x / (onda * 0.45) + 37, y / (onda * 0.9) + 11);
      const g = Math.max(0, Math.min(255, Math.round(128 + n * 45)));
      const i = (y * w + x) * 4;
      img.data[i] = g; img.data[i + 1] = g; img.data[i + 2] = g; img.data[i + 3] = 255;
    }
  }
  pctx.putImageData(img, 0, 0);
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(pequeno, 0, 0, W, H);
  return cv;
}

/**
 * Mapa de normais do tecido no tamanho da textura: a trama (altura =
 * brilho do ladrilho, repetido pelo módulo) somada ao relevo das dobras.
 * É assado no tamanho cheio, e não como ladrilho com `repeat`, porque no
 * r128 o material só tem UMA transformação de UV — a do `map` — e o
 * repeat do normalMap é ignorado: o ladrilho de 64px viraria oito
 * quadrados gigantes sobre a camiseta inteira. As dobras são lidas com
 * passo largo (±4 px) porque a onda tem dezenas de pixels e a diferença
 * entre vizinhos seria ruído de arredondamento.
 */
function normalMapDoTecido(THREE: any, tecido: Tecido, W: number, H: number, forcaTrama = 3, forcaDobras = 16) {
  const N = tecido.trama.width;
  const trama = tecido.trama.getContext("2d")!.getImageData(0, 0, N, N).data;
  const dobras = tecido.dobras.getContext("2d")!.getImageData(0, 0, W, H).data;
  const alturaTrama = (x: number, y: number) => trama[(((y % N) + N) % N * N + ((x % N) + N) % N) * 4] / 255;
  const alturaDobra = (x: number, y: number) => dobras[(Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 4] / 255;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  const out = ctx.createImageData(W, H);
  const P = 4;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (alturaTrama(x + 1, y) - alturaTrama(x - 1, y)) * forcaTrama
        + (alturaDobra(x + P, y) - alturaDobra(x - P, y)) / (2 * P) * forcaDobras;
      const dy = (alturaTrama(x, y + 1) - alturaTrama(x, y - 1)) * forcaTrama
        + (alturaDobra(x, y + P) - alturaDobra(x, y - P)) / (2 * P) * forcaDobras;
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * W + x) * 4;
      out.data[i] = Math.round((-dx / len * 0.5 + 0.5) * 255);
      out.data[i + 1] = Math.round((-dy / len * 0.5 + 0.5) * 255);
      out.data[i + 2] = Math.round((1 / len * 0.5 + 0.5) * 255);
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return new THREE.CanvasTexture(cv);
}

/**
 * A textura da peça de tecido, em camadas:
 *   1. a cor do tecido;
 *   2. a trama por cima (overlay, para respeitar o tom escolhido);
 *   3. a arte, pintada num rascunho transparente e "assentada": a trama
 *      é multiplicada SÓ onde há tinta (destination-in pelo alfa da arte)
 *      e a borda ganha meio pixel de desfoque — tinta que penetra no fio,
 *      não adesivo. Antes a trama era multiplicada no retângulo inteiro da
 *      área, e o retângulo aparecia como uma mancha mais escura no tecido;
 *   4. o relevo das dobras em soft-light sobre tudo, arte incluída, para a
 *      dobra ter leitura mesmo onde a luz bate de frente.
 * Em tecido preto o overlay e o soft-light quase não mudam nada; a trama
 * e as dobras aparecem pelo mapa de normais e pelo sheen do material.
 */
async function paintFabricTexture(
  texCv: HTMLCanvasElement,
  spec: VisualTemplateSpec,
  values: Record<string, any>,
  o: Opcoes,
  tecido: Tecido
) {
  const ctx = texCv.getContext("2d");
  if (!ctx) return;
  const W = texCv.width, H = texCv.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = o.bodyColor || o.garmentColor;
  ctx.fillRect(0, 0, W, H);
  const padrao = ctx.createPattern(tecido.trama, "repeat");
  if (padrao) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = padrao;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  const arte = document.createElement("canvas");
  arte.width = W; arte.height = H;
  const actx = arte.getContext("2d");
  if (actx) {
    await paintArt(actx, W, H, spec, values, o);
    if (padrao) {
      const assentada = document.createElement("canvas");
      assentada.width = W; assentada.height = H;
      const sctx = assentada.getContext("2d")!;
      sctx.drawImage(arte, 0, 0);
      sctx.globalCompositeOperation = "multiply";
      sctx.globalAlpha = 0.35;
      sctx.fillStyle = padrao;
      sctx.fillRect(0, 0, W, H);
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = "destination-in";
      sctx.drawImage(arte, 0, 0);
      ctx.save();
      // Canvas sem `filter` (jsdom, navegador antigo) pinta a borda dura — ainda é a arte.
      if ("filter" in ctx) ctx.filter = "blur(0.6px)";
      ctx.drawImage(assentada, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(arte, 0, 0);
    }
  }

  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = 0.22;
  ctx.drawImage(tecido.dobras, 0, 0);
  ctx.restore();
}

// ── Cena de estúdio ──────────────────────────────────────────

/** Fundo: gradiente vertical de papel + halo atrás da peça, como textura 2D. */
function paintBackdrop(THREE: any, backdrop: string) {
  const cv = document.createElement("canvas");
  cv.width = 64; cv.height = 256;
  const ctx = cv.getContext("2d")!;
  const p = backdropPalette(backdrop);
  const g = ctx.createLinearGradient(0, 0, 0, cv.height);
  g.addColorStop(0, p.top);
  g.addColorStop(0.55, backdrop);
  g.addColorStop(1, p.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cv.width, cv.height);
  const halo = ctx.createRadialGradient(cv.width / 2, cv.height * 0.42, 0, cv.width / 2, cv.height * 0.42, cv.height * 0.5);
  halo.addColorStop(0, hexToRgba(p.glow, 0.55));
  halo.addColorStop(1, hexToRgba(p.glow, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, cv.width, cv.height);
  const tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

/** Mancha macia sob a peça: sombra de contato, independente da luz. */
function paintContactShadow(THREE: any) {
  const cv = document.createElement("canvas");
  cv.width = 256; cv.height = 256;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(40,30,20,0.42)");
  g.addColorStop(0.45, "rgba(40,30,20,0.18)");
  g.addColorStop(1, "rgba(40,30,20,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(cv);
}

/**
 * Mapa de ambiente de uma "sala de softbox": caixa de paredes cinza
 * quente com painéis luminosos (teto grande, lateral forte, lateral
 * fraca, contraluz). É o que a louça e o dourado refletem. Feito só com
 * o core do r128 — RoomEnvironment mora em examples/ e seria mais um
 * script do CDN para falhar.
 */
function buildEnvironment(THREE: any, renderer: any) {
  const sala = new THREE.Scene();
  // Paredes cinza quente; o chão mais escuro que o teto, para a metade de
  // baixo da louça refletir algo mais fundo (é o que "assenta" a peça).
  const parede = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.30, 0.285, 0.27), side: THREE.BackSide });
  sala.add(new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), parede));
  const painel = (w: number, h: number, cor: [number, number, number], pos: [number, number, number], rot: [number, number, number]) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(cor[0], cor[1], cor[2]), side: THREE.DoubleSide }),
    );
    m.position.set(pos[0], pos[1], pos[2]);
    m.rotation.set(rot[0], rot[1], rot[2]);
    sala.add(m);
  };
  painel(12, 12, [0.12, 0.115, 0.11], [0, -5.95, 0], [-Math.PI / 2, 0, 0]);  // chão escuro
  painel(7, 4, [2.0, 1.92, 1.75], [0, 5.9, 0], [Math.PI / 2, 0, 0]);         // softbox no teto
  // Strip vertical alto e estreito, à esquerda e um pouco à frente: é o
  // reflexo alto e fino que se vê em toda foto de caneca esmaltada.
  painel(1.2, 7, [3.2, 3.05, 2.8], [-5.9, 1.2, 2.6], [0, Math.PI / 2, 0]);
  painel(3, 6, [1.3, 1.25, 1.15], [-5.9, 1.5, -0.5], [0, Math.PI / 2, 0]);  // painel principal (esquerda)
  painel(2.4, 6, [0.75, 0.8, 0.95], [5.9, 1, 1.5], [0, -Math.PI / 2, 0]);   // preenchimento frio (direita)
  painel(5, 2, [1.2, 1.2, 1.2], [0, 3.5, -5.9], [0, 0, 0]);                  // contraluz
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(sala, 0.04);
  pmrem.dispose();
  return env.texture;
}

/**
 * Material de uma peça da caneca. Louça esmaltada é um material físico
 * com verniz (clearcoat): o esmalte brilha por cima da arte e do
 * pigmento, com fresnel nas bordas. O verniz é proporcional ao brilho
 * declarado no template — a Vintage fosca (roughness 0.95) não ganha
 * verniz nenhum; a louça de sempre (0.28) ganha o esmalte inteiro.
 * Metal (a Imperial) não leva verniz: dourado cromado já é o reflexo.
 */
function makeMaterial(THREE: any, m: MugMaterial, extra: Record<string, any> = {}) {
  const Material = THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial;
  const metal = m.metalness > 0.5;
  const verniz = metal ? 0 : Math.max(0, Math.min(1, (0.85 - m.roughness) / 0.35));
  const mat = new Material({
    color: new THREE.Color(m.color).convertSRGBToLinear(),
    roughness: m.roughness,
    metalness: m.metalness,
    transparent: m.opacity < 1,
    opacity: m.opacity,
    // Sem escrever profundidade nas transparentes: parede interna e
    // externa do vidro ficam no mesmo lugar e uma apagava a outra.
    depthWrite: m.opacity >= 1,
    envMapIntensity: metal ? 1.1 : 0.85,
    ...extra,
  });
  if ("clearcoat" in mat) {
    mat.clearcoat = verniz;
    mat.clearcoatRoughness = 0.06 + m.roughness * 0.4;
  }
  return mat;
}

/**
 * O ciclorama do estúdio: um plano dobrado pelo perfil de mugScene.ts
 * (chão → curva → parede), com a vinheta e o halo assados em cor por
 * vértice. Sem luz e sem tone mapping: a cor é a da paleta, exata — o
 * chão junto da peça é o papel da página. A sombra cai num receptor à
 * parte, com a mesma forma, um fio acima. É o mesmo para a caneca e a
 * camiseta — só o `chaoY` da peça o posiciona (ajustarCenaAPeca).
 */
function montarCiclorama(THREE: any, backdrop: string) {
  const p = cenarioPalette(backdrop);
  const C = CICLORAMA;
  const colunas = 24, linhas = 96;
  const geo = new THREE.PlaneGeometry(C.meiaLargura * 2, 1, colunas, linhas);
  const pos = geo.attributes.position;
  const cores = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    // v do plano vai de +0.5 (topo) a -0.5: t = 0 na frente do chão, 1 no topo da parede
    const t = 0.5 - pos.getY(i);
    const { y, z } = perfilDoCiclorama(t);
    pos.setXYZ(i, x, y, z);
    const b = brilhoDoCiclorama(x, y, z, p);
    cores[i * 3] = b; cores[i * 3 + 1] = b; cores[i * 3 + 2] = b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(cores, 3));
  geo.computeVertexNormals();
  // DoubleSide: o plano dobrado pelo perfil fica com a face original
  // virada para baixo/para trás — sem isto o ciclorama inteiro era
  // descartado e só o `background` aparecia.
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(p.base).convertSRGBToLinear(),
    vertexColors: true,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  const sombra = new THREE.Mesh(geo, new THREE.ShadowMaterial({ opacity: p.sombra, side: THREE.DoubleSide }));
  sombra.receiveShadow = true;
  return { mesh, sombra, fundo: new THREE.Color(p.fundo).convertSRGBToLinear(), escuro: p.escuro };
}

// ── A peça em cena ───────────────────────────────────────────
// O que cada tipo de peça entrega à cena compartilhada: o grupo que gira,
// a textura da arte, onde fica o chão e a mancha, como aplicar a cor do
// cliente e como pintar a textura. A caneca e o GLB implementam os dois
// lados; o resto do viewer não sabe qual dos dois está na frente da câmera.
type Peca = {
  group: any;
  texture: any;
  chaoY: number;
  /** Meios-eixos da mancha de contato (a caneca é um disco; a camiseta, uma elipse sob a barra). */
  sombra: SombraDeContato;
  /** Caixa da peça já escalada (só o GLB precisa: a câmera se ajusta a ela). */
  caixa: Caixa | null;
  /** Atualiza os materiais com a cor escolhida e devolve as opções de pintura. */
  aplicarOpcoes: (o: Opcoes) => Opcoes;
  pintar: (cv: HTMLCanvasElement, values: Record<string, any>, o: Opcoes) => Promise<void>;
  /** A malha que recebe a textura da arte (raycast do arraste). */
  malhaDaArte?: any;
};

function montarCaneca(THREE: any, spec: VisualTemplateSpec, renderer: any, texCv: HTMLCanvasElement, o: Opcoes): Peca {
  // S3 — a forma vem do `spec`, com os numeros de antes como default.
  // Template sem bloco de geometria renderiza exatamente como renderizava
  // (ver mugGeometry.ts).
  const Gspec = readMugGeometry(spec);
  // A base ganha um filete mínimo: uma quina viva no apoio não existe em
  // louça nenhuma. Template que declara um arredondamento maior manda.
  const G = { ...Gspec, body: { ...Gspec.body, bottomRound: Math.max(Gspec.body.bottomRound, 0.04) } };
  const acess = readMugAccessories(spec);
  const meiaAltura = G.body.height / 2;

  // S11 — cor e material vem do MODELO; a escolha do cliente incide so
  // nas pecas que o template declara em `customer_color_targets`.
  let M = applyCustomerColor(readMugMaterials(spec), o.garmentColor);

  const texture = new THREE.CanvasTexture(texCv);
  texture.encoding = THREE.sRGBEncoding;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
  // A opacidade do corpo mora no alfa da textura (ver paintTexture). A
  // COR também: a textura nasce pintada com a cor do corpo, então o
  // material fica branco — com a cor do corpo aqui, o three multiplicava
  // as duas e a arte clara de uma caneca preta saía cinza-escuro (e o
  // dourado da Imperial, mais escuro que o hex do template).
  const bodyMat = makeMaterial(THREE, { ...M.body, color: "#FFFFFF" }, { map: texture, opacity: 1 });
  const handleMat = makeMaterial(THREE, M.handle);
  const rimMat = makeMaterial(THREE, M.rim);
  const bottomMat = makeMaterial(THREE, M.bottom);
  // Interior com oclusão por vértice: mais escuro quanto mais fundo. Sem
  // isso o mapa de ambiente ilumina o fundo da caneca como se fosse a
  // borda, e o interior fica chapado.
  const innerMat = makeMaterial(THREE, M.interior, { vertexColors: true });
  // Vidro nao projeta sombra cheia; a mancha de contato segura a peca.
  const opaco = (m: MugMaterial) => m.opacity >= 0.5;

  const group = new THREE.Group();
  const corpo = new THREE.Mesh(
    new THREE.LatheGeometry(latheProfile(G.body).map((p) => new THREE.Vector2(p.x, p.y)), 96),
    bodyMat
  );
  corpo.castShadow = opaco(M.body);
  corpo.receiveShadow = true;
  group.add(corpo);
  const raioBase = G.body.bottomRadius - G.body.bottomRound;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(raioBase, 64), bottomMat);
  bottom.rotation.x = Math.PI / 2; bottom.position.y = -meiaAltura; group.add(bottom);
  // Lábio: meio círculo de fora para dentro, com a espessura da louça
  // (mugGeometry.perfilDoLabio). Substitui o toro fino de antes.
  const rim = new THREE.Mesh(
    new THREE.LatheGeometry(perfilDoLabio(G).map((p) => new THREE.Vector2(p.x, p.y)), 96),
    rimMat
  );
  rim.castShadow = opaco(M.rim);
  group.add(rim);
  // Interior: parede, filete e fundo num perfil só, do lábio ao eixo,
  // ordenado de cima para baixo (normais para dentro).
  const perfilInterior = perfilDoInterior(G);
  const innerGeo = new THREE.LatheGeometry(perfilInterior.map((p) => new THREE.Vector2(p.x, p.y)), 96);
  {
    // O LatheGeometry gera (segments + 1) cópias do perfil, ponto a ponto.
    const n = innerGeo.attributes.position.count;
    const cores = new Float32Array(n * 3);
    const porPonto = perfilInterior.length;
    for (let i = 0; i < n; i++) {
      const prof = perfilInterior[i % porPonto].profundidade;
      const b = 1 - 0.62 * Math.pow(prof, 0.85);
      cores[i * 3] = b; cores[i * 3 + 1] = b; cores[i * 3 + 2] = b;
    }
    innerGeo.setAttribute("color", new THREE.BufferAttribute(cores, 3));
  }
  const inner = new THREE.Mesh(innerGeo, innerMat);
  inner.receiveShadow = true;
  group.add(inner);
  // Vidro: parede interna e externa tem o mesmo centro, e o three ordena
  // as transparentes por distancia do centro — a interna podia ser
  // desenhada POR CIMA da externa e apagar a arte. A externa vai por
  // ultimo; e a mais perto da camera de qualquer angulo.
  inner.renderOrder = 1;
  corpo.renderOrder = 2; rim.renderOrder = 3;

  // Alca: anel (padrao), coracao ou nenhuma. A forma e o que se vende na
  // "CANECA ALCA CORACAO" — renderiza-la como anel apaga o produto.
  // VAZADA e um tubo que percorre a curva (anel: toro; coracao: tubo pela
  // curva do coracao). PREENCHIDA e a curva extrudada com chanfro — uma
  // orelha macica. Sao produtos diferentes e tem que se distinguir na tela.
  if (G.handle.shape !== "none") {
    const extrusao = {
      depth: G.handle.tube * 1.6,
      bevelEnabled: true,
      bevelThickness: G.handle.tube * 0.5,
      bevelSize: G.handle.tube * 0.5,
      bevelSegments: 6,
      curveSegments: 32,
    };
    let handleGeo: any;
    // 28/09/2026 (2ª rodada) — alça vazada como um tubo só, varrido do
    // corpo ao corpo (mugGeometry.malhaDaAlca): raiz alargada na própria
    // malha, seção cortada no plano da parede e ponta enterrada na louça.
    // Já vem em coordenadas do corpo (deslocada e inclinada). Alça que
    // não cruza a parede cai nas geometrias fechadas de antes.
    const varrida = malhaDaAlca(G);
    if (varrida) {
      handleGeo = new THREE.BufferGeometry();
      handleGeo.setAttribute("position", new THREE.Float32BufferAttribute(varrida.positions, 3));
      handleGeo.setIndex(varrida.indices);
      handleGeo.computeVertexNormals();
    } else if (G.handle.shape === "heart" && G.handle.filled) {
      const shape = new THREE.Shape();
      for (const cmd of heartPath(G.handle.radius + G.handle.tube)) {
        if (cmd.op === "moveTo") shape.moveTo(cmd.x, cmd.y);
        else shape.bezierCurveTo(cmd.c1x, cmd.c1y, cmd.c2x, cmd.c2y, cmd.x, cmd.y);
      }
      handleGeo = new THREE.ExtrudeGeometry(shape, extrusao);
      handleGeo.center();
    } else if (G.handle.shape === "heart") {
      const caminho = new THREE.CurvePath();
      let atual: any = null;
      for (const cmd of heartPath(G.handle.radius)) {
        const fim = new THREE.Vector3(cmd.x, cmd.y, 0);
        if (cmd.op === "bezierCurveTo" && atual) {
          caminho.add(new THREE.CubicBezierCurve3(
            atual, new THREE.Vector3(cmd.c1x, cmd.c1y, 0), new THREE.Vector3(cmd.c2x, cmd.c2y, 0), fim,
          ));
        }
        atual = fim;
      }
      handleGeo = new THREE.TubeGeometry(caminho, 96, G.handle.tube, 14, true);
    } else if (G.handle.shape === "square" && G.handle.filled) {
      const shape = new THREE.Shape();
      const pts = squarePath(G.handle.radius + G.handle.tube);
      shape.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) shape.lineTo(p.x, p.y);
      handleGeo = new THREE.ExtrudeGeometry(shape, extrusao);
      handleGeo.center();
    } else if (G.handle.shape === "square") {
      // Sem o ultimo ponto (repete o primeiro): a curva fechada ja emenda.
      const pts = squarePath(G.handle.radius).slice(0, -1).map((p) => new THREE.Vector3(p.x, p.y, 0));
      const curva = new THREE.CatmullRomCurve3(pts, true, "centripetal");
      handleGeo = new THREE.TubeGeometry(curva, 96, G.handle.tube, 14, true);
    } else if (G.handle.filled) {
      const disco = new THREE.Shape();
      disco.absarc(0, 0, G.handle.radius + G.handle.tube, 0, Math.PI * 2, false);
      handleGeo = new THREE.ExtrudeGeometry(disco, { ...extrusao, curveSegments: 48 });
      handleGeo.center();
    } else {
      handleGeo = new THREE.TorusGeometry(G.handle.radius, G.handle.tube, 20, 64);
    }
    const handle = new THREE.Mesh(handleGeo, handleMat);
    if (!varrida) {
      handle.position.set(G.handle.offsetX, G.handle.offsetY, 0);
      // SEM rotacao em Y. O coracao vem de uma curva no plano XY — a MESMA
      // orientacao do TorusGeometry, que tambem e XY. Girar 90 graus em Y
      // deixava o coracao de PERFIL para a camera, um risco vertical em vez
      // de uma alca. So a inclinacao no proprio plano (tilt, em Z) e aceita.
      handle.rotation.z = (G.handle.tilt * Math.PI) / 180;
    }
    handle.castShadow = opaco(M.handle);
    group.add(handle);
  }
  // S11 — acessorios do modelo. A colher da CANECA COM COLHER e o pires
  // da xicara sao parte do que se compra: sem eles o mockup mostra outro
  // produto. Na foto a colher fica de pe no vao da alca, com a concha
  // acima da borda — nao encostada na frente da caneca.
  if (acess.spoon) {
    const compr = G.body.height * 0.66;
    const topoDoCabo = meiaAltura + G.body.height * 0.1;
    const inclinacao = -0.12;
    const x = G.handle.offsetX + G.handle.radius * 0.1;
    const cabo = new THREE.Mesh(
      new THREE.BoxGeometry(G.handle.tube * 0.7, compr, G.handle.tube * 0.2),
      handleMat
    );
    cabo.position.set(x, topoDoCabo - compr / 2, 0);
    cabo.rotation.z = inclinacao;
    cabo.castShadow = opaco(M.handle);
    group.add(cabo);
    // A concha e uma elipse achatada, um quarto da largura do corpo.
    const raioConcha = G.body.topRadius * 0.23;
    const concha = new THREE.Mesh(new THREE.SphereGeometry(raioConcha, 24, 16), handleMat);
    concha.scale.set(0.7, 1, 0.3);
    concha.position.set(x - Math.sin(inclinacao) * compr * 0.5, topoDoCabo + raioConcha * 0.7, 0);
    concha.rotation.z = inclinacao;
    concha.castShadow = opaco(M.handle);
    group.add(concha);
  }
  if (acess.saucer) {
    const pires = new THREE.Mesh(
      new THREE.CylinderGeometry(G.body.topRadius * 1.95, G.body.topRadius * 1.72, G.body.height * 0.08, 64),
      handleMat
    );
    pires.position.y = -G.body.height / 2 - G.body.height * 0.05;
    pires.castShadow = true;
    group.add(pires);
  }

  group.rotation.y = Math.PI;

  return {
    group,
    texture,
    chaoY: floorLevel(G, acess),
    sombra: { rx: contactShadowRadius(G, acess), rz: contactShadowRadius(G, acess) },
    caixa: null,
    aplicarOpcoes(opcoes) {
      M = applyCustomerColor(readMugMaterials(spec), opcoes.garmentColor);
      handleMat.color.set(M.handle.color).convertSRGBToLinear();
      rimMat.color.set(M.rim.color).convertSRGBToLinear();
      bottomMat.color.set(M.bottom.color).convertSRGBToLinear();
      innerMat.color.set(M.interior.color).convertSRGBToLinear();
      // A PRIMEIRA pintura tambem precisa do fundo e da faixa certos: sem isto
      // o mockup nascia com a cor escolhida no corpo e so acertava no primeiro
      // update.
      return { ...opcoes, bodyColor: M.body.color, bodyTopBand: M.body.topBand ?? null, bodyOpacity: M.body.opacity };
    },
    pintar: (cv, values, opcoes) => paintTexture(cv, spec, values, opcoes),
    malhaDaArte: corpo,
  };
}

/**
 * Carrega o GLB. O Draco só é baixado se o arquivo exigir: o GLTFLoader
 * recusa um glTF com KHR_draco_mesh_compression sem decoder, e é essa
 * recusa que dispara a segunda tentativa.
 */
async function carregarGltf(THREE: any, url: string): Promise<any> {
  const GLTFLoader = await loadGLTFLoader();
  const tentar = (draco: any) => new Promise<any>((resolve, reject) => {
    const loader = new GLTFLoader();
    if (draco) loader.setDRACOLoader(draco);
    loader.load(url, resolve, undefined, reject);
  });
  try {
    return await tentar(null);
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (!/DRACOLoader/i.test(msg)) {
      throw new Error("Não foi possível carregar o modelo 3D" + (msg ? " (" + msg + ")" : ""));
    }
    const DRACOLoader = await loadDRACOLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_DECODER_PATH);
    return tentar(draco);
  }
}

async function montarGlb(
  THREE: any, spec: VisualTemplateSpec, glb: GlbModel, renderer: any, texCv: HTMLCanvasElement, o: Opcoes,
): Promise<Peca> {
  const gltf = await carregarGltf(THREE, glb.url);
  const modelo = gltf.scene || (gltf.scenes && gltf.scenes[0]);
  if (!modelo) throw new Error("O modelo 3D veio sem cena");
  const meshes: any[] = [];
  modelo.traverse((obj: any) => { if (obj.isMesh) meshes.push(obj); });
  if (!meshes.length) throw new Error("O modelo 3D não tem malha");

  const resumo = meshes.map((m) => ({
    name: String(m.name || (m.parent && m.parent.name) || ""),
    materialName: String((m.material && m.material.name) || ""),
    vertices: (m.geometry && m.geometry.attributes && m.geometry.attributes.position)
      ? m.geometry.attributes.position.count : 0,
  }));
  const iPrint = escolherMeshDeImpressao(resumo, glb.printMesh);
  const print = meshes[iPrint];
  // A cor que o arquivo dá ao tecido, para quando o cliente não escolhe
  // (ou o template não deixa a cor incidir no mesh de impressão).
  const corOriginal = print.material && print.material.color
    ? "#" + print.material.color.clone().convertLinearToSRGB().getHexString()
    : DEFAULTS.garmentColor;
  const alvos = meshes.map((_m, i) => recebeCorDoCliente(resumo[i], i === iPrint, glb.customerColorTargets));

  // Centra e escala pela altura — a cena inteira (luzes, câmera da sombra,
  // chão) foi afinada para a altura da caneca, e um GLB pode vir em
  // qualquer unidade.
  modelo.updateMatrixWorld(true);
  const caixa0 = new THREE.Box3().setFromObject(modelo);
  const tam0 = caixa0.getSize(new THREE.Vector3());
  const centro = caixa0.getCenter(new THREE.Vector3());
  const k = escalaDoModelo({ width: tam0.x, height: tam0.y, depth: tam0.z }, glb.scale);
  const pivo = new THREE.Group();
  modelo.position.set(-centro.x, -centro.y, -centro.z);
  pivo.add(modelo);
  pivo.scale.setScalar(k);
  const caixa: Caixa = { width: tam0.x * k, height: tam0.y * k, depth: tam0.z * k };

  const texture = new THREE.CanvasTexture(texCv);
  texture.encoding = THREE.sRGBEncoding;
  // O glTF guarda v crescendo para baixo; a spec, para cima (ver
  // glbModel.ts). Sem virar a imagem, o retângulo pintado em (1 - v1)·H
  // cai exatamente onde o mesh o lê.
  texture.flipY = false;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
  // A trama e as dobras em escala real: a spec diz quantos cm tem a área
  // e quantos pixels ela ocupa, e disso sai o passo dos fios.
  const pxPorCm = pixelsPorCm(spec, texCv.width);
  const tecido: Tecido = {
    trama: tramaDoTecido(fiosDoLadrilho(pxPorCm)),
    dobras: relevoDasDobras(texCv.width, texCv.height, pxPorCm),
  };
  const normalMap = glb.fabric.normalScale > 0 ? normalMapDoTecido(THREE, tecido, texCv.width, texCv.height) : null;
  if (normalMap) normalMap.flipY = false;
  // Algodão: material físico do r128 quando existe (o sheen — BRDF de
  // veludo — é o que dá ao preto a leitura de tecido: a luz raspa nos
  // fios da borda da silhueta). Sem sheen, um MeshStandardMaterial áspero.
  const Material = THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial;
  const fabricMat = new Material({
    map: texture,
    roughness: glb.fabric.roughness,
    metalness: 0,
    normalMap,
    normalScale: new THREE.Vector2(glb.fabric.normalScale, glb.fabric.normalScale),
    envMapIntensity: 0.45,
    // Roupa é uma casca: pela gola e pelas mangas se vê o lado de dentro.
    side: THREE.DoubleSide,
    // Oclusão assada por vértice (COLOR_0: axilas, sob a gola) multiplica a textura.
    vertexColors: !!(print.geometry && print.geometry.attributes && print.geometry.attributes.color),
  });
  // No r128 `sheen` é uma Color (null = desligado); em versões novas virou
  // número — só liga quando o material tem o formato que este código conhece.
  if (fabricMat.sheen === null) fabricMat.sheen = new THREE.Color(0.25, 0.25, 0.25);
  print.material = fabricMat;
  meshes.forEach((m, i) => {
    m.castShadow = true;
    if (i !== iPrint && m.material) {
      // Material próprio para cada alvo de cor: dois meshes que dividem o
      // mesmo material do arquivo não podem mudar de cor um pelo outro.
      if (alvos[i]) m.material = m.material.clone();
      if ("envMapIntensity" in m.material) m.material.envMapIntensity = 0.6;
    }
  });

  const group = new THREE.Group();
  group.add(pivo);
  group.rotation.y = (glb.rotationY * Math.PI) / 180;

  return {
    group,
    texture,
    chaoY: floorLevelParaCaixa(caixa),
    sombra: sombraDeContatoParaCaixa(caixa),
    caixa,
    aplicarOpcoes(opcoes) {
      meshes.forEach((m, i) => {
        if (i !== iPrint && alvos[i] && m.material && m.material.color) {
          m.material.color.set(opcoes.garmentColor).convertSRGBToLinear();
        }
      });
      return {
        ...opcoes,
        bodyColor: alvos[iPrint] ? opcoes.garmentColor : corOriginal,
        bodyTopBand: null,
        bodyOpacity: 1,
      };
    },
    pintar: (cv, values, opcoes) => paintFabricTexture(cv, spec, values, opcoes, tecido),
    malhaDaArte: print,
  };
}

/** Libera geometria, materiais e texturas de uma peça que saiu de cena. */
function descartarPeca(peca: Peca) {
  try {
    peca.group.traverse((obj: any) => {
      if (obj.geometry && obj.geometry.dispose) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      mats.forEach((m: any) => {
        ["map", "normalMap", "roughnessMap", "alphaMap"].forEach((k) => {
          if (m[k] && m[k].dispose) m[k].dispose();
        });
        if (m.dispose) m.dispose();
      });
    });
  } catch (_e) {}
  try { if (peca.texture && peca.texture.dispose) peca.texture.dispose(); } catch (_e) {}
}

/** Uma volta no laço de eventos: a página pinta entre dois passos pesados. */
function cederAVez(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

function canvasDaTextura(spec: VisualTemplateSpec, glb: GlbModel | null): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = glb ? glb.texture.w : (spec.model?.texture?.w || 2048);
  cv.height = glb ? glb.texture.h : (spec.model?.texture?.h || 1024);
  return cv;
}

export async function createModelViewer(
  canvas: HTMLCanvasElement,
  specInicial: VisualTemplateSpec,
  values: Record<string, any>,
  opts: Mug3DOptions = {}
): Promise<Mug3DHandle> {
  const THREE = await loadThree();
  let o: Opcoes = { ...DEFAULTS, ...opts };

  // O que depende da peça é `let`: `trocarPeca` troca a peça dentro da
  // mesma cena e do mesmo WebGLRenderer (28/09/2026 — a prévia da aba
  // Aparência passa por vários modelos seguidos e não pode abrir um
  // contexto WebGL por modelo).
  let spec = specInicial;
  let glb = readGlbModel(spec);
  let texCv = canvasDaTextura(spec, glb);

  const scene = new THREE.Scene();
  // O cenário é da CENA, não da peça: fica fixo, e `trocarPeca` só o
  // reposiciona pelo chão da peça nova (ajustarCenaAPeca).
  const cenario: Cenario = o.cenario === "gradiente" || o.cenario === "nenhum" ? o.cenario : "estudio";
  if (cenario === "gradiente") scene.background = paintBackdrop(THREE, o.backdrop);
  const camera = new THREE.PerspectiveCamera(glb ? glb.camera.fov : CAMERA_FOV_GRAUS, 1, 0.1, 100);
  // alpha: sem cenário o canvas é transparente e a peça senta no fundo da
  // página — é o que as miniaturas pedem.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  // Curva de filme: sem ela o branco da louca estourava e o corpo virava
  // uma mancha chapada, sem o degrade de luz que da volume na foto.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (cenario === "nenhum") renderer.setClearColor(0x000000, 0);
  scene.environment = buildEnvironment(THREE, renderer);
  await cederAVez();

  // Tres pontos: principal quente (projeta a sombra), preenchimento frio
  // e contraluz para descolar a peca do fundo. O ambiente vem do env map.
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0xb9ae9e, 0.25));
  const key = new THREE.DirectionalLight(0xfff3e4, 1.0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -4.5; key.shadow.camera.right = 4.5;
  key.shadow.camera.top = 4.5; key.shadow.camera.bottom = -4.5;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe8f0ff, 0.22); fill.position.set(-5, 2.5, 3); scene.add(fill);
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.5); rimLight.position.set(-2, 4, -5); scene.add(rimLight);

  let peca: Peca = glb
    ? await montarGlb(THREE, spec, glb, renderer, texCv, o)
    : montarCaneca(THREE, spec, renderer, texCv, o);
  let group = peca.group;
  let texture = peca.texture;
  scene.add(group);

  // Chao. No estúdio é o ciclorama (chão + curva + parede) com o receptor
  // da sombra projetada; nos outros cenários, um plano invisível que só
  // recebe a sombra. Por cima, a mancha de contato, que segura a peca no
  // chao mesmo onde a luz nao alcanca.
  const chao: any[] = [];
  if (cenario === "estudio") {
    const ciclo = montarCiclorama(THREE, o.backdrop);
    scene.add(ciclo.mesh);
    scene.add(ciclo.sombra);
    scene.background = ciclo.fundo;
    chao.push(ciclo.mesh, ciclo.sombra);
  } else {
    const plano = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.2 }));
    plano.rotation.x = -Math.PI / 2;
    plano.receiveShadow = true;
    scene.add(plano);
    chao.push(plano);
  }
  // O plano deitado (rotação em x) tem a altura no eixo z do mundo: rz é a profundidade da mancha.
  // Geometria unitária escalada pela mancha: trocar de peça não refaz a malha.
  const contato = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ map: paintContactShadow(THREE), transparent: true, depthWrite: false }),
  );
  contato.rotation.x = -Math.PI / 2;
  scene.add(contato);

  /** Luz, chão e câmera da caneca: o que muda quando a peça muda. */
  function ajustarCenaAPeca() {
    // Peça vertical (camiseta) pede a principal um pouco mais alta: a luz
    // desce pelas dobras e a sombra cai sob a barra, como na foto de um
    // manequim fantasma. A caneca fica com a luz de sempre.
    if (glb) key.position.set(2.6, 7.6, 4.2);
    else key.position.set(3.2, 6, 4.5);
    camera.fov = glb ? glb.camera.fov : CAMERA_FOV_GRAUS;
    if (!glb) {
      const dist = cameraDistance(readMugGeometry(spec), readMugAccessories(spec));
      // Um pouco acima e olhando um pouco para baixo: e o enquadramento de
      // foto de produto, e e o que deixa o chao e a sombra aparecerem.
      camera.position.set(0, dist * 0.2, dist);
      camera.lookAt(0, -0.05, 0);
    }
    // O ciclorama (ou o plano) desce até o chão da peça; o receptor da
    // sombra um fio acima do papel, a mancha de contato acima dos dois.
    chao.forEach((m, i) => { m.position.y = peca.chaoY - 0.003 + i * 0.002; });
    contato.scale.set(peca.sombra.rx, peca.sombra.rz, 1);
    contato.position.y = peca.chaoY + 0.002;
  }

  // A câmera do GLB depende da proporção do canvas (a largura da peça é
  // que manda numa camiseta), então é posicionada a cada resize.
  function posicionarCameraDoGlb(aspect: number) {
    if (!glb || !peca.caixa) return;
    const dist = glb.camera.distance ?? cameraDistanceParaCaixa(peca.caixa, aspect, glb.camera.fov);
    camera.position.set(0, dist * glb.camera.height, dist);
    camera.lookAt(0, -0.05, 0);
  }

  function resize() {
    // clientWidth=0 em canvas offscreen (geração de vídeo/render sem DOM):
    // cai pra canvas.width setado pelo caller antes do createMugViewer.
    const w = canvas.clientWidth || canvas.width || 320;
    const h = canvas.clientHeight || Math.round(w * 0.78);
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(o.pixelRatio || Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, 2));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    posicionarCameraDoGlb(w / h);
  }

  let disposed = false;
  let dragging = false;
  let userTouched = false;
  let lastX = 0;

  function render() { if (!disposed) renderer.render(scene, camera); }

  // Edição da arte (28/09/2026): giro automático controlável e arraste
  // da arte na própria peça. Sem `arraste`, tudo segue como antes.
  let giroAuto = true;
  let arraste: ArrasteDaPeca | null = null;
  let arrastandoArte = false;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function pontoNaArea(clientX: number, clientY: number, areaId?: string): PontoNaArea | null {
    const malha = peca.malhaDaArte;
    if (!malha || typeof canvas.getBoundingClientRect !== "function") return null;
    const r = canvas.getBoundingClientRect();
    if (!(r.width > 0) || !(r.height > 0)) return null;
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    group.updateMatrixWorld(true);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(malha, false)[0];
    if (!hit || !hit.uv) return null;
    // Um segundo raio 6 px ao lado dá quantos pixels de tela vale 1 de u.
    ndc.set(((clientX + 6 - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const vizinho = raycaster.intersectObject(malha, false)[0];
    const area = pickArea(spec, areaId || o.areaId);
    if (!area || !area.uv) return null;
    const W = texCv.width, H = texCv.height;
    const ret = uvParaRetangulo(area.uv, W, H);
    // GLB: o v do glTF cresce para baixo e a textura vai com flipY
    // desligado (glbModel.ts) — a linha do canvas é o próprio v.
    const x = hit.uv.x * W, y = (texture && texture.flipY === false ? hit.uv.y : 1 - hit.uv.y) * H;
    return {
      u: (x - ret.x) / ret.w, v: (y - ret.y) / ret.h, aspecto: ret.h / ret.w,
      areaCm: area.width_cm > 0 && area.height_cm > 0 ? { w: area.width_cm, h: area.height_cm } : null,
      transborda: true,
      pixel: pixelDaTextura(spec, W, H),
      pxPorU: vizinho && vizinho.uv && Math.abs(vizinho.uv.x - hit.uv.x) > 1e-6
        ? 6 / (Math.abs(vizinho.uv.x - hit.uv.x) * W / ret.w)
        : null,
    };
  }

  const onDown = (e: PointerEvent) => {
    if (arraste && (arrastandoArte || arraste.tocar(pontoNaArea(e.clientX, e.clientY), e))) {
      if (arrastandoArte) arraste.tocar(pontoNaArea(e.clientX, e.clientY), e);
      arrastandoArte = true; userTouched = true; giroAlvo = null;
      try { canvas.setPointerCapture(e.pointerId); } catch (_e) {}
      return;
    }
    dragging = true; userTouched = true; lastX = e.clientX;
    giroAlvo = null; // a mão manda: a animação para onde estiver
    try { canvas.setPointerCapture(e.pointerId); } catch (_e) {}
  };
  const onMove = (e: PointerEvent) => {
    if (arrastandoArte && arraste) { arraste.mover(pontoNaArea(e.clientX, e.clientY), e); return; }
    if (!dragging) return;
    group.rotation.y += (e.clientX - lastX) * 0.011;
    lastX = e.clientX;
    render();
  };
  const onUp = (e: PointerEvent) => {
    if (arrastandoArte) {
      // Pinça: só o último dedo que sai encerra o arraste da arte.
      arrastandoArte = arraste ? arraste.soltar(e) : false;
      return;
    }
    dragging = false;
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  function giroAutomatico(ligado: boolean) {
    giroAuto = !!ligado;
    if (giroAuto) { userTouched = false; giroAlvo = null; }
  }
  function definirArraste(a: ArrasteDaPeca | null) {
    arraste = a;
    if (!a) arrastandoArte = false;
  }
  /** Vira a área para a câmera: costas a meia-volta; painel da caneca pelo centro da UV. */
  function mostrarArea(areaId?: string) {
    const area = pickArea(spec, areaId || o.areaId);
    userTouched = true;
    if (!glb && area && area.uv) {
      // Torno do three: o ponto de u está no ângulo φ = 2πu (x = sen φ,
      // z = cos φ) e encara a câmera (+z) com o giro do grupo = −φ. O corpo
      // não gira dentro do grupo, então o alvo é absoluto.
      const uc = (area.uv.u0 + area.uv.u1) / 2;
      giroAlvo = giroMaisCurto(group.rotation.y, -uc * Math.PI * 2);
    } else {
      giroAlvo = giroMaisCurto(group.rotation.y, giroDeRepouso + (area && area.id === "back" ? Math.PI : 0));
    }
  }

  // 28/09/2026 — os chips Frente/Costas levam a um ângulo ABSOLUTO. Antes
  // só trocavam a área pintada: depois de a cliente girar a peça à mão,
  // "Costas" pintava as costas mas a câmera continuava olhando a frente
  // (QA de 28/09). O giro de repouso da peça é o de sempre (`group.rotation.y`
  // na montagem; `trocarPeca` o lê de novo da peça nova); as costas ficam
  // a meia-volta dele. A troca é animada e desliga o giro automático,
  // como um toque.
  let giroDeRepouso = group.rotation.y;
  let giroAlvo: number | null = null;
  let areaAtual = o.areaId;
  function irParaArea(areaId: string) {
    userTouched = true;
    // pelo caminho mais curto a partir de onde a peça está
    giroAlvo = giroMaisCurto(group.rotation.y, giroDeRepouso + (areaId === "back" ? Math.PI : 0));
  }

  function loop() {
    if (disposed) return;
    if (giroAuto && !userTouched) { group.rotation.y += 0.004; render(); }
    else if (giroAlvo !== null && !dragging) {
      const resto = giroAlvo - group.rotation.y;
      if (Math.abs(resto) < 0.002) { group.rotation.y = giroAlvo; giroAlvo = null; }
      else group.rotation.y += resto * 0.16;
      render();
    }
    requestAnimationFrame(loop);
  }

  // A pintura acontece num rascunho e só o resultado inteiro vai para a
  // textura. Antes, cada `update` limpava a textura e pintava direto nela,
  // com um `await` da imagem no meio: dois updates seguidos (trocar de
  // área, digitar uma letra) se atropelavam — o segundo apagava o que o
  // primeiro tinha acabado de escrever, e a caneca ficava lisa até a
  // próxima mudança. Visto na loja da Sheid em 04/09/2026 ao trocar
  // "Painel" por "Volta inteira". Pintura mais velha que terminar depois
  // de uma mais nova é descartada — e a pintura que começou numa peça
  // que já saiu de cena também.
  let pinturaAtual = 0;
  async function update(newValues: Record<string, any>, newOpts?: Mug3DOptions) {
    const pecaDaPintura = peca;
    const tela = texCv;
    const tex = texture;
    o = pecaDaPintura.aplicarOpcoes({ ...o, ...(newOpts || {}) });
    // Só a MUDANÇA de área gira a peça; a primeira pintura não mexe no
    // giro nem desliga a rotação automática.
    if (o.areaId !== areaAtual) {
      areaAtual = o.areaId;
      irParaArea(areaAtual);
    }
    const minha = ++pinturaAtual;
    const rascunho = document.createElement("canvas");
    rascunho.width = tela.width;
    rascunho.height = tela.height;
    await pecaDaPintura.pintar(rascunho, newValues, o);
    if (minha !== pinturaAtual || disposed || pecaDaPintura !== peca) return;
    const ctx = tela.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, tela.width, tela.height);
    ctx.drawImage(rascunho, 0, 0);
    tex.needsUpdate = true;
    render();
  }

  // Troca de peça na mesma cena. Troca pedida depois vence a anterior:
  // quem passa o mouse por cinco modelos vê o último, não o mais lento.
  let trocaAtual = 0;
  async function trocarPeca(novaSpec: VisualTemplateSpec, newValues: Record<string, any>, newOpts?: Mug3DOptions) {
    if (disposed) return;
    const minha = ++trocaAtual;
    const novoGlb = readGlbModel(novaSpec);
    const novaTela = canvasDaTextura(novaSpec, novoGlb);
    const oNova: Opcoes = { ...o, ...(newOpts || {}) };
    const nova: Peca = novoGlb
      ? await montarGlb(THREE, novaSpec, novoGlb, renderer, novaTela, oNova)
      : montarCaneca(THREE, novaSpec, renderer, novaTela, oNova);
    if (minha !== trocaAtual || disposed) { descartarPeca(nova); return; }
    scene.remove(group);
    descartarPeca(peca);
    spec = novaSpec; glb = novoGlb; texCv = novaTela; peca = nova;
    group = nova.group; texture = nova.texture;
    scene.add(group);
    ajustarCenaAPeca();
    resize();
    // Peça nova gira sozinha de novo até o primeiro toque; o giro de
    // repouso e a área atual são os dela (a caneca nasce a meia-volta, a
    // camiseta com o rotation_y da spec).
    userTouched = false;
    giroAlvo = null;
    giroDeRepouso = group.rotation.y;
    areaAtual = { ...o, ...(newOpts || {}) }.areaId;
    await update(newValues, newOpts);
  }

  function snapshot(pixelWidth = 1600): string | null {
    try {
      // preserveDrawingBuffer garante leitura do frame atual
      render();
      if (pixelWidth && canvas.width < pixelWidth) render();
      return renderer.domElement.toDataURL("image/png");
    } catch (_e) {
      return null;
    }
  }

  function renderizarQuadro(rotacaoY: number) {
    if (disposed) return;
    userTouched = true;
    giroAlvo = null;
    group.rotation.y = giroDeRepouso + rotacaoY;
    render();
  }

  // F5: grava uma volta completa (ease in-out) e devolve Blob webm.
  // null = navegador sem captureStream/MediaRecorder (caller mostra erro).
  function recordTurntable(durationMs = 3600): Promise<Blob | null> {
    return new Promise((resolve) => {
      const anyCanvas = canvas as any;
      if (typeof anyCanvas.captureStream !== "function" || typeof (window as any).MediaRecorder === "undefined") {
        return resolve(null);
      }
      userTouched = true; // pausa o auto-rotate do loop durante a gravação
      let rec: any;
      try {
        const stream = anyCanvas.captureStream(30);
        const MR = (window as any).MediaRecorder;
        let mime = MIME_DO_VIDEO + ";codecs=vp9";
        if (MR.isTypeSupported && !MR.isTypeSupported(mime)) mime = MIME_DO_VIDEO;
        try {
          rec = new MR(stream, { mimeType: mime, videoBitsPerSecond: 6000000 });
        } catch (_e) {
          rec = new MR(stream);
        }
      } catch (_e) {
        return resolve(null);
      }
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e: any) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || MIME_DO_VIDEO }));
      rec.onerror = () => resolve(null);
      rec.start();

      const start = performance.now();
      const startRot = group.rotation.y;
      const spin = (now: number) => {
        if (disposed) { try { rec.stop(); } catch (_e) { resolve(null); } return; }
        const t = Math.min((now - start) / durationMs, 1);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        group.rotation.y = startRot + ease * Math.PI * 2;
        render();
        if (t < 1) {
          requestAnimationFrame(spin);
        } else {
          setTimeout(() => { try { rec.stop(); } catch (_e) { resolve(null); } }, 150);
        }
      };
      requestAnimationFrame(spin);
    });
  }

  function dispose() {
    disposed = true;
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    try { if (scene.environment) scene.environment.dispose(); } catch (_e) {}
    try { renderer.dispose(); } catch (_e) {}
  }

  ajustarCenaAPeca();
  resize();
  // Abertura em pedaços (28/09/2026): montar a cena, compilar os shaders
  // e o primeiro quadro (textura + sombra) eram uma tarefa só de ~0,5 s,
  // com a página parada ("Gerar do pedido" no modal de aprovação). Entre
  // um passo e outro a página respira.
  await cederAVez();
  try { renderer.compile(scene, camera); } catch (_e) { /* o primeiro render compila */ }
  await cederAVez();
  await update(values);
  loop();

  return { update, giroAutomatico, pontoNaArea, definirArraste, mostrarArea, trocarPeca, resize, snapshot, recordTurntable, renderizarQuadro, dispose };
}

/** O nome de antes da generalização: quem chama não precisa mudar. */
export const createMugViewer = createModelViewer;
