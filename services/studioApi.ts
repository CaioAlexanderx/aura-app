// ============================================================
// AURA. — services/studioApi.ts
// Vertical Aura Studio (personalizados) — Fase 0/1/2/3/4/5
//
// Migrations 130 + 131 + 132. PRs Aura-backend#110/#111/#112.
// Memory: plano_aura_studio_vertical_24mai2026
// ============================================================
import { request } from "./api";

// ─── F0 Health ───────────────────────────────────────────────
export type StudioHealth = {
  vertical: "studio";
  version: number;
  enabled: boolean;
  kds_enabled: boolean;
  gallery_enabled: boolean;
  approval_enabled: boolean;
  approval_mode: "wa_me" | "whatsapp_business";
  settings: Record<string, any>;
  timestamp: string;
};

// ─── F1 Customization ────────────────────────────────────────
export type CustomizationFieldType = "text" | "image" | "template" | "color" | "option";
export type CustomizationField = {
  id: string; type: CustomizationFieldType; label: string; required: boolean;
  config: {
    max_chars?: number; fonts?: string[]; colors?: string[];
    formats?: string[]; max_mb?: number; min_dpi?: number;
    category_ids?: string[];
    choices?: Array<{ value: string; label: string; price_delta?: number }>;
  };
};
export type CustomizationConfig = {
  print_area: { width_cm: number; height_cm: number; position?: "center" | "left" | "right" };
  fields: CustomizationField[];
};
export type CustomizationConfigResponse = {
  product_id: string; name: string; is_personalizable: boolean; config: CustomizationConfig | null;
};

// ─── F2 Gallery ──────────────────────────────────────────────
export type TemplateCategory = {
  id: string; name: string; slug: string;
  icon: string | null; color: string | null;
  sort_order: number; is_active: boolean; template_count?: number;
};
export type Template = {
  id: string; company_id: string;
  category_id: string | null; category_name?: string | null; category_color?: string | null;
  name: string; description: string | null;
  image_url: string; thumb_url: string | null;
  tags: string[]; is_active: boolean; use_count: number;
  created_at: string; specifically_linked?: boolean;
};

// ─── F3 Inputs + Compositions ────────────────────────────────
export type StudioInput = {
  id: string; name: string; unit: string;
  unit_cost: number; stock_qty: number; stock_min: number | null;
  supplier_name: string | null; supplier_phone: string | null; notes: string | null;
  is_active: boolean; is_low_stock?: boolean;
};
export type CompositionItem = {
  id?: string; input_id: string;
  input_name?: string; input_unit?: string; input_unit_cost?: number;
  qty_per_unit: number; notes?: string | null; sort_order?: number;
};
export type CompositionResponse = {
  composition: { id: string; product_id: string; notes: string | null; is_active: boolean } | null;
  items: CompositionItem[];
  summary: { total_cost: number; margin_pct: number | null; product_price: number; product_name: string } | null;
};
export type CompositionSummary = {
  composition_id: string; product_id: string; product_name: string; product_price: number;
  total_cost: number; margin_pct: number | null; item_count: number;
};

// ─── F4 KDS Orders ───────────────────────────────────────────
export type StudioProductionStatus = "pending_art" | "approved" | "in_production" | "ready" | "delivered";

export type StudioOrder = {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  studio_production_status: StudioProductionStatus | null;
  customer_name: string | null;
  customer_phone: string | null;
  display_name: string;
  item_count: number;
  pending_approval_url: string | null;
  approval_count: number;
};

export type StudioOrderItem = {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  customization: any | null;
};

export type StudioOrderDetail = {
  order: StudioOrder & { vertical: string; updated_at: string };
  items: StudioOrderItem[];
  approvals: StudioApproval[];
};

// ─── F5 Approval ─────────────────────────────────────────────
export type StudioApprovalStatus = "pending" | "approved" | "changes_requested" | "expired";

export type StudioApproval = {
  id: string;
  token: string;
  status: StudioApprovalStatus;
  mockup_url: string | null;
  message_text: string | null;
  customer_phone: string | null;
  expires_at: string;
  responded_at: string | null;
  response_note: string | null;
  created_at: string;
};

export type StudioApprovalCreated = StudioApproval & {
  approval_url: string;
  wa_me_link: string | null;
};

export type StudioApprovalRevision = {
  revision_number: number;
  mockup_url: string | null;
  note: string | null;
  created_by_type: "shop" | "customer";
  created_at: string;
};

