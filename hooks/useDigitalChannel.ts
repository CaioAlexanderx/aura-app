import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

export function useDigitalChannel() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const cid = company?.id;

  const { data: config, isLoading } = useQuery({
    queryKey: ['digitalChannel', cid],
    queryFn: () => companiesApi.digitalChannel(cid!),
    enabled: !!cid,
    staleTime: 60_000,
  });

  const { data: productsData } = useQuery({
    queryKey: ['products', cid],
    queryFn: () => companiesApi.products(cid!),
    enabled: !!cid,
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: (body: any) => companiesApi.updateDigitalChannel(cid!, body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['digitalChannel', cid] });
      toast.success('Configuracoes salvas');
    },
    onError: (err: any) => toast.error(err?.message || 'Erro ao salvar'),
  });

  const domainMutation = useMutation({
    mutationFn: ({ domain, plan }: { domain: string; plan: string }) =>
      companiesApi.requestDomain(cid!, domain, plan),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['digitalChannel', cid] });
      toast.success('Solicitacao de dominio registrada!');
    },
    onError: (err: any) => toast.error(err?.message || 'Erro ao solicitar dominio'),
  });

  const allProducts = productsData?.products || productsData || [];
  const productsList = Array.isArray(allProducts) ? allProducts : [];

  return {
    config: config || {},
    products: productsList,
    isLoading,
    saveConfig: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    requestDomain: domainMutation.mutateAsync,
    isRequestingDomain: domainMutation.isPending,
  };
}
