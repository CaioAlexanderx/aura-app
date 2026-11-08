import { useQuery, useQueryClient } from "@tanstack/react-query";
import { promocoesApi, type ItemDaLista, type StatusPromocao } from "@/services/promocoesApi";

// ============================================================
// AURA. — Promoções De/Por da empresa ativa (p-86, 08/11/2026)
//
// As três listas da seção da página Black Friday. `disponivel` só fica true
// quando o backend respondeu a lista "ativa": 404 (backend sem a rota),
// 403 (perfil consulta) ou falha = a seção não aparece. Melhor esconder do
// que mostrar uma função que falha.
// ============================================================

export var CHAVE_PROMOCOES = "promocoes-de-por";

export type PromocoesDePor = {
  disponivel: boolean;
  carregando: boolean;
  ativa: ItemDaLista[];
  agendada: ItemDaLista[];
  encerrada: ItemDaLista[];
  recarregar: () => void;
};

function useLista(companyId: string | undefined, status: StatusPromocao, ligado: boolean) {
  return useQuery({
    queryKey: [CHAVE_PROMOCOES, companyId, status],
    queryFn: () => promocoesApi.lista(companyId!, status),
    enabled: !!companyId && ligado,
    staleTime: 60000,
    retry: false,
  });
}

export function usePromocoesDePor(companyId: string | undefined, ligado: boolean): PromocoesDePor {
  var qc = useQueryClient();
  var ativa = useLista(companyId, "ativa", ligado);
  var disponivel = ligado && !!companyId && ativa.isSuccess;
  var agendada = useLista(companyId, "agendada", disponivel);
  var encerrada = useLista(companyId, "encerrada", disponivel);
  return {
    disponivel: disponivel,
    carregando: ativa.isLoading,
    ativa: ativa.data || [],
    agendada: agendada.data || [],
    encerrada: encerrada.data || [],
    recarregar: function () {
      qc.invalidateQueries({ queryKey: [CHAVE_PROMOCOES, companyId] });
      // O preço que vale mudou: Estoque e Caixa releem os produtos.
      qc.invalidateQueries({ queryKey: ["products", companyId] });
    },
  };
}
