// ============================================================
// AURA. — Textos do checkout novo (p-104, 11/11/2026)
//
// Fora da tela para serem testados sem renderizar. Os números vêm sempre do
// backend: o preço de cada plano do /billing/quote e o valor do cupom do
// /billing/validate-coupon. A tabela local só entra quando o backend não
// respondeu (o checkout é caminho de cobrança e nunca depende da cotação).
// ============================================================
import type { ValidateCouponResponse } from "@/services/billingApi";
import type { QuoteResponse } from "@/utils/valorCombinado";
import { fmtBRL, fmtDateBR, couponKind } from "@/components/billing/couponText";
import { TEXTO_ASSENTO_SEM_ASSINATURA } from "@/utils/linkDoAssento";

export type ChavePlano = "essencial" | "negocio" | "expansao";

/** Acesso extra: R$ 19 cheio, sem desconto de ciclo nem de cupom (SEAT_PRICE_BRL do backend). */
export const PRECO_DO_ACESSO_EXTRA = 19;

export const PLANOS_DO_CHECKOUT: { key: ChavePlano; label: string; monthly: number; desc: string; popular?: boolean }[] = [
  { key: "essencial", label: "Essencial", monthly: 89, desc: "Base para começar" },
  { key: "negocio", label: "Negócio", monthly: 169, desc: "Operação completa", popular: true },
  { key: "expansao", label: "Expansão", monthly: 269, desc: "Escala e automação" },
];

export const SELO_MAIS_ESCOLHIDO = "Mais escolhido";
export const SELO_ANUAL = "2 meses grátis";
export const NOTA_ANUAL_NO_PLANO = "cobrado por mês, plano anual";
export const RODAPE_ASAAS = "Pagamento processado pela Asaas.";
export const VOLTAR_AO_CAIXA = "Voltar ao Caixa";

// p-105: quem chega ao checkout pelo link do assento sem assinatura em dia.
export const AVISO_ASSENTO_SEM_ASSINATURA = TEXTO_ASSENTO_SEM_ASSINATURA;
export const AVISO_ASSENTO_EM_ATRASO = "Regularize a mensalidade para contratar o assento.";

function arredonda(v: number) { return Math.round(v * 100) / 100; }

function numero(v: unknown): number | null {
  var n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v.replace(",", ".")) : NaN;
  return isFinite(n) ? n : null;
}

/** Preço de tabela local (fallback): mensal cheio ou anual por mês (2 meses grátis). */
export function precoDeTabela(monthly: number, anual: boolean): number {
  return anual ? arredonda(monthly * (1 - 1 / 6)) : monthly;
}

/**
 * Preço do plano por mês (só o plano, sem acessos extras) a partir da
 * cotação do backend: table_value − extra_seats × R$ 19. Cotação de outro
 * plano/ciclo, ausente ou estranha → null (a tela usa a tabela local).
 */
export function precoDoPlanoNaCotacao(q: QuoteResponse | null | undefined, plano: string, ciclo: string): number | null {
  if (!q || typeof q !== "object") return null;
  if (!q.plan || String(q.plan).toLowerCase() !== plano) return null;
  if (q.cycle && String(q.cycle).toLowerCase() !== ciclo) return null;
  var tabela = numero(q.table_value);
  if (tabela === null || tabela <= 0) return null;
  // Sem extra_seats não dá para separar o plano dos acessos: fica a tabela.
  // p-106: com extra_seats na pergunta, o table_value já soma os acessos de
  // temporada; os acessos do valor são os charged_extra_seats.
  var cobrados = numero(q.charged_extra_seats);
  var extras = cobrados !== null ? cobrados : numero(q.extra_seats);
  if (extras === null || extras < 0) return null;
  var plano_ = arredonda(tabela - extras * PRECO_DO_ACESSO_EXTRA);
  return plano_ > 0 ? plano_ : null;
}

/** Acessos extras liberados: o que o /billing/quote devolve, senão o da empresa. */
export function acessosExtrasDaConta(q: QuoteResponse | null | undefined, company: any): number {
  var daCotacao = q && typeof q === "object" ? numero(q.extra_seats) : null;
  if (daCotacao !== null && daCotacao >= 0) return Math.floor(daCotacao);
  var n = parseInt(String(company?.extra_seats_granted ?? 0), 10);
  return isFinite(n) && n > 0 ? n : 0;
}

/** "Plano Negócio (mensal)" / "Plano Negócio (anual, cobrado por mês)". */
export function rotuloDoPlanoNoResumo(label: string, anual: boolean): string {
  return "Plano " + label + " (" + (anual ? "anual, cobrado por mês" : "mensal") + ")";
}

