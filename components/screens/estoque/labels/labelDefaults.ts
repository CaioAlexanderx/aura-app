// ============================================================================
// AURA. — Etiquetas: quantidade padrão e rótulo de unidade (QA 23/09/2026)
//
// Antes, o padrão de etiquetas era SEMPRE o estoque da variante (110
// etiquetas pra 110 m² de piso — errado, ninguém cola etiqueta em cada m²).
// Pra unidade fracionada (m, m², m³, kg, L, ton) e pra milheiro (tijolo,
// bloco), o padrão vira 1 — mas SÓ na loja com matcon_enabled ligado. Loja
// sem Matcon (inclusive quem vende por kg/L fora do módulo) mantém
// exatamente o comportamento de hoje: o padrão é sempre o estoque. Sem
// isso, qualquer loja de mercearia que vende por kg ou litro veria o
// padrão da etiqueta virar 1 do nada — regressão fora do escopo do QA.
//
// Puro, sem React — testável direto e usado por PrintLabels.tsx.
// ============================================================================

import { isFractionalUnit, ehMilheiro } from "@/utils/matconUnits";

/** 1 pra unidade fracionada ou milheiro, SÓ com matconEnabled; senão o
 *  estoque (mínimo 1) — o comportamento de sempre. */
export function defaultLabelQty(unit: string | null | undefined, stock: number | null | undefined, matconEnabled: boolean): number {
  if (matconEnabled && (isFractionalUnit(unit) || ehMilheiro(unit))) return 1;
  var s = Number(stock) || 0;
  return s > 1 ? s : 1;
}

/** Unidade do produto pra exibir na lista ("110 m²"); "un" quando vazia. */
export function unitLabelForList(unit: string | null | undefined): string {
  var u = String(unit || "").trim();
  return u || "un";
}
