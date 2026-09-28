// ============================================================
// Loja Digital do Studio · aba Revisões — o texto automático da política
//
// É o texto que a prévia mostra quando a lojista deixa o campo em branco.
// QA 26/09: saía com ":)" e travessão — tom de mensagem de amigo num
// texto que o cliente lê no checkout.
// ============================================================

/** O texto automático a partir das revisões inclusas e do preço da extra. */
export function textoPadraoDaPolitica(maxRevisions: number, extraPrice: number): string {
  if (maxRevisions === 0) {
    return "Você tem direito a revisões ilimitadas da arte. Pode pedir quantas alterações precisar, sem custo extra.";
  }
  const priceFmt = extraPrice
    ? `R$ ${extraPrice.toFixed(2).replace(".", ",")}`
    : "valor a combinar";
  return `Você tem direito a ${maxRevisions} ${
    maxRevisions === 1 ? "revisão grátis" : "revisões grátis"
  } da arte. A partir da ${maxRevisions + 1}ª revisão, cobramos ${priceFmt} por alteração. Dica: peça todas as mudanças de uma vez para economizar.`;
}
