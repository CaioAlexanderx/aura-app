// ============================================================
// AURA. — Produtos sem categoria: listagem + atribuição em lote (F0)
//
// Consome `/products/unclassified` e `/products/categories/bulk`, que o
// B1 construiu e que nunca tiveram tela.
//
// ── POR QUE ISTO EXISTE ─────────────────────────────────────
// Medido na Davi em 18/08 pelo índice de saúde (E1): dos 1.434 produtos
// ativos, só 251 têm categoria em texto. Os outros **1.183 são órfãos**
// — não têm categoria por caminho nenhum.
//
// O wizard de migração (C2) NÃO alcança esses: ele classifica textos
// existentes, e aqui não há texto para classificar. Sem esta tela, o
// piloto organiza 17,5% do catálogo e o resto segue invisível na
// navegação da loja.
//
// ── O `mode` NÃO É DETALHE ──────────────────────────────────
// O contrato §4 é explícito: o índice parcial one_primary faz um
// `INSERT ... ON CONFLICT DO NOTHING` de primária FALHAR EM SILÊNCIO num
// produto que já tem primária — o endpoint devolve 200 e não muda nada.
//   replace_primary → desmarca a primária antes; é o que corrige.
//   add_secondary   → adiciona sem tocar na primária.
// Para produto órfão os dois dariam no mesmo, mas a tela permite
// reclassificar quem já tem categoria — e aí a diferença é tudo.
// ============================================================
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  categoriesApi,
  type UnclassifiedParams,
  type UnclassifiedProductsResponse,
  type BulkAssignMode,
} from "@/services/categoriesApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

export function useUnclassifiedProducts(params: UnclassifiedParams = {}) {
  const { company, token, isDemo } = useAuthStore();
  const qc = useQueryClient();
  const companyId = company?.id;
  const enabled = !!companyId && !!token && !isDemo;

  const query = useQuery<UnclassifiedProductsResponse>({
    queryKey: ["products-unclassified", companyId, params.q, params.has_stock, params.limit, params.offset],
    queryFn: () => categoriesApi.getUnclassifiedProducts(companyId!, params),
    enabled,
    retry: 1,
  });

  const bulkMutation = useMutation({
    mutationFn: (body: { product_ids: string[]; primary_category_id: string; mode: BulkAssignMode }) =>
      categoriesApi.bulkAssignProductCategories(companyId!, body),
    onSuccess: (data) => {
      // A lista encolhe (os produtos saem de "sem categoria") e o placar
      // do catálogo muda — ambos precisam refazer a conta.
      qc.invalidateQueries({ queryKey: ["products-unclassified", companyId] });
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      qc.invalidateQueries({ queryKey: ["categories", companyId] });
      qc.invalidateQueries({ queryKey: ["catalog-health", companyId] });
      toast.success(`${data?.updated ?? 0} produto(s) categorizado(s)`);
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao categorizar em lote"),
  });

  return {
    produtos: query.data?.products || [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    refetch: query.refetch,
    atribuirEmLote: (
      productIds: string[],
      categoryId: string,
      mode: BulkAssignMode = "replace_primary"
    ) =>
      bulkMutation.mutateAsync({
        product_ids: productIds,
        primary_category_id: categoryId,
        mode,
      }),
    isAtribuindo: bulkMutation.isPending,
  };
}

export default useUnclassifiedProducts;
