// ============================================================
// AURA. — Garantia de produto (cliente da API)
//
// Extensão da Ordem de Serviço. Backend: routes/warranties.js (migration 365).
// Gate: pdv_settings.os_enabled — o backend bloqueia só a ESCRITA
// (403 OS_DISABLED); lista, validação por QR e impressão seguem abertas.
// ============================================================
import { request, BASE_URL } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { openPrintWindow } from "@/services/printWindow";

export type WarrantyStatus = "vigente" | "vencida" | "anulada";

export type WarrantyRow = {
  id: string;
  warranty_id: string;
  warranty_number: number;
  code: string;
  product_name: string;
  serial?: string | null;
  quantity: number;
  days: number;
  starts_on: string;   // YYYY-MM-DD
  expires_on: string;  // YYYY-MM-DD
  status: WarrantyStatus;
  days_left: number;
  customer_id: string;
  customer_name: string;
  customer_phone?: string | null;
  sale_id?: string | null;
  sale_number?: number | null;
  sale_date: string;
  created_at: string;
};

export type WarrantyItem = {
  id: string;
  product_name: string;
  serial?: string | null;
  quantity: number;
  days: number;
  starts_on: string;
  expires_on: string;
  status: WarrantyStatus;
  days_left: number;
};

export type Warranty = {
  id: string;
  warranty_number: number;
  code: string;
  sale_id?: string | null;
  sale_number?: number | null;
  sale_date?: string | null;
  customer_id: string;
  customer_name: string;
  customer_cpf?: string | null;
  customer_phone?: string | null;
  voided_at?: string | null;
  void_reason?: string | null;
  created_at: string;
  items: WarrantyItem[];
};

export type WarrantyListParams = {
  q?: string;
  customer?: string;
  sale_from?: string; // YYYY-MM-DD
  sale_to?: string;
  status?: WarrantyStatus;
  limit?: number;
  offset?: number;
};

export type CustomerCheck = {
  customer: { id: string; name: string; cpf_cnpj: string; phone: string };
  missing: Array<"name" | "cpf" | "phone">;
  complete: boolean;
};

export type IssueItem = { product_id: string; variant_id?: string | null; days: number };

function base(companyId: string) {
  return "/companies/" + companyId + "/warranties";
}

export const warrantiesApi = {
  issue(companyId: string, body: { sale_id: string; items: IssueItem[] }) {
    return request<{ warranty: Warranty }>(base(companyId), { method: "POST", body, retry: 0 });
  },
  list(companyId: string, p: WarrantyListParams = {}) {
    const qs = Object.entries(p)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => k + "=" + encodeURIComponent(String(v)))
      .join("&");
    return request<{
      items: WarrantyRow[];
      total: number;
      summary: { vigentes: number; vencendo_30d: number; vencidas: number };
    }>(base(companyId) + (qs ? "?" + qs : ""));
  },
  bySale(companyId: string, saleId: string) {
    return request<{ warranties: Warranty[] }>(base(companyId) + "/sale/" + saleId);
  },
  byCode(companyId: string, code: string) {
    return request<{ warranty: Warranty }>(base(companyId) + "/by-code/" + encodeURIComponent(code), { retry: 0 });
  },
  get(companyId: string, id: string) {
    return request<{ warranty: Warranty }>(base(companyId) + "/" + id);
  },
  void(companyId: string, id: string, reason?: string) {
    return request<{ warranty: Warranty }>(base(companyId) + "/" + id + "/void", { method: "POST", body: { reason }, retry: 0 });
  },
  customerCheck(companyId: string, customerId: string) {
    return request<CustomerCheck>(base(companyId) + "/customer/" + customerId + "/check", { retry: 1 });
  },
  terms(companyId: string) {
    return request<{ terms: string; custom: boolean; default_terms: string }>(base(companyId) + "/terms");
  },
};

// Mesmo padrão do printOs: fetch autenticado + blob, janela aberta SÍNCRONA
// no clique (openPrintWindow). Só funciona no web.
export async function printWarranty(companyId: string, warrantyId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const token = useAuthStore.getState().token;
  const url = BASE_URL + "/companies/" + companyId + "/print/warranty/" + warrantyId;
  const outcome = await openPrintWindow(async () => {
    const resp = await fetch(url, { headers: token ? { Authorization: "Bearer " + token } : {} });
    if (!resp.ok) return { ok: false as const, error: "Erro ao carregar a garantia (" + resp.status + ")." };
    return { ok: true as const, html: await resp.text() };
  });
  if (outcome === "blocked") alert("Permita pop-ups para imprimir a garantia.");
}

/** Texto do prazo: 365 → "1 ano", 90 → "3 meses", 45 → "45 dias". */
export function prazoLabel(days: number): string {
  const d = Number(days) || 0;
  if (d >= 365 && d % 365 === 0) { const a = d / 365; return a + (a === 1 ? " ano" : " anos"); }
  if (d >= 30 && d % 30 === 0) { const m = d / 30; return m + (m === 1 ? " mês" : " meses"); }
  return d + (d === 1 ? " dia" : " dias");
}

/** 'YYYY-MM-DD' → 'DD/MM/AAAA' sem passar por Date (sem deslocar o dia). */
export function dataBR(iso?: string | null): string {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[3] + "/" + m[2] + "/" + m[1] : "";
}

/** Chave do carrinho ("pid" ou "pid__vid") → ids para o backend. */
export function decomporChave(cartKey: string): { pid: string; vid: string | null } {
  const idx = cartKey.indexOf("__");
  if (idx < 0) return { pid: cartKey, vid: null };
  return { pid: cartKey.slice(0, idx), vid: cartKey.slice(idx + 2) };
}
