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

export type QuoteConvertResponse = {
  sale_id: string;
  // Carrinho pronto para o Caixa abrir com os itens do orçamento.
  cart: Array<{ product_id: string | null; name: string; unit: string | null; quantity: number; unit_price: number }>;
};

// ── Entregas ────────────────────────────────────────────────
export type DeliveryStage = "separating" | "ready" | "out" | "delivered";

export type DeliveryItem = {
  sale_item_id: string;
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
};

export type DeliveryListFilters = {
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
    pending_orders: number;   // pedidos com saldo a entregar
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
};
