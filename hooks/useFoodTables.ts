import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

// ============================================================
// AURA Food — hooks de Salão (mesas + comanda + reservas).
//
// Backend (food.js + foodOrders.js + foodWaiter.js):
//   GET    /food/tables                       -> lista mesas
//   POST   /food/tables                       -> cria mesa
//   PATCH  /food/tables/:tid                  -> edita number/seats/qr
//   PATCH  /food/tables/:tid/status           -> muda status
//   DELETE /food/tables/:tid                  -> remove (409 se há pedidos)
//   GET    /food/tables/:tid/comanda          -> comanda agregada
//   POST   /food/orders                       -> cria pedido (opened_at auto)
//   PATCH  /food/orders/:oid/status           -> KDS state machine
//   GET    /food/waiter/calls                 -> chamadas pendentes
//   PATCH  /food/waiter/calls/:cid/answer     -> responder chamada
//   GET    /food/reservations?date=&status=   -> reservas
//   POST   /food/reservations
//   PATCH  /food/reservations/:rid
//   DELETE /food/reservations/:rid
// ============================================================

export type FoodTable = {
  id: string;
  company_id: string;
  number: string;
  seats: number | null;
  qr_code_url: string | null;
  status: "free" | "occupied" | "reserved";
  opened_at: string | null;
  created_at: string;
};

export type FoodWaiterCall = {
  id: string;
  table_id: string;
  reason: string;
  status: "pending" | "answered";
  created_at: string;
  table_number?: string;
};

export type FoodComandaItem = {
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

export type FoodComandaOrder = {
  id: string;
  status: "pending" | "confirmed" | "preparing" | "ready" | "delivered" | "cancelled";
  channel: string;
  created_at: string;
  confirmed_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  estimated_ready_at: string | null;
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  items: FoodComandaItem[];
};

export type FoodComanda = {
  table: FoodTable;
  orders: FoodComandaOrder[];
  subtotal_open: number;
  discount_total: number;
  service_fee_pct: number;
  service_fee_amount: number;
  total_open: number;
  opened_at: string | null;
  duration_min: number | null;
  active_orders_count: number;
  delivered_orders_count: number;
  waiter_call: FoodWaiterCall | null;
};

export type FoodReservationStatus =
  | "pending" | "confirmed" | "checked_in" | "cancelled" | "no_show";

export type FoodReservation = {
  id: string;
  company_id: string;
  table_id: string | null;
  table_number?: string | null;
  table_seats?: number | null;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  party_size: number;
  reservation_at: string;
  duration_min: number;
  status: FoodReservationStatus;
  notes: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  checked_in_at: string | null;
  created_at: string;
};

function path(cid: string, suffix: string) {
  return "/companies/" + cid + "/food" + suffix;
}

// ============================================================
// Queries
// ============================================================
export function useFoodTables(opts?: { refetchInterval?: number }) {
  const { company, token } = useAuthStore();
  return useQuery<FoodTable[]>({
    queryKey: ["food-tables", company?.id],
    queryFn: () => request<FoodTable[]>(path(company!.id, "/tables")),
    enabled: !!token && !!company?.id,
    refetchInterval: opts?.refetchInterval ?? 10_000,
    staleTime: 5_000,
  });
}

export function useFoodComanda(tableId: string | null, opts?: { refetchInterval?: number }) {
  const { company, token } = useAuthStore();
  return useQuery<FoodComanda>({
    queryKey: ["food-comanda", company?.id, tableId],
    queryFn: () => request<FoodComanda>(path(company!.id, "/tables/" + tableId + "/comanda")),
    enabled: !!token && !!company?.id && !!tableId,
    refetchInterval: opts?.refetchInterval ?? 5_000,
    staleTime: 2_000,
  });
}

export function useFoodWaiterCalls() {
  const { company, token } = useAuthStore();
  return useQuery<FoodWaiterCall[]>({
    queryKey: ["food-waiter-calls", company?.id],
    queryFn: () => request<FoodWaiterCall[]>(path(company!.id, "/waiter/calls")),
    enabled: !!token && !!company?.id,
    refetchInterval: 10_000,
    staleTime: 3_000,
  });
}

export function useFoodReservations(filters?: { date?: string; status?: string; table_id?: string }) {
  const { company, token } = useAuthStore();
  const qs = new URLSearchParams();
  if (filters?.date)     qs.set("date", filters.date);
  if (filters?.status)   qs.set("status", filters.status);
  if (filters?.table_id) qs.set("table_id", filters.table_id);
  const suffix = qs.toString() ? "?" + qs.toString() : "";
  return useQuery<FoodReservation[]>({
    queryKey: ["food-reservations", company?.id, filters],
    queryFn: () => request<FoodReservation[]>(path(company!.id, "/reservations" + suffix)),
    enabled: !!token && !!company?.id,
    staleTime: 30_000,
  });
}

// ============================================================
// Mutations
// ============================================================
function useInvalidateSalao() {
  const qc = useQueryClient();
  const { company } = useAuthStore();
  return () => {
    qc.invalidateQueries({ queryKey: ["food-tables", company?.id] });
    qc.invalidateQueries({ queryKey: ["food-waiter-calls", company?.id] });
  };
}

// Tables
export function useCreateTableMutation() {
  const { company } = useAuthStore();
  const invalidate = useInvalidateSalao();
  return useMutation({
    mutationFn: (body: { number: string; seats?: number | null }) =>
      request<FoodTable>(path(company!.id, "/tables"), { method: "POST", body }),
    onSuccess: invalidate,
  });
}
export function useUpdateTableMutation() {
  const { company } = useAuthStore();
  const invalidate = useInvalidateSalao();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; number?: string; seats?: number | null; qr_code_url?: string | null }) =>
      request<FoodTable>(path(company!.id, "/tables/" + id), { method: "PATCH", body }),
    onSuccess: invalidate,
  });
}
export function useDeleteTableMutation() {
  const { company } = useAuthStore();
  const invalidate = useInvalidateSalao();
  return useMutation({
    mutationFn: (id: string) =>
      request<{ ok: boolean }>(path(company!.id, "/tables/" + id), { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
export function useTableStatusMutation() {
  const { company } = useAuthStore();
  const invalidate = useInvalidateSalao();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "free" | "occupied" | "reserved" }) =>
      request<FoodTable>(path(company!.id, "/tables/" + id + "/status"), { method: "PATCH", body: { status } }),
    onSuccess: (_, vars) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["food-comanda", company?.id, vars.id] });
    },
  });
}

