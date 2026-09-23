// ============================================================
// AURA. — Matcon (materiais de construção): API client (M1)
//
// 22/09/2026. Rotas /companies/:id/matcon/* definidas em
// docs/CONTRACT_MATCON.md (seção M1). Gate: pdv_settings.matcon_enabled —
// o backend bloqueia só a ESCRITA com o toggle desligado (mesmo modelo da
// OS e da Ótica). Este arquivo é a única porta para essas rotas: as
// esteiras (/matcon/orcamentos, /matcon/entregas) e o "Salvar orçamento"
// do Caixa importam daqui; nenhuma tela monta URL na mão.
//
// Páginas públicas (sem auth) continuam nos clients que já existem:
//   - /orcamento/:token  -> studioApi.getPublicQuote / respondQuote
//   - /acompanhar/:token -> studioApi (PublicTrack), com tipo "entrega"
// ============================================================
import { request } from "./api";

// ── Orçamentos ──────────────────────────────────────────────
export type QuoteStatus = "open" | "approved" | "lost" | "expired";

export type QuoteItem = {
  product_id: string | null;
  name: string;
  unit: string | null;
  quantity: number;        // numeric(12,3)
  unit_price: number;
  discount?: number;
};

export type Quote = {
  id: string;
  number: number;
  status: QuoteStatus;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone?: string | null;
  seller_id?: string | null;
  seller_name?: string | null;
  valid_until: string;     // YYYY-MM-DD
  public_token: string;
  items: QuoteItem[];
  subtotal: number;
  discount: number;
  total: number;
  notes?: string | null;
  // Livre: "obra Rua das Acácias, 233" — não é um cadastro de obra (M4).
  reference?: string | null;
  approved_at?: string | null;
  converted_sale_id?: string | null;
  sent_at?: string | null;  // último envio por WhatsApp
  created_at: string;
  updated_at?: string;
};

export type QuoteCreateBody = {
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  seller_id?: string | null;
  valid_until?: string;     // default: hoje + matcon_quote_valid_days (backend)
  items: QuoteItem[];
  discount?: number;
  notes?: string | null;
  reference?: string | null;
};

export type QuoteListFilters = {
  status?: QuoteStatus | "all";
  q?: string;               // número, cliente ou referência
  limit?: number;
};

export type QuoteListResponse = {
  quotes: Quote[];
  // Cabeçalho da esteira: contagem e dinheiro parado por estação. O
  // backend calcula; o front só formata (§4b regra 2: a esteira mostra o
  // dinheiro).
  summary: {
    open: { count: number; total: number };
    expiring: { count: number; total: number };   // open com valid_until <= hoje + warn_days
    approved: { count: number; total: number };
    lost: { count: number; total: number };
  };
};

// Decisão 22/09/2026: converter NÃO cria a venda no servidor (senão o
// Caixa, ao finalizar, criaria o pedido de novo). O convert aprova o
// orçamento e reserva o estoque; a venda nasce no Caixa como sempre, com
// `quote_id` no POST da venda — o backend grava converted_sale_id e cria a
// 1ª entrega. `cart` é o carrinho pronto para o Caixa abrir.
export type QuoteConvertResponse = {
  quote: Quote;
  cart: Array<{ product_id: string | null; name: string; unit: string | null; quantity: number; unit_price: number }>;
};

// ── Entregas ────────────────────────────────────────────────
export type DeliveryStage = "separating" | "ready" | "out" | "delivered";

export type DeliveryItem = {
  sale_item_id: string;
  // 22/09/2026 (M2): a NF-e da entrega precisa do produto e do preco DA
  // VENDA (nao o preco atual do cadastro). Vem da sale_item.
  product_id: string | null;
  unit_price: number;
  lot_code?: string | null; // M4: lote alocado (romaneio mostra)
  name: string;
  unit: string | null;
  quantity: number;         // nesta entrega
  sold_quantity: number;    // total vendido do item
  delivered_before: number; // já entregue em entregas anteriores
};

