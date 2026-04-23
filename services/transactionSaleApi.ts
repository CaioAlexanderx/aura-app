import { request } from "@/services/api";

// ============================================================
// AURA. — API de transacoes vinculadas a venda
//
// Endpoints:
//   GET    /companies/:cid/transactions/:tx_id/sale-details
//   DELETE /companies/:cid/transactions/:tx_id/sale-items/:item_id
//   PATCH  /companies/:cid/transactions/:tx_id/seller
// ============================================================

export type SaleDetailsItem = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  total_price: number;
  product_name: string;
  image_url: string | null;
};

export type SaleDetailsCustomer = {
  id: string;
  name: string;
  phone: string | null;
};

export type SaleDetailsSeller = {
  id: string | null;
  name: string | null;
};

export type SaleDetailsAvailableEmployee = { id: string; name: string };

export type SaleDetailsResponse = {
  has_sale: boolean;
  transaction: {
    id: string;
    amount: number;
    description: string;
    employee_id: string | null;
    employee_name: string | null;
  };
  sale?: {
    id: string;
    total_amount: number;
    discount_amount: number;
    payment_method: string | null;
    status: string | null;
    cancelled_at: string | null;
    created_at: string;
  };
  customer?: SaleDetailsCustomer | null;
  seller?: SaleDetailsSeller;
  items?: SaleDetailsItem[];
  available_employees: SaleDetailsAvailableEmployee[];
};

export type RemoveItemResponse = {
  ok: boolean;
  removed_item: { id: string; name: string; quantity: number; refund_amount: number };
  new_sale_total: number;
  new_tx_amount: number;
  sale_cancelled: boolean;
};

export type UpdateSellerResponse = {
  ok: boolean;
  transaction: { id: string; idempotency_key: string | null; employee_id: string | null; employee_name: string | null };
  synced_to_sale: boolean;
};

export var transactionSaleApi = {
  getDetails: function(companyId: string, txId: string) {
    return request<SaleDetailsResponse>(
      "/companies/" + companyId + "/transactions/" + txId + "/sale-details",
      { retry: 1 }
    );
  },
  removeItem: function(companyId: string, txId: string, itemId: string) {
    return request<RemoveItemResponse>(
      "/companies/" + companyId + "/transactions/" + txId + "/sale-items/" + itemId,
      { method: "DELETE", retry: 0 }
    );
  },
  updateSeller: function(companyId: string, txId: string, employeeId: string | null, employeeName?: string | null) {
    return request<UpdateSellerResponse>(
      "/companies/" + companyId + "/transactions/" + txId + "/seller",
      { method: "PATCH", body: { employee_id: employeeId, employee_name: employeeName }, retry: 0 }
    );
  },
};
