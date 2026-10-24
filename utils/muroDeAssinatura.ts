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
//
// 24/10/2026 (tq-86): em atraso o muro conta dias. Decisão do Caio (21/10):
// as outras telas pausam no dia 7 de atraso e o Caixa no dia 14. O backend
// devolve as datas prontas no objeto da empresa (/auth/me, login e
// switch-company), ao lado de billing_status:
//
//   billing_overdue_since     vencimento da cobrança em atraso mais antiga
//   billing_pause_screens_on  dia em que as outras telas pausam (+7)
//   billing_pause_caixa_on    dia em que o Caixa pausa (+14)
//
// Com billing_status='overdue':
//   · antes de billing_pause_screens_on: tudo liberado (faixa no Caixa e no
//     Painel com a data da pausa);
//   · a partir dele: as outras telas pausam e o Caixa segue (o muro de
//     sempre); Odonto, Food e Studio vão ao checkout, como já iam;
//   · a partir de billing_pause_caixa_on: o Caixa também pausa e o shell
//     Negócio vai ao checkout, como as outras verticais.
// Nenhuma data é recalculada aqui: só comparadas com o dia de hoje em São
// Paulo. Sem os campos (backend anterior) ou sem a data das telas, o
// comportamento é exatamente o de antes (bloqueia desde o dia 1). Karatê
// fica fora, como sempre. As datas vêm do objeto da empresa que o /auth/me
// regrava (refreshMe), nunca do JWT.
// ============================================================

import { lerTrial, vendeuNoTrial } from "@/utils/trialAviso";

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
  /** tq-86: company.billing_pause_screens_on (YYYY-MM-DD). Ausente = backend anterior. */
  billingPauseScreensOn?: string | null;
  /** tq-86: company.billing_pause_caixa_on (YYYY-MM-DD). */
  billingPauseCaixaOn?: string | null;
  /** Hoje em YYYY-MM-DD (fuso de São Paulo). Só os testes passam; o padrão é o relógio. */
  hoje?: string;
};

/** Hoje em São Paulo, YYYY-MM-DD. O Brasil não tem horário de verão desde 2019: UTC-3 fixo. */
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  return new Date(agora.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Data do backend (YYYY-MM-DD, ou ISO com hora) → YYYY-MM-DD; o resto vira null. */
export function lerDataDoAtraso(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v.trim());
  return m ? m[1] : null;
}

/**
 * Datas do atraso como vieram no objeto da empresa (do /auth/me). Campo
 * ausente fica fora do resultado: é o sinal de backend anterior.
 */
export function datasDoAtraso(company: unknown): Pick<EstadoDeAssinatura, "billingPauseScreensOn" | "billingPauseCaixaOn"> {
  const c = (company && typeof company === "object" ? company : {}) as Record<string, unknown>;
  const out: Pick<EstadoDeAssinatura, "billingPauseScreensOn" | "billingPauseCaixaOn"> = {};
  if ("billing_pause_screens_on" in c) out.billingPauseScreensOn = lerDataDoAtraso(c.billing_pause_screens_on);
  if ("billing_pause_caixa_on" in c) out.billingPauseCaixaOn = lerDataDoAtraso(c.billing_pause_caixa_on);
  return out;
}

/**
 * Em que ponto do atraso a loja está.
 * - null: não está em atraso (ou trial ativo);
 * - "sem_prazo": em atraso, sem a data das telas (backend anterior):
 *   comportamento de antes, bloqueado desde o dia 1;
 * - "liberado": antes da pausa das telas;
 * - "telas_pausadas": telas pausadas, Caixa segue;
 * - "caixa_pausado": o Caixa também pausou.
 */
export type FaseDoAtraso = "sem_prazo" | "liberado" | "telas_pausadas" | "caixa_pausado";

export function faseDoAtraso(e: EstadoDeAssinatura): FaseDoAtraso | null {
  if (e.billingStatus !== "overdue" || e.trialActive) return null;
  const telas = lerDataDoAtraso(e.billingPauseScreensOn);
  if (!telas) return "sem_prazo";
  const hoje = e.hoje || hojeEmSaoPaulo();
  const caixa = lerDataDoAtraso(e.billingPauseCaixaOn);
  if (caixa && hoje >= caixa) return "caixa_pausado";
  if (hoje >= telas) return "telas_pausadas";
  return "liberado";
}

// Quem o muro alcança: dono, com empresa, e-mail verificado, fora de demo,
// staff e Karatê. A assinatura em si fica de fora daqui.
function alcancadoPeloMuro(e: EstadoDeAssinatura): boolean {
  return !e.isDemo && !e.isStaff && e.emailVerified && e.temEmpresa && e.isOwner
    && !e.isKarateFederation && !e.isKarateDojoVertical;
}

/** O dono desta empresa está sem assinatura válida (trial vencido ou cobrança inativa)? */
export function semAssinatura(e: EstadoDeAssinatura): boolean {
  const ativa = e.billingStatus === "active" || e.trialActive;
  if (ativa || !alcancadoPeloMuro(e)) return false;
  // tq-86: em atraso, antes do dia da pausa das telas, nada bloqueia.
  return faseDoAtraso(e) !== "liberado";
}

