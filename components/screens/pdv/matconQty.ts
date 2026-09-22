// ============================================================
// AURA. — Matcon no carrinho do Caixa: qual controle e qual frase
//
// 22/09/2026 (M0, docs/matcon-faseamento-po-ux.md §2 "fracionamento dirigido
// pela unidade"). Funcoes puras, sem React — o CartPanel so pergunta.
//
// A regra inteira do M0 cabe em duas perguntas:
//   1) este item usa campo decimal ou o stepper de sempre? -> usaCampoDecimal
//   2) o que escrevo embaixo do campo decimal?             -> fraseDeEmbalagem
//
// As duas respondem "nao/null" quando o toggle esta desligado, que e o
// contrato de zero impacto (§1): loja sem Matcon renderiza o carrinho de
// hoje, sem passar por aqui.
// ============================================================

import { isFractionalUnit, fmtQty, toPackages, rotuloEmbalagem } from "@/utils/matconUnits";
import { usaLote } from "@/utils/matconLots";

// Teto do campo de quantidade. Fora do Matcon continua 999 (3 digitos), que e
// o que o carrinho sempre teve; com o toggle on sobe pra 6 digitos porque
// 1.200 tijolos e 5.000 blocos sao venda de terca-feira.
export var QTY_MAXLEN_PADRAO = 3;
export var QTY_MAXLEN_MATCON = 6;
// Campo decimal: "1.234,567" cabe em 9 caracteres.
export var QTY_MAXLEN_DECIMAL = 9;

// Campo decimal so quando o toggle esta ligado E a unidade do produto e
// fracionavel. Piso em m² sim; saco de cimento nao (ninguem vende 2,5 sc).
export function usaCampoDecimal(matconEnabled: boolean, unit?: string | null): boolean {
  if (!matconEnabled) return false;
  return isFractionalUnit(unit);
}

// M3 (docs/matcon-faseamento-po-ux.md §4b): o botao "calcular ambiente" do
// item do carrinho. Calcula-se ambiente de PISO — m², e so m². Piso em m²
// sim; cabo em m e concreto em m³ nao (a folha pergunta largura x
// comprimento, que so faz sentido em area). Herda a regra do campo decimal:
// sem toggle, nem existe.
export function usaCalculadoraAmbiente(matconEnabled: boolean, unit?: string | null): boolean {
  if (!usaCampoDecimal(matconEnabled, unit)) return false;
  var norm = (unit || "").trim().toLowerCase();
  return norm === "m²" || norm === "m2";
}

export function qtyMaxLength(matconEnabled: boolean, unit?: string | null): number {
  if (usaCampoDecimal(matconEnabled, unit)) return QTY_MAXLEN_DECIMAL;
  return matconEnabled ? QTY_MAXLEN_MATCON : QTY_MAXLEN_PADRAO;
}

export type FraseEmbalagemArgs = {
  matconEnabled: boolean;
  roundToPackage: boolean;
  qty: number;
  unit?: string | null;
  purchaseUnit?: string | null;
  purchaseFactor?: number | null;
};

// A linha de apoio do mockup (secao "carrinho" de docs/mockups/matcon-modulo
// .html): "= 6 caixas · 13,92 m² · sobra 1,42 m²".
//
// Ela INFORMA, nao arredonda: a quantidade vendida continua sendo o que o
// vendedor digitou (12,5 m²). Decisao de produto registrada no contrato —
// quem quiser a caixa cheia digita a caixa cheia.
//
// Some quando: toggle off, "arredondar para embalagem" off, unidade nao
// fracionada ou produto sem fator de compra. Sem sobra, some so o "· sobra".
export function fraseDeEmbalagem(a: FraseEmbalagemArgs): string | null {
  if (!a.matconEnabled || !a.roundToPackage) return null;
  if (!isFractionalUnit(a.unit)) return null;

  var factor = Number(a.purchaseFactor) || 0;
  if (factor <= 0) return null;

  var qty = Number(a.qty) || 0;
  if (qty <= 0) return null;

  var pk = toPackages(qty, factor);
  if (pk.packages <= 0) return null;

  // Sem unidade de compra cadastrada, "caixa"/"caixas" no singular certo
  // (QA 22/09/2026) — e como o lojista fala.
  var unit = (a.unit || "").trim();

  var frase = "= " + rotuloEmbalagem(pk.packages, a.purchaseUnit) + " · " + fmtQty(pk.covered, unit);
  if (pk.leftover > 0) frase += " · sobra " + fmtQty(pk.leftover, unit);
  return frase;
}

// M4 (docs/CONTRACT_MATCON.md, "Lote / tonalidade"): a linha do lote no item
// do carrinho. Mesma pergunta das funcoes acima, so que o gate e outro —
// alem do toggle do Matcon, a frase da config ("Controlo lote e tonalidade
// nos produtos vendidos em m² e m³"). A regra de unidade vive em
// utils/matconLots.usaLote; aqui so repassamos, pra que o CartPanel continue
// perguntando tudo pro mesmo arquivo.
export function usaLoteNoItem(matconEnabled: boolean, lotsEnabled: boolean, unit?: string | null): boolean {
  return usaLote({ matcon_enabled: matconEnabled, matcon_lots_enabled: lotsEnabled }, unit);
}
