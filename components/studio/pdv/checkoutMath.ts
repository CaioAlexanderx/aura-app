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

// ── Venda com sinal (F3) ─────────────────────────────────────
// Não é split: aqui `sinal + saldo = total` por construção, porque o saldo é
// o que sobra do total. Por isso splitIsBalanced não se aplica — a única
// regra é 0 < sinal < total. Sem piso de sinal (decisão de produto): a
// lojista decide quanto pedir de entrada.
//
// Espelha a validação do backend (POST /pdv/sale-com-sinal), mas quem manda
// é ele: o total é recalculado no servidor a partir dos itens.

/** Saldo que fica pra data combinada. Nunca negativo. */
export function signalBalance(total: number, sinal: number): number {
  return round2(Math.max(0, total - (Number(sinal) || 0)));
}

/** Sinal válido = maior que zero e menor que o total (sobra saldo). */
export function signalIsValid(total: number, sinal: number): boolean {
  const v = Number(sinal) || 0;
  return v > 0 && v < round2(total);
}

/** Motivo da recusa, pro texto de erro na tela. null = válido. */
export function signalError(total: number, sinal: number): string | null {
  const v = Number(sinal) || 0;
  if (v <= 0) return "Informe quanto o cliente está pagando agora.";
  if (v >= round2(total)) return "O sinal precisa ser menor que o total — senão a venda está paga.";
  return null;
}

/** 'YYYY-MM-DD' de hoje no fuso local (o backend valida o formato). */
export function todayISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// ── K1: prazo prometido ──────────────────────────────────────
// A premissa é que ferramenta boa é fácil de usar: o campo já vem com uma
// data plausível preenchida, e a lojista só ajusta se o combinado for outro.
// Ninguém precisa abrir calendário pra fechar uma venda.
//
// O padrão é uma semana. Quando houver histórico de prazo cumprido, dá pra
// inferir o dela — hoje esse dado não existe (promised_date nasceu agora),
// então um palpite honesto e editável vale mais que um campo vazio.
export const DIAS_PRAZO_PADRAO = 7;

/** Soma dias a uma data 'YYYY-MM-DD' sem passar por fuso. */
export function addDiasISO(iso: string, dias: number): string {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

/** Sugestão de prazo pra pré-preencher o checkout. */
export function prazoSugerido(): string {
  return addDiasISO(todayISO(), DIAS_PRAZO_PADRAO);
}