/** tq-86: o Caixa também pausou (dia 14 de atraso)? Aí o shell Negócio vai ao checkout. */
export function caixaPausado(e: EstadoDeAssinatura): boolean {
  return semAssinatura(e) && faseDoAtraso(e) === "caixa_pausado";
}

export type AvisoDeAtraso = {
  fase: "liberado" | "telas_pausadas";
  /** dd/mm */
  pausaTelasEm: string;
  /** dd/mm, ou null quando o backend não mandou a data do Caixa. */
  pausaCaixaEm: string | null;
};

function ddmm(iso: string): string {
  return iso.slice(8, 10) + "/" + iso.slice(5, 7);
}

/**
 * tq-86: dados da faixa de atraso (Caixa e Painel). Null quando não há o
 * que avisar: fora do atraso, sem as datas (backend anterior: fica o aviso
 * de sempre) ou com o Caixa já pausado (a loja está no checkout).
 */
export function avisoDeAtraso(e: EstadoDeAssinatura): AvisoDeAtraso | null {
  if (!alcancadoPeloMuro(e)) return null;
  const fase = faseDoAtraso(e);
  if (fase !== "liberado" && fase !== "telas_pausadas") return null;
  const telas = lerDataDoAtraso(e.billingPauseScreensOn) as string;
  const caixa = lerDataDoAtraso(e.billingPauseCaixaOn);
  return { fase, pausaTelasEm: ddmm(telas), pausaCaixaEm: caixa ? ddmm(caixa) : null };
}

/**
 * Textos da faixa de atraso, no tom das cartas de cobrança (Cassie, 21/10).
 * Nada de "nada se perde" nem "tudo volta na hora".
 */
export function textoDoAtraso(a: AvisoDeAtraso): { titulo: string; corpo: string } {
  if (a.fase === "liberado") {
    return {
      titulo: "A mensalidade está em aberto",
      corpo: "Se continuar em aberto, o acesso às outras telas pausa no dia " + a.pausaTelasEm + ". "
        + (a.pausaCaixaEm
          ? "O Caixa segue funcionando para você vender até " + a.pausaCaixaEm + "."
          : "O Caixa segue funcionando."),
    };
  }
  return {
    titulo: "O acesso às outras telas está pausado",
    corpo: "A mensalidade segue em aberto. "
      + (a.pausaCaixaEm
        ? "O Caixa continua funcionando para você vender até " + a.pausaCaixaEm + ". "
        : "O Caixa continua funcionando. ")
      + "Seus dados continuam guardados. Assim que o pagamento for confirmado, o acesso volta.",
  };
}

/**
 * Estado do muro a partir do store de auth (o mesmo para o AuthGuard, o
 * Caixa e o Painel). Lê o objeto da empresa do /auth/me, não o JWT.
 */
export function estadoDaLoja(a: {
  company: unknown; user: unknown; trialActive: boolean; isDemo: boolean; isStaff: boolean;
}): EstadoDeAssinatura {
  const c = (a.company || null) as any;
  const vertical = (c?.vertical_active ?? c?.vertical) as string | undefined;
  return {
    billingStatus: c?.billing_status,
    trialActive: a.trialActive,
    isDemo: a.isDemo,
    isStaff: a.isStaff,
    emailVerified: !!(a.user as any)?.email_verified,
    temEmpresa: !!c,
    isOwner: (c?.member_role || "owner") === "owner",
    isKarateFederation: vertical === "karate_federation",
    isKarateDojoVertical: vertical === "karate_dojo",
    ...datasDoAtraso(c),
  };
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

/**
 * Texto do aviso no topo do Caixa.
 *
 * 14/10/2026 (decisão da Nina, aprovada pelo Caio): "Seus 7 dias de teste
 * terminaram" só para quem fez a primeira venda (os 7 dias contaram de
 * verdade). Quem nunca vendeu lê "Seu período de teste terminou", sem
 * número: os 7 dias nunca chegaram a começar. Modo fixo e backend sem o
 * bloco `company.trial` também ficam com o texto neutro.
 *
 * 24/10/2026 (tq-86): em atraso com as datas do backend, o aviso fala da
 * mensalidade em aberto e da data em que o Caixa pausa (textoDoAtraso), não
 * do teste. Sem as datas, o texto de sempre.
 *
 * @param trial company.trial como veio do /auth/me (lido com defesa)
 * @param atraso avisoDeAtraso() da loja, quando houver
 */
export function textoDoAviso(
  trialEndsAt: string | null | undefined,
  trial?: unknown,
  atraso?: AvisoDeAtraso | null,
): { titulo: string; corpo: string } {
  if (atraso) return textoDoAtraso(atraso);
  const teveTrial = !!trialEndsAt;
  const info = lerTrial(trial);
  const titulo = vendeuNoTrial(info) && info
    ? `Seus ${info.dias_apos_primeira_venda} dias de teste terminaram`
    : "Seu período de teste terminou";
  return teveTrial
    ? {
        titulo,
        corpo: "O Caixa continua funcionando. Estoque, clientes, relatórios e o resto ficam bloqueados até você assinar.",
      }
    : {
        titulo: "Sua assinatura está inativa",
        corpo: "O Caixa continua funcionando. O resto volta assim que a assinatura for regularizada.",
      };
}