/** "1 acesso de funcionário adicional" / "3 acessos de funcionário adicionais" (p-106). */
export function rotuloDosAcessosExtras(n: number): string {
  return n > 1 ? n + " acessos de funcionário adicionais" : n + " acesso de funcionário adicional";
}

// ------------------------------------------------------------
// p-106 (11/11/2026): seletor de acessos de funcionário no checkout
// ------------------------------------------------------------

/** Acessos que cada plano inclui, contando o titular (SEATS_PER_PLAN do backend). */
export const ACESSOS_INCLUIDOS_NO_PLANO: Record<string, number> = { essencial: 1, negocio: 3, expansao: 5 };
export const MAXIMO_DE_ACESSOS_ADICIONAIS = 10;

export const AVISO_ACESSOS_DEPOIS_DE_ASSINAR = "Os acessos de funcionário liberam assim que o pagamento for confirmado.";
export const TEXTO_ACESSOS_TRAVADOS =
  "Sua assinatura já está ativa e em dia, então os acessos de funcionário não mudam por aqui. " +
  "Para ajustar, fale com a equipe Aura pelo WhatsApp de ajuda.";
export const MENSAGEM_WHATSAPP_ACESSOS = "Oi, Aura! Quero mudar a quantidade de acessos de funcionário da minha loja.";

/** "1 acesso de funcionário para a temporada" / "2 acessos de funcionário para a temporada". */
export function rotuloDosAcessosDaTemporada(n: number): string {
  return n + (n > 1 ? " acessos" : " acesso") + " de funcionário para a temporada";
}

/** "só o seu acesso" | "o seu acesso e mais 2 de funcionário" | ... (incluídos conta o titular). */
export function oQueOPlanoInclui(incluidos: number): string {
  var funcionarios = Math.max(Math.floor(incluidos) - 1, 0);
  return funcionarios === 0 ? "só o seu acesso" : "o seu acesso e mais " + funcionarios + " de funcionário";
}

/** A frase ao lado do seletor (frase da versão 6 do mock). */
export function textoAoLadoDoSeletor(nomeDoPlano: string, incluidos: number, preco: number = PRECO_DO_ACESSO_EXTRA): string {
  var reais = Number.isInteger(preco) ? "R$ " + preco : fmtBRL(preco);
  return "O plano " + nomeDoPlano + " inclui " + oQueOPlanoInclui(incluidos) + ". Precisa de mais? " +
    "Cada acesso de funcionário adicional custa " + reais + " por mês, em qualquer plano.";
}

export type SeletorDaCotacao = {
  atuais: number;      // permanentes atuais da loja (valor inicial)
  temporada: number;   // acessos de temporada ativos, somados por cima
  maximo: number;      // 10
  incluidos: number;   // do plano, contando o titular
  preco: number;       // R$ por acesso (19)
};

/**
 * O que o seletor precisa, lido da cotação pedida com extra_seats. null =
 * sem seletor: cotação ausente, de outro plano/ciclo, de backend sem o p-106
 * (sem current_extra_seats) ou valor combinado (custom / extra_seats_ignored).
 * Sem seletor o checkout não manda extra_seats: a loja nunca perde acessos
 * porque a tela não soube quantos ela tinha.
 */
export function seletorDaCotacao(q: QuoteResponse | null | undefined, plano: string, ciclo: string): SeletorDaCotacao | null {
  if (!q || typeof q !== "object") return null;
  if (!q.plan || String(q.plan).toLowerCase() !== plano) return null;
  if (q.cycle && String(q.cycle).toLowerCase() !== ciclo) return null;
  if (q.custom === true || q.extra_seats_ignored === true) return null;
  var atuais = numero(q.current_extra_seats);
  if (atuais === null || atuais < 0) return null;
  var maximo = numero(q.max_extra_seats);
  var incluidos = numero(q.plan_included_seats);
  var preco = numero(q.seat_price);
  var temporada = numero(q.season_extra_seats);
  var max = maximo !== null && maximo >= 0 ? Math.floor(maximo) : MAXIMO_DE_ACESSOS_ADICIONAIS;
  return {
    atuais: Math.min(Math.floor(atuais), max),
    temporada: temporada !== null && temporada > 0 ? Math.floor(temporada) : 0,
    maximo: max,
    incluidos: incluidos !== null && incluidos >= 1 ? Math.floor(incluidos) : (ACESSOS_INCLUIDOS_NO_PLANO[plano] || 1),
    preco: preco !== null && preco > 0 ? preco : PRECO_DO_ACESSO_EXTRA,
  };
}

/**
 * Total por mês da cotação pedida com extra_seats = n (plano + acessos
 * escolhidos + temporada), ou null se a cotação não é desta escolha
 * (resposta atrasada de outro plano, ciclo ou quantidade).
 */
