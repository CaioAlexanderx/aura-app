import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import type { Product } from "@/components/screens/estoque/types";

async function deleteBatched(
  ids: string[],
  deleteFn: (id: string) => Promise<any>,
  batchSize = 10
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(id => deleteFn(id)));
    succeeded += results.filter(r => r.status === "fulfilled").length;
    failed    += results.filter(r => r.status === "rejected").length;
  }
  return { succeeded, failed };
}

function mapApiProduct(p: any): Product {
  return {
    id: p.id || p.product_id || String(Math.random()),
    name: p.name || p.product_name || "Produto",
    code: p.sku || p.code || "---",
    barcode: p.barcode || p.ean || "",
    category: p.category || "Produtos",
    price: parseFloat(p.price || p.sale_price) || 0,
    cost: parseFloat(p.cost || p.cost_price) || 0,
    stock: parseInt(p.stock_qty ?? p.stock_quantity ?? p.stock) || 0,
    minStock: parseInt(p.stock_min ?? p.min_stock ?? p.minStock) || 0,
    abc: (p.abc_class || p.abc || "C") as "A" | "B" | "C",
    sold30d: parseInt(p.sold_30d ?? p.sold30d) || 0,
    unit: p.unit || "un",
    brand: p.brand || "",
    notes: p.notes || p.description || "",
    color: p.color || "",
    size: p.size || "",
    image_url: p.image_url || "",
    has_variants: !!p.has_variants,
  };
}

export function useProducts() {
  const { company, token, isDemo } = useAuthStore();
  const qc = useQueryClient();
  const companyId = company?.id;
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const { data: apiData, isLoading } = useQuery({
    queryKey: ["products", companyId],
    queryFn: () => companiesApi.products(companyId!),
    enabled: !!companyId && !!token && !isDemo,
    retry: 1,
    staleTime: 30000,
  });

  const products: Product[] = useMemo(() => {
    if (isDemo) return [];
    const arr = apiData?.products || apiData?.rows || apiData;
    if (!(arr instanceof Array)) return [];
    return arr.map(mapApiProduct);
  }, [apiData, isDemo]);

  const categories: string[] = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return [...cats].sort();
  }, [products]);

  function buildBody(product: Product) {
    return {
      name: product.name,
      sku: product.code !== "---" ? product.code : undefined,
      barcode: product.barcode || undefined,
      category: product.category,
      price: product.price,
      cost_price: product.cost,
      stock_qty: product.stock,
      min_stock: product.minStock,
      unit: product.unit,
      description: product.notes || undefined,
      color: product.color || undefined,
      size: product.size || undefined,
    };
  }

  const addMutation = useMutation({
    mutationFn: (body: any) => companiesApi.createProduct(companyId!, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products", companyId] }); toast.success("Produto cadastrado!"); },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar produto"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ prodId, body }: { prodId: string; body: any }) => companiesApi.updateProduct(companyId!, prodId, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products", companyId] }); toast.success("Produto atualizado!"); },
    onError: () => toast.error("Erro ao atualizar produto"),
  });

  const deleteMutation = useMutation({
    mutationFn: (prodId: string) => companiesApi.deleteProduct(companyId!, prodId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products", companyId] }); toast.success("Produto excluido"); },
    onError: () => toast.error("Erro ao excluir produto"),
  });

  function addProduct(product: Product) {
    if (!companyId) { toast.error("Empresa nao identificada"); return; }
    if (isDemo) return;
    addMutation.mutate(buildBody(product));
  }

  function updateProduct(product: Product) {
    if (!companyId || isDemo) return;
    updateMutation.mutate({ prodId: product.id, body: buildBody(product) });
  }

  function decrementStock(productId: string, qty: number) {
    if (!companyId || isDemo) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;
    updateMutation.mutate({ prodId: productId, body: { stock_qty: Math.max(0, product.stock - qty) } });
  }

  function deleteProduct(id: string) {
    if (companyId && !isDemo) deleteMutation.mutate(id);
  }

  async function bulkDeleteProducts(ids: string[]) {
    if (!companyId || isDemo || ids.length === 0) return;
    setBulkDeleting(true);
    if (ids.length > 20) toast.info(`Excluindo ${ids.length} produtos...`);
    try {
      const { succeeded, failed } = await deleteBatched(
        ids,
        (id) => companiesApi.deleteProduct(companyId!, id),
        10
      );
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      if (failed === 0) {
        toast.success(`${succeeded} produto${succeeded !== 1 ? "s" : ""} excluido${succeeded !== 1 ? "s" : ""}`);
      } else {
        toast.error(`${succeeded} excluidos, ${failed} com erro`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir produtos selecionados");
    } finally {
      setBulkDeleting(false);
    }
  }

  return {
    products, categories, isLoading: isLoading && !isDemo, isDemo, bulkDeleting,
    addProduct, updateProduct, decrementStock, deleteProduct, bulkDeleteProducts,
    isAdding: addMutation.isPending, isUpdating: updateMutation.isPending, isDeleting: deleteMutation.isPending,
  };
}
