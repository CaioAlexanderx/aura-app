// Tipos compartilhados pelos componentes do Financeiro v2.
// Esses tipos espelham o JSON que o agregador /financeiro/insights vai
// retornar, mas o hook tambem produz um fallback client-side enquanto o
// endpoint nao esta disponivel — entao todos os campos sao opcionais.

import type { Transaction } from "../types";

export type HealthDriver = {
  id: "margem" | "runway" | "crescimento" | "ticket";
  label: string;
  // valor formatado pra exibir, ex: "23,4%", "68d", "R$ 218", "+8,2%"
  current: string;
  // meta como string, ex: ">= 20%", ">= 60d"
  target: string;
  // status: "ok" | "warn" | "bad"
  status: "ok" | "warn" | "bad";
  // gap textual, ex: "+3 pontos acima da meta", "-12 dias abaixo"
  gap: string;
  // contribuicao 0-1 pro score (peso ja aplicado)
  contribution: number;
};

export type FinancialInsights = {
  health: {
    score: number; // 0-100
    label: "Saudavel" | "Atencao" | "Critico" | "Inicial";
    drivers: HealthDriver[];
    // Frase narrativa parametrizada (NAO use AI — texto local com 6 variantes)
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
  // Demais secoes serao preenchidas em commits subsequentes
  income_breakdown?: any;
  expense_breakdown?: any;
  cashflow?: any;
  reconciliation?: any;
};

// Metas do Health Score — cresceram a partir da conversa em 04/05/2026.
// Pesos somam 1.0. Cada driver vira 0-100 normalizado contra meta.
export const HEALTH_TARGETS = {
  margin_pct: 20,        // margem liquida >= 20%
  runway_days: 60,       // runway >= 60 dias
  growth_mom_pct: 0,     // crescimento MoM positivo (clamp inferior em -10%)
  ticket_baseline: 1.0,  // ticket atual / media 6m >= 1.0
} as const;

export const HEALTH_WEIGHTS = {
  margem: 0.35,
  runway: 0.35,
  crescimento: 0.20,
  ticket: 0.10,
} as const;

// Helper: normaliza um valor 0-100 baseado em "actual vs target".
// Se actual >= target -> 100. Se actual <= 0 -> 0. Linear no meio.
// Para crescimento (que pode ser negativo), aplique clampMin antes.
export function scoreVsTarget(actual: number, target: number, clampMin = 0): number {
  if (target <= 0) return 100;
  var v = Math.max(clampMin, actual);
  if (v >= target) return 100;
  if (v <= 0) return 0;
  return Math.round((v / target) * 100);
}

// Constroi a frase narrativa de acordo com o estado.
// 6 variantes minimas conforme decidido em 04/05/2026.
export function buildNarrative(args: {
  score: number;
  margem: number;       // pct (ex: 23 = 23%)
  runwayDays: number;
  growthPct: number;    // ex: 8.2 = +8.2%
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

// Reexporta Transaction pra os componentes v2 importarem direto daqui
export type { Transaction };
