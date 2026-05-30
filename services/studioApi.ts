// ============================================================
// AURA. — services/studioApi.ts
// Vertical Aura Studio (personalizados) — Fase 0/1/2/3/4/5 + Nivel 1 + Marketplaces S-0/S-1/S-2 + OAuth Core + Camada 1
//
// 25/05/2026 (OAuth Core + Revisões): adiciona 5 metodos OAuth marketplace
// (getMarketplaceAuthUrl, authorizeMarketplace, listConnections, revokeConnection,
// refreshConnection) + estende StudioSettings com max_revisions_included +
// extra_revision_price + revision_policy_text.
// Memory: studio_bridges_completas_25mai2026, projeto_core_ml_shopee_f1b_f2b_25mai2026
//
// 26/05/2026 (Fase 10B): suggestTemplates — IA Haiku 4.5 sugere templates
// da galeria pra produtos com base em nome+categoria+tags.
//
// 26/05/2026 (Verso/Frente-e-verso): estende CustomizationConfig com
// has_back, back_print_area, back_charge_enabled, back_price_delta +
// adiciona campo opcional `side` em CustomizationField pra agrupar
// fields entre frente/verso no admin e no storefront público.
//
// 26/05/2026 (Painel): adiciona PainelData + getPainel pro novo home
// /studio (substitui home antiga). Backend: GET /studio/painel?days=N.
//
// 26/05/2026 (Painel v2): KPI de lucro vira "lucro_liquido_mes"
// (Receita - Despesa do mês, fonte transactions) substituindo o antigo
// "lucro_bruto_mes" (Receita - custo de insumos). Acompanha refactor do
// backend; novo campo despesa_mes, removido custo_insumos.
//
// 30/05/2026 (Camada 1 — Fase 0 Gate): tipos + stubs completos
// — StudioQuoteStatus/StudioQuoteItem/StudioQuote/StudioQuoteDetail/StudioQuoteCreated/PublicQuote
// — StudioPricingTier/StudioPricingRule/PricingBreakdown
// — StudioPaymentKind/StudioPaymentStatus/StudioPayment
// — Métodos quote: listQuotes/createQuote/getQuote/updateQuote/deleteQuote/sendQuote/convertQuote
// — Métodos aceite público: getPublicQuote/respondPublicQuote (skipAuth, /orcamento/:token)
// — Métodos pricing: listPricingRules/savePricingRule/calculateQuoteLine
// — Métodos payments: listOrderPayments/createOrderPayment/markPaymentPaid/createChargeLink
// ============================================================
import { request } from "./api";

// ─── F0 Health ──────────────────────────────────────────────────────────────────
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

// ─── F1 Customization ────────────────────────────────────────────────────────────────
export type CustomizationFieldType = "text" | "image" | "template" | "color" | "option";
export type CustomizationFieldSide = "front" | "back";
export type CustomizationField = {
  id: string; type: CustomizationFieldType; label: string; required: boolean;
  // Lado da peça onde o campo aparece. Default "front" (compat).
  side?: CustomizationFieldSide;
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
  // ─── Verso (opt-in pela loja) ────────────────────────────
  // Quando has_back === true, fields com side === "back" são
  // renderizados num bloco separado abaixo da frente. Quando a
  // loja cobra adicional pelo verso, back_charge_enabled = true e
  // back_price_delta soma no total apenas quando o cliente marca
  // "Quero personalizar o verso".
  has_back?: boolean;
  back_print_area?: { width_cm: number; height_cm: number; position?: "center" | "left" | "right" };
  back_charge_enabled?: boolean;
  back_price_delta?: number;
};
export type CustomizationConfigResponse = {
  product_id: string; name: string; is_personalizable: boolean; config: CustomizationConfig | null;
};

// ─── F2 Gallery ─────────────────────────────────────────────────────────────────────
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

// ─── F3 Inputs + Compositions ───────────────────────────────────────────────────
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

// ─── F4 KDS Orders ─────────────────────────────────────────────────────
export type StudioProductionStatus =
  | "awaiting_customization"
  | "pending_art"
  | "approved"
  | "in_production"
  | "ready"
  | "delivered"
  | "cancelled";

