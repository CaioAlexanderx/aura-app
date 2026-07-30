import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  categoriesApi,
  type MigrationItemPatchBody,
  type MigrationProposalResponse,
  type MigrationStatus,
  type BrandCandidatesResponse,
  type ApplyBrandBody,
} from "@/services/categoriesApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

// Hook do wizard de migracao (contrato secao 5). O consumidor real e o
// Bloco C2 -- entregue completo e testado mesmo sem tela.
//
// NENHUMA LOGICA DE CLASSIFICACAO AQUI. O hook so transporta a decisao do
// lojista pro servidor: nao sugere `kind`, nao propoe `target_path`, nao
// ordena por "provavel". A fase inteira e sem IA por decisao de produto
// (regra 1 do briefing B3).
export function useCategoryMigration() {
  const { company, token, isDemo } = useAuthStore();
  const qc = useQueryClient();
  const companyId = company?.id;
  const enabled = !!companyId && !!token && !isDemo;

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["categories-migration", companyId] });
  }

  const proposalQuery = useQuery<MigrationProposalResponse>({
    queryKey: ["categories-migration", companyId, "proposal"],
    queryFn: () => categoriesApi.getMigrationProposal(companyId!),
    enabled: false, // disparado pelo wizard depois do analyze, nao no mount
    retry: 1,
  });

  const statusQuery = useQuery<MigrationStatus>({
    queryKey: ["categories-migration", companyId, "status"],
    queryFn: () => categoriesApi.getMigrationStatus(companyId!),
    enabled,
    retry: 1,
    staleTime: 15000,
  });

  const brandCandidatesQuery = useQuery<BrandCandidatesResponse>({
    queryKey: ["categories-migration", companyId, "brand-candidates"],
    queryFn: () => categoriesApi.getBrandCandidates(companyId!),
    enabled: false, // disparado pelo wizard, nao no mount
    retry: 1,
  });

  const analyzeMutation = useMutation({
    mutationFn: () => categoriesApi.analyzeMigration(companyId!),
    onSuccess: () => { invalidate(); proposalQuery.refetch(); },
    onError: (err: any) => toast.error(err?.message || "Erro ao analisar categorias"),
  });

  const patchItemMutation = useMutation({
    // body vem inteiro do wizard (Bloco C2) -- decisao do lojista, sem
    // inferencia neste hook.
    mutationFn: ({ itemId, body }: { itemId: string; body: MigrationItemPatchBody }) =>
      categoriesApi.patchMigrationItem(companyId!, itemId, body),
    onSuccess: () => invalidate(),
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar item"),
  });

  const applyMutation = useMutation({
    mutationFn: () => categoriesApi.applyMigration(companyId!),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["categories", companyId] });
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      toast.success("Migracao aplicada");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao aplicar migracao"),
  });

  const applyBrandMutation = useMutation({
    mutationFn: (body: ApplyBrandBody) => categoriesApi.applyBrandAssignments(companyId!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      toast.success("Marcas aplicadas");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao aplicar marcas"),
  });

  return {
    proposal: proposalQuery.data?.items || [],
    isLoadingProposal: proposalQuery.isLoading,
    refetchProposal: proposalQuery.refetch,
    status: statusQuery.data || null,
    isLoadingStatus: statusQuery.isLoading,
    brandCandidates: brandCandidatesQuery.data?.candidates || [],
    refetchBrandCandidates: brandCandidatesQuery.refetch,
    analyze: () => analyzeMutation.mutateAsync(),
    isAnalyzing: analyzeMutation.isPending,
    patchItem: (itemId: string, body: MigrationItemPatchBody) => patchItemMutation.mutate({ itemId, body }),
    isPatchingItem: patchItemMutation.isPending,
    apply: () => applyMutation.mutateAsync(),
    isApplying: applyMutation.isPending,
    applyBrandAssignments: (body: ApplyBrandBody) => applyBrandMutation.mutateAsync(body),
    isApplyingBrand: applyBrandMutation.isPending,
  };
}

export default useCategoryMigration;
