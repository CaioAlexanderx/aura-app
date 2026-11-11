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
  var extras = numero(q.extra_seats);
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

/** Texto de hoje da linha dos acessos extras liberados. */
export function rotuloDosAcessosExtras(n: number): string {
  return n + " acesso" + (n > 1 ? "s" : "") + " extra" + (n > 1 ? "s" : "") + " de equipe";
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