export type StudioOrderSource = "digital" | "pdv" | "marketplace";

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
  source?: StudioOrderSource;
  digital_order_id?: string | null;
  pdv_sale_id?: string | null;
  marketplace_platform?: "mercado_livre" | "shopee" | null;
  customization_collected_at?: string | null;
  // Camada 1: gate de produção por sinal
  deposit_required?: number | null;
  deposit_paid?: boolean;
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
  order: StudioOrder & { vertical?: string; updated_at: string };
  items: StudioOrderItem[];
  approvals: StudioApproval[];
};

// ─── F5 Approval ──────────────────────────────────────────────────────────────────
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

// ─── Nivel 1 (25/05) — Settings + Metrics + SLA ──────────────
export type StudioSettings = {
  default_sla_days?: number;
  production_capacity_per_day?: number;
  approval_wa_phone?: string;
  approval_template_message?: string;
  ncm_defaults?: Record<string, string>;
  onboarding?: Record<string, boolean>;
  marketplace_handling_days?: number;
  // Política de revisões (Loja Digital Studio 25/05/2026)
  max_revisions_included?: number;       // qtas revisões grátis (0 = ilimitado)
  extra_revision_price?: number;         // preço cobrado por revisão extra
  revision_policy_text?: string;         // texto exibido pro cliente
  [key: string]: any;
};

export type StudioMetrics = {
  em_producao: number;
  aguardando_arte: number;
  aprovados: number;
  ready_total: number;
  prontos_hoje: number;
  vendas_periodo: number;
  pedidos_periodo: number;
  revenue_today: number;
  revenue_7d: number;
  orders_7d: number;
  orders_today: number;
  delivered_7d: number;
  overdue_count: number;
  total_orders: number;
  margem_media_pct: number | null;
  tempo_medio_dias: number | null;
  period_days: number;
  computed_at: string;
};

export type StudioSlaEstimate = {
  sla_base_days: number;
  queue_qty: number;
  capacity_per_day: number;
  queue_added_days: number;
  total_estimate_days: number;
  requested_products: number;
};

// ─── Painel (26/05) — Home dashboard ──────────────────────────
export type PainelKpi = {
  value: number;
  delta_pct: number | null;
  sub_label: string | null;
};

export type PainelLucroLiquidoKpi = {
  value: number;              // Receita - Despesa (pode ser negativo)
  receita_mes: number;
  despesa_mes: number;
  margem_pct: number | null;  // value / receita_mes * 100, null se receita=0
  delta_pct: number | null;   // delta vs mes anterior
};

export type PainelSeriePoint = {
  label: string;       // ex "Qua", "26/05"
  value: number;       // R$
  is_today?: boolean;
};

export type PainelTopProduto = {
  product_id: string | null;
  name: string;
  revenue: number;
  qty: number;
};

export type PainelFunilStage = {
  count: number;
  pct: number;         // 0-100
};

export type PainelData = {
  period_days: number;
  computed_at: string;
  kpis: {
    vendas_dia: PainelKpi;
    ticket_medio: PainelKpi;
    lucro_liquido_mes: PainelLucroLiquidoKpi;
  };
  faturamento_serie: PainelSeriePoint[];
  faturamento_total: number;
  top_produtos: PainelTopProduto[];
  funil_aprovacao: {
    pendentes: PainelFunilStage;
    aprovados: PainelFunilStage;
    alteracoes: PainelFunilStage;
    expirados: PainelFunilStage;
    total_enviados: number;
    aprovacao_primeira_pct: number | null;
    tempo_medio_resposta_min: number | null;
  };
};

// ─── Marketplaces S-1 (25/05) — Listing Preview ──────────────
export type MarketplacePlatform = "mercado_livre" | "shopee";

export type MarketplaceListingPreview = {
  platform: MarketplacePlatform;
  product_id: string;
  product_name: string;
  handling_time_days: number;
  payload: Record<string, any>;
  core_adapter_status: "pending" | "ready";
  note: string;
};

// ─── Marketplaces OAuth Core (25/05) — Conexões ──────────────
export type MarketplaceConnection = {
  id: string;
  platform: MarketplacePlatform;
  store_id: string | null;
  store_name: string | null;
  status: "ativo" | "revogado" | "expirado";
  scope: string | null;
  token_expires: string | null;
  created_at: string;
  updated_at: string;
  token_state: "fresh" | "expiring" | "expired" | null;
};

