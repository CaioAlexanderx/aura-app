import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

// Direct API calls (avoid modifying the large api.ts file)
const digitalChannelApi = {
  get: (cid: string) => request<any>(`/companies/${cid}/digital-channel`),
  save: (cid: string, body: any) => request<any>(`/companies/${cid}/digital-channel`, { method: "PUT", body }),
  requestDomain: (cid: string, domain: string, plan: string) => request<any>(`/companies/${cid}/digital-channel/request-domain`, { method: "POST", body: { domain, plan } }),
  uploadImage: (cid: string, type: "logo" | "banner", content: string, content_type: string) =>
    request<{ logo_url?: string; cover_url?: string }>(`/companies/${cid}/digital-channel/upload-image?type=${type}`, { method: "POST", body: { content, content_type } }),
  setupPix: (cid: string, body: any) =>
    request<{ success: boolean; message: string }>(`/companies/${cid}/digital-channel/setup-pix`, { method: "POST", body }),
};

export function useDigitalChannel() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const cid = company?.id;

  const { data: config, isLoading } = useQuery({
    queryKey: ['digitalChannel', cid],
    queryFn: () => digitalChannelApi.get(cid!),
    enabled: !!cid,
    staleTime: 60_000,
  });

  // FIX (14/05/2026): produtos removidos deste hook.
  // Antes: companiesApi.products(cid!) carregava TODOS os produtos sem limite.
  // Davi tem 4950+ produtos — carregar tudo de uma vez travava/derrubava a aba do browser.
  // Solução: TabVitrine faz sua própria query paginada (60 por vez + busca por nome).

  const saveMutation = useMutation({
    mutationFn: (body: any) => digitalChannelApi.save(cid!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['digitalChannel', cid] });
      toast.success('Configuracoes salvas');
    },
    onError: (err: any) => toast.error(err?.message || 'Erro ao salvar'),
  });

  const domainMutation = useMutation({
    mutationFn: ({ domain, plan }: { domain: string; plan: string }) =>
      digitalChannelApi.requestDomain(cid!, domain, plan),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['digitalChannel', cid] });
      toast.success('Solicitacao de dominio registrada!');
    },
    onError: (err: any) => toast.error(err?.message || 'Erro ao solicitar dominio'),
  });

  const uploadImageMutation = useMutation({
    mutationFn: ({ type, content, content_type }: { type: "logo" | "banner"; content: string; content_type: string }) =>
      digitalChannelApi.uploadImage(cid!, type, content, content_type),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['digitalChannel', cid] });
      toast.success('Imagem salva');
    },
    onError: (err: any) => toast.error(err?.message || 'Erro ao salvar imagem'),
  });

  const setupPixMutation = useMutation({
    mutationFn: (body: any) => digitalChannelApi.setupPix(cid!, body),
    onSuccess: () => {
      useAuthStore.getState().hydrate();
      qc.invalidateQueries({ queryKey: ['digitalChannel', cid] });
      toast.success('Pix ativado com sucesso!');
    },
    onError: (err: any) => toast.error(err?.message || 'Erro ao ativar Pix'),
  });

  return {
    config: config || {},
    isLoading,
    saveConfig: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    requestDomain: domainMutation.mutateAsync,
    isRequestingDomain: domainMutation.isPending,
    uploadImage: uploadImageMutation.mutateAsync,
    isUploadingImage: uploadImageMutation.isPending,
    setupPix: setupPixMutation.mutateAsync,
    isSettingUpPix: setupPixMutation.isPending,
  };
}
