// ============================================================
// AURA. — Product Links service (Multi-CNPJ M-STOCKLINK MSL-05)
//
// Wraps endpoints de vinculação de produtos entre CNPJs:
//   - matchSuggestions(companyId, productId)   → sugere similares
//   - linkProduct(companyId, productId, sku)   → vincula
//   - unlinkProduct(companyId, productId)      → desvincula
//   - aggregated()                             → produtos agregados
//                                                entre todas empresas
//
// Os 3 primeiros precisam de companyId no path. O último vai em
// /me e não precisa.
// ============================================================
import { request } from "@/services/api";

// ── Tipos ──────────────────────────────────────────────────

export type MatchSuggestion = {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  master_sku: string | null;
  stock_qty: number;
  price: number;
  image_url: string | null;
  company_id: string;
  company_name: string;
  match_score: number;     // 0..1
  match_type: "barcode" | "sku" | "name_similarity";
  already_in_a_group: boolean;
};

export type MatchSuggestionsResponse = {
  product: {
    id: string;
    name: string;
    barcode: string | null;
    sku: string | null;
    master_sku: string | null;
  };
  suggestions: MatchSuggestion[];
  total: number;
  searched_companies?: number;
  note?: string;
};

export type LinkProductResponse = {
  linked: boolean;
  product_id: string;
  master_sku: string;
  previous_master_sku: string | null;
  group: {
    company_count: number;
    product_count: number;
    total_stock: number;
  };
  message: string;
};

export type UnlinkProductResponse = {
  unlinked: boolean;
  product_id?: string;
  previous_master_sku?: string | null;
  reason?: string;
  message: string;
};

export type AggregatedProductItem = {
  product_id: string;
  company_id: string;
  company_name: string;
  stock_qty: number;
  price: number;
};

export type AggregatedProduct = {
  group_key: string;
  master_sku: string | null;
  is_linked: boolean;          // true = grupo de >1 produto vinculado
  name: string;
  barcode: string | null;
  sku: string | null;
  avg_price: number;
  avg_cost: number;
  total_stock: number;
  image_url: string | null;
  category: string | null;
  unit: string | null;
  company_count: number;
  product_count: number;
  items: AggregatedProductItem[];
};

export type AggregatedResponse = {
  products: AggregatedProduct[];
  total: number;
  searched_companies?: number;
  note?: string;
};

// ── APIs ───────────────────────────────────────────────────

export var productLinksApi = {
  // GET /companies/:id/products/:productId/match-suggestions
  matchSuggestions: function (companyId: string, productId: string) {
    return request<MatchSuggestionsResponse>(
      "/companies/" + companyId + "/products/" + productId + "/match-suggestions",
      { retry: 1 }
    );
  },

  // POST /companies/:id/products/:productId/master-sku
  linkProduct: function (companyId: string, productId: string, masterSku: string) {
    return request<LinkProductResponse>(
      "/companies/" + companyId + "/products/" + productId + "/master-sku",
      {
        method: "POST",
        body: { master_sku: masterSku },
        retry: 0,
        timeout: 10000,
      }
    );
  },

  // DELETE /companies/:id/products/:productId/master-sku
  unlinkProduct: function (companyId: string, productId: string) {
    return request<UnlinkProductResponse>(
      "/companies/" + companyId + "/products/" + productId + "/master-sku",
      { method: "DELETE", retry: 0, timeout: 10000 }
    );
  },

  // GET /me/products/aggregated — view consolidada multi-CNPJ
  // Não precisa de companyId — backend resolve pelo JWT.user.id.
  aggregated: function () {
    return request<AggregatedResponse>("/me/products/aggregated", { retry: 1 });
  },
};

// Helper UI: rótulo amigável pro tipo de match
export function matchTypeLabel(type: MatchSuggestion["match_type"]): string {
  switch (type) {
    case "barcode":         return "Mesmo código de barras";
    case "sku":             return "Mesmo SKU";
    case "name_similarity": return "Nome parecido";
    default:                return "Match";
  }
}

// Helper UI: cor do badge baseada no score (0..1)
export function matchScoreColor(score: number): string {
  if (score >= 0.95) return "#16a34a";   // verde forte (match perfeito)
  if (score >= 0.7)  return "#7c3aed";   // violeta (boa probabilidade)
  if (score >= 0.5)  return "#f59e0b";   // âmbar (revisar)
  return "#94a3b8";                      // cinza (pouco confiável)
}
