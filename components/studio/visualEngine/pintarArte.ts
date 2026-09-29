// ============================================================
// AURA STUDIO · visualEngine/pintarArte — o desenho da arte na área
// (28/09/2026)
//
// Um pintor só para a arte de um lado (ArteDoLado): o compose2d chama
// no retângulo da vista (ou no canvas plano que depois é deformado até
// o quad da foto), o compose3dMug chama no retângulo da área na textura,
// e a ficha usa o gêmeo em SVG (`svgDaArte`). A posição de cada coisa
// vem de layoutDaArte.resolverArte — este arquivo só executa.
//
// O canvas é desenhado em PIXELS, não na unidade da área: a unidade é
// cm (8,4 × 6,3), e fonte de 1,5 px escalada por transformação sai
// borrada ou some em alguns navegadores. Cada item leva sua própria
// transformação (centro → escala da área → rotação).
// ============================================================
import {
  resolverArte, unidadeDaArea, margemDaArea, caixaDoItem, subAreaNoRetangulo, comAreaDoMotor, PESO_DO_TEXTO,
  type ArteDoLado, type ItemDaArte, type Medidor,
} from "./layoutDaArte";

export type ImagemDaArte = { width: number; height: number } & CanvasImageSource;
export type ImagensDaArte = Map<string, ImagemDaArte>;
export type Retangulo = { x: number; y: number; w: number; h: number };

/** Violeta das guias (o mesmo do outline da área que o motor já tinha). */
export const COR_DA_GUIA = "#7C3AED";

/** A arte veio da vitrine (valoresDoMotor)? */
export function arteDosValores(values: Record<string, any> | null | undefined): ArteDoLado | null {
  const a = values && (values as any).__arte;
  return a && typeof a === "object" && a.v === 1 && Array.isArray(a.imagens) && Array.isArray(a.textos) ? (a as ArteDoLado) : null;
}

/** Há algo para desenhar (ou guias para mostrar)? */
export function arteTemConteudo(arte: ArteDoLado | null): boolean {
  if (!arte) return false;
  return arte.imagens.length > 0 || arte.textos.some((t) => String(t.texto || "").trim()) || !!arte.guias;
}

// ── Recorte pela caixa do conteúdo (opcional, 29/09/2026) ────
//
// Logo com borda transparente (ou, na sublimação, com fundo branco) ocupa
// o canvas inteiro mas só uma parte tem tinta: no vídeo do orçamento a
// arte saía pequena. Com `aparar` na imagem da arte, ela é recortada pela
// caixa do que tem tinta ANTES do layout medir o aspecto. Quem não pede
// (a vitrine) recebe a imagem original, como sempre.

/** Alfa abaixo disso (de 255) é vazio: ignora o pó de antialiasing e sombras quase invisíveis. */
export const ALFA_MINIMO = 16;
/** Na sublimação (multiply) o branco não imprime: cada canal a partir daqui conta como branco. */
export const BRANCO_MINIMO = 245;
const LADO_DA_MEDIDA = 512;
const LADO_MAXIMO_DO_RECORTE = 2048;

/**
 * A caixa (px) do que tem tinta num ImageData RGBA; null se não há nada
 * ou se o conteúdo já ocupa (quase) tudo. `branco`: pixel claro demais
 * também é vazio.
 */
