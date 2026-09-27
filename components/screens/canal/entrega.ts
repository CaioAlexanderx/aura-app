// ============================================================
// Canal digital · aba Entrega — regras puras (QA 26/09)
// ============================================================

export type CampoDeRecebimento = "pickup_enabled" | "delivery_enabled";

/** O aviso quando a loja fica sem nenhum jeito de o cliente receber. */
export const AVISO_SEM_RECEBIMENTO = "Sem retirada nem entrega, o cliente não tem como receber o pedido.";

/** Retirada e entrega desligadas: o checkout não tem como fechar. */
export function semComoReceber(retirada: boolean, entrega: boolean): boolean {
  return !retirada && !entrega;
}

/**
 * Este clique desliga a ÚLTIMA forma de receber? Então a tela pergunta
 * antes de salvar, em vez de gravar calada.
 */
export function desligarPedeConfirmacao(
  campo: CampoDeRecebimento,
  novoValor: boolean,
  atual: { pickup: boolean; delivery: boolean },
): boolean {
  if (novoValor) return false;
  const depois = {
    pickup: campo === "pickup_enabled" ? false : atual.pickup,
    delivery: campo === "delivery_enabled" ? false : atual.delivery,
  };
  const antes = atual.pickup || atual.delivery;
  return antes && semComoReceber(depois.pickup, depois.delivery);
}

/**
 * Os exemplos de prazo. A vitrine Studio vende sob encomenda — ninguém
 * produz uma caneca personalizada "em 30 min" —, então lá os exemplos são
 * em dias úteis e contam a partir da aprovação da arte.
 */
export function textosDoPrazo(vitrine: "comum" | "studio" = "comum") {
  if (vitrine === "studio") {
    return {
      retiradaPlaceholder: "Ex: Pronta em 3 dias úteis após a aprovação da arte",
      retiradaAjuda: "Texto livre. Ex: \"Pronta em 3 dias úteis\", \"Em 5 dias úteis após a aprovação da arte\".",
      entregaPlaceholder: "Ex: Entrega em 5 dias úteis após a aprovação da arte",
      entregaAjuda: "Texto livre. Ex: \"De 3 a 5 dias úteis\", \"Em 7 dias úteis após a aprovação da arte\".",
    };
  }
  return {
    retiradaPlaceholder: "Ex: Em até 1 hora após confirmação",
    retiradaAjuda: "Texto livre. Ex: \"Em 30 min\", \"No mesmo dia\", \"Em 1 dia útil\".",
    entregaPlaceholder: "Ex: Em até 2h corridas",
    entregaAjuda: "Texto livre. Ex: \"Em 2-4 horas\", \"No mesmo dia\", \"1-3 dias úteis\".",
  };
}
