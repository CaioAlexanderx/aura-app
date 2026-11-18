// ============================================================
// AURA. — Aba Pedidos em Vendas (A5a/A5b, p-63e/f, 17/11/2026)
//
// Os pedidos guardados no Caixa (pedido separado de venda). O backend é o
// Aura-backend#1073 (B3):
//   GET   /companies/:id/pedidos            lista + números da aba (uma loja)
//   GET   /me/pedidos                       a mesma lista no consolidado,
//                                           com por_empresa e company_count
//   GET   /companies/:id/pedidos/:oid       detalhe com itens, sinal e falta
//   PATCH /companies/:id/pedidos/:oid/status  "Separar" (preparing) e
//                                           "Pronto" (ready), só para a frente
//   PATCH /companies/:id/pedidos/:oid/data    "Nova data" (Aura-backend#1077):
//                                           { promised_date }, só pedido aberto
//
// Multi-CNPJ: no consolidado a lista vem de /me/pedidos (todas as lojas que
// a pessoa vê, números somados). O detalhe e as ações vão sempre para a loja
// DONA do pedido (company_id da linha), como o SaleDetailModal faz.
//
// Trava e módulo: useAbaPedidos decide se a aba existe (PEDIDO_LIBERADO +
// módulo vendas.pedidos). Com a aba fora, nenhuma consulta sai daqui e o
// /auth/me não é chamado a mais: a tela de Vendas fica a de hoje.
// ============================================================
import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { computeVisibleModules } from "@/hooks/useVisibleModules";
import { permissionsQueryKey } from "@/utils/permissionsQueryKey";
import { pedidoLiberado, MODULO_PEDIDOS } from "@/utils/pedidoLiberado";

export type SituacaoDoPedido = "confirmed" | "preparing" | "ready" | "delivered" | "cancelled";

/** Chip da aba (o parâmetro `situacao` do backend), mais "atrasados". */
export type ChipDosPedidos =
  | "abertos" | "atrasados" | "aguardando" | "separando" | "prontos" | "concluidos" | "cancelados";

export type LinhaDoPedido = {
  id: string;
  company_id: string;
  company_name: string | null;
  order_number: string;
  status: SituacaoDoPedido | string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  sinal_pago: number;
  falta: number;
  promised_date: string | null;
  atrasado: boolean;
  dias_de_atraso: number;
  item_count: number;
  pecas: number;
  first_item_name: string | null;
  first_item_image: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  delivered_at: string | null;
  cancelled_at: string | null;
  sale_id: string | null;
};

export type NumerosDosPedidos = {
  abertos: number;
  pecas_reservadas: number;
  atrasados: number;
  sinais_recebidos: number;
  falta_receber: number;
};

export type ContagemDosChips = {
  abertos: number; aguardando: number; separando: number; prontos: number;
  concluidos: number; cancelados: number; atrasados: number; todos: number;
};

export type NumerosDaLoja = NumerosDosPedidos & { company_id: string; company_name?: string | null };

export type RespostaDosPedidos = {
  orders: LinhaDoPedido[];
  situacao: string;
  kpis: NumerosDosPedidos;
  counts: ContagemDosChips;
  pagination: { page: number; limit: number; total: number; pages: number };
  por_empresa?: NumerosDaLoja[];
  company_count?: number;
};

export type ItemDoPedido = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  variant_label: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  item_discount: number;
  subtotal: number;
};

export type DetalheDoPedido = {
  id: string;
  order_number: string;
  origem: string;
  status: SituacaoDoPedido | string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  promised_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  sinal_pago: number;
  falta: number;
  items: ItemDoPedido[];
};

/** A lista pede até 100 por vez (o máximo do backend). */
export const PEDIDOS_POR_PAGINA = 100;

/** Chip → parâmetros da rota. "atrasados" é o filtro dos abertos com a data vencida. */
export function parametrosDoChip(chip: ChipDosPedidos, busca: string): string {
  const p: string[] = [];
  if (chip === "atrasados") p.push("situacao=abertos", "atrasados=1");
  else p.push("situacao=" + chip);
  const q = String(busca || "").trim();
  if (q) p.push("q=" + encodeURIComponent(q));
  p.push("limit=" + PEDIDOS_POR_PAGINA);
  return p.join("&");
}

export const pedidosApi = {
  listar: (cid: string, chip: ChipDosPedidos, busca: string) =>
    request<RespostaDosPedidos>(`/companies/${cid}/pedidos?${parametrosDoChip(chip, busca)}`),
  listarConsolidado: (chip: ChipDosPedidos, busca: string) =>
    request<RespostaDosPedidos>(`/me/pedidos?${parametrosDoChip(chip, busca)}`),
  detalhe: (cid: string, oid: string) =>
    request<{ order: DetalheDoPedido }>(`/companies/${cid}/pedidos/${oid}`),
  mudarSituacao: (cid: string, oid: string, status: "preparing" | "ready") =>
    request<{ order: DetalheDoPedido; ja_estava?: boolean }>(`/companies/${cid}/pedidos/${oid}/status`, {
      method: "PATCH",
      body: { status },
    }),
  mudarData: (cid: string, oid: string, promised_date: string | null) =>
    request<{ order: DetalheDoPedido; ja_estava?: boolean }>(`/companies/${cid}/pedidos/${oid}/data`, {
      method: "PATCH",
      body: { promised_date },
    }),
};

