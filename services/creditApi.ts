// ============================================================
// AURA. — Crediário API client
// F2/F3 (05/06/2026): CreditAccount, termos por cliente,
//   receivePayment com account_id/allocations, createAccount,
//   updateCustomerTerms.
// Fase 1 FE (07/06/2026): score_label, available_limit,
//   score_warning em CreditProfile; account_id em CreditInstallment;
//   period_unit/period_count/score_warn_min em CreditPlanConfig;
//   helper printCarne (fetch + document.write, auth obrigatória).
// Fase 2 FE (08/06/2026): late_charges_enabled/late_grace_days em
//   CreditPlanConfig; charges_total/days_overdue/days_charged/total_due
//   em CreditInstallment; charges_paid/charges_detail em ReceivePaymentResult.
// fix (08/06/2026): editInstallmentDueDate — URL corrigida para base(companyId),
//   body corrigido (não mais double-stringificado); valorAPagarParcela exportada.
// DESIGN-38 FE (11/06/2026): timeline B1 (getHistoryTimeline), recebimento de
//   valor livre B3 (previewPayment + receiveFreePayment, shape preview===aplicação),
//   Pix EMV B2 (getInstallmentPix + getFreePix), devolução B4 (refundSale) e
//   recibo B5 (printReceipt, mesmo padrão auth do printCarne).
//   overdue/next_due_date em CreditBalanceItem (vêm de /balances, Aura-backend#187).
// fix (11/06/2026): A3-FE Idempotency-Key via header nos POST de dinheiro.
// ============================================================
import { request, BASE_URL } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

// ─── Fiado (legado) ────────────────────────────────────────────────────────
export type CreditBalanceItem = {
  id: string; name: string; phone: string | null; cpf_cnpj: string | null;
  balance: number; total_debited: number; total_paid: number; last_activity_at: string | null;
  // DESIGN-38: atraso calculado por data (SP tz) no backend /balances.
  // Opcionais — respostas antigas podem não trazer.
  overdue?: boolean;
  next_due_date?: string | null;
};
export type CreditTransaction = {
  id: string; sale_id: string | null; type: "debit" | "payment" | "refund";
  amount: number; payment_method: string | null; notes: string | null; created_at: string;
  account_id?: string | null;
  account_name?: string | null;
};

// ─── F3: Carnê / conta ────────────────────────────────────────────────────────
export type CreditAccount = {
  id: string | null;           // null = conta geral legado
  name: string;
  status: "open" | "closed";
  balance: number;
  open_count: number;
  next_due_date: string | null;
  overdue: boolean;
  period_unit: "day" | "week" | "month";
  period_count: number;
};

export type CreditCustomerDetail = {
  customer: { id: string; name: string; phone: string; cpf_cnpj: string };
  balance: number; total_debited: number; total_paid: number;
  last_activity_at: string | null; transactions: CreditTransaction[];
  open_installments?: CreditInstallment[];
  accounts?: CreditAccount[];
};

// ─── Parcelado ───────────────────────────────────────────────────────────────
export type ScoreLabel = "premium" | "bom" | "regular" | "restrito" | "bloqueado";

// ─── F2: Termos por cliente ───────────────────────────────────────────────
export type CustomerTermsOverrides = {
  interest_rate: number | null;
  max_installments: number | null;
  period_unit: "day" | "week" | "month" | null;
  period_count: number | null;
  due_day: number | null;
  late_fee_rate: number | null;
  late_interest_daily: number | null;
};
export type CustomerTermsEffective = {
  interest_rate: number;
  max_installments: number;
  period_unit: "day" | "week" | "month";
  period_count: number;
  due_day: number | null;
  late_fee_rate: number;
  late_interest_daily: number;
};
export type CustomerTerms = {
  overrides: CustomerTermsOverrides;
  effective: CustomerTermsEffective;
};

// ─── Fase 1: score_warning ───────────────────────────────────────────────────────
export type ScoreWarning = {
  below_min: true;
  threshold: number;
  actual: number;
};

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
  terms?: CustomerTerms;
  // Fase 1 FE — campos novos (podem vir undefined em respostas antigas)
  score_label?: string | null;
  available_limit?: number;
  score_warning?: ScoreWarning | null;
};

