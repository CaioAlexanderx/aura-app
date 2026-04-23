import { request } from "@/services/api";

// ============================================================
// AURA. -- Products Batch API (lote)
//
// Wrapper isolado pra nao inflar o services/api.ts.
// Backend: POST /companies/:id/products/batch-create
// ============================================================

export type BatchProductInput = {
  name: string;              // obrigatorio
  price?: number;
  cost_price?: number;
  stock_qty?: number;
  category?: string;
  size?: string | null;
  color?: string | null;     // hex #RRGGBB
  sku?: string | null;
  barcode?: string | null;
};

export type BatchProductCreated = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  price: number | string;
  cost_price: number | string;
  stock_qty: number;
  size: string | null;
  color: string | null;
  created_at: string;
};

export type BatchProductsResponse = {
  created: BatchProductCreated[];
  total_created: number;
  total_requested: number;
  duplicates: number;
  errors: Array<{ index: number; message: string }>;
};

export var productsBatchApi = {
  batchCreate: function(companyId: string, products: BatchProductInput[]) {
    return request<BatchProductsResponse>(
      "/companies/" + companyId + "/products/batch-create",
      { method: "POST", body: { products: products }, retry: 0 }
    );
  },
};

export default productsBatchApi;
