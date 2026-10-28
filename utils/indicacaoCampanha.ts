// ============================================================
// Indique e ganhe: textos da Black Friday (28/10/2026)
//
// Aprovado pelo Caio e pelo Marketing: até o fim de 30/11/2026 no horário de
// Brasília, o "Como funciona" e a mensagem de compartilhar no WhatsApp levam
// o texto da campanha BLACK50. Depois desse instante voltam sozinhos aos
// textos de hoje, sem deploy novo. Não há data de início: vale desde o merge.
//
// Só texto: nenhuma regra de desconto, cupom ou crédito muda aqui.
//
// Funções puras (recebem `agora`), sem React, para testar sem montar tela.
// ============================================================

import { COMO_FUNCIONA_INDICACAO } from "@/utils/mensagensDoApp";

/** Fim inclusivo da campanha: 30/11/2026 23:59:59 em Brasília (UTC-3). */
export const FIM_BLACK_FRIDAY_INDICACAO = new Date("2026-12-01T02:59:59Z");

export const COMO_FUNCIONA_INDICACAO_BLACK_FRIDAY = [
  "Mande o seu link a um conhecido. Até 30/11, ele ganha 50% na primeira mensalidade com o código BLACK50, digitado no pagamento, enquanto houver cupons.",
  "Quando ele pagar a primeira mensalidade, a sua próxima mensalidade sai grátis. Se muitas indicações pagarem no mesmo mês, o mês grátis pode ficar para o mês seguinte. Se você ainda estiver no teste, o mês grátis vale na segunda mensalidade.",
  "Valem até 3 indicações por ano, para contas em dia.",
] as const;

// `{link}` é trocado pelo link de indicação do lojista.
export const MENSAGEM_INDICACAO_BLACK_FRIDAY =
  "Oi! Tô usando a Aura na minha loja e tá me ajudando bastante. Até 30/11, ou enquanto houver cupons, você ganha 50% na primeira mensalidade com o código BLACK50 (digite no pagamento) e ainda testa 7 dias antes de assinar. Esse é o meu link: {link}";

/** true até FIM_BLACK_FRIDAY_INDICACAO, inclusive. */
export function emBlackFridayDaIndicacao(agora: Date): boolean {
  return agora.getTime() <= FIM_BLACK_FRIDAY_INDICACAO.getTime();
}

/** Itens do "Como funciona" que valem no instante `agora`. */
export function comoFuncionaIndicacao(agora: Date): readonly string[] {
  return emBlackFridayDaIndicacao(agora) ? COMO_FUNCIONA_INDICACAO_BLACK_FRIDAY : COMO_FUNCIONA_INDICACAO;
}

export function linkDeIndicacao(codigo: string): string {
  return "https://getaura.com.br/r/" + codigo;
}

/** Mensagem de compartilhar no WhatsApp que vale no instante `agora`. */
export function mensagemIndicacao(codigo: string, agora: Date): string {
  if (emBlackFridayDaIndicacao(agora)) {
    return MENSAGEM_INDICACAO_BLACK_FRIDAY.replace("{link}", linkDeIndicacao(codigo));
  }
  return (
    "Oi! Uso a Aura na minha loja: caixa, estoque e fiado num lugar só. " +
    "Com o meu código " + codigo + " você testa 7 dias grátis e ganha 20% de desconto na primeira mensalidade. " +
    "Começa por aqui: https://getaura.com.br/r/" + codigo
  );
}