// ─── Public approval response (sem auth) ──────────────────────
export type PublicApproval = {
  token: string;
  mockup_url: string;
  status: StudioApprovalStatus;
  response_note: string | null;
  responded_at: string | null;
  expires_at: string;
  shop: { name: string };
  order: {
    id: string;
    customer_name: string;
    total_amount: number;
    items: Array<{ product_name: string; quantity: number; unit_price: number; customization: any }>;
  };
  revisions: StudioApprovalRevision[];
};

// ═══════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════
const base = (cid: string) => "/companies/" + cid + "/studio";

export const studioApi = {
  // ── F0/F1 ──
  health: (cid: string) =>
    request<StudioHealth>(base(cid) + "/health", { method: "GET", retry: 1, timeout: 8000 }),
  getCustomizationConfig: (cid: string, pid: string) =>
    request<CustomizationConfigResponse>(base(cid) + "/products/" + pid + "/customization-config", { method: "GET", retry: 1, timeout: 8000 }),
  saveCustomizationConfig: (cid: string, pid: string, cfg: CustomizationConfig) =>
    request<CustomizationConfigResponse>(base(cid) + "/products/" + pid + "/customization-config", { method: "PUT", body: cfg, retry: 0, timeout: 10000 }),
  togglePersonalizable: (cid: string, pid: string, enabled: boolean) =>
    request<{ id: string; is_personalizable: boolean }>(base(cid) + "/products/" + pid + "/personalize", { method: "POST", body: { enabled }, retry: 0, timeout: 5000 }),

  // ── F2 Gallery ──
  listCategories: (cid: string) =>
    request<{ categories: TemplateCategory[] }>(base(cid) + "/gallery/categories", { method: "GET", retry: 1, timeout: 8000 }),
  createCategory: (cid: string, body: Partial<TemplateCategory>) =>
    request<TemplateCategory>(base(cid) + "/gallery/categories", { method: "POST", body, retry: 0, timeout: 8000 }),
  updateCategory: (cid: string, catId: string, body: Partial<TemplateCategory>) =>
    request<TemplateCategory>(base(cid) + "/gallery/categories/" + catId, { method: "PATCH", body, retry: 0, timeout: 8000 }),
  deleteCategory: (cid: string, catId: string) =>
    request<{ deleted: true; id: string }>(base(cid) + "/gallery/categories/" + catId, { method: "DELETE", retry: 0, timeout: 8000 }),
  listTemplates: (cid: string, q?: { category_id?: string; tag?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (q?.category_id) qs.set("category_id", q.category_id);
    if (q?.tag)         qs.set("tag", q.tag);
    if (q?.limit)       qs.set("limit", String(q.limit));
    const suffix = qs.toString() ? "?" + qs.toString() : "";
    return request<{ templates: Template[] }>(base(cid) + "/gallery/templates" + suffix, { method: "GET", retry: 1, timeout: 8000 });
  },
  createTemplate: (cid: string, body: {
    category_id?: string | null; name: string; description?: string | null;
    image_url: string; thumb_url?: string | null; tags?: string[];
  }) => request<Template>(base(cid) + "/gallery/templates", { method: "POST", body, retry: 0, timeout: 10000 }),
  updateTemplate: (cid: string, tplId: string, body: Partial<Template>) =>
    request<Template>(base(cid) + "/gallery/templates/" + tplId, { method: "PATCH", body, retry: 0, timeout: 8000 }),
  deleteTemplate: (cid: string, tplId: string) =>
    request<{ deleted: true; id: string }>(base(cid) + "/gallery/templates/" + tplId, { method: "DELETE", retry: 0, timeout: 8000 }),
  templatesByProduct: (cid: string, pid: string) =>
    request<{ templates: Template[] }>(base(cid) + "/gallery/by-product/" + pid, { method: "GET", retry: 1, timeout: 8000 }),
  linkTemplate: (cid: string, pid: string, templateId: string, sortOrder = 0) =>
    request<any>(base(cid) + "/gallery/products/" + pid + "/templates", { method: "POST", body: { template_id: templateId, sort_order: sortOrder }, retry: 0, timeout: 5000 }),
  unlinkTemplate: (cid: string, pid: string, templateId: string) =>
    request<{ unlinked: true }>(base(cid) + "/gallery/products/" + pid + "/templates/" + templateId, { method: "DELETE", retry: 0, timeout: 5000 }),

  // ── F3 Inputs + Compositions ──
  listInputs: (cid: string) =>
    request<{ inputs: StudioInput[] }>(base(cid) + "/inputs", { method: "GET", retry: 1, timeout: 8000 }),
  listLowStock: (cid: string) =>
    request<{ inputs: StudioInput[]; count: number }>(base(cid) + "/inputs/low-stock", { method: "GET", retry: 1, timeout: 5000 }),
  createInput: (cid: string, body: Partial<StudioInput>) =>
    request<StudioInput>(base(cid) + "/inputs", { method: "POST", body, retry: 0, timeout: 8000 }),
  updateInput: (cid: string, iid: string, body: Partial<StudioInput>) =>
    request<StudioInput>(base(cid) + "/inputs/" + iid, { method: "PATCH", body, retry: 0, timeout: 8000 }),
  deleteInput: (cid: string, iid: string) =>
    request<{ deleted: true; id: string }>(base(cid) + "/inputs/" + iid, { method: "DELETE", retry: 0, timeout: 5000 }),
  getComposition: (cid: string, pid: string) =>
    request<CompositionResponse>(base(cid) + "/compositions/by-product/" + pid, { method: "GET", retry: 1, timeout: 8000 }),
  saveComposition: (cid: string, pid: string, body: { notes?: string; items: CompositionItem[] }) =>
    request<{ composition_id: string; item_count: number; summary: any }>(
      base(cid) + "/compositions/by-product/" + pid,
      { method: "PUT", body, retry: 0, timeout: 10000 }
    ),
  listCompositionsSummary: (cid: string) =>
    request<{ compositions: CompositionSummary[]; count: number }>(base(cid) + "/compositions/summary", { method: "GET", retry: 1, timeout: 8000 }),

  // ── F4 KDS Orders ──
  listOrders: (cid: string, q?: { status?: StudioProductionStatus; days?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (q?.status) qs.set("status", q.status);
    if (q?.days)   qs.set("days", String(q.days));
    if (q?.limit)  qs.set("limit", String(q.limit));
    const suffix = qs.toString() ? "?" + qs.toString() : "";
    return request<{ orders: StudioOrder[] }>(base(cid) + "/orders" + suffix, { method: "GET", retry: 1, timeout: 10000 });
  },
  getOrder: (cid: string, oid: string) =>
    request<StudioOrderDetail>(base(cid) + "/orders/" + oid, { method: "GET", retry: 1, timeout: 8000 }),
  updateProductionStatus: (cid: string, oid: string, status: StudioProductionStatus) =>
    request<{ id: string; studio_production_status: StudioProductionStatus }>(
      base(cid) + "/orders/" + oid + "/production-status",
      { method: "PATCH", body: { status }, retry: 0, timeout: 5000 }
    ),

  // ── F5 Approval (autenticado) ──
  requestApproval: (cid: string, oid: string, body: {
    mockup_url: string;
    customer_phone?: string;
    custom_message?: string;
    expires_in_days?: number;
  }) => request<StudioApprovalCreated>(
    base(cid) + "/orders/" + oid + "/approval",
    { method: "POST", body, retry: 0, timeout: 10000 }
  ),
  listApprovals: (cid: string, oid: string) =>
    request<{ approvals: Array<StudioApproval & { revisions: StudioApprovalRevision[] }> }>(
      base(cid) + "/orders/" + oid + "/approval", { method: "GET", retry: 1, timeout: 8000 }
    ),
  cancelApproval: (cid: string, approvalId: string) =>
    request<{ cancelled: true }>(base(cid) + "/approval/" + approvalId + "/cancel", { method: "POST", retry: 0, timeout: 5000 }),

  // ── F5 Approval pública (sem auth) ──
  getPublicApproval: (token: string) =>
    request<PublicApproval>("/aprovacao/" + token, { method: "GET", retry: 1, timeout: 8000, skipAuth: true } as any),
  respondPublicApproval: (token: string, body: { action: "approve" | "request_changes"; note?: string }) =>
    request<{ ok: true; action: string; new_status: StudioApprovalStatus; message: string }>(
      "/aprovacao/" + token + "/respond",
      { method: "POST", body, retry: 0, timeout: 10000, skipAuth: true } as any
    ),
};

export default studioApi;
