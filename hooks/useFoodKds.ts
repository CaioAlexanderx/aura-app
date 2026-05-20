import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

// ============================================================
// AURA Food — KDS (Kitchen Display System).
//
// Backend (foodOrders.js) entrega:
//   GET /food/orders/kds                  -> status IN (confirmed, preparing)
//                                            com waiting_minutes calculado
//   GET /food/orders?status=ready         -> ready ativos
//   PATCH /food/orders/:oid/status        -> máquina de estados
//   PATCH /food/orders/:oid/items/:iid/kds -> kds_status por item
//
// Polling 5s. Combinamos as 2 queries em useFoodKds() pra ter as 3
// colunas (confirmed / preparing / ready) num único hook.
// ============================================================

export type KdsItem = {
  id: string;
  item_id: string | null;
  item_name: string;
  variation_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  kds_status: "pending" | "preparing" | "done";
  notes: string | null;
};

export type KdsOrder = {
  id: string;
  status: "pending" | "confirmed" | "preparing" | "ready" | "delivered" | "cancelled";
  channel: string;
  table_number?: string | null;
  deliverer_name?: string | null;
  customer_name?: string | null;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  ready_at: string | null;
  estimated_ready_at: string | null;
  waiting_minutes?: number | null;
  items: KdsItem[];
};

function path(cid: string, suffix: string) {
  return "/companies/" + cid + "/food" + suffix;
}

export function useFoodKds() {
  const { company, token } = useAuthStore();
  const enabled = !!token && !!company?.id;

  const active = useQuery<KdsOrder[]>({
    queryKey: ["food-kds-active", company?.id],
    queryFn: () => request<KdsOrder[]>(path(company!.id, "/orders/kds")),
    enabled,
    refetchInterval: 5_000,
    staleTime: 2_000,
  });

  const ready = useQuery<KdsOrder[]>({
    queryKey: ["food-kds-ready", company?.id],
    queryFn: () => request<KdsOrder[]>(path(company!.id, "/orders?status=ready&limit=50")),
    enabled,
    refetchInterval: 5_000,
    staleTime: 2_000,
  });

  const all = active.data || [];
  const confirmed = all.filter(o => o.status === "confirmed");
  const preparing = all.filter(o => o.status === "preparing");
  const readyList = (ready.data || []).filter(o => o.status === "ready");

  return {
    confirmed,
    preparing,
    ready: readyList,
    counts: {
      confirmed: confirmed.length,
      preparing: preparing.length,
      ready: readyList.length,
    },
    isLoading: active.isLoading || ready.isLoading,
    refetch: () => { active.refetch(); ready.refetch(); },
  };
}

// ============================================================
// Mutations
// ============================================================

export function useAdvanceOrderStatusMutation() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      request(path(company!.id, "/orders/" + orderId + "/status"), { method: "PATCH", body: { status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["food-kds-active", company?.id] });
      qc.invalidateQueries({ queryKey: ["food-kds-ready", company?.id] });
      qc.invalidateQueries({ queryKey: ["food-tables", company?.id] });
      qc.invalidateQueries({ queryKey: ["food-comanda", company?.id] });
    },
  });
}

export function useToggleItemKdsStatusMutation() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, itemId, kds_status }: { orderId: string; itemId: string; kds_status: "pending" | "preparing" | "done" }) =>
      request(path(company!.id, "/orders/" + orderId + "/items/" + itemId + "/kds"), { method: "PATCH", body: { kds_status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["food-kds-active", company?.id] });
    },
  });
}

// ============================================================
// Helper — "atrasado": waiting_minutes > soma de preparation_time_min
// dos itens. Sem fallback: se sem preparation_time, usa 15min default.
// ============================================================
export function isOrderLate(order: KdsOrder, fallbackPrepMin = 15): boolean {
  const waiting = Number(order.waiting_minutes || 0);
  if (waiting <= 0) return false;
  // não temos prep_time aqui (vem em food_items); usar fallback ou um
  // somatório aproximado por quantidade. Aproximação: fallback.
  return waiting > fallbackPrepMin * 1.2;
}
