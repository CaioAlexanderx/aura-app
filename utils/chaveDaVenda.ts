// ============================================================
// Chave de idempotência da venda (tq-15 em 17/10/2026, tq-18 em 18/10/2026).
//
// Um uuid por tentativa de venda, enviado no cabeçalho Idempotency-Key do
// POST /pdv/sale e do POST /pdv/sale-com-sinal (Aura-backend#850). O MESMO
// valor em toda nova tentativa da mesma venda (timeout seguido de "tentar de
// novo" e a repetição automática do request() na queda de rede) faz o
// servidor devolver a venda já registrada em vez de gravar outra.
//
// Renovada só depois de uma venda concluída, ou quando o servidor responde
// 409 IDEMPOTENCY_KEY_REUSED (a chave já registrou uma venda com OUTROS
// itens; o próximo envio é venda nova).
//
// Sem dependência de React nem de store: o Caixa (hooks/useCart), o Studio,
// a Ótica e o Financeiro usam daqui.
// ============================================================

export function novaChaveDaVenda(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {}
  // Sem crypto.randomUUID (nativo antigo): não criptográfica, mas única o
  // bastante por empresa — e no formato que o backend aceita.
  return "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
}

/** O servidor recusou porque esta chave já registrou uma venda com outros
 *  itens. Quem recebe troca a chave; a mensagem do servidor diz qual venda. */
export function chaveDaVendaJaUsada(err: any): boolean {
  return (err?.data?.code || err?.code) === "IDEMPOTENCY_KEY_REUSED";
}
