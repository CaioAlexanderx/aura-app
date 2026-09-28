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
// 03/07/2026 — F4/F5 do escopo Visualização 2D/3D (contrato no chat)
// ============================================================
import type { VisualArea, VisualTemplateSpec } from "@/services/studioVisualApi";
import { loadThree, loadGLTFLoader, loadDRACOLoader, DRACO_DECODER_PATH } from "./threeLoader";
import {
  readMugGeometry, heartPath, readMugMaterials, applyCustomerColor,
  readMugAccessories, latheProfile, squarePath, type MugMaterial,
} from "./mugGeometry";
import {
  backdropPalette, cameraDistance, contactShadowRadius, floorLevel,
  hexToRgba, CAMERA_FOV_GRAUS,
} from "./mugScene";
import {
  readGlbModel, escalaDoModelo, cameraDistanceParaCaixa, floorLevelParaCaixa,
  sombraDeContatoParaCaixa, uvParaRetangulo, escolherMeshDeImpressao,
  recebeCorDoCliente, pixelsPorCm, fiosDoLadrilho,
  type GlbModel, type Caixa, type SombraDeContato,
} from "./glbModel";

export type Mug3DOptions = {
  garmentColor?: string;  // cor ESCOLHIDA pelo cliente (incide onde o modelo mandar)
  bodyColor?: string;     // cor do corpo do modelo — fundo da textura (S11)
  bodyTopBand?: { color: string; height: number } | null;
  /** Opacidade do corpo: vidro pinta o fundo da textura translúcido e a arte opaca. */
  bodyOpacity?: number;
  artColor?: string;      // cor do texto/emblema
  font?: string;
  areaId?: string;        // 'panel' | 'wrap' | 'front' | 'back'
  /** Cor base do fundo (vira gradiente de estúdio). */
  backdrop?: string;
};

export type Mug3DHandle = {
  update: (values: Record<string, any>, opts?: Mug3DOptions) => Promise<void>;
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
  dispose: () => void;
};

const DEFAULTS: Required<Pick<Mug3DOptions, "garmentColor" | "artColor" | "font" | "areaId" | "backdrop">> = {
  garmentColor: "#F5F2EA",
  artColor: "#D85A30",
  font: "Georgia, serif",
  areaId: "panel",
  // O papel da vitrine: o mockup senta na página em vez de parecer colado.
  backdrop: "#FBF8F3",
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
 * A arte (foto ou emblema + texto) na área escolhida. É o mesmo desenho
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
  } else if (text) {
    // Emblema simples acima do texto (mesma identidade do 2D)
    ctx.strokeStyle = o.artColor;
    ctx.lineWidth = Math.max(ah * 0.02, 4);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const ey = ay + imgBoxH * 0.45, es = Math.min(aw, ah) * 0.16;
    ctx.beginPath(); ctx.arc(cx, ey + es * 0.35, es, 3.5, 5.9); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - es * 0.7, ey + es * 0.55);
    ctx.lineTo(cx - es * 0.15, ey - es * 0.2);
    ctx.lineTo(cx + es * 0.12, ey + es * 0.25);
    ctx.lineTo(cx + es * 0.45, ey - es * 0.3);
    ctx.lineTo(cx + es * 0.85, ey + es * 0.45);
    ctx.stroke();
  }

  if (text) {
    ctx.fillStyle = o.artColor;
    ctx.textAlign = "center";
    let fontPx = ah * 0.28;
    ctx.font = "600 " + Math.round(fontPx) + "px " + o.font;
    while (fontPx > 12 && ctx.measureText(text).width > aw * 0.92) {
      fontPx -= 4;
      ctx.font = "600 " + Math.round(fontPx) + "px " + o.font;
    }
    ctx.fillText(text, cx, ay + imgBoxH + (ah - imgBoxH) * 0.6 + fontPx * 0.3);
  }
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
  const parede = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.32, 0.30, 0.28), side: THREE.BackSide });
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
  painel(7, 4, [2.2, 2.1, 1.9], [0, 5.9, 0], [Math.PI / 2, 0, 0]);          // softbox no teto
  painel(3, 6, [1.6, 1.5, 1.35], [-5.9, 1.5, 2], [0, Math.PI / 2, 0]);      // painel principal (esquerda)
  painel(3, 6, [0.8, 0.85, 1.0], [5.9, 1, 1], [0, -Math.PI / 2, 0]);        // preenchimento frio (direita)
  painel(5, 2, [1.1, 1.1, 1.1], [0, 3.5, -5.9], [0, 0, 0]);                  // contraluz
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(sala, 0.04);
  pmrem.dispose();
  return env.texture;
}

