// ============================================================
// AURA. — Multi-CNPJ Sessao 2: services /me/* consolidados
//
// Wrapper dos endpoints agregados do backend (meAggregates.js).
// Usado quando consolidatedView=true no auth store.
//
// Onda 2.1 (atual): /me/dashboard
// Proximas: /me/transactions, /me/customers, /me/sales, /me/appointments
// ============================================================
import { request } from "@/services/api";

// Item do breakdown por empresa (Multi-CNPJ Onda 2.1)
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

// Mesma shape do GET /companies/:id/dashboard + breakdown[] + company_count.
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

  // Multi-CNPJ Onda 2.1
  breakdown: DashboardBreakdown[];
  company_count: number;
};

export var meAggregatesApi = {
  // GET /me/dashboard — KPIs consolidados de todas as empresas do user.
  // Retorna mesma shape do per-company + breakdown[] pra UI mostrar split.
  dashboard: function () {
    return request<DashboardConsolidatedResponse>("/me/dashboard", { retry: 1 });
  },
};
