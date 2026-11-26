// ============================================================
// components/studio/orcamentoVideo/gravarGiro.ts
//
// Grava o vídeo do orçamento em vídeo 3D (28/09/2026): a peça dando uma
// volta de 360° em 7 s, 720 × 900 (4:5), 30 fps, sem áudio, com o logo da
// loja no canto. Tudo no navegador da lojista, com o mesmo viewer da
// vitrine (createModelViewer, cenário "estudio" no papel da vitrine).
//
// Formato, em ordem de preferência (detectado na hora):
//   1. WebCodecs (H.264) + mediabunny → MP4 com o índice no começo
//      (fastStart). Quadro a quadro, no ângulo exato (renderizarQuadro):
//      o giro sai liso até em celular fraco, e o MP4 toca no iPhone e no
//      WhatsApp. mediabunny só é carregado aqui (import dinâmico).
//   2. MediaRecorder sobre o quadro composto, preferindo MP4 (Chrome 126+,
//      Safari). Em tempo real.
//   3. MediaRecorder em WebM (Firefox antigo). O WhatsApp no iPhone pode
//      não tocar; o modal avisa.
//   Nenhum → null: o modal segue com a FOTO da peça.
//
// Um giro de velocidade constante começa e termina de frente: o vídeo
// repete sem pulo.
// ============================================================
import {
  createModelViewer,
  type Mug3DHandle,
  type Mug3DOptions,
} from "@/components/studio/visualEngine/compose3dMug";
import type { VisualTemplateSpec } from "@/services/studioVisualApi";

export const LARGURA = 720;
export const ALTURA = 900;
export const FPS = 30;
export const DURACAO_S = 7;
export const BITRATE = 3_000_000;

export type FormatoDoVideo = "mp4-webcodecs" | "mp4-mediarecorder" | "webm";

export type VideoGravado = {
  blob: Blob;
  contentType: "video/mp4" | "video/webm";
  formato: FormatoDoVideo;
  ext: "mp4" | "webm";
};

export type MarcaDoVideo = { nome: string; logoUrl?: string | null };

/** Ângulo do quadro `i` de `n`: velocidade constante, volta completa. */
export function anguloDoQuadro(i: number, n: number): number {
  return (Math.PI * 2 * i) / n;
}

/** MIME preferido do MediaRecorder: MP4 antes de WebM. */
export const MIMES_DO_GRAVADOR = [
  "video/mp4;codecs=avc1.42E01F",
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm",
];

export function mimeDoGravador(suporta: (m: string) => boolean): string | null {
  for (const m of MIMES_DO_GRAVADOR) {
    try { if (suporta(m)) return m; } catch { /* segue */ }
  }
  return null;
}

// ─── Palco escondido ─────────────────────────────────────────
// O viewer mede o canvas pelo tamanho na tela (clientWidth/Height). Fora
// do DOM ele cai numa proporção fixa de vitrine; para 4:5 o canvas precisa
// estar no documento, fora da vista.
export type Palco = {
  viewer: Mug3DHandle;
  canvas: HTMLCanvasElement;
  fechar: () => void;
  /** ms gastos em abrir o palco (three, GLB, textura): o pré-roll do viewer. */
  abrirMs?: number;
};

// ─── Medição (debug) ─────────────────────────────────────────
// Liga com localStorage.aura_debug_video = "1" (e recarrega). Sem a flag,
// nada é medido nem impresso. No fim da gravação sai um console.table com o
// tempo de cada etapa, para achar onde o minuto e meio se perde.
export function debugVideoLigado(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem("aura_debug_video") === "1";
  } catch {
    return false;
  }
}

export type Cronometro = {
  ligado: boolean;
  marca: () => number;
  soma: (etapa: string, desde: number) => void;
  tabela: (extra?: Record<string, number>) => void;
};

