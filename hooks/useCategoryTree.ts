// ============================================================
// AURA. — C1: mutações da árvore de categorias (F0)
//
// Hook irmão do useCategories (B3, leitura + create). Aqui ficam as
// mutações que a tela Organizar catálogo precisa: renomear, mover,
// excluir com destino, mesclar, reordenar e clonar de outra unidade.
//
// Arquivo separado de propósito: useCategories é do B3 e D1/D2 vão
// consumi-lo. Mutação em arquivo próprio mantém os PRs disjuntos.
//
// ── O CÓDIGO DE ERRO É O PRODUTO AQUI ───────────────────────
// O contrato §6 define seis erros de negócio, e o §10.1 diz onde eles
// chegam: `err.data.code`, porque services/api.ts faz
// `throw new ApiError(data.error, res.status, data)` e o corpo cru
// inteiro fica em `.data`. Três deles carregam número junto
// (children_count, product_count, existing_id) — é o que permite a tela
// dizer "12 produtos usam esta categoria" em vez de "erro ao excluir".
//
// Traduzir isso aqui, e não na tela, garante que qualquer consumidor
// futuro (D1/D2) receba a mesma mensagem.
// ============================================================
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  categoriesApi,
  type UpdateCategoryBody,
  type DeleteCategoryParams,
  type MoveCategoryBody,
  type MergeCategoriesBody,
  type ReorderCategoriesBody,
  type CloneFromBody,
} from "@/services/categoriesApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

export type CategoryErrorCode =
  | "CATEGORY_HAS_CHILDREN"
  | "CATEGORY_HAS_PRODUCTS"
  | "CATEGORY_DUPLICATE"
  | "CATEGORY_MAX_DEPTH"
  | "CATEGORY_CYCLE"
  | "CATEGORY_CROSS_TENANT";

export type CategoryError = {
  code: CategoryErrorCode | null;
  message: string;
  childrenCount?: number;
  productCount?: number;
  existingId?: string;
};

// Duas famílias de erro chegam diferente (contrato §6):
//   - constraint/rota: código em err.data.code
//   - trigger (P0001): a string vem em err.message, SEM code — por isso
//     o fallback por comparação de mensagem. Mapear só por code deixaria
//     CATEGORY_CYCLE e CATEGORY_CROSS_TENANT virarem erro genérico.
export function parseCategoryError(err: any): CategoryError {
  const data = err?.data || {};
  const raw = String(err?.message || "");

  let code: CategoryErrorCode | null = (data.code as CategoryErrorCode) || null;
  if (!code) {
    if (raw.includes("CATEGORY_CYCLE")) code = "CATEGORY_CYCLE";
    else if (raw.includes("CATEGORY_CROSS_TENANT")) code = "CATEGORY_CROSS_TENANT";
  }

  const mensagens: Record<CategoryErrorCode, string> = {
    CATEGORY_HAS_CHILDREN:
      `Esta categoria tem ${data.children_count ?? "outras"} subcategoria(s). Mova ou exclua antes.`,
    CATEGORY_HAS_PRODUCTS:
      `${data.product_count ?? "Alguns"} produto(s) usam esta categoria. Escolha para onde eles vão.`,
    CATEGORY_DUPLICATE:
      "Já existe uma categoria com esse nome no mesmo nível.",
    CATEGORY_MAX_DEPTH:
      "A árvore vai até três níveis. Este destino criaria um quarto.",
    CATEGORY_CYCLE:
      "Não dá para mover uma categoria para dentro dela mesma.",
    CATEGORY_CROSS_TENANT:
      "Esta categoria pertence a outra empresa.",
  };

  return {
    code,
    message: code ? mensagens[code] : (raw || "Erro ao alterar a categoria"),
    childrenCount: data.children_count,
    productCount: data.product_count,
    existingId: data.existing_id,
  };
}

export function useCategoryTree() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const companyId = company?.id;

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["categories", companyId] });
    // Mudar a árvore muda a categoria exibida no produto — o payload do
    // produto carrega category_id/slug/path desde a D3.
    qc.invalidateQueries({ queryKey: ["products", companyId] });
  }

  // `silent` existe para a exclusão: a tela precisa do 409 para oferecer
  // o destino, e um toast vermelho antes disso seria ruído — o usuário
  // não errou, ele só ainda não escolheu para onde vão os produtos.
  function falhar(err: any, silent?: boolean) {
    const e = parseCategoryError(err);
    if (!silent) toast.error(e.message);
    return e;
  }

  const updateMutation = useMutation({
    mutationFn: ({ catId, body }: { catId: string; body: UpdateCategoryBody }) =>
      categoriesApi.update(companyId!, catId, body),
    onSuccess: invalidate,
    onError: (err) => falhar(err),
  });

  const removeMutation = useMutation({
    mutationFn: ({ catId, params }: { catId: string; params?: DeleteCategoryParams }) =>
      categoriesApi.remove(companyId!, catId, params),
    onSuccess: () => { invalidate(); toast.success("Categoria excluída"); },
    // silencioso: quem chama trata o 409 e oferece o destino
    onError: (err) => falhar(err, true),
  });

  const moveMutation = useMutation({
    mutationFn: ({ catId, body }: { catId: string; body: MoveCategoryBody }) =>
      categoriesApi.move(companyId!, catId, body),
    onSuccess: invalidate,
    onError: (err) => falhar(err),
  });

  const mergeMutation = useMutation({
    mutationFn: (body: MergeCategoriesBody) => categoriesApi.merge(companyId!, body),
    onSuccess: () => { invalidate(); toast.success("Categorias mescladas"); },
    onError: (err) => falhar(err),
  });

  const reorderMutation = useMutation({
    mutationFn: (body: ReorderCategoriesBody) => categoriesApi.reorder(companyId!, body),
    onSuccess: invalidate,
    onError: (err) => falhar(err),
  });

  const cloneMutation = useMutation({
    mutationFn: (body: CloneFromBody) => categoriesApi.cloneFrom(companyId!, body),
    onSuccess: () => { invalidate(); toast.success("Árvore copiada"); },
    onError: (err) => falhar(err),
  });

  return {
    rename: (catId: string, name: string) => updateMutation.mutateAsync({ catId, body: { name } }),
    isRenaming: updateMutation.isPending,

    // Devolve o CategoryError em vez de lançar: a tela precisa ler
    // product_count para montar a escolha de destino.
    remove: async (catId: string, moveTo?: string): Promise<CategoryError | null> => {
      try {
        await removeMutation.mutateAsync({ catId, params: moveTo ? { move_to: moveTo } : undefined });
        return null;
      } catch (err) {
        return parseCategoryError(err);
      }
    },
    isRemoving: removeMutation.isPending,

    move: (catId: string, parentId: string | null, sortOrder?: number) =>
      moveMutation.mutateAsync({ catId, body: { parent_id: parentId, sort_order: sortOrder } }),
    isMoving: moveMutation.isPending,

    merge: (sourceIds: string[], targetId: string) =>
      mergeMutation.mutateAsync({ source_ids: sourceIds, target_id: targetId }),
    isMerging: mergeMutation.isPending,

    reorder: (parentId: string | null, orderedIds: string[]) =>
      reorderMutation.mutateAsync({ parent_id: parentId, ordered_ids: orderedIds }),
    isReordering: reorderMutation.isPending,

    cloneFrom: (sourceCompanyId: string) =>
      cloneMutation.mutateAsync({ source_company_id: sourceCompanyId }),
    isCloning: cloneMutation.isPending,
  };
}

export default useCategoryTree;