export type PeriodUnit = "day" | "week" | "month";

export type CreditPlanConfig = {
  company_id: string; max_installments: number;
  min_installment_value: number; interest_rate: number;
  late_fee_rate: number; late_interest_daily: number;
  /** @deprecated use score_warn_min instead */
  require_score_min?: number;
  auto_block_days: number;
  period_unit?: PeriodUnit;
  period_count?: number;
  /** Fase 1: aviso quando score < score_warn_min. Nunca bloqueia — só alerta. */
  score_warn_min?: number | null;
  // ── Fase 2: encargos por atraso (opt-in, default OFF) ──────
  /** Liga/desliga cobrança de mora+multa em parcelas vencidas. Default false. */
  late_charges_enabled?: boolean;
  /**
   * Carência em dias após o vencimento antes de aplicar encargos.
   * Default 3. Só relevante quando late_charges_enabled = true.
   */
  late_grace_days?: number;
  // late_fee_rate e late_interest_daily já existiam acima.
  // late_fee_rate  = multa única (decimal, ex.: 0.02 = 2%).
  // late_interest_daily = mora ao dia (decimal, ex.: 0.000333... = 1%/mês).
};

export type CreditInstallment = {
  id: string; sale_id: string | null; customer_id: string; company_id: string;
  installment_number: number; total_installments: number;
  amount_due: number; amount_paid: number;
  covered_amount: number;
  remaining?: number;
  due_date: string; paid_at: string | null;
  status: "pending" | "paid" | "overdue" | "cancelled";
  pix_link: string | null; late_fee: number; late_interest: number;
  collection_stage: number;
  customer_name?: string; customer_phone?: string;
  // Fase 1 FE: account_id pode vir undefined em respostas antigas — tratar como null
  account_id?: string | null;
  // ── Fase 2: encargos calculados pelo backend (undefined = capability OFF) ──
  /** Total de encargos (multa + mora) sobre esta parcela. Undefined quando capability OFF. */
  charges_total?: number;
  /** Dias de atraso na data do cálculo. Undefined quando capability OFF. */
  days_overdue?: number;
  /** Dias efetivamente cobrados (após carência). Undefined quando capability OFF. */
  days_charged?: number;
  /** Principal restante + charges_total. Undefined quando capability OFF. */
  total_due?: number;
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
  pix_key?: string | null;
  rules: Array<{
    id: string; name: string; days_relative: number;
    template: string; channel: string; enabled: boolean;
  }>;
};

export type CreditPreview = {
  balance: number;
  open_installments_count: number;
  overdue_count: number;
  next_due_date: string | null;
  score: number;
  score_label: ScoreLabel;
  credit_limit: number;
  credit_used: number;
  over_limit: boolean;
  status: "active" | "blocked";
  blocked_reason: string | null;
};

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

// ─── B1 (DESIGN-38): Histórico unificado (timeline paginada) ──────
export type CreditHistoryEvent = {
  id: string;
  type: "purchase" | "manual_debit" | "payment" | "exchange_credit" | "refund";
  occurred_at: string;
  /** centavos/decimal; débito > 0, pagamento/crédito < 0 (convenção do ledger). */
  amount: number;
  sale_id: string | null;
  account_id: string | null;
  items?: Array<{ product_name: string; quantity: number; unit_price: number; total: number }> | null;
  payment?: { method: string | null } | null;
  meta?: Record<string, any>;
};
export type CreditHistoryPage = { events: CreditHistoryEvent[]; next_cursor: string | null };

// ─── B3 (DESIGN-38): Recebimento de valor livre (preview === aplicação) ──
export type PaymentPlanLine = {
  installment_id: string; account_id: string | null; number: number | null;
  charges_paid: number; principal_paid: number; status_after: string | null;
};
/** Shape canônico: o GET /payments/preview e o POST /payments retornam isto. */
export type PaymentPlan = { applied: PaymentPlanLine[]; new_balance: number; credit_generated: number };

// ─── B2 (DESIGN-38): Pix EMV por parcela / valor livre ───────────
export type CreditPix = {
  emv: string; amount: number; key_type: string | null; merchant_name: string;
  installment?: { id: string; number: number; due_date: string; account_id: string | null };
};

