import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { permissionsQueryKey } from "@/utils/permissionsQueryKey";
import { estaEmConsulta } from "@/utils/estoqueConsulta";

// Ponto único da checagem na tela de Estoque (regra em utils/estoqueConsulta).
// Mesma query e mesma chave de useVisibleModules: não custa chamada nova.
//
// `carregando` só vale para membro: o dono nunca espera nem vê diferença.
// Serve para o funcionário não ver os botões piscarem antes de sumirem.
export function useEstoqueConsulta(): { consulta: boolean; carregando: boolean } {
  const { company, token, consolidatedView } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: permissionsQueryKey(company?.id, consolidatedView),
    queryFn: () => request<any>("/auth/my-permissions"),
    enabled: !!token,
    staleTime: 5 * 60000,
    retry: 1,
  });
  const papel = (company as any)?.member_role || "owner";
  return { consulta: estaEmConsulta(data), carregando: isLoading && papel !== "owner" };
}
