import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import type { Product } from "@/components/screens/estoque/types";

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
  };
}

export function useProducts() {
  const { company, token, isDemo } = useAuthStore();
  const qc = useQueryClient();
  const companyId = company?.id;

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

  // A4: Derive categories from existing products (no defaults if empty)
  const categories: string[] = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return [...cats].sort();
  }, [products]);

  const addMutation = useMutation({
    mutationFn: (body: any) => companiesApi.createProduct(companyId!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      toast.success("Produto cadastrado!");
    },
    onError: () => toast.error("Erro ao salvar produto"),
  });

  // A3: Update product mutation
  const updateMutation = useMutation({
    mutationFn: ({ prodId, body }: { prodId: string; body: any }) => companiesApi.updateProduct(companyId!, prodId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      toast.success("Produto atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar produto"),
  });

  const deleteMutation = useMutation({
    mutationFn: (prodId: string) => companiesApi.deleteProduct(companyId!, prodId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      toast.success("Produto excluido");
    },
    onError: () => toast.error("Erro ao excluir produto"),
  });

  function addProduct(product: Product) {
    if (!companyId) { toast.error("Empresa nao identificada"); return; }
    if (isDemo) return;
    addMutation.mutate({
      name: product.name, sku: product.code !== "---" ? product.code : undefined,
      barcode: product.barcode || undefined, category: product.category,
      price: product.price, cost_price: product.cost, stock_qty: product.stock,
      min_stock: product.minStock, unit: product.unit, description: product.notes || undefined,
    });
  }

  // A3: Update existing product
  function updateProduct(product: Product) {
    if (!companyId || isDemo) return;
    updateMutation.mutate({ prodId: product.id, body: {
      name: product.name, sku: product.code !== "---" ? product.code : undefined,
      barcode: product.barcode || undefined, category: product.category,
      price: product.price, cost_price: product.cost, stock_qty: product.stock,
      min_stock: product.minStock, unit: product.unit, description: product.notes || undefined,
    }});
  }

  // A5: Decrement stock after sale (called from useCart)
  function decrementStock(productId: string, qty: number) {
    if (!companyId || isDemo) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const newStock = Math.max(0, product.stock - qty);
    updateMutation.mutate({ prodId: productId, body: { stock_qty: newStock } });
  }

  function deleteProduct(id: string) {
    if (companyId && !isDemo) deleteMutation.mutate(id);
  }

  return {
    products, categories, isLoading: isLoading && !isDemo, isDemo,
    addProduct, updateProduct, decrementStock, deleteProduct,
    isAdding: addMutation.isPending, isUpdating: updateMutation.isPending, isDeleting: deleteMutation.isPending,
  };
}
