// ============================================================
// AURA. — Um lancamento do Financeiro veio de uma venda?
//
// Espelha src/utils/saleLink.js do aura-backend. As duas chaves que amarram
// um lancamento a uma venda:
//
//   pdv-sale-<saleId>                        receita recebida na hora. So
//                                            existe quando entrou dinheiro —
//                                            venda 100% fiada NAO tem.
//   pdv-credit-receivable-<saleId>           "A Receber" do crediario.
//   pdv-credit-receivable-<saleId>-rest-<ts> saldo de pagamento parcial.
//
// 28/08/2026 (relato Eryca): so a primeira era reconhecida, entao "Editar
// lancamento" de uma venda no crediario nao mostrava mercadoria nenhuma.
//
// Mora fora do TransactionModal porque o modal arrasta react-native-svg pelo
// Icon/Toast e o jest do repo nao consegue carregar isso — o predicado precisa
// ser testavel sozinho.
// ============================================================

/** Chave de venda paga na hora (dinheiro/cartao/pix). */
export function isPdvSaleKey(key: string | null | undefined): boolean {
  return typeof key === "string" && /^pdv-sale-/i.test(key);
}

/** Chave do "A Receber" do crediario (inclusive o saldo "-rest-"). */
export function isCreditReceivableKey(key: string | null | undefined): boolean {
  return typeof key === "string" && /^pdv-credit-receivable-/i.test(key);
}

/** Veio de alguma venda — logo, da pra listar/editar as mercadorias. */
export function isSaleLinkedKey(key: string | null | undefined): boolean {
  return isPdvSaleKey(key) || isCreditReceivableKey(key);
}

/** Aceita a transaction inteira; le a idempotency_key sem quebrar em null. */
export function isSaleLinkedTransaction(tx: { idempotency_key?: string | null } | null | undefined): boolean {
  if (!tx) return false;
  return isSaleLinkedKey((tx as any).idempotency_key);
}
