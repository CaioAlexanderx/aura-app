// ============================================================
// AURA. — services/studioApi.ts
// Vertical Aura Studio (personalizados) — Fase 0/1/2/3
//
// Endpoints (todos sob /companies/:id/studio):
//   GET  /health
//   GET/PUT /products/:pid/customization-config + POST /personalize  (F1)
//   /gallery/* — categorias + templates + vinculação                 (F2)
//   /inputs/*, /compositions/* — BOM + custo + margem                (F3)
//
// Migrations 130 + 131. PRs Aura-backend#110 + #111.
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

// ─── F1 Customization config ─────────────────────────────────
export type CustomizationFieldType = "text" | "image" | "template" | "color" | "option";
export type CustomizationField = {
  id: string;
  type: CustomizationFieldType;
  label: string;
  required: boolean;
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
  product_id: string;
  name: string;
  is_personalizable: boolean;
  config: CustomizationConfig | null;
};

// ─── F2 Gallery ──────────────────────────────────────────────
export type TemplateCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  template_count?: number;
};
export type Template = {
  id: string;
  company_id: string;
  category_id: string | null;
  category_name?: string | null;
  category_color?: string | null;
  name: string;
  description: string | null;
  image_url: string;
  thumb_url: string | null;
  tags: string[];
  is_active: boolean;
  use_count: number;
  created_at: string;
  specifically_linked?: boolean;
};

// ─── F3 Inputs + Compositions ────────────────────────────────
export type StudioInput = {
  id: string;
  name: string;
  unit: string;
  unit_cost: number;
  stock_qty: number;
  stock_min: number | null;
  supplier_name: string | null;
  supplier_phone: string | null;
  notes: string | null;
  is_active: boolean;
  is_low_stock?: boolean;
};
export type CompositionItem = {
  id?: string;
  input_id: string;
  input_name?: string;
  input_unit?: string;
  input_unit_cost?: number;
  qty_per_unit: number;
  notes?: string | null;
  sort_order?: number;
};
export type CompositionResponse = {
  composition: { id: string; product_id: string; notes: string | null; is_active: boolean } | null;
  items: CompositionItem[];
  summary: {
    total_cost: number;
    margin_pct: number | null;
    product_price: number;
    product_name: string;
  } | null;
};
export type CompositionSummary = {
  composition_id: string;
  product_id: string;
  product_name: string;
  product_price: number;
  total_cost: number;
  margin_pct: number | null;
  item_count: number;
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

  // ── F2: categorias ──
  listCategories: (cid: string) =>
    request<{ categories: TemplateCategory[] }>(base(cid) + "/gallery/categories", { method: "GET", retry: 1, timeout: 8000 }),
  createCategory: (cid: string, body: Partial<TemplateCategory>) =>
    request<TemplateCategory>(base(cid) + "/gallery/categories", { method: "POST", body, retry: 0, timeout: 8000 }),
  updateCategory: (cid: string, catId: string, body: Partial<TemplateCategory>) =>
    request<TemplateCategory>(base(cid) + "/gallery/categories/" + catId, { method: "PATCH", body, retry: 0, timeout: 8000 }),
  deleteCategory: (cid: string, catId: string) =>
    request<{ deleted: true; id: string }>(base(cid) + "/gallery/categories/" + catId, { method: "DELETE", retry: 0, timeout: 8000 }),

  // ── F2: templates ──
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

  // ── F3: insumos ──
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

  // ── F3: composições ──
  getComposition: (cid: string, pid: string) =>
    request<CompositionResponse>(base(cid) + "/compositions/by-product/" + pid, { method: "GET", retry: 1, timeout: 8000 }),
  saveComposition: (cid: string, pid: string, body: { notes?: string; items: CompositionItem[] }) =>
    request<{ composition_id: string; item_count: number; summary: any }>(
      base(cid) + "/compositions/by-product/" + pid,
      { method: "PUT", body, retry: 0, timeout: 10000 }
    ),
  listCompositionsSummary: (cid: string) =>
    request<{ compositions: CompositionSummary[]; count: number }>(base(cid) + "/compositions/summary", { method: "GET", retry: 1, timeout: 8000 }),
};

export default studioApi;
