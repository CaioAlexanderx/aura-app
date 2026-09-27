// ============================================================
// AURA STUDIO · visualEngine/compose2d — motor de composição 2D
//
// Módulo PURO (sem React, sem hooks): recebe um canvas + vista do
// template + values da customização e compõe o mockup. Mesmo motor
// para preview leve (pixelWidth ~1000) e render HD (2048+): mesmo
// payload → mesmo desenho (determinístico) — requisito da aprovação.
//
// Camadas: backdrop → produto (foto HD OU garment vetorial provisório)
// → sombras (1º passe) → arte/texto clipados → sombras (2º passe, a
// arte "assenta" nas dobras) → outline opcional da área.
//
// Web-only (usa DOM canvas). Callers nativos usam o fallback
// PersonalizationPreview — ver EnginePreview.tsx.
//
// 03/07/2026 — F1 do escopo Visualização 2D/3D (contrato no chat)
//
// 27/09/2026 — Mockup na foto real da peça. A lojista marca na foto do
// produto um quadrilátero (`area.quad`) e a arte é deformada até ele por
// homografia, com o sombreado tirado da própria foto
// (`view.shading_from_photo`) e o modo de mistura escolhido pela
// luminância da peça (`view.art_blend`). A matemática (homografia,
// malha, afim por triângulo, luminância, mapa de sombreado) fica em
// funções puras exportadas, porque é ela que precisa de teste: o canvas
// só executa o que elas decidem.
// ============================================================
import type { VisualArea, VisualView, VisualPoint, VisualQuad } from "@/services/studioVisualApi";
import { hexToRgb } from "./mugScene";

export type ComposeValues = Record<string, any>; // fieldId → valor (contrato do PersonalizationPreview)

export type ComposeOptions = {
  garmentColor?: string;   // cor do produto no fallback vetorial
  artColor?: string;       // cor do texto/emblema
  font?: string;           // font-family CSS do texto
  showAreas?: boolean;     // outline dashed da área de impressão
  backdrop?: string | null;// cor do fundo "estúdio" (null = transparente)
  pixelWidth?: number;     // largura do render em px (preview ~1000, HD 2048+)
};

const DEFAULTS = {
  garmentColor: "#F5F2EA",
  artColor: "#2C2C2A",
  font: "Georgia, serif",
  backdrop: "#ECEAE4",
  pixelWidth: 1000,
};

// ── Geometria do quadrilátero (puro) ─────────────────────────

/** Células por lado da malha que aproxima a homografia (12×12 = 288 triângulos). */
export const CELULAS_DA_MALHA = 12;

/**
 * Homografia que leva o quadrado unitário (0,0)-(1,0)-(1,1)-(0,1) aos
 * cantos do quad (sup. esq., sup. dir., inf. dir., inf. esq.). Forma
 * fechada de Heckbert: sem sistema linear, sem ponto flutuante acumulado
 * — o mesmo quad dá sempre os mesmos 8 coeficientes.
 * Retorna [a, b, c, d, e, f, g, h] com
 *   x = (a·u + b·v + c) / (g·u + h·v + 1)
 *   y = (d·u + e·v + f) / (g·u + h·v + 1)
 */
export function homografiaDoQuadradoUnitario(q: VisualQuad): number[] {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  if (Math.abs(dx3) < 1e-12 && Math.abs(dy3) < 1e-12) {
    // Paralelogramo: a homografia degenera numa afim (g = h = 0).
    return [p1.x - p0.x, p3.x - p0.x, p0.x, p1.y - p0.y, p3.y - p0.y, p0.y, 0, 0];
  }
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const h = (dx1 * dy3 - dx3 * dy1) / den;
  return [
    p1.x - p0.x + g * p1.x, p3.x - p0.x + h * p3.x, p0.x,
    p1.y - p0.y + g * p1.y, p3.y - p0.y + h * p3.y, p0.y,
    g, h,
  ];
}

export function aplicarHomografia(H: number[], u: number, v: number): VisualPoint {
  const w = H[6] * u + H[7] * v + 1;
  return { x: (H[0] * u + H[1] * v + H[2]) / w, y: (H[3] * u + H[4] * v + H[5]) / w };
}

/** Leva um ponto do retângulo (0..w, 0..h) da arte ao quad da foto. */
export function pontoNoQuad(q: VisualQuad, w: number, h: number, x: number, y: number): VisualPoint {
  return aplicarHomografia(homografiaDoQuadradoUnitario(q), x / w, y / h);
}

