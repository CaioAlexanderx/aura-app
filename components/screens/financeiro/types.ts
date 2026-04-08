export type Transaction = {
  id: string;
  date: string;
  desc: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  status: "confirmed" | "pending";
  source: string;
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

export const TABS = ["Visao Geral", "Lancamentos", "Analise", "Retirada"];
export const INCOME_CATS = ["Vendas", "Servicos", "Outros", "Investimentos"];
export const EXPENSE_CATS = ["Fornecedores", "Fixas", "Operacional", "Folha", "Impostos", "Marketing", "Outros"];

export const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
