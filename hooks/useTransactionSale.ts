import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { transactionSaleApi, type SaleDetails } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

// ============================================================
// AURA. — Hook para detalhes de venda vinculada a transacao
//
// Usado pelo TransactionModal quando o cliente edita um lancamento
// que veio do PDV (idempotency_key formato "pdv-sale-{uuid}").
//
// Expoe:
//   - details: SaleDetails | undefined
//   - removeItem(itemId): devolucao parcial (atomico no backend)
//   - updateSeller({employee_id, employee_name}): troca vendedora
//
// Invalida automaticamente queries relacionadas apos mutacoes
// (transactions, dashboard, products) pra refletir devolucao.
// ============================================================

export function useTransactionSale(txId: string | null | undefined) {
  const { company } = useAuthStore();
  const qc = useQueryClient();

  const enabled = !!company?.id && !!txId;

  const { data, isLoading, error } = useQuery({
    queryKey: ["transaction-sale-details", company?.id, txId],
    queryFn: function() {
      return transactionSaleApi.getDetails(company!.id, txId!);
    },
    enabled: enabled,
    staleTime: 30_000,
    retry: 1,
  });

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["transaction-sale-details", company?.id, txId] });
    qc.invalidateQueries({ queryKey: ["transactions", company?.id] });
    qc.invalidateQueries({ queryKey: ["dashboard", company?.id] });
    qc.invalidateQueries({ queryKey: ["dre", company?.id] });
    qc.invalidateQueries({ queryKey: ["products", company?.id] });
  }

  const removeItemMutation = useMutation({
    mutationFn: function(itemId: string) {
      return transactionSaleApi.removeItem(company!.id, txId!, itemId);
    },
    onSuccess: invalidateAll,
  });

  const updateSellerMutation = useMutation({
    mutationFn: function(args: { employee_id: string | null; employee_name?: string }) {
      return transactionSaleApi.updateSeller(company!.id, txId!, args.employee_id, args.employee_name);
    },
    onSuccess: invalidateAll,
  });

  return {
    details: data as SaleDetails | undefined,
    isLoading: isLoading,
    error: error as Error | null,
    removeItem: function(itemId: string) { return removeItemMutation.mutateAsync(itemId); },
    isRemoving: removeItemMutation.isPending,
    updateSeller: function(args: { employee_id: string | null; employee_name?: string }) {
      return updateSellerMutation.mutateAsync(args);
    },
    isSavingSeller: updateSellerMutation.isPending,
    invalidate: invalidateAll,
  };
}