export function criarCronometro(ligado: boolean = debugVideoLigado(), agora: () => number = () => performance.now()): Cronometro {
  const totais: Record<string, number> = {};
  const quadros: Record<string, number> = {};
  return {
    ligado,
    marca: () => (ligado ? agora() : 0),
    soma: (etapa, desde) => {
      if (!ligado) return;
      totais[etapa] = (totais[etapa] || 0) + (agora() - desde);
      quadros[etapa] = (quadros[etapa] || 0) + 1;
    },
    tabela: (extra = {}) => {
      if (!ligado) return;
      const linhas: Record<string, { totalMs: number; quadros: number; mediaMs: number }> = {};
      for (const k of Object.keys(totais)) {
        linhas[k] = { totalMs: Math.round(totais[k]), quadros: quadros[k], mediaMs: Math.round((totais[k] / quadros[k]) * 10) / 10 };
      }
      for (const k of Object.keys(extra)) {
        linhas[k] = { totalMs: Math.round(extra[k]), quadros: 1, mediaMs: Math.round(extra[k]) };
      }
      // eslint-disable-next-line no-console
      console.table(linhas);
    },
  };
}

/**
 * Limita o progresso a ~10 atualizações por segundo (a cada 100 ms), sempre
 * deixando passar o primeiro, o 0 e o 1 (fim). Cada setState do modal
 * re-renderiza a tela inteira; a 30 quadros por segundo isso disputava a
 * thread com o render do vídeo.
 */
export function limitarProgresso(
  aoProgredir: (f: number) => void,
  intervaloMs = 100,
  agora: () => number = () => performance.now(),
): (f: number) => void {
  let ultimo = -Infinity;
  return (f: number) => {
    const t = agora();
    if (f <= 0 || f >= 1 || t - ultimo >= intervaloMs) {
      ultimo = t;
      aoProgredir(f);
    }
  };
}

export async function abrirPalco(
  spec: VisualTemplateSpec,
  values: Record<string, any>,
  opts: Mug3DOptions,
): Promise<Palco> {
  const t0 = performance.now();
  const caixa = document.createElement("div");
  caixa.setAttribute("aria-hidden", "true");
  caixa.style.cssText =
    `position:fixed;left:-20000px;top:0;width:${LARGURA}px;height:${ALTURA}px;pointer-events:none;overflow:hidden;`;
  const canvas = document.createElement("canvas");
  canvas.style.cssText = `width:${LARGURA}px;height:${ALTURA}px;display:block;`;
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  caixa.appendChild(canvas);
  document.body.appendChild(caixa);
  let viewer: Mug3DHandle;
  try {
    viewer = await createModelViewer(canvas, spec, values, { cenario: "estudio", ...opts, pixelRatio: 1 });
  } catch (e) {
    caixa.remove();
    throw e;
  }
  return {
    viewer,
    canvas,
    abrirMs: performance.now() - t0,
    fechar: () => {
      try { viewer.dispose(); } catch { /* já foi */ }
      caixa.remove();
    },
  };
}

// ─── Quadro composto (peça + logo) ───────────────────────────
function carregarImagem(url: string | null | undefined, limiteMs = 6000): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const t = setTimeout(() => resolve(null), limiteMs);
    img.onload = () => { clearTimeout(t); resolve(img); };
    img.onerror = () => { clearTimeout(t); resolve(null); };
    img.src = url;
  });
}

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "•";
}

export type Compositor = {
  quadro: HTMLCanvasElement;
  compor: () => void;
};

/**
 * O canvas 2D que vira o vídeo: a peça (o canvas do viewer, redimensionado)
 * e, por cima, o selo da loja no canto inferior direito. Logo sem CORS
 * sujaria o canvas e travaria o encoder: nesse caso sai o selo com as
 * iniciais e o nome.
 */
