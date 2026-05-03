import { useQuery } from "@tanstack/react-query";
import { companiesApi } from "@/services/api";
import { meAggregatesApi } from "@/services/meAggregates";
import { useAuthStore } from "@/stores/auth";

export type SalesAnalytics = {
  period: string;
  total_sales: number;
  total_revenue: number;
  avg_ticket: number;
  comparison?: { prev_revenue: number; growth_pct: number };
  breakdown: { label: string; value: number; count: number }[];
};

// MULTICNPJ Sessao 2 Onda 2.6: ramifica via consolidatedView.
// Em consolidated, chama /me/sales/analytics (owner-scoped, soma
// todas as empresas do user). Per-company segue o endpoint original.
//
// Backend retorna shape diferente do que o type local declara (legacy).
// Adaptamos no select pra manter a interface estavel pros consumers
// (SalesAnalyticsCard, useSalesAnalytics().data).
export function useSalesAnalytics(period = 'month', groupBy = 'day') {
  const { company, consolidatedView } = useAuthStore();
  const companyId = company?.id;

  return useQuery<SalesAnalytics>({
    queryKey: consolidatedView
      ? ['salesAnalytics', 'me', period, groupBy]
      : ['salesAnalytics', companyId, period, groupBy],
    queryFn: async () => {
      if (consolidatedView) {
        const res = await meAggregatesApi.salesAnalytics({
          period: period as any,
          group_by: groupBy as any,
        });
        // Adapta a resposta para o shape esperado pelo consumer.
        // by_payment vira o breakdown porque e o split mais util pro card.
        return {
          period: res.period.label,
          total_sales: res.summary.total_sales,
          total_revenue: res.summary.total_revenue,
          avg_ticket: res.summary.avg_ticket,
          breakdown: (res.by_payment || []).map(b => ({
            label: b.method,
            value: b.total_revenue,
            count: b.total_sales,
          })),
        };
      }
      return companiesApi.salesAnalytics(companyId!, period, groupBy);
    },
    enabled: (consolidatedView || !!companyId),
    staleTime: 60_000,
    retry: 1,
  });
}

export type ProductRanking = {
  period: string;
  products: { id: string; name: string; category: string; qty_sold: number; revenue: number; abc: string }[];
  summary: { total_products: number; total_sold: number; total_revenue: number };
};

// useProductsRanking continua per-company — nao tem endpoint /me/* pra isso
// (top produtos por empresa nao se beneficia de soma cross-empresa, e o ranking
// global ja vem do top_products do salesAnalytics consolidado quando precisar).
export function useProductsRanking(period = 'month') {
  const { company, consolidatedView } = useAuthStore();
  const companyId = company?.id;

  return useQuery<ProductRanking>({
    queryKey: ['productsRanking', companyId, period],
    queryFn: () => companiesApi.productsRanking(companyId!, period),
    enabled: !!companyId && !consolidatedView,
    staleTime: 60_000,
    retry: 1,
  });
}
