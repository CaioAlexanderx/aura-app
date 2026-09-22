// ============================================================
// AURA. — Matcon (materiais de construção): a calculadora de ambiente (M3)
//
// 22/09/2026 — docs/matcon-faseamento-po-ux.md §4b e mockup
// docs/mockups/matcon-m3-clube-calculadora.html (#calculadora).
//
// Funções puras, sem React: a folha (CalculadoraAmbiente.tsx) só desenha o
// que sai daqui. A conta inteira do mockup é esta, e nada mais:
//
//   3,5 × 4,2 = 14,70 m²  ·  +8% = 15,88 m²  ·  ÷ 2,32 = 6,84 → 7 caixas
//   7 caixas fechadas dão 16,24 m² · sobra 0,36 m²
//
// Três decisões registradas:
//   1. Área é arredondada a 3 casas (mesma precisão de parseQtyInput) e
//      EXIBIDA com 2 (fmtArea) — 14,7 na conta, "14,70 m²" na tela.
//   2. A perda arredonda a 2 casas porque é o número que vai pro carrinho:
//      14,70 × 1,08 = 15,876 → 15,88. Arredondar depois faria o vendedor ler
//      um total que não bate com a quantidade vendida.
//   3. Quem conta caixa é toPackages (utils/matconUnits), o MESMO da linha
//      "= 7 caixas · 16,24 m² · sobra 0,36 m²" do M0. Produto sem fator de
//      compra não tem caixa: `caixas` vem null e a folha mostra só os m².
// ============================================================

import { toPackages, rotuloEmbalagem } from "@/utils/matconUnits";

// Reexportado por compatibilidade — quem já importava rotuloEmbalagem
// daqui (CalculadoraAmbiente.tsx, testes) continua funcionando. A fonte
// única da regra de singular/plural é utils/matconUnits.ts (QA 22/09/2026,
// mesma frase repetida no carrinho, na calculadora e na ficha do produto).
export { rotuloEmbalagem };

/** Um ambiente da folha: nome em português e as duas medidas em metros.
 *  Medida vazia (o "—" do mockup) é null/undefined — não zero digitado. */
export type Ambiente = {
  nome?: string;
  largura?: number | null;
  comprimento?: number | null;
};

export type ResultadoCalculadora = {
  /** Soma das áreas dos ambientes, sem perda (14,7). */
  areaSomada: number;
  /** Área com a perda aplicada — o número do botão primário (15,88). */
  areaComPerda: number;
  /** Caixas fechadas que cobrem `areaComPerda`. null sem fator de compra. */
  caixas: number | null;
  /** Quanto essas caixas dão (16,24). null sem fator. */
  areaCaixasFechadas: number | null;
  /** Sobra entre as caixas fechadas e a área com perda (0,36). null sem fator. */
  sobra: number | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function medidaValida(v: number | null | undefined): number {
  var n = Number(v);
  if (!isFinite(n) || n <= 0) return 0;
  return n;
}

/** Área de um ambiente em m², 3 casas. Medida faltando ou <= 0 -> 0 (linha
 *  vazia do mockup não estraga a soma). 3,5 × 4,2 = 14,7. */
export function areaDoAmbiente(largura: number | null | undefined, comprimento: number | null | undefined): number {
  var l = medidaValida(largura);
  var c = medidaValida(comprimento);
  if (l <= 0 || c <= 0) return 0;
  return round3(l * c);
}

/** "14,70 m² somados" — a soma das áreas, 3 casas. */
export function somarAmbientes(ambientes: Ambiente[] | null | undefined): number {
  if (!ambientes || !ambientes.length) return 0;
  var total = 0;
  for (var i = 0; i < ambientes.length; i++) {
    var a = ambientes[i] || {};
    total += areaDoAmbiente(a.largura, a.comprimento);
  }
  return round3(total);
}

/** Área + perda por quebra e recorte, 2 casas: 14,70 com 8% -> 15,88.
 *  Perda inválida ou negativa não inventa número: devolve a área. */
export function aplicarPerda(area: number, pct: number | null | undefined): number {
  var a = Number(area);
  if (!isFinite(a) || a <= 0) return 0;
  var p = Number(pct);
  if (!isFinite(p) || p <= 0) return round2(a);
  return round2(a * (1 + p / 100));
}

/** A folha inteira em um objeto. `purchaseFactor` ausente/<= 0 -> sem caixas. */
export function resultadoCalculadora(args: {
  ambientes: Ambiente[] | null | undefined;
  perdaPct: number | null | undefined;
  purchaseFactor?: number | null;
}): ResultadoCalculadora {
  var areaSomada = somarAmbientes(args.ambientes);
  var areaComPerda = aplicarPerda(areaSomada, args.perdaPct);

  var factor = Number(args.purchaseFactor);
  var temFator = isFinite(factor) && factor > 0;
  if (!temFator || areaComPerda <= 0) {
    return {
      areaSomada: areaSomada,
      areaComPerda: areaComPerda,
      caixas: null,
      areaCaixasFechadas: null,
      sobra: null,
    };
  }

  var pk = toPackages(areaComPerda, factor);
  return {
    areaSomada: areaSomada,
    areaComPerda: areaComPerda,
    caixas: pk.packages,
    areaCaixasFechadas: round2(pk.covered),
    sobra: round2(pk.leftover),
  };
}

/** Área em pt-BR com 2 casas SEMPRE ("14,70", "15,88") — é assim que o
 *  mockup escreve metro quadrado. fmtQty (1 a 3 casas, sem zero à direita)
 *  continua valendo no resto do carrinho. */
export function fmtArea(n: number, unit?: string): string {
  var v = isFinite(Number(n)) ? Number(n) : 0;
  var s = v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return unit ? s + " " + unit : s;
}

