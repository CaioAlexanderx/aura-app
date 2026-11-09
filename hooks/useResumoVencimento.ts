import { useQuery, useQueryClient } from "@tanstack/react-query";
import { resumoVencimentoApi, type PeriodoDoResumo, type ResumoVencimento } from "@/services/resumoVencimentoApi";

// ============================================================
// AURA. — O que vence em janeiro no crediário (p-91, 09/11/2026)
//
// Uma query por (empresa ou consolidado, período). Multi-CNPJ desde o
// desenho: no consolidado (`consolidado`) a chamada vai em /me/... e o
// backend soma as empresas com crediário ligado; numa empresa só, em
// /companies/:id/....
//
// `disponivel` só fica true quando o backend respondeu: 404 (backend sem a
// rota), 403 (crediário desligado nas Políticas do Caixa, ou plano sem
// crediário) ou falha = a seção não aparece. Melhor esconder do que mostrar
// uma função que falha. No consolidado sem nenhuma empresa com crediário
// (`empresas` vazia) também some.
// ============================================================

export var CHAVE_RESUMO_VENCIMENTO = "credit-resumo-vencimento";

export type ResumoDoJaneiro = {
  disponivel: boolean;
  carregando: boolean;
  dados: ResumoVencimento | undefined;
  /** Relê o resumo (depois de lançar um crediário). */
  recarregar: () => void;
};

export function useResumoVencimento(p: {
  companyId: string | undefined;
  consolidado: boolean;
  ligado: boolean;
  periodo: PeriodoDoResumo;
}): ResumoDoJaneiro {
  var qc = useQueryClient();
  var escopo = p.consolidado ? "me" : p.companyId;
  var habilitado = p.ligado && !!escopo;
  var q = useQuery({
    queryKey: [CHAVE_RESUMO_VENCIMENTO, escopo, p.periodo.de, p.periodo.ate],
    queryFn: function () {
      return p.consolidado
        ? resumoVencimentoApi.consolidado(p.periodo)
        : resumoVencimentoApi.daEmpresa(p.companyId as string, p.periodo);
    },
    enabled: habilitado,
    staleTime: 60000,
    retry: false,
  });
  var dados = q.data;
  var temEmpresa = !p.consolidado || !!(dados && dados.empresas.length > 0);
  return {
    disponivel: habilitado && q.isSuccess && !!dados && temEmpresa,
    carregando: q.isLoading,
    dados: dados,
    recarregar: function () {
      qc.invalidateQueries({ queryKey: [CHAVE_RESUMO_VENCIMENTO] });
    },
  };
}
