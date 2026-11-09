// ============================================================
// AURA. — Categorias do Financeiro da loja ativa (09/11/2026)
//
// Uma query por loja (decisão 1 do Caio: categorias por loja). No consolidado
// não há loja para mostrar: o hook fica desligado e quem usa cai na lista
// fixa (o modal de lançamento nem abre no consolidado).
//
// Backend sem a migration 434 responde 503 (FINANCE_CATEGORIES_UNAVAILABLE)
// ou 404: `lista` vem null e o app segue com a lista fixa de antes.
// ============================================================
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/services/api";
import { financeCategoriesApi, type ListaDeCategorias, type NovaCategoria } from "@/services/financeCategoriesApi";
import { useAuthStore } from "@/stores/auth";

export function chaveDasCategorias(cid: string | null | undefined, incluirArquivadas?: boolean) {
  return ["finance-categories", cid || "-", incluirArquivadas ? "todas" : "ativas"];
}

export function useFinanceCategories(opts?: { incluirArquivadas?: boolean; enabled?: boolean }) {
  var { company, token, isDemo, consolidatedView } = useAuthStore();
  var cid = company?.id;
  var incluir = !!(opts && opts.incluirArquivadas);
  var qc = useQueryClient();
  var ligado = !!cid && !!token && !isDemo && !consolidatedView && (opts?.enabled !== false);

  var q = useQuery({
    queryKey: chaveDasCategorias(cid, incluir),
    queryFn: async function(): Promise<ListaDeCategorias | null> {
      try {
        return await financeCategoriesApi.listar(cid!, { incluirArquivadas: incluir });
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 503)) return null;
        throw err;
      }
    },
    enabled: ligado,
    staleTime: 60_000,
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["finance-categories"] });
  }

  async function criar(body: NovaCategoria) {
    var out = await financeCategoriesApi.criar(cid!, body);
    invalidar();
    return out;
  }

  return {
    lista: q.data || null,
    carregando: q.isLoading && ligado,
    erro: q.isError,
    refetch: q.refetch,
    invalidar: invalidar,
    criar: criar,
    companyId: cid || null,
  };
}
