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

import { isFractionalUnit, fmtQty, toPackages, rotuloEmbalagem, ehMilheiro, PECAS_POR_MILHEIRO } from "@/utils/matconUnits";
import { usaLote } from "@/utils/matconLots";

// Teto do campo de quantidade. Fora do Matcon continua 999 (3 digitos), que e
// o que o carrinho sempre teve; com o toggle on sobe pra 6 digitos porque
// 1.200 tijolos e 5.000 blocos sao venda de terca-feira.
export var QTY_MAXLEN_PADRAO = 3;
export var QTY_MAXLEN_MATCON = 6;
// Campo decimal: "1.234,567" cabe em 9 caracteres.
export var QTY_MAXLEN_DECIMAL = 9;
// Campo de pecas do milheiro: "1.000.000" (mil milheiros) cabe em 9.
export var QTY_MAXLEN_PECAS = 9;

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
  if (usaPecasNoMilheiro(matconEnabled, unit)) return QTY_MAXLEN_PECAS;
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

// ------------------------------------------------------------
// Milheiro: o vendedor digita pecas, o carrinho guarda milheiro
//
// QA em producao 22/09/2026: tijolo cadastrado em "mlh" (R$ 890/mlh) caia
// no stepper de inteiros. "0,5" virava 5 mlh (R$ 4.450) e "500" — o
// vendedor pensando em 500 tijolos — virava 500 mlh (R$ 445.000). Decisao
// do Caio: tijolo se vende por PECA com preco por milheiro, que e como o
// balcao pensa. O campo pergunta pecas inteiras; a quantidade do item
// continua em milheiro (qty = pecas / 1000), porque estoque, venda e NF-e
// estao em mlh. 1 peca = 0,001 mlh: tres casas, a precisao que venda
// (numeric 3 casas) e qCom da NF-e ja aceitam.
// ------------------------------------------------------------

// Campo de pecas so com o toggle ligado E o produto em milheiro. Sem
// Matcon, "mlh" nem existe no cadastro — e o carrinho fica o de sempre.
export function usaPecasNoMilheiro(matconEnabled: boolean, unit?: string | null): boolean {
  if (!matconEnabled) return false;
  return ehMilheiro(unit);
}

// 500 pecas -> 0,5 mlh. Peca e inteira (arredonda antes de dividir), entao
// o resultado nunca passa de 3 casas. Zero, negativo e lixo -> 0.
export function unidadesParaMilheiro(unidades: number): number {
  var n = Number(unidades);
  if (!isFinite(n) || n <= 0) return 0;
  return Math.round(n) / PECAS_POR_MILHEIRO;
}

// 0,5 mlh -> 500 pecas. Arredonda pra peca inteira (0,1234 mlh -> 123) —
// o ponto flutuante de 0.333 * 1000 nao pode virar 332,99999.
export function milheiroParaUnidades(milheiro: number): number {
  var n = Number(milheiro);
  if (!isFinite(n) || n <= 0) return 0;
  return Math.round(n * PECAS_POR_MILHEIRO);
}

// Leitura do campo de inteiros (stepper de sempre e pecas do milheiro).
// Antes o campo apagava tudo que nao era digito: "0,5" virava 5 e "12,5"
// virava 125. Agora:
//   - "1.500" / "12.000" (ponto com grupos de 3) e milhar em pt-BR -> 1500;
//   - qualquer outra virgula ou ponto CORTA ali: "12,5" -> 12, "0,5" -> 0;
//   - vazio ou sem digito antes do separador (",5") -> null.
// Quem chama decide o que fazer com 0 (o carrinho ignora, como sempre fez).
export function parseInteiroDigitado(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  var s = String(raw).replace(/\s+/g, "");
  if (s === "") return null;
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  } else {
    var corte = s.search(/[.,]/);
    if (corte >= 0) s = s.slice(0, corte);
  }
  s = s.replace(/\D/g, "");
  if (s === "") return null;
  var n = parseInt(s, 10);
  return isFinite(n) ? n : null;
}

function fmtReais(n: number): string {
  return "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// A linha de apoio do item em milheiro, com a conta inteira que o vendedor
// confere antes de cobrar: "500 un = 0,5 mlh · R$ 890,00/mlh → R$ 445,00".
// `qty` e a quantidade do item (em milheiro), `price` o preco por milheiro.
export function fraseDoMilheiro(qty: number, price: number): string | null {
  var q = Number(qty) || 0;
  if (q <= 0) return null;
  var total = Math.round(q * (Number(price) || 0) * 100) / 100;
  return fmtQty(milheiroParaUnidades(q)) + " un = " + fmtQty(q) + " mlh · " +
    fmtReais(price) + "/mlh → " + fmtReais(total);
}

// Quanto o item conta no "Itens" do carrinho e no "N produtos" do fim da
// venda: milheiro conta em pecas (500 tijolos, nao "0,5"); o resto conta a
// quantidade como sempre.
export function quantidadeParaContar(matconEnabled: boolean, qty: number, unit?: string | null): number {
  if (usaPecasNoMilheiro(matconEnabled, unit)) return milheiroParaUnidades(qty);
  return Number(qty) || 0;
}
