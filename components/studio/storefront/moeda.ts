// ============================================================
// components/studio/storefront/moeda.ts
//
// Reais escritos como a cliente lê: "R$ 1.234,56".
//
// ── O QUE ACONTECIA (QA de 04/09/2026) ─────────────────────────────────
// A vitrine escrevia o preço de três jeitos. O cartão, o configurador,
// o carrinho e o checkout usavam `toFixed(2)` cru — "R$ 39.90", com
// ponto, que é como o JavaScript fala e não como o Brasil escreve. A
// grade de modelos, o lote e a mensagem do WhatsApp tinham cada um a sua
// função com vírgula. Na mesma tela, "De R$ 39,90 a R$ 70,00" no título
// e "R$ 39.90" no cartão logo abaixo.
//
// Preço escrito errado lê como loja amadora — e a régua do mercado é
// "R$ 39,90" em 100% dos cartões das duas referências.
//
// ── POR QUE NÃO `Intl.NumberFormat` ────────────────────────────────────
// O react-native-web e o Hermes não garantem o locale pt-BR; a conta é
// simples o bastante para fazer na mão, e assim é a mesma nos dois.
// ============================================================

/** "R$ 1.234,56". Negativo vira "-R$ 3,99". Valor inválido vira zero. */
export function dinheiro(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "R$ 0,00";
  const [inteiro, centavos] = Math.abs(n).toFixed(2).split(".");
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (n < 0 ? "-" : "") + "R$ " + comMilhar + "," + centavos;
}
