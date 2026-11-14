import { useQuery, useQueryClient } from "@tanstack/react-query";
import { campanhaLojaApi, type EstadoDaCampanha, type MudancaDaCampanha } from "@/services/campanhaLojaApi";

// ============================================================
// AURA. — Campanha de Black Friday da loja online (p-120, 14/11/2026)
//
// O estado da seção "Black Friday na loja online" da página Black Friday.
// `disponivel` só fica true quando o backend respondeu E a empresa tem loja
// online (configurada). 404 (backend sem a rota), 403 (plano Essencial ou
// sem permissão), 503 (migration pendente) ou falha = a seção não aparece,
// como o De/Por: melhor esconder do que mostrar uma função que falha.
// ============================================================

export var CHAVE_CAMPANHA_LOJA = "campanha-loja-online";

export type CampanhaDaLoja = {
  disponivel: boolean;
  carregando: boolean;
  estado: EstadoDaCampanha | undefined;
  /** Grava e troca o estado na tela pelo que o servidor devolveu. */
  salvar: (mudanca: MudancaDaCampanha) => Promise<EstadoDaCampanha>;
  recarregar: () => void;
};

export function useCampanhaDaLoja(companyId: string | undefined, ligado: boolean): CampanhaDaLoja {
  var qc = useQueryClient();
  var q = useQuery({
    queryKey: [CHAVE_CAMPANHA_LOJA, companyId],
    queryFn: () => campanhaLojaApi.estado(companyId!),
    enabled: !!companyId && ligado,
    staleTime: 30000,
    retry: false,
  });
  var estado = q.data;
  return {
    disponivel: ligado && !!companyId && q.isSuccess && !!estado && !!estado.loja_online && estado.loja_online.existe === true,
    carregando: q.isLoading,
    estado: estado,
    salvar: async function (mudanca) {
      var novo = await campanhaLojaApi.salvar(companyId!, mudanca);
      qc.setQueryData([CHAVE_CAMPANHA_LOJA, companyId], novo);
      return novo;
    },
    recarregar: function () {
      qc.invalidateQueries({ queryKey: [CHAVE_CAMPANHA_LOJA, companyId] });
    },
  };
}
