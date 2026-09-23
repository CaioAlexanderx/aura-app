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

// 22/09/2026 (QA Matcon): a lista base UNITS do cadastro ja oferecia "m2" e
// "m3" em ASCII, lado a lado das "m²"/"m³" do Matcon. Pro lojista sao a
// mesma coisa; pro codigo nao eram — piso salvo em "m2" caia no stepper
// inteiro, sem calculadora e sem "Compro por". A NF-e do fornecedor tambem
// escreve "M2"/"M3"/"KG"/"LT". Normaliza aqui, uma vez, e todo mundo
// (carrinho, calculadora, ficha, lotes) enxerga a unidade certa.
var UNIT_ALIASES: Record<string, string> = { m2: "m²", m3: "m³", lt: "l", litro: "l" };

export function normalizeUnit(unit: string | null | undefined): string {
  if (!unit) return "";
  var norm = unit.trim().toLowerCase();
  return UNIT_ALIASES[norm] || norm;
}

// Case-insensitive, tolera espaco nas pontas e as grafias ASCII (m2, m3).
// undefined/"" -> false (produto sem unidade cadastrada nunca cai no campo
// decimal).
export function isFractionalUnit(unit: string | null | undefined): boolean {
  var norm = normalizeUnit(unit);
  if (!norm) return false;
  return FRACTIONAL_UNITS_LOWER.has(norm);
}

// 22/09/2026 (QA Matcon em producao): tijolo e bloco se vendem por
// milheiro ("mlh", R$ 890/mlh), mas o balcao pensa em pecas ("500
// tijolos"). O Caixa pergunta as pecas e grava a quantidade em milheiro
// (components/screens/pdv/matconQty.ts); estoque, venda e nota continuam
// em mlh. 1 milheiro = 1.000 pecas.
export const PECAS_POR_MILHEIRO = 1000;

export function ehMilheiro(unit: string | null | undefined): boolean {
  return normalizeUnit(unit) === "mlh";
}

// Estoque e minimo em decimal na ficha do produto: as unidades
// fracionaveis e o milheiro. O milheiro nao e fracionado no carrinho (la o
// vendedor digita pecas inteiras), mas vender 500 tijolos deixa 19,5 mlh no
// estoque — a ficha precisa ler e salvar esse "19,5" sem virar 19 nem 195.
export function estoqueEmDecimal(unit: string | null | undefined): boolean {
  return isFractionalUnit(unit) || ehMilheiro(unit);
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

// Unidades em que a loja pode comprar do fornecedor (frase "Compro por
// [x] de [n] m²" no cadastro, §2/§4b do doc). Lista fechada do M0 —
// crescer isto é decisão de PO, não digitação livre.
export const PURCHASE_UNITS = ["cx", "pct", "sc", "rolo", "lata", "balde", "mlh", "un"] as const;

// 23/09/2026 (QA em produção): os chips de unidade do "Vendo por" e as
// frases que citam a unidade ("Cada sc pesa", "por mlh") mostravam a
// sigla crua — legível pra quem já é do ramo, não pra quem está
// aprendendo o sistema. O valor GRAVADO continua a sigla (matcon_units,
// products.unit); só o texto na tela vira por extenso. m², m³ e as
// unidades já claras (kg, g, ml, L, par, kit) ficam como estão.
const NOMES_POR_EXTENSO: Record<string, string> = {
  un: "unidade",
  pct: "pacote",
  cx: "caixa",
  m: "metro",
  sc: "saco",
  br: "barra",
  ton: "tonelada",
  mlh: "milheiro",
  "pç": "peça",
};

/** Nome legível da unidade pra frases e chips ("sc" → "saco"). Sem
 *  tradução conhecida, devolve a própria unidade (kg, g, ml, L, m², m³…). */
export function nomeDaUnidade(u: string | null | undefined): string {
  const norm = String(u || "").trim();
  return NOMES_POR_EXTENSO[norm] || norm;
}

// QA 22/09/2026: "1 caixas" no hint do carrinho (CartPanel), na calculadora
// de ambiente e na ficha do produto — as três frases contam embalagem e
// as três erravam o singular na mesma forma. Fonte única: "7 caixas" / "1
// caixa" sem unidade de compra cadastrada; com unidade cadastrada ("cx",
// "pct"...), usa o que a loja escreveu, sem inventar plural.
export function rotuloEmbalagem(n: number, purchaseUnitLabel?: string | null): string {
  var label = (purchaseUnitLabel || "").trim();
  if (label) return n + " " + label;
  return n + (n === 1 ? " caixa" : " caixas");
}

// Importacao de XML (M0, docs/matcon-faseamento-po-ux.md secao 3): a nota
// do fornecedor vem na unidade de COMPRA (ex.: 10 caixas); o produto vende
// na unidade de VENDA (ex.: m²). `factor` e quantas unidades de venda cabem
// em 1 unidade de compra (a mesma conta de toPackages, ao contrario).
// qty vira qty*factor (estoque que entra), unit_cost vira unit_cost/factor
// (custo por unidade de venda). Custo arredonda a 2 casas (dinheiro), qty a
// 3 (mesma precisao de parseQtyInput). factor invalido (<=0, nao finito,
// null/undefined) -> passa-through: os numeros da nota saem do jeito que
// entraram, so arredondados — e o comportamento de hoje pra quem nao tem
// purchase_factor cadastrado.
export function convertPurchaseToSale(
  qty: number,
  unitCost: number,
  factor: number | null | undefined
): { qty: number; unitCost: number } {
  var round2 = function (n: number) { return Math.round(n * 100) / 100; };
  var round3 = function (n: number) { return Math.round(n * 1000) / 1000; };
  if (!factor || factor <= 0 || !isFinite(factor)) {
    return { qty: round3(qty), unitCost: round2(unitCost) };
  }
  return { qty: round3(qty * factor), unitCost: round2(unitCost / factor) };
}