export type Delivery = {
  id: string;
  sale_id: string;
  sale_number?: number | null;
  sequence: number;         // 1ª, 2ª entrega do mesmo pedido
  stage: DeliveryStage;
  scheduled_for: string;    // YYYY-MM-DD
  delivered_by: string | null; // texto livre (decisão 22/09/2026)
  customer_name: string | null;
  customer_phone?: string | null;
  address?: string | null;
  total: number;            // valor da venda (para o cabeçalho da esteira)
  has_pending: boolean;     // ainda há saldo a entregar neste pedido
  public_token: string;
  items: DeliveryItem[];
  out_at?: string | null;
  delivered_at?: string | null;
  created_at: string;
  // 22/09/2026 (Matcon M2 — fiscal do Simples, docs/CONTRACT_MATCON.md §M2):
  // a NF-e nasce da entrega (POST /nfce/emit com delivery_id). Ausentes =
  // entrega sem nota emitida ainda (comportamento de hoje). Quando
  // nfe_emission_id existe, o card troca o botão "Emitir NF-e" pelo selo
  // "NF-E #N · status" + "Ver DANFE".
  nfe_emission_id?: string | null;
  nfe_number?: number | null;
  nfe_status?: "processando" | "autorizada" | "rejeitada" | "cancelada" | "erro" | null;
  danfe_url?: string | null;
};

export type DeliveryListFilters = {
  // "pending" = tudo o que ainda não foi entregue, de qualquer dia (QA
  // 23/09/2026; antes era só o saldo de entrega dividida).
  day?: "today" | "tomorrow" | "late" | "pending" | "all";
  stage?: DeliveryStage | "all";
  limit?: number;
};

export type DeliveryListResponse = {
  deliveries: Delivery[];
  summary: {
    separating: { count: number; total: number };
    ready: { count: number; total: number };
    out: { count: number; total: number };
    delivered_today: { count: number; total: number };
    pending_orders: number;   // pedidos com entrega ainda não entregue
  };
};

export type DeliveryPatchBody = Partial<{
  stage: DeliveryStage;
  delivered_by: string | null;
  scheduled_for: string;
}>;

// "Entrega parcial": grava o que foi nesta entrega e o backend cria a
// próxima com o saldo (sequence + 1), devolvendo as duas.
export type DeliverySplitBody = {
  items: Array<{ sale_item_id: string; quantity: number }>;
  delivered_by?: string | null;
};
export type DeliverySplitResponse = { delivered: Delivery; next: Delivery | null };


// ── Profissionais (M3 — Profissionais Parceiros) ────────────
export type ProfessionalTrade =
  | "pedreiro" | "mestre_de_obras" | "eletricista" | "encanador" | "pintor"
  | "gesseiro" | "azulejista" | "arquiteto" | "engenheiro" | "marceneiro" | "outro";

export const TRADE_LABELS: Record<ProfessionalTrade, string> = {
  pedreiro: "pedreiro", mestre_de_obras: "mestre de obras", eletricista: "eletricista",
  encanador: "encanador", pintor: "pintor", gesseiro: "gesseiro", azulejista: "azulejista",
  arquiteto: "arquiteto", engenheiro: "engenheiro", marceneiro: "marceneiro", outro: "profissional",
};

export type Professional = {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone?: string | null;
  trade: ProfessionalTrade;
  points_balance: number;
  points_earned_total: number;
  referrals_count: number;
  referred_sales_total: number;
  last_referral_at: string | null;
  active: boolean;
  created_at: string;
};

export type ProfessionalDetail = {
  professional: Professional;
  ledger: Array<{ id: string; sale_id: string | null; delta: number; reason: "sale" | "redeem" | "adjust"; created_at: string }>;
  last_referrals: Array<{ sale_id: string; customer_name: string | null; total: number; created_at: string }>;
};

export type ProfessionalListResponse = {
  professionals: Professional[];
  summary: { referred_total_month: number; active_count: number; pending_redeems: number };
};


// ── M4: lotes, sugestoes de compra e pedidos de compra ──────
// docs/CONTRACT_MATCON.md secao M4. Gate dos lotes: pdv_settings.
// matcon_lots_enabled; compras: chave de modulo matcon.compras.
export type ProductLot = {
  id: string;
  product_id: string;
  lot_code: string;         // "27B"
  shade?: string | null;    // tonalidade
  caliber?: string | null;  // bitola
  qty: number;              // saldo na unidade de venda
  received_at: string;
  source_invoice?: string | null;
};

// Alocacao por lote no item da venda (soma = quantity do item).
export type LotAllocation = { lot_id: string; lot_code: string; quantity: number };

export type PurchaseSuggestion = {
  product_id: string;
  name: string;
  unit: string | null;
  stock: number;
  min_stock: number;
  weekly_sales: number;
  suggested_qty: number;
  est_cost: number;
  supplier_name: string | null;
  supplier_cnpj: string | null;
  supplier_phone?: string | null;
  days_to_stockout: number | null;
  // QA 23/09/2026 (decisão do Caio): Compras segue a regra do Estoque —
  // estoque <= mínimo, inclusive zerado com mínimo 0. Campo aditivo do
  // backend: por que o item entrou na lista. Ausente = backend antigo.
  reason?: PurchaseSuggestionReason;
};

