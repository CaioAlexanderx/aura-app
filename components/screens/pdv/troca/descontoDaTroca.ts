// ============================================================
// AURA. — PDV · Troca · desconto e preço alterado no item novo
//
// 29/10/2026 (incidente Davi Calçados: "não consegue dar descontos/alterar
// preço na troca"). O wizard não tinha campo nenhum e o backend gravava
// desconto 0 fixo. Agora a troca usa as MESMAS regras do Caixa:
//   - lápis no preço do item novo (useCart.setUnitPrice): no envio,
//     unit_price = preço de tabela e item_discount = diferença no total da
//     linha; preço acima da tabela vai como unit_price, sem desconto;
//   - desconto manual R$ ou % (DiscountSection), contrato discount_type/
//     discount_value do POST /pdv/sale — o backend recalcula com a mesma regra.
// 12/11/2026: a mesma regra do Caixa (utils/descontoManual): até 100% do
// subtotal dos itens novos, confirmação acima de 50% e arredondamento ao
// centavo igual ao do backend. Antes, teto silencioso de 50%.
// Funções puras: o TrocaModal monta os totais e o payload com elas.
// ============================================================
import type { NewEntry, PaymentSplit, RefundSplit } from "./types";
import { lerDescontoDigitado, resolverDescontoManual, type DescontoManual } from "@/utils/descontoManual";

export { LIMITE_SEM_CONFIRMACAO_PCT } from "@/utils/descontoManual";

export type TipoDesconto = "%" | "R$";

const r2 = (n: number) => Math.round(n * 100) / 100;

export function lerValorDigitado(texto: string): number {
  return lerDescontoDigitado(texto);
}

/** Subtotal dos itens novos com o preço que está na tela (já com o lápis). */
export function subtotalDosNovos(entries: NewEntry[]): number {
  return r2(entries.reduce((s, e) => s + e.quantity * e.unit_price, 0));
}

/** O desconto manual da troca inteiro (valor, limite, confirmação). */
export function descontoDaTroca(subtotal: number, tipo: TipoDesconto, texto: string): DescontoManual {
  return resolverDescontoManual(subtotal, tipo, texto);
}

/** Valor do desconto manual, mesma conta do useCart (até 100%). */
export function descontoManualDaTroca(subtotal: number, tipo: TipoDesconto, texto: string): number {
  return resolverDescontoManual(subtotal, tipo, texto).valor;
}

/** Campos de desconto do corpo (contrato do POST /pdv/sale). Vazio sem desconto. */
export function camposDoDesconto(
  tipo: TipoDesconto, texto: string, valorCalculado: number,
): { discount_type?: "percent" | "fixed"; discount_value?: number } {
  if (!(valorCalculado > 0)) return {};
  if (tipo === "%") return { discount_type: "percent", discount_value: Math.min(lerValorDigitado(texto), 100) };
  return { discount_type: "fixed", discount_value: valorCalculado };
}

/** Preço de tabela do item (o que veio do estoque quando entrou na troca). */
export function precoDeTabela(e: NewEntry): number {
  return e.list_price != null && e.list_price > 0 ? e.list_price : e.unit_price;
}

/** Item novo no formato do backend: lápis vira item_discount, como no Caixa. */
export function itemNovoDoPayload(e: NewEntry) {
  const unitOriginal = Math.max(precoDeTabela(e), e.unit_price);
  const itemDiscount = r2(Math.max(0, unitOriginal - e.unit_price) * e.quantity);
  return {
    product_id: e.product_id,
    variant_id: e.variant_id || null,
    quantity: e.quantity,
    unit_price: unitOriginal,
    item_discount: itemDiscount > 0 ? itemDiscount : undefined,
    product_name_snapshot: e.product_name_snapshot,
  };
}

/**
 * O valor a pagar/devolver mudou (desconto, preço ou item): o split simples
 * acompanha o novo valor; split dividido em várias formas é limpo para a
 * vendedora escolher de novo (não dá para adivinhar de onde tirar).
 * Devolve as mesmas listas quando nada muda (sem re-render à toa).
 */
export function acertarSplits(
  netAmount: number,
  paymentSplits: PaymentSplit[],
  refundSplits: RefundSplit[],
): { paymentSplits: PaymentSplit[]; refundSplits: RefundSplit[] } {
  const acertar = <T extends { amount: number }>(list: T[], alvo: number): T[] => {
    if (list.length === 0) return list;
    const soma = r2(list.reduce((s, p) => s + (p.amount || 0), 0));
    if (Math.abs(soma - alvo) <= 0.005) return list;
    if (list.length === 1) return [{ ...list[0], amount: alvo }];
    return [];
  };
  const vazio = <T,>(list: T[]): T[] => (list.length === 0 ? list : []);
  if (netAmount > 0.005) {
    return { paymentSplits: acertar(paymentSplits, r2(netAmount)), refundSplits: vazio(refundSplits) };
  }
  if (netAmount < -0.005) {
    return { paymentSplits: vazio(paymentSplits), refundSplits: acertar(refundSplits, r2(-netAmount)) };
  }
  return { paymentSplits: vazio(paymentSplits), refundSplits: vazio(refundSplits) };
}
