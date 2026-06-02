import { request } from "./api";

export type SaleStatus = "completed" | "cancelled";

export type SaleDetailsItem = {
  id: string;
  product_id: string | null;
  variant_id?: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  total_price: number;
  product_name: string;
  image_url?: string | null;
};

export type SaleDetails = {
  has_sale: boolean;
  transaction: {
    id: string;
    amount: number;
    description: string;
    employee_id?: string | null;
    employee_name?: string | null;
  };
  sale?: {
    id: string;
    total_amount: number;
    discount_amount: number;
    payment_method: string | null;
    status: string | null;
    cancelled_at?: string | null;
    created_at: string;
  };
  customer?: { id: string; name: string; phone?: string | null } | null;
  seller?: { id?: string | null; name?: string | null };
  items?: SaleDetailsItem[];
  available_employees: Array<{ id: string; name: string }>;
};

export type SalesListItem = {
  id: string;
  total_amount: number;
  discount_amount: number;
  payment_method: string | null;
  status: SaleStatus;
  // 29/05/2026: 'sale' | 'troca'. Backend GET /sales expoe o type pra UI
  // marcar a linha como "Troca" (a troca sempre apareceu na listagem).
  type?: "sale" | "troca" | string;
  // 02/06/2026: troca segmentada. exchange_of_sale_id = venda original;
  // returned_value = valor devolvido; net_amount = liquido (novos - devolvidos)
  // pra venda normal, net_amount === total_amount.
  exchange_of_sale_id?: string | null;
  returned_value?: number;
  net_amount?: number;
  cancelled_at?: string | null;
  created_at: string;
  customer: { id: string; name: string } | null;
  seller: { id: string | null; name: string | null };
  items_count: number;
  transaction_id: string | null;
};

export type SalesStats = {
  total_sales: number;
  active_sales: number;
  cancelled_sales: number;
  revenue: number;
  avg_ticket: number;
};

export type SalesListResponse = {
  total: number;
  limit: number;
  offset: number;
  sales: SalesListItem[];
  stats: SalesStats;
};

// 02/06/2026: item devolvido na troca (lado "saiu do carrinho do cliente").
export type SaleReturnedItem = {
  product_id: string | null;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
  product_name: string;
  image_url?: string | null;
  original_sale_id: string | null;
};

// 02/06/2026: bloco `troca` no detalhe — so presente quando sale.type === 'troca'.
export type SaleTrocaBlock = {
  exchange_of_sale_id: string | null;
  returned_value: number;
  new_value: number;
  net_amount: number;
  returned_items: SaleReturnedItem[];
  payments: Array<{ method: string; amount: number }>;
};

export type SaleDetailFull = {
  sale: {
    id: string;
    total_amount: number;
    discount_amount: number;
    payment_method: string | null;
    status: SaleStatus;
    // 02/06/2026: type + exchange_of_sale_id no detalhe.
    type?: "sale" | "troca" | string;
    exchange_of_sale_id?: string | null;
    cancelled_at?: string | null;
    created_at: string;
    notes: string | null;
    cash_tendered: number | null;
    coupon_code: string | null;
    transaction_id: string | null;
  };
  customer: { id: string; name: string; phone: string | null; email: string | null } | null;
  seller: { id: string | null; name: string | null };
  items: SaleDetailsItem[];
  // 02/06/2026: null em venda normal; preenchido em troca.
  troca?: SaleTrocaBlock | null;
};

// 02/06/2026: retorno do cancel — campos de troca quando type='troca'.
export type CancelSaleResult = {
  ok: boolean;
  sale_id: string;
  type?: "sale" | "troca" | string;
  refunded_amount: number;
  items_returned: number;
  payments_removed?: number;
  payments_amount?: number;
  troca_returned_decremented?: number;
  troca_tx_removed?: number;
  payouts_reversed?: number;
  fiscal_warnings?: string[];
};

export type SalesFilters = {
  date_from?: string;
  date_to?: string;
  status?: "all" | "active" | "cancelled";
  seller_id?: string;
  customer_id?: string;
  q?: string;
  // 11/05/2026: filtro de busca por codigo de barras do produto.
  product_barcode?: string;
  limit?: number;
  offset?: number;
};

export var salesApi = {
  list: function(companyId: string, filters?: SalesFilters) {
    var qs: string[] = [];
    if (filters?.date_from) qs.push("date_from=" + encodeURIComponent(filters.date_from));
    if (filters?.date_to) qs.push("date_to=" + encodeURIComponent(filters.date_to));
    if (filters?.status && filters.status !== "all") qs.push("status=" + filters.status);
    if (filters?.seller_id) qs.push("seller_id=" + encodeURIComponent(filters.seller_id));
    if (filters?.customer_id) qs.push("customer_id=" + encodeURIComponent(filters.customer_id));
    if (filters?.q) qs.push("q=" + encodeURIComponent(filters.q));
    if (filters?.product_barcode) qs.push("product_barcode=" + encodeURIComponent(filters.product_barcode));
    if (filters?.limit) qs.push("limit=" + filters.limit);
    if (filters?.offset) qs.push("offset=" + filters.offset);
    var suffix = qs.length ? "?" + qs.join("&") : "";
    return request<SalesListResponse>("/companies/" + companyId + "/sales" + suffix, { retry: 1 });
  },
  get: function(companyId: string, saleId: string) {
    return request<SaleDetailFull>("/companies/" + companyId + "/sales/" + saleId, { retry: 1 });
  },
  cancel: function(companyId: string, saleId: string, reason?: string) {
    return request<CancelSaleResult>(
      "/companies/" + companyId + "/sales/" + saleId + "/cancel",
      { method: "POST", body: { reason: reason || "" }, retry: 0, timeout: 15000 }
    );
  },
  updateSeller: function(companyId: string, saleId: string, seller_id: string | null) {
    return request<{ ok: boolean; sale_id: string; seller_id: string | null; seller_name: string | null }>(
      "/companies/" + companyId + "/sales/" + saleId,
      { method: "PATCH", body: { seller_id: seller_id }, retry: 0 }
    );
  },
};

export var transactionSaleApi = {
  getDetails: function(companyId: string, txId: string) {
    return request<SaleDetails>(
      "/companies/" + companyId + "/transactions/" + txId + "/sale-details",
      { retry: 1 }
    );
  },
  removeItem: function(companyId: string, txId: string, itemId: string) {
    return request<{
      ok: boolean;
      removed_item: { id: string; name: string; quantity: number; refund_amount: number };
      new_sale_total: number;
      new_tx_amount: number;
      sale_cancelled: boolean;
    }>(
      "/companies/" + companyId + "/transactions/" + txId + "/sale-items/" + itemId,
      { method: "DELETE", retry: 0, timeout: 15000 }
    );
  },
  addItem: function(
    companyId: string,
    txId: string,
    body: { product_id: string; variant_id?: string | null; quantity: number; unit_price?: number; product_name_snapshot?: string }
  ) {
    return request<{
      ok: boolean;
      item: SaleDetailsItem;
      new_sale_total: number;
      new_tx_amount: number;
    }>(
      "/companies/" + companyId + "/transactions/" + txId + "/sale-items",
      { method: "POST", body: body, retry: 0, timeout: 15000 }
    );
  },
  updateSeller: function(companyId: string, txId: string, employee_id: string | null, employee_name?: string) {
    return request<{ ok: boolean; transaction: any; synced_to_sale: boolean }>(
      "/companies/" + companyId + "/transactions/" + txId + "/seller",
      { method: "PATCH", body: { employee_id: employee_id, employee_name: employee_name }, retry: 0 }
    );
  },
};
