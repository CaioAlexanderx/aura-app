// ============================================================
// AURA. — Multi-CNPJ Sessao 2: services /me/* consolidados
//
// Wrapper dos endpoints agregados do backend (meAggregates.js).
// Usado quando consolidatedView=true no auth store.
//
// Onda 2.1: /me/dashboard
// Onda 2.2: /me/transactions
// Onda 2.3 (atual): /me/customers — lista UNICA owner-scoped
// Proximas: /me/sales, /me/appointments
// ============================================================
import { request } from "@/services/api";

// ──────────────────────────────────────────────────────────
// /me/dashboard — Onda 2.1
// ──────────────────────────────────────────────────────────
export type DashboardBreakdown = {
  company_id: string;
  company_name: string;
  is_primary: boolean;
  revenue: number;
  expenses: number;
  net: number;
  pending_income: number;
  pending_expenses: number;
  sales_count_month: number;
  sales_today: number;
};

export type ConsolidatedSale = {
  id: string;
  customer: string;
  amount: number;
  time: string;
  method: string;
  type?: string;
  company_id?: string;
  company_name?: string;
};

export type ConsolidatedObligation = {
  id: string;
  name: string;
  due: string;
  amount: number | null;
  status: string;
  category: string;
  company_id?: string;
  company_name?: string;
};

export type DashboardConsolidatedResponse = {
  revenue: number;
  salesCountMonth: number;
  avgTicket: number;
  salesToday: number;
  salesCountToday: number;
  revenueDelta: number;

  cashInflow: number;
  expenses: number;
  net: number;
  pendingIncome: number;
  pendingExpenses: number;
  expensesDelta: number;
  netDelta: number;

  newCustomers: number;
  sparkRevenue: number[];
  sparkExpenses: number[];
  sparkNet: number[];
  recentSales: ConsolidatedSale[];
  obligations: ConsolidatedObligation[];

  breakdown: DashboardBreakdown[];
  company_count: number;
};

// ──────────────────────────────────────────────────────────
// /me/transactions — Onda 2.2
// ──────────────────────────────────────────────────────────
export type TransactionFilters = {
  start?: string;
  end?: string;
  type?: "income" | "expense";
  status?: "confirmed" | "pending";
  q?: string;
  limit?: number;
  offset?: number;
  company_id?: string;
};

export type ConsolidatedTransaction = {
  id: string;
  type: "income" | "expense";
  amount: number;
  desc: string;
  description: string;
  category: string;
  status: "confirmed" | "pending";
  notes: string;
  date: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string | null;
  recurrence_type: string | null;
  recurrence_group_id: string | null;
  recurrence_index: number | null;
  payment_method: string | null;
  employee_id: string | null;
  employee_name: string | null;
  idempotency_key: string | null;
  source: "pdv" | "manual";
  company_id: string;
  company_name: string;
};

export type TransactionsBreakdown = {
  company_id: string;
  company_name: string;
  is_primary: boolean;
  income: number;
  expenses: number;
  net: number;
  pending_income: number;
  pending_expenses: number;
};

export type TransactionsConsolidatedResponse = {
  transactions: ConsolidatedTransaction[];
  total: number;
  limit: number;
  offset: number;
  summary: {
    income: number;
    expenses: number;
    pending_income: number;
    pending_expenses: number;
  };
  breakdown: TransactionsBreakdown[];
  company_count: number;
  filtered_company_id: string | null;
};

// ──────────────────────────────────────────────────────────
// /me/customers — Onda 2.3
// ──────────────────────────────────────────────────────────
export type CustomerFilters = {
  search?: string;
  limit?: number;
  offset?: number;
};

export type ConsolidatedCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf_cnpj: string;
  birthday: string;
  birth_date: string | null;
  instagram: string;
  instagram_handle: string;
  total_spent: number;
  totalSpent: number;
  visits: number;
  visit_count: number;
  last_purchase: string | null;
  first_visit: string | null;
  notes: string;
  is_active: boolean;
  rating: number | null;
  created_at: string | null;
  // Multi-CNPJ
  company_id: string;
  company_name: string;
};

export type CustomersConsolidatedResponse = {
  customers: ConsolidatedCustomer[];
  total: number;
  limit: number;
  offset: number;
  plan_limit: number;
  company_count: number;
};

export var meAggregatesApi = {
  // GET /me/dashboard — KPIs consolidados de todas as empresas do user.
  dashboard: function () {
    return request<DashboardConsolidatedResponse>("/me/dashboard", { retry: 1 });
  },

  // GET /me/transactions — Lista paginada agregada com filtros opcionais.
  // Passar `company_id` faz drill-down dentro do consolidado (sem trocar JWT).
  transactions: function (filters?: TransactionFilters) {
    var qs: string[] = [];
    if (filters?.start) qs.push("start=" + encodeURIComponent(filters.start));
    if (filters?.end) qs.push("end=" + encodeURIComponent(filters.end));
    if (filters?.type) qs.push("type=" + filters.type);
    if (filters?.status) qs.push("status=" + filters.status);
    if (filters?.q) qs.push("q=" + encodeURIComponent(filters.q));
    if (filters?.limit) qs.push("limit=" + filters.limit);
    if (filters?.offset) qs.push("offset=" + filters.offset);
    if (filters?.company_id) qs.push("company_id=" + encodeURIComponent(filters.company_id));
    var suffix = qs.length ? "?" + qs.join("&") : "";
    return request<TransactionsConsolidatedResponse>("/me/transactions" + suffix, { retry: 1 });
  },

  // GET /me/customers — Lista UNICA owner-scoped (Onda 2.3).
  // Decisao de produto: clientes sao do dono, nao da loja. Lista unica
  // entre todos os CNPJs do mesmo owner. company_id em cada item indica
  // a loja onde foi cadastrado (info pra UI mostrar badge).
  customers: function (filters?: CustomerFilters) {
    var qs: string[] = [];
    if (filters?.search) qs.push("search=" + encodeURIComponent(filters.search));
    if (filters?.limit) qs.push("limit=" + filters.limit);
    if (filters?.offset) qs.push("offset=" + filters.offset);
    var suffix = qs.length ? "?" + qs.join("&") : "";
    return request<CustomersConsolidatedResponse>("/me/customers" + suffix, { retry: 1 });
  },
};
