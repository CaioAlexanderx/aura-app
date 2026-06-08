// ============================================================
// constants/karateBelts.ts — Mapa canônico de cores das faixas FPKT
//
// O backend devolve `belt_name` em português (texto livre-ish, ex.: "Preta",
// "Azul Claro", "Vermelha"). Aqui normalizamos para um SLUG de enum fechado
// (beltSlug) e damos a cor do swatch (BELT_HEX). Cobre o catálogo inteiro,
// incluindo "Azul Claro"/"Azul Escuro" e a "Vermelha" legada (4º Kyu, sistema
// antigo) — evita o fallback de "cor desconhecida" nas telas do Track D
// (carteirinha, verify, portal, inscrição).
// ============================================================

export type BeltSlug =
  | "branca" | "amarela" | "laranja" | "verde"
  | "azul_claro" | "azul_escuro" | "roxa" | "marrom"
  | "vermelha" | "preta";

export const BELT_HEX: Record<BeltSlug, string> = {
  branca:      "#F4F1EA",
  amarela:     "#ECC12E",
  laranja:     "#E1772C",
  verde:       "#2E9E5B",
  azul_claro:  "#4FA3E3",
  azul_escuro: "#1D4ED8",
  roxa:        "#6D28D9",
  marrom:      "#6B4423",
  vermelha:    "#C62828", // faixa legada (4º Kyu, sistema antigo)
  preta:       "#211C17",
};

export const BELT_LABEL: Record<BeltSlug, string> = {
  branca: "Branca", amarela: "Amarela", laranja: "Laranja", verde: "Verde",
  azul_claro: "Azul Claro", azul_escuro: "Azul Escuro", roxa: "Roxa",
  marrom: "Marrom", vermelha: "Vermelha", preta: "Preta",
};

// Remove acentos + normaliza espaços/caixa para casar variações de digitação.
function norm(s?: string | null): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * beltSlug — converte o belt_name (PT, do backend) no slug canônico.
 * Default: "branca" (nunca retorna desconhecido).
 */
export function beltSlug(beltName?: string | null): BeltSlug {
  const n = norm(beltName);
  if (!n) return "branca";
  if (n.includes("azul") && n.includes("escur")) return "azul_escuro";
  if (n.includes("azul") && n.includes("clar"))  return "azul_claro";
  if (n.includes("azul")) return "azul_escuro"; // "Azul" sem qualificador → escuro
  if (n.includes("verm")) return "vermelha";
  if (n.includes("pret")) return "preta";
  if (n.includes("marrom") || n.includes("marron")) return "marrom";
  if (n.includes("rox")) return "roxa";
  if (n.includes("verde")) return "verde";
  if (n.includes("laranj")) return "laranja";
  if (n.includes("amarel")) return "amarela";
  if (n.includes("branc")) return "branca";
  return "branca";
}

/** beltHex — atalho belt_name → cor do swatch. */
export function beltHex(beltName?: string | null): string {
  return BELT_HEX[beltSlug(beltName)];
}
