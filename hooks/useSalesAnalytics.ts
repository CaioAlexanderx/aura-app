import { useQuery } from "@tanstack/react-query";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

export type SalesAnalytics = {
  period: string;
  total_sales: number;
  total_revenue: number;
  avg_ticket: number;
  comparison?: { prev_revenue: number; growth_pct: number };
  breakdown: { label: string; value: number; count: number }[];
};

export function useSalesAnalytics(period = 'month', groupBy = 'day') {
  const { company } = useAuthStore();
  const companyId = company?.id;

  return useQuery<SalesAnalytics>({
    queryKey: ['salesAnalytics', companyId, period, groupBy],
    queryFn: () => companiesApi.salesAnalytics(companyId!, period, groupBy),
    enabled: !!companyId,
    staleTime: 60_000,
    retry: 1,
  });
}

export type ProductRanking = {
  period: string;
  products: { id: string; name: string; category: string; qty_sold: number; revenue: number; abc: string }[];
  summary: { total_products: number; total_sold: number; total_revenue: number };
};

export function useProductsRanking(period = 'month') {
  const { company } = useAuthStore();
  const companyId = company?.id;

  return useQuery<ProductRanking>({
    queryKey: ['productsRanking', companyId, period],
    queryFn: () => companiesApi.productsRanking(companyId!, period),
    enabled: !!companyId,
    staleTime: 60_000,
    retry: 1,
  });
}
