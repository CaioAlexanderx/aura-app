// ============================================================
// AURA. — Crediário API client
// Fiado (credit.js) + Parcelado (creditInstallments.js)
// Sem cache local — react-query do consumidor cuida disso.
// ============================================================
import { request } from "@/services/api";

// ─── Fiado (legado) ───────────────────────────────────────────
export type CreditBalanceItem = {
  id: string; name: string; phone: string | null; cpf_cnpj: string | null;
  balance: number; total_debited: number; total_paid: number; last_activity_at: string | null;
};
export type CreditTransaction = {
  id: string; sale_id: string | null; type: "debit" | "payment";
  amount: number; payment_method: string | null; notes: string | null; created_at: string;
};
export type CreditCustomerDetail = {
  customer: { id: string; name: string; phone: string; cpf_cnpj: string };
  balance: number; total_debited: number; total_paid: number;
  last_activity_at: string | null; transactions: CreditTransaction[];
};

// ─── Parcelado ────────────────────────────────────────────────
export type ScoreLabel = "premium" | "bom" | "regular" | "restrito" | "bloqueado";

export type CreditProfile = {
  id: string; company_id: string; customer_id: string;
  credit_limit: number; credit_used: number; credit_score: number;
  label: ScoreLabel; status: "active" | "blocked" | "suspended";
  blocked_reason: string | null; avg_days_late: number;
  total_purchases: number; total_paid_count: number;
  total_paid_on_time: number; relationship_months: number;
  score_updated_at: string; notes: string | null;
  open_installments?: CreditInstallment[];
  config?: CreditPlanConfig;
};

export type CreditPlanConfig = {
  company_id: string; max_installments: number;
  min_installment_value: number; interest_rate: number;
  late_fee_rate: number; late_interest_daily: number;
  require_score_min: number; auto_block_days: number;
};

export type CreditInstallment = {
  id: string; sale_id: string | null; customer_id: string; company_id: string;
  installment_number: number; total_installments: number;
  amount_due: number; amount_paid: number;
  due_date: string; paid_at: string | null;
  status: "pending" | "paid" | "overdue" | "cancelled";
  pix_link: string | null; late_fee: number; late_interest: number;
  collection_stage: number;
  customer_name?: string; customer_phone?: string;
};

export type CreditDashboard = {
  kpis: {
    total_open_count: number; total_open_amount: number;
    overdue_count: number; overdue_amount: number;
    critical_count: number; critical_amount: number;
    defaulting_customers: number;
    paid_this_month_count: number; paid_this_month_amount: number;
  };
  top_defaulters: Array<{
    customer_id: string; customer_name: string; phone: string;
    overdue_count: number; total_overdue: number;
    oldest_due_date: string; collection_stage: number;
    credit_score: number; credit_status: string;
  }>;
};

export type AgingRow = {
  faixa: "a_vencer" | "1_30_dias" | "31_60_dias" | "61_90_dias" | "acima_90";
  count: number; amount: number;
};

export type CollectionRules = {
  company_id: string; enabled: boolean; whatsapp_connected: boolean;
  rules: Array<{
    id: string; name: string; days_relative: number;
    template: string; channel: string; enabled: boolean;
  }>;
};

const base = (companyId: string) => `/companies/${companyId}/credit`;

export const creditApi = {
  // ── Fiado (legado) ─────────────────────────────────────────
  listBalances(companyId: string, opts?: { onlyOpen?: boolean; q?: string }) {
    const qs = new URLSearchParams();
    if (opts?.onlyOpen === false) qs.set("only_open", "false");
    if (opts?.q) qs.set("q", opts.q);
    const tail = qs.toString() ? `?${qs}` : "";
    return request<{ customers: CreditBalanceItem[]; total_open: number; customers_open: number }>(
      `${base(companyId)}/balances${tail}`
    );
  },
  getCustomerHistory(companyId: string, customerId: string) {
    return request<CreditCustomerDetail>(`${base(companyId)}/customer/${customerId}`);
  },
  receivePayment(companyId: string, customerId: string, body: { amount: number; payment_method?: string; notes?: string }) {
    return request<{ transaction: CreditTransaction; new_balance: number }>(
      `${base(companyId)}/customer/${customerId}/payment`, { method: "POST", body }
    );
  },
  undoTransaction(companyId: string, transactionId: string) {
    return request<{ deleted: boolean; new_balance: number }>(
      `${base(companyId)}/transaction/${transactionId}`, { method: "DELETE" }
    );
  },

  // ── Crediário Parcelado ────────────────────────────────────
  getCustomerProfile(companyId: string, customerId: string) {
    return request<CreditProfile>(`${base(companyId)}/customers/${customerId}/profile`);
  },
  setCustomerLimit(companyId: string, customerId: string, creditLimit: number) {
    return request<CreditProfile>(`${base(companyId)}/customers/${customerId}/limit`, {
      method: "PUT", body: { credit_limit: creditLimit },
    });
  },
  blockCustomer(companyId: string, customerId: string, action: "block" | "unblock", reason?: string) {
    return request<CreditProfile>(`${base(companyId)}/customers/${customerId}/block`, {
      method: "PATCH", body: { action, reason },
    });
  },
  createInstallments(companyId: string, body: {
    customer_id: string; sale_id?: string; total_amount: number;
    installments: number; first_due_date: string;
  }) {
    return request<{ installments: CreditInstallment[] }>(
      `${base(companyId)}/installments`, { method: "POST", body }
    );
  },
  listInstallments(companyId: string, opts?: { customer_id?: string; status?: string; page?: number; limit?: number }) {
    const qs = new URLSearchParams();
    if (opts?.customer_id) qs.set("customer_id", opts.customer_id);
    if (opts?.status) qs.set("status", opts.status);
    if (opts?.page) qs.set("page", String(opts.page));
    if (opts?.limit) qs.set("limit", String(opts.limit));
    const tail = qs.toString() ? `?${qs}` : "";
    return request<{ data: CreditInstallment[]; total: number; page: number; limit: number }>(
      `${base(companyId)}/installments${tail}`
    );
  },
  payInstallment(companyId: string, installmentId: string, body?: { amount_paid?: number; paid_at?: string }) {
    return request<CreditInstallment & { days_late: number; total_due: number }>(
      `${base(companyId)}/installments/${installmentId}/pay`, { method: "PATCH", body: body || {} }
    );
  },
  cancelInstallment(companyId: string, installmentId: string) {
    return request<CreditInstallment>(
      `${base(companyId)}/installments/${installmentId}/cancel`, { method: "PATCH", body: {} }
    );
  },
  getDashboard(companyId: string) {
    return request<CreditDashboard>(`${base(companyId)}/dashboard`);
  },
  getAging(companyId: string) {
    return request<AgingRow[]>(`${base(companyId)}/dashboard/aging`);
  },
  getCollectionRules(companyId: string) {
    return request<CollectionRules>(`${base(companyId)}/collection/rules`);
  },
  updateCollectionRules(companyId: string, body: Partial<CollectionRules>) {
    return request<CollectionRules>(`${base(companyId)}/collection/rules`, { method: "PUT", body });
  },
  triggerCollection(companyId: string, installmentId: string, body?: { template?: string; channel?: string }) {
    return request<{ success: boolean; message: string; phone: string; days_late: number }>(
      `${base(companyId)}/collection/trigger/${installmentId}`, { method: "POST", body: body || {} }
    );
  },
};
