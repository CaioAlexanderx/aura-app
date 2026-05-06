import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { salesApi, type SalesListResponse, type SaleDetailFull } from "@/services/api";
import { meAggregatesApi, type SalesFilters, type SalesConsolidatedResponse } from "@/services/meAggregates";
import { useAuthStore } from "@/stores/auth";

// ============================================================
// AURA. — Hooks da tela de Vendas (Item 3 Eryca)
//
// useSalesList(filters): lista paginada + stats agregados
//   - cache curto (15s) — vendas chegam frequente
//   - re-fetch ao mudar filtros (queryKey muda)
//   - MULTICNPJ Onda 2.4: ramifica via consolidatedView do auth.
//     Em consolidated -> meAggregatesApi.sales() (/me/sales).
//     Em per-company -> salesApi.list() (/companies/:id/sales).
//     Backend retorna mesma shape; consolidated adiciona breakdown[]
//     e cada item ganha company_id+company_name pra UI mostrar badge.
//
// useSaleDetail(saleId, companyId?): detalhes pra modal
//   - cache 30s
//   - companyId opcional: em consolidated, caller passa o sale.company_id
//     da listagem. Default = company.id atual (modo per-company).
//
// useCancelSale(companyId?): mutation pra cancelar venda inteira
//   - companyId opcional: mesmo padrao do useSaleDetail.
//   - invalida lista (per-company E consolidated) + detalhes + transactions
//     + dashboard + dre + products.
//
// useUpdateSaleSeller(companyId?): mutation pra alterar/remover vendedor
//   - companyId opcional: mesmo padrao do useCancelSale.
//   - invalida lista + detalhes ao concluir.
// ============================================================

export function useSalesList(filters?: SalesFilters) {
  const { token, company, consolidatedView } = useAuthStore();

  // Normaliza filtros pra queryKey estavel (objeto ou undefined)
  const filtersKey = filters || {};

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: consolidatedView
      ? ["sales-list", "me", filtersKey]
      : ["sales-list", company?.id, filtersKey],
    queryFn: function() {
      if (consolidatedView) {
        return meAggregatesApi.sales(filters);
      }
      if (!company?.id) throw new Error("no company");
      return salesApi.list(company.id, filters as any);
    },
    enabled: !!token && (consolidatedView || !!company?.id),
    staleTime: 15_000,
    retry: 1,
  });

  // Em consolidated, response tem breakdown e company_count.
  // Em per-company nao tem (mas o hook expoe defaults compativeis).
  const consolidated = data as SalesConsolidatedResponse | undefined;
  const perCompany = data as SalesListResponse | undefined;

  return {
    data: data as SalesListResponse | SalesConsolidatedResponse | undefined,
    sales: (data as any)?.sales || [],
    stats: (data as any)?.stats,
    total: (data as any)?.total || 0,
    // MULTICNPJ Onda 2.4: presente apenas em consolidated
    breakdown: consolidated?.breakdown || [],
    companyCount: consolidated?.company_count || 1,
    consolidatedView,
    isLoading: isLoading,
    isFetching: isFetching,
    error: error as Error | null,
    refetch: refetch,
  };
}

export function useSaleDetail(saleId: string | null | undefined, companyId?: string) {
  const { company } = useAuthStore();
  // MULTICNPJ Onda 2.4: em consolidated, caller passa companyId do sale.
  const targetCompanyId = companyId || company?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["sale-detail", targetCompanyId, saleId],
    queryFn: function() {
      if (!targetCompanyId || !saleId) throw new Error("missing");
      return salesApi.get(targetCompanyId, saleId);
    },
    enabled: !!targetCompanyId && !!saleId,
    staleTime: 30_000,
    retry: 1,
  });

  return {
    detail: data as SaleDetailFull | undefined,
    isLoading: isLoading,
    error: error as Error | null,
  };
}

export function useCancelSale(companyId?: string) {
  const { company } = useAuthStore();
  // MULTICNPJ Onda 2.4: em consolidated, caller passa companyId do sale.
  const targetCompanyId = companyId || company?.id;
  const qc = useQueryClient();

  function invalidateAll() {
    // Invalida ambos os keys (per-company E consolidated /me)
    qc.invalidateQueries({ queryKey: ["sales-list"] });
    qc.invalidateQueries({ queryKey: ["sale-detail"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["transaction-sale-details"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["me-dashboard"] });
    qc.invalidateQueries({ queryKey: ["dre"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  const mutation = useMutation({
    mutationFn: function(args: { saleId: string; reason?: string }) {
      if (!targetCompanyId) throw new Error("no company");
      return salesApi.cancel(targetCompanyId, args.saleId, args.reason);
    },
    onSuccess: invalidateAll,
  });

  return {
    cancelSale: function(args: { saleId: string; reason?: string }) { return mutation.mutateAsync(args); },
    isCancelling: mutation.isPending,
    error: mutation.error as Error | null,
  };
}

export function useUpdateSaleSeller(companyId?: string) {
  const { company } = useAuthStore();
  // MULTICNPJ Onda 2.4: em consolidated, caller passa companyId do sale.
  const targetCompanyId = companyId || company?.id;
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: function(args: { saleId: string; seller_id: string | null }) {
      if (!targetCompanyId) throw new Error("no company");
      return salesApi.updateSeller(targetCompanyId, args.saleId, args.seller_id);
    },
    onSuccess: function() {
      qc.invalidateQueries({ queryKey: ["sales-list"] });
      qc.invalidateQueries({ queryKey: ["sale-detail"] });
    },
  });

  return {
    updateSeller: function(args: { saleId: string; seller_id: string | null }) { return mutation.mutateAsync(args); },
    isUpdating: mutation.isPending,
    error: mutation.error as Error | null,
  };
}
