// ============================================================
// components/studio/storefront/produto/medidasDaArte.ts
//
// O medidor do editor da arte no navegador (28/09/2026): a largura do
// texto com a fonte de arte (canvas) e a proporção de cada imagem. A
// proporção vem dos pixels medidos no envio; quando a imagem é uma arte
// pronta ou veio de um pedido salvo, ela é carregada uma vez e quem
// desenha é avisado (useVersaoDasMedidas) para refazer as contas.
// ============================================================
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { PESO_DO_TEXTO, type Medidor } from "@/components/studio/visualEngine/layoutDaArte";

const aspectos = new Map<string, number>();
const pixels = new Map<string, { w: number; h: number }>();
const fundos = new Map<string, boolean>();
const pedidas = new Set<string>();
const ouvintes = new Set<() => void>();
let contextoDoTexto: CanvasRenderingContext2D | null | undefined;

function contexto(): CanvasRenderingContext2D | null {
  if (contextoDoTexto !== undefined) return contextoDoTexto;
  try {
    contextoDoTexto = Platform.OS === "web" && typeof document !== "undefined"
      ? document.createElement("canvas").getContext("2d")
      : null;
  } catch {
    contextoDoTexto = null;
  }
  return contextoDoTexto;
}

function pedirImagem(url: string) {
  if (pedidas.has(url) || Platform.OS !== "web" || typeof Image === "undefined") return;
  pedidas.add(url);
  const im = new Image();
  // Com CORS para poder ler os cantos (fundo branco); o R2 responde.
  im.crossOrigin = "anonymous";
  im.onload = () => {
    if (im.naturalWidth > 0) {
      aspectos.set(url, im.naturalHeight / im.naturalWidth);
      pixels.set(url, { w: im.naturalWidth, h: im.naturalHeight });
      const f = cantosBrancos(im);
      if (f !== null) fundos.set(url, f);
    }
    ouvintes.forEach((f) => f());
  };
  im.src = url;
}

/**
 * A imagem tem fundo branco chapado? Os quatro cantos (5 × 5 px) opacos e
 * quase brancos. É o JPG de sempre: na sublimação o branco some na peça,
 * no DTF ele é impresso como um retângulo. null = não deu para ler.
 */
export function cantosBrancos(im: CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width: number; height: number }): boolean | null {
  try {
    const w = (im as any).naturalWidth || im.width, h = (im as any).naturalHeight || im.height;
    if (!(w > 10) || !(h > 10) || typeof document === "undefined") return null;
    const cv = document.createElement("canvas");
    cv.width = 5; cv.height = 5;
    const ctx = cv.getContext("2d");
    if (!ctx) return null;
    for (const [x, y] of [[0, 0], [w - 5, 0], [0, h - 5], [w - 5, h - 5]]) {
      ctx.clearRect(0, 0, 5, 5);
      ctx.drawImage(im as any, x, y, 5, 5, 0, 0, 5, 5);
      const d = ctx.getImageData(0, 0, 5, 5).data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 250 || d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235) return false;
      }
    }
    return true;
  } catch {
    return null; // sem CORS: não dá para ler
  }
}

/** Fundo branco chapado (medido nesta sessão); null = não se sabe. */
export function fundoBrancoConhecido(url: string): boolean | null {
  const f = fundos.get(url);
  return f === undefined ? null : f;
}

/** Re-renderiza quando uma medida nova de imagem chega. */
export function useVersaoDasMedidas(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const f = () => setV((n) => n + 1);
    ouvintes.add(f);
    return () => { ouvintes.delete(f); };
  }, []);
  return v;
}

/** Pixels de uma imagem já carregada aqui (arte pronta, pedido salvo). */
export function pixelsConhecidos(url: string): { w: number; h: number } | null {
  return pixels.get(url) || null;
}

export function medidorDaVitrine(arquivoDe?: (url: string) => { w: number; h: number } | null): Medidor {
  return {
    aspecto: (url) => {
      const a = arquivoDe && arquivoDe(url);
      if (a && a.w > 0) return a.h / a.w;
      const conhecido = aspectos.get(url);
      if (conhecido) return conhecido;
      pedirImagem(url);
      return null;
    },
    largura: (texto, fonte, px) => {
      const c = contexto();
      if (!c) return String(texto).length * px * 0.55;
      c.font = `${PESO_DO_TEXTO} 100px ${fonte}`;
      return (c.measureText(String(texto)).width * px) / 100;
    },
  };
}
