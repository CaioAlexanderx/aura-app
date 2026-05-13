// ============================================================
// AURA. – services/trocaApi.ts
// Troca (exchange) API — POST /companies/:id/pdv/troca
// Separado de api.ts como parte da decomposição do monolito.
// Depende de migration 101 (sales.type + troca_returned_items).
//
// 12/05/2026 (cross-filial — PR Aura-backend#68):
//   - Adicionado searchSalesForTroca: GET /pdv/sales-for-troca.
//     Endpoint group-aware (billing_owner_company_id). Retorna
//     vendas elegíveis de qualquer filial do mesmo grupo, com
//     flag is_cross_filial pra UI exibir badge.
//   - TrocaResult agora inclui cross_filial, origin_company_id,
//     physical_company_id e bloco nfce (cancel_reissue strategy).
//   - TrocaBody aceita nfce_strategy (cancel_reissue | devolucao_55 |
//     none). Default backend = 'none'.
// ============================================================
import { request } from "./api";

// ─── types ───────────────────────────────────────────────────
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

// ─── search-for-troca (12/05/2026 — cross-filial) ───────────
export type SaleForTrocaItem = {
  product_id: string | null;
  variant_id: string | null;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
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
  days?: number;
  limit?: number;
};

// ─── api ─────────────────────────────────────────────────────
export var trocaApi = {
  create: function (companyId: string, body: TrocaBody) {
    return request<TrocaResult>(
      "/companies/" + companyId + "/pdv/troca",
      { method: "POST", body: body, retry: 0, timeout: 15000 }
    );
  },

  // 12/05/2026 — busca cross-filial via group_root.
  searchSalesForTroca: function (
    companyId: string,
    params: SearchForTrocaParams = {}
  ) {
    var qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.customer_id) qs.set("customer_id", params.customer_id);
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
