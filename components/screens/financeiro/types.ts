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
  // Sessao 22-23/04: campos novos pra editar/listar
  payment_method?: string | null;
  employee_id?: string | null;
  employee_name?: string | null;
  idempotency_key?: string | null;
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

// "today" adicionado nesta sessao — primeira opcao pra acompanhamento operacional do dia
export type PeriodKey = "today" | "all" | "week" | "month" | "year" | "prev_year" | "custom";

export var PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Dia" },
  { key: "week", label: "Semanal" },
  { key: "month", label: "Mensal" },
  { key: "year", label: "Anual" },
  { key: "prev_year", label: "Ant." },
  { key: "all", label: "Todos" },
  { key: "custom", label: "Periodo" },
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

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function getPeriodRange(key: PeriodKey, customStart?: string, customEnd?: string): { start: Date; end: Date; label: string } {
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  switch (key) {
    case "today": {
      var startD = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      var dayLabel = "Hoje, " + now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
      return { start: startD, end: today, label: dayLabel };
    }
    case "all": return { start: new Date(1970, 0, 1), end: new Date(2100, 0, 1), label: "Todos os lancamentos" };
    case "week": {
      var start = new Date(today); start.setDate(today.getDate() - 6); start.setHours(0, 0, 0, 0);
      return { start: start, end: today, label: "Ultimos 7 dias" };
    }
    case "month": {
      var startM = new Date(now.getFullYear(), now.getMonth(), 1);
      var monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      return { start: startM, end: today, label: monthName.charAt(0).toUpperCase() + monthName.slice(1) };
    }
    case "year": return { start: new Date(now.getFullYear(), 0, 1), end: today, label: String(now.getFullYear()) };
    case "prev_year": { var y = now.getFullYear() - 1; return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59), label: String(y) }; }
    case "custom": {
      if (customStart && customEnd) {
        var s = new Date(customStart + "T00:00:00"); var e = new Date(customEnd + "T23:59:59");
        var sl = s.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        var el = e.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        return { start: s, end: e, label: sl + " a " + el };
      }
      return getPeriodRange("month");
    }
  }
}

// F-10: calcula o periodo anterior equivalente pra comparacao
export function getPreviousPeriodRange(key: PeriodKey, customStart?: string, customEnd?: string): { start: Date; end: Date } | null {
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  switch (key) {
    case "today": {
      var yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      var yestEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      return { start: yest, end: yestEnd };
    }
    case "all": return null;
    case "week": {
      var end = new Date(today); end.setDate(today.getDate() - 7);
      var start = new Date(end); start.setDate(end.getDate() - 6); start.setHours(0, 0, 0, 0);
      return { start: start, end: end };
    }
    case "month": {
      var pm = now.getMonth() - 1; var py = now.getFullYear();
      if (pm < 0) { pm = 11; py--; }
      return { start: new Date(py, pm, 1), end: new Date(py, pm + 1, 0, 23, 59, 59) };
    }
    case "year": {
      var prevY = now.getFullYear() - 1;
      return { start: new Date(prevY, 0, 1), end: new Date(prevY, 11, 31, 23, 59, 59) };
    }
    case "prev_year": return null;
    case "custom": {
      if (customStart && customEnd) {
        var s = new Date(customStart + "T00:00:00"); var e = new Date(customEnd + "T23:59:59");
        var diff = e.getTime() - s.getTime();
        var prevEnd = new Date(s.getTime() - 86400000); prevEnd.setHours(23, 59, 59);
        var prevStart = new Date(prevEnd.getTime() - diff); prevStart.setHours(0, 0, 0, 0);
        return { start: prevStart, end: prevEnd };
      }
      return null;
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
