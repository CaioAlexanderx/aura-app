// ============================================================
// Gestão Aura › Hoje — camada de dados.
//
// HOJE: devolve os dados estáticos de 13/10 (dadosEstaticos.ts).
// AMANHÃ: a troca é só no objeto `fonte` abaixo — cada função passa a ser
// uma chamada do adminApi, por exemplo:
//   hoje:  function() { return adminApi.painel.hoje(); },
//   bloco: function(id) { return adminApi.painel.bloco(id); },
// e os `initialData` dos hooks saem. Tela e componentes não mudam.
// ============================================================
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CATALOGO, DETALHES, FICHAS, LAYOUT_PADRAO, PAINEL_HOJE } from "./dadosEstaticos";
import type { BlocoDetalhe, BlocoId, FichaCliente, ItemCatalogo, PainelHoje } from "./tipos";

var fonte = {
  hoje: function(): Promise<PainelHoje> { return Promise.resolve(PAINEL_HOJE); },
  bloco: function(id: BlocoId): Promise<BlocoDetalhe | null> { return Promise.resolve(DETALHES[id] || null); },
  ficha: function(companyId: string): Promise<FichaCliente | null> { return Promise.resolve(FICHAS[companyId] || null); },
  layout: function(): Promise<BlocoId[]> { return Promise.resolve(LAYOUT_PADRAO); },
  // POST /admin/painel/recalcular quando existir.
  recalcular: function(): Promise<void> { return Promise.resolve(); },
};

// true enquanto `fonte` devolve os dados estáticos; a tela avisa quem lê.
export var PAINEL_COM_DADOS_DE_EXEMPLO = true;

export function usePainelHoje() {
  var qc = useQueryClient();
  var q = useQuery<PainelHoje>({
    queryKey: ["admin-painel-hoje"],
    queryFn: fonte.hoje,
    initialData: PAINEL_HOJE,
    staleTime: 60_000,
  });
  var layout = useQuery<BlocoId[]>({
    queryKey: ["admin-painel-layout"],
    queryFn: fonte.layout,
    initialData: LAYOUT_PADRAO,
    staleTime: Infinity,
  });
  async function recalcular() {
    await fonte.recalcular();
    await qc.invalidateQueries({ queryKey: ["admin-painel-hoje"] });
  }
  return {
    painel: q.data,
    carregando: q.isLoading,
    erro: q.isError,
    layoutPadrao: layout.data,
    catalogo: CATALOGO as ItemCatalogo[],
    recalcular: recalcular,
  };
}

// Detalhe do card expandido. `id` nulo = nada aberto, não busca.
export function usePainelBloco(id: BlocoId | null) {
  var q = useQuery<BlocoDetalhe | null>({
    queryKey: ["admin-painel-bloco", id],
    queryFn: function() { return fonte.bloco(id as BlocoId); },
    enabled: !!id,
    initialData: id ? (DETALHES[id] || null) : null,
    staleTime: 60_000,
  });
  return { detalhe: q.data || null, carregando: q.isLoading };
}

export function useFichaCliente(companyId: string | null) {
  var q = useQuery<FichaCliente | null>({
    queryKey: ["admin-painel-ficha", companyId],
    queryFn: function() { return fonte.ficha(companyId as string); },
    enabled: !!companyId,
    initialData: companyId ? (FICHAS[companyId] || null) : null,
    staleTime: 60_000,
  });
  return { ficha: q.data || null, carregando: q.isLoading };
}