function makeMaterial(THREE: any, m: MugMaterial, extra: Record<string, any> = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(m.color).convertSRGBToLinear(),
    roughness: m.roughness,
    metalness: m.metalness,
    transparent: m.opacity < 1,
    opacity: m.opacity,
    // Sem escrever profundidade nas transparentes: parede interna e
    // externa do vidro ficam no mesmo lugar e uma apagava a outra.
    depthWrite: m.opacity >= 1,
    envMapIntensity: m.metalness > 0.5 ? 1.1 : 0.7,
    ...extra,
  });
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
};

function montarCaneca(THREE: any, spec: VisualTemplateSpec, renderer: any, texCv: HTMLCanvasElement, o: Opcoes): Peca {
  // S3 — a forma vem do `spec`, com os numeros de antes como default.
  // Template sem bloco de geometria renderiza exatamente como renderizava
  // (ver mugGeometry.ts).
  const G = readMugGeometry(spec);
  const acess = readMugAccessories(spec);
  const meiaAltura = G.body.height / 2;

  // S11 — cor e material vem do MODELO; a escolha do cliente incide so
  // nas pecas que o template declara em `customer_color_targets`.
  let M = applyCustomerColor(readMugMaterials(spec), o.garmentColor);

  const texture = new THREE.CanvasTexture(texCv);
  texture.encoding = THREE.sRGBEncoding;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
  // A opacidade do corpo mora no alfa da textura (ver paintTexture).
  const bodyMat = makeMaterial(THREE, M.body, { map: texture, opacity: 1 });
  const handleMat = makeMaterial(THREE, M.handle);
  const rimMat = makeMaterial(THREE, M.rim);
  const bottomMat = makeMaterial(THREE, M.bottom);
  const innerMat = makeMaterial(THREE, M.interior, { side: THREE.BackSide });
  const innerBottomMat = makeMaterial(THREE, M.interior);
  // Vidro nao projeta sombra cheia; a mancha de contato segura a peca.
  const opaco = (m: MugMaterial) => m.opacity >= 0.5;

  const group = new THREE.Group();
  const corpo = new THREE.Mesh(
    new THREE.LatheGeometry(latheProfile(G.body).map((p) => new THREE.Vector2(p.x, p.y)), 96),
    bodyMat
  );
  corpo.castShadow = opaco(M.body);
  group.add(corpo);
  const raioBase = G.body.bottomRadius - G.body.bottomRound;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(raioBase, 64), bottomMat);
  bottom.rotation.x = Math.PI / 2; bottom.position.y = -meiaAltura; group.add(bottom);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(G.rim.radius, G.rim.tube, 12, 96), rimMat);
  rim.rotation.x = Math.PI / 2; rim.position.y = meiaAltura; rim.castShadow = opaco(M.rim); group.add(rim);
  // A parede interna segue o mesmo perfil do corpo, um pouco para dentro,
  // senao a base arredondada deixaria o interior atravessar o exterior.
  const innerProfile = latheProfile({
    topRadius: G.inner.topRadius, bottomRadius: G.inner.bottomRadius,
    height: G.inner.height, bottomRound: Math.max(0, G.body.bottomRound - 0.04),
  });
  const inner = new THREE.Mesh(
    new THREE.LatheGeometry(innerProfile.map((p) => new THREE.Vector2(p.x, p.y)), 96),
    innerMat
  );
  inner.position.y = meiaAltura - 0.03 - G.inner.height / 2;
  group.add(inner);
  const innerBottom = new THREE.Mesh(new THREE.CircleGeometry(G.inner.bottomRadius, 64), innerBottomMat);
  innerBottom.rotation.x = -Math.PI / 2;
  innerBottom.position.y = -meiaAltura + (G.body.height - G.inner.height) + 0.09;
  group.add(innerBottom);
  // Vidro: parede interna e externa tem o mesmo centro, e o three ordena
  // as transparentes por distancia do centro — a interna podia ser
  // desenhada POR CIMA da externa e apagar a arte. A externa vai por
  // ultimo; e a mais perto da camera de qualquer angulo.
  inner.renderOrder = 1; innerBottom.renderOrder = 1;
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
    if (G.handle.shape === "heart" && G.handle.filled) {
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
    handle.position.set(G.handle.offsetX, G.handle.offsetY, 0);
    // SEM rotacao em Y. O coracao vem de uma curva no plano XY — a MESMA
    // orientacao do TorusGeometry, que tambem e XY. Girar 90 graus em Y
    // deixava o coracao de PERFIL para a camera, um risco vertical em vez
    // de uma alca. So a inclinacao no proprio plano (tilt, em Z) e aceita.
    handle.rotation.z = (G.handle.tilt * Math.PI) / 180;
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
      innerBottomMat.color.set(M.interior.color).convertSRGBToLinear();
      // A PRIMEIRA pintura tambem precisa do fundo e da faixa certos: sem isto
      // o mockup nascia com a cor escolhida no corpo e so acertava no primeiro
      // update.
      return { ...opcoes, bodyColor: M.body.color, bodyTopBand: M.body.topBand ?? null, bodyOpacity: M.body.opacity };
    },
    pintar: (cv, values, opcoes) => paintTexture(cv, spec, values, opcoes),
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
  scene.background = paintBackdrop(THREE, o.backdrop);
  const camera = new THREE.PerspectiveCamera(glb ? glb.camera.fov : CAMERA_FOV_GRAUS, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  // Curva de filme: sem ela o branco da louca estourava e o corpo virava
  // uma mancha chapada, sem o degrade de luz que da volume na foto.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.environment = buildEnvironment(THREE, renderer);

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

  // Chao: invisivel, so recebe a sombra projetada; e a mancha de contato
  // por cima, que segura a peca no chao mesmo onde a luz nao alcanca.
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.2 }));
  chao.rotation.x = -Math.PI / 2;
  chao.receiveShadow = true;
  scene.add(chao);
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
    chao.position.y = peca.chaoY - 0.001;
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
    renderer.setPixelRatio(Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, 2));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    posicionarCameraDoGlb(w / h);
  }

  let disposed = false;
  let dragging = false;
  let userTouched = false;
  let lastX = 0;

  function render() { if (!disposed) renderer.render(scene, camera); }

  const onDown = (e: PointerEvent) => {
    dragging = true; userTouched = true; lastX = e.clientX;
    try { canvas.setPointerCapture(e.pointerId); } catch (_e) {}
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    group.rotation.y += (e.clientX - lastX) * 0.011;
    lastX = e.clientX;
    render();
  };
  const onUp = () => { dragging = false; };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);

  function loop() {
    if (disposed) return;
    if (!userTouched) { group.rotation.y += 0.004; render(); }
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
    // Peça nova gira sozinha de novo até o primeiro toque.
    userTouched = false;
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
        let mime = "video/webm;codecs=vp9";
        if (MR.isTypeSupported && !MR.isTypeSupported(mime)) mime = "vídeo/webm";
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
      rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || "vídeo/webm" }));
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
    try { if (scene.environment) scene.environment.dispose(); } catch (_e) {}
    try { renderer.dispose(); } catch (_e) {}
  }

  ajustarCenaAPeca();
  resize();
  await update(values);
  loop();

  return { update, trocarPeca, resize, snapshot, recordTurntable, dispose };
}

/** O nome de antes da generalização: quem chama não precisa mudar. */
export const createMugViewer = createModelViewer;
