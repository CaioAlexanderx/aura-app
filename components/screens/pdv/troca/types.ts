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
//   o handleSubmit do TrocaModal cai no contrato v1 quando há apenas
//   1 venda selecionada. Multi-venda exibe banner "rollout em curso".
//
// 29/05/2026 (FASE 2):
//   - TrocaRascunho: fonte unica de verdade do estado do modal
//   - idempotency_key gerado uma vez ao abrir o modal
// ============================================================
import type { SaleForTroca } from "@/services/trocaApi";
import type { SaleDetailsItem } from "@/services/api";

// ─── Search modes (Step 1 + Step 3) ────────────────────────────
export type Step1SearchMode = "text" | "order" | "barcode" | "qr";
export type Step3SearchMode = "text" | "barcode" | "qr";

// ─── Sale selection (Step 1 → Step 2) ──────────────────────────
export type SelectedSaleRow = SaleForTroca & {
  items: SaleForTroca["items"];
};

// ─── Return entries (Step 2) ───────────────────────────────────
export type ReturnEntry = {
  saleId: string;
  saleDate: string;
  saleCompanyName: string;
  sellerName: string | null;
  item: SaleDetailsItem;
  returnQty: number;
  previouslyReturnedQty: number;
};

// ─── New entries (Step 3) ──────────────────────────────────────
export type NewEntry = {
  product_id: string | null;
  variant_id?: string | null;
  quantity: number;
  unit_price: number;
  product_name_snapshot: string;
  addedVia?: "search" | "barcode" | "qr";
};

// ─── Payment / Refund splits (Step 4) ──────────────────────────
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

// ─── TrocaRascunho: fonte unica de verdade do modal ────────────
// Consolida estados antes espalhados em multiplos useState.
// idempotency_key gerado uma vez quando o modal abre; reutilizado
// em retries automaticos sem criar troca duplicada no backend.
export interface TrocaRascunho {
  returnEntries: ReturnEntry[];
  newEntries: NewEntry[];
  destino: "outro" | "credito" | "dinheiro" | null;
  paymentSplits: PaymentSplit[];
  refundSplits: RefundSplit[];
  estrategiaFiscal: FiscalStrategy;
  idempotency_key: string;
  /** derived: returnEntries.length > 0 && destino definido */
  valido: boolean;
}

// ─── Wizard step ───────────────────────────────────────────────
export type Step = 1 | 2 | 3 | 4;

// ─── Utility ──────────────────────────────────────────────────
export const fmtBRL = (v: number): string =>
  "R$ " + (Number.isFinite(v) ? v : 0).toFixed(2).replace(".", ",");

export const STEP_LABELS: Record<Step, string> = {
  1: "Localizar venda",
  2: "Devolucao",
  3: "Novos itens",
  4: "Confirmar",
};
