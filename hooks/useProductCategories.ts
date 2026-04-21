import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

export type ProductCategory = {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  product_count: number;
};

export function useProductCategories() {
  const { company, token, isDemo } = useAuthStore();
  const qc = useQueryClient();
  const companyId = company?.id;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["product-categories", companyId],
    queryFn: () => companiesApi.productCategories(companyId!),
    enabled: !!companyId && !!token && !isDemo,
    retry: 1,
    staleTime: 60000,
  });

  const categories: ProductCategory[] = useMemo(() => {
    return (data?.categories || []) as ProductCategory[];
  }, [data]);

  const categoryNames: string[] = useMemo(() => categories.map(c => c.name), [categories]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["product-categories", companyId] });
  }

  const createMutation = useMutation({
    mutationFn: (body: { name: string; color?: string | null; sort_order?: number }) =>
      companiesApi.createProductCategory(companyId!, body),
    onSuccess: () => { invalidate(); toast.success("Categoria criada"); },
    onError: (err: any) => toast.error(err?.message || "Erro ao criar categoria"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ catId, body }: { catId: string; body: { name?: string; color?: string | null; sort_order?: number } }) =>
      companiesApi.updateProductCategory(companyId!, catId, body),
    onSuccess: (res: any) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      const moved = res?.affected_products || 0;
      if (moved > 0) toast.success("Categoria atualizada (" + moved + " produto" + (moved !== 1 ? "s" : "") + " ajustado" + (moved !== 1 ? "s" : "") + ")");
      else toast.success("Categoria atualizada");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao atualizar categoria"),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ catId, moveTo }: { catId: string; moveTo?: string }) =>
      companiesApi.deleteProductCategory(companyId!, catId, moveTo),
    onSuccess: (res: any) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      const moved = res?.moved_products || 0;
      if (moved > 0) toast.success("Categoria removida (" + moved + " produto" + (moved !== 1 ? "s" : "") + " movido" + (moved !== 1 ? "s" : "") + ")");
      else toast.success("Categoria removida");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao remover categoria"),
  });

  return {
    categories,
    categoryNames,
    isLoading: isLoading && !isDemo,
    refetch,
    create: (body: { name: string; color?: string | null; sort_order?: number }) => createMutation.mutate(body),
    update: (catId: string, body: { name?: string; color?: string | null; sort_order?: number }) => updateMutation.mutate({ catId, body }),
    remove: (catId: string, moveTo?: string) => deleteMutation.mutate({ catId, moveTo }),
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
