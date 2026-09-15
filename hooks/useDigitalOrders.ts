import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

const ordersApi = {
  // 10/09/2026: `q` busca por número do pedido, telefone, cliente ou produto
  // (backend: services/filaDePedidos.js).
  list: (cid: string, status = "all", q = "") =>
    request<any>(
      `/companies/${cid}/digital-channel/orders?status=${status === "all" ? "" : status}&limit=50` +
      (q ? `&q=${encodeURIComponent(q)}` : "")
    ),
  // 10/09/2026: o detalhe vem da rota própria. Antes o modal lia `order.items`
  // do objeto da LISTA, que nunca trouxe itens — a seção saía vazia.
  detail: (cid: string, oid: string) =>
    request<any>(`/companies/${cid}/digital-channel/orders/${oid}`),
  updateStatus: (cid: string, oid: string, status: string) =>
    request<any>(`/companies/${cid}/digital-channel/orders/${oid}/status`, {
      method: "PATCH",
      body: { status },
    }),
  remove: (cid: string, oid: string) =>
    request<any>(`/companies/${cid}/digital-channel/orders/${oid}`, {
      method: "DELETE",
    }),
  // 17/08/2026: approve/reject moram AQUI, não na tela. Antes TabPedidos
  // chamava `api.post(...)` com um símbolo que services/api.ts nunca exportou
  // (undefined em runtime) e montava o `cid` na mão a partir de
  // `orders[0]?.company_id`. Os dois modos de falha somem quando a chamada
  // vive no hook, que já tem o cid autenticado do store.
  approvePayment: (cid: string, oid: string) =>
    request<any>(
      `/companies/${cid}/digital-channel/orders/${oid}/approve-payment`,
      { method: "POST", body: {} }
    ),
  rejectPayment: (cid: string, oid: string, reason?: string) =>
    request<any>(
      `/companies/${cid}/digital-channel/orders/${oid}/reject-payment`,
      { method: "POST", body: { reason: reason || undefined } }
    ),
};

// `companyIdOverride` permite que uma tela force a empresa (multi-CNPJ);
// sem ele, cai na empresa autenticada do store. Nunca mais no company_id
// do primeiro pedido da lista.
export function useDigitalOrders(statusFilter = "all", companyIdOverride?: string, busca = "") {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const cid = companyIdOverride || company?.id;
  const q = busca.trim();

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["digitalOrders", cid, statusFilter, q],
    queryFn: () => ordersApi.list(cid!, statusFilter, q),
    enabled: !!cid,
    staleTime: 15_000,
    refetchInterval: 30_000,
    // Digitar na busca não pisca a lista inteira a cada letra.
    placeholderData: (anterior: any) => anterior,
  });

  const invalidar = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["digitalOrders", cid] });
    qc.invalidateQueries({ queryKey: ["digitalOrderDetail", cid] });
  }, [qc, cid]);

  const statusMutation = useMutation({
    mutationFn: ({ oid, status }: { oid: string; status: string }) =>
      ordersApi.updateStatus(cid!, oid, status),
    onSuccess: () => {
      invalidar();
      toast.success("Status atualizado");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao atualizar"),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ oid }: { oid: string; orderNumber?: string | number }) =>
      ordersApi.updateStatus(cid!, oid, "cancelled"),
    onSuccess: (_data: any, vars: { oid: string; orderNumber?: string | number }) => {
      invalidar();
      toast.success(`Pedido #${vars.orderNumber || ""} cancelado`);
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao cancelar o pedido"),
  });

  const deleteMutation = useMutation({
    mutationFn: (oid: string) => ordersApi.remove(cid!, oid),
    onSuccess: (data: any) => {
      invalidar();
      toast.success(`Pedido #${data?.order_number || ""} excluído`);
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao excluir pedido"),
  });

  const orders: any[] = data?.orders || [];
  const counts = data?.counts || {};

  // Sem cid não existe chamada possível — erro explícito em vez de
  // early-return silencioso (o caller mostra o toast).
  const assertCid = useCallback(() => {
    if (!cid) {
      throw new Error("Empresa não identificada — recarregue a página e tente de novo.");
    }
    return cid;
  }, [cid]);

  const approvePayment = useCallback(
    async (oid: string) => {
      const res = await ordersApi.approvePayment(assertCid(), oid);
      invalidar();
      return res;
    },
    [assertCid, invalidar]
  );

  const rejectPayment = useCallback(
    async (oid: string, reason?: string) => {
      const res = await ordersApi.rejectPayment(assertCid(), oid, reason);
      invalidar();
      return res;
    },
    [assertCid, invalidar]
  );

  // Contagem por status: prefere o `counts` do backend (conta o banco inteiro);
  // se a chave não vier, cai na contagem client-side da página carregada.
  // `??` e não `||` pra respeitar um 0 legítimo do backend.
  const countOf = (key: string) =>
    (counts[key] as number | undefined) ??
    orders.filter((o: any) => o.status === key).length;

  const today = new Date();
  const kpi = {
    awaiting_approval: countOf("awaiting_approval"),
    pending_payment: countOf("pending_payment"),
    confirmed: countOf("confirmed"),
    revenue_today: orders
      .filter((o) => {
        const d = new Date(o.created_at);
        return (
          d.getDate() === today.getDate() &&
          d.getMonth() === today.getMonth() &&
          d.getFullYear() === today.getFullYear() &&
          ["confirmed", "preparing", "ready", "delivered"].includes(o.status)
        );
      })
      .reduce((s: number, o: any) => s + parseFloat(o.total || 0), 0),
  };

  return {
    orders,
    kpi,
    counts,
    total: data?.pagination?.total || 0,
    isLoading,
    isFetching,
    refetch,
    updateStatus: statusMutation.mutateAsync,
    isUpdating: statusMutation.isPending,
    cancelOrder: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
    deleteOrder: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    approvePayment,
    rejectPayment,
  };
}

/** Detalhe de UM pedido, com itens e miniaturas. `oid` nulo = desligado. */
export function useDigitalOrderDetail(oid?: string | null, companyIdOverride?: string) {
  const { company } = useAuthStore();
  const cid = companyIdOverride || company?.id;
  return useQuery({
    queryKey: ["digitalOrderDetail", cid, oid],
    queryFn: () => ordersApi.detail(cid!, oid!),
    enabled: !!cid && !!oid,
    staleTime: 10_000,
  });
}
