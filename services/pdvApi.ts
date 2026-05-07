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

export var pdvApi = {
  createSale: function(companyId: string, body: any) {
    return request<any>("/companies/" + companyId + "/pdv/sale", { method: "POST", body: body });
  },
  scan: function(companyId: string, code: string) {
    return request<PdvScanResult>("/companies/" + companyId + "/pdv/scan/" + encodeURIComponent(code), { retry: 0, timeout: 5000 });
  },
};
