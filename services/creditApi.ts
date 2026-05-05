// ============================================================
// AURA. -- Crediario API client
// Consome /companies/:id/credit/* (backend src/routes/credit.js).
// Sem cache local — react-query do consumidor cuida disso.
// ============================================================
import { request } from "@/services/api";

export type CreditBalanceItem = {
  id: string;
  name: string;
  phone: string | null;
  cpf_cnpj: string | null;
  balance: number;
  total_debited: number;
  total_paid: number;
  last_activity_at: string | null;
};

export type CreditTransaction = {
  id: string;
  sale_id: string | null;
  type: "debit" | "payment";
  amount: number;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
};

export type CreditCustomerDetail = {
  customer: { id: string; name: string; phone: string; cpf_cnpj: string };
  balance: number;
  total_debited: number;
  total_paid: number;
  last_activity_at: string | null;
  transactions: CreditTransaction[];
};

export const creditApi = {
  // GET /companies/:id/credit/balances?only_open=true&q=
  listBalances(
    companyId: string,
    opts?: { onlyOpen?: boolean; q?: string }
  ): Promise<{ customers: CreditBalanceItem[]; total_open: number; customers_open: number }> {
    const qs = new URLSearchParams();
    if (opts?.onlyOpen === false) qs.set("only_open", "false");
    if (opts?.q) qs.set("q", opts.q);
    const tail = qs.toString() ? `?${qs.toString()}` : "";
    return request<any>(`/companies/${companyId}/credit/balances${tail}`);
  },

  // GET /companies/:id/credit/customer/:cid
  getCustomerHistory(companyId: string, customerId: string): Promise<CreditCustomerDetail> {
    return request<any>(`/companies/${companyId}/credit/customer/${customerId}`);
  },

  // POST /companies/:id/credit/customer/:cid/payment
  receivePayment(
    companyId: string,
    customerId: string,
    body: { amount: number; payment_method?: string; notes?: string }
  ): Promise<{ transaction: CreditTransaction; new_balance: number }> {
    return request<any>(`/companies/${companyId}/credit/customer/${customerId}/payment`, {
      method: "POST",
      body,
    });
  },

  // DELETE /companies/:id/credit/transaction/:txid
  undoTransaction(
    companyId: string,
    transactionId: string
  ): Promise<{ deleted: boolean; new_balance: number }> {
    return request<any>(`/companies/${companyId}/credit/transaction/${transactionId}`, {
      method: "DELETE",
    });
  },
};
