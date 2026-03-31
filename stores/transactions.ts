import { create } from "zustand";

export type TransactionType = "income" | "expense";

export type Transaction = {
  id: string;
  date: string;
  desc: string;
  type: TransactionType;
  category: string;
  amount: number;
  status: "confirmed" | "pending";
  source?: "manual" | "pdv" | "folha" | "estoque" | "lote";
};

const INITIAL: Transaction[] = [
  { id: "1", date: "29/03", desc: "Venda PDV #0047", type: "income", category: "Vendas", amount: 156.80, status: "confirmed", source: "pdv" },
  { id: "2", date: "29/03", desc: "Fornecedor - Distribuidora ABC", type: "expense", category: "Fornecedores", amount: 420.00, status: "confirmed", source: "manual" },
  { id: "3", date: "28/03", desc: "Venda PDV #0046", type: "income", category: "Vendas", amount: 89.90, status: "confirmed", source: "pdv" },
  { id: "4", date: "28/03", desc: "Aluguel sala comercial", type: "expense", category: "Fixas", amount: 1200.00, status: "confirmed", source: "manual" },
  { id: "5", date: "27/03", desc: "Venda PDV #0045", type: "income", category: "Vendas", amount: 234.50, status: "confirmed", source: "pdv" },
  { id: "6", date: "27/03", desc: "Energia CPFL", type: "expense", category: "Fixas", amount: 187.30, status: "pending", source: "manual" },
  { id: "7", date: "26/03", desc: "Venda PDV #0044", type: "income", category: "Vendas", amount: 67.00, status: "confirmed", source: "pdv" },
  { id: "8", date: "26/03", desc: "Material de limpeza", type: "expense", category: "Operacional", amount: 45.90, status: "confirmed", source: "manual" },
];

type TransactionStore = {
  transactions: Transaction[];
  add: (t: Omit<Transaction, "id">) => void;
  addBatch: (items: Omit<Transaction, "id">[]) => void;
  // FE-21: Auto-accounting helpers
  addFromPDV: (desc: string, amount: number) => void;
  addFromFolha: (desc: string, amount: number) => void;
  addFromEstoque: (desc: string, amount: number) => void;
  totals: () => { income: number; expense: number; balance: number };
};

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function today() { const d = new Date(); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"); }

export const useTransactions = create<TransactionStore>((set, get) => ({
  transactions: INITIAL,

  add: (t) => set({ transactions: [{ ...t, id: genId() }, ...get().transactions] }),

  addBatch: (items) => {
    const newTxs = items.map(t => ({ ...t, id: genId() }));
    set({ transactions: [...newTxs, ...get().transactions] });
  },

  // FE-21: PDV sale auto-creates income transaction
  addFromPDV: (desc, amount) => {
    const t: Transaction = { id: genId(), date: today(), desc, type: "income", category: "Vendas", amount, status: "confirmed", source: "pdv" };
    set({ transactions: [t, ...get().transactions] });
  },

  // FE-21: Payroll auto-creates expense transaction
  addFromFolha: (desc, amount) => {
    const t: Transaction = { id: genId(), date: today(), desc, type: "expense", category: "Folha", amount, status: "confirmed", source: "folha" };
    set({ transactions: [t, ...get().transactions] });
  },

  // FE-21: Stock purchase auto-creates expense transaction
  addFromEstoque: (desc, amount) => {
    const t: Transaction = { id: genId(), date: today(), desc, type: "expense", category: "Fornecedores", amount, status: "confirmed", source: "estoque" };
    set({ transactions: [t, ...get().transactions] });
  },

  totals: () => {
    const txs = get().transactions;
    const income = txs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense };
  },
}));