// ─── B4 (DESIGN-38): Devolução de venda no crediário ─────────────
export type RefundResult = {
  devolucao_sale_id: string;
  refund_value: number;
  abated_installments: Array<{
    installment_id: string; number: number;
    action: "cancelled" | "reduced"; amount: number; new_amount_due?: number;
  }>;
  credit_generated: number;
  new_balance: number;
  stock_restored: Array<{ product_id: string; variant_id: string | null; quantity: number }>;
};

// ─── Lançamento manual ──────────────────────────────────────────────────────
export type ManualEntryPayload = {
  customer_id?: string;
  new_customer?: { name: string; phone: string };
  amount: number;
  installments?: number;
  interest_rate?: number;
  first_due_date?: string;
  entry_date?: string;
  period_unit?: PeriodUnit;
  period_count?: number;
  description?: string;
  account_id?: string | null;       // F3: carnê existente
  new_account_name?: string;        // F3: criar carnê inline
};

export type ManualEntryResult = {
  customer: { id: string; name: string };
  transaction: { id: string; amount: number; type: string; notes: string; created_at: string };
  installments: CreditInstallment[];
  new_balance: number;
  account_id: string | null;
};

// ─── Recebimento (F3) ───────────────────────────────────────────────────────
export type PaymentAllocation = { account_id: string | null; amount: number };
export type ReceivePaymentBody =
  | { amount: number; payment_method?: string; notes?: string; paid_at?: string; account_id?: string | null }
  | { payment_method?: string; paid_at?: string; allocations: PaymentAllocation[] };

export type ReceivePaymentResult = {
  mode: "global" | "account" | "allocations";
  account_id?: string | null;
  transaction?: CreditTransaction;
  new_balance: number;
  settled_receivables?: any[];
  allocations?: Array<{
    account_id: string | null;
    amount: number;
    transaction: CreditTransaction | null;
    settled: any[];
  }>;
  notes?: string | null;
  legacy_amount?: number;
  // ── Fase 2: encargos quitados (undefined quando capability OFF) ──
  /** Total de encargos (multa+mora) quitados neste recebimento. */
  charges_paid?: number;
  /** Detalhe por parcela. */
  charges_detail?: Array<{
    installment_id: string;
    late_fee: number;
    late_interest: number;
  }>;
};

// ─── Novo carnê ─────────────────────────────────────────────────────────
export type CreateAccountBody = {
  name: string;
  interest_rate?: number;
  period_unit?: PeriodUnit;
  period_count?: number;
  due_day?: number;
  max_installments?: number;
  late_fee_rate?: number;
  late_interest_daily?: number;
};

// ─── Fase 1: Print carnê (autenticado) ───────────────────────
// ARMADILHA: GET /print/credit/:cid/carne exige Authorization header.
// window.open() direto dá "Token não fornecido".
// Solução: fetch com Bearer token → texto HTML → document.write em nova janela.
export async function printCarne(companyId: string, customerId: string): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const token = useAuthStore.getState().token;
  const url = BASE_URL + "/companies/" + companyId + "/print/credit/" + customerId + "/carne";
  let win: Window | null = null;
  try {
    win = window.open("", "_blank");
    if (!win) { alert("Permita pop-ups para imprimir o carnê."); return; }
    win.document.write("<html><body style='font-family:sans-serif;padding:24px'>Carregando carnê...</body></html>");

    const resp = await fetch(url, {
      headers: token ? { Authorization: "Bearer " + token } : {},
    });
    if (!resp.ok) {
      win.document.write("<html><body>Erro ao carregar carnê (" + resp.status + ").</body></html>");
      return;
    }
    const html = await resp.text();
    win.document.open();
    win.document.write(html);
    win.document.close();
    // Dispara print depois que o HTML renderizou
    setTimeout(() => {
      try { win?.focus(); win?.print(); } catch {}
    }, 400);
  } catch (err) {
    if (win) {
      win.document.open();
      win.document.write("<html><body>Erro de conexão ao carregar carnê.</body></html>");
      win.document.close();
    }
  }
}

