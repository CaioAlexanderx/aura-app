import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { salesApi, type SalesFilters, type SalesListResponse, type SaleDetailFull } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

// ============================================================
// AURA. — Hooks da tela de Vendas (Item 3 Eryca)
//
// useSalesList(filters): lista paginada + stats agregados
//   - cache curto (15s) — vendas chegam frequente
//   - re-fetch ao mudar filtros (queryKey muda)
//
// useSaleDetail(saleId): detalhes completos pra modal
//   - cache 30s
//
// useCancelSale(): mutation pra cancelar venda inteira
//   - invalida lista + detalhes + transactions + dashboard + dre + products
// ============================================================

export function useSalesList(filters?: SalesFilters) {
  const { token, company } = useAuthStore();

  // Normaliza filtros pra queryKey estavel (objeto ou undefined)
  const filtersKey = filters || {};

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["sales-list", company?.id, filtersKey],
    queryFn: function() {
      if (!company?.id) throw new Error("no company");
      return salesApi.list(company.id, filters);
    },
    enabled: !!token && !!company?.id,
    staleTime: 15_000,
    retry: 1,
  });

  return {
    data: data as SalesListResponse | undefined,
    sales: data?.sales || [],
    stats: data?.stats,
    total: data?.total || 0,
    isLoading: isLoading,
    isFetching: isFetching,
    error: error as Error | null,
    refetch: refetch,
  };
}

export function useSaleDetail(saleId: string | null | undefined) {
  const { company } = useAuthStore();

  const { data, isLoading, error } = useQuery({
    queryKey: ["sale-detail", company?.id, saleId],
    queryFn: function() {
      if (!company?.id || !saleId) throw new Error("missing");
      return salesApi.get(company.id, saleId);
    },
    enabled: !!company?.id && !!saleId,
    staleTime: 30_000,
    retry: 1,
  });

  return {
    detail: data as SaleDetailFull | undefined,
    isLoading: isLoading,
    error: error as Error | null,
  };
}

export function useCancelSale() {
  const { company } = useAuthStore();
  const qc = useQueryClient();

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["sales-list", company?.id] });
    qc.invalidateQueries({ queryKey: ["sale-detail", company?.id] });
    qc.invalidateQueries({ queryKey: ["transactions", company?.id] });
    qc.invalidateQueries({ queryKey: ["transaction-sale-details", company?.id] });
    qc.invalidateQueries({ queryKey: ["dashboard", company?.id] });
    qc.invalidateQueries({ queryKey: ["dre", company?.id] });
    qc.invalidateQueries({ queryKey: ["products", company?.id] });
  }

  const mutation = useMutation({
    mutationFn: function(args: { saleId: string; reason?: string }) {
      if (!company?.id) throw new Error("no company");
      return salesApi.cancel(company.id, args.saleId, args.reason);
    },
    onSuccess: invalidateAll,
  });

  return {
    cancelSale: function(args: { saleId: string; reason?: string }) { return mutation.mutateAsync(args); },
    isCancelling: mutation.isPending,
    error: mutation.error as Error | null,
  };
}