export function caixaDoConteudo(
  rgba: ArrayLike<number>,
  w: number,
  h: number,
  branco = false,
): { x: number; y: number; w: number; h: number } | null {
  if (!(w > 0) || !(h > 0) || rgba.length < w * h * 4) return null;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    const linha = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = linha + x * 4;
      if (rgba[i + 3] < ALFA_MINIMO) continue;
      if (branco && rgba[i] >= BRANCO_MINIMO && rgba[i + 1] >= BRANCO_MINIMO && rgba[i + 2] >= BRANCO_MINIMO) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** A imagem recortada pela caixa do conteúdo; null = não há o que recortar (ou não dá: sem canvas, CORS). */
function imagemAparada(im: ImagemDaArte, branco: boolean): ImagemDaArte | null {
  if (typeof document === "undefined") return null;
  try {
    const k = Math.min(1, LADO_DA_MEDIDA / Math.max(im.width, im.height));
    const mw = Math.max(1, Math.round(im.width * k)), mh = Math.max(1, Math.round(im.height * k));
    const medida = document.createElement("canvas");
    medida.width = mw; medida.height = mh;
    const mctx = medida.getContext("2d", { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
    if (!mctx) return null;
    mctx.drawImage(im, 0, 0, mw, mh);
    const c = caixaDoConteudo(mctx.getImageData(0, 0, mw, mh).data, mw, mh, branco);
    // Vazia (tudo transparente/branco) ou já cheia: fica a original.
    if (!c || (c.w >= mw * 0.98 && c.h >= mh * 0.98)) return null;
    // De volta aos pixels da imagem, com um pixel de folga da medida.
    const sx = Math.max(0, Math.floor((c.x - 1) / k)), sy = Math.max(0, Math.floor((c.y - 1) / k));
    const sw = Math.min(im.width - sx, Math.ceil((c.w + 2) / k)), sh = Math.min(im.height - sy, Math.ceil((c.h + 2) / k));
    if (!(sw > 0) || !(sh > 0)) return null;
    const r = Math.min(1, LADO_MAXIMO_DO_RECORTE / Math.max(sw, sh));
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(sw * r)); out.height = Math.max(1, Math.round(sh * r));
    const octx = out.getContext("2d");
    if (!octx) return null;
    octx.drawImage(im, sx, sy, sw, sh, 0, 0, out.width, out.height);
    return out;
  } catch {
    // Canvas sujo (imagem sem CORS) ou sem memória: segue com a original.
    return null;
  }
}

/** Todas as imagens da arte, carregadas pelo carregador de quem desenha. */
export async function precarregarArte(
  arte: ArteDoLado | null,
  carregar: (url: string) => Promise<ImagemDaArte | null>,
): Promise<ImagensDaArte> {
  const out: ImagensDaArte = new Map();
  if (!arte) return out;
  const urls = Array.from(new Set(arte.imagens.map((i) => i.url).filter(Boolean)));
  const imgs = await Promise.all(urls.map((u) => carregar(u).catch(() => null)));
  urls.forEach((u, i) => {
    const im = imgs[i];
    if (!im || !(im.width > 0)) return;
    // Só recorta quando TODA imagem com essa URL pede; a sublimação também
    // descarta o branco (multiply: o branco some na peça).
    const aparar = arte.imagens.filter((x) => x.url === u).every((x) => x.aparar);
    out.set(u, (aparar && imagemAparada(im, arte.tecnica === "sublimacao")) || im);
  });
  return out;
}

/** Medidor para o layout a partir de um contexto 2D (texto) e das imagens carregadas. */
export function medidorDoCanvas(ctx: CanvasRenderingContext2D | null, imgs: ImagensDaArte): Medidor {
  return {
    aspecto: (url) => {
      const im = imgs.get(url);
      return im && im.width > 0 ? im.height / im.width : null;
    },
    largura: (texto, fonte, px) => {
      if (!ctx) return String(texto).length * px * 0.55;
      ctx.save();
      ctx.font = `${PESO_DO_TEXTO} 100px ${fonte}`;
      const w = ctx.measureText(String(texto)).width;
      ctx.restore();
      return (w * px) / 100;
    },
  };
}

function corDoContorno(cor: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(cor).trim().replace(/^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i, "#$1$1$2$2$3$3"));
  if (!m) return "#1A1714";
  const n = parseInt(m[1], 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.55 ? "#1A1714" : "#FFFFFF";
}

function pintarItens(
  ctx: CanvasRenderingContext2D,
  itens: ItemDaArte[],
  imgs: ImagensDaArte,
  rect: Retangulo,
  sx: number,
  sy: number,
) {
  for (const it of itens) {
    ctx.save();
    ctx.translate(rect.x + it.cx * sx, rect.y + it.cy * sy);
    if (it.tipo === "imagem") {
      const im = imgs.get(it.url);
      if (im) {
        ctx.scale(sx, sy);
        ctx.rotate((it.rot * Math.PI) / 180);
        ctx.drawImage(im, -it.w / 2, -it.h / 2, it.w, it.h);
      }
    } else {
      // Escala anisotrópica antes da rotação: a letra acompanha a área
      // mesmo quando o retângulo do motor não tem a proporção dos cm.
      ctx.scale(sy > 0 ? sx / sy : 1, 1);
      ctx.rotate((it.rot * Math.PI) / 180);
      const fs = Math.max(1, it.px * sy);
      ctx.font = `${PESO_DO_TEXTO} ${fs}px ${it.fonte}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (it.contorno) {
        ctx.lineJoin = "round";
        ctx.lineWidth = Math.max(1, fs * 0.1);
        ctx.strokeStyle = corDoContorno(it.cor);
        ctx.strokeText(it.texto, 0, 0);
      }
      ctx.fillStyle = it.cor;
      ctx.fillText(it.texto, 0, 0);
    }
    ctx.restore();
  }
}

export type OpcoesDoPintor = {
  /** Modo de mistura da arte sobre o que já está no canvas (sublimação = multiply). */
  mistura?: "multiply" | "normal" | null;
  /** Espessura base das guias, em px do destino (padrão: 0,8% do lado maior da área). */
  linha?: number;
  /** A medida da área que o MOTOR conhece (spec da vista), quando o produto não tem a sua. */
  areaCmDoMotor?: { w: number; h: number } | null;
  /** A área do produto pode passar do retângulo do motor (3D: a textura continua em volta). */
  transbordar?: boolean;
  /** Pixel não quadrado na peça (caneca): ver subAreaNoRetangulo. */
  pixel?: number | null;
  /**
   * Posição livre do orçamento (29/09/2026): `rect` é o PAINEL inteiro do
   * lado, e a unidade é a da peça (a largura dividida pelo `pixel`), sem
   * medida em cm, sem margem e sem a sub-área do produto. O corte é só na
   * borda do painel.
   */
  livre?: boolean;
};

/** A arte livre no painel: só a borda do painel corta; na edição, a caixa e as alças da arte. */
function pintarArteLivre(
  ctx: CanvasRenderingContext2D,
  rect: Retangulo,
  arte: ArteDoLado,
  imgs: ImagensDaArte,
  opts: OpcoesDoPintor,
): ItemDaArte[] {
  // `pixel` = pixels da textura por unidade na horizontal ÷ na vertical: a
  // largura do painel na peça, medida em pixels verticais, é rect.w ÷ pixel.
  const W = rect.w / (opts.pixel && opts.pixel > 0 ? opts.pixel : 1), H = rect.h;
  const sx = rect.w / W, sy = rect.h / H;
  const itens = resolverArte(arte, W, H, medidorDoCanvas(ctx, imgs));
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.globalCompositeOperation = opts.mistura === "multiply" ? "multiply" : "source-over";
  pintarItens(ctx, itens, imgs, rect, sx, sy);
  ctx.restore();
  if (arte.editando) {
    const lw = opts.linha || Math.max(1.5, Math.max(rect.w, rect.h) * 0.004);
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.strokeStyle = COR_DA_GUIA;
    for (const it of itens) {
      if (arte.selecionado && it.campo !== arte.selecionado) continue;
      // A caixa gira com a arte: desenhada no referencial dela.
      ctx.save();
      ctx.translate(rect.x + it.cx * sx, rect.y + it.cy * sy);
      ctx.scale(sx, sy);
      ctx.rotate((it.rot * Math.PI) / 180);
      const k = 1 / Math.max(1e-6, Math.min(sx, sy));
      ctx.lineWidth = lw * k;
      ctx.setLineDash([lw * 3 * k, lw * 2 * k]);
      ctx.strokeRect(-it.w / 2, -it.h / 2, it.w, it.h);
      ctx.setLineDash([]);
      const q = lw * 5 * k;
      ctx.fillStyle = "#FFFFFF";
      for (const [px, py] of [[-it.w / 2, -it.h / 2], [it.w / 2, -it.h / 2], [it.w / 2, it.h / 2], [-it.w / 2, it.h / 2]]) {
        ctx.fillRect(px - q / 2, py - q / 2, q, q);
        ctx.strokeRect(px - q / 2, py - q / 2, q, q);
      }
      ctx.restore();
    }
    ctx.restore();
  }
  return itens;
}


/**
 * Desenha a arte do lado no retângulo da área e devolve os itens já
 * resolvidos (na unidade da área), para quem precisar medir ou tocar.
 */
export function pintarArteNaArea(
  ctx: CanvasRenderingContext2D,
  rect: Retangulo,
  arte: ArteDoLado,
  imgs: ImagensDaArte,
  opts: OpcoesDoPintor = {},
): ItemDaArte[] {
  if (opts.livre) return pintarArteLivre(ctx, rect, arte, imgs, opts);
  // A área do produto dentro da do motor (escala física); sem medida no
  // produto, vale a do motor no retângulo inteiro.
  arte = comAreaDoMotor(arte, opts.areaCmDoMotor);
  if (arte.areaCm) rect = subAreaNoRetangulo(rect, arte.areaCm, opts.areaCmDoMotor || null, !opts.transbordar, opts.pixel);
  const { W, H, emCm } = unidadeDaArea(arte, rect);
  const sx = rect.w / W, sy = rect.h / H;
  const itens = resolverArte(arte, W, H, medidorDoCanvas(ctx, imgs));
  const modo: GlobalCompositeOperation = opts.mistura === "multiply" ? "multiply" : "source-over";

  // Editando: o que passa da área aparece apagado — a cliente vê o que
  // vai ser cortado, em vez de a arte sumir na borda.
  if (arte.editando) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.globalCompositeOperation = modo;
    pintarItens(ctx, itens, imgs, rect, sx, sy);
    ctx.restore();
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.globalCompositeOperation = modo;
  pintarItens(ctx, itens, imgs, rect, sx, sy);
  ctx.restore();

  if (arte.guias || arte.editando) {
    const lw = opts.linha || Math.max(1.5, Math.max(rect.w, rect.h) * 0.008);
    ctx.save();
    ctx.strokeStyle = COR_DA_GUIA;
    ctx.lineWidth = lw;
    ctx.setLineDash([lw * 4, lw * 3]);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    if (arte.editando) {
      const m = margemDaArea(W, H, emCm);
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = lw * 0.7;
      ctx.setLineDash([lw * 2, lw * 2]);
      ctx.strokeRect(rect.x + m * sx, rect.y + m * sy, rect.w - 2 * m * sx, rect.h - 2 * m * sy);
      ctx.globalAlpha = 1;
      const sel = arte.selecionado ? itens.find((i) => i.campo === arte.selecionado) : null;
      if (sel) {
        const c = caixaDoItem(sel);
        const x = rect.x + c.x * sx, y = rect.y + c.y * sy, w = c.w * sx, h = c.h * sy;
        ctx.setLineDash([]);
        ctx.lineWidth = lw * 0.9;
        ctx.strokeRect(x, y, w, h);
        const q = lw * 4;
        ctx.fillStyle = "#FFFFFF";
        for (const [px, py] of [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]) {
          ctx.fillRect(px - q / 2, py - q / 2, q, q);
          ctx.strokeRect(px - q / 2, py - q / 2, q, q);
        }
      }
    }
    ctx.restore();
  }
  return itens;
}

// ── SVG (ficha e prévia sem motor) ──────────────────────────

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/**
 * A mesma arte em SVG, no retângulo `rect` (unidades do viewBox de quem
 * chama). Sem o aspecto da imagem (não carregada), a imagem entra
 * "inteira" dentro da caixa do layout.
 */
export function svgDaArte(arte: ArteDoLado, rect: Retangulo, medir: Medidor, idDoClip: string): string {
  const { W, H } = unidadeDaArea(arte, rect);
  const sx = rect.w / W, sy = rect.h / H;
  const itens = resolverArte(arte, W, H, medir);
  const partes: string[] = [];
  for (const it of itens) {
    const tx = rect.x + it.cx * sx, ty = rect.y + it.cy * sy;
    if (it.tipo === "imagem") {
      partes.push(
        `<g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${sx.toFixed(5)} ${sy.toFixed(5)}) rotate(${it.rot})">` +
        `<image href="${esc(it.url)}" x="${(-it.w / 2).toFixed(3)}" y="${(-it.h / 2).toFixed(3)}" width="${it.w.toFixed(3)}" height="${it.h.toFixed(3)}" preserveAspectRatio="xMidYMid meet"/></g>`,
      );
    } else {
      const fs = it.px * sy;
      const contorno = it.contorno
        ? `<text x="0" y="0" text-anchor="middle" dominant-baseline="central" font-family="${esc(it.fonte)}" font-weight="${PESO_DO_TEXTO}" font-size="${fs.toFixed(3)}" fill="none" stroke="${corDoContorno(it.cor)}" stroke-width="${(fs * 0.1).toFixed(3)}" stroke-linejoin="round">${esc(it.texto)}</text>`
        : "";
      partes.push(
        `<g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${(sy > 0 ? sx / sy : 1).toFixed(5)} 1) rotate(${it.rot})">${contorno}` +
        `<text x="0" y="0" text-anchor="middle" dominant-baseline="central" font-family="${esc(it.fonte)}" font-weight="${PESO_DO_TEXTO}" font-size="${fs.toFixed(3)}" fill="${esc(it.cor)}">${esc(it.texto)}</text></g>`,
      );
    }
  }
  let guias = "";
  if (arte.editando) {
    const lw = Math.max(rect.w, rect.h) * 0.006;
    const m = margemDaArea(W, H, unidadeDaArea(arte, rect).emCm);
    guias += `<rect x="${rect.x + m * sx}" y="${rect.y + m * sy}" width="${rect.w - 2 * m * sx}" height="${rect.h - 2 * m * sy}" fill="none" stroke="${COR_DA_GUIA}" stroke-opacity="0.55" stroke-width="${lw * 0.7}" stroke-dasharray="${lw * 2} ${lw * 2}"/>`;
    const sel = arte.selecionado ? itens.find((i) => i.campo === arte.selecionado) : null;
    if (sel) {
      const c = caixaDoItem(sel);
      guias += `<rect x="${rect.x + c.x * sx}" y="${rect.y + c.y * sy}" width="${c.w * sx}" height="${c.h * sy}" fill="none" stroke="${COR_DA_GUIA}" stroke-width="${lw}"/>`;
    }
  }
  return (
    `<clipPath id="${esc(idDoClip)}"><rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}"/></clipPath>` +
    (arte.editando ? `<g opacity="0.3">${partes.join("")}</g>` : "") +
    `<g clip-path="url(#${esc(idDoClip)})">${partes.join("")}</g>` + guias
  );
}
