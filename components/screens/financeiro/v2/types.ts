// Tipos compartilhados pelos componentes do Financeiro v2.
// Onda 3 (04/05/2026): adiciona cashflow (history+projection), monthly_evolution
// e professional_ranking que vem do server.

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

export type TopTransaction = {
  id: string;
  description: string;
  category: string;
  amount: number;
  payment_method: string | null;
  employee_name: string | null;
  status: string;
  date: string;
  company_name: string | null;
};

export type PaymentMethodSlice = {
  label: string;
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
  dow: number;
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
  total: number;
};

// ----- Onda 3 -----
export type CashflowHistoryPoint = {
  date: string;     // "YYYY-MM-DD"
  income: number;
  expenses: number;
  net: number;
};

export type CashflowProjectionPoint = {
  days_ahead: number;  // 30, 60, 90
  value: number;       // valor central projetado
  low: number;         // banda inferior (-15%)
  high: number;        // banda superior (+15%)
};

export type CashflowData = {
  history: CashflowHistoryPoint[];
  avg_daily_net: number;
  std_daily_net: number;
  projection: CashflowProjectionPoint[];
};

export type MonthlyItem = {
  month: string;       // "YYYY-MM"
  label: string;       // "out/26"
  income: number;
  expenses: number;
  balance: number;
};

export type RankingItem = {
  id: string;
  name: string;
  tx_count: number;
  total: number;
  avg_ticket: number;
};

export type FinancialInsights = {
  health: {
    score: number;
    label: "Saudavel" | "Atenção" | "Critico" | "Inicial";
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
  income_breakdown?: IncomeBreakdown;
  expense_breakdown?: ExpenseBreakdown;
  // Onda 3
  cashflow?: CashflowData;
  monthly_evolution?: MonthlyItem[];
  professional_ranking?: RankingItem[];
  // 24/08/2026 (QA no app rodando): true enquanto a query de insights do
  // server ainda esta em voo. O calculo client-side so enxerga o periodo
  // selecionado, entao antes da resposta do server ele pode concluir que nao
  // ha nada pendente quando ha — o AcoesCard usava isso pra afirmar "Nada
  // precisa da sua atencao agora" e depois se corrigir sozinho na tela.
  insights_pending?: boolean;
};

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

// F7 (24/08/2026) — reescrita da narrativa.
//
// Esta frase e o texto mais visivel do Financeiro: e a primeira coisa que se
// le no ResumoHero, no lugar do donut de score. Antes falava a lingua de um
// CFO ("runway de caixa pede atenção", "indicadores dentro da meta", "maior
// alavanca") pra um publico de MEI, salao e loja.
//
// Agora cada frase diz um FATO sobre o dinheiro do usuario, com o numero
// dentro, e a subline diz o que fazer. Sem jargao, sem "indicadores".
export function buildNarrative(args: {
  score: number;
  margem: number;
  runwayDays: number;
  growthPct: number;
  txCount: number;
  // Sem isto nao da pra distinguir "sobrou 0%" de "não entrou nada": a margem
  // e forcada a 0 nos dois casos. Opcional pra nao quebrar quem ja chama.
  hasIncome?: boolean;
}): { headline: string; subline: string } {
  var sobra = Math.round(args.margem);

  if (args.txCount < 10) {
    return {
      headline: "Ainda é cedo pra um diagnóstico do seu negócio.",
      subline: "Lance suas receitas e despesas por algumas semanas — aí a Aura consegue te mostrar o que está funcionando.",
    };
  }

  // FIX (QA pos-F7): dois furos de ordem aqui.
  //
  // 1. O caso "so despesa" (receita zerada) escapava de tudo: computeClientSide
  //    forca margem = 0 quando income === 0, entao o ramo `margem < 0` nunca
  //    disparava justamente na situacao que ele descreve. Agora vem primeiro e
  //    olha a receita direto.
  // 2. `runwayDays > 0 && < 30` deixava passar runway ZERO — caixa no fim, o
  //    cenario mais grave. O `> 0` so existia pra excluir o sentinela 999, que
  //    o proprio `< 30` ja exclui.
  if (args.hasIncome === false) {
    return {
      headline: "Neste período saiu dinheiro e não entrou nada.",
      subline: "Se você faturou e ainda não lançou, registre as entradas. Se não faturou mesmo, vale olhar as saídas na aba Despesas.",
    };
  }
  if (args.margem < 0) {
    return {
      headline: "Você gastou mais do que entrou: " + Math.abs(sobra) + "% a mais.",
      subline: "Veja as maiores saídas na aba Despesas e avalie o que dá pra cortar ou adiar pro mês que vem.",
    };
  }
  if (args.runwayDays < 30) {
    return {
      headline: args.runwayDays <= 0
        ? "Seu caixa chegou no limite."
        : "Atenção: seu dinheiro em caixa dura menos de um mês.",
      subline: "Cobre quem está atrasado e segure o que der pra segurar — as contas mais urgentes estão logo abaixo.",
    };
  }
  if (args.score < 60) {
    return {
      headline: sobra > 0
        ? "Sobrou pouco: " + sobra + "% de tudo que entrou."
        : "Praticamente não sobrou nada neste período.",
      subline: "Cobrar quem está atrasado e cortar um gasto grande já muda esse número no mês que vem.",
    };
  }
  if (args.score < 80 && args.runwayDays < 60) {
    return {
      headline: "Seu negócio vai bem, mas o caixa está curto.",
      subline: "No ritmo atual seu dinheiro dura cerca de " + args.runwayDays + " dias. Passar de dois meses te dá folga pra investir sem aperto.",
    };
  }
  if (args.score < 80 && args.margem < 15) {
    return {
      headline: "Você vende bem, mas sobra pouco: " + sobra + "%.",
      subline: "Quando entra muito e sobra pouco, o caminho costuma ser preço ou custo de produto — não volume.",
    };
  }
  if (args.growthPct > 5) {
    return {
      headline: "Seu negócio está saudável e crescendo — sobrou " + sobra + "% do que entrou.",
      subline: "Entrou mais que no período anterior e a sobra se manteve. Continue no ritmo.",
    };
  }
  return {
    headline: "Seu negócio está saudável — sobrou " + sobra + "% de tudo que entrou.",
    subline: "As contas estão em dia e o caixa tem folga. Veja abaixo se algo precisa da sua atenção.",
  };
}

export type { Transaction };
