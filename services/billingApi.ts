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
  value: number;
  billing_type: string;
  next_due_date?: string;
  pix_qr_code?: string | null;
  pix_copy_paste?: string | null;
  pix_expiration?: string | null;
};

export type KarateGateResponse = {
  state: "ok" | "blocked";
  amount: number;
  billing_status: string | null;
  due_date: string | null;
  has_subscription: boolean;
};

export var billingApi = {
  status: function(companyId: string) { return request<any>("/companies/" + companyId + "/billing/status"); },
  tokenize: function(companyId: string, cardData: {
    card_number: string; card_expiry_month: string; card_expiry_year: string; card_ccv: string;
    holder_name: string; holder_cpf: string; holder_postal_code?: string; holder_address_number?: string; holder_address?: string;
  }) {
    return request<TokenizeResponse>("/companies/" + companyId + "/billing/tokenize", { method: "POST", body: cardData, retry: 0, timeout: 15000 });
  },
  subscribe: function(companyId: string, plan: string, billingType?: string, cycle?: string, opts?: {
    creditCardToken?: string; holderName?: string; holderCpf?: string;
    holderPostalCode?: string; holderAddressNumber?: string; holderAddress?: string;
    endDate?: string; totalCycles?: number;
  }) {
    return request<SubscribeResponse>("/companies/" + companyId + "/billing/subscribe", {
      method: "POST",
      body: {
        plan: plan, billing_type: billingType || "PIX", cycle: cycle || "monthly",
        end_date: opts?.endDate, total_cycles: opts?.totalCycles,
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
  // Karatê: estado binário do gate de cobrança (ok | blocked) + valor fixo.
  karateGate: function(companyId: string) { return request<KarateGateResponse>("/companies/" + companyId + "/billing/karate-gate"); },
};