// Waiter calls
export function useAnswerWaiterCallMutation() {
  const { company } = useAuthStore();
  const invalidate = useInvalidateSalao();
  return useMutation({
    mutationFn: (callId: string) =>
      request(path(company!.id, "/waiter/calls/" + callId + "/answer"), { method: "PATCH" }),
    onSuccess: invalidate,
  });
}

// Pedidos
export type CreateOrderItem = {
  item_id?: string | null;
  item_name: string;
  variation_name?: string | null;
  quantity: number;
  unit_price: number;
  notes?: string | null;
};
export function useCreateOrderMutation() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      table_id?: string | null;
      channel?: string;
      items: CreateOrderItem[];
      notes?: string | null;
      customer_name?: string | null;
      customer_phone?: string | null;
    }) => request(path(company!.id, "/orders"), { method: "POST", body }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["food-tables", company?.id] });
      if (vars.table_id) {
        qc.invalidateQueries({ queryKey: ["food-comanda", company?.id, vars.table_id] });
      }
    },
  });
}
export function useUpdateOrderStatusMutation() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status, note }: { orderId: string; status: string; note?: string }) =>
      request(path(company!.id, "/orders/" + orderId + "/status"), { method: "PATCH", body: { status, note } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["food-tables", company?.id] });
      qc.invalidateQueries({ queryKey: ["food-comanda", company?.id] });
    },
  });
}

// Reservations
export function useCreateReservationMutation() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<FoodReservation>) =>
      request<FoodReservation>(path(company!.id, "/reservations"), { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["food-reservations", company?.id] }),
  });
}
export function useUpdateReservationMutation() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<FoodReservation> & { id: string }) =>
      request<FoodReservation>(path(company!.id, "/reservations/" + id), { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["food-reservations", company?.id] }),
  });
}
export function useDeleteReservationMutation() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request<{ ok: boolean }>(path(company!.id, "/reservations/" + id), { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["food-reservations", company?.id] }),
  });
}

// Helper
export function getTableQrUrl(tableId: string): string {
  return "https://getaura.com.br/m/" + tableId;
}
