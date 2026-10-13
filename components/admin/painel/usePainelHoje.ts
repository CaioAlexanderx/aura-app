// ============================================================
// Gestão Aura › Hoje — camada de dados.
//
// Tudo passa pelo objeto `fonte`: cada função chama o adminApi
// (GET /admin/painel/*) e traduz a resposta com adaptadores.ts. Os dados
// estáticos de 13/10 (dadosEstaticos.ts) só entram quando
// PAINEL_FALLBACK_DEV.dadosDeExemplo está ligado E o bundle é de
// desenvolvimento (__DEV__) — nunca em produção.
// ============================================================
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/adminApi";
import { CATALOGO } from "./blocos";
import { DETALHES, FICHAS, LAYOUT_PADRAO, PAINEL_HOJE } from "./dadosEstaticos";
import {
  adaptarConversa, adaptarDetalhe, adaptarFicha, adaptarHoje, adaptarLayout, corpoDoLayout, montarCatalogo,
} from "./adaptadores";
import type { LayoutPainel } from "./adaptadores";
import type { BlocoDetalhe, BlocoId, ConversaContato, FichaCliente, ItemCatalogo, PainelHoje } from "./tipos";

// Só desenvolvimento: ligue para desenhar a tela sem a API.
export var PAINEL_FALLBACK_DEV = { dadosDeExemplo: false };

export function usandoDadosDeExemplo(): boolean {
  return PAINEL_FALLBACK_DEV.dadosDeExemplo && typeof __DEV__ !== "undefined" && !!__DEV__;
}

var CHAVES: Record<string, unknown[]> = {
  hoje: ["admin-painel-hoje"],
  layout: ["admin-painel-layout"],
  bloco: ["admin-painel-bloco"],
  ficha: ["admin-painel-ficha"],
  conversa: ["admin-painel-conversa"],
};

var LAYOUT_DE_EXEMPLO: LayoutPainel = { ativos: LAYOUT_PADRAO, conhecidos: [], padrao: true };

var fonte = {
  hoje: async function(): Promise<PainelHoje> {
    if (usandoDadosDeExemplo()) return PAINEL_HOJE;
    return adaptarHoje(await adminApi.painel.hoje());
  },
  // `periodo` undefined = o padrão do bloco (7, 14 ou 30 dias, o backend decide).
  bloco: async function(id: BlocoId, periodo?: number): Promise<BlocoDetalhe | null> {
    if (usandoDadosDeExemplo()) return DETALHES[id] || null;
    return adaptarDetalhe(id, await adminApi.painel.bloco(id, periodo));
  },
  ficha: async function(companyId: string): Promise<FichaCliente | null> {
    if (usandoDadosDeExemplo()) return FICHAS[companyId] || null;
    return adaptarFicha(await adminApi.painel.ficha(companyId));
  },
  // Sem dados de exemplo: a conversa só existe na API (WhatsApp da Aura).
  conversa: async function(conversaId: string): Promise<ConversaContato | null> {
    if (usandoDadosDeExemplo()) return null;
    return adaptarConversa(await adminApi.painel.contatos.conversa(conversaId));
  },
  layout: async function(): Promise<LayoutPainel> {
    if (usandoDadosDeExemplo()) return LAYOUT_DE_EXEMPLO;
    return adaptarLayout(await adminApi.painel.layout());
  },
  salvarLayout: async function(corpo: { id: BlocoId; visivel: boolean }[]): Promise<LayoutPainel> {
    return adaptarLayout(await adminApi.painel.salvarLayout(corpo));
  },
  recalcular: async function(): Promise<{ erros: number }> {
    var r = await adminApi.painel.recalcular();
    return { erros: r && r.erros ? r.erros.length : 0 };
  },
};

