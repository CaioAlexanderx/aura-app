import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

// 29/10/2026 (tq-96): conexão por OAuth. O início devolve a URL da tela de
// autorização do Mercado Pago (state assinado no backend, tq-94); a volta
// chega no app com ?mp=conectado|negado|erro. Multi-CNPJ: conecta a empresa
// ativa (company.id do auth store), um token por empresa.
const api = {
  list:   (cid: string) => request<any>(`/companies/${cid}/payment-gateways`),
  save:   (cid: string, body: any) => request<any>(`/companies/${cid}/payment-gateways`, { method: "POST", body }),
  remove: (cid: string, gateway: string) => request<any>(`/companies/${cid}/payment-gateways/${gateway}`, { method: "DELETE" }),
  start:  (cid: string, params: { sandbox?: boolean; volta?: string }) => {
    const qs = new URLSearchParams();
    if (params.sandbox) qs.set("sandbox", "1");
    if (params.volta) qs.set("volta", params.volta);
    const q = qs.toString();
    return request<{ url: string }>(`/companies/${cid}/payment-gateways/mercadopago/oauth/start${q ? `?${q}` : ""}`);
  },
};

export function usePaymentGateways() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const cid = company?.id;

  const { data, isLoading, isFetching, refetch } = useQuery({
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
    },
    onError: (err: any) => toast.error(err?.message || 'Não conseguimos desconectar agora. Tente de novo em instantes.'),
  });

  const startMutation = useMutation({
    mutationFn: (params: { sandbox?: boolean; volta?: string }) => api.start(cid!, params),
    onError: (err: any) => toast.error(err?.message || 'Não conseguimos abrir o Mercado Pago agora. Tente de novo em instantes.'),
  });

  // Extrai o gateway MP da lista retornada
  const mpGateway = (data?.gateways ?? []).find((g: any) => g.gateway === 'mercadopago') ?? null;

  return {
    mpGateway,
    isLoading,
    isFetching,
    refetch,
    oauthDisponivel: data?.oauth_disponivel === true,
    podeConectar: data?.pode_conectar !== false,
    pedidosEmAndamento: Number(data?.pedidos_em_andamento) || 0,
    saveGateway:  saveMutation.mutateAsync,
    isSaving:     saveMutation.isPending,
    removeGateway: removeMutation.mutateAsync,
    isRemoving:   removeMutation.isPending,
    iniciarConexao: startMutation.mutateAsync,
    isIniciando:  startMutation.isPending,
  };
}
