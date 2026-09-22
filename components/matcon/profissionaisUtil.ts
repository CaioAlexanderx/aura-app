// ============================================================
// AURA. — Matcon: contas do Clube do Profissional (M3)
//
// 22/09/2026. Puro de propósito, como quotesUtil.ts e deliveriesUtil.ts:
// é aqui que mora a conta que o vendedor não pode errar no balcão — "quantos
// cupons dá pra tirar com esses pontos" — e o texto que sai no WhatsApp do
// profissional (docs/mockups/matcon-m3-clube-calculadora.html#whatsapp e
// #config: "a cada 100, dez pontos; cem pontos, dez reais").
//
// Fonte das regras: constants/matcon.ts (matcon_points_per_100,
// matcon_points_to_coupon, matcon_coupon_value) — este arquivo só calcula,
// nunca lê pdv_settings sozinho.
// ============================================================
import { TRADE_LABELS, type Professional } from "@/services/matconApi";

export type CupomPossivel = {
  /** Quantos cupons cheios os pontos de hoje já cobrem. */
  cupons: number;
  /** Dinheiro que esses cupons valem juntos. */
  valor: number;
  /** Pontos que sobram depois de tirar os cupons — nunca dá pra outro cupom sozinho. */
  sobra: number;
};

/**
 * "1.240 pontos, a R$ 10 por 100 pontos, dão R$ 120 de cupom e sobram 40"
 * (docs/mockups/matcon-m3-clube-calculadora.html#whatsapp). `pointsToCoupon`
 * inválido (<=0, não finito) devolve zero cupom — nunca divide por zero.
 */
export function cupomPossivel(points: number, pointsToCoupon: number, couponValue: number): CupomPossivel {
  if (!isFinite(points) || points <= 0 || !isFinite(pointsToCoupon) || pointsToCoupon <= 0) {
    return { cupons: 0, valor: 0, sobra: Math.max(0, Math.round((points || 0) * 100) / 100) };
  }
  const cupons = Math.floor(points / pointsToCoupon);
  const valor = Math.round(cupons * (couponValue || 0) * 100) / 100;
  const sobra = Math.round((points - cupons * pointsToCoupon) * 100) / 100;
  return { cupons, valor, sobra };
}

/** Primeiro nome, para a saudação do WhatsApp ("Seu Nivaldo, ..."). */
export function primeiroNome(nome: string | null | undefined): string {
  const t = (nome || "").trim();
  return t ? t.split(/\s+/)[0] : "";
}

/** "R$ 12.480" — sem centavos, o que se lê de longe no card. */
export function fmtMoneyCurto(n: number | string | null | undefined): string {
  return `R$ ${Math.round(Number(n || 0)).toLocaleString("pt-BR")}`;
}

/** "1.240" — separador de milhar pt-BR, sem sufixo (o card escreve "pts" à parte). */
export function fmtPontos(n: number | string | null | undefined): string {
  return Math.round(Number(n || 0)).toLocaleString("pt-BR");
}

/** "pedreiro · 9 indicações · R$ 12.480 trazidos este mês" (linha do card). */
export function rotuloResumo(p: Professional): string {
  const trade = TRADE_LABELS[p.trade] || TRADE_LABELS.outro;
  const indicacoes = `${p.referrals_count} ${p.referrals_count === 1 ? "indicação" : "indicações"}`;
  const trazido = `${fmtMoneyCurto(p.referred_sales_total)} trazidos este mês`;
  return `${trade} · ${indicacoes} · ${trazido}`;
}

/**
 * Meia-noite local de uma data pura ("YYYY-MM-DD") ou de um timestamp do
 * servidor ("2026-09-22T11:03:00Z") — nos dois casos só os 10 primeiros
 * caracteres importam. Nunca `new Date(iso)` direto: em UTC-3 isso vira a
 * véspera (mesmo cuidado de meiaNoiteLocal em quotesUtil.ts).
 */
