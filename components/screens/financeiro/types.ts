export type Transaction = {
  id: string;
  date: string;
  desc: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  status: "confirmed" | "pending";
  source: string;
  due_date?: string;
  created_at?: string;
  paid_at?: string;
};

export type DreData = {
  period: string;
  income: { category: string; amount: number }[];
  expenses: { category: string; amount: number }[];
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  marginPct: number;
};

export type WithdrawalData = {
  grossRevenue: number;
  taxes: number;
  fixedCosts: number;
  variableCosts: number;
  operationalProfit: number;
  proLabore: number;
  netProfit: number;
  suggestedWithdrawal: number;
  fatorR: number;
};

export type PeriodKey = "week" | "month" | "year" | "prev_year";

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "week", label: "Semanal" },
  { key: "month", label: "Mensal" },
  { key: "year", label: "Anual" },
  { key: "prev_year", label: "Ano Anterior" },
];

export const TABS = ["Visao Geral", "Lancamentos", "Analise", "Retirada", "Cupons"];
export const INCOME_CATS = ["Vendas", "Servicos", "Outros", "Investimentos"];
export const EXPENSE_CATS = ["Fornecedores", "Fixas", "Operacional", "Folha", "Impostos", "Marketing", "Outros"];

export const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
export const fmtK = (n: number) => n >= 1000 ? `R$ ${(n / 1000).toFixed(1).replace(".", ",")}k` : fmt(n);

export function getPeriodRange(key: PeriodKey): { start: Date; end: Date; label: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  switch (key) {
    case "week": {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { start, end: today, label: "Ultimos 7 dias" };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      return { start, end: today, label: monthName.charAt(0).toUpperCase() + monthName.slice(1) };
    }
    case "year": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start, end: today, label: String(now.getFullYear()) };
    }
    case "prev_year": {
      const y = now.getFullYear() - 1;
      return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59), label: String(y) };
    }
  }
}

export function filterByPeriod(txs: Transaction[], key: PeriodKey): Transaction[] {
  const { start, end } = getPeriodRange(key);
  return txs.filter(t => {
    const raw = (t as any).due_date || (t as any).created_at || t.date;
    if (!raw) return false;
    const d = new Date(raw);
    return d >= start && d <= end;
  });
}
