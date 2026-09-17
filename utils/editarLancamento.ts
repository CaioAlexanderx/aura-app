// Valor que o "Editar lancamento" manda no PATCH.
//
// 17/09/2026 (Finesse, venda 2307): o modal guardava o valor de quando abriu.
// A lojista removeu um item la dentro (a devolucao abateu R$ 159,90 do
// A Receber) e o Salvar mandou o valor antigo, que regravou por cima do
// abatimento. Regras:
//   - A Receber do crediario: nunca manda. O valor e derivado das parcelas e
//     das devolucoes; o backend recusa mudanca (409 CREDIT_AMOUNT_DERIVED).
//   - Demais: so manda se a lojista mudou o campo em relacao ao valor que o
//     lancamento tem agora (o modal atualiza essa base depois de remover ou
//     adicionar item).
export function valorDoPatch(args: {
  digitado: number;
  base: number | null;
  isCreditReceivable: boolean;
}): number | undefined {
  if (args.isCreditReceivable) return undefined;
  if (args.base != null && Math.round(args.digitado * 100) === Math.round(args.base * 100)) return undefined;
  return args.digitado;
}