export type PurchaseSuggestionReason = "abaixo_do_minimo" | "zerado_sem_minimo" | "vai_acabar";

export type PurchaseSuggestionsResponse = {
  suggestions: PurchaseSuggestion[];
  summary: { total_est_cost: number; items_below_min: number; suppliers: number };
};

export type PurchaseOrderStatus = "draft" | "sent" | "received" | "cancelled";

export type PurchaseOrderItem = {
  product_id: string;
  name: string;
  unit: string | null;
  quantity: number;
  unit_cost_est: number;
  received_qty: number;
};

export type PurchaseOrder = {
  id: string;
  number: string;           // "C-0042"
  status: PurchaseOrderStatus;
  supplier_name: string | null;
  supplier_cnpj: string | null;
  supplier_phone?: string | null;
  items: PurchaseOrderItem[];
  total_est: number;
  sent_at?: string | null;
  received_at?: string | null;
  received_invoice?: string | null;
  created_at: string;
};

export type PurchaseOrderListResponse = {
  orders: PurchaseOrder[];
  summary: {
    draft: { count: number; total: number };
    sent: { count: number; total: number };
    received_7d: { count: number; total: number };
  };
};

// "A nota do fornecedor entrou" (M4 › Compras; Aura-backend#741). A
// conferencia do XML (DanfeImportModal) chama DEPOIS de somar o estoque.
// quantity/unit_cost vao COMO ESTAO NA NOTA, na unidade de COMPRA (10 cx a
// R$ 89,90): quem converte para a unidade de venda e o backend, pelo
// purchase_factor do produto. A rota NAO mexe em estoque — grava a ultima
// compra no produto e fecha o pedido `sent` do mesmo CNPJ.
export type PurchaseReceiptItem = { product_id: string; quantity: number; unit_cost: number };

export type PurchaseReceiptBody = {
  supplier_name: string | null;
  supplier_cnpj: string | null;
  supplier_phone?: string | null;
  invoice_number: string | null;
  items: PurchaseReceiptItem[];
};

export type PurchaseReceiptResponse = {
  products_updated: number;
  ignored: number;
  // So os pedidos que a nota mexeu: `received` = fechou; `sent` = parcial.
  orders: PurchaseOrder[];
};

function qs(params: Record<string, string | number | undefined>): string {
  var parts: string[] = [];
  Object.keys(params).forEach(function (k) {
    var v = params[k];
    if (v === undefined || v === "" || v === "all") return;
    parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(v)));
  });
  return parts.length ? "?" + parts.join("&") : "";
}