export type MarketplaceConnectionsResponse = {
  connections: MarketplaceConnection[];
  by_platform: Record<MarketplacePlatform, MarketplaceConnection | null>;
  supported_platforms: MarketplacePlatform[];
};

export type MarketplaceAuthUrlResponse = {
  auth_url: string;
  state: string;
  platform: MarketplacePlatform;
};

export type MarketplaceAuthorizeResponse = {
  ok: true;
  platform: MarketplacePlatform;
  connection: {
    id: string;
    store_id: string | null;
    store_name: string | null;
    status: string;
    scope: string | null;
    token_expires: string | null;
  };
};

// ─── Marketplaces S-2 (25/05) — Marketplace Orders ───────────
export type MarketplaceOrderStudio = {
  id: string;
  platform: MarketplacePlatform;
  external_id: string;
  status: string;
  customer_name: string | null;
  customer_doc: string | null;
  shipping_address: any | null;
  items: Array<{
    product_id?: string;
    product_name?: string;
    quantity: number;
    unit_price: number;
    [key: string]: any;
  }>;
  subtotal: number;
  total: number;
  marketplace_fee: number | null;
  tracking_code: string | null;
  customization_collected_at: string | null;
  customization_data: Record<string, any> | null;
  created_at: string;
  updated_at: string;
};

export type MarketplaceOrdersListResponse = {
  orders: MarketplaceOrderStudio[];
  count: number;
  pending_only: boolean;
  platform: MarketplacePlatform | null;
};

export type CollectMarketplaceCustomizationResponse = {
  ok: true;
  order_id: string;
  customization_collected_at: string;
  customization_data: Record<string, any>;
  next_step: "pending_art";
  message: string;
};

// ─── Camada 1 (30/05/2026) — Orçamento, Precificação, Pagamentos ──────────────
// Fase 0 Gate: tipos + stubs completos. Fases A/B/C/D implementam os endpoints;
// este arquivo NÃO precisa ser editado novamente pelas fases paralelas.

// ── Orçamento (Fase A) ───────────────────────────────────────────────────────
export type StudioQuoteStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "converted";

export type StudioQuoteItem = {
  id?: string;
  product_id: string | null;           // null = item livre (DA-A: product_id nullable)
  description: string;                  // nome do produto OU texto livre
  quantity: number;
  unit_price: number;                   // preço final (pós-motor/override)
  unit_cost?: number | null;            // custo do BOM no momento (snapshot)
  pricing_meta?: any | null;            // breakdown do motor {base_cost, labor, setup, tier_multiplier, margin_pct, urgency}
  customization?: any | null;           // briefing por item (reutiliza estrutura do Canal Digital)
  sort_order?: number;
};

export type StudioQuote = {
  id: string;
  company_id: string;
  customer_id?: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: StudioQuoteStatus;
  token?: string | null;
  subtotal: number;
  discount: number;
  total: number;
  estimated_cost: number | null;        // soma do BOM dos itens (margem)
  validity_days: number;
  expires_at: string | null;
  sent_at: string | null;
  responded_at: string | null;
  response_note?: string | null;
  order_id: string | null;              // preenchido na conversão → digital_order id
  deposit_pct: number | null;           // DA-C: % de sinal escolhido pelo lojista (ex: 50.00)
  deposit_amount: number | null;        // valor absoluto do sinal
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
};

export type StudioQuoteDetail = {
  quote: StudioQuote;
  items: StudioQuoteItem[];
};

export type StudioQuoteCreated = StudioQuote & {
  quote_url: string;                    // link público /orcamento/:token
  wa_me_link: string | null;            // link wa.me pré-montado (se approval_wa_phone configurado)
};

export type PublicQuote = {
  token: string;
  status: StudioQuoteStatus;
  expires_at: string;
  shop: { name: string };
  customer_name: string | null;
  subtotal: number;
  discount: number;
  total: number;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    customization: any;
  }>;
  // Sinal (se deposit_pct definido no orçamento)
  deposit_pct?: number | null;
  deposit_amount?: number | null;
};

