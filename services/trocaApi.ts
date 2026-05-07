// ============================================================
// AURA. – services/trocaApi.ts
// Troca (exchange) API — POST /companies/:id/pdv/troca
// Separado de api.ts como parte da decomposição do monolito.
// Depende de migration 101 (sales.type + troca_returned_items).
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
};

export type TrocaResult = {
  sale: any;
  returned_items: any[];
  new_items: any[];
  net_amount: number;
  returned_value: number;
  new_value: number;
  receipt_url: string;
};

// ─── api ─────────────────────────────────────────────────────
export var trocaApi = {
  create: function (companyId: string, body: TrocaBody) {
    return request<TrocaResult>(
      "/companies/" + companyId + "/pdv/troca",
      { method: "POST", body: body, retry: 0, timeout: 15000 }
    );
  },
};
