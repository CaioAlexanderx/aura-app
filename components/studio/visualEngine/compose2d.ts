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
// PersonalizationPreview — ver PersonalizacaoLivePreview.tsx.
//
// 03/07/2026 — F1 do escopo Visualização 2D/3D (contrato no chat)
// ============================================================
import type { VisualArea, VisualView } from "@/services/studioVisualApi";

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

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === "undefined") return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous"; // R2 público — evita taint no toDataURL
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
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

function drawFolds(ctx: CanvasRenderingContext2D, back: boolean, alpha: number) {
  ctx.save();
  tshirtPath(ctx, back);
  ctx.clip();
  ctx.strokeStyle = "rgba(0,0,0," + alpha + ")";
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
  ctx.strokeStyle = "rgba(255,255,255," + alpha * 1.4 + ")";
  ctx.lineWidth = 5;
  for (const c of cr) {
    ctx.beginPath(); ctx.moveTo(c[0], c[1] + 7); ctx.quadraticCurveTo(c[2], c[3] + 7, c[4], c[5] + 7); ctx.stroke();
  }
  ctx.fillStyle = "rgba(0,0,0," + alpha * 1.2 + ")";
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

// ── Composição principal ─────────────────────────────────
export async function composeView(
  canvas: HTMLCanvasElement,
  view: VisualView,
  values: ComposeValues,
  opts: ComposeOptions = {}
): Promise<void> {
  const o = { ...DEFAULTS, ...opts };
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
  if (view.photo_url) {
    const photo = await loadImage(view.photo_url);
    if (photo) ctx.drawImage(photo, 0, 0, view.base.w, view.base.h);
  } else if (view.garment && view.garment.shape === "tshirt") {
    const back = !!view.garment.back;
    ctx.save();
    tshirtPath(ctx, back);
    ctx.fillStyle = o.garmentColor;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    if (!back) {
      ctx.strokeStyle = "rgba(0,0,0,0.30)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(392, 128);
      ctx.quadraticCurveTo(440, 196, 500, 196);
      ctx.quadraticCurveTo(560, 196, 608, 128);
      ctx.stroke();
    }
    drawFolds(ctx, back, 0.06);
  }

  // 3. Sombras da foto real (multiply) — fase fotos HD
  let shading: HTMLImageElement | null = null;
  if (view.shading_url) shading = await loadImage(view.shading_url);

  // 4. Arte + texto por área (clipado ao garment quando vetorial)
  for (const area of view.areas) {
    await drawAreaContent(ctx, view, area, values, o, isVector);
  }

  // 5. Sombras por cima da arte (a arte "assenta" no tecido)
  if (isVector && view.garment && view.garment.shape === "tshirt") {
    drawFolds(ctx, !!view.garment.back, 0.075);
  } else if (shading) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(shading, 0, 0, view.base.w, view.base.h);
    ctx.restore();
  }

  // 6. Outline da área de impressão (só preview; nunca no HD)
  if (o.showAreas) {
    for (const area of view.areas) {
      ctx.save();
      ctx.strokeStyle = "#7C3AED";
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2;
      ctx.strokeRect(area.rect.x, area.rect.y, area.rect.w, area.rect.h);
      ctx.fillStyle = "#7C3AED";
      ctx.font = "600 15px -apple-system, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(
        "área " + area.width_cm + "×" + area.height_cm + " cm",
        area.rect.x,
        area.rect.y - 8
      );
      ctx.restore();
    }
  }
}

async function drawAreaContent(
  ctx: CanvasRenderingContext2D,
  view: VisualView,
  area: VisualArea,
  values: ComposeValues,
  o: Required<Pick<ComposeOptions, "garmentColor" | "artColor" | "font">> & ComposeOptions,
  clipVector: boolean
) {
  const imageUrl: string | null = values.image || values.template || null;
  const text: string = values.text != null ? String(values.text) : "";
  if (!imageUrl && !text) return;

  ctx.save();
  if (clipVector) clipToGarment(ctx, view);

  const cx = area.rect.x + area.rect.w / 2;
  const hasImage = !!imageUrl;
  const imgBoxH = area.rect.h * (text ? 0.62 : 0.9);

  if (hasImage) {
    const img = await loadImage(imageUrl as string);
    if (img && img.width > 0) {
      const r = Math.min(area.rect.w / img.width, imgBoxH / img.height);
      const dw = img.width * r;
      const dh = img.height * r;
      ctx.drawImage(img, cx - dw / 2, area.rect.y + (imgBoxH - dh) / 2, dw, dh);
    }
  }

  if (text) {
    ctx.fillStyle = o.artColor;
    ctx.textAlign = "center";
    // Fit: começa proporcional à área e reduz até caber na largura
    let fontPx = Math.min(area.rect.h * (hasImage ? 0.22 : 0.3), area.rect.w * 0.6);
    ctx.font = "600 " + Math.round(fontPx) + "px " + o.font;
    while (fontPx > 10 && ctx.measureText(text).width > area.rect.w * 0.94) {
      fontPx -= 2;
      ctx.font = "600 " + Math.round(fontPx) + "px " + o.font;
    }
    const ty = hasImage
      ? area.rect.y + imgBoxH + (area.rect.h - imgBoxH) / 2 + fontPx * 0.35
      : area.rect.y + area.rect.h / 2 + fontPx * 0.35;
    ctx.fillText(text, cx, ty);
  }

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
