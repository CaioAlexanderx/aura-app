import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { companiesApi, type CategoryType, type ProductCategoryRow } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

export type ProductCategory = ProductCategoryRow;

// So leitura. Criar, renomear, mover e excluir categoria mora na arvore
// (/catalogo/organizar); o antigo modal do Estoque, unico chamador do CRUD
// plano, foi aposentado.
export function useProductCategories(type: CategoryType = "product") {
  const { company, token, isDemo } = useAuthStore();
  const companyId = company?.id;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["product-categories", companyId, type],
    queryFn: () => companiesApi.productCategories(companyId!, type),
    enabled: !!companyId && !!token && !isDemo,
    retry: 1,
    staleTime: 60000,
  });

  const categories: ProductCategory[] = useMemo(() => {
    return (data?.categories || []) as ProductCategory[];
  }, [data]);

  const categoryNames: string[] = useMemo(() => categories.map(c => c.name), [categories]);

  return {
    type,
    categories,
    categoryNames,
    isLoading: isLoading && !isDemo,
    refetch,
  };
}
