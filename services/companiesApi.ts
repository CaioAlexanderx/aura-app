import { request } from "./api";

export type CategoryType = "product" | "service";
export type ProductCategoryRow = {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  type: CategoryType;
  product_count: number;
};

// Calendário comercial (datas que movimentam o comércio). Resposta de
// GET /companies/:id/commercial-dates — ver Aura-backend migration 143.
export type CommercialDateRow = {
  slug: string;
  name: string;
  description: string | null;
  intensity: 1 | 2 | 3;
  date: string;            // YYYY-MM-DD da próxima ocorrência
  days_until: number;
  is_period: boolean;
  window_before_days: number;
  window_start: string;    // YYYY-MM-DD
  in_window: boolean;
  is_custom: boolean;
};
export type CommercialDatesResponse = { reference_date: string; dates: CommercialDateRow[] };

// 30/05/2026: parametros expandidos do ranking ABC (PR fix Eryca).
// Backend novo aceita limit/offset/abc — UI consome em chunks de 25.
export type ProductsRankingOpts = {
  period?: string;
  limit?: number;
  offset?: number;
  abc?: 'A' | 'B' | 'C';
  category?: string;
};

function buildRankingQuery(opts?: ProductsRankingOpts): string {
  var period = (opts && opts.period) || 'month';
  var parts: string[] = ['period=' + encodeURIComponent(period)];
  if (opts && typeof opts.limit === 'number')  parts.push('limit='  + opts.limit);
  if (opts && typeof opts.offset === 'number') parts.push('offset=' + opts.offset);
  if (opts && opts.abc)                        parts.push('abc='    + opts.abc);
  if (opts && opts.category)                   parts.push('category=' + encodeURIComponent(opts.category));
  return parts.join('&');
}

