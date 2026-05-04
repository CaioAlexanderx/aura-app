// hooks/useFinancialInsights.ts
//
// Calcula health score, runway, biggest lever e narrativa do Financeiro v2.
//
// Estrategia hibrida:
//   1. Sempre calcula client-side a partir de transactions+summary do useTransactionsApi.
//      Isso garante que mesmo se o endpoint do server falhar, a UI nunca quebra.
//   2. Em paralelo busca /companies/:id/financeiro/insights (per-company) ou
//      /me/financeiro/insights (consolidated). Quando server retorna, mescla
//      por cima do client (server > client) — server tem mais precisao porque
//      considera saldo bancario real, baseline 6m, etc.
//
// Multi-CNPJ: detecta consolidatedView do useAuthStore e ramifica entre os 2
// endpoints. Nao precisa passar flag — hook faz sozinho.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import type { Transaction } from "@/components/screens/financeiro/types";
import {
  HEALTH_TARGETS,
  HEALTH_WEIGHTS,
  scoreVsTarget,
  buildNarrative,
  type FinancialInsights,
  type HealthDriver,
} from "@/components/screens/financeiro/v2/types";

type Summary = {
  income: number;
  expenses: number;
  balance: number;
  pendingIncome?: number;
  pendingExpenses?: number;
};

type Args = {
  transactions: Transaction[];
  summary: Summary;
  previousSummary?: Summary | null;
  period: string;          // "today" | "week" | "month" | etc — afeta dias_periodo
  daysInPeriod?: number;   // override opcional (custom range)
};

function periodDays(period: string, customDays?: number): number {
  if (customDays && customDays > 0) return customDays;
  switch (period) {
    case "today": return 1;
    case "week": return 7;
    case "month": return 30;
    case "year": return 365;
    case "prev_year": return 365;
    case "all": return 90; // limita pra runway nao explodir em "all"
    default: return 30;
  }
}

function fmtPct(v: number, decimals = 1): string {
  if (!isFinite(v)) return "0%";
  var s = v.toFixed(decimals).replace(".", ",");
  return s + "%";
}

function fmtBRL(v: number): string {
  return "R$ " + Math.round(v).toLocaleString("pt-BR");
}

function isOverdue(t: Transaction): boolean {
  if (t.status !== "pending") return false;
  if (t.type !== "income") return false;
  var due = (t as any).due_date;
  if (!due) return false;
  try {
    var d = new Date(due);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  } catch { return false; }
}

function daysOverdue(t: Transaction): number {
  var due = (t as any).due_date;
  if (!due) return 0;
  try {
    var d = new Date(due);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var diff = today.getTime() - d.getTime();
    return Math.max(0, Math.floor(diff / 86400000));
  } catch { return 0; }
}

