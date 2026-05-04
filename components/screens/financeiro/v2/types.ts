// Tipos compartilhados pelos componentes do Financeiro v2.
// Onda 2 (04/05/2026): adiciona income_breakdown e expense_breakdown que vem
// do server (cobertura completa de Top 5, formas pagamento, timeline, DOW,
// anomalias, gauge).

import type { Transaction } from "../types";

export type HealthDriver = {
  id: "margem" | "runway" | "crescimento" | "ticket";
  label: string;
  current: string;
  target: string;
  status: "ok" | "warn" | "bad";
  gap: string;
  contribution: number;
};

// ----- Onda 2: novos tipos -----
export type TopTransaction = {
  id: string;
  description: string;
  category: string;
  amount: number;
  payment_method: string | null;
  employee_name: string | null;
  status: string;
  date: string;
  // Multi-CNPJ: badge da loja em consolidated
  company_name: string | null;
};

export type PaymentMethodSlice = {
  label: string;       // "PIX", "Credito", etc
  value: number;
  count: number;
  pct: number;
};

export type TimelineBucket = { total: number; count: number };
export type TimelineBuckets = {
  atrasadas: TimelineBucket;
  esta_semana: TimelineBucket;
  este_mes: TimelineBucket;
  futuras: TimelineBucket;
};

export type DowItem = {
  dow: number;       // 0=Dom, 6=Sab
  label: string;
  total: number;
  count: number;
};

export type Anomaly = {
  category: string;
  current: number;
  avg_3m: number;
  diff_pct: number;
};

export type GaugeData = {
  expense_pct: number;
  zone: "saudavel" | "atencao" | "critico";
};

export type IncomeBreakdown = {
  top5: TopTransaction[];
  payment_methods: PaymentMethodSlice[];
  timeline: TimelineBuckets;
  dow: DowItem[];
  total: number;
  count: number;
};

export type ExpenseBreakdown = {
  top5: TopTransaction[];
  payment_methods: PaymentMethodSlice[];
  timeline: TimelineBuckets;
  anomalies: Anomaly[];
  gauge: GaugeData;
  total: number;
};

export type FinancialInsights = {
  health: {
    score: number;
    label: "Saudavel" | "Atencao" | "Critico" | "Inicial";
    drivers: HealthDriver[];
    narrative: { headline: string; subline: string };
  };
  runway: {
    days: number;
    daily_burn: number;
    cash_balance: number;
  };
  biggest_lever: {
    type: "collect_overdue" | "cut_anomaly" | "advance_receivables" | null;
    headline: string;
    amount: number;
    impact_days: number;
    count: number;
    oldest_days?: number;
  } | null;
  // Onda 2: dados ricos do server (Top5, methods, timeline, DOW, anomalies, gauge)
  income_breakdown?: IncomeBreakdown;
  expense_breakdown?: ExpenseBreakdown;
  // Onda 3: cashflow projection 30/60/90 com banda confianca
  cashflow?: any;
};

// Metas do Health Score (espelha backend financeiroInsights.js — manter sync!)
export const HEALTH_TARGETS = {
  margin_pct: 20,
  runway_days: 60,
  growth_mom_pct: 0,
  ticket_baseline: 1.0,
} as const;

export const HEALTH_WEIGHTS = {
  margem: 0.35,
  runway: 0.35,
  crescimento: 0.20,
  ticket: 0.10,
} as const;

export function scoreVsTarget(actual: number, target: number, clampMin = 0): number {
  if (target <= 0) return 100;
  var v = Math.max(clampMin, actual);
  if (v >= target) return 100;
  if (v <= 0) return 0;
  return Math.round((v / target) * 100);
}

export function buildNarrative(args: {
  score: number;
  margem: number;
  runwayDays: number;
  growthPct: number;
  txCount: number;
}): { headline: string; subline: string } {
  if (args.txCount < 10) {
    return {
      headline: "Voce esta comecando — ainda faltam dados pra um diagnostico completo.",
      subline: "Lance receitas e despesas por algumas semanas pra liberar a analise inteligente do seu negocio.",
    };
  }
  if (args.runwayDays > 0 && args.runwayDays < 30) {
    return {
      headline: "Atencao critica: seu caixa cobre menos de 30 dias.",
      subline: "Priorize cobrar atrasados e revisar despesas pesadas — a maior alavanca esta logo abaixo.",
    };
  }
  if (args.score < 60) {
    return {
      headline: "Seu negocio precisa de atencao em algumas frentes.",
      subline: "Veja os indicadores abaixo. Pequenos ajustes de margem e cobranca podem virar o jogo rapido.",
    };
  }
  if (args.score < 80 && args.runwayDays < 60) {
    return {
      headline: "Voce esta saudavel, mas o runway de caixa pede atencao.",
      subline: "Estender o caixa pra alem de 60 dias da folego pra investir sem aperto.",
    };
  }
  if (args.score < 80 && args.margem < 15) {
    return {
      headline: "Volume bom, margem apertada.",
      subline: "Sua receita esta saudavel mas a margem caiu — vale revisar precos ou cortar despesa variavel.",
    };
  }
  if (args.growthPct > 5) {
    return {
      headline: "Seu negocio esta saudavel, com tracao crescente.",
      subline: "Margem em alta, caixa com folego e crescimento consistente — siga o ritmo.",
    };
  }
  return {
    headline: "Seu negocio esta saudavel e estavel.",
    subline: "Indicadores dentro da meta. Veja abaixo a maior alavanca pra transformar saude em crescimento.",
  };
}

export type { Transaction };
