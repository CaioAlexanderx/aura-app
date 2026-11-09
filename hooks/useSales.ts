import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { salesApi, type SalesListResponse, type SaleDetailFull } from "@/services/api";
import { salesApi as salesApiDireto, type EmitNfceBody, type SaleEditBody, type SaleEditContext } from "@/services/salesApi";
import { meAggregatesApi, type SalesFilters, type SalesConsolidatedResponse } from "@/services/meAggregates";
import { useAuthStore } from "@/stores/auth";

// ============================================================
// AURA. — Hooks da tela de Vendas (Item 3 Eryca)
//
// useSalesList(filters): lista paginada + stats agregados
//   - cache curto (15s) — vendas chegam frequente
//   - re-fetch ao mudar filtros (queryKey muda)
//   - 18/09/2026: trocar de pagina/filtro mantem a lista anterior na tela
//     ate a nova chegar (placeholderData). Antes a pagina inteira (lista,
//     KPIs e o subtitulo do cabecalho) sumia pro "Carregando" e voltava —
//     com o Chrome traduzindo a pagina, isso derrubava o app no "Proxima"
//     (removeChild em no de texto trocado pelo tradutor). A correcao de
//     raiz esta em public/index.html: lang="pt-BR" + translate="no" +
//     meta notranslate. Nao remover — o template padrao do Expo e lang="en".
//     (O motivo fica aqui porque comentario no index.html e publico.)
//     So reaproveita dentro do mesmo escopo (mesma empresa / consolidado),
//     pra nunca mostrar vendas de outra loja durante a troca de empresa.
//   - MULTICNPJ Onda 2.4: ramifica via consolidatedView do auth.
//     Em consolidated -> meAggregatesApi.sales() (/me/sales).
//     Em per-company -> salesApi.list() (/companies/:id/sales).
//     Backend retorna mesma shape; consolidated adiciona breakdown[]
//     e cada item ganha company_id+company_name pra UI mostrar badge.
//
// useSaleDetail(saleId, companyId?): detalhes pra modal
//   - cache 30s
//   - companyId opcional: em consolidated, caller passa o sale.company_id
//     da listagem. Default = company.id atual (modo per-company).
//
// useCancelSale(companyId?): mutation pra cancelar venda inteira
//   - companyId opcional: mesmo padrao do useSaleDetail.
//   - invalida lista (per-company E consolidated) + detalhes + transactions
//     + dashboard + dre + products.
//
// 09/11/2026 — useSaleEditContext / useEditSale (Editar venda): contexto da
//   edicao e o PATCH com dry_run (previa) ou de verdade. Substituem o
//   useUpdateSaleSeller (so vendedor).
//
// 02/06/2026 (b) — useEmitNfce / useReemitTrocaFiscal: emite NFC-e (venda)
//   ou reprocessa NF-e 55 de devolucao (troca) a partir do detalhe. Ambas
//   invalidam o detalhe pra atualizar o status fiscal exibido.
// ============================================================

export function useSalesList(filters?: SalesFilters) {
  const { token, company, consolidatedView } = useAuthStore();

  // Normaliza filtros pra queryKey estavel (objeto ou undefined)
  const filtersKey = filters || {};

  const scopeKey = consolidatedView ? "me" : company?.id;

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["sales-list", scopeKey, filtersKey],
    placeholderData: function(prev, prevQuery) {
      return prevQuery && prevQuery.queryKey[1] === scopeKey ? prev : undefined;
    },
    queryFn: function() {
      if (consolidatedView) {
        return meAggregatesApi.sales(filters);
      }
      if (!company?.id) throw new Error("no company");
      return salesApi.list(company.id, filters as any);
    },
    enabled: !!token && (consolidatedView || !!company?.id),
    staleTime: 15_000,
    retry: 1,
  });

  // Em consolidated, response tem breakdown e company_count.
  // Em per-company nao tem (mas o hook expoe defaults compativeis).
  const consolidated = data as SalesConsolidatedResponse | undefined;
  const perCompany = data as SalesListResponse | undefined;

  return {
    data: data as SalesListResponse | SalesConsolidatedResponse | undefined,
    sales: (data as any)?.sales || [],
    stats: (data as any)?.stats,
    total: (data as any)?.total || 0,
    // MULTICNPJ Onda 2.4: presente apenas em consolidated
    breakdown: consolidated?.breakdown || [],
    companyCount: consolidated?.company_count || 1,
    consolidatedView,
    isLoading: isLoading,
    isFetching: isFetching,
    error: error as Error | null,
    refetch: refetch,
  };
}

export function useSaleDetail(saleId: string | null | undefined, companyId?: string) {
  const { company } = useAuthStore();
  // MULTICNPJ Onda 2.4: em consolidated, caller passa companyId do sale.
  const targetCompanyId = companyId || company?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["sale-detail", targetCompanyId, saleId],
    queryFn: function() {
      if (!targetCompanyId || !saleId) throw new Error("missing");
      return salesApi.get(targetCompanyId, saleId);
    },
    enabled: !!targetCompanyId && !!saleId,
    staleTime: 30_000,
    retry: 1,
  });

  return {
    detail: data as SaleDetailFull | undefined,
    isLoading: isLoading,
    error: error as Error | null,
  };
}

