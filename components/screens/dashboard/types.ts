import { Colors } from "@/constants/colors";
import { Dimensions } from "react-native";

export const IS_WIDE = typeof window !== "undefined" ? window.innerWidth > 768 : Dimensions.get("window").width > 768;

export const fmt = (n: number) => `R$ ${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
export const fmtK = (n: number) => n >= 1000 ? `R$ ${(n / 1000).toFixed(1)}k` : fmt(n);
export function greeting() { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; }
export function currentMonth() { return new Date().toLocaleString("pt-BR", { month: "long" }).replace(/^\w/, c => c.toUpperCase()); }

export const MOCK_DASHBOARD = {
  revenue: 18420, expenses: 7840, net: 10580, salesToday: 1250, avgTicket: 391.91, newCustomers: 12,
  revenueDelta: 12, expensesDelta: 3, netDelta: 18,
  sparkRevenue: [12400, 13800, 15200, 14100, 16800, 17200, 18420],
  sparkExpenses: [6200, 6800, 7100, 6900, 7400, 7600, 7840],
  sparkNet: [6200, 7000, 8100, 7200, 9400, 9600, 10580],
  recentSales: [
    { id: "1", customer: "Maria Silva", amount: 156.80, time: "14:32", method: "Pix", type: "income" },
    { id: "2", customer: "Pedro Costa", amount: 89.90, time: "13:15", method: "Cartao", type: "income" },
    { id: "3", customer: "Ana Oliveira", amount: 234.50, time: "11:47", method: "Dinheiro", type: "income" },
    { id: "4", customer: "Joao Santos", amount: 67.00, time: "10:20", method: "Pix", type: "income" },
  ],
  obligations: [
    { id: "1", name: "DAS-MEI", due: "20/04/2026", amount: 76.90, status: "pending", category: "aura_resolve" },
    { id: "2", name: "DASN-SIMEI", due: "31/05/2026", amount: null, status: "future", category: "aura_facilita" },
    { id: "3", name: "FGTS", due: "07/04/2026", amount: 320.00, status: "pending", category: "aura_resolve" },
    { id: "4", name: "eSocial", due: "15/04/2026", amount: null, status: "future", category: "aura_facilita" },
  ],
};

export const EMPTY_DATA = {
  revenue: 0, expenses: 0, net: 0, salesToday: 0, avgTicket: 0, newCustomers: 0,
  revenueDelta: 0, expensesDelta: 0, netDelta: 0,
  sparkRevenue: [], sparkExpenses: [], sparkNet: [],
  recentSales: [], obligations: [],
};