// ─── B5 (DESIGN-38): Print recibo de pagamento (autenticado) ──────
// Mesmo padrão do printCarne: GET /print/credit/receipts/:txId exige Bearer.
export async function printReceipt(companyId: string, transactionId: string): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const token = useAuthStore.getState().token;
  const url = BASE_URL + "/companies/" + companyId + "/print/credit/receipts/" + transactionId;
  let win: Window | null = null;
  try {
    win = window.open("", "_blank");
    if (!win) { alert("Permita pop-ups para imprimir o recibo."); return; }
    win.document.write("<html><body style='font-family:sans-serif;padding:24px'>Carregando recibo...</body></html>");

    const resp = await fetch(url, {
      headers: token ? { Authorization: "Bearer " + token } : {},
    });
    if (!resp.ok) {
      win.document.write("<html><body>Erro ao carregar recibo (" + resp.status + ").</body></html>");
      return;
    }
    const html = await resp.text();
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      try { win?.focus(); win?.print(); } catch {}
    }, 400);
  } catch (err) {
    if (win) {
      win.document.open();
      win.document.write("<html><body>Erro de conexão ao carregar recibo.</body></html>");
      win.document.close();
    }
  }
}

// ─── Entrega 2: fonte Única de "valor a pagar" de uma parcela ────────────────
/**
 * Valor canônico "a pagar" de uma parcela: principal em aberto + encargos (se houver).
 * total_due já = (amount_due - covered_amount) + mora/multa; cai no principal quando encargos OFF.
 * NUNCA usar amount_due cheio (ignora pagamento parcial).
 */
export function valorAPagarParcela(inst: CreditInstallment): number {
  const rem = inst.remaining ?? (Number(inst.amount_due || 0) - Number(inst.covered_amount || 0));
  return Number(inst.total_due ?? rem);
}

const base = (companyId: string) => `/companies/${companyId}/credit`;