// ── Motor de Precificação (Fase B) ────────────────────────────────────────────
export type PricingBreakdown = {
  unit_price: number;
  breakdown: {
    base_cost: number;       // custo do BOM ou unit_cost do produto
    labor: number;           // mão de obra por unidade
    setup: number;           // setup/arte rateado pela quantidade
    tier_multiplier: number; // multiplicador da faixa de tiragem (1.0 = sem faixa)
    margin_pct: number | null;
    urgency: number;         // acréscimo de urgência (valor, não %)
  };
};

export type StudioPricingTier = {
  min_qty: number;
  max_qty: number | null;
  unit_multiplier?: number; // multiplica o custo base (ex: 0.8 = 20% desconto)
  unit_price?: number;      // preço fixo por unidade nessa faixa
};

export type StudioPricingRule = {
  id?: string;
  company_id?: string;
  product_id: string | null;           // null = regra global da loja
  setup_fee: number;
  labor_cost: number;
  default_margin_pct: number | null;
  urgency_pct: number;
  qty_tiers: StudioPricingTier[] | null; // DA-B: faixas SEMPRE por produto; global não define tiers
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

// ── Pagamentos / Sinal (Fase C) ───────────────────────────────────────────────
export type StudioPaymentKind = "deposit" | "balance" | "full";
export type StudioPaymentStatus = "pending" | "paid" | "cancelled";

export type StudioPayment = {
  id: string;
  company_id: string;
  order_id: string;
  kind: StudioPaymentKind;
  amount: number;
  status: StudioPaymentStatus;
  method: "pix" | "card" | "cash" | "other" | null;
  asaas_charge_id: string | null;
  due_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at?: string;
};

// ══════════════════════════════════════════════════════════
// API
// ══════════════════════════════════════════════════════════
const base = (cid: string) => "/companies/" + cid + "/studio";
const mkt  = (cid: string) => "/companies/" + cid + "/marketplaces";

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

  // ── Fase 10B (26/05) — IA sugere templates da galeria pro produto ──
  suggestTemplates: (cid: string, pid: string) =>
    request<{
      suggestions: Array<{ template_id: string; reason: string; score: number }>;
      fallback?: boolean;
      ai_powered?: boolean;
      message?: string;
    }>(
      base(cid) + "/products/" + pid + "/suggest-templates",
      { method: "POST", retry: 0, timeout: 20000 }
    ),

  // ── Nivel 1: Settings ─────────────────────────────────
  getSettings: (cid: string) =>
    request<{ settings: StudioSettings }>(base(cid) + "/settings", { method: "GET", retry: 1, timeout: 5000 }),
  saveSettings: (cid: string, patch: Partial<StudioSettings>) =>
    request<{ settings: StudioSettings }>(base(cid) + "/settings", { method: "PATCH", body: patch, retry: 0, timeout: 8000 }),

  // ── Nivel 1: Metrics + SLA ───────────────────────────────
  getMetrics: (cid: string, days = 7) =>
    request<StudioMetrics>(base(cid) + "/metrics?days=" + days, { method: "GET", retry: 1, timeout: 8000 }),
  getSlaEstimate: (cid: string, productIds?: string[]) => {
    const qs = productIds && productIds.length ? "?products=" + productIds.join(",") : "";
    return request<StudioSlaEstimate>(base(cid) + "/sla/estimate" + qs, { method: "GET", retry: 1, timeout: 5000 });
  },

  // ── Painel (26/05) — home /studio ─────────────────────────
  getPainel: (cid: string, days = 7) =>
    request<PainelData>(base(cid) + "/painel?days=" + days, { method: "GET", retry: 1, timeout: 10000 }),

  // ── Marketplaces S-1 — Preview + handling_days ──
  getMarketplaceListingPreview: (cid: string, pid: string, platform: MarketplacePlatform = "mercado_livre") =>
    request<MarketplaceListingPreview>(
      base(cid) + "/marketplace-listings/preview/" + pid + "?platform=" + platform,
      { method: "GET", retry: 1, timeout: 8000 }
    ),
  saveMarketplaceHandlingDays: (cid: string, days: number) =>
    request<{ marketplace_handling_days: number; settings: StudioSettings }>(
      base(cid) + "/marketplace-settings",
      { method: "PATCH", body: { marketplace_handling_days: days }, retry: 0, timeout: 5000 }
    ),

  // ── Marketplaces OAuth Core (25/05) — Conectar ML/Shopee ──
  listMarketplaceConnections: (cid: string) =>
    request<MarketplaceConnectionsResponse>(
      mkt(cid) + "/connections",
      { method: "GET", retry: 1, timeout: 8000 }
    ),
  getMarketplaceAuthUrl: (cid: string, platform: MarketplacePlatform) =>
    request<MarketplaceAuthUrlResponse>(
      mkt(cid) + "/" + platform + "/auth-url",
      { method: "GET", retry: 0, timeout: 8000 }
    ),
  authorizeMarketplace: (cid: string, platform: MarketplacePlatform, body: { code: string; shop_id?: string }) =>
    request<MarketplaceAuthorizeResponse>(
      mkt(cid) + "/" + platform + "/authorize",
      { method: "POST", body, retry: 0, timeout: 15000 }
    ),
  refreshMarketplaceConnection: (cid: string, platform: MarketplacePlatform) =>
    request<{ ok: true; token_expires: string | null }>(
      mkt(cid) + "/" + platform + "/refresh",
      { method: "POST", retry: 0, timeout: 10000 }
    ),
  revokeMarketplaceConnection: (cid: string, platform: MarketplacePlatform) =>
    request<{ ok: true; message: string }>(
      mkt(cid) + "/" + platform + "/revoke",
      { method: "POST", retry: 0, timeout: 8000 }
    ),

  // ── Marketplaces S-2 (25/05) — Coleta de personalizacao ──
  listMarketplaceOrders: (cid: string, opts?: {
    pending_only?: boolean;
    platform?: MarketplacePlatform;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (opts?.pending_only !== undefined) qs.set("pending_only", String(opts.pending_only));
    if (opts?.platform) qs.set("platform", opts.platform);
    if (opts?.limit) qs.set("limit", String(opts.limit));
    const suffix = qs.toString() ? "?" + qs.toString() : "";
    return request<MarketplaceOrdersListResponse>(
      base(cid) + "/marketplace-orders" + suffix,
      { method: "GET", retry: 1, timeout: 8000 }
    );
  },
  collectMarketplaceCustomization: (cid: string, oid: string, customization: Record<string, any>) =>
    request<CollectMarketplaceCustomizationResponse>(
      base(cid) + "/marketplace-orders/" + oid + "/customization",
      { method: "PATCH", body: { customization }, retry: 0, timeout: 8000 }
    ),
  stubCreateMarketplaceOrder: (cid: string, body: {
    platform: MarketplacePlatform;
    external_id?: string;
    customer_name?: string;
    customer_doc?: string;
    items: Array<{ product_id?: string; product_name?: string; quantity: number; unit_price: number }>;
    total?: number;
    connection_id?: string;
  }) =>
    request<{ order: MarketplaceOrderStudio; stub: true }>(
      base(cid) + "/marketplace-orders/_stub_create",
      { method: "POST", body, retry: 0, timeout: 10000 }
    ),

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

  // ── Camada 1 — Orçamentos (Fase A) ───────────────────────────────────────────
  // CRUD + send (gera token/link) + convert (cria digital_order vertical=studio).
  // Stub 501 até a Fase A implementar. Contratos fixos — NÃO editar este arquivo.
  listQuotes: (cid: string, q?: { status?: StudioQuoteStatus; days?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (q?.status) qs.set("status", q.status);
    if (q?.days)   qs.set("days", String(q.days));
    if (q?.limit)  qs.set("limit", String(q.limit));
    const suffix = qs.toString() ? "?" + qs.toString() : "";
    return request<{ quotes: StudioQuote[] }>(base(cid) + "/quotes" + suffix, { method: "GET", retry: 1, timeout: 8000 });
  },
  createQuote: (cid: string, body: {
    customer_id?: string | null;
    customer_name?: string;
    customer_phone?: string;
    items: StudioQuoteItem[];
    discount?: number;
    validity_days?: number;
    deposit_pct?: number | null;
    deposit_amount?: number | null;
    notes?: string;
  }) =>
    request<StudioQuote>(base(cid) + "/quotes", { method: "POST", body, retry: 0, timeout: 10000 }),
  getQuote: (cid: string, qid: string) =>
    request<StudioQuoteDetail>(base(cid) + "/quotes/" + qid, { method: "GET", retry: 1, timeout: 8000 }),
  updateQuote: (cid: string, qid: string, body: Partial<{
    customer_name: string;
    customer_phone: string;
    items: StudioQuoteItem[];
    discount: number;
    validity_days: number;
    deposit_pct: number | null;
    deposit_amount: number | null;
    notes: string;
  }>) =>
    request<StudioQuote>(base(cid) + "/quotes/" + qid, { method: "PATCH", body, retry: 0, timeout: 10000 }),
  deleteQuote: (cid: string, qid: string) =>
    request<{ deleted: true; id: string }>(base(cid) + "/quotes/" + qid, { method: "DELETE", retry: 0, timeout: 5000 }),
  sendQuote: (cid: string, qid: string) =>
    request<StudioQuoteCreated>(base(cid) + "/quotes/" + qid + "/send", { method: "POST", retry: 0, timeout: 10000 }),
  convertQuote: (cid: string, qid: string) =>
    request<{ order_id: string; quote: StudioQuote }>(base(cid) + "/quotes/" + qid + "/convert", { method: "POST", retry: 0, timeout: 10000 }),

  // ── Camada 1 — Aceite público do orçamento (Fase A, sem auth) ────────────────
  // Espelha getPublicApproval/respondPublicApproval. Rota: /orcamento/:token.
  getPublicQuote: (token: string) =>
    request<PublicQuote>("/orcamento/" + token, { method: "GET", retry: 1, timeout: 8000, skipAuth: true } as any),
  respondPublicQuote: (token: string, body: { action: "accept" | "reject"; note?: string }) =>
    request<{ ok: true; action: string; new_status: StudioQuoteStatus; message: string }>(
      "/orcamento/" + token + "/respond",
      { method: "POST", body, retry: 0, timeout: 10000, skipAuth: true } as any
    ),

  // ── Camada 1 — Motor de Precificação (Fase B) ─────────────────────────────────
  // Cálculo vive no backend (fonte única). Frontend pinta breakdown e permite override.
  listPricingRules: (cid: string) =>
    request<{ rules: StudioPricingRule[] }>(base(cid) + "/pricing/rules", { method: "GET", retry: 1, timeout: 8000 }),
  savePricingRule: (cid: string, productId: string | "global", rule: Partial<StudioPricingRule>) =>
    request<StudioPricingRule>(base(cid) + "/pricing/rules/" + productId, { method: "PUT", body: rule, retry: 0, timeout: 8000 }),
  calculateQuoteLine: (cid: string, body: {
    product_id?: string | null;
    quantity: number;
    urgency?: boolean;
    overrides?: Partial<{ unit_price: number; unit_cost: number }>;
  }) =>
    request<PricingBreakdown>(base(cid) + "/pricing/quote-line", { method: "POST", body, retry: 0, timeout: 8000 }),

  // ── Camada 1 — Pagamentos / Sinal (Fase C) ────────────────────────────────────
  // DA-D: mark-paid = Pix manual; charge-link = modalidade de pagamento existente da loja virtual.
  listOrderPayments: (cid: string, oid: string) =>
    request<{ payments: StudioPayment[] }>(base(cid) + "/orders/" + oid + "/payments", { method: "GET", retry: 1, timeout: 8000 }),
  createOrderPayment: (cid: string, oid: string, body: {
    kind: StudioPaymentKind;
    amount: number;
    due_at?: string | null;
    method?: StudioPayment["method"];
  }) =>
    request<StudioPayment>(base(cid) + "/orders/" + oid + "/payments", { method: "POST", body, retry: 0, timeout: 8000 }),
  markPaymentPaid: (cid: string, pid: string, body?: { method?: StudioPayment["method"] }) =>
    request<{ ok: true; payment: StudioPayment; deposit_released: boolean }>(
      base(cid) + "/payments/" + pid + "/mark-paid",
      { method: "POST", body: body || {}, retry: 0, timeout: 8000 }
    ),
  createChargeLink: (cid: string, pid: string) =>
    request<{ ok: true; payment_url: string | null; pix_code: string | null; method: string }>(
      base(cid) + "/payments/" + pid + "/charge-link",
      { method: "POST", retry: 0, timeout: 10000 }
    ),
};

export default studioApi;
