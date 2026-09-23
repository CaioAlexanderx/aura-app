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
  // 19/05/2026: depois da migration que move estoque pras variants
  // (zera products.stock_qty no pai), o stock exibido pra produtos
  // com variantes precisa vir da soma das variant.stock_qty —
  // backend devolve em `variants_stock_total`. Singletons sem variantes
  // continuam usando o stock_qty cru do produto.
  const hasVariants = !!p.has_variants;
  // 22/09/2026 (Matcon M0): parseFloat no lugar de parseInt. Neutro pra
  // quem tem estoque inteiro (12 continua 12); só muda pra quem grava
  // 12,5 m² depois da migration de stock_qty pra numeric(12,3)
  // (docs/CONTRACT_MATCON.md §2). A exibição decide se mostra decimais.
  const rawStock = parseFloat(p.stock_qty ?? p.stock_quantity ?? p.stock) || 0;
  const variantsStock = parseFloat(p.variants_stock_total) || 0;
  const stock = hasVariants ? variantsStock : rawStock;

  return {
    id: p.id || p.product_id || String(Math.random()),
    name: p.name || p.product_name || "Produto",
    code: p.sku || p.code || "---",
    barcode: p.barcode || p.ean || "",
    category: p.category || "Produtos",
    price: parseFloat(p.price || p.sale_price) || 0,
    // 22/09/2026 (preço no cartão, migration 351): null = segue o % da
    // loja. Base atrás da migration devolve undefined -> null.
    cardPrice: p.card_price === null || p.card_price === undefined ? null : (parseFloat(p.card_price) || null),
    cost: parseFloat(p.cost || p.cost_price) || 0,
    stock,
    minStock: parseFloat(p.stock_min ?? p.min_stock ?? p.minStock) || 0,
    unit: p.unit || "un",
    // 22/09/2026 (Matcon M0): conversão compra->venda. Base atrás da
    // migration devolve undefined -> null (mesmo tratamento do
    // duration_minutes abaixo).
    purchaseUnit: p.purchase_unit ?? null,
    purchaseFactor: p.purchase_factor === null || p.purchase_factor === undefined ? null : (parseFloat(p.purchase_factor) || null),
    weightKg: p.weight_kg === null || p.weight_kg === undefined ? null : (parseFloat(p.weight_kg) || null),
    // 22/09/2026 (Matcon M2): fiscal do Simples.
    cest: p.cest ?? null,
    origem: p.origem === null || p.origem === undefined ? null : (parseInt(p.origem, 10) || 0),
    icmsStPaid: p.icms_st_paid === null || p.icms_st_paid === undefined ? null : p.icms_st_paid === true,
    // 22/09/2026 (Matcon M4): `lots_summary` só vem com o gate dos lotes
    // ligado. Ausente -> null, e a lista mostra o estoque de hoje.
    lotsSummary: p.lots_summary && Array.isArray(p.lots_summary.lots)
      ? {
          count: parseInt(p.lots_summary.count, 10) || p.lots_summary.lots.length,
          lots: p.lots_summary.lots.map((l: any) => ({
            id: String(l.id),
            lot_code: String(l.lot_code ?? ""),
            qty: parseFloat(l.qty) || 0,
          })),
        }
      : null,
    brand: p.brand || "",
    notes: p.notes || p.description || "",
    material: p.material || "",
    medidas:  p.medidas  || "",
    cuidados: p.cuidados || "",
    color: p.color || "",
    size: p.size || "",
    // Migration 323 — duração do serviço em minutos. Base atrás da
    // migration devolve undefined; vira null, e o wizard cai na leitura
    // do sufixo antigo da descrição.
    durationMinutes: p.duration_minutes === null || p.duration_minutes === undefined
      ? null
      : (parseInt(p.duration_minutes, 10) || 0),
    image_url: p.image_url || "",
    has_variants: hasVariants,
    variant_barcodes: Array.isArray(p.variant_barcodes) ? p.variant_barcodes : [],
    ncm: p.ncm || "",
    // 23/09/2026 (QA producao): faltava mapear created_at — o sort "recent"
    // do Estoque (estoque.tsx) dependia dele e sempre recebia undefined.
    created_at: p.created_at || null,
  };
}

