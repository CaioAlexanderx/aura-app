import { request } from "./api";
// A prévia do aniversário devolve o MESMO shape das prévias do dojô e do
// crediário — reusar o tipo é o que mantém a leitura (waPreviewSkipped*)
// igual nas três telas.
import type { WaPreview } from "./waApi";

export type BirthdayCustomer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  total_purchases: number;
  total_spent: number;
  days_until: number;
  is_today: boolean;
  marketing_opt_out?: boolean;
};
export type BirthdayCouponDefaults = {
  discount_type: "percent" | "fixed";
  discount_value: number;
  validity_days: number;
  min_order_value: number;
  max_uses: number;
};
export type BirthdaySettings = {
  defaults: BirthdayCouponDefaults;
  template: string;
  configured: boolean;
  /**
   * Fase 8 — o parabéns sai sozinho no dia, pelo WhatsApp oficial. Campo
   * OPCIONAL: backend anterior à fase não devolve, e AUSENTE = desligado.
   * Nunca o contrário: ligado por omissão seria mensagem paga saindo sem
   * ninguém ter pedido.
   */
  wa_birthday_auto?: boolean;
  /** Data da declaração de consentimento de marketing (null = não há). */
  wa_marketing_consent_at?: string | null;
};
export type BirthdaySentRow = {
  customer_id: string;
  sent_at: string;
  /** 'whatsapp_auto' = saiu pela Cloud API (Fase 8), não pelo wa.me. */
  method: "wa_link" | "wa_api" | "sms" | "email" | (string & {});
  coupon_id: string | null;
};

/**
 * Resposta do POST /birthday/send-whatsapp. `queued: false` NÃO é erro:
 * é uma guarda tendo funcionado (já recebeu este ano, opt-out, limite de
 * marketing do dia…). `reason` é o skip_reason cru — quem mostra traduz
 * com waSkipReasonLabel.
 */
export type BirthdayWhatsappResult = {
  queued: boolean;
  outbox_id?: string | null;
  reason?: string | null;
  coupon?: any;
};

export var birthdayApi = {
  getSettings: function(companyId: string) {
    return request<BirthdaySettings>("/companies/" + companyId + "/birthday/settings", { retry: 1 });
  },
  /**
   * Fase 8: o MESMO PUT carrega o consentimento de marketing
   * (`wa_marketing_consent`) e o interruptor do envio automático
   * (`wa_birthday_auto`). Ligar o automático passa pelos quatro portões
   * no backend (plano, conexão, template aprovado, consentimento) e pode
   * voltar 403 ADDON_REQUIRED / 409 NAO_CONECTADO / 409
   * TEMPLATE_NAO_APROVADO / 409 SEM_CONSENTIMENTO; desligar é livre.
   */
  saveSettings: function(companyId: string, body: {
    defaults?: Partial<BirthdayCouponDefaults>; template?: string;
    wa_marketing_consent?: boolean; wa_birthday_auto?: boolean;
  }) {
    return request<{ ok: true; wa_birthday_auto?: boolean; wa_marketing_consent_at?: string | null }>(
      "/companies/" + companyId + "/birthday/settings", { method: "PUT", body: body, retry: 0 }
    );
  },
  createCoupon: function(companyId: string, body: {
    customer_id: string; code?: string; description?: string;
    discount_type?: "percent" | "fixed"; discount_value?: number;
    validity_days?: number; min_order_value?: number; max_uses?: number;
  }) {
    return request<{ coupon: any; customer: { id: string; name: string; opted_out: boolean } }>(
      "/companies/" + companyId + "/birthday/create-coupon", { method: "POST", body: body, retry: 0 }
    );
  },
  logSent: function(companyId: string, body: {
    customer_id: string; coupon_id?: string;
    method?: "wa_link" | "wa_api" | "sms" | "email"; message?: string;
  }) {
    return request<{ log: any }>("/companies/" + companyId + "/birthday/send-log", { method: "POST", body: body, retry: 0 });
  },
  /**
   * Fase 8 — envia o parabéns pelo WhatsApp OFICIAL (template MARKETING,
   * pago). Cria o cupom se `coupon_id` não vier. Timeout maior porque o
   * backend cria cupom e enfileira antes de responder.
   */
  sendWhatsapp: function(companyId: string, body: { customer_id: string; coupon_id?: string | null }) {
    return request<BirthdayWhatsappResult>(
      "/companies/" + companyId + "/birthday/send-whatsapp",
      { method: "POST", body: body, retry: 0, timeout: 20000 }
    );
  },
  /** Quem receberia o parabéns HOJE pela pista automática — sem enfileirar nada. */
  preview: function(companyId: string, date?: string | null) {
    const qs = date ? "?date=" + encodeURIComponent(date) : "";
    return request<WaPreview>("/companies/" + companyId + "/birthday/preview" + qs, { retry: 0 });
  },
  sentThisYear: function(companyId: string) {
    return request<{ year: number; total: number; sent: BirthdaySentRow[] }>(
      "/companies/" + companyId + "/birthday/sent-this-year", { retry: 1 }
    );
  },
};
