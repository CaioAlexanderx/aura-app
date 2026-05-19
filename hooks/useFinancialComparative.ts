// hooks/useFinancialComparative.ts
//
// Fase A do redesign Financeiro (19/05/2026): comparativos visuais
// na Visao Geral (mes-vs-anterior, YoY, periodo customizado).
//
// Backend endpoints:
//   GET /companies/:id/financeiro/comparative
//   GET /me/financeiro/comparative           (consolidated multi-CNPJ)
//
// Multi-CNPJ: hook detecta consolidatedView do useAuthStore e ramifica
// entre os 2 endpoints automaticamente — consumer nao precisa saber.

import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

export type CompareWith = "previous_period" | "yoy" | "custom";
export type ComparativePeriod = "today" | "week" | "month" | "year" | "custom";

export type DailyPoint = {
  date: string;       // ISO YYYY-MM-DD
  income: number;
  expenses: number;
  net: number;
};

export type RangeWithSeries = {
  start: string;
  end: string;
  label: string;
  daily: DailyPoint[];
  totals: { income: number; expenses: number; net: number };
};

export type ComparativeData = {
  current: RangeWithSeries;
  previous: RangeWithSeries;
  delta: {
    income_pct: number | null;   // null = sem base de comparacao (zero)
    expenses_pct: number | null;
    net_pct: number | null;
  };
  consolidated: boolean;
  company_count?: number;
};

export type UseComparativeArgs = {
  period: ComparativePeriod;
  compareWith: CompareWith;
  // necessario quando period=custom
  start?: string;
  end?: string;
  // necessario quando compareWith=custom
  compareStart?: string;
  compareEnd?: string;
};

function buildQueryString(args: UseComparativeArgs): string {
  var params = new URLSearchParams();
  params.set("period", args.period);
  params.set("compareWith", args.compareWith);
  if (args.period === "custom" && args.start && args.end) {
    params.set("start", args.start);
    params.set("end", args.end);
  }
  if (args.compareWith === "custom" && args.compareStart && args.compareEnd) {
    params.set("compareStart", args.compareStart);
    params.set("compareEnd", args.compareEnd);
  }
  return params.toString();
}

export function useFinancialComparative(args: UseComparativeArgs) {
  var auth = useAuthStore();
  var consolidatedView = auth.consolidatedView;
  var company = auth.company;
  var companyId = company && company.id;
  var token = auth.token;
  var isDemo = auth.isDemo;

  // Custom periods exigem start+end pra serem validos; antes disso skipamos a query.
  var customMissing =
    (args.period === "custom" && (!args.start || !args.end)) ||
    (args.compareWith === "custom" && (!args.compareStart || !args.compareEnd));
  var enabled = !!token && !isDemo && !customMissing && (consolidatedView || !!companyId);

  var qs = buildQueryString(args);
  var queryKey = consolidatedView
    ? ["financeiro-comparative-me", qs]
    : ["financeiro-comparative", companyId, qs];

  return useQuery<ComparativeData>({
    queryKey: queryKey,
    queryFn: function () {
      if (consolidatedView) {
        return request<ComparativeData>("/me/financeiro/comparative?" + qs);
      }
      return request<ComparativeData>("/companies/" + companyId + "/financeiro/comparative?" + qs);
    },
    enabled: enabled,
    retry: 1,
    staleTime: 60_000, // 1min — financeiro nao muda agressivamente
  });
}