export async function montarCompositor(fonte: HTMLCanvasElement, marca: MarcaDoVideo, comLogo: boolean): Promise<Compositor> {
  const quadro = document.createElement("canvas");
  quadro.width = LARGURA;
  quadro.height = ALTURA;
  const ctx = quadro.getContext("2d")!;
  const logo = comLogo ? await carregarImagem(marca.logoUrl) : null;
  let logoLimpo = !!logo;
  if (logo) {
    // Confere se a imagem não suja o canvas (CORS).
    try {
      const teste = document.createElement("canvas");
      teste.width = 2; teste.height = 2;
      const t = teste.getContext("2d")!;
      t.drawImage(logo, 0, 0, 2, 2);
      t.getImageData(0, 0, 1, 1);
    } catch {
      logoLimpo = false;
    }
  }

  function selo() {
    if (!comLogo) return;
    const r = 26;
    const cx = LARGURA - r - 22;
    const cy = ALTURA - r - 22;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
    ctx.clip();
    if (logo && logoLimpo) {
      const lado = (r - 2) * 2;
      const escala = Math.max(lado / logo.width, lado / logo.height);
      const w = logo.width * escala, h = logo.height * escala;
      ctx.drawImage(logo, cx - w / 2, cy - h / 2, w, h);
    } else {
      ctx.fillStyle = "#1E293B";
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "700 18px Georgia, serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(iniciais(marca.nome), cx, cy + 1);
    }
    ctx.restore();
    if (marca.nome) {
      ctx.save();
      ctx.font = "600 16px system-ui, -apple-system, 'Segoe UI', sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(40,32,24,0.72)";
      ctx.fillText(marca.nome.slice(0, 32), cx - r - 10, cy);
      ctx.restore();
    }
  }

  function compor() {
    ctx.clearRect(0, 0, LARGURA, ALTURA);
    ctx.fillStyle = "#FBF8F3";
    ctx.fillRect(0, 0, LARGURA, ALTURA);
    // cobre o quadro mantendo a proporção do canvas do viewer
    const fw = fonte.width || LARGURA, fh = fonte.height || ALTURA;
    const escala = Math.max(LARGURA / fw, ALTURA / fh);
    const w = fw * escala, h = fh * escala;
    ctx.drawImage(fonte, (LARGURA - w) / 2, (ALTURA - h) / 2, w, h);
    selo();
  }

  return { quadro, compor };
}

// ─── 1. WebCodecs + mediabunny ───────────────────────────────
async function gravarComWebCodecs(
  palco: Palco,
  comp: Compositor,
  aoProgredir: (f: number) => void,
  cron: Cronometro = criarCronometro(false),
): Promise<VideoGravado | null> {
  if (typeof (globalThis as any).VideoEncoder === "undefined") return null;
  let mb: typeof import("mediabunny");
  try {
    // Import dinâmico de propósito: o mediabunny só entra no bundle
    // separado, carregado quando a lojista grava. O tsc do projeto (module
    // do expo/tsconfig.base) não aceita import() e acusa TS1323, como já
    // acontece em outros imports dinâmicos do app; o Metro empacota normal.
    // @ts-expect-error TS1323
    mb = await import("mediabunny");
  } catch {
    return null;
  }
  try {
    const pode = await mb.canEncodeVideo("avc", { width: LARGURA, height: ALTURA, bitrate: BITRATE });
    if (!pode) return null;
    const saida = new mb.Output({
      format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new mb.BufferTarget(),
    });
    const fonte = new mb.CanvasSource(comp.quadro, { codec: "avc", bitrate: BITRATE, keyFrameInterval: 2 });
    saida.addVideoTrack(fonte, { frameRate: FPS });
    await saida.start();
    const n = FPS * DURACAO_S;
    for (let i = 0; i < n; i++) {
      let t = cron.marca();
      palco.viewer.renderizarQuadro(anguloDoQuadro(i, n));
      cron.soma("render", t);
      t = cron.marca();
      comp.compor();
      cron.soma("compor", t);
      t = cron.marca();
      await fonte.add(i / FPS, 1 / FPS);
      cron.soma("add (encoder)", t);
      aoProgredir((i + 1) / n);
    }
    const tf = cron.marca();
    await saida.finalize();
    cron.soma("finalize (mux)", tf);
    const buffer = (saida.target as InstanceType<typeof mb.BufferTarget>).buffer;
    if (!buffer || !buffer.byteLength) return null;
    return { blob: new Blob([buffer], { type: "video/mp4" }), contentType: "video/mp4", formato: "mp4-webcodecs", ext: "mp4" };
  } catch (e) {
    console.warn("[orcamentoVideo] WebCodecs falhou, tentando MediaRecorder:", (e as any)?.message);
    return null;
  }
}

