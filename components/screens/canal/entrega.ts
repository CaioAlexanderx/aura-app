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

// ============================================================
// Horário de funcionamento (19/10/2026)
//
// Desde 19/10 "Fechada" recusa o pedido no servidor, então um horário sem
// sentido fecha a loja de verdade. A regra é a mesma do backend
// (services/horarioDaLoja.js):
//   • fechar depois da meia-noite é válido — 18:00 às 02:00 vale até as
//     02:00 do dia seguinte;
//   • abertura igual ao fechamento não é intervalo e não é salvo;
//   • dia com só um dos dois preenchidos espera a lojista terminar.
// ============================================================

export type SituacaoDoDia = "fechado" | "incompleto" | "formato" | "igual" | "normal" | "vira_a_noite";

function minutos(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((v || "").trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mn = parseInt(m[2], 10);
  if (h > 23 || mn > 59) return null;
  return h * 60 + mn;
}

/** Como a tela lê um dia da grade. */
export function situacaoDoDia(abre: string, fecha: string): SituacaoDoDia {
  const a = (abre || "").trim();
  const f = (fecha || "").trim();
  if (!a && !f) return "fechado";
  if (!a || !f) return "incompleto";
  const ma = minutos(a);
  const mf = minutos(f);
  if (ma == null || mf == null) return "formato";
  if (ma === mf) return "igual";
  return mf < ma ? "vira_a_noite" : "normal";
}

/** A grade inteira pode ir para o servidor? */
export function horarioPodeSalvar(dias: Array<{ open: string; close: string }>): boolean {
  return dias.every((d) => {
    const s = situacaoDoDia(d.open, d.close);
    return s === "fechado" || s === "normal" || s === "vira_a_noite";
  });
}

/** O texto curto embaixo da linha do dia; "" quando não há o que dizer. */
export function avisoDoDia(s: SituacaoDoDia): string {
  if (s === "vira_a_noite") return "Fecha no dia seguinte";
  if (s === "igual") return "Fechamento igual à abertura. Se fecha depois da meia-noite, use o horário do dia seguinte (ex.: 18:00 às 02:00).";
  if (s === "formato") return "Use HH:MM, de 00:00 a 23:59.";
  return "";
}
