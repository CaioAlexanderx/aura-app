// ============================================================
// AURA. — Financeiro › Relatórios › Produtos (p-115a)
//
// useEstadoDoRelatorio: modelo → filtros/colunas/ordem/agrupar num reducer
// (utils/relatorioProdutos.ts). O p-115b pluga o painel "Ajustar o
// relatório" despachando as ações `filtro`, `colunas`, `alternarColuna` e
// `agrupar` — a tela e a query já seguem o estado.
//
// useRelatorioProdutos: GET /companies/:id/relatorios/produtos, página a
// página (limit 50; 200 no "Estoque acabando"), com "Mostrar mais".
// Loja ou consolidado: no "Todas as lojas" (consolidatedView) vai
// escopo=grupo, e o backend soma as lojas do grupo que a pessoa alcança.
// ============================================================
import { useMemo, useReducer, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { request, ApiError } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import {
  estadoInicial, estadoReducer, parametrosDaQuery, queryString, limiteDaPagina,
  PERIODO_INICIAL, type EstadoRelatorio, type PeriodoRelatorio, type RespostaRelatorio,
} from "@/utils/relatorioProdutos";

export function useEstadoDoRelatorio() {
  var [estado, despachar] = useReducer(estadoReducer, undefined, estadoInicial);
  var [periodo, setPeriodo] = useState<PeriodoRelatorio>(PERIODO_INICIAL);
  var [deBR, setDeBR] = useState("");
  var [ateBR, setAteBR] = useState("");
  return { estado, despachar, periodo, setPeriodo, deBR, setDeBR, ateBR, setAteBR };
}

export type ErroDoRelatorio = {
  code: string | null;
  status: number;
  mensagem: string;
  modelosSemCusto: string[] | null;
};

export function lerErroDoRelatorio(err: unknown): ErroDoRelatorio | null {
  if (!err) return null;
  if (err instanceof ApiError) {
    var data: any = err.data || {};
    return {
      code: (data && data.code) || err.code || null,
      status: err.status,
      mensagem: err.message,
      modelosSemCusto: Array.isArray(data && data.modelos_sem_custo) ? data.modelos_sem_custo : null,
    };
  }
  return { code: null, status: 0, mensagem: (err as any)?.message || "", modelosSemCusto: null };
}

export function useRelatorioProdutos(p: {
  estado: EstadoRelatorio;
  faixa: { de: string; ate: string } | null;
  podeVerCusto: boolean;
  habilitado: boolean;
}) {
  var { company, token, consolidatedView, isDemo } = useAuthStore();
  var companyId = company?.id;
  var consolidado = !!consolidatedView;
  var limit = limiteDaPagina(p.estado);

  var base = useMemo(function() {
    if (!p.faixa) return null;
    return parametrosDaQuery(p.estado, { de: p.faixa.de, ate: p.faixa.ate, consolidado: consolidado, podeVerCusto: p.podeVerCusto, limit: limit })
      .filter(function(par) { return par[0] !== "offset"; });
  }, [p.estado, p.faixa && p.faixa.de, p.faixa && p.faixa.ate, consolidado, p.podeVerCusto, limit]);

  var chave = base ? queryString(base) : "";

  var q = useInfiniteQuery({
    queryKey: ["relatorio-produtos", consolidado ? "all" : companyId, chave],
    initialPageParam: 0,
    queryFn: function(ctx: { pageParam: number }) {
      var qs = chave + "&offset=" + ctx.pageParam;
      return request<RespostaRelatorio>("/companies/" + companyId + "/relatorios/produtos?" + qs, { retry: 1, timeout: 20000 });
    },
    getNextPageParam: function(ultima: RespostaRelatorio, paginas: RespostaRelatorio[]) {
      var lidas = paginas.reduce(function(a, pg) { return a + (pg.linhas ? pg.linhas.length : 0); }, 0);
      if (!ultima || !ultima.linhas || ultima.linhas.length === 0) return undefined;
      return lidas < ultima.total_linhas ? lidas : undefined;
    },
    enabled: p.habilitado && !!base && !!companyId && !!token && !isDemo,
    staleTime: 30000,
    retry: function(n: number, err: unknown) {
      // 4xx não melhora repetindo; 503 (DB_CONN_TRANSIENT) tenta mais uma vez.
      return err instanceof ApiError && err.status === 503 && n < 1;
    },
  });

  var paginas = (q.data && q.data.pages) || [];
  var primeira = paginas[0] || null;
  var linhas = useMemo(function() {
    return paginas.reduce(function(a: RespostaRelatorio["linhas"], pg) { return a.concat(pg.linhas || []); }, []);
  }, [q.data]);

  return {
    resposta: primeira,
    linhas: linhas,
    carregando: q.isLoading,
    buscando: q.isFetching,
    erro: lerErroDoRelatorio(q.error),
    temMais: !!q.hasNextPage,
    carregandoMais: q.isFetchingNextPage,
    mostrarMais: function() { if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage(); },
    tentarDeNovo: function() { q.refetch(); },
    consolidado: consolidado,
  };
}