/**
 * A aba Pedidos existe para esta pessoa? Trava + módulo vendas.pedidos (plano
 * e permissão). Liberada, revalida o /auth/me ao montar (plano stale no JWT,
 * regra 1 do CLAUDE.md). Com a trava desligada não faz nada a mais.
 */
export function useAbaPedidos(): { visivel: boolean } {
  const { user, company, token, consolidatedView, isHydrated, refreshMe } = useAuthStore() as any;
  const liberado = pedidoLiberado(user);

  // A mesma consulta (e a mesma chave) de useVisibleModules, mas só LIGADA com
  // a trava liberada: desligada, a tela de Vendas não faz nenhuma ida a mais.
  const permissoes = useQuery({
    queryKey: permissionsQueryKey(company?.id, consolidatedView),
    queryFn: function() { return request<any>("/auth/my-permissions"); },
    enabled: liberado && !!token,
    staleTime: 5 * 60000,
    retry: 1,
  });

  useEffect(() => {
    if (!liberado) return;
    if (typeof refreshMe === "function") refreshMe().catch(() => {});
  }, [liberado, refreshMe]);

  const visivel = useMemo(() => {
    if (!liberado || !isHydrated || !token || permissoes.isPending) return false;
    return computeVisibleModules(company?.plan, company?.module_overrides, permissoes.data).has(MODULO_PEDIDOS);
  }, [liberado, isHydrated, token, permissoes.isPending, permissoes.data, company?.plan, company?.module_overrides]);
  return { visivel };
}

/** Lista da aba: uma loja ou o consolidado, conforme o seletor de empresa. */
export function usePedidos(chip: ChipDosPedidos, busca: string, opts: { enabled?: boolean } = {}) {
  const { token, company, consolidatedView } = useAuthStore();
  const escopo = consolidatedView ? "me" : company?.id;
  const q = String(busca || "").trim();
  const ligado = opts.enabled !== false && !!token && (consolidatedView || !!company?.id);

  const query = useQuery({
    queryKey: ["pedidos", escopo, chip, q],
    queryFn: function() {
      if (consolidatedView) return pedidosApi.listarConsolidado(chip, q);
      if (!company?.id) throw new Error("no company");
      return pedidosApi.listar(company.id, chip, q);
    },
    enabled: ligado,
    staleTime: 15_000,
    retry: 1,
    placeholderData: function(prev, prevQuery) {
      return prevQuery && prevQuery.queryKey[1] === escopo ? prev : undefined;
    },
  });

  const data = query.data;
  return useMemo(() => ({
    pedidos: data?.orders || [],
    numeros: data?.kpis || null,
    contagem: data?.counts || null,
    porEmpresa: data?.por_empresa || [],
    lojas: data?.company_count || 1,
    total: data?.pagination?.total || 0,
    consolidado: !!consolidatedView,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error | null) || null,
    refetch: query.refetch,
  }), [data, consolidatedView, query.isLoading, query.isFetching, query.error, query.refetch]);
}

/** Detalhe do pedido, sempre na loja dona dele (consolidado incluso). */
export function usePedidoDetalhe(companyId: string | null | undefined, orderId: string | null | undefined) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["pedido-detalhe", companyId, orderId],
    queryFn: function() {
      if (!companyId || !orderId) throw new Error("missing");
      return pedidosApi.detalhe(companyId, orderId);
    },
    enabled: !!companyId && !!orderId,
    staleTime: 15_000,
    retry: 1,
  });
  return { pedido: data?.order || null, isLoading, error: (error as Error | null) || null, refetch };
}

/** "Separar" e "Pronto". Atualiza a lista e o detalhe depois. */
export function useMudarSituacaoDoPedido() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: function(v: { companyId: string; orderId: string; status: "preparing" | "ready" }) {
      return pedidosApi.mudarSituacao(v.companyId, v.orderId, v.status);
    },
    onSettled: function(_d, _e, v) {
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      if (v) qc.invalidateQueries({ queryKey: ["pedido-detalhe", v.companyId, v.orderId] });
    },
  });
  return { mudarSituacao: m.mutateAsync, mudando: m.isPending, emQual: m.isPending ? m.variables : null };
}

/**
 * "Nova data". Atualiza a lista (o atrasado sai do topo quando a data nova é
 * futura: a ordem vem do backend) e o detalhe. Só depois de gravar: no erro
 * o diálogo fica aberto com o que a pessoa escolheu.
 */
export function useMudarDataDoPedido() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: function(v: { companyId: string; orderId: string; promised_date: string | null }) {
      return pedidosApi.mudarData(v.companyId, v.orderId, v.promised_date);
    },
    onSuccess: function(_d, v) {
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      qc.invalidateQueries({ queryKey: ["pedido-detalhe", v.companyId, v.orderId] });
    },
    // Recusa do servidor (409: o pedido foi concluído ou cancelado enquanto
    // isso): a lista e o detalhe se atualizam. Sem resposta (rede), nada é
    // recarregado: uma lista que falha poderia tirar a linha (e o diálogo)
    // da tela.
    onError: function(err: any, v) {
      const st = Number(err && err.status);
      if (st >= 400 && st < 500) {
        qc.invalidateQueries({ queryKey: ["pedidos"] });
        qc.invalidateQueries({ queryKey: ["pedido-detalhe", v.companyId, v.orderId] });
      }
    },
  });
  return { mudarData: m.mutateAsync, salvando: m.isPending };
}