function cruz(o: VisualPoint, a: VisualPoint, b: VisualPoint): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * O quad só vale se for desenhável: 4 pontos finitos, convexo (os quatro
 * produtos vetoriais com o mesmo sinal) e com área de verdade. Uma alça
 * arrastada por cima da outra gera um quad torcido, e a homografia dele
 * espelha a arte — melhor cair no `rect` do que mostrar isso ao cliente.
 */
export function quadValido(q: unknown): q is VisualQuad {
  if (!Array.isArray(q) || q.length !== 4) return false;
  for (const p of q) {
    if (!p || !Number.isFinite((p as any).x) || !Number.isFinite((p as any).y)) return false;
  }
  const pts = q as VisualQuad;
  let pos = 0, neg = 0;
  for (let i = 0; i < 4; i++) {
    const c = cruz(pts[i], pts[(i + 1) % 4], pts[(i + 2) % 4]);
    if (c > 0) pos++;
    else if (c < 0) neg++;
  }
  if (!(pos === 4 || neg === 4)) return false;
  return Math.abs(areaDoQuad(pts)) >= 1;
}

export function areaDoQuad(q: VisualQuad): number {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export function caixaDoQuad(q: VisualQuad): { x: number; y: number; w: number; h: number } {
  const xs = q.map((p) => p.x), ys = q.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/**
 * Tamanho "de frente" da área: média das arestas opostas. É nesse
 * retângulo que a arte é montada (com o mesmo encaixe do `rect`) antes
 * de ser deformada — assim a proporção da arte segue a da área marcada.
 */
export function medidasDoQuad(q: VisualQuad): { w: number; h: number } {
  const d = (a: VisualPoint, b: VisualPoint) => Math.hypot(b.x - a.x, b.y - a.y);
  return { w: (d(q[0], q[1]) + d(q[3], q[2])) / 2, h: (d(q[0], q[3]) + d(q[1], q[2])) / 2 };
}

/** O ponto está dentro do quad convexo (borda conta como dentro)? */
export function dentroDoQuad(q: VisualQuad, x: number, y: number): boolean {
  const p = { x, y };
  let pos = 0, neg = 0;
  for (let i = 0; i < 4; i++) {
    const c = cruz(q[i], q[(i + 1) % 4], p);
    if (c > 0) pos++;
    else if (c < 0) neg++;
  }
  return pos === 0 || neg === 0;
}

/**
 * Transformação afim (formato do canvas: a, b, c, d, e, f com
 * x' = a·x + c·y + e e y' = b·x + d·y + f) que leva o triângulo `s` ao
 * `d`. Null para triângulo degenerado (a célula é pulada).
 */
export function afimDoTriangulo(
  s: [VisualPoint, VisualPoint, VisualPoint],
  d: [VisualPoint, VisualPoint, VisualPoint]
): [number, number, number, number, number, number] | null {
  const [s0, s1, s2] = s;
  const [d0, d1, d2] = d;
  const den = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
  if (Math.abs(den) < 1e-12) return null;
  const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / den;
  const c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / den;
  const b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / den;
  const dd = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / den;
  const e = d0.x - a * s0.x - c * s0.y;
  const f = d0.y - b * s0.x - dd * s0.y;
  return [a, b, c, dd, e, f];
}

export type TrianguloDaMalha = {
  origem: [VisualPoint, VisualPoint, VisualPoint];  // no retângulo da arte (w×h)
  destino: [VisualPoint, VisualPoint, VisualPoint]; // na base da vista
};

/**
 * Malha n×n que aproxima a homografia: cada célula vira dois triângulos
 * afins. Com 12×12 o erro da aproximação fica abaixo de meio pixel nos
 * quads que uma peça fotografada produz, e o canvas desenha afim nativo.
 */
export function malhaDoQuad(q: VisualQuad, w: number, h: number, n = CELULAS_DA_MALHA): TrianguloDaMalha[] {
  const H = homografiaDoQuadradoUnitario(q);
  const pts: VisualPoint[] = [];
  const src: VisualPoint[] = [];
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      src.push({ x: (i / n) * w, y: (j / n) * h });
      pts.push(aplicarHomografia(H, i / n, j / n));
    }
  }
  const idx = (i: number, j: number) => j * (n + 1) + i;
  const out: TrianguloDaMalha[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = idx(i, j), b = idx(i + 1, j), c = idx(i + 1, j + 1), d = idx(i, j + 1);
      out.push({ origem: [src[a], src[b], src[c]], destino: [pts[a], pts[b], pts[c]] });
      out.push({ origem: [src[a], src[c], src[d]], destino: [pts[a], pts[c], pts[d]] });
    }
  }
  return out;
}

