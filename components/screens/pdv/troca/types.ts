// ============================================================
// AURA. — PDV · Troca v2 · types compartilhados
// Decomposição do TrocaModal.tsx (1432 linhas) em sub-componentes.
// Doc: Aura/AUDITORIA_TROCA_PDV_2026-05-17.docx
//
// 17/05/2026 (FASE A — UI Redesign):
//   - Multi-seleção de vendas no Step 1 (SelectedSaleRow[])
//   - Splits no Step 4 (PaymentSplit[] | RefundSplit[])
//   - Scanner reutilizado Step 1 (achar venda) + Step 3 (achar produto novo)
//
// COMPAT: enquanto o backend v2 (multi-origin + splits) não chega,
// o handleSubmit do TrocaModal cai no contrato v1 quando há apenas
// 1 venda selecionada. Multi-venda exibe banner "rollout em curso".
// ============================================================
import type { SaleForTroca } from "@/services/trocaApi";
import type { SaleDetailsItem } from "@/services/api";

// ─── Search modes (Step 1 + Step 3) ────────────────────────────
// Step 1: localizar venda original
//   - text:    nome/CPF/vendedora/produto
//   - order:   número do pedido
//   - barcode: bipe (lista vendas com aquele produto)
//   - qr:      QR-Code do cupom NFC-e (chave de acesso)
//
// Step 3: localizar produto novo
//   - text:    nome do produto
//   - barcode: bipe → auto-add
//   - qr:      QR/datamatrix → auto-add (mobile camera ou colar)
export type Step1SearchMode = "text" | "order" | "barcode" | "qr";
export type Step3SearchMode = "text" | "barcode" | "qr";

// ─── Sale selection (Step 1 → Step 2) ──────────────────────────
// SelectedSaleRow estende SaleForTroca com o detalhe carregado pra
// poder listar items no Step 2 sem 2ª round-trip.
export type SelectedSaleRow = SaleForTroca & {
  // detail é o resultado da round-trip salesApi.get quando o backend
  // não retornou items inline (caso barcode mode — same-filial only).
  // No text mode (group-aware), os items já vêm em SaleForTroca.items.
  items: SaleForTroca["items"];
};

// ─── Return entries (Step 2) ───────────────────────────────────
// ReturnEntry agora carrega o sale_id de origem (multi-venda).
// item.id pode ser "synth-<saleId>-<idx>" quando vem do payload
// de /sales-for-troca (sale_item.id não está no payload).
export type ReturnEntry = {
  saleId: string;            // qual venda original
  saleDate: string;          // pra UI agrupar
  saleCompanyName: string;   // badge cross-filial
  sellerName: string | null;
  item: SaleDetailsItem;
  returnQty: number;
  // Histórico de devoluções anteriores naquele sale_item_id —
  // populado quando backend v2 chegar. Por enquanto sempre 0.
  previouslyReturnedQty: number;
};

// ─── New entries (Step 3) ──────────────────────────────────────
export type NewEntry = {
  product_id: string | null;
  variant_id?: string | null;
  quantity: number;
  unit_price: number;
  product_name_snapshot: string;
  // Marca itens adicionados via scan pra UI mostrar "✓ Bipado".
  addedVia?: "search" | "barcode" | "qr";
};

// ─── Payment / Refund splits (Step 4) ──────────────────────────
// PaymentSplit: cliente paga diferença (netAmount > 0)
// RefundSplit:  loja devolve dinheiro (netAmount < 0)
export type PaymentMethod = "dinheiro" | "pix" | "cartao_credito" | "cartao_debito";
export type RefundMethod  = "dinheiro" | "pix" | "cartao_estorno" | "crediario_credito" | "vale";

export type PaymentSplit = {
  method: PaymentMethod;
  amount: number;
  installments?: number;
};

export type RefundSplit = {
  method: RefundMethod;
  amount: number;
  notes?: string;
};

// ─── Fiscal strategy ───────────────────────────────────────────
// Quando multi-origin entrar, "per_origin" permite cada venda escolher
// individualmente (uma <24h → cancel_reissue; outra >24h → devolucao_55).
// Default backend v1 = "none" (sem fiscal).
export type FiscalStrategy =
  | "none"
  | "cancel_reissue"
  | "devolucao_55"
  | "per_origin";

export type CustomerAddress = {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
  ibge: string;
};

// ─── Wizard step ───────────────────────────────────────────────
export type Step = 1 | 2 | 3 | 4;

// ─── Utility ──────────────────────────────────────────────────
export const fmtBRL = (v: number): string =>
  "R$ " + (Number.isFinite(v) ? v : 0).toFixed(2).replace(".", ",");

export const STEP_LABELS: Record<Step, string> = {
  1: "Localizar venda",
  2: "Devolução",
  3: "Novos itens",
  4: "Confirmar",
};
