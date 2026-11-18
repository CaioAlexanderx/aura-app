// ============================================================
// AURA. — Caixa: crédito da cliente abatido na venda (INC-2026-11-17-03)
//
// O crédito que fica de uma troca ("Crédito para", p-166), de uma devolução
// do crediário ou de uma sobra de pagamento mora na ficha da cliente, na loja
// (GET /companies/:id/pdv/clientes/:cid/credito). Até aqui o Caixa não
// mostrava esse saldo e a venda não tinha como usá-lo.
//
// Na venda ele vai como uma forma de pagamento a mais, `credito_cliente`, na
// frente das outras: payments [{credito_cliente, 50}, {pix, 150}]. O servidor
// grava a venda cheia (Faturamento), só o resto no caixa e na receita, e baixa
// o crédito na ficha (Aura-backend, services/creditoDaCliente.js).
//
// Funções PURAS (sem React): é o que os testes cobrem.
// ============================================================
import { fmtReais } from "@/utils/precoNoCartao";

export const METODO_CREDITO = "credito_cliente";

/** Textos novos (lista para o Caio aprovar no PR). */
export const TEXTOS_DO_CREDITO = {
  titulo: "Crédito da cliente",
  disponivel: (saldo: number) => fmtReais(saldo) + " disponível",
  usar: "Usar na venda",
  naoUsar: "Não usar",
  campo: "Quanto usar",
  aPagar: (resto: number) => "Falta pagar " + fmtReais(resto),
  pagoNoCredito: "A venda fica toda no crédito",
  sobra: (resto: number) => "Fica " + fmtReais(resto) + " de crédito",
  forma: "Crédito da cliente",
};

function r2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** "50", "50,5", "1.234,56", "R$ 50,00" -> número (NaN quando não dá). */
export function lerValor(texto: string): number {
  const limpo = String(texto || "").replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  if (!limpo) return NaN;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * O valor do crédito que vale na venda: o pedido, com teto no saldo da
 * cliente e no total da venda; nunca negativo. Sem cliente ou sem saldo, 0.
 */
export function creditoQueVale(pedido: number, saldo: number, total: number): number {
  const p = Number(pedido) || 0;
  const s = Math.max(0, Number(saldo) || 0);
  const t = Math.max(0, Number(total) || 0);
  if (!(p > 0) || !(s > 0) || !(t > 0)) return 0;
  return r2(Math.min(p, s, t));
}

/** Quanto usar ao tocar em "Usar na venda": tudo o que der, até o total. */
export function creditoSugerido(saldo: number, total: number): number {
  return creditoQueVale(Number.MAX_VALUE, saldo, total);
}

/**
 * Os pagamentos que vão no POST com o crédito na frente. `pagamentos` são os
 * do dividido (ou undefined fora dele); `forma` é o chip escolhido e `resto`
 * o que falta pagar fora do crédito.
 */
export function pagamentosComCredito(
  credito: number,
  pagamentos: { method: string; value: number; change?: number }[] | undefined,
  forma: string,
  resto: number,
): { method: string; value: number; change?: number }[] | undefined {
  if (!(credito > 0)) return pagamentos;
  const linha = { method: METODO_CREDITO, value: r2(credito) };
  if (pagamentos && pagamentos.length) return [linha, ...pagamentos];
  return r2(resto) > 0 ? [linha, { method: forma, value: r2(resto) }] : [linha];
}
