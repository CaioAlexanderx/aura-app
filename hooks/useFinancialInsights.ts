// hooks/useFinancialInsights.ts
//
// Calcula health score, runway, biggest lever e narrativa do Financeiro v2.
// Por enquanto roda 100% client-side a partir das transactions e do summary
// que ja vem do useTransactionsApi. Quando o endpoint
// GET /companies/:id/financeiro/insights estiver no ar, este hook tambem
// vai buscar dele e mesclar — campos do server tem prioridade sobre os
// calculos locais (mais precisos por considerar saldo bancario real, etc).

import { useMemo } from "react";
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

export function useFinancialInsights(args: Args): FinancialInsights {
  return useMemo(function() {
    var days = periodDays(args.period, args.daysInPeriod);
    var summary = args.summary;
    var prev = args.previousSummary;

    // ---- Drivers ----
    // 1) Margem liquida
    var margem = summary.income > 0 ? ((summary.income - summary.expenses) / summary.income) * 100 : 0;
    var margemScore = scoreVsTarget(margem, HEALTH_TARGETS.margin_pct);

    // 2) Runway: caixa / gasto medio diario.
    // Como nao temos saldo bancario real ainda, usa balance como proxy.
    // Quando vier do server, substitui aqui.
    var dailyBurn = days > 0 && summary.expenses > 0 ? summary.expenses / days : 0;
    var cashBalance = summary.balance > 0 ? summary.balance : 0;
    var runwayDays = dailyBurn > 0 ? Math.round(cashBalance / dailyBurn) : 999;
    var runwayScore = scoreVsTarget(Math.min(runwayDays, 180), HEALTH_TARGETS.runway_days);

    // 3) Crescimento MoM
    var growth = 0;
    if (prev && prev.income > 0) {
      growth = ((summary.income - prev.income) / prev.income) * 100;
    }
    // clampMin -10% pra nao detonar score com 1 mes ruim
    var growthScore = scoreVsTarget(Math.max(growth, -10) + 10, 10);

    // 4) Ticket vs baseline 6m do proprio negocio.
    // Sem historico ainda, usa 1.0 (neutro). Server preencher depois.
    var ticketRatio = 1.0;
    var ticketScore = scoreVsTarget(ticketRatio, HEALTH_TARGETS.ticket_baseline);

    // ---- Health Score ponderado ----
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

    // ---- Drivers detalhados pra UI ----
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

    // ---- Narrativa ----
    var narrative = buildNarrative({
      score: score,
      margem: margem,
      runwayDays: runwayDays,
      growthPct: growth,
      txCount: args.transactions.length,
    });

    // ---- Biggest Lever (cobrar atrasados) ----
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
      health: {
        score: score,
        label: label,
        drivers: drivers,
        narrative: narrative,
      },
      runway: {
        days: runwayDays,
        daily_burn: dailyBurn,
        cash_balance: cashBalance,
      },
      biggest_lever: biggest_lever,
    };
  }, [args.transactions, args.summary, args.previousSummary, args.period, args.daysInPeriod]);
}
