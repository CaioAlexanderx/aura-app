import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { permissionsQueryKey } from "@/utils/permissionsQueryKey";
import { estaEmConsulta, podeVerCusto } from "@/utils/estoqueConsulta";

// Ponto único da checagem na tela de Estoque (regra em utils/estoqueConsulta).
// Mesma query e mesma chave de useVisibleModules: não custa chamada nova.
//
// `carregando` só vale para membro: o dono nunca espera nem vê diferença.
// Serve para o funcionário não ver os botões piscarem antes de sumirem.
//
// 03/11/2026: `semCusto` — não mostra custo, margem nem valor do estoque
// (consulta OU funcionário sem retaguarda; regra em podeVerCusto). Enquanto
// a permissão de um membro carrega, fica escondido (não pisca o custo).
export function useEstoqueConsulta(): { consulta: boolean; carregando: boolean; semCusto: boolean } {
  const { company, token, consolidatedView } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: permissionsQueryKey(company?.id, consolidatedView),
    queryFn: () => request<any>("/auth/my-permissions"),
    enabled: !!token,
    staleTime: 5 * 60000,
    retry: 1,
  });
  const papel = (company as any)?.member_role || "owner";
  const carregando = isLoading && papel !== "owner";
  const consulta = estaEmConsulta(data);
  return { consulta, carregando, semCusto: consulta || carregando || !podeVerCusto(data) };
}