/**
 * Empurra os vértices do triângulo para fora do centroide em `px`.
 * Triângulos vizinhos recortados à risca deixam uma fresta clara de
 * antialias entre eles (a malha aparece como uma grade na arte); a
 * sobreposição mínima fecha a costura sem deslocar a arte, porque a
 * transformação continua a do triângulo original.
 */
export function trianguloExpandido(t: [VisualPoint, VisualPoint, VisualPoint], px: number) {
  const cx = (t[0].x + t[1].x + t[2].x) / 3;
  const cy = (t[0].y + t[1].y + t[2].y) / 3;
  return t.map((p) => {
    const dx = p.x - cx, dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * px, y: p.y + (dy / len) * px };
  }) as [VisualPoint, VisualPoint, VisualPoint];
}

// ── Luz da foto (puro) ───────────────────────────────────────

/** Luminância (Rec. 709 sobre os valores sRGB, 0..1) de um pixel RGBA. */
function luma(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Luminância média dos pixels de `rgba` (w×h) que caem dentro do quad
 * (em coordenadas locais desse recorte). Null quando nenhum pixel conta.
 */
export function luminanciaMediaNoQuad(
  rgba: ArrayLike<number>, w: number, h: number, quadLocal: VisualQuad
): number | null {
  let soma = 0, n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!dentroDoQuad(quadLocal, x + 0.5, y + 0.5)) continue;
      const k = (y * w + x) * 4;
      if (rgba[k + 3] === 0) continue;
      soma += luma(rgba[k], rgba[k + 1], rgba[k + 2]);
      n++;
    }
  }
  return n ? soma / n : null;
}

/** Acima disto a peça é "clara": a arte entra em multiply, como tinta no tecido. */
export const LIMIAR_PECA_CLARA = 0.45;
/** Em peça escura o multiply some com a arte; ela entra normal, levemente translúcida. */
export const ALFA_ARTE_PECA_ESCURA = 0.9;

export type BlendDaArte = { modo: "multiply" | "normal"; alfa: number };

/**
 * Como a arte se mistura à foto. Multiply é o que faz a arte parecer
 * impressa (a trama e a luz da peça atravessam a tinta), mas multiply
 * sobre preto dá preto: numa camiseta escura a arte sumiria. Então a
 * escolha é pela luz média da região marcada. Sem leitura da foto (CORS),
 * normal opaco — a arte aparece, que é o mínimo.
 */
export function blendDaArte(
  luminancia: number | null,
  explicito?: "multiply" | "normal" | null
): BlendDaArte {
  if (explicito === "multiply") return { modo: "multiply", alfa: 1 };
  if (explicito === "normal") return { modo: "normal", alfa: 1 };
  if (luminancia == null || !Number.isFinite(luminancia)) return { modo: "normal", alfa: 1 };
  return luminancia >= LIMIAR_PECA_CLARA
    ? { modo: "multiply", alfa: 1 }
    : { modo: "normal", alfa: ALFA_ARTE_PECA_ESCURA };
}

/** Realce das dobras: 1.6 dobra a leitura sem virar mancha. */
const CONTRASTE_DO_SOMBREADO = 1.6;

function desfoqueCaixa(src: Float32Array, w: number, h: number, r: number): Float32Array {
  // Separável (horizontal e vertical), borda repetida. Determinístico:
  // só soma e divisão, na mesma ordem sempre.
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const janela = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += src[y * w + Math.min(w - 1, Math.max(0, x + k))];
      tmp[y * w + x] = s / janela;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x];
      out[y * w + x] = s / janela;
    }
  }
  return out;
}

/**
 * O sombreado da própria foto, para multiplicar sobre a arte: cinza em
 * que 255 é "sem sombra" e o escuro é dobra. A luz é medida relativa ao
 * percentil 90 da região (e não ao branco absoluto), então uma camiseta
 * preta tem dobras tão legíveis quanto uma branca. Contraste realçado,
 * desfoque leve para a trama do tecido não virar ruído na arte, e
 * `forca` (0..1) dosando o quanto disso chega à arte.
 */