export function useCancelSale(companyId?: string) {
  const { company } = useAuthStore();
  // MULTICNPJ Onda 2.4: em consolidated, caller passa companyId do sale.
  const targetCompanyId = companyId || company?.id;
  const qc = useQueryClient();

  function invalidateAll() {
    // Invalida ambos os keys (per-company E consolidated /me)
    qc.invalidateQueries({ queryKey: ["sales-list"] });
    qc.invalidateQueries({ queryKey: ["sale-detail"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["transaction-sale-details"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["me-dashboard"] });
    qc.invalidateQueries({ queryKey: ["dre"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  const mutation = useMutation({
    mutationFn: function(args: { saleId: string; reason?: string }) {
      if (!targetCompanyId) throw new Error("no company");
      return salesApi.cancel(targetCompanyId, args.saleId, args.reason);
    },
    onSuccess: invalidateAll,
  });

  return {
    cancelSale: function(args: { saleId: string; reason?: string }) { return mutation.mutateAsync(args); },
    isCancelling: mutation.isPending,
    error: mutation.error as Error | null,
  };
}

// 09/11/2026 — Editar venda (Aura-backend#972). O contexto (formas atuais,
// travas, NFC-e, caixa, permissões) é lido no mount da edição, sempre fresco
// (staleTime 0): a trava de crediário pago e o prazo da NFC-e mudam sozinhos.
// No consolidado multi-CNPJ o companyId é o da empresa dona da venda.
export function useSaleEditContext(saleId: string | null | undefined, companyId?: string, enabled = true) {
  const { company } = useAuthStore();
  const targetCompanyId = companyId || company?.id;
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sale-edit-context", targetCompanyId, saleId],
    queryFn: function() {
      if (!targetCompanyId || !saleId) throw new Error("missing");
      return salesApiDireto.editContext(targetCompanyId, saleId);
    },
    enabled: enabled && !!targetCompanyId && !!saleId,
    staleTime: 0,
    retry: 1,
  });
  return { context: data as SaleEditContext | undefined, isLoading, error: error as any, refetch };
}

export function useEditSale(companyId?: string) {
  const { company } = useAuthStore();
  const targetCompanyId = companyId || company?.id;
  const qc = useQueryClient();

  function invalidateAll() {
    // Forma, cliente e vendedor(a) aparecem em Vendas, Financeiro, caixa,
    // crediário, clientes e comissão.
    ["sales-list", "sale-detail", "sale-edit-context", "transactions", "transaction-sale-details",
     "dashboard", "me-dashboard", "dre", "customers", "credit", "crediario", "caixa", "employees", "commission"]
      .forEach(function(k) { qc.invalidateQueries({ queryKey: [k] }); });
  }

  const preview = useMutation({
    mutationFn: function(args: { saleId: string; body: SaleEditBody }) {
      if (!targetCompanyId) throw new Error("no company");
      return salesApiDireto.editSale(targetCompanyId, args.saleId, Object.assign({}, args.body, { dry_run: true }));
    },
  });
  const apply = useMutation({
    mutationFn: function(args: { saleId: string; body: SaleEditBody }) {
      if (!targetCompanyId) throw new Error("no company");
      const body = Object.assign({}, args.body);
      delete (body as any).dry_run;
      return salesApiDireto.editSale(targetCompanyId, args.saleId, body);
    },
    onSuccess: invalidateAll,
  });

  return {
    previewEdit: function(args: { saleId: string; body: SaleEditBody }) { return preview.mutateAsync(args); },
    applyEdit: function(args: { saleId: string; body: SaleEditBody }) { return apply.mutateAsync(args); },
    isPreviewing: preview.isPending,
    isSaving: apply.isPending,
  };
}

export function useEmitNfce(companyId?: string) {
  const { company } = useAuthStore();
  const targetCompanyId = companyId || company?.id;
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: function(args: { body: EmitNfceBody }) {
      if (!targetCompanyId) throw new Error("no company");
      return salesApi.emitNfce(targetCompanyId, args.body);
    },
    onSuccess: function() {
      qc.invalidateQueries({ queryKey: ["sale-detail"] });
      qc.invalidateQueries({ queryKey: ["nfce"] });
    },
  });

  return {
    emitNfce: function(args: { body: EmitNfceBody }) { return mutation.mutateAsync(args); },
    isEmitting: mutation.isPending,
    error: mutation.error as Error | null,
  };
}

// 02/06/2026 (b): reprocessa a NF-e 55 de devolucao da troca a partir do detalhe.
export function useReemitTrocaFiscal(companyId?: string) {
  const { company } = useAuthStore();
  const targetCompanyId = companyId || company?.id;
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: function(args: { trocaSaleId: string }) {
      if (!targetCompanyId) throw new Error("no company");
      return salesApi.reemitTrocaFiscal(targetCompanyId, args.trocaSaleId);
    },
    onSuccess: function() {
      qc.invalidateQueries({ queryKey: ["sale-detail"] });
      qc.invalidateQueries({ queryKey: ["nfce"] });
    },
  });

  return {
    reemitTrocaFiscal: function(args: { trocaSaleId: string }) { return mutation.mutateAsync(args); },
    isReemitting: mutation.isPending,
    error: mutation.error as Error | null,
  };
}
