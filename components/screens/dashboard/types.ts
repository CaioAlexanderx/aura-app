import { Colors } from "@/constants/colors";
import { Dimensions, Platform } from "react-native";

export const IS_WEB = Platform.OS === "web";
export const IS_WIDE = typeof window !== "undefined" ? window.innerWidth > 768 : Dimensions.get("window").width > 768;

export const fmt = (n: number) => `R$ ${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
export const fmtK = (n: number) => n >= 1000 ? `R$ ${(n / 1000).toFixed(1)}k` : fmt(n);
export const fmtInt = (n: number) => (n || 0).toLocaleString("pt-BR");
export function greeting() { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; }

// ── Fuso do Brasil ─────────────────────────────────────────
// 01/09/2026: a virada do mês tem que acontecer no fuso do Brasil. Em UTC,
// 21h do dia 31 já é dia 1º do mês seguinte — o Painel trocava de mês três
// horas antes pra quem está aqui. Todo cálculo de mês/dia do Painel passa
// por brToday(), nunca por new Date().getMonth() direto.
export const BR_TZ = "America/Sao_Paulo";

export type BRDate = { year: number; month: number; day: number };

/** Ano/mês/dia de "agora" no fuso do Brasil (month é 1-12, não 0-11). */
export function brToday(base?: Date): BRDate {
  const d = base || new Date();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: BR_TZ, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(d);
    const pick = (t: string) => {
      const found = parts.filter(p => p.type === t)[0];
      return found ? parseInt(found.value, 10) : NaN;
    };
    const year = pick("year"), month = pick("month"), day = pick("day");
    if (year && month && day) return { year: year, month: month, day: day };
  } catch (e) {
    // Intl sem base de fusos (Hermes sem ICU completo) — cai no offset fixo.
  }
  // Fallback: o Brasil não tem mais horário de verão desde 2019, então
  // UTC-3 é constante e chega no mesmo dia que o Intl daria.
  const br = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return { year: br.getUTCFullYear(), month: br.getUTCMonth() + 1, day: br.getUTCDate() };
}

const MESES_BR = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Nome do mês em pt-BR (month 1-12). Capitalizado por padrão. */
export function monthNameBR(month: number, capitalized = true): string {
  const name = MESES_BR[(((month - 1) % 12) + 12) % 12] || "";
  return capitalized ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}

/** Mês anterior a um {year, month} (1-12), virando o ano quando month = 1. */
export function previousMonthOf(d: { year: number; month: number }): { year: number; month: number } {
  return d.month === 1 ? { year: d.year - 1, month: 12 } : { year: d.year, month: d.month - 1 };
}

/** Quantos dias tem o mês (month 1-12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Nome do mês corrente no fuso do Brasil, capitalizado. */
export function currentMonth() { return monthNameBR(brToday().month); }

// ── Painel vazio: "conta nova" x "mês novo" ─────────────────────
// 01/09/2026 — QA da virada do mês. O critério do estado vazio era só "mês
// atual sem movimento", mas o texto era de onboarding de conta nova: toda
// lojista com histórico via "Bem-vindo!" todo dia 1º e achava que os dados
// tinham sumido. Agora o estado vazio olha o histórico antes de escolher o
// que dizer — e o caso "conta nova" segue com o onboarding de sempre.
export type EmptyDashboardKind = "carregando" | "conta-nova" | "mes-novo";

/** true se alguma sparkline do payload tem ponto diferente de zero. */
export function hasMovementInSpark(...sparks: (number[] | null | undefined)[]): boolean {
  for (let i = 0; i < sparks.length; i++) {
    const spark = sparks[i];
    if (!spark || !spark.length) continue;
    for (let k = 0; k < spark.length; k++) {
      if (typeof spark[k] === "number" && spark[k] !== 0) return true;
    }
  }
  return false;
}

export function classifyEmptyDashboard(args: {
  /** Algum ponto de sparkline != 0 no payload do dashboard (sinal barato). */
  hasSpark?: boolean;
  /** Totais do mês anterior (/financeiro/comparative). null/undefined = sem resposta. */
  previousTotals?: { income?: number; expenses?: number; net?: number } | null;
  /** Consulta do histórico ainda em voo. */
  loadingHistory?: boolean;
}): EmptyDashboardKind {
  // A sparkline já vem no payload do dashboard: quando ela tem movimento dá
  // pra decidir na hora, sem esperar o histórico e sem piscar o texto errado.
  if (args.hasSpark) return "mes-novo";
  const p = args.previousTotals;
  if (p && ((p.income || 0) !== 0 || (p.expenses || 0) !== 0 || (p.net || 0) !== 0)) return "mes-novo";
  if (args.loadingHistory) return "carregando";
  // Sem histórico — ou histórico indisponível (erro/demo): mantém o
  // onboarding, que é o texto certo pra conta nova e o menos errado quando
  // não dá pra saber.
  return "conta-nova";
}

// Claude Design gradient tokens — used by inline SVG paints on web.
export const GRAD = {
  violet1: "#4f5bd5",
  violet2: "#8b5cf6",
  violet3: "#a78bfa",
  pink: "#d62976",
  violetDeep: "#6d28d9",
  violet: "#7c3aed",
};

// Helper — returns web-only style object (inline CSS), otherwise empty. Lets us
// use backdrop-filter, conic-gradient, drop-shadow, transitions in web output
// while keeping native rendering safe.
export const webOnly = (s: any): any => (IS_WEB ? s : {});

export const MOCK_DASHBOARD = {
  revenue: 18420, expenses: 7840, net: 10580, salesToday: 1250, avgTicket: 391.91, newCustomers: 12,
  revenueDelta: 12, expensesDelta: 3, netDelta: 18,
  sparkRevenue: [12400, 13800, 15200, 14100, 16800, 17200, 18420],
  sparkExpenses: [6200, 6800, 7100, 6900, 7400, 7600, 7840],
  sparkNet: [6200, 7000, 8100, 7200, 9400, 9600, 10580],
  recentSales: [
    { id: "1", customer: "Maria Silva", amount: 156.80, time: "14:32", method: "Pix", type: "income" },
    { id: "2", customer: "Pedro Costa", amount: 89.90, time: "13:15", method: "Cartão", type: "income" },
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