export function mapaDeSombreado(
  rgba: ArrayLike<number>, w: number, h: number, forca: number
): Uint8ClampedArray {
  const f = Math.min(1, Math.max(0, Number(forca) || 0));
  const L = new Float32Array(w * h);
  const hist = new Uint32Array(256);
  let validos = 0;
  for (let i = 0; i < w * h; i++) {
    const k = i * 4;
    const l = luma(rgba[k], rgba[k + 1], rgba[k + 2]);
    L[i] = l;
    if (rgba[k + 3] > 0) {
      hist[Math.min(255, Math.round(l * 255))]++;
      validos++;
    }
  }
  // Percentil 90 pelo histograma (sem ordenar floats: estável e rápido).
  let ref = 1;
  if (validos) {
    const alvo = validos * 0.9;
    let acc = 0;
    for (let b = 0; b < 256; b++) {
      acc += hist[b];
      if (acc >= alvo) { ref = Math.max(b / 255, 1 / 255); break; }
    }
  }
  const rel = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = Math.min(1, L[i] / ref);
    rel[i] = Math.min(1, Math.max(0, 1 - (1 - r) * CONTRASTE_DO_SOMBREADO));
  }
  const raio = Math.max(1, Math.round(Math.min(w, h) / 200));
  const liso = desfoqueCaixa(rel, w, h, raio);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(255 * (1 - f * (1 - liso[i])));
    const k = i * 4;
    out[k] = v; out[k + 1] = v; out[k + 2] = v; out[k + 3] = 255;
  }
  return out;
}

// ── Canvas ───────────────────────────────────────────────────

// Cache das imagens por URL: o preview recompõe a cada tecla, e a foto
// HD e a arte são as mesmas. Falha sai do cache para permitir retry.
const cacheDeImagens = new Map<string, Promise<HTMLImageElement | null>>();

