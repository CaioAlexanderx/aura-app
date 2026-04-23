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
//   - addItem(body): adiciona produto a venda (EXTRA C, atomico)
//   - updateSeller({employee_id, employee_name}): troca vendedora
//
// Invalida automaticamente queries relacionadas apos mutacoes
// (transactions, dashboard, products, sales-list) pra refletir
// devolucao ou adicao.
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
    qc.invalidateQueries({ queryKey: ["transactions-prev", company?.id] });
    qc.invalidateQueries({ queryKey: ["current-month-expenses", company?.id] });
    qc.invalidateQueries({ queryKey: ["dashboard", company?.id] });
    qc.invalidateQueries({ queryKey: ["dre", company?.id] });
    qc.invalidateQueries({ queryKey: ["products", company?.id] });
    qc.invalidateQueries({ queryKey: ["sales-list", company?.id] });
    qc.invalidateQueries({ queryKey: ["sale-detail", company?.id] });
  }

  const removeItemMutation = useMutation({
    mutationFn: function(itemId: string) {
      return transactionSaleApi.removeItem(company!.id, txId!, itemId);
    },
    onSuccess: invalidateAll,
  });

  // EXTRA C: adicionar produto a venda existente
  const addItemMutation = useMutation({
    mutationFn: function(body: { product_id: string; variant_id?: string | null; quantity: number; unit_price?: number; product_name_snapshot?: string }) {
      return transactionSaleApi.addItem(company!.id, txId!, body);
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
    addItem: function(body: { product_id: string; variant_id?: string | null; quantity: number; unit_price?: number; product_name_snapshot?: string }) {
      return addItemMutation.mutateAsync(body);
    },
    isAdding: addItemMutation.isPending,
    updateSeller: function(args: { employee_id: string | null; employee_name?: string }) {
      return updateSellerMutation.mutateAsync(args);
    },
    isSavingSeller: updateSellerMutation.isPending,
    invalidate: invalidateAll,
  };
}
