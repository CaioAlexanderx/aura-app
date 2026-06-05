// ============================================================
// AURA. — Crediário API client
// Fiado (credit.js) + Parcelado (creditInstallments.js)
// F3 (29/05/2026): getCustomerPreview, quickCustomer, getPlanConfig,
//   updatePlanConfig, getReceivables, getCustomerHistory com installments.
// ============================================================
import { request } from "@/services/api";

// ─── Fiado (legado) ──────────────────────────────────────────
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
  open_installments?: CreditInstallment[];
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
  /** Cobertura FIFO alocada pelo applyPayment (F1). Fonte de verdade do saldo descoberto. */
  covered_amount: number;
  /** Saldo descoberto: amount_due - covered_amount */
  remaining?: number;
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

/** F3 (29/05/2026): Preview 360 do cliente para PDV checkout (guardrail suave). */
export type CreditPreview = {
  balance: number;
  open_installments_count: number;
  overdue_count: number;
  next_due_date: string | null;
  score: number;
  score_label: ScoreLabel;
  credit_limit: number;
  credit_used: number;
  /** true quando balance >= credit_limit e credit_limit > 0. Apenas aviso, nao bloqueia. */
  over_limit: boolean;
  status: "active" | "blocked";
  blocked_reason: string | null;
};

/** F3 (29/05/2026): A receber do crediario no Financeiro. */
export type FinancialReceivable = {
  customer_id: string | null;
  customer_name: string | null;
  phone: string | null;
  pending_count: number;
  total_open: number;
  oldest_due_date: string | null;
  overdue_count: number;
  overdue_amount: number;
  last_sale_at: string | null;
};
export type FinancialReceivables = {
  receivables: FinancialReceivable[];
  kpis: {
    total_open: number;
    total_overdue: number;
    customers_open: number;
    received_month: number;
  };
};

// ─── Lançamento manual ────────────────────────────────────────
export type ManualEntryPayload = {
  customer_id?: string;
  new_customer?: { name: string; phone: string };
  amount: number;
  installments?: number;
  interest_rate?: number;   // decimal (0.025 = 2.5% ao mês)
  first_due_date?: string;  // YYYY-MM-DD
  entry_date?: string;      // YYYY-MM-DD — data do lançamento (retroativo); default hoje no backend
  description?: string;
};

export type ManualEntryResult = {
  customer: { id: string; name: string };
  transaction: { id: string; amount: number; type: string; notes: string; created_at: string };
  installments: CreditInstallment[];
  new_balance: number;
};

const base = (companyId: string) => `/companies/${companyId}/credit`;

export const creditApi = {
  // ── Fiado (legado) ───────────────────────────────────────────────
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
  receivePayment(companyId: string, customerId: string, body: { amount: number; payment_method?: string; notes?: string; paid_at?: string }) {
    return request<{ transaction: CreditTransaction; new_balance: number; settled: any[]; legacy_amount: number }>(
      `${base(companyId)}/customer/${customerId}/payment`, { method: "POST", body }
    );
  },
  undoTransaction(companyId: string, transactionId: string) {
    return request<{ deleted: boolean; new_balance: number }>(
      `${base(companyId)}/transaction/${transactionId}`, { method: "DELETE" }
    );
  },

  // ── Parcela crediário ────────────────────────────────────────────
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

  /** F3-2A (29/05/2026): preview 360 para PDV checkout. */
  getCustomerPreview(companyId: string, customerId: string) {
    return request<CreditPreview>(`${base(companyId)}/customers/${customerId}/preview`);
  },

  /** F3-2B (29/05/2026): cadastro-relampago + limite inline. */
  quickCustomer(companyId: string, body: { name?: string; phone?: string; cpf_cnpj?: string; credit_limit?: number }) {
    return request<{ customer: { id: string; name: string; phone: string }; preview: CreditPreview }>(
      `${base(companyId)}/quick-customer`, { method: "POST", body }
    );
  },

  // ── Plan config (F2-2A) ─────────────────────────────────────────
  getPlanConfig(companyId: string) {
    return request<CreditPlanConfig>(`${base(companyId)}/plan-config`);
  },
  updatePlanConfig(companyId: string, body: Partial<CreditPlanConfig>) {
    return request<CreditPlanConfig>(`${base(companyId)}/plan-config`, { method: "PUT", body });
  },

  // ── Installments ────────────────────────────────────────────────
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
  /** Pagar parcela por valor livre. amount_paid omitido = saldo descoberto da parcela. */
  payInstallment(companyId: string, installmentId: string, body?: { amount_paid?: number; payment_method?: string }) {
    return request<CreditInstallment & { new_balance: number; settled: any[] }>(
      `${base(companyId)}/installments/${installmentId}/pay`, { method: "PATCH", body: body || {} }
    );
  },
  cancelInstallment(companyId: string, installmentId: string) {
    return request<CreditInstallment>(
      `${base(companyId)}/installments/${installmentId}/cancel`, { method: "PATCH", body: {} }
    );
  },

  // ── Dashboard / analytics ───────────────────────────────────────
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

  /** F3-2D (29/05/2026): A receber crediario no Financeiro. Negocio+. */
  getReceivables(companyId: string) {
    return request<FinancialReceivables>(`/companies/${companyId}/financial/receivables`);
  },

  /** Busca clientes por nome/telefone/CPF. Mínimo 2 chars. */
  searchCustomers(companyId: string, q: string): Promise<{ customers: Array<{ id: string; name: string; phone: string | null; cpf_cnpj: string | null }> }> {
    return request(`${base(companyId)}/customers/search?q=${encodeURIComponent(q)}`);
  },

  /** Cria lançamento manual no crediário (sem venda vinculada). */
  createManualEntry(companyId: string, payload: ManualEntryPayload): Promise<ManualEntryResult> {
    return request(`${base(companyId)}/manual-entry`, { method: 'POST', body: payload });
  },
};
