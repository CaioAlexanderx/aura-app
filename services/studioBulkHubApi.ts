// ============================================================
// AURA. — services/studioBulkHubApi.ts
// Endpoints F6 (Bulk Events) + F7 (Hub Studio).
// Arquivo separado de studioApi.ts pra evitar inflar — pode mergear depois.
// Migration 133. PR Aura-backend#113.
// ============================================================
import { request } from "./api";

// ─── F6 Bulk Events types ────────────────────────────────────
export type BulkEventStatus = "draft" | "confirmed" | "in_production" | "delivered" | "cancelled";

export type BulkEvent = {
  id: string;
  event_name: string;
  event_date: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  product_id: string | null;
  product_name_snapshot: string | null;
  base_unit_price: number;
  total_qty: number;
  total_amount: number;
  discount_pct: number;
  delivery_deadline: string | null;
  notes: string | null;
  status: BulkEventStatus;
  created_at: string;
};

export type BulkEventItem = {
  id?: string;
  line_number: number;
  recipient_name: string | null;
  customization: any | null;
  notes: string | null;
};

export type BulkPricingPreview = {
  qty: number;
  unit_price: number;
  discount_pct: number;
  total_amount: number;
  savings: number;
  tiers: Array<{ from: number; pct: number; label: string }>;
};

// ─── F7 Hub types ────────────────────────────────────────────
export type HubStats = {
  orders: {
    pending_art: number;
    approved: number;
    in_production: number;
    ready: number;
    delivered_7d: number;
    overdue: number;
    orders_today: number;
    orders_7d: number;
    total: number;
  };
  revenue: { today: number; last_7d: number };
  bulk: { active: number; deadline_7d: number };
  inputs: { low_stock_count: number };
  timestamp: string;
};

export type HubFeedItem = {
  id: string;
  kind: "order" | "bulk";
  created_at: string;
  amount: number;
  status: string;
  name: string | null;
  qty: number;
};

export type HubAlert = {
  severity: "info" | "warning" | "danger";
  kind: "low_stock" | "overdue" | "pending_approval" | "event_deadline";
  title: string;
  sub: string;
  href: string;
};

// ═══════════════════════════════════════════════════════════
const base = (cid: string) => "/companies/" + cid + "/studio";

export const studioBulkHubApi = {
  // ── F6 Bulk Events ──
  listBulkEvents: (cid: string, q?: { status?: BulkEventStatus; limit?: number }) => {
    const qs = new URLSearchParams();
    if (q?.status) qs.set("status", q.status);
    if (q?.limit)  qs.set("limit", String(q.limit));
    const suffix = qs.toString() ? "?" + qs.toString() : "";
    return request<{ events: BulkEvent[] }>(base(cid) + "/bulk-events" + suffix, { method: "GET", retry: 1, timeout: 8000 });
  },
  getBulkEvent: (cid: string, eid: string) =>
    request<{ event: BulkEvent; items: BulkEventItem[] }>(
      base(cid) + "/bulk-events/" + eid, { method: "GET", retry: 1, timeout: 8000 }
    ),
  createBulkEvent: (cid: string, body: {
    event_name: string;
    event_date?: string;
    customer_name?: string;
    customer_phone?: string;
    customer_email?: string;
    product_id?: string;
    base_unit_price: number;
    delivery_deadline?: string;
    notes?: string;
    status?: BulkEventStatus;
    items: Array<{ recipient_name?: string; customization?: any; notes?: string }>;
  }) => request<{ event: BulkEvent; item_count: number; pricing: any }>(
    base(cid) + "/bulk-events",
    { method: "POST", body, retry: 0, timeout: 30000 } // long timeout pra eventos grandes
  ),
  updateBulkEvent: (cid: string, eid: string, body: Partial<BulkEvent>) =>
    request<BulkEvent>(base(cid) + "/bulk-events/" + eid, { method: "PATCH", body, retry: 0, timeout: 8000 }),
  cancelBulkEvent: (cid: string, eid: string) =>
    request<{ cancelled: true }>(base(cid) + "/bulk-events/" + eid, { method: "DELETE", retry: 0, timeout: 5000 }),
  previewBulkPricing: (cid: string, qty: number, unitPrice: number) =>
    request<BulkPricingPreview>(
      base(cid) + "/bulk-events/pricing/preview?qty=" + qty + "&unit_price=" + unitPrice,
      { method: "GET", retry: 1, timeout: 3000 }
    ),

  // ── F7 Hub ──
  hubStats: (cid: string) =>
    request<HubStats>(base(cid) + "/hub/stats", { method: "GET", retry: 1, timeout: 8000 }),
  hubFeed: (cid: string, source: "all" | "orders" | "bulk" = "all", limit = 100) =>
    request<{ items: HubFeedItem[] }>(
      base(cid) + "/hub/orders?source=" + source + "&limit=" + limit,
      { method: "GET", retry: 1, timeout: 8000 }
    ),
  hubAlerts: (cid: string) =>
    request<{ alerts: HubAlert[]; count: number }>(base(cid) + "/hub/alerts", { method: "GET", retry: 1, timeout: 8000 }),
};

export default studioBulkHubApi;
