import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  categoriesApi,
  type Category,
  type CreateCategoryBody,
  type AssignProductCategoriesBody,
} from "@/services/categoriesApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

export type { Category };

// Profundidade maxima da arvore (contrato secao 8: CHECK depth 0..2). A UI
// bloqueia "criar subcategoria" ANTES da chamada quando node.depth >=
// MAX_DEPTH -- ver CategoryTreePicker.tsx.
export const MAX_DEPTH = 2;

export function canHaveChildren(node: Pick<Category, "depth"> | null | undefined): boolean {
  return !node || node.depth < MAX_DEPTH;
}

// Normaliza acento + caixa para busca (mesmo padrao ja usado em
// services/companiesApi.ts, inviteMember). "sandalia" acha "Sandália".
export function normalize(str: string): string {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export type FlatCategory = { category: Category; breadcrumb: Category[] };

// Achata a arvore em lista, carregando a cadeia de ancestrais -- usada pra
// mostrar o caminho completo nos resultados de busca ("Feminino > Calcados
// > Botas"). Nunca deriva do `path` (que e slug, nao nome de exibicao).
function flattenTree(nodes: Category[], ancestors: Category[] = []): FlatCategory[] {
  let out: FlatCategory[] = [];
  for (const node of nodes) {
    const breadcrumb = [...ancestors, node];
    out.push({ category: node, breadcrumb });
    if (node.children && node.children.length) {
      out = out.concat(flattenTree(node.children, breadcrumb));
    }
  }
  return out;
}

// Mapeia os codigos de erro do contrato (secao 6) pra mensagem PT-BR. O
// contrato nao especifica o nome exato do campo que carrega o codigo no
// corpo do erro -- assumido `err.data.code`, ver gap no corpo do PR.
function mapCategoryError(err: any): string {
  const code = err?.data?.code;
  if (code === "CATEGORY_HAS_CHILDREN") {
    const n = err?.data?.children_count;
    return "Essa categoria tem " + (n ?? "") + " subcategoria(s). Remova-as antes.";
  }
  if (code === "CATEGORY_HAS_PRODUCTS") {
    const p = err?.data?.product_count;
    return "Essa categoria tem " + (p ?? "") + " produto(s). Mova-os antes de remover.";
  }
  if (code === "CATEGORY_DUPLICATE") return "Ja existe uma categoria com esse nome nesse nivel.";
  if (code === "CATEGORY_MAX_DEPTH") return "Profundidade maxima atingida (3 niveis).";
  if (code === "CATEGORY_CYCLE") return "Nao e possivel mover uma categoria para dentro dela mesma.";
  if (code === "CATEGORY_CROSS_TENANT") return "Erro ao vincular categoria e produto.";
  return err?.message || "Erro ao processar categoria.";
}

export function useCategories() {
  const { company, token, isDemo } = useAuthStore();
  const qc = useQueryClient();
  const companyId = company?.id;
  const enabled = !!companyId && !!token && !isDemo;

  const treeQuery = useQuery({
    queryKey: ["categories", companyId, "tree"],
    queryFn: () => categoriesApi.getTree(companyId!),
    enabled,
    retry: 1,
    staleTime: 60000,
  });

  // GET / e a rota legada -- nunca envia ?type= (regra 6.1 do briefing).
  // Filtra type==='product' no cliente como defesa extra, ja que este hook
  // e product-only por design.
  const flatQuery = useQuery({
    queryKey: ["categories", companyId, "flat"],
    queryFn: () => categoriesApi.getFlat(companyId!),
    enabled,
    retry: 1,
    staleTime: 60000,
  });

  const tree: Category[] = useMemo(() => treeQuery.data?.categories || [], [treeQuery.data]);
  const flatCategories: Category[] = useMemo(
    () => (flatQuery.data?.categories || []).filter((c) => c.type === "product"),
    [flatQuery.data]
  );

  const flattened = useMemo(() => flattenTree(tree), [tree]);

  const byId = useMemo(() => {
    const map: Record<string, Category> = {};
    flattened.forEach((f) => { map[f.category.id] = f.category; });
    return map;
  }, [flattened]);

  // Busca em memoria sobre a arvore ja carregada. Casa em qualquer nivel,
  // insensivel a acento e caixa. Sem IA: so filtra por substring do nome,
  // nao sugere nem ordena por "provavel".
  const search = useCallback(
    (query: string): FlatCategory[] => {
      const q = normalize(query);
      if (!q) return [];
      return flattened.filter((f) => normalize(f.category.name).includes(q));
    },
    [flattened]
  );

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["categories", companyId] });
  }

  const createMutation = useMutation({
    mutationFn: (body: CreateCategoryBody) => categoriesApi.create(companyId!, body),
    onSuccess: () => { invalidate(); toast.success("Categoria criada"); },
    onError: (err: any) => toast.error(mapCategoryError(err)),
  });

  const assignMutation = useMutation({
    mutationFn: ({ productId, body }: { productId: string; body: AssignProductCategoriesBody }) =>
      categoriesApi.assignProductCategories(companyId!, productId, body),
    onSuccess: () => {
      invalidate();
      // products.category muda por trigger no backend quando o vinculo
      // muda -- a lista de produtos fica stale sem isso (briefing 5.1).
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      toast.success("Categorias do produto atualizadas");
    },
    onError: (err: any) => toast.error(mapCategoryError(err)),
  });

  return {
    tree,
    flatCategories,
    flattened,
    byId,
    search,
    isLoading: (treeQuery.isLoading || flatQuery.isLoading) && !isDemo,
    refetch: treeQuery.refetch,
    create: (body: CreateCategoryBody) => createMutation.mutateAsync(body),
    isCreating: createMutation.isPending,
    assignProductCategories: (productId: string, body: AssignProductCategoriesBody) =>
      assignMutation.mutate({ productId, body }),
    isAssigning: assignMutation.isPending,
  };
}

export default useCategories;