export var companiesApi = {
  get: function(companyId: string) { return request<any>("/companies/" + companyId); },
  getProfile: function(companyId: string) { return request<any>("/companies/" + companyId + "/profile"); },
  updateProfile: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/profile", { method: "PUT", body: body }); },
  transactions: function(companyId: string, params?: string) { return request<any>("/companies/" + companyId + "/transactions" + (params ? "?" + params : "")); },
  createTransaction: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/transactions", { method: "POST", body: body }); },
  updateTransaction: function(companyId: string, txId: string, body: any) { return request<any>("/companies/" + companyId + "/transactions/" + txId, { method: "PATCH", body: body }); },
  deleteTransaction: function(companyId: string, txId: string) { return request<any>("/companies/" + companyId + "/transactions/" + txId, { method: "DELETE" }); },
  categorize: function(companyId: string, descriptions: string[]) { return request<any>("/companies/" + companyId + "/transactions/categorize", { method: "POST", body: { descriptions: descriptions }, timeout: 15000 }); },
  categorizeTransaction: function(companyId: string, txId: string, apply?: boolean) { return request<any>("/companies/" + companyId + "/transactions/" + txId + "/categorize", { method: "POST", body: { apply: apply || false }, timeout: 15000 }); },
  // Bug Davi #2 (07/05/2026): sem ?limit explícito, o backend caía no
  // planLimit (negocio=7000), cortando 3157 produtos do catálogo dele.
  // ?limit=20000 = HARD_CAP do backend → recebe tudo o que existe (até
  // 20k). Acima disso o cliente precisa de busca server-side (futuro PR)
  // ou plano Expansão (limite cadastro ilimitado, ainda assim respeita
  // HARD_CAP da listagem).
  products: function(companyId: string) { return request<any>("/companies/" + companyId + "/products?limit=20000"); },
  createProduct: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/products", { method: "POST", body: body }); },
  updateProduct: function(companyId: string, prodId: string, body: any) { return request<any>("/companies/" + companyId + "/products/" + prodId, { method: "PATCH", body: body }); },
  deleteProduct: function(companyId: string, prodId: string) { return request<any>("/companies/" + companyId + "/products/" + prodId, { method: "DELETE" }); },
  checkDuplicate: function(companyId: string, name: string, excludeId?: string) {
    var q = "?name=" + encodeURIComponent(name) + (excludeId ? "&exclude_id=" + encodeURIComponent(excludeId) : "");
    return request<{ duplicates: Array<{ id: string; name: string; sku: string; barcode: string; color: string; size: string; price: number; stock_qty: number }>; count: number }>("/companies/" + companyId + "/products/check-duplicate" + q, { retry: 0 });
  },
  duplicateGroups: function(companyId: string) {
    return request<{ groups: Array<{ name: string; normalized_name: string; count: number; products: Array<any> }>; total: number }>("/companies/" + companyId + "/products/duplicate-groups");
  },
  mergeAsVariants: function(companyId: string, body: { primary_id: string; attribute_name: string; variants: Array<{ product_id: string; value: string }> }) {
    return request<any>("/companies/" + companyId + "/products/merge-as-variants", { method: "POST", body: body, timeout: 30000 });
  },
  variants: function(companyId: string, productId: string) { return request<any>("/companies/" + companyId + "/products/" + productId + "/variants"); },
  createVariant: function(companyId: string, productId: string, body: any) { return request<any>("/companies/" + companyId + "/products/" + productId + "/variants", { method: "POST", body: body }); },
  updateVariant: function(companyId: string, productId: string, variantId: string, body: any) { return request<any>("/companies/" + companyId + "/products/" + productId + "/variants/" + variantId, { method: "PATCH", body: body }); },
  deleteVariant: function(companyId: string, productId: string, variantId: string) { return request<any>("/companies/" + companyId + "/products/" + productId + "/variants/" + variantId, { method: "DELETE" }); },
  productCategories: function(companyId: string, type?: CategoryType) {
    var q = type ? "?type=" + type : "";
    return request<{ categories: ProductCategoryRow[]; total: number; type: CategoryType }>("/companies/" + companyId + "/product-categories" + q);
  },
  createProductCategory: function(companyId: string, body: { name: string; color?: string | null; sort_order?: number; type?: CategoryType }) {
    return request<any>("/companies/" + companyId + "/product-categories", { method: "POST", body: body });
  },
  updateProductCategory: function(companyId: string, catId: string, body: { name?: string; color?: string | null; sort_order?: number }) {
    return request<any>("/companies/" + companyId + "/product-categories/" + catId, { method: "PATCH", body: body });
  },
  deleteProductCategory: function(companyId: string, catId: string, moveTo?: string) {
    return request<any>("/companies/" + companyId + "/product-categories/" + catId + (moveTo ? "?move_to=" + encodeURIComponent(moveTo) : ""), { method: "DELETE" });
  },
  customers: function(companyId: string) { return request<any>("/companies/" + companyId + "/customers"); },
  createCustomer: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/customers", { method: "POST", body: body }); },
  updateCustomer: function(companyId: string, custId: string, body: any) { return request<any>("/companies/" + companyId + "/customers/" + custId, { method: "PATCH", body: body }); },
  deleteCustomer: function(companyId: string, custId: string) { return request<any>("/companies/" + companyId + "/customers/" + custId, { method: "DELETE" }); },
  retention: function(companyId: string, period?: string) { return request<any>("/companies/" + companyId + "/customers/retention?period=" + (period || "month")); },
  birthdays: function(companyId: string, days: number) {
    return request<{ days: number; total: number; customers: any[] }>("/companies/" + companyId + "/customers/birthdays?days=" + days, { retry: 1 });
  },
  // Calendário comercial: próxima ocorrência de cada data, ordenada por
  // proximidade (datas que movimentam o comércio, intensidade 1/2/3).
  commercialDates: function(companyId: string, horizon?: number) {
    return request<CommercialDatesResponse>("/companies/" + companyId + "/commercial-dates" + (horizon ? "?horizon=" + horizon : ""), { retry: 1 });
  },
  reviews: function(companyId: string, rating?: number) { return request<any>("/companies/" + companyId + "/reviews" + (rating ? "?rating=" + rating : "")); },
  requestReview: function(companyId: string, saleId: string, customerId?: string) { return request<any>("/companies/" + companyId + "/reviews/request", { method: "POST", body: { sale_id: saleId, customer_id: customerId } }); },
  members: function(companyId: string) { return request<any>("/companies/" + companyId + "/members"); },
  membersUnified: function(companyId: string) { return request<any>("/companies/" + companyId + "/members/unified"); },
  inviteMember: function(companyId: string, body: { email: string; role_label?: string; company_ids?: string[]; permissions?: Record<string, boolean> }) {
    var normalizedRole = (body.role_label || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
    return request<any>("/companies/" + companyId + "/members/invite", {
      method: "POST",
      body: {
        invite_email: body.email || undefined,
        role_label:   normalizedRole || undefined,
        company_ids:  body.company_ids,
        permissions:  body.permissions,
      },
      retry: 0,
    });
  },
  updateMember: function(companyId: string, mid: string, body: any) { return request<any>("/companies/" + companyId + "/members/" + mid, { method: "PATCH", body: body }); },
  removeMember: function(companyId: string, mid: string, hard?: boolean) { return request<any>("/companies/" + companyId + "/members/" + mid + (hard ? "?hard=true" : ""), { method: "DELETE" }); },
  membersBilling: function(companyId: string) { return request<any>("/companies/" + companyId + "/members/billing"); },
  appointments: function(companyId: string, start?: string, end?: string) { return request<any>("/companies/" + companyId + "/appointments?start=" + (start || "") + "&end=" + (end || "")); },
  createAppointment: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/appointments", { method: "POST", body: body }); },
  updateAppointment: function(companyId: string, aid: string, body: any) { return request<any>("/companies/" + companyId + "/appointments/" + aid, { method: "PATCH", body: body }); },
  cancelAppointment: function(companyId: string, aid: string) { return request<any>("/companies/" + companyId + "/appointments/" + aid, { method: "DELETE" }); },
  obligations: function(companyId: string) { return request<any>("/companies/" + companyId + "/obligations"); },
  payroll: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/payroll/calculate", { method: "POST", body: body }); },
  dre: function(companyId: string, params?: string) { return request<any>("/companies/" + companyId + "/dre" + (params ? "?" + params : "")); },
  checklist: function(companyId: string) { return request<any>("/companies/" + companyId + "/checklist"); },
  completeCheckpoint: function(companyId: string, checkpointId: string) { return request<any>("/companies/" + companyId + "/checklist/" + checkpointId + "/complete", { method: "POST" }); },
  salesAnalytics: function(companyId: string, period?: string, groupBy?: string) { return request<any>("/companies/" + companyId + "/sales/analytics?period=" + (period || "month") + "&group_by=" + (groupBy || "day")); },
  // 30/05/2026: aceita opts (limit/offset/abc) alem de period. Compat com
  // chamada antiga `productsRanking(cid, 'week')` mantida via overload.
  productsRanking: function(companyId: string, periodOrOpts?: string | ProductsRankingOpts) {
    var opts: ProductsRankingOpts = typeof periodOrOpts === 'string'
      ? { period: periodOrOpts }
      : (periodOrOpts || {});
    return request<any>("/companies/" + companyId + "/products/ranking?" + buildRankingQuery(opts));
  },
  productsCategories: function(companyId: string, period?: string) { return request<any>("/companies/" + companyId + "/products/categories?period=" + (period || "month")); },
};