export function usePainelHoje() {
  var qc = useQueryClient();
  var exemplo = usandoDadosDeExemplo();

  var q = useQuery<PainelHoje>({
    queryKey: CHAVES.hoje.concat([String(exemplo)]),
    queryFn: fonte.hoje,
    staleTime: 60_000,
  });
  // O layout é secundário: se falhar, a tela usa todos os blocos calculados.
  var layoutQ = useQuery<LayoutPainel>({
    queryKey: CHAVES.layout.concat([String(exemplo)]),
    queryFn: fonte.layout,
    staleTime: Infinity,
  });

  var painel = q.data;
  var idsDoPainel: BlocoId[] = painel ? painel.blocos.map(function(b) { return b.id; }) : [];
  var layout: LayoutPainel = layoutQ.data || { ativos: idsDoPainel, conhecidos: [], padrao: true };
  var conhecidos: BlocoId[] = layout.conhecidos.length ? layout.conhecidos.map(function(c) { return c.id; }) : idsDoPainel;

  var catalogo: ItemCatalogo[] = exemplo || !layout.conhecidos.length ? CATALOGO : montarCatalogo(layout.conhecidos);

  // POST /recalcular roda o passo diário agora (alguns segundos) e recarrega.
  async function recalcular(): Promise<{ erros: number }> {
    var r = exemplo ? { erros: 0 } : await fonte.recalcular();
    await Promise.all([
      qc.invalidateQueries({ queryKey: CHAVES.hoje }),
      qc.invalidateQueries({ queryKey: CHAVES.bloco }),
      qc.invalidateQueries({ queryKey: CHAVES.ficha }),
    ]);
    return r;
  }

  // PUT /layout: visíveis na ordem + desligados. Em exemplo só guarda no cache.
  async function salvarLayout(ativos: BlocoId[]): Promise<void> {
    var chave = CHAVES.layout.concat([String(exemplo)]);
    if (exemplo) {
      qc.setQueryData(chave, { ativos: ativos, conhecidos: [], padrao: false } as LayoutPainel);
      return;
    }
    var salvo = await fonte.salvarLayout(corpoDoLayout(conhecidos, ativos));
    qc.setQueryData(chave, salvo);
  }

  return {
    painel: painel,
    carregando: q.isLoading || (!!painel && layoutQ.isLoading),
    erro: q.isError && !painel,
    vazio: !!painel && painel.blocos.length === 0,
    exemplo: exemplo,
    tentarDeNovo: function() { q.refetch(); layoutQ.refetch(); },
    ativos: layout.ativos,
    catalogo: catalogo,
    recalcular: recalcular,
    salvarLayout: salvarLayout,
  };
}

// Detalhe do card expandido. `id` nulo = nada aberto, não busca.
// `periodo` undefined = padrão do bloco; 7, 30 ou 90 refaz a chamada.
export function usePainelBloco(id: BlocoId | null, periodo?: number) {
  var exemplo = usandoDadosDeExemplo();
  var q = useQuery<BlocoDetalhe | null>({
    queryKey: CHAVES.bloco.concat([id, periodo == null ? "padrao" : periodo, String(exemplo)]),
    queryFn: function() { return fonte.bloco(id as BlocoId, periodo); },
    enabled: !!id,
    staleTime: 60_000,
    // Troca de período mostra o período anterior até o novo chegar.
    placeholderData: function(anterior) { return anterior; },
  });
  return {
    detalhe: q.data || null,
    carregando: q.isLoading,
    atualizando: q.isFetching && !q.isLoading,
    erro: q.isError,
    tentarDeNovo: function() { q.refetch(); },
  };
}

// GET /admin/painel/contatos/:conversaId. 404 (conversa de outro tenant,
// número desligado) chega como erro e a tela diz que não achou.
export function useConversaContato(conversaId: string | null) {
  var exemplo = usandoDadosDeExemplo();
  var q = useQuery<ConversaContato | null>({
    queryKey: CHAVES.conversa.concat([conversaId, String(exemplo)]),
    queryFn: function() { return fonte.conversa(conversaId as string); },
    enabled: !!conversaId,
    staleTime: 30_000,
    retry: false,
  });
  return {
    conversa: q.data || null,
    carregando: q.isLoading,
    erro: q.isError,
    tentarDeNovo: function() { q.refetch(); },
  };
}

export function useFichaCliente(companyId: string | null) {
  var exemplo = usandoDadosDeExemplo();
  var q = useQuery<FichaCliente | null>({
    queryKey: CHAVES.ficha.concat([companyId, String(exemplo)]),
    queryFn: function() { return fonte.ficha(companyId as string); },
    enabled: !!companyId,
    staleTime: 60_000,
  });
  return {
    ficha: q.data || null,
    carregando: q.isLoading,
    erro: q.isError,
    tentarDeNovo: function() { q.refetch(); },
  };
}
