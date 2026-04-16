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

export type PeriodKey = "all" | "week" | "month" | "year" | "prev_year";

export var PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "week", label: "Semanal" },
  { key: "month", label: "Mensal" },
  { key: "year", label: "Anual" },
  { key: "prev_year", label: "Ano Anterior" },
];

export var TABS = ["Visao Geral", "Lancamentos", "Analise", "Retirada", "Cupons"];
export var INCOME_CATS = ["Vendas", "Servicos", "Outros", "Investimentos"];
export var EXPENSE_CATS = ["Fornecedores", "Fixas", "Operacional", "Folha", "Impostos", "Marketing", "Outros"];

export function fmt(n: number): string {
  return "R$ " + round2(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function fmtK(n: number): string {
  return n >= 1000 ? "R$ " + (n / 1000).toFixed(1).replace(".", ",") + "k" : fmt(n);
}

/** Round to 2 decimal places - prevents 3-decimal display bug */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function getPeriodRange(key: PeriodKey): { start: Date; end: Date; label: string } {
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  switch (key) {
    case "all": {
      return { start: new Date(1970, 0, 1), end: new Date(2100, 0, 1), label: "Todos os lancamentos" };
    }
    case "week": {
      var start = new Date(today);
      start.setDate(today.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { start: start, end: today, label: "Ultimos 7 dias" };
    }
    case "month": {
      var startM = new Date(now.getFullYear(), now.getMonth(), 1);
      var monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      return { start: startM, end: today, label: monthName.charAt(0).toUpperCase() + monthName.slice(1) };
    }
    case "year": {
      var startY = new Date(now.getFullYear(), 0, 1);
      return { start: startY, end: today, label: String(now.getFullYear()) };
    }
    case "prev_year": {
      var y = now.getFullYear() - 1;
      return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59), label: String(y) };
    }
  }
}

export function filterByPeriod(txs: Transaction[], key: PeriodKey): Transaction[] {
  if (key === "all") return txs;
  var range = getPeriodRange(key);
  return txs.filter(function(t) {
    var raw = (t as any).due_date || (t as any).created_at || t.date;
    if (!raw) return false;
    var d = new Date(raw);
    return d >= range.start && d <= range.end;
  });
}
