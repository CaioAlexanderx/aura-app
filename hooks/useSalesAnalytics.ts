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

// Backend `/companies/:id/products/ranking` retorna `period` como
// { start, end, label } (não como string). Type ajustado em 06/05/2026
// junto com o fix do crash do AbcCurveCard — a string fica como union
// pra compatibilidade com mocks e código legado que ainda passa string.
export type ProductRankingPeriod = string | { start: string; end: string; label: string };

export type ProductRankingItem = {
  id: string;
  name: string;
  category: string;
  qty_sold: number;
  revenue: number;
  abc: string;
  // 30/05/2026 (fix Eryca): backend novo expoe esses campos.
  // Antigos clientes ignoram, nada quebra.
  total_qty?: number;
  total_revenue?: number;
  avg_price?: number;
  accumulated_pct?: number;
  total_orders?: number;
  is_active?: boolean;
  price?: number;
  stock_qty?: number;
  share_pct?: number;
};

export type AbcClassBreakdown = {
  grade: 'A' | 'B' | 'C';
  count: number;
  total_revenue: number;
  total_qty: number;
  revenue_pct: number;
  qty_pct: number;
};

export type ProductRanking = {
  period: ProductRankingPeriod;
  products: ProductRankingItem[];
  summary: { total_products: number; total_sold: number; total_revenue: number };
  total_revenue?: number;
  total_products?: number;
  curve_summary?: { A: number; B: number; C: number };
  // 30/05/2026 (fix Eryca): cards de resumo no header da nova UI.
  class_breakdown?: AbcClassBreakdown[];
  pagination?: {
    limit: number;
    offset: number;
    total_items: number;
    filtered_items: number;
    returned: number;
    abc_filter: 'A' | 'B' | 'C' | null;
  };
};

// 30/05/2026: opts permite controlar limit/offset/abc no UI expandido.
// Mantém compat com chamada antiga (string).
export type ProductsRankingHookOpts = {
  period?: string;
  limit?: number;
  offset?: number;
  abc?: 'A' | 'B' | 'C';
};

// useProductsRanking continua per-company — nao tem endpoint /me/* pra isso
// (top produtos por empresa nao se beneficia de soma cross-empresa, e o ranking
// global ja vem do top_products do salesAnalytics consolidado quando precisar).
//
// 30/05/2026: aceita opts (period/limit/offset/abc). Compat antigo:
//   useProductsRanking('today')  → { period: 'today' }
//   useProductsRanking({ period: 'month', abc: 'A' })
export function useProductsRanking(periodOrOpts: string | ProductsRankingHookOpts = 'month') {
  const { company, consolidatedView } = useAuthStore();
  const companyId = company?.id;

  const opts: ProductsRankingHookOpts = typeof periodOrOpts === 'string'
    ? { period: periodOrOpts }
    : periodOrOpts;
  const period = opts.period || 'month';

  return useQuery<ProductRanking>({
    queryKey: ['productsRanking', companyId, period, opts.limit, opts.offset, opts.abc],
    queryFn: () => companiesApi.productsRanking(companyId!, opts as any),
    enabled: !!companyId && !consolidatedView,
    staleTime: 60_000,
    retry: 1,
  });
}
