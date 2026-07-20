import { request } from "./api";

export type TokenizeResponse = {
  credit_card_token: string;
  credit_card_brand: string | null;
  credit_card_last4: string | null;
};
export type SubscribeResponse = {
  subscription_id?: string;
  payment_id?: string;
  plan: string;
  cycle: string;
  value: number;              // valor RECORRENTE (cheio) da assinatura
  billing_type: string;
  next_due_date?: string;
  pix_qr_code?: string | null;
  pix_copy_paste?: string | null;
  pix_expiration?: string | null;
  // 13/07/2026 — cupom
  charged_now?: number;       // quanto foi cobrado agora (0 em cupom de dias gratis)
  trial_ends_at?: string | null;
  coupon?: { code: string; discount_pct: number; trial_days: number } | null;
  message?: string;
};

// 13/07/2026 — POST /companies/:id/billing/validate-coupon
// Diferente do /auth/validate-code (publico, do cadastro): este e autenticado e
// por empresa, entao barra resgate repetido e devolve o valor exato que sera
// cobrado, ja com plano/ciclo/acessos extras da empresa.
export type ValidateCouponResponse = {
  valid: boolean;
  error?: string;
  code?: string;
  type?: string;
  discount_pct?: number;
  trial_days?: number;
  first_charge_value?: number;   // quanto paga HOJE (0 se cupom de dias gratis)
  recurring_value?: number;      // quanto passa a pagar depois
  first_charge_date?: string;    // YYYY-MM-DD
  extra_seats?: number;
};

export type KarateGateResponse = {
  state: "ok" | "blocked";
  amount: number;
  billing_status: string | null;
  due_date: string | null;
  has_subscription: boolean;
};

// 19/07/2026 (F3c) — mesmo endpoint /billing/karate-gate, contrato PRÓPRIO
// quando a company é karate_dojo (diferente do state/blocked da federação
// acima). required:false sempre que a flag do backend estiver desligada —
// a resposta ainda traz os valores (preço/trial), então a UI mostra preço
// e aviso de trial sem nunca bloquear enquanto a flag estiver off.
export type DojoGateResponse = {
  required: boolean;
  plan: "dojo";
  amount: number;
  seats: number;
  seat_amount: number;
  total: number;
  trial_ends_at: string | null;
  billing_status: string | null;
};

export var billingApi = {
  status: function(companyId: string) { return request<any>("/companies/" + companyId + "/billing/status"); },
  tokenize: function(companyId: string, cardData: {
    card_number: string; card_expiry_month: string; card_expiry_year: string; card_ccv: string;
    holder_name: string; holder_cpf: string; holder_postal_code?: string; holder_address_number?: string; holder_address?: string;
  }) {
    return request<TokenizeResponse>("/companies/" + companyId + "/billing/tokenize", { method: "POST", body: cardData, retry: 0, timeout: 15000 });
  },
  // 13/07/2026 — valida o cupom antes de assinar (mostra o valor real na tela).
  validateCoupon: function(companyId: string, code: string, plan: string, cycle: string, billingType: string) {
    return request<ValidateCouponResponse>("/companies/" + companyId + "/billing/validate-coupon", {
      method: "POST",
      body: { code: code, plan: plan, cycle: cycle, billing_type: billingType },
      retry: 0,
    });
  },
  subscribe: function(companyId: string, plan: string, billingType?: string, cycle?: string, opts?: {
    creditCardToken?: string; holderName?: string; holderCpf?: string;
    holderPostalCode?: string; holderAddressNumber?: string; holderAddress?: string;
    endDate?: string; totalCycles?: number; accessCode?: string;
  }) {
    return request<SubscribeResponse>("/companies/" + companyId + "/billing/subscribe", {
      method: "POST",
      body: {
        plan: plan, billing_type: billingType || "PIX", cycle: cycle || "monthly",
        end_date: opts?.endDate, total_cycles: opts?.totalCycles,
        access_code: opts?.accessCode,
        credit_card_token: opts?.creditCardToken, credit_card_holder_name: opts?.holderName,
        credit_card_holder_cpf: opts?.holderCpf, credit_card_holder_postal_code: opts?.holderPostalCode,
        credit_card_holder_address_number: opts?.holderAddressNumber, credit_card_holder_address: opts?.holderAddress,
      },
    });
  },
  cancel: function(companyId: string) { return request<any>("/companies/" + companyId + "/billing/cancel", { method: "POST" }); },
  invoices: function(companyId: string) { return request<any>("/companies/" + companyId + "/billing/invoices"); },
  generatePix: function(companyId: string, paymentId: string) { return request<any>("/companies/" + companyId + "/billing/generate-pix/" + paymentId, { method: "POST" }); },
  plans: function() { return request<any>("/billing/plans"); },
  // Karatê: estado do gate de cobrança. Federação usa o contrato default
  // (KarateGateResponse: state ok|blocked); dojô (F3c) passa o generic
  // explicitamente pro contrato required/plan/total (DojoGateResponse) —
  // mesmo endpoint, resposta decidida pelo backend a partir da vertical
  // da company do companyId informado.
  karateGate: function<T = KarateGateResponse>(companyId: string) { return request<T>("/companies/" + companyId + "/billing/karate-gate"); },
};
