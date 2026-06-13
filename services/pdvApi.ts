import { request } from "./api";

export type PdvScanResult = {
  match: "exact" | "partial" | "none";
  source?: "barcode" | "variant_barcode" | "sku";
  product?: any;
  variant_id?: string;
  effective_price?: number;
  suggestions?: any[];
  message?: string;
  error?: string;
};

// Shape retornado por GET /companies/:id/pdv/sale/:saleId
export type PdvSaleItem = {
  id: string;              // id do sale_item
  product_name: string;
  quantity: number;        // quantidade vendida
  unit_price: number;
  total_price: number;
  refunded_quantity?: number; // já devolvida (pode vir undefined em vendas antigas)
};

export type PdvSaleDetail = {
  id: string;
  items: PdvSaleItem[];
  [key: string]: any;      // outros campos da venda (total, status, etc)
};

export var pdvApi = {
  createSale: function(companyId: string, body: any) {
    return request<any>("/companies/" + companyId + "/pdv/sale", { method: "POST", body: body });
  },
  scan: function(companyId: string, code: string) {
    return request<PdvScanResult>("/companies/" + companyId + "/pdv/scan/" + encodeURIComponent(code), { retry: 0, timeout: 5000 });
  },
  getSale: function(companyId: string, saleId: string) {
    return request<PdvSaleDetail>("/companies/" + companyId + "/pdv/sale/" + saleId);
  },
};