// ─── 2/3. MediaRecorder sobre o quadro composto ──────────────
function gravarComMediaRecorder(
  palco: Palco,
  comp: Compositor,
  aoProgredir: (f: number) => void,
): Promise<VideoGravado | null> {
  return new Promise((resolve) => {
    const MR = (globalThis as any).MediaRecorder;
    const quadro = comp.quadro as any;
    if (!MR || typeof quadro.captureStream !== "function") return resolve(null);
    const mime = mimeDoGravador((m) => (MR.isTypeSupported ? MR.isTypeSupported(m) : false));
    let rec: any;
    try {
      const stream = quadro.captureStream(FPS);
      rec = mime ? new MR(stream, { mimeType: mime, videoBitsPerSecond: BITRATE }) : new MR(stream);
    } catch {
      return resolve(null);
    }
    const partes: BlobPart[] = [];
    rec.ondataavailable = (e: any) => { if (e.data && e.data.size) partes.push(e.data); };
    rec.onerror = () => resolve(null);
    rec.onstop = () => {
      const tipo = String(rec.mimeType || mime || "").toLowerCase();
      const mp4 = tipo.includes("mp4");
      const blob = new Blob(partes, { type: mp4 ? "video/mp4" : "video/webm" });
      if (!blob.size) return resolve(null);
      resolve({
        blob,
        contentType: mp4 ? "video/mp4" : "video/webm",
        formato: mp4 ? "mp4-mediarecorder" : "webm",
        ext: mp4 ? "mp4" : "webm",
      });
    };
    palco.viewer.renderizarQuadro(0);
    comp.compor();
    rec.start();
    const inicio = performance.now();
    const duracao = DURACAO_S * 1000;
    const passo = (agora: number) => {
      const t = Math.min((agora - inicio) / duracao, 1);
      palco.viewer.renderizarQuadro(Math.PI * 2 * t);
      comp.compor();
      aoProgredir(t);
      if (t < 1) requestAnimationFrame(passo);
      else setTimeout(() => { try { rec.stop(); } catch { resolve(null); } }, 120);
    };
    requestAnimationFrame(passo);
  });
}

/** Grava o giro. Null quando o navegador não grava de jeito nenhum. */
export async function gravarGiro(
  palco: Palco,
  marca: MarcaDoVideo,
  comLogo: boolean,
  aoProgredir: (f: number) => void = () => {},
): Promise<VideoGravado | null> {
  const cron = criarCronometro();
  const inicio = cron.marca();
  const progresso = limitarProgresso(aoProgredir);
  // Só durante a gravação: sombra simples no viewer do palco. Sempre
  // restaurada no finally (gravação que falha ou é cancelada também).
  try { palco.viewer.modoGravacao?.(true); } catch { /* sem o modo, segue */ }
  try {
    const comp = await montarCompositor(palco.canvas, marca, comLogo);
    const web = await gravarComWebCodecs(palco, comp, progresso, cron);
    if (web) return web;
    progresso(0);
    return await gravarComMediaRecorder(palco, comp, progresso);
  } finally {
    try { palco.viewer.modoGravacao?.(false); } catch { /* já foi */ }
    if (cron.ligado) {
      cron.tabela({
        "pré-roll: abrir palco (three/GLB/textura)": palco.abrirMs || 0,
        "total em gravarGiro": performance.now() - inicio,
      });
    }
  }
}

/** Foto da peça de frente, com o selo da loja (plano B sem vídeo). */
export async function fotoDoPalco(palco: Palco, marca: MarcaDoVideo, comLogo: boolean): Promise<Blob | null> {
  const comp = await montarCompositor(palco.canvas, marca, comLogo);
  palco.viewer.renderizarQuadro(0);
  comp.compor();
  return new Promise((resolve) => {
    try {
      comp.quadro.toBlob((b) => resolve(b), "image/jpeg", 0.9);
    } catch {
      resolve(null);
    }
  });
}

/** dataURL (PNG/JPEG) → Blob. */
export function blobDoDataUrl(dataUrl: string): Blob | null {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/.exec(dataUrl || "");
  if (!m) return null;
  const tipo = m[1];
  const bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}
