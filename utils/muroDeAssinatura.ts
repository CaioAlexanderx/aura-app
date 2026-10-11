// ============================================================
// AURA. — Muro de assinatura com o Caixa vivo (11/10/2026)
//
// Até aqui, trial vencido ou assinatura inativa mandava o dono para o
// checkout a partir de QUALQUER tela (app/_layout.tsx, 2026-06-18). Na
// prática o muro chegava no meio do carregamento de estoque, e a loja que
// já vendia pelo Caixa ficava sem vender (GF Amorim: 2.020 produtos e 52
// vendas, bloqueada em 02/10 enquanto negociava a assinatura).
//
// Decisão do Caio (11/10): o Caixa continua funcionando; o resto fica
// bloqueado; um aviso no topo do Caixa leva ao checkout. Quem cai em outra
// tela vai para o Caixa, não para o checkout — o aviso explica e o botão
// leva. O checkout continua acessível pelo aviso e pela tela de planos.
//
// Só vale para o shell Negócio (varejo). Odonto, Food, Studio e Karatê têm
// a própria casa e o próprio gate; para eles o comportamento é o antigo.
// ============================================================

export type EstadoDeAssinatura = {
  billingStatus?: string | null;
  trialActive: boolean;
  isDemo: boolean;
  isStaff: boolean;
  emailVerified: boolean;
  temEmpresa: boolean;
  isOwner: boolean;
  isKarateFederation: boolean;
  isKarateDojoVertical: boolean;
};

/** O dono desta empresa está sem assinatura válida (trial vencido ou cobrança inativa)? */
export function semAssinatura(e: EstadoDeAssinatura): boolean {
  const ativa = e.billingStatus === "active" || e.trialActive;
  return !e.isDemo && !e.isStaff && e.emailVerified && e.temEmpresa && e.isOwner && !ativa
    && !e.isKarateFederation && !e.isKarateDojoVertical;
}

export const ROTA_CAIXA = "/(tabs)/pdv";
export const ROTA_CHECKOUT = "/(tabs)/checkout";

/**
 * Para onde mandar quem está sem assinatura, dado onde ele está.
 * - null: pode ficar (já está no Caixa ou no checkout).
 * - ROTA_CAIXA: shell Negócio, qualquer outra tela → Caixa (com o aviso).
 * - ROTA_CHECKOUT: verticais com casa própria, comportamento antigo.
 */
export function destinoSemAssinatura(segments: readonly string[], opts: { caixaVivo: boolean }): string | null {
  const inTabs = segments[0] === "(tabs)";
  const onCheckout = inTabs && segments[1] === "checkout";
  if (onCheckout) return null;
  if (!opts.caixaVivo) return ROTA_CHECKOUT;
  const onCaixa = inTabs && segments[1] === "pdv";
  if (onCaixa) return null;
  return ROTA_CAIXA;
}

/** Texto do aviso no topo do Caixa. */
export function textoDoAviso(trialEndsAt: string | null | undefined): { titulo: string; corpo: string } {
  const teveTrial = !!trialEndsAt;
  return teveTrial
    ? {
        titulo: "Seu período de teste terminou",
        corpo: "O Caixa continua funcionando. Estoque, clientes, relatórios e o resto ficam bloqueados até você assinar.",
      }
    : {
        titulo: "Sua assinatura está inativa",
        corpo: "O Caixa continua funcionando. O resto volta assim que a assinatura for regularizada.",
      };
}