// Calculo client-side (fallback enquanto server nao responde)
function computeClientSide(args: Args): FinancialInsights {
  var days = periodDays(args.period, args.daysInPeriod);
  var summary = args.summary;
  var prev = args.previousSummary;

  var margem = summary.income > 0 ? ((summary.income - summary.expenses) / summary.income) * 100 : 0;
  var margemScore = scoreVsTarget(margem, HEALTH_TARGETS.margin_pct);

  var dailyBurn = days > 0 && summary.expenses > 0 ? summary.expenses / days : 0;
  var cashBalance = summary.balance > 0 ? summary.balance : 0;
  var runwayDays = dailyBurn > 0 ? Math.round(cashBalance / dailyBurn) : 999;
  var runwayScore = scoreVsTarget(Math.min(runwayDays, 180), HEALTH_TARGETS.runway_days);

  var growth = 0;
  if (prev && prev.income > 0) {
    growth = ((summary.income - prev.income) / prev.income) * 100;
  }
  var growthScore = scoreVsTarget(Math.max(growth, -10) + 10, 10);

  var ticketRatio = 1.0;
  var ticketScore = scoreVsTarget(ticketRatio, HEALTH_TARGETS.ticket_baseline);

  var score = Math.round(
    HEALTH_WEIGHTS.margem * margemScore +
    HEALTH_WEIGHTS.runway * runwayScore +
    HEALTH_WEIGHTS.crescimento * growthScore +
    HEALTH_WEIGHTS.ticket * ticketScore
  );
  score = Math.max(0, Math.min(100, score));

  var label: "Saudavel" | "Atencao" | "Critico" | "Inicial" =
    args.transactions.length < 10 ? "Inicial" :
    score >= 75 ? "Saudavel" :
    score >= 50 ? "Atencao" :
    "Critico";

  var drivers: HealthDriver[] = [
    {
      id: "margem",
      label: "Margem liquida",
      current: fmtPct(margem),
      target: ">= " + HEALTH_TARGETS.margin_pct + "%",
      status: margem >= HEALTH_TARGETS.margin_pct ? "ok" : margem >= HEALTH_TARGETS.margin_pct * 0.7 ? "warn" : "bad",
      gap:
        margem >= HEALTH_TARGETS.margin_pct
          ? "+" + (margem - HEALTH_TARGETS.margin_pct).toFixed(1).replace(".", ",") + " pontos acima"
          : (HEALTH_TARGETS.margin_pct - margem).toFixed(1).replace(".", ",") + " pontos abaixo",
      contribution: HEALTH_WEIGHTS.margem,
    },
    {
      id: "runway",
      label: "Runway de caixa",
      current: runwayDays >= 999 ? "—" : runwayDays + "d",
      target: ">= " + HEALTH_TARGETS.runway_days + " dias",
      status: runwayDays >= HEALTH_TARGETS.runway_days ? "ok" : runwayDays >= 30 ? "warn" : "bad",
      gap:
        runwayDays >= 999
          ? "sem despesas no periodo"
          : runwayDays >= HEALTH_TARGETS.runway_days
          ? "+" + (runwayDays - HEALTH_TARGETS.runway_days) + " dias acima"
          : (HEALTH_TARGETS.runway_days - runwayDays) + " dias abaixo",
      contribution: HEALTH_WEIGHTS.runway,
    },
    {
      id: "crescimento",
      label: "Crescimento",
      current: prev && prev.income > 0 ? (growth >= 0 ? "+" : "") + growth.toFixed(1).replace(".", ",") + "%" : "—",
      target: ">= 0% vs ant.",
      status: growth >= 0 ? "ok" : growth >= -5 ? "warn" : "bad",
      gap:
        !prev || prev.income === 0
          ? "sem comparativo"
          : growth >= 0
          ? "receita subindo"
          : "receita caindo",
      contribution: HEALTH_WEIGHTS.crescimento,
    },
    {
      id: "ticket",
      label: "Ticket medio",
      current:
        args.transactions.length > 0 && summary.income > 0
          ? fmtBRL(summary.income / Math.max(1, args.transactions.filter(function(t) { return t.type === "income"; }).length))
          : "—",
      target: "vs media 6m",
      status: "ok",
      gap: "baseline em construcao",
      contribution: HEALTH_WEIGHTS.ticket,
    },
  ];

  var narrative = buildNarrative({
    score: score,
    margem: margem,
    runwayDays: runwayDays,
    growthPct: growth,
    txCount: args.transactions.length,
  });

  var overdue = args.transactions.filter(isOverdue);
  var leverAmount = overdue.reduce(function(s, t) { return s + t.amount; }, 0);
  var leverImpact = dailyBurn > 0 ? Math.round(leverAmount / dailyBurn) : 0;
  var oldestOverdue = overdue.reduce(function(maxD, t) {
    var d = daysOverdue(t);
    return d > maxD ? d : maxD;
  }, 0);

  var biggest_lever: FinancialInsights["biggest_lever"] = null;
  if (overdue.length > 0 && leverAmount > 0) {
    biggest_lever = {
      type: "collect_overdue",
      headline:
        "Cobrar " + fmtBRL(leverAmount) + " em atraso aumentaria seu runway de " +
        (runwayDays >= 999 ? "—" : runwayDays + "") +
        " para " +
        (runwayDays >= 999 ? "—" : (runwayDays + leverImpact) + "") +
        " dias",
      amount: leverAmount,
      impact_days: leverImpact,
      count: overdue.length,
      oldest_days: oldestOverdue,
    };
  }

  return {
    health: { score: score, label: label, drivers: drivers, narrative: narrative },
    runway: { days: runwayDays, daily_burn: dailyBurn, cash_balance: cashBalance },
    biggest_lever: biggest_lever,
  };
}

// Hook publico — retorna client-side merged with server (server wins quando disponivel)
export function useFinancialInsights(args: Args): FinancialInsights {
  var auth = useAuthStore();
  var consolidatedView = auth.consolidatedView;
  var company = auth.company;
  var companyId = company && company.id;
  var token = auth.token;
  var isDemo = auth.isDemo;

  // Calculo client-side (sempre roda)
  var clientSide = useMemo(function() { return computeClientSide(args); }, [args.transactions, args.summary, args.previousSummary, args.period, args.daysInPeriod]);

  // Fetch server (Onda 1: endpoint retorna o esqueleto basico; Onda 2 vai
  // enriquecer com cashflow, anomalies, etc).
  var enabled = !!token && !isDemo && (consolidatedView || !!companyId);
  var queryKey = consolidatedView
    ? ["financeiro-insights-me", args.period]
    : ["financeiro-insights", companyId, args.period];

  var serverQuery = useQuery<Partial<FinancialInsights> & { consolidated?: boolean; company_count?: number }>({
    queryKey: queryKey,
    queryFn: function() {
      if (consolidatedView) {
        return request<any>("/me/financeiro/insights?period=" + encodeURIComponent(args.period));
      }
      return request<any>("/companies/" + companyId + "/financeiro/insights?period=" + encodeURIComponent(args.period));
    },
    enabled: enabled,
    retry: 1,
    staleTime: 60_000, // 1min — financeiro nao muda agressivamente
  });

  // Merge server > client
  return useMemo(function() {
    var server = serverQuery.data;
    if (!server || !server.health || typeof server.health.score !== "number") {
      // Server nao retornou ainda ou erro — usa client puro
      return clientSide;
    }
    // Merge: campos do server sobrescrevem client; biggest_lever e narrative vem do server se existirem
    return {
      health: {
        score: server.health.score,
        label: (server.health as any).label || clientSide.health.label,
        drivers: (server.health as any).drivers && (server.health as any).drivers.length > 0
          ? (server.health as any).drivers
          : clientSide.health.drivers,
        // Narrativa fica client-side por enquanto — server retorna so estado, front compoe a frase
        narrative: clientSide.health.narrative,
      },
      runway: server.runway || clientSide.runway,
      biggest_lever: server.biggest_lever !== undefined ? server.biggest_lever : clientSide.biggest_lever,
      // Onda 2: cashflow, income_breakdown, expense_breakdown, anomalies, etc.
      cashflow: (server as any).cashflow,
      income_breakdown: (server as any).income_breakdown,
      expense_breakdown: (server as any).expense_breakdown,
    };
  }, [clientSide, serverQuery.data]);
}
