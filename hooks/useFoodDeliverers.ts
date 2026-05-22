import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

// ============================================================
// AURA Food — Fase 8: CRUD de motoboys + relatório de comissão.
//
// Backend (foodDeliverers.js + foodDispatch.js):
//   GET    /food/deliverers                                   -> lista
//   POST   /food/deliverers                                   -> cria
//   PATCH  /food/deliverers/:did                              -> edita
//   DELETE /food/deliverers/:did                              -> remove (soft)
//   PATCH  /food/deliverers/:did/payout                       -> marca payout
//   GET    /food/deliverers/:did/commission-report?from=&to=  -> relatório
//   GET    /food/deliverers/:did/history?limit=50             -> histórico
// ============================================================

export type FoodDeliverer = {
  id: string;
  company_id: string;
  name: string;
  phone: string | null;
  vehicle: "moto" | "bike" | "carro" | "a_pe";
  commission_mode: "pct" | "fixed";
  commission_value: number;
  active: boolean;
  current_orders_count?: number;
  deliveries_today?: number;
  last_payout_at: string | null;
  created_at: string;
};

export type CommissionReportOrder = {
  order_id: string;
  external_short: string;
  customer_name: string | null;
  total: number;
  commission: number;
  dispatched_at: string;
  delivered_at: string | null;
  paid_to_deliverer: boolean;
};

export type CommissionReport = {
  deliverer_id: string;
  from: string;
  to: string;
  deliveries_count: number;
  delivered_value: number;
  commission_total: number;
  commission_unpaid: number;
  orders: CommissionReportOrder[];
};

export type DispatchHistoryItem = {
  id: string;
  order_id: string;
  external_short: string;
  customer_name: string | null;
  address_summary: string | null;
  total: number;
  dispatched_at: string;
  delivered_at: string | null;
  duration_min: number | null;
};

function path(cid: string, suffix: string) {
  return "/companies/" + cid + "/food" + suffix;
}

// ============================================================
// Queries
// ============================================================
export function useDeliverers(opts?: { activeOnly?: boolean }) {
  const { company, token } = useAuthStore();
  const qs = opts?.activeOnly ? "?active=true" : "";
  return useQuery<FoodDeliverer[]>({
    queryKey: ["food-deliverers", company?.id, opts?.activeOnly || false],
    queryFn: () => request<FoodDeliverer[]>(path(company!.id, "/deliverers" + qs)),
    enabled: !!token && !!company?.id,
    staleTime: 15_000,
  });
}

export function useCommissionReport(
  delivererId: string | null,
  filters: { from: string; to: string },
) {
  const { company, token } = useAuthStore();
  const qs = new URLSearchParams({ from: filters.from, to: filters.to });
  return useQuery<CommissionReport>({
    queryKey: ["food-deliverer-commission", company?.id, delivererId, filters.from, filters.to],
    queryFn: () =>
      request<CommissionReport>(
        path(company!.id, "/deliverers/" + delivererId + "/commission-report?" + qs.toString())
      ),
    enabled: !!token && !!company?.id && !!delivererId,
    staleTime: 30_000,
  });
}

export function useDelivererHistory(delivererId: string | null, limit = 50) {
  const { company, token } = useAuthStore();
  return useQuery<DispatchHistoryItem[]>({
    queryKey: ["food-deliverer-history", company?.id, delivererId, limit],
    queryFn: () =>
      request<DispatchHistoryItem[]>(
        path(company!.id, "/deliverers/" + delivererId + "/history?limit=" + limit)
      ),
    enabled: !!token && !!company?.id && !!delivererId,
    staleTime: 30_000,
  });
}

// ============================================================
// Mutations
// ============================================================
function useInvalidate() {
  const qc = useQueryClient();
  const { company } = useAuthStore();
  return (opts?: { delivererId?: string }) => {
    qc.invalidateQueries({ queryKey: ["food-deliverers", company?.id] });
    qc.invalidateQueries({ queryKey: ["food-dispatch-board", company?.id] });
    if (opts?.delivererId) {
      qc.invalidateQueries({ queryKey: ["food-deliverer-commission", company?.id, opts.delivererId] });
      qc.invalidateQueries({ queryKey: ["food-deliverer-history", company?.id, opts.delivererId] });
    }
  };
}

export type CreateDelivererBody = {
  name: string;
  phone?: string | null;
  vehicle: FoodDeliverer["vehicle"];
  commission_mode: FoodDeliverer["commission_mode"];
  commission_value: number;
  active?: boolean;
};

export function useCreateDeliverer() {
  const { company } = useAuthStore();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: CreateDelivererBody) =>
      request<FoodDeliverer>(path(company!.id, "/deliverers"), { method: "POST", body }),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateDeliverer() {
  const { company } = useAuthStore();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<CreateDelivererBody>) =>
      request<FoodDeliverer>(path(company!.id, "/deliverers/" + id), { method: "PATCH", body }),
    onSuccess: (_, vars) => invalidate({ delivererId: vars.id }),
  });
}

export function useDeleteDeliverer() {
  const { company } = useAuthStore();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      request<{ ok: boolean }>(path(company!.id, "/deliverers/" + id), { method: "DELETE" }),
    onSuccess: () => invalidate(),
  });
}

export function useMarkPayout() {
  const { company } = useAuthStore();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, until }: { id: string; until: string }) =>
      request<FoodDeliverer>(path(company!.id, "/deliverers/" + id + "/payout"), {
        method: "PATCH",
        body: { until },
      }),
    onSuccess: (_, vars) => invalidate({ delivererId: vars.id }),
  });
}

// ============================================================
// Helpers
// ============================================================
export function vehicleIcon(v: FoodDeliverer["vehicle"]): string {
  return v === "moto" ? "🏍️" : v === "bike" ? "🚲" : v === "carro" ? "🚗" : "🚶";
}

export function vehicleLabel(v: FoodDeliverer["vehicle"]): string {
  return v === "moto" ? "Moto" : v === "bike" ? "Bicicleta" : v === "carro" ? "Carro" : "A pé";
}

export function commissionLabel(d: Pick<FoodDeliverer, "commission_mode" | "commission_value">): string {
  if (d.commission_mode === "pct") return Number(d.commission_value).toFixed(1) + "% por entrega";
  return "R$ " + Number(d.commission_value).toFixed(2) + " por entrega";
}
