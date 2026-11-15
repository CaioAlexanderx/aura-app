// ============================================================================
// AURA. — Black Friday na loja online · o texto escrito pela loja (p-122)
//
// Regras puras do título da faixa (até 28) e da frase da faixa grande (até
// 90), as MESMAS do servidor (Aura-backend services/campanhaDaLoja.js
// normalizarTextoDaFaixa): espaços das pontas e repetidos saem, vazio volta
// à opção pronta, sem "%" nem "R$" (o desconto é calculado), uma linha só,
// sem emoji. O servidor confere de novo e devolve 422 com a mensagem.
// ============================================================================

export const LIMITE_DO_TITULO = 28;
export const LIMITE_DA_FRASE = 90;

/** O texto padrão da faixa grande (o mesmo da vitrine, parts/campanha.js). */
export function frasePadrao(ateDDMM: string): string {
  return "Preços já com desconto" + (ateDDMM ? " até " + ateDDMM : "") + ". Os melhores achados, só enquanto durar a promoção.";
}

var QUEBRA = /[\r\n\u2028\u2029]/;
var EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/u;

/** Quantos caracteres (letras com acento contam um). */
export function contar(texto: string): number {
  return Array.from(texto || "").length;
}

/** Como o texto será gravado: sem pontas nem espaços repetidos; "" = opção pronta. */
export function normalizar(texto: string | null | undefined): string {
  return String(texto || "").replace(/\s+/g, " ").trim();
}

/** O erro do texto, em português gentil, ou null. */
export function erroDoTexto(texto: string, limite: number, rotulo: string): string | null {
  if (QUEBRA.test(texto || "")) return rotulo + " vai numa linha só: tire a quebra de linha.";
  var t = normalizar(texto);
  if (!t) return null;
  if (EMOJI.test(t)) return rotulo + " não aceita emoji: a faixa usa só letras, números e pontuação.";
  if (t.indexOf("%") >= 0 || /r\$/i.test(t)) {
    return rotulo + " não pode ter “%” nem “R$”: o desconto da faixa é calculado pelas suas promoções, para nunca prometer mais do que a loja dá.";
  }
  var n = contar(t);
  if (n > limite) return rotulo + " cabe em até " + limite + " caracteres (agora são " + n + ").";
  return null;
}

/** Os trechos da faixa fina, como a loja mostra (em caixa alta). */
export function partesDaFaixaFina(titulo: string, atePct: number, ateDDMM: string): string[] {
  var partes = [titulo || "Black Friday", "até " + (atePct > 0 ? atePct : "N") + "% OFF"];
  if (ateDDMM) partes.push("até " + ateDDMM);
  return partes.map(function (p) { return p.toLocaleUpperCase("pt-BR"); });
}

/** A linha da faixa fina inteira (os trechos separados por " · "). */
export function linhaDaFaixaFina(titulo: string, atePct: number, ateDDMM: string): string {
  return partesDaFaixaFina(titulo, atePct, ateDDMM).join(" · ");
}
