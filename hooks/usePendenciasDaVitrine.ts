import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import type { ItemDoLote } from "@/components/screens/canal/loteDaVitrine";

export type PendenciaCampo = {
  chave: string;
  titulo: string;
  editavel: boolean;
  faltando: number;
};

export type ResumoPendencias = {
  total: number;
  publicadas: number;
  campos: PendenciaCampo[];
};

export type ProdutoPendente = {
  id: string;
  name: string;
  image_url: string | null;
  price: number | null;
  description: string | null;
  size: string | null;
  brand: string | null;
  category: string | null;
};

const api = {
  resumo: (cid: string) =>
    request<ResumoPendencias>(`/companies/${cid}/digital-channel/pendencias`),
  produtos: (cid: string, campo: string, limit: number) =>
    request<{ campo: string; produtos: ProdutoPendente[] }>(
      `/companies/${cid}/digital-channel/pendencias?campo=${encodeURIComponent(campo)}&limit=${limit}`
    ),
  salvarLote: (cid: string, itens: ItemDoLote[]) =>
    request<{ atualizados: number; enviados: number; descartados: number }>(
      `/companies/${cid}/digital-channel/produtos`,
      { method: "PATCH", body: { itens } }
    ),
};

export function usePendencias() {
  const { company } = useAuthStore();
  const cid = company?.id;
  return useQuery({
    queryKey: ["pendenciasVitrine", cid],
    queryFn: () => api.resumo(cid!),
    enabled: !!cid,
    staleTime: 30_000,
  });
}

/** Uma leva por vez: 50 cartões já é mais do que alguém preenche numa sentada. */
export const POR_LEVA = 50;

export function useProdutosPendentes(campo: string | null) {
  const { company } = useAuthStore();
  const cid = company?.id;
  return useQuery({
    queryKey: ["pendenciasVitrine", cid, campo],
    queryFn: () => api.produtos(cid!, campo!, POR_LEVA),
    enabled: !!cid && !!campo,
    staleTime: 0,
  });
}

export function useSalvarEmLote() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const cid = company?.id;

  return useMutation({
    mutationFn: (itens: ItemDoLote[]) => api.salvarLote(cid!, itens),
    onSuccess: (r) => {
      // Invalida a árvore inteira de pendências: salvar tamanho muda a
      // contagem de tamanho E a lista aberta. Invalidar só a lista
      // deixaria o número do card mentindo até recarregar a tela.
      qc.invalidateQueries({ queryKey: ["pendenciasVitrine", cid] });
      // A vitrine mostra descrição e marca — sem isto ela fica velha.
      qc.invalidateQueries({ queryKey: ["digitalChannel", cid] });
      const n = r?.atualizados ?? 0;
      toast.success(n === 1 ? "1 peça atualizada" : `${n} peças atualizadas`);
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar as peças"),
  });
}
