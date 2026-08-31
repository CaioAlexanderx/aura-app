// ============================================================
// AURA. — Ordem de Serviço (cliente da API)
//
// Contrato: aura-backend docs/CONTRACT_ORDEM_DE_SERVICO.md (31/08/2026).
//
// A OS NASCE ANTES DA VENDA: é aberta na entrada do equipamento e só
// encosta numa venda ao ser entregue. sale_id nulo é o estado normal da
// OS viva, não dado faltando. Várias OS podem fechar na mesma venda
// (cliente deixou dois aparelhos e retira os dois juntos).
//
// Gate: pdv_settings.os_enabled — o backend bloqueia só a ESCRITA
// (403 OS_DISABLED). Leitura e impressão funcionam com o toggle
// desligado, de propósito: a loja que desativa o módulo ainda precisa
// enxergar (e devolver) os aparelhos que estão no balcão dela.
// ============================================================
import { request, BASE_URL } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { openPrintWindow } from "@/services/printWindow";

export type OsStatus = "aberta" | "em_execucao" | "pronta" | "entregue" | "cancelada";

// Espelha TRANSICOES de serviceOrders.js. O backend é quem manda (409
// TRANSICAO_INVALIDA); esta cópia existe só pra UI não oferecer botão
// que vai falhar. pronta -> em_execucao é retrabalho: o cliente testou
// no balcão e o defeito continuava lá.
export const OS_TRANSICOES: Record<OsStatus, OsStatus[]> = {
  aberta:      ["em_execucao", "cancelada"],
  em_execucao: ["pronta", "cancelada"],
  pronta:      ["entregue", "em_execucao", "cancelada"],
  entregue:    [],
  cancelada:   [],
};

export const OS_STATUS_LABEL: Record<OsStatus, string> = {
  aberta:      "Aberta",
  em_execucao: "Em execução",
  pronta:      "Pronta",
  entregue:    "Entregue",
  cancelada:   "Cancelada",
};

export type ServiceOrderItem = {
  id?: string;
  kind: "servico" | "peca";
  description: string;
  product_id?: string | null;
  quantity: number;
  unit_price: number;
  total_price?: number;
  sort_order?: number;
};

export type ServiceOrder = {
  id: string;
  os_number: number | null;
  status: OsStatus;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  equipment_type?: string | null;
  equipment_brand?: string | null;
  equipment_model?: string | null;
  equipment_serial?: string | null;
  equipment_condition?: string | null;
  equipment_accessories?: string | null;
  reported_issue: string;
  diagnosis?: string | null;
  solution?: string | null;
  technician_id?: string | null;
  technician_name?: string | null;
  promised_at?: string | null;
  warranty_days: number;
  estimated_amount: string | number;
  approved_at?: string | null;
  sale_id?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  notes?: string | null;
  created_at: string;
};

export type CreateOsBody = {
  customer_id: string;
  reported_issue: string;
  items?: ServiceOrderItem[];
  equipment_type?: string;
  equipment_brand?: string;
  equipment_model?: string;
  equipment_serial?: string;
  equipment_condition?: string;
  equipment_accessories?: string;
  technician_id?: string;
  promised_at?: string;
  warranty_days?: number;
  notes?: string;
};

export type OsListFilters = {
  status?: OsStatus;
  customer_id?: string;
  q?: string;
  days?: number;
  limit?: number;
};

function qs(filters: OsListFilters): string {
  const parts: string[] = [];
  if (filters.status) parts.push("status=" + filters.status);
  if (filters.customer_id) parts.push("customer_id=" + filters.customer_id);
  if (filters.q) parts.push("q=" + encodeURIComponent(filters.q));
  if (filters.days) parts.push("days=" + filters.days);
  if (filters.limit) parts.push("limit=" + filters.limit);
  return parts.length ? "?" + parts.join("&") : "";
}

export var serviceOrdersApi = {
  list: function (companyId: string, filters: OsListFilters = {}) {
    return request<{ orders: ServiceOrder[] }>(
      "/companies/" + companyId + "/service-orders" + qs(filters), { retry: 1 });
  },

  get: function (companyId: string, osId: string) {
    return request<{ order: ServiceOrder; items: ServiceOrderItem[] }>(
      "/companies/" + companyId + "/service-orders/" + osId, { retry: 1 });
  },

  create: function (companyId: string, body: CreateOsBody) {
    return request<{ order: ServiceOrder; items: ServiceOrderItem[] }>(
      "/companies/" + companyId + "/service-orders", { method: "POST", body: body, retry: 0 });
  },

  // Whitelist do backend: equipamento, diagnóstico/solução, técnico,
  // prazo, garantia, notas. company_id/os_number são ignorados lá.
  patch: function (companyId: string, osId: string, body: Partial<ServiceOrder>) {
    return request<{ order: ServiceOrder; items: ServiceOrderItem[] }>(
      "/companies/" + companyId + "/service-orders/" + osId, { method: "PATCH", body: body, retry: 0 });
  },

  // Substitui a lista inteira; o backend recalcula estimated_amount.
  // 409 ORCAMENTO_APROVADO depois do aceite do cliente.
  putItems: function (companyId: string, osId: string, items: ServiceOrderItem[]) {
    return request<{ order: ServiceOrder; items: ServiceOrderItem[] }>(
      "/companies/" + companyId + "/service-orders/" + osId + "/items",
      { method: "PUT", body: { items: items }, retry: 0 });
  },

  approve: function (companyId: string, osId: string, note?: string) {
    return request<{ order: ServiceOrder; items: ServiceOrderItem[] }>(
      "/companies/" + companyId + "/service-orders/" + osId + "/approve",
      { method: "POST", body: { note: note }, retry: 0 });
  },

  // sale_id só em 'entregue' e é OPCIONAL: existe entrega sem venda
  // (garantia, retrabalho, cortesia).
  setStatus: function (companyId: string, osId: string, status: OsStatus, extra?: {
    sale_id?: string; cancel_reason?: string; solution?: string; pickup_signature_url?: string;
  }) {
    return request<{ order: ServiceOrder; items: ServiceOrderItem[] }>(
      "/companies/" + companyId + "/service-orders/" + osId + "/status",
      { method: "POST", body: { status: status, ...(extra || {}) }, retry: 0 });
  },

  remove: function (companyId: string, osId: string) {
    return request<{ deleted: boolean }>(
      "/companies/" + companyId + "/service-orders/" + osId, { method: "DELETE", retry: 0 });
  },
};

// ─── Impressão do A4 (autenticada) ───────────────────────────
// Mesmo padrão do printCarne: GET /print/os/:osId exige Bearer, então
// window.open direto daria "Token não fornecido". A janela abre SÍNCRONA
// no clique (openPrintWindow) — window.open depois do await perde a user
// activation e o Chrome bloqueia o pop-up de forma intermitente.
export async function printOs(companyId: string, osId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const token = useAuthStore.getState().token;
  const url = BASE_URL + "/companies/" + companyId + "/print/os/" + osId;
  const outcome = await openPrintWindow(async () => {
    const resp = await fetch(url, { headers: token ? { Authorization: "Bearer " + token } : {} });
    if (!resp.ok) return { ok: false as const, error: "Erro ao carregar a OS (" + resp.status + ")." };
    return { ok: true as const, html: await resp.text() };
  });
  if (outcome === "blocked") alert("Permita pop-ups para imprimir a ordem de serviço.");
}
