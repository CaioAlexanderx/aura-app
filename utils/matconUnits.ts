// ============================================================
// AURA. — Matcon (materiais de construção): unidades e quantidades
//
// Criado: 22/09/2026 (M0 do semi-vertical Matcon,
// docs/matcon-faseamento-po-ux.md secao 2 — "fracionamento dirigido pela
// unidade").
//
// Funcoes puras, sem React. Regra do contrato de zero impacto (secao 1 do
// doc acima): com o toggle desligado, `unitsForProduct` devolve a MESMA
// referencia de UNITS — nenhuma loja sem Matcon perde nem ganha nada.
// ============================================================

import { UNITS } from "@/components/screens/estoque/types";

// Unidades que só existem em lojas com o toggle matcon_enabled ligado.
// Concatenadas às UNITS de hoje só no render (unitsForProduct), nunca
// misturadas na constante de base.
export const MATCON_UNITS = ["m", "m²", "m³", "sc", "br", "ton", "mlh", "pç", "rolo", "lata", "balde"] as const;

// Unidades fracionaveis: aceitam campo decimal no carrinho (§2 do doc).
// Inclui kg/g/L/ml (que ja existem em UNITS hoje mas continuam inteiras
// fora do Matcon — nota de PO no fim da secao 2: liberar isFractionalUnit
// sem o toggle fica pra depois dos pilotos).
export const FRACTIONAL_UNITS = new Set(["m", "m²", "m³", "kg", "g", "L", "ml", "ton"]);

var FRACTIONAL_UNITS_LOWER = new Set(
  Array.from(FRACTIONAL_UNITS).map(function (u) { return u.toLowerCase(); })
);

// Case-insensitive, tolera espaco nas pontas. undefined/"" -> false (produto
// sem unidade cadastrada nunca cai no campo decimal).
export function isFractionalUnit(unit: string | null | undefined): boolean {
  if (!unit) return false;
  var norm = unit.trim().toLowerCase();
  if (!norm) return false;
  return FRACTIONAL_UNITS_LOWER.has(norm);
}

// Loja sem Matcon: devolve a MESMA referencia de UNITS (nao um array novo
// com o mesmo conteudo) — e o que o teste de "nao vaza" verifica com
// toBe(). Com Matcon ligado, concatena MATCON_UNITS no fim.
export function unitsForProduct(matconEnabled: boolean): readonly string[] {
  if (!matconEnabled) return UNITS;
  return [...UNITS, ...MATCON_UNITS];
}

// Aceita "12,5" (decimal BR), "12.5" (decimal solto) e "1.200,5" (milhar +
// decimal BR), com espacos nas pontas. Rejeita vazio, negativo, zero e
// lixo -> null. Arredonda pra no maximo 3 casas decimais.
export function parseQtyInput(raw: string): number | null {
  if (raw === null || raw === undefined) return null;
  var s = String(raw).trim().replace(/\s+/g, "");
  if (s === "") return null;

  var hasComma = s.indexOf(",") !== -1;
  var hasDot = s.indexOf(".") !== -1;

  if (hasComma && hasDot) {
    // "1.200,5" -> ponto e separador de milhar, virgula e decimal.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // "12,5" -> decimal BR.
    s = s.replace(",", ".");
  }
  // so ponto ("12.5") ou nenhum separador: ja esta no formato que parseFloat entende.

  if (!/^\d+(\.\d+)?$/.test(s)) return null;

  var n = parseFloat(s);
  if (!isFinite(n) || n <= 0) return null;

  return Math.round(n * 1000) / 1000;
}

// Formata em pt-BR: inteiro sem decimais ("1.200"), fracionado com ate 3
// casas sem zero a direita ("12,5", "0,75"). `unit`, quando informado,
// entra sufixado com um espaco ("12,5 m²").
export function fmtQty(n: number, unit?: string): string {
  var s = n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  return unit ? s + " " + unit : s;
}

// Quantas embalagens fechadas cobrem `qty` unidades vendidas, dado que
// cada embalagem tem `factor` unidades (ex.: caixa de 2,32 m²). factor <= 0
// e entrada invalida -> tudo zerado, sem dividir por zero.
export function toPackages(qty: number, factor: number): { packages: number; covered: number; leftover: number } {
  if (!factor || factor <= 0) return { packages: 0, covered: 0, leftover: 0 };
  var round3 = function (n: number) { return Math.round(n * 1000) / 1000; };
  var packages = Math.ceil(qty / factor - 1e-9); // tolera erro de ponto flutuante perto do inteiro
  var covered = round3(packages * factor);
  var leftover = round3(covered - qty);
  return { packages: packages, covered: covered, leftover: leftover };
}