export function useProducts() {
  const { company, token, isDemo } = useAuthStore();
  const qc = useQueryClient();
  const companyId = company?.id;
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [mergeSuggestion, setMergeSuggestion] = useState<{ nome_base: string; count: number } | null>(null);

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
      // 22/09/2026 (preço no cartão): undefined some do JSON e a coluna
      // nem entra no UPDATE (o cadastro com a opção desligada nunca manda);
      // null volta o produto para o automático (% da loja).
      card_price: product.cardPrice === undefined ? undefined : product.cardPrice,
      cost_price: product.cost,
      stock_qty: product.stock,
      min_stock: product.minStock,
      unit: product.unit,
      description: product.notes || undefined,
      color: product.color || undefined,
      size: product.size || undefined,
      ncm: product.ncm || undefined,
      // 22/09/2026 (Matcon M0): `undefined` some do JSON e a coluna nem
      // entra no UPDATE (loja sem Matcon nunca escreve aqui); `null` é o
      // jeito de LIMPAR a conversão. Por isso `?? undefined`, não `|| undefined`.
      purchase_unit: (product as any).purchaseUnit ?? undefined,
      purchase_factor: (product as any).purchaseFactor ?? undefined,
      weight_kg: (product as any).weightKg ?? undefined,
      // 22/09/2026 (Matcon M2): mesmo tratamento -- undefined nao toca, null limpa.
      cest: (product as any).cest ?? undefined,
      origem: (product as any).origem ?? undefined,
      icms_st_paid: (product as any).icmsStPaid ?? undefined,
      // Migration 305 — ficha tecnica. String vazia LIMPA o campo; por
      // isso nao usa `|| undefined`, que deixaria o valor antigo no banco
      // quando a lojista apagasse o texto.
      material: (product as any).material ?? undefined,
      medidas:  (product as any).medidas  ?? undefined,
      cuidados: (product as any).cuidados ?? undefined,
      // 22/09/2026 (perfil Matcon do cadastro): a marca da ficha. Só o
      // ItemFormModal no perfil Matcon preenche `marca`; em qualquer outro
      // caso é undefined e some do JSON (loja sem Matcon nunca manda).
      brand: (product as any).marca ?? undefined,
      // Migration 323 — duração do serviço. `undefined` some do JSON e a
      // coluna nem entra no UPDATE: produto nunca escreve aqui. Serviço
      // manda número OU null, e null é o jeito de APAGAR a duração —
      // por isso `?? undefined` estaria errado neste campo.
      duration_minutes: product.unit === "srv"
        ? ((product as any).durationMinutes ?? null)
        : undefined,
    };
  }

  const addMutation = useMutation({
    mutationFn: (body: any) => companiesApi.createProduct(companyId!, body),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      toast.success("Produto cadastrado!");
      // Se o backend detectou produtos similares sem variantes, expõe a sugestão
      // para que estoque.tsx possa abrir o MergeDuplicatesModal automaticamente.
      if (data?.merge_suggestion) {
        setMergeSuggestion(data.merge_suggestion);
      }
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar produto"),
  });

  // `silent` (08/09/2026): nasceu para o auto-save campo a campo do
  // wizard, que sumiu em 09/09 — o cadastro aberto grava UMA vez, no
  // Salvar, e quer o toast. A opção fica porque é barata e o próximo
  // fluxo que gravar em rajada vai precisar dela; o erro continua com
  // toast em qualquer caso.
  const updateMutation = useMutation({
    mutationFn: ({ prodId, body }: { prodId: string; body: any; silent?: boolean }) =>
      companiesApi.updateProduct(companyId!, prodId, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      if (!vars?.silent) toast.success("Produto atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar produto"),
  });

  const deleteMutation = useMutation({
    mutationFn: (prodId: string) => companiesApi.deleteProduct(companyId!, prodId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products", companyId] }); toast.success("Produto excluido"); },
    onError: () => toast.error("Erro ao excluir produto"),
  });

  // D1 (F0): passa a DEVOLVER o produto criado. O cadastro precisa do id
  // real para vincular a categoria escolhida no picker -- vinculo so
  // existe depois que a linha existe.
  //
  // mutate -> mutateAsync com try/catch: mutateAsync LANCA em erro, e sem
  // o catch um cadastro que falha viraria unhandled rejection. O
  // onError da mutation ja mostra o toast, entao o catch e silencioso de
  // proposito -- o comportamento visivel para quem nao usa o retorno
  // continua identico ao de antes.
  async function addProduct(product: Product): Promise<any | null> {
    // FIX(9): mensagem clara para conta de funcionario sem empresa associada
    if (!companyId) { toast.error("Sua conta não esta associada a uma empresa. Contate o administrador."); return null; }
    if (isDemo) return null;
    try {
      return await addMutation.mutateAsync(buildBody(product));
    } catch (_) {
      return null;
    }
  }

  // Devolve true quando o PATCH aterrissou. O cadastro usa isso para so
  // fechar o modal depois da resposta -- fechar no disparo mente quando a
  // rede falha. O catch e silencioso de proposito: o onError da mutation
  // ja mostra o toast.
  async function updateProduct(product: Product, opts?: { silent?: boolean }): Promise<boolean> {
    if (!companyId || isDemo) return false;
    try {
      await updateMutation.mutateAsync({ prodId: product.id, body: buildBody(product), silent: opts?.silent });
      return true;
    } catch (_) {
      return false;
    }
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
    mergeSuggestion, clearMergeSuggestion: () => setMergeSuggestion(null),
  };
}
