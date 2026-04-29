import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

const ordersApi = {
  list: (cid: string, status = "all") =>
    request<any>(
      `/companies/${cid}/digital-channel/orders?status=${status === "all" ? "" : status}&limit=50`
    ),
  updateStatus: (cid: string, oid: string, status: string) =>
    request<any>(`/companies/${cid}/digital-channel/orders/${oid}/status`, {
      method: "PATCH",
      body: { status },
    }),
};

export function useDigitalOrders(statusFilter = "all") {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const cid = company?.id;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["digitalOrders", cid, statusFilter],
    queryFn: () => ordersApi.list(cid!, statusFilter),
    enabled: !!cid,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ oid, status }: { oid: string; status: string }) =>
      ordersApi.updateStatus(cid!, oid, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["digitalOrders", cid] });
      toast.success("Status atualizado");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao atualizar"),
  });

  const orders: any[] = data?.orders || [];
  const counts = data?.counts || {};

  const today = new Date();
  const kpi = {
    pending_payment: counts.pending_payment || 0,
    confirmed: counts.confirmed || 0,
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
    refetch,
    updateStatus: statusMutation.mutateAsync,
    isUpdating: statusMutation.isPending,
  };
}
