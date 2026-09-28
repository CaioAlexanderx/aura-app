// ============================================================
// AURA STUDIO · visualEngine/pontoNaVista — o ponteiro na área da vista
// 2D (28/09/2026)
//
// O arraste da arte no 2D (template de foto e "Mockup na foto"): um
// ponto do canvas, em coordenadas da vista (`view.base`), vira fração
// da área — pelo retângulo, ou pela homografia INVERSA do quad marcado
// na foto (a arte é deformada até o quad; o dedo tem de voltar pelo
// mesmo caminho). Puro, para teste.
// ============================================================
import type { VisualArea, VisualQuad } from "@/services/studioVisualApi";
import { homografiaDoQuadradoUnitario, quadValido, medidasDoQuad } from "./compose2d";

/** (u, v) no quadrado unitário a partir de um ponto do quad (homografia inversa). */
export function inversoNoQuad(q: VisualQuad, x: number, y: number): { u: number; v: number } | null {
  const [a, b, c, d, e, f, g, h] = homografiaDoQuadradoUnitario(q);
  // M = [[a b c] [d e f] [g h 1]]; (u, v) = M⁻¹ · (x, y, 1)
  const A = e - f * h, B = c * h - b, C = b * f - c * e;
  const D = f * g - d, E = a - c * g, F = c * d - a * f;
  const G = d * h - e * g, Hh = b * g - a * h, I = a * e - b * d;
  const w = G * x + Hh * y + I;
  if (!Number.isFinite(w) || Math.abs(w) < 1e-12) return null;
  return { u: (A * x + B * y + C) / w, v: (D * x + E * y + F) / w };
}

export type PontoDaVista = {
  u: number; v: number; aspecto: number; areaCm: { w: number; h: number } | null;
  /** Largura da área em coordenadas da vista (para a folga do toque em pixels de tela). */
  larguraNaVista: number;
};

/** O ponto (coordenadas da vista) na área: fração da largura e da altura. */
export function pontoNaAreaDaVista(area: VisualArea, x: number, y: number): PontoDaVista | null {
  const areaCm = area.width_cm > 0 && area.height_cm > 0 ? { w: area.width_cm, h: area.height_cm } : null;
  if (quadValido(area.quad)) {
    const p = inversoNoQuad(area.quad, x, y);
    if (!p) return null;
    const m = medidasDoQuad(area.quad);
    return { u: p.u, v: p.v, aspecto: m.w > 0 ? m.h / m.w : 1, areaCm, larguraNaVista: m.w };
  }
  const r = area.rect;
  if (!r || !(r.w > 0) || !(r.h > 0)) return null;
  return { u: (x - r.x) / r.w, v: (y - r.y) / r.h, aspecto: r.h / r.w, areaCm, larguraNaVista: r.w };
}
