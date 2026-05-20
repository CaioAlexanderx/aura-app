import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

const api = {
  list:   (cid: string) => request<any>(`/companies/${cid}/payment-gateways`),
  save:   (cid: string, body: any) => request<any>(`/companies/${cid}/payment-gateways`, { method: "POST", body }),
  remove: (cid: string, gateway: string) => request<any>(`/companies/${cid}/payment-gateways/${gateway}`, { method: "DELETE" }),
};

export function usePaymentGateways() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const cid = company?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['paymentGateways', cid],
    queryFn:  () => api.list(cid!),
    enabled:  !!cid,
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: (body: any) => api.save(cid!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paymentGateways', cid] });
      toast.success('Gateway salvo!');
    },
    onError: (err: any) => toast.error(err?.message || 'Erro ao salvar gateway'),
  });

  const removeMutation = useMutation({
    mutationFn: (gateway: string) => api.remove(cid!, gateway),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paymentGateways', cid] });
      toast.success('Gateway removido');
    },
    onError: (err: any) => toast.error(err?.message || 'Erro ao remover gateway'),
  });

  // Extrai o gateway MP da lista retornada
  const mpGateway = (data?.gateways ?? []).find((g: any) => g.gateway === 'mercadopago') ?? null;

  return {
    mpGateway,
    isLoading,
    saveGateway:  saveMutation.mutateAsync,
    isSaving:     saveMutation.isPending,
    removeGateway: removeMutation.mutateAsync,
    isRemoving:   removeMutation.isPending,
  };
}