export var matconApi = {
  // Orçamentos
  listQuotes: function (companyId: string, f: QuoteListFilters = {}) {
    return request<QuoteListResponse>("/companies/" + companyId + "/matcon/quotes" + qs({ status: f.status, q: f.q, limit: f.limit }), { retry: 1 });
  },
  getQuote: function (companyId: string, quoteId: string) {
    return request<{ quote: Quote }>("/companies/" + companyId + "/matcon/quotes/" + quoteId);
  },
  createQuote: function (companyId: string, body: QuoteCreateBody) {
    return request<{ quote: Quote }>("/companies/" + companyId + "/matcon/quotes", { method: "POST", body: body, retry: 0 });
  },
  updateQuote: function (companyId: string, quoteId: string, body: Partial<QuoteCreateBody> & { status?: QuoteStatus }) {
    return request<{ quote: Quote }>("/companies/" + companyId + "/matcon/quotes/" + quoteId, { method: "PATCH", body: body, retry: 0 });
  },
  // Marca sent_at; o envio em si é o wa.me que o front abre (useWaVarejo).
  markQuoteSent: function (companyId: string, quoteId: string) {
    return request<{ quote: Quote }>("/companies/" + companyId + "/matcon/quotes/" + quoteId + "/sent", { method: "POST", retry: 0 });
  },
  convertQuote: function (companyId: string, quoteId: string) {
    return request<QuoteConvertResponse>("/companies/" + companyId + "/matcon/quotes/" + quoteId + "/convert", { method: "POST", retry: 0 });
  },

  // Entregas
  listDeliveries: function (companyId: string, f: DeliveryListFilters = {}) {
    return request<DeliveryListResponse>("/companies/" + companyId + "/matcon/deliveries" + qs({ day: f.day, stage: f.stage, limit: f.limit }), { retry: 1 });
  },
  createDelivery: function (companyId: string, body: { sale_id: string; scheduled_for?: string }) {
    return request<{ delivery: Delivery }>("/companies/" + companyId + "/matcon/deliveries", { method: "POST", body: body, retry: 0 });
  },
  updateDelivery: function (companyId: string, deliveryId: string, body: DeliveryPatchBody) {
    return request<{ delivery: Delivery }>("/companies/" + companyId + "/matcon/deliveries/" + deliveryId, { method: "PATCH", body: body, retry: 0 });
  },
  splitDelivery: function (companyId: string, deliveryId: string, body: DeliverySplitBody) {
    return request<DeliverySplitResponse>("/companies/" + companyId + "/matcon/deliveries/" + deliveryId + "/split", { method: "POST", body: body, retry: 0 });
  },
  // Profissionais (M3)
  listProfessionals: function (companyId: string, f: { filter?: "active" | "inactive_60d" | "new" | "all"; q?: string } = {}) {
    return request<ProfessionalListResponse>("/companies/" + companyId + "/matcon/professionals" + qs({ filter: f.filter, q: f.q }), { retry: 1 });
  },
  searchProfessionals: function (companyId: string, q: string) {
    return request<{ professionals: Professional[] }>("/companies/" + companyId + "/matcon/professionals/search" + qs({ q: q }), { retry: 0 });
  },
  getProfessional: function (companyId: string, professionalId: string) {
    return request<ProfessionalDetail>("/companies/" + companyId + "/matcon/professionals/" + professionalId);
  },
  createProfessional: function (companyId: string, body: { customer_id: string; trade: ProfessionalTrade }) {
    return request<{ professional: Professional }>("/companies/" + companyId + "/matcon/professionals", { method: "POST", body: body, retry: 0 });
  },
  updateProfessional: function (companyId: string, professionalId: string, body: Partial<{ trade: ProfessionalTrade; active: boolean }>) {
    return request<{ professional: Professional }>("/companies/" + companyId + "/matcon/professionals/" + professionalId, { method: "PATCH", body: body, retry: 0 });
  },
  // Resgate: debita matcon_points_to_coupon pontos e cria um cupom (tabela de
  // cupons existente) no valor de matcon_coupon_value.
  redeemProfessional: function (companyId: string, professionalId: string) {
    return request<{ coupon_code: string; points_balance: number }>("/companies/" + companyId + "/matcon/professionals/" + professionalId + "/redeem", { method: "POST", retry: 0 });
  },
  // Lotes (M4)
  listLots: function (companyId: string, productId: string) {
    return request<{ lots: ProductLot[] }>("/companies/" + companyId + "/products/" + productId + "/lots", { retry: 1 });
  },
  createLot: function (companyId: string, productId: string, body: { lot_code: string; shade?: string | null; caliber?: string | null; qty: number; source_invoice?: string | null }) {
    return request<{ lot: ProductLot }>("/companies/" + companyId + "/products/" + productId + "/lots", { method: "POST", body: body, retry: 0 });
  },
  updateLot: function (companyId: string, productId: string, lotId: string, body: Partial<{ qty: number; shade: string | null; caliber: string | null }>) {
    return request<{ lot: ProductLot }>("/companies/" + companyId + "/products/" + productId + "/lots/" + lotId, { method: "PATCH", body: body, retry: 0 });
  },

  // Compras (M4)
  purchaseSuggestions: function (companyId: string) {
    return request<PurchaseSuggestionsResponse>("/companies/" + companyId + "/matcon/purchase-suggestions", { retry: 1 });
  },
  listPurchaseOrders: function (companyId: string, f: { status?: PurchaseOrderStatus | "all" } = {}) {
    return request<PurchaseOrderListResponse>("/companies/" + companyId + "/matcon/purchase-orders" + qs({ status: f.status }), { retry: 1 });
  },
  createPurchaseOrder: function (companyId: string, body: { supplier_name: string | null; supplier_cnpj: string | null; supplier_phone?: string | null; items: Array<{ product_id: string; quantity: number }> }) {
    return request<{ order: PurchaseOrder }>("/companies/" + companyId + "/matcon/purchase-orders", { method: "POST", body: body, retry: 0 });
  },
  updatePurchaseOrder: function (companyId: string, orderId: string, body: Partial<{ status: PurchaseOrderStatus; items: Array<{ product_id: string; quantity: number }> }>) {
    return request<{ order: PurchaseOrder }>("/companies/" + companyId + "/matcon/purchase-orders/" + orderId, { method: "PATCH", body: body, retry: 0 });
  },
  registerPurchaseReceipt: function (companyId: string, body: PurchaseReceiptBody) {
    return request<PurchaseReceiptResponse>("/companies/" + companyId + "/matcon/purchase-receipts", { method: "POST", body: body, retry: 0 });
  },
};