export function totalDaCotacaoComAcessos(q: QuoteResponse | null | undefined, plano: string, ciclo: string, n: number): number | null {
  if (!q || typeof q !== "object") return null;
  if (!q.plan || String(q.plan).toLowerCase() !== plano) return null;
  if (q.cycle && String(q.cycle).toLowerCase() !== ciclo) return null;
  if (numero(q.extra_seats) !== n) return null;
  var v = numero(q.value);
  return v !== null && v > 0 ? arredonda(v) : null;
}

export function textoDoBotaoDePagar(o: { metodo: "pix" | "card"; valor: number; diasGratis: number }): string {
  if (o.diasGratis > 0) {
    return o.metodo === "pix"
      ? "Ativar " + o.diasGratis + " dias grátis"
      : "Ativar " + o.diasGratis + " dias grátis (sem cobrança hoje)";
  }
  return o.metodo === "pix" ? "Gerar Pix de " + fmtBRL(o.valor) : "Pagar " + fmtBRL(o.valor) + " no cartão";
}

function quantoSai(c: ValidateCouponResponse): string {
  if ((c.discount_pct || 0) > 0) return c.discount_pct + "% de desconto";
  return fmtBRL(c.discount_value || 0) + " de desconto";
}

/** A linha verde sob o cupom: "BLACK50 aplicado: a primeira mensalidade sai pela metade." */
export function linhaDoCupomAplicado(c: ValidateCouponResponse): string {
  var code = c.code || "Cupom";
  var tipo = couponKind(c);
  if (tipo === "trial") {
    return code + " aplicado: " + (c.trial_days || 0) + " dias grátis" +
      (c.first_charge_date ? ". A primeira cobrança é em " + fmtDateBR(c.first_charge_date) + "." : ".");
  }
  if (tipo === "recurring") {
    return code + " aplicado: as " + (c.discount_months || 1) + " primeiras mensalidades saem com " + quantoSai(c) + ".";
  }
  if (c.discount_pct === 50) return code + " aplicado: a primeira mensalidade sai pela metade.";
  return code + " aplicado: a primeira mensalidade sai com " + quantoSai(c) + ".";
}

/** Rótulo da linha do desconto no resumo, ou null (dias grátis não têm linha). */
export function rotuloDoCupomNoResumo(c: ValidateCouponResponse): string | null {
  var tipo = couponKind(c);
  if (tipo === "trial") return null;
  if (tipo === "recurring") return "Cupom " + (c.code || "") + " · " + (c.discount_months || 1) + " primeiras mensalidades";
  return "Cupom " + (c.code || "") + " · 1ª mensalidade";
}

/** A frase sob o total quando há cupom. `depois` = valor cheio por mês. */
export function textoDepoisDoCupom(c: ValidateCouponResponse, depois: number): string {
  var tipo = couponKind(c);
  if (tipo === "trial") {
    return "Depois, " + fmtBRL(depois) + " por mês" +
      (c.first_charge_date ? ", a partir de " + fmtDateBR(c.first_charge_date) + "." : ".");
  }
  if (tipo === "recurring") {
    var n = c.discount_months || 1;
    return "Depois, " + fmtBRL(depois) + " por mês, a partir da " + (n + 1) + "ª mensalidade" +
      (c.first_full_charge_date ? " (" + fmtDateBR(c.first_full_charge_date) + ")" : "") + ".";
  }
  return "Depois, " + fmtBRL(depois) + " por mês. Desconto só na primeira mensalidade.";
}

export const CUPOM_NAO_ENCONTRADO = "Não encontrei esse código. Confira e tente de novo.";

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

var RECUSAS: { de: string; para: string }[] = [
  { de: "cupom nao encontrado", para: CUPOM_NAO_ENCONTRADO },
  { de: "cupom invalido", para: CUPOM_NAO_ENCONTRADO },
  { de: "cupom desativado", para: "Esse código não está mais ativo." },
  { de: "cupom expirado", para: "Esse código já venceu." },
  { de: "cupom ja atingiu o limite de usos", para: "Esse código já chegou ao limite de usos." },
  { de: "esta empresa ja usou este cupom", para: "Esta loja já usou esse código." },
  { de: "este codigo nao vale como cupom de assinatura", para: "Esse código não vale para a assinatura." },
];

/** A linha laranja da recusa, a partir do `error` do /billing/validate-coupon. */
export function mensagemDoCupomRecusado(erro?: string | null): string {
  if (!erro) return CUPOM_NAO_ENCONTRADO;
  var e = semAcento(erro).replace(/[.!]+$/, "");
  for (var i = 0; i < RECUSAS.length; i++) if (e === RECUSAS[i].de) return RECUSAS[i].para;
  return erro;
}
