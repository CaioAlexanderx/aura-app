import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

// ============================================================
// AURA Food — Hub de Pedidos (Fase 10).
//
// Backend (foodHub.js) agrega food_orders + digital_orders num só
// payload, com filtros multi-canal e KPIs derivados.
//
// Polling:
//   - orders   10s (alta frequencia, central de operacao)
//   - stats    30s
//   - channels 60s (status de conexao muda raro)
//
// Multi-CNPJ: usa company.id direto do auth store; ao trocar de
// company o queryKey muda e refetch automatico.
// ============================================================

export type HubOrderSource = "food_orders" | "digital_orders";

export interface HubOrderItem {
  id?: string;
  name: string;
  variation?: string | null;
  quantity: number;
  total: number;
}

export interface HubOrder {
  id: string;
  source: HubOrderSource;
  status: string;
  channel?: string;
  external_channel?: string | null;
  external_order_id?: string | null;
  total_amount: number;
  created_at: string;
  confirmed_at?: string | null;
  ready_at?: string | null;
  delivered_at?: string | null;
  customer_name?: string | null;
  customer_address?: any;
  customer_phone?: string | null;
  deliverer_id?: string | null;
  deliverer_name?: string | null;
  deliverer_pin?: string | null;
  dispatched_at?: string | null;
  sale_id?: string | null;
  nfce_emission_id?: string | null;
  items: HubOrderItem[];
  table_number?: string | null;
  delivery_mode?: "delivery" | "pickup" | "dine_in" | null;
}

export interface HubStats {
  today_orders: number;
  open_orders: number;
  today_revenue: number;
  avg_prep_min: number;
  in_route: number;
}

export interface HubChannel {
  key: string;
  label: string;
  connected: boolean;
  connection_status?: string;
  count_today: number;
  count_open: number;
}

export interface HubFilters {
  channels?: string[];
  status?: string[];
  limit?: number;
}

function path(cid: string, suffix: string) {
  return "/companies/" + cid + "/food/hub" + suffix;
}

export function useHubOrders(filters?: HubFilters) {
  const { company, token } = useAuthStore();
  const enabled = !!token && !!company?.id;

  return useQuery({
    queryKey: ["food-hub-orders", company?.id, filters?.channels, filters?.status, filters?.limit],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.channels?.length) params.set("channels", filters.channels.join(","));
      if (filters?.status?.length) params.set("status", filters.status.join(","));
      if (filters?.limit) params.set("limit", String(filters.limit));
      const qs = params.toString();
      return request<{ orders: HubOrder[]; total: number; filters?: any }>(
        path(company!.id, "/orders" + (qs ? "?" + qs : ""))
      );
    },
    enabled,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

export function useHubStats() {
  const { company, token } = useAuthStore();
  const enabled = !!token && !!company?.id;

  return useQuery({
    queryKey: ["food-hub-stats", company?.id],
    queryFn: () => request<HubStats>(path(company!.id, "/stats")),
    enabled,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useHubChannels() {
  const { company, token } = useAuthStore();
  const enabled = !!token && !!company?.id;

  return useQuery({
    queryKey: ["food-hub-channels", company?.id],
    queryFn: () => request<{ channels: HubChannel[] }>(path(company!.id, "/channels")),
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

// ============================================================
// Helpers de UI
// ============================================================

// minutos desde created_at
export function orderAgeMinutes(createdAt: string): number {
  const now = Date.now();
  const ts = new Date(createdAt).getTime();
  if (isNaN(ts)) return 0;
  return Math.max(0, Math.floor((now - ts) / 60_000));
}

// color aging lateral: ok / warn / late
export type AgeStatus = "ok" | "warn" | "late";
export function orderAgeStatus(createdAt: string, warnMin = 10, lateMin = 20): AgeStatus {
  const m = orderAgeMinutes(createdAt);
  if (m >= lateMin) return "late";
  if (m >= warnMin) return "warn";
  return "ok";
}

// pedido novo (< 2min) — pulse animation
export function isNewOrder(createdAt: string): boolean {
  return orderAgeMinutes(createdAt) < 2;
}

// status normalizado pra board (Novo / Preparando / Pronto / Em rota)
export type BoardColumn = "new" | "preparing" | "ready" | "in_route" | "other";
export function orderBoardColumn(o: HubOrder): BoardColumn {
  const s = (o.status || "").toLowerCase();
  if (s === "pending" || s === "awaiting_approval" || s === "pending_payment" || s === "confirmed") return "new";
  if (s === "preparing") return "preparing";
  if (s === "ready") return "ready";
  if (s === "out_for_delivery" || s === "dispatched" || s === "in_route") return "in_route";
  return "other";
}
