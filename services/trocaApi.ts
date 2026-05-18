// ============================================================
// AURA. – services/trocaApi.ts
// Troca (exchange) API — POST /companies/:id/pdv/troca
// Separado de api.ts como parte da decomposição do monolito.
//
// 17/05/2026 (TROCA v2): createV2 + types V2.
//   - original_sale_ids[] (array) → backend roteia pra trocaV2.handle
//   - payment_splits[] / refund_splits[] (multi-método)
//   - original_sale_item_id em returned_items (dupla-devolução check)
//   - searchSalesForTroca aceita order_number + nfce_chave
//
//   create (v1) mantido inalterado pra compat retroativa.
//
// Doc: Aura/AUDITORIA_TROCA_PDV_2026-05-17.docx
// ============================================================
import { request } from "./api";

// ─── v1 types (mantidos pra compat) ───────────────────────────
export type TrocaItem = {
  product_id: string | null;
  variant_id?: string | null;
  quantity: number;
  unit_price: number;
  product_name_snapshot?: string;
};

export type TrocaBody = {
  original_sale_id: string;
  returned_items: TrocaItem[];
  new_items: TrocaItem[];
  payment_method?: string;
  customer_id?: string;
  employee_id?: string;
  seller_name?: string;
  nfce_strategy?: "none" | "cancel_reissue" | "devolucao_55";
};

export type TrocaResult = {
  sale: any;
  returned_items: any[];
  new_items: any[];
  net_amount: number;
  returned_value: number;
  new_value: number;
  cross_filial?: boolean;
  origin_company_id?: string;
  physical_company_id?: string;
  nfce?: {
    strategy: string;
    original_chave_cancelada?: string;
    original_numero?: string;
    original_age_hours?: number;
  };
  receipt_url: string;
};

// ─── v2 types (multi-venda + splits) ──────────────────────────
export type TrocaReturnedItemV2 = TrocaItem & {
  original_sale_id: string;
  original_sale_item_id: string;
};

export type TrocaPaymentSplit = {
  method: "dinheiro" | "pix" | "cartao_credito" | "cartao_debito";
  amount: number;
  installments?: number;
};

export type TrocaRefundSplit = {
  method: "dinheiro" | "pix" | "cartao_estorno" | "crediario_credito" | "vale";
  amount: number;
  notes?: string;
};

export type TrocaCustomerAddress = {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
  ibge: string;
};

export type TrocaBodyV2 = {
  original_sale_ids: string[];
  returned_items: TrocaReturnedItemV2[];
  new_items: TrocaItem[];
  payment_splits?: TrocaPaymentSplit[];
  refund_splits?: TrocaRefundSplit[];
  customer_id?: string;
  employee_id?: string;
  seller_name?: string;
  nfce_strategy?: "none" | "cancel_reissue" | "devolucao_55" | "per_origin";
  customer_address?: TrocaCustomerAddress;
  notes?: string;
};

export type TrocaResultV2 = {
  version: "v2";
  sale: any;
  returned_items: any[];
  new_items: any[];
  net_amount: number;
  returned_value: number;
  new_value: number;
  cross_filial: boolean;
  origin_company_ids: string[];
  physical_company_id: string;
  payouts: Array<{
    id: string;
    method: string;
    amount: number;
    credit_transaction_id: string | null;
  }>;
  fiscal: {
    strategy: string;
    per_origin: Array<{
      original_sale_id: string;
      strategy: string;
      [key: string]: any;
    }>;
  };
  original_sale_ids: string[];
  receipt_url: string;
};

// ─── search-for-troca (group-aware, agora com order_number + nfce_chave) ──
export type SaleForTrocaItem = {
  product_id: string | null;
  variant_id: string | null;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  // 17/05/2026 (v2): backend agora devolve sale_items.id pra dupla-devolução check
  original_sale_item_id?: string;
};

export type SaleForTroca = {
  id: string;
  total_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  company_id: string;
  company_name: string;
  customer_id: string | null;
  customer_name: string | null;
  cpf_cnpj: string | null;
  seller_id: string | null;
  seller_name: string | null;
  is_cross_filial: boolean;
  item_count: number;
  items: SaleForTrocaItem[];
};

export type SearchForTrocaParams = {
  q?: string;
  customer_id?: string;
  // 17/05/2026 (v2): novos filtros
  order_number?: string;
  nfce_chave?: string;
  days?: number;
  limit?: number;
};

// ─── api ─────────────────────────────────────────────────────
export var trocaApi = {
  // v1 — original_sale_id escalar + payment_method único.
  // Mantido pra compat retroativa enquanto migração v2 não termina.
  create: function (companyId: string, body: TrocaBody) {
    return request<TrocaResult>(
      "/companies/" + companyId + "/pdv/troca",
      { method: "POST", body: body, retry: 0, timeout: 15000 }
    );
  },

  // v2 — multi-venda + splits + per_origin fiscal.
  // Backend detecta pela presença de original_sale_ids[].
  createV2: function (companyId: string, body: TrocaBodyV2) {
    return request<TrocaResultV2>(
      "/companies/" + companyId + "/pdv/troca",
      { method: "POST", body: body, retry: 0, timeout: 20000 }
    );
  },

  // GET /sales-for-troca — group-aware (cross-filial).
  // 17/05/2026: aceita order_number (substring match em sale.id) e
  // nfce_chave (chave SEFAZ 44 dígitos da NFC-e autorizada).
  searchSalesForTroca: function (
    companyId: string,
    params: SearchForTrocaParams = {}
  ) {
    var qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.customer_id) qs.set("customer_id", params.customer_id);
    if (params.order_number) qs.set("order_number", params.order_number);
    if (params.nfce_chave) qs.set("nfce_chave", params.nfce_chave);
    if (params.days != null) qs.set("days", String(params.days));
    if (params.limit != null) qs.set("limit", String(params.limit));
    var path =
      "/companies/" +
      companyId +
      "/pdv/sales-for-troca" +
      (qs.toString() ? "?" + qs.toString() : "");
    return request<SaleForTroca[]>(path, {
      method: "GET",
      retry: 1,
      timeout: 10000,
    });
  },
};
