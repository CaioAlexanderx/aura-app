import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request, ApiError } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import type { FoodDeliverer } from "@/hooks/useFoodDeliverers";

// ============================================================
// AURA Food — Fase 8: hook do board de despacho.
//
// Backend (foodDispatch.js):
//   GET   /food/dispatch/board                  -> { ready, inRoute, deliverers }
//   POST  /food/orders/:oid/dispatch            -> { order_id, deliverer_pin, dispatched_at }
//   PATCH /food/orders/:oid/status              -> body { status, pin? }
//                                                  exige PIN se status=delivered
//                                                  e deliverer_pin setado
// ============================================================

export type DispatchReadyOrder = {
  id: string;
  external_short: string;
  customer_name: string | null;
  customer_phone: string | null;
  address_summary: string | null;
  total: number;
  ready_at: string | null;
  waiting_minutes: number;
  notes: string | null;
};

export type DispatchInRouteOrder = {
  id: string;
  external_short: string;
  customer_name: string | null;
  customer_phone: string | null;
  address_summary: string | null;
  total: number;
  deliverer_id: string;
  deliverer_name: string;
  deliverer_phone: string | null;
  deliverer_vehicle: FoodDeliverer["vehicle"];
  dispatched_at: string;
  in_route_minutes: number;
};

export type DispatchBoard = {
  ready: DispatchReadyOrder[];
  inRoute: DispatchInRouteOrder[];
  deliverers: FoodDeliverer[];
};

export type DispatchResult = {
  order_id: string;
  deliverer_pin: string;
  dispatched_at: string;
};

function path(cid: string, suffix: string) {
  return "/companies/" + cid + "/food" + suffix;
}

// ============================================================
// Query: board completo (3 buckets em 1 request)
// ============================================================
export function useDispatchBoard(opts?: { refetchInterval?: number }) {
  const { company, token } = useAuthStore();
  return useQuery<DispatchBoard>({
    queryKey: ["food-dispatch-board", company?.id],
    queryFn: () => request<DispatchBoard>(path(company!.id, "/dispatch/board")),
    enabled: !!token && !!company?.id,
    refetchInterval: opts?.refetchInterval ?? 15_000,
    staleTime: 5_000,
  });
}

// ============================================================
// Mutation: atribuir motoboy a um pedido pronto.
// Retorna o PIN de 4 dígitos que o cliente vai checar com o motoboy.
// ============================================================
export function useDispatchOrder() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  return useMutation<DispatchResult, ApiError, { orderId: string; delivererId: string }>({
    mutationFn: ({ orderId, delivererId }) =>
      request<DispatchResult>(path(company!.id, "/orders/" + orderId + "/dispatch"), {
        method: "POST",
        body: { deliverer_id: delivererId },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["food-dispatch-board", company?.id] });
      qc.invalidateQueries({ queryKey: ["food-deliverers", company?.id] });
      qc.invalidateQueries({ queryKey: ["food-kds-ready", company?.id] });
    },
  });
}

// ============================================================
// Mutation: confirmar entrega com PIN.
//   PATCH /food/orders/:oid/status body { status: 'delivered', pin }
// Erros possíveis:
//   422 PIN_REQUIRED  -> PIN não veio
//   422 PIN_INVALID   -> PIN errado
// ============================================================
export function useConfirmDelivery() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  return useMutation<unknown, ApiError, { orderId: string; pin: string }>({
    mutationFn: ({ orderId, pin }) =>
      request(path(company!.id, "/orders/" + orderId + "/status"), {
        method: "PATCH",
        body: { status: "delivered", pin },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["food-dispatch-board", company?.id] });
      qc.invalidateQueries({ queryKey: ["food-deliverers", company?.id] });
      qc.invalidateQueries({ queryKey: ["food-kds-ready", company?.id] });
      qc.invalidateQueries({ queryKey: ["food-kds-active", company?.id] });
    },
  });
}

// ============================================================
// Re-despachar: aceita mesmo orderId, server gera novo PIN.
// (Usa o mesmo endpoint POST /dispatch — backend trata.)
// ============================================================
export function useRedispatchOrder() {
  return useDispatchOrder();
}
