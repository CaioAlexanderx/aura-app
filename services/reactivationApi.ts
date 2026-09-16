// ============================================================
// reactivationApi — quem sumiu, e o cupom que traz de volta (Fase 7)
//
// Rotas /companies/:companyId/reactivation/*. A leitura (GET /) já
// existia há tempos e só alimentava uma lista; o que a Fase 7 acrescenta
// é a pista de ENVIO: prévia, disparo e interruptor do automático
// semanal.
//
// Cada mensagem daqui é um template de categoria MARKETING na Meta —
// custa MAIS que a cobrança, depende de consentimento e tem limite por
// contato. Por isso três coisas são contrato, não detalhe:
//
//   1. `POST /send` nunca sai sem a tela ter mostrado a prévia antes;
//   2. todo campo novo é OPCIONAL e ausente significa BLOQUEADO — um
//      backend anterior à fase simplesmente não sabe de marketing, e não
//      saber jamais pode virar permissão de gastar;
//   3. `skipped` e `skipped_reason` não são erro: são as guardas tendo
//      funcionado, e a tela traduz com waSkipReasonLabel.
// ============================================================
import { request } from "./api";
import type { WaPreview } from "./waApi";

/**
 * Segmentos do motor de reativação (dias desde a última compra).
 *
 * Os LIMIARES de cada um moram em components/screens/clientes/diasSemComprar
 * — a régua única do app (ativo 0–30, em risco 31–60, inativo 61–120,
 * perdido 121+), que é também quem manda na tag "Inativo" da lista de
 * clientes. Aqui ficam só os nomes que o backend usa; quem precisa do
 * intervalo em dias lê de lá, para não existirem duas réguas de novo.
 */
export type ReactivationSegment = "active" | "at_risk" | "dormant" | "lost";

/** Qual fatia o disparo mira. 'both' = em risco + inativo. */
export type ReactivationTarget = "at_risk" | "dormant" | "both";

export interface ReactivationSuggestion {
  action?: string | null;
  channel?: string | null;
  offer?: string | null;
  urgency?: string | null;
  template?: string | null;
}

export interface ReactivationCustomer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  total_spent?: number;
  total_purchases?: number;
  last_purchase_at?: string | null;
  days_since_purchase?: number;
  segment?: ReactivationSegment | (string & {});
  segment_label?: string | null;
  segment_color?: string | null;
  avg_ticket?: number;
  monthly_frequency?: number;
  /** 'active' | 'contacted' | … — vira "contatado em dd/mm" na tela. */
  reactivation_status?: string | null;
  contacted_at?: string | null;
  suggestion?: ReactivationSuggestion | null;
}

export interface ReactivationSegmentSummary {
  label: string;
  count: number;
  revenue: number;
  color?: string | null;
}

export interface ReactivationMetrics {
  total_customers?: number;
  active?: number;
  at_risk?: number;
  dormant?: number;
  lost?: number;
  retention_rate?: number;
  revenue_at_risk?: number;
  revenue_dormant?: number;
  potential_recovery?: number;
}

export interface ReactivationDashboard {
  metrics?: ReactivationMetrics;
  segments?: ReactivationSegmentSummary[];
  /** Top 20 por gasto entre em risco e inativo — a lista que a tela mostra. */
  priority_reactivation?: ReactivationCustomer[];
  all_customers?: ReactivationCustomer[];
}

/** Defaults do cupom de reativação (validade curta de propósito). */
export interface ReactivationCouponDefaults {
  discount_type?: "percent" | "fixed";
  discount_value?: number;
  validity_days?: number;
  min_order_value?: number;
  max_uses?: number;
}

export interface ReactivationSettings {
  /** AUSENTE = desligado. Omissão nunca liga envio pago. */
  wa_reactivation_auto?: boolean;
  /** Consentimento de marketing declarado (null = não declarado). */
  wa_marketing_consent_at?: string | null;
  reactivation_coupon_defaults?: ReactivationCouponDefaults;
  template_name?: string | null;
  /** true = migration da fase ainda não aplicada neste ambiente. */
  schema_pending?: boolean;
}

/** Resposta do disparo. `queued` é quantas ENTRARAM na fila, não quantas foram pedidas. */
export interface ReactivationSendResult {
  queued: number;
  segment?: string | null;
  skipped?: Record<string, number>;
  skipped_reason?: string | null;
}

const base = (companyId: string) => `/companies/${companyId}/reactivation`;

export const reactivationApi = {
  /** Painel completo: métricas, segmentos e a lista prioritária. */
  get: (companyId: string): Promise<ReactivationDashboard> =>
    request<ReactivationDashboard>(base(companyId), { retry: 1, timeout: 20000 }),

  getSettings: (companyId: string): Promise<ReactivationSettings> =>
    request<ReactivationSettings>(`${base(companyId)}/settings`, { retry: 1 }),

  /**
   * Ligar o automático semanal passa pelos quatro portões no backend
   * (plano, conexão, template aprovado, consentimento) e volta 403/409
   * com `code`; desligar é sempre livre.
   */
  saveSettings: (
    companyId: string,
    body: { wa_reactivation_auto?: boolean; reactivation_coupon_defaults?: ReactivationCouponDefaults }
  ): Promise<{ ok: true; wa_reactivation_auto?: boolean; reactivation_coupon_defaults?: ReactivationCouponDefaults }> =>
    request(`${base(companyId)}/settings`, { method: "PUT", body, retry: 0 }),

  /** Quem receberia AGORA — sem enfileirar nada, sem criar cupom. */
  preview: (
    companyId: string,
    opts?: { segment?: ReactivationTarget; limit?: number }
  ): Promise<WaPreview> => {
    const qs: string[] = [];
    if (opts?.segment) qs.push(`segment=${encodeURIComponent(opts.segment)}`);
    if (typeof opts?.limit === "number") qs.push(`limit=${opts.limit}`);
    return request<WaPreview>(`${base(companyId)}/preview${qs.length ? `?${qs.join("&")}` : ""}`, {
      retry: 0,
      timeout: 20000,
    });
  },

  /**
   * Dispara de verdade. Teto de 50 por chamada no backend — marketing em
   * volume derruba a qualidade do número, e número rebaixado não manda
   * nem marketing nem, no limite, cobrança. Cria cupom por cliente, então
   * o timeout é folgado.
   */
  send: (
    companyId: string,
    body: { segment?: ReactivationTarget; limit?: number; customer_ids?: string[] }
  ): Promise<ReactivationSendResult> =>
    request<ReactivationSendResult>(`${base(companyId)}/send`, {
      method: "POST",
      body,
      retry: 0,
      timeout: 60000,
    }),

  /** Registro do contato MANUAL (wa.me, telefone, e-mail) — não envia nada. */
  markContacted: (
    companyId: string,
    customerId: string,
    body?: { method?: string; notes?: string }
  ): Promise<{ ok: true }> =>
    request<{ ok: true }>(`${base(companyId)}/${customerId}/contact`, {
      method: "PATCH",
      body: body || {},
      retry: 0,
    }),
};