export const creditApi = {
  // ── Fiado (legado) ────────────────────────────────────────────────────────────────
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
  receivePayment(companyId: string, customerId: string, body: ReceivePaymentBody) {
    // A3-FE: Idempotency-Key via custom header to prevent double-debits on retry
    const idempKey = "rp-" + companyId + "-" + customerId + "-" + Date.now();
    return request<ReceivePaymentResult>(
      `${base(companyId)}/customer/${customerId}/payment`, { method: "POST", body, headers: { "Idempotency-Key": idempKey } }
    );
  },
  undoTransaction(companyId: string, transactionId: string) {
    return request<{ deleted: boolean; new_balance: number }>(
      `${base(companyId)}/transaction/${transactionId}`, { method: "DELETE" }
    );
  },

  // ── Perfil parcelado ────────────────────────────────────────────────────────────────
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

  // ── F2: Termos por cliente ─────────────────────────────────────────────────────────────
  updateCustomerTerms(companyId: string, customerId: string, body: Partial<CustomerTermsOverrides> | null) {
    return request<CreditProfile>(
      `${base(companyId)}/customers/${customerId}/terms`,
      { method: "PUT", body: body ?? null }
    );
  },

  // ── F3: Carnês ───────────────────────────────────────────────────────────────────
  createAccount(companyId: string, customerId: string, body: CreateAccountBody) {
    return request<{ account: CreditAccount }>(
      `${base(companyId)}/customer/${customerId}/accounts`,
      { method: "POST", body }
    );
  },

  // ── Preview / quick customer ─────────────────────────────────────────────────────────────
  getCustomerPreview(companyId: string, customerId: string) {
    return request<CreditPreview>(`${base(companyId)}/customers/${customerId}/preview`);
  },
  quickCustomer(companyId: string, body: { name?: string; phone?: string; cpf_cnpj?: string; credit_limit?: number }) {
    return request<{ customer: { id: string; name: string; phone: string }; preview: CreditPreview }>(
      `${base(companyId)}/quick-customer`, { method: "POST", body }
    );
  },

  // ── Plan config ───────────────────────────────────────────────────────────────────
  getPlanConfig(companyId: string) {
    return request<CreditPlanConfig>(`${base(companyId)}/plan-config`);
  },
  updatePlanConfig(companyId: string, body: Partial<CreditPlanConfig>) {
    return request<CreditPlanConfig>(`${base(companyId)}/plan-config`, { method: "PUT", body });
  },

  // ── Installments ─────────────────────────────────────────────────────────────────────
  createInstallments(companyId: string, body: {
    customer_id: string; sale_id?: string; total_amount: number;
    installments: number; first_due_date: string;
    period_unit?: PeriodUnit; period_count?: number;
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
  // fix (08/06/2026): URL corrigida para base(companyId)/installments/...
  // e body passado como objeto puro (request() já faz JSON.stringify internamente —
  // passar JSON.stringify(...) causava double-stringify e due_date chegava undefined).
  editInstallmentDueDate(companyId: string, installmentId: string, dueDate: string) {
    return request<{ success: boolean; updated_count: number }>(
      `${base(companyId)}/installments/${installmentId}/due-date`,
      { method: "PATCH", body: { due_date: dueDate } }
    );
  },

  // ── Dashboard / analytics ────────────────────────────────────────────────────────────────
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

  getReceivables(companyId: string) {
    return request<FinancialReceivables>(`/companies/${companyId}/financial/receivables`);
  },

  searchCustomers(companyId: string, q: string): Promise<{ customers: Array<{ id: string; name: string; phone: string | null; cpf_cnpj: string | null }> }> {
    return request(`${base(companyId)}/customers/search?q=${encodeURIComponent(q)}`);
  },

  createManualEntry(companyId: string, payload: ManualEntryPayload): Promise<ManualEntryResult> {
    return request(`${base(companyId)}/manual-entry`, { method: 'POST', body: payload });
  },

  // ── B1 (DESIGN-38): Histórico unificado (timeline paginada por cursor) ──
  getHistoryTimeline(companyId: string, customerId: string, opts?: { limit?: number; cursor?: string; types?: string }) {
    const qs = new URLSearchParams();
    if (opts?.limit) qs.set("limit", String(opts.limit));
    if (opts?.cursor) qs.set("cursor", opts.cursor);
    if (opts?.types) qs.set("types", opts.types);
    const tail = qs.toString() ? `?${qs}` : "";
    return request<CreditHistoryPage>(`${base(companyId)}/customers/${customerId}/history${tail}`);
  },

  // ── B3 (DESIGN-38): Recebimento de valor livre (preview + aplicação) ──
  // previewPayment é READ-ONLY (dry-run). receiveFreePayment aplica.
  // Mesmo shape (PaymentPlan) nos dois — garantia preview === aplicação.
  previewPayment(companyId: string, customerId: string, opts: { amount: number; account_id?: string | null; paid_at?: string }) {
    const qs = new URLSearchParams();
    qs.set("amount", String(opts.amount));
    if (opts.account_id) qs.set("account_id", opts.account_id);
    if (opts.paid_at) qs.set("paid_at", opts.paid_at);
    return request<PaymentPlan>(`${base(companyId)}/customers/${customerId}/payments/preview?${qs}`);
  },
  receiveFreePayment(companyId: string, customerId: string, body: { amount: number; account_id?: string | null; method?: string; paid_at?: string }) {
    // A3-FE: Idempotency-Key via custom header to prevent double-debits on retry
    const idempKey = "rfp-" + companyId + "-" + customerId + "-" + Date.now();
    return request<PaymentPlan>(`${base(companyId)}/customers/${customerId}/payments`, { method: "POST", body, headers: { "Idempotency-Key": idempKey } });
  },

  // ── B2 (DESIGN-38): Pix EMV (copia-e-cola) — QR é gerado no front ──
  getInstallmentPix(companyId: string, installmentId: string) {
    return request<CreditPix>(`${base(companyId)}/installments/${installmentId}/pix`);
  },
  getFreePix(companyId: string, customerId: string, amount: number) {
    return request<CreditPix>(`${base(companyId)}/customers/${customerId}/pix?amount=${encodeURIComponent(String(amount))}`);
  },

  // ── B4 (DESIGN-38): Devolução de venda no crediário ──
  refundSale(companyId: string, saleId: string, body: { items: Array<{ sale_item_id: string; quantity: number }>; reason?: string }) {
    return request<RefundResult>(`${base(companyId)}/sales/${saleId}/refund`, { method: "POST", body });
  },
};
