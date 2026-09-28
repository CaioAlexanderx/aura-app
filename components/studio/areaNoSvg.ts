// ============================================================
// components/studio/areaNoSvg.ts — a área de impressão no viewBox do SVG
// da prévia (PersonalizationPreview), em módulo puro (28/09/2026): o
// arraste da vitrine precisa saber onde ela está, e os testes que mockam
// o componente não podem levar a conta junto.
// ============================================================
import type { CustomizationConfig, CustomizationFieldSide } from "@/services/studioApi";

/**
 * A área de impressão do lado no viewBox 0–100 do SVG (e a medida em cm).
 * É a conta de sempre do preview; exportada para o arraste da vitrine
 * saber onde a área está.
 */
export function areaNoSvg(
  config: CustomizationConfig,
  side: CustomizationFieldSide = "front",
): { x: number; y: number; w: number; h: number; cm: { w: number; h: number } } {
  const cfgAny: any = config;
  const areaDoLado =
    side === "back" ? cfgAny.back_print_area :
    side === "middle" ? cfgAny.middle_print_area :
    config.print_area;
  const printArea = areaDoLado || config.print_area || { width_cm: 10, height_cm: 10, position: "center" as const };
  const maxDim = Math.max(printArea.width_cm, printArea.height_cm, 1);
  const w = (printArea.width_cm / maxDim) * 55;
  const h = (printArea.height_cm / maxDim) * 55;
  let x = 50 - w / 2;
  const y = 50 - h / 2;
  if (printArea.position === "left") x = 18;
  if (printArea.position === "right") x = 82 - w;
  return { x, y, w, h, cm: { w: printArea.width_cm, h: printArea.height_cm } };
}
