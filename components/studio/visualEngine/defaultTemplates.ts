// ============================================================
// AURA STUDIO · visualEngine/defaultTemplates — specs provisórias
//
// Enquanto os ~20 templates definitivos (fotos HD padronizadas) não
// são cadastrados pela Aura em studio_visual_templates, o preview do
// configurador usa esta spec local de camiseta (garment vetorial).
// MESMO shape da spec do banco (VisualTemplateSpec) — quando o
// template real existir, troca-se a fonte sem mudar o motor.
//
// 03/07/2026 — F1
// ============================================================
import type { VisualTemplateSpec, VisualView } from "@/services/studioVisualApi";

const BASE = { w: 1000, h: 760 };
const PX_PER_CM = 10.5; // peito da camiseta vetorial ≈ 300px ≈ 28.5cm

function areaFromCm(
  id: string,
  widthCm: number,
  heightCm: number,
  position: "center" | "left" | "right",
  chestTop: number
) {
  const w = Math.min(Math.max(widthCm * PX_PER_CM, 40), 290);
  const h = Math.min(Math.max(heightCm * PX_PER_CM, 40), 330);
  let x = 500 - w / 2;
  if (position === "left") x = 370;
  if (position === "right") x = 630 - w;
  return { id, width_cm: widthCm, height_cm: heightCm, rect: { x, y: chestTop, w, h } };
}

export function defaultTshirtSpec(
  widthCm: number,
  heightCm: number,
  position: "center" | "left" | "right" = "center"
): VisualTemplateSpec {
  const front: VisualView = {
    id: "front",
    label: "Frente",
    base: BASE,
    photo_url: null,
    garment: { shape: "tshirt" },
    areas: [areaFromCm("front", widthCm, heightCm, position, 250)],
  };
  const back: VisualView = {
    id: "back",
    label: "Verso",
    base: BASE,
    photo_url: null,
    garment: { shape: "tshirt", back: true },
    areas: [areaFromCm("back", widthCm, heightCm, position, 215)],
  };
  return { schema: 1, views: [front, back] };
}
