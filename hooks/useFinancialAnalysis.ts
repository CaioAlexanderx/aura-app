import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";

const API = "https://aura-backend-production-f805.up.railway.app/api/v1";

export type MonthlyData = {
  month: string; label: string; receita: number; despesa: number; resultado: number;
  qtd_vendas: number; margem_pct: number;
};

export type AnalysisData = {
  monthly: MonthlyData[];
  current: { receita: number; despesa: number; resultado: number; vendas: number; margem_pct: number; avg_ticket: number; lancamentos: number };
  previous: { receita: number; despesa: number; resultado: number; vendas: number; avg_ticket: number };
  growth: { receita_pct: number; despesa_pct: number; vendas_pct: number };
  categories: { income: { category: string; total: number; count: number }[]; expense: { category: string; total: number; count: number }[] };
  categoriesAll: { income: { category: string; total: number; count: number }[]; expense: { category: string; total: number; count: number }[] };
  employees: { name: string; total_sales: number; total_revenue: number; avg_ticket: number }[];
  employeesPrev: { name: string; total_sales: number; total_revenue: number }[];
  insights: {
    avg_monthly_receita: number; avg_monthly_despesa: number; avg_monthly_resultado: number;
    best_month: { month: string; label: string; receita: number } | null;
    worst_month: { month: string; label: string; receita: number } | null;
    total_receita_periodo: number; total_despesa_periodo: number; meses_analisados: number;
  };
};

async function fetchAnalysis(companyId: string, token: string, months = 7): Promise<AnalysisData> {
  const res = await fetch(`${API}/companies/${companyId}/financial/analysis?months=${months}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Erro ao carregar analise");
  return res.json();
}

export function useFinancialAnalysis(months = 7) {
  const { company, token } = useAuthStore();
  const companyId = company?.id;
  return useQuery<AnalysisData>({
    queryKey: ["financialAnalysis", companyId, months],
    queryFn: () => fetchAnalysis(companyId!, token!, months),
    enabled: !!companyId && !!token,
    staleTime: 60_000,
    retry: 1,
  });
}