function meiaNoiteLocal(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const partes = String(iso).slice(0, 10).split("-");
  const y = Number(partes[0]), m = Number(partes[1]), d = Number(partes[2]);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * Dias corridos desde a última indicação (meia-noite a meia-noite, mesma
 * conta de diasAteVencer em quotesUtil.ts). Sem indicação nenhuma -> null,
 * nunca 0 nem NaN — quem chama decide o que mostrar ("nenhuma compra ainda").
 */
export function diasSemCompra(lastReferralAt: string | null | undefined, hoje: Date = new Date()): number | null {
  const alvo = meiaNoiteLocal(lastReferralAt);
  if (!alvo) return null;
  const meiaNoiteHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.max(0, Math.round((meiaNoiteHoje.getTime() - alvo.getTime()) / 86400000));
}

/** Marcado nos últimos 30 dias -> selo "NOVO" no card (mockup, card do Aparecido Lima). */
export function ehNovo(createdAt: string | null | undefined, hoje: Date = new Date()): boolean {
  const alvo = meiaNoiteLocal(createdAt);
  if (!alvo) return false;
  const meiaNoiteHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dias = Math.round((meiaNoiteHoje.getTime() - alvo.getTime()) / 86400000);
  return dias >= 0 && dias <= 30;
}

type RegrasClube = { matcon_points_to_coupon: number; matcon_coupon_value: number };

/**
 * O extrato que vai no botão "Avisar no WhatsApp" — mesma frase do mockup
 * #whatsapp: "Seu Nivaldo, você tem 1.240 pontos no Depósito Santa Rita —
 * já dá um cupom de R$ 120. Quer resgatar?". Sem pontos pra cupom ainda,
 * mostra quanto falta em vez de "R$ 0".
 */
export function textoExtratoWhatsApp(p: Professional, settings: RegrasClube, nomeDaLoja: string): string {
  const nome = primeiroNome(p.customer_name);
  const saudacao = nome ? `Seu ${nome}` : "Oi";
  const pontos = fmtPontos(p.points_balance);
  const { cupons, valor } = cupomPossivel(p.points_balance, settings.matcon_points_to_coupon, settings.matcon_coupon_value);

  if (cupons > 0) {
    return `${saudacao}, você tem ${pontos} pontos no ${nomeDaLoja} — já dá um cupom de ${fmtMoneyCurto(valor)}. Quer resgatar?`;
  }
  const faltam = fmtPontos(Math.max(0, settings.matcon_points_to_coupon - p.points_balance));
  return `${saudacao}, você tem ${pontos} pontos no ${nomeDaLoja} — faltam ${faltam} para o próximo cupom de ${fmtMoneyCurto(settings.matcon_coupon_value)}.`;
}

/** Texto do botão "Chamar de volta" (profissional sem compra indicada há 60+ dias). */
export function textoChamarDeVolta(p: Professional, settings: RegrasClube, nomeDaLoja: string): string {
  const nome = primeiroNome(p.customer_name);
  const saudacao = nome ? `Seu ${nome}` : "Oi";
  const { valor } = cupomPossivel(p.points_balance, settings.matcon_points_to_coupon, settings.matcon_coupon_value);
  const cupomFrase = valor > 0 ? ` — você tem ${fmtPontos(p.points_balance)} pontos parados, já dá um cupom de ${fmtMoneyCurto(valor)}` : "";
  return `${saudacao}, faz tempo que a gente não vende pra ninguém que você indicou pro ${nomeDaLoja}${cupomFrase}. Bora voltar a indicar?`;
}

/** Texto do WhatsApp depois de gerar o cupom — "Gerar cupom de resgate". */
export function textoCupomGerado(p: Professional, couponCode: string, couponValue: number, nomeDaLoja: string): string {
  const nome = primeiroNome(p.customer_name);
  const saudacao = nome ? `Seu ${nome}` : "Oi";
  return `${saudacao}, seu cupom é ${couponCode} — ${fmtMoneyCurto(couponValue)} pra usar no ${nomeDaLoja} quando quiser.`;
}