function loadImage(url: string): Promise<HTMLImageElement | null> {
  const emCache = cacheDeImagens.get(url);
  if (emCache) return emCache;
  const p = new Promise<HTMLImageElement | null>((resolve) => {
    if (typeof Image === "undefined") return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous"; // R2 público — evita taint no toDataURL
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
  cacheDeImagens.set(url, p);
  p.then((img) => { if (!img) cacheDeImagens.delete(url); });
  return p;
}

function criarCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// ── A tinta das dobras depende da cor da peça ────────────────
// 27/09/2026: contorno, gola e dobras eram sempre preto com alfa. Numa
// camiseta preta somem todos, e a peça vira uma silhueta chapada. Em
// peça escura as dobras passam a ser claras (branco com alfa) e o realce
// escuro — o mesmo desenho, com a tinta invertida.
export type TintaDasDobras = {
  escura: boolean;
  /** "r,g,b" da tinta das dobras e do contorno. */
  sombra: string;
  /** "r,g,b" do realce ao lado de cada dobra. */
  realce: string;
};

/** Luminância relativa (WCAG) de um hex; cor inválida conta como clara. */
export function luminanciaRelativa(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

// Abaixo disto o preto com alfa já não se distingue do tecido. Vermelho
// (#EF4444, 0.22) e o violeta da marca (0.13) contam como escuros.
const LUMINANCIA_ESCURA = 0.25;

export function dobrasParaCor(hex: string): TintaDasDobras {
  const escura = luminanciaRelativa(hex) < LUMINANCIA_ESCURA;
  return escura
    ? { escura, sombra: "255,255,255", realce: "0,0,0" }
    : { escura, sombra: "0,0,0", realce: "255,255,255" };
}

// ── Garment vetorial provisório (camiseta, base 1000×760) ────
function tshirtPath(ctx: CanvasRenderingContext2D, back: boolean) {
  ctx.beginPath();
  ctx.moveTo(392, 128);
  ctx.quadraticCurveTo(340, 140, 318, 158); ctx.lineTo(212, 272);
  ctx.quadraticCurveTo(204, 284, 214, 294); ctx.lineTo(282, 352);
  ctx.quadraticCurveTo(292, 360, 302, 350); ctx.lineTo(348, 300);
  ctx.quadraticCurveTo(352, 430, 346, 600); ctx.quadraticCurveTo(346, 612, 360, 612);
  ctx.lineTo(640, 612); ctx.quadraticCurveTo(654, 612, 654, 600);
  ctx.quadraticCurveTo(648, 430, 652, 300); ctx.lineTo(698, 350);
  ctx.quadraticCurveTo(708, 360, 718, 352); ctx.lineTo(786, 294);
  ctx.quadraticCurveTo(796, 284, 788, 272); ctx.lineTo(682, 158);
  ctx.quadraticCurveTo(660, 140, 608, 128);
  if (back) {
    ctx.quadraticCurveTo(560, 152, 500, 152);
    ctx.quadraticCurveTo(440, 152, 392, 128);
  } else {
    ctx.quadraticCurveTo(560, 196, 500, 196);
    ctx.quadraticCurveTo(440, 196, 392, 128);
  }
  ctx.closePath();
}

function drawFolds(ctx: CanvasRenderingContext2D, back: boolean, alpha: number, tinta: TintaDasDobras) {
  ctx.save();
  tshirtPath(ctx, back);
  ctx.clip();
  ctx.strokeStyle = "rgba(" + tinta.sombra + "," + alpha + ")";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  const cr = [
    [360, 330, 420, 360, 380, 470],
    [640, 330, 585, 365, 625, 480],
    [400, 520, 500, 545, 600, 516],
    [430, 290, 500, 320, 572, 292],
    [368, 560, 470, 588, 560, 562],
  ];
  for (const c of cr) {
    ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.quadraticCurveTo(c[2], c[3], c[4], c[5]); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(" + tinta.realce + "," + alpha * 1.4 + ")";
  ctx.lineWidth = 5;
  for (const c of cr) {
    ctx.beginPath(); ctx.moveTo(c[0], c[1] + 7); ctx.quadraticCurveTo(c[2], c[3] + 7, c[4], c[5] + 7); ctx.stroke();
  }
  ctx.fillStyle = "rgba(" + tinta.sombra + "," + alpha * 1.2 + ")";
  ctx.beginPath(); ctx.ellipse(330, 320, 26, 60, 0.5, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(670, 320, 26, 60, -0.5, 0, 7); ctx.fill();
  ctx.restore();
}

function clipToGarment(ctx: CanvasRenderingContext2D, view: VisualView) {
  if (view.garment && view.garment.shape === "tshirt") {
    tshirtPath(ctx, !!view.garment.back);
    ctx.clip();
  }
}

// ── Análise da foto por área (sombreado + luz média) ─────────
type AnaliseDaFoto = {
  sombra: HTMLCanvasElement | null;             // mapa de sombreado da caixa do quad
  caixa: { x: number; y: number; w: number; h: number } | null; // em coordenadas da base
  luminancia: number | null;                    // média dentro do quad
};

// A análise depende só da foto, da base, do quad e da força — nunca do
// pixelWidth. Por isso o preview e o render HD recebem exatamente o
// mesmo mapa (só escalado), e ela é feita uma vez por sessão.
const cacheDeAnalises = new Map<string, AnaliseDaFoto>();

function analisarFoto(
  photo: HTMLImageElement, view: VisualView, quad: VisualQuad, forca: number | null
): AnaliseDaFoto {
  const chave = JSON.stringify([view.photo_url, view.base, quad, forca]);
  const emCache = cacheDeAnalises.get(chave);
  if (emCache) return emCache;
  const vazio: AnaliseDaFoto = { sombra: null, caixa: null, luminancia: null };
  const bruta = caixaDoQuad(quad);
  const x0 = Math.max(0, Math.floor(bruta.x));
  const y0 = Math.max(0, Math.floor(bruta.y));
  const x1 = Math.min(view.base.w, Math.ceil(bruta.x + bruta.w));
  const y1 = Math.min(view.base.h, Math.ceil(bruta.y + bruta.h));
  const w = x1 - x0, h = y1 - y0;
  if (w < 2 || h < 2) return vazio;
  const cv = criarCanvas(w, h);
  const cx = cv && cv.getContext("2d");
  if (!cv || !cx) return vazio;
  // A foto é desenhada no espaço da base (o mesmo em que o quad foi
  // marcado), recortada na caixa do quad.
  const sx = (photo.naturalWidth || photo.width) / view.base.w;
  const sy = (photo.naturalHeight || photo.height) / view.base.h;
  cx.drawImage(photo, x0 * sx, y0 * sy, w * sx, h * sy, 0, 0, w, h);
  let dados: ImageData;
  try {
    dados = cx.getImageData(0, 0, w, h);
  } catch (_e) {
    // Foto sem CORS: dá para desenhar, não para ler. Fica sem sombreado.
    cacheDeAnalises.set(chave, vazio);
    return vazio;
  }
  const local = quad.map((p) => ({ x: p.x - x0, y: p.y - y0 })) as VisualQuad;
  const luminancia = luminanciaMediaNoQuad(dados.data, w, h, local);
  let sombra: HTMLCanvasElement | null = null;
  if (forca != null && forca > 0) {
    const mapa = mapaDeSombreado(dados.data, w, h, forca);
    const img = cx.createImageData(w, h);
    img.data.set(mapa);
    cx.putImageData(img, 0, 0);
    sombra = cv;
  }
  const out: AnaliseDaFoto = { sombra, caixa: { x: x0, y: y0, w, h }, luminancia };
  cacheDeAnalises.set(chave, out);
  return out;
}

// ── Composição principal ─────────────────────────────────
// Geração por canvas: o preview recompõe a cada tecla e cada composição
// espera imagens. Sem isto, uma composição antiga que termina depois da
// nova pinta por cima (a arte "volta" um caractere).
const geracaoDoCanvas = new WeakMap<object, number>();

export async function composeView(
  canvas: HTMLCanvasElement,
  view: VisualView,
  values: ComposeValues,
  opts: ComposeOptions = {}
): Promise<void> {
  const o = { ...DEFAULTS, ...opts };
  const geracao = (geracaoDoCanvas.get(canvas) || 0) + 1;
  geracaoDoCanvas.set(canvas, geracao);

  // Tudo o que é assíncrono vem antes do primeiro traço: o desenho em si
  // é síncrono e, portanto, igual para o mesmo payload.
  const photo = view.photo_url ? await loadImage(view.photo_url) : null;
  const shading = view.shading_url ? await loadImage(view.shading_url) : null;
  const imageUrl: string | null = values.image || values.template || null;
  const arte = imageUrl ? await loadImage(imageUrl) : null;
  if (geracaoDoCanvas.get(canvas) !== geracao) return;

  const scale = o.pixelWidth / view.base.w;
  canvas.width = Math.round(view.base.w * scale);
  canvas.height = Math.round(view.base.h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, view.base.w, view.base.h);

  // 1. Backdrop "estúdio"
  if (o.backdrop) {
    ctx.fillStyle = o.backdrop;
    ctx.fillRect(0, 0, view.base.w, view.base.h);
    ctx.fillStyle = "rgba(0,0,0,0.07)";
    ctx.beginPath();
    ctx.ellipse(view.base.w / 2, view.base.h * 0.85, view.base.w * 0.27, 26, 0, 0, 7);
    ctx.fill();
  }

  // 2. Produto: foto HD ou garment vetorial provisório
  const isVector = !view.photo_url;
  const tinta = dobrasParaCor(o.garmentColor);
  if (view.photo_url) {
    if (photo) ctx.drawImage(photo, 0, 0, view.base.w, view.base.h);
  } else if (view.garment && view.garment.shape === "tshirt") {
    const back = !!view.garment.back;
    ctx.save();
    tshirtPath(ctx, back);
    ctx.fillStyle = o.garmentColor;
    ctx.fill();
    ctx.strokeStyle = "rgba(" + tinta.sombra + ",0.22)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    if (!back) {
      ctx.strokeStyle = "rgba(" + tinta.sombra + ",0.30)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(392, 128);
      ctx.quadraticCurveTo(440, 196, 500, 196);
      ctx.quadraticCurveTo(560, 196, 608, 128);
      ctx.stroke();
    }
    drawFolds(ctx, back, 0.06, tinta);
  }

  // 3/4. Arte + texto por área (clipado ao garment quando vetorial).
  // Área com quad válido vai para a foto deformada; sem quad, o `rect`
  // de sempre.
  for (const area of view.areas) {
    if (quadValido(area.quad)) {
      drawAreaNoQuad(ctx, view, area, area.quad, values, o, arte, photo, scale, isVector);
    } else if (area.rect) {
      drawAreaContent(ctx, view, area.rect, values, o, isVector, arte);
    }
  }

  // 5. Sombras por cima da arte (a arte "assenta" no tecido)
  if (isVector && view.garment && view.garment.shape === "tshirt") {
    drawFolds(ctx, !!view.garment.back, 0.075, tinta);
  } else if (shading) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(shading, 0, 0, view.base.w, view.base.h);
    ctx.restore();
  }

  // 6. Outline da área de impressão (só preview; nunca no HD)
  if (o.showAreas) {
    for (const area of view.areas) {
      const quad = quadValido(area.quad) ? area.quad : null;
      const r = quad ? caixaDoQuad(quad) : area.rect;
      if (!r) continue;
      ctx.save();
      ctx.strokeStyle = "#7C3AED";
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2;
      if (quad) {
        ctx.beginPath();
        ctx.moveTo(quad[0].x, quad[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(quad[i].x, quad[i].y);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.strokeRect(r.x, r.y, r.w, r.h);
      }
      ctx.fillStyle = "#7C3AED";
      ctx.font = "600 15px -apple-system, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(
        "área " + area.width_cm + "×" + area.height_cm + " cm",
        r.x,
        r.y - 8
      );
      ctx.restore();
    }
  }
}

type OpcoesDaArte = Required<Pick<ComposeOptions, "garmentColor" | "artColor" | "font">> & ComposeOptions;

// Imagem + texto encaixados num retângulo. É o encaixe de sempre do
// `rect`, e o quad reaproveita: a arte é montada de frente e só depois
// deformada.
function desenharArteNoRetangulo(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  values: ComposeValues,
  o: OpcoesDaArte,
  img: HTMLImageElement | null
): boolean {
  const imageUrl: string | null = values.image || values.template || null;
  const text: string = values.text != null ? String(values.text) : "";
  if (!imageUrl && !text) return false;

  const cx = rect.x + rect.w / 2;
  const hasImage = !!imageUrl;
  const imgBoxH = rect.h * (text ? 0.62 : 0.9);

  if (hasImage) {
    if (img && img.width > 0) {
      const r = Math.min(rect.w / img.width, imgBoxH / img.height);
      const dw = img.width * r;
      const dh = img.height * r;
      ctx.drawImage(img, cx - dw / 2, rect.y + (imgBoxH - dh) / 2, dw, dh);
    }
  }

  if (text) {
    ctx.fillStyle = o.artColor;
    ctx.textAlign = "center";
    // Fit: começa proporcional à área e reduz até caber na largura
    let fontPx = Math.min(rect.h * (hasImage ? 0.22 : 0.3), rect.w * 0.6);
    ctx.font = "600 " + Math.round(fontPx) + "px " + o.font;
    while (fontPx > 10 && ctx.measureText(text).width > rect.w * 0.94) {
      fontPx -= 2;
      ctx.font = "600 " + Math.round(fontPx) + "px " + o.font;
    }
    const ty = hasImage
      ? rect.y + imgBoxH + (rect.h - imgBoxH) / 2 + fontPx * 0.35
      : rect.y + rect.h / 2 + fontPx * 0.35;
    ctx.fillText(text, cx, ty);
  }
  return true;
}

function drawAreaContent(
  ctx: CanvasRenderingContext2D,
  view: VisualView,
  rect: { x: number; y: number; w: number; h: number },
  values: ComposeValues,
  o: OpcoesDaArte,
  clipVector: boolean,
  img: HTMLImageElement | null
) {
  const imageUrl: string | null = values.image || values.template || null;
  const text: string = values.text != null ? String(values.text) : "";
  if (!imageUrl && !text) return;

  ctx.save();
  if (clipVector) clipToGarment(ctx, view);
  desenharArteNoRetangulo(ctx, rect, values, o, img);
  ctx.restore();
}

/** Teto da resolução da arte intermediária (px no lado maior). */
const LADO_MAXIMO_DA_ARTE = 2048;

function drawAreaNoQuad(
  ctx: CanvasRenderingContext2D,
  view: VisualView,
  area: VisualArea,
  quad: VisualQuad,
  values: ComposeValues,
  o: OpcoesDaArte,
  img: HTMLImageElement | null,
  photo: HTMLImageElement | null,
  scale: number,
  clipVector: boolean
) {
  const imageUrl: string | null = values.image || values.template || null;
  const text: string = values.text != null ? String(values.text) : "";
  if (!imageUrl && !text) return;

  // 1. A arte montada de frente, num canvas intermediário com a
  //    resolução que ela terá no destino (texto nítido no HD).
  const { w: qw, h: qh } = medidasDoQuad(quad);
  if (qw < 1 || qh < 1) return;
  const k = Math.min(LADO_MAXIMO_DA_ARTE / Math.max(qw, qh), Math.max(scale, 0.25));
  const arteCv = criarCanvas(qw * k, qh * k);
  const actx = arteCv && arteCv.getContext("2d");
  if (!arteCv || !actx) return;
  actx.setTransform(arteCv.width / qw, 0, 0, arteCv.height / qh, 0, 0);
  if (!desenharArteNoRetangulo(actx, { x: 0, y: 0, w: qw, h: qh }, values, o, img)) return;

  // 2. A arte deformada até o quad, numa camada do tamanho da caixa dele
  //    (em px de saída). Cada triângulo da malha: recorte + afim + drawImage.
  const caixa = caixaDoQuad(quad);
  const bx = Math.floor(caixa.x) - 1, by = Math.floor(caixa.y) - 1;
  const bw = Math.ceil(caixa.w) + 3, bh = Math.ceil(caixa.h) + 3;
  const camada = criarCanvas(bw * scale, bh * scale);
  const lctx = camada && camada.getContext("2d");
  if (!camada || !lctx) return;
  const aw = arteCv.width, ah = arteCv.height;
  const paraCamada = (p: VisualPoint) => ({ x: (p.x - bx) * scale, y: (p.y - by) * scale });
  for (const t of malhaDoQuad(quad, aw, ah)) {
    const destino = t.destino.map(paraCamada) as [VisualPoint, VisualPoint, VisualPoint];
    const m = afimDoTriangulo(t.origem, destino);
    if (!m) continue;
    const recorte = trianguloExpandido(destino, 0.6);
    lctx.save();
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.beginPath();
    lctx.moveTo(recorte[0].x, recorte[0].y);
    lctx.lineTo(recorte[1].x, recorte[1].y);
    lctx.lineTo(recorte[2].x, recorte[2].y);
    lctx.closePath();
    lctx.clip();
    lctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    lctx.drawImage(arteCv, 0, 0);
    lctx.restore();
  }

  // 3. Sombreado da foto multiplicado SÓ sobre a arte: multiply na
  //    camada e depois `destination-in` com a própria arte, que devolve
  //    o alfa original (sem isso a sombra escureceria a foto em volta).
  const forca = view.shading_from_photo ? Number(view.shading_from_photo.strength) : null;
  const analise = photo ? analisarFoto(photo, view, quad, forca) : null;
  if (analise && analise.sombra && analise.caixa) {
    const copia = criarCanvas(camada.width, camada.height);
    const cctx = copia && copia.getContext("2d");
    if (copia && cctx) {
      cctx.drawImage(camada, 0, 0);
      lctx.save();
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.globalCompositeOperation = "multiply";
      lctx.drawImage(
        analise.sombra,
        (analise.caixa.x - bx) * scale, (analise.caixa.y - by) * scale,
        analise.caixa.w * scale, analise.caixa.h * scale
      );
      lctx.globalCompositeOperation = "destination-in";
      lctx.drawImage(copia, 0, 0);
      lctx.restore();
    }
  }

  // 4. A camada na foto, com o modo de mistura da peça. Área só com
  //    vetor (sem foto) mantém o normal opaco de sempre.
  const blend = photo
    ? blendDaArte(analise ? analise.luminancia : null, view.art_blend ?? null)
    : blendDaArte(null, view.art_blend ?? "normal");
  ctx.save();
  if (clipVector) clipToGarment(ctx, view);
  ctx.globalCompositeOperation = blend.modo === "multiply" ? "multiply" : "source-over";
  ctx.globalAlpha = blend.alfa;
  ctx.drawImage(camada, bx, by, bw, bh);
  ctx.restore();
}

// ── Export HD — mesmo motor, resolução de impressão ──────────
export async function exportPng(
  view: VisualView,
  values: ComposeValues,
  opts: ComposeOptions = {},
  pixelWidth = 2048
): Promise<string | null> {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  await composeView(canvas, view, values, { ...opts, showAreas: false, pixelWidth });
  try {
    return canvas.toDataURL("image/png");
  } catch (_e) {
    // Canvas tainted (imagem sem CORS) — caller mostra erro amigável
    return null;
  }
}
