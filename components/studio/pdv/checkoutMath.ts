// ============================================================
// AURA STUDIO · PDV — matemática do checkout (desconto/cupom/split)
//
// Port da lógica canônica de hooks/useCart.ts (PDV Negócio) pro Studio.
// Funções PURAS, sem estado — usadas tanto pela UI (StageCheckout/index)
// quanto pelo finalizeSale (useStudioCheckout), pra manter o total exibido
// e o payload enviado SEMPRE em sincronia. Teto de desconto 50% espelha o
// MAX_DISCOUNT_PCT do Negócio.
// ============================================================
import type { CartLine, PaymentEntry } from "./types";

export const MAX_DISCOUNT_PCT = 50;

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Preço de venda efetivo da linha (lápis sobrescreve o de tabela). */
export function lineSalePrice(l: CartLine): number {
  return l.unitPrice != null && l.unitPrice >= 0 ? l.unitPrice : l.product.price;
}

/** Preço de tabela (estoque) — base pro item_discount. */
export function lineListPrice(l: CartLine): number {
  return l.product.price;
}

/** Desconto por item (lápis) = (tabela − venda) × qtd, nunca negativo. */
export function lineDiscount(l: CartLine): number {
  return round2(Math.max(0, lineListPrice(l) - lineSalePrice(l)) * l.qty);
}

/** Subtotal do carrinho usando o preço de venda efetivo. */
export function cartSubtotal(cart: CartLine[]): number {
  return round2(cart.reduce((s, l) => s + lineSalePrice(l) * l.qty, 0));
}

/** Desconto manual (%/R$) com teto de 50% do subtotal. */
export function manualDiscountAmount(
  subtotal: number,
  type: "%" | "R$",
  valueStr: string,
): number {
  const raw = parseFloat((valueStr || "").replace(",", ".")) || 0;
  if (raw <= 0 || subtotal <= 0) return 0;
  if (type === "%") {
    return round2((subtotal * Math.min(raw, MAX_DISCOUNT_PCT)) / 100);
  }
  return round2(Math.min(raw, (subtotal * MAX_DISCOUNT_PCT) / 100));
}

/** Total final = subtotal − desconto manual − cupom (nunca negativo). */
export function totalAfter(subtotal: number, manual: number, coupon: number): number {
  return round2(Math.max(0, subtotal - manual - coupon));
}

export function splitSum(splits: PaymentEntry[]): number {
  return round2(splits.reduce((s, p) => s + (Number(p.value) || 0), 0));
}

/** Restante = total − soma das formas. Pode ser negativo (overpay). */
export function splitRemaining(total: number, splits: PaymentEntry[]): number {
  return round2(total - splitSum(splits));
}

/** Tolerância de 1 centavo, igual ao validatePayments do backend. */
export function splitIsBalanced(total: number, splits: PaymentEntry[]): boolean {
  return Math.abs(splitRemaining(total, splits)) < 0.01;
}
