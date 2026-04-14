import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import type { PeriodKey } from "@/components/screens/financeiro/types";

var API = "https://aura-backend-production-f805.up.railway.app/api/v1";

export type MonthlyData = {
  month: string; label: string; receita: number; despesa: number; resultado: number;
  qtd_vendas: number; margem_pct: number; ticket_medio: number; dias_com_venda: number;
};

export type AnalysisData = {
  monthly: MonthlyData[];
  current: { receita: number; despesa: number; resultado: number; vendas: number; margem_pct: number; avg_ticket: number; lancamentos: number; projecao_mes: number };
  previous: { receita: number; despesa: number; resultado: number; vendas: number; avg_ticket: number };
  growth: { receita_pct: number; despesa_pct: number; vendas_pct: number };
  velocity: { media_dia_30d: number; media_dia_7d: number; tendencia_pct: number; vendas_por_dia: number; projecao_mes: number };
  dayOfWeek: { dow: number; label: string; vendas: number; faturamento: number; ticket_medio: number }[];
  ticketDistribution: { faixa: string; vendas: number; faturamento: number; ticket_medio: number }[];
  weeklyTrend: { semana: string; vendas: number; faturamento: number; ticket_medio: number }[];
  employees: { name: string; vendas: number; faturamento: number; ticket_medio: number; pct_total: number }[];
  employeeMonthly: { month: string; name: string; vendas: number; faturamento: number }[];
  topCustomers: { cliente: string; compras: number; total_gasto: number; ticket_medio: number; primeira_compra: string; ultima_compra: string }[];
  categories: { income: { category: string; total: number; count: number }[]; expense: { category: string; total: number; count: number }[] };
  categoriesAll: { income: { category: string; total: number; count: number }[]; expense: { category: string; total: number; count: number }[] };
  insights: {
    avg_monthly_receita: number; avg_monthly_despesa: number; avg_monthly_resultado: number;
    best_month: { month: string; label: string; receita: number } | null;
    worst_month: { month: string; label: string; receita: number } | null;
    total_receita_periodo: number; total_despesa_periodo: number; meses_analisados: number;
    melhor_dia_semana: string | null; pior_dia_semana: string | null; ticket_medio_geral: number;
  };
};

// Map period to months for the backend
function periodToMonths(period?: PeriodKey): number {
  switch (period) {
    case "week": return 1;
    case "month": return 1;
    case "year": return 12;
    case "prev_year": return 24;
    default: return 13;
  }
}

async function fetchAnalysis(companyId: string, token: string, months: number): Promise<AnalysisData> {
  var res = await fetch(API + "/companies/" + companyId + "/financial/analysis?months=" + months, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) throw new Error("Erro ao carregar analise");
  return res.json();
}

export function useFinancialAnalysis(months?: number, period?: PeriodKey) {
  var { company, token } = useAuthStore();
  var companyId = company?.id;
  var effectiveMonths = months || periodToMonths(period);
  return useQuery<AnalysisData>({
    queryKey: ["financialAnalysis", companyId, effectiveMonths],
    queryFn: function() { return fetchAnalysis(companyId!, token!, effectiveMonths); },
    enabled: !!companyId && !!token,
    staleTime: 60000,
    retry: 1,
  });
}
