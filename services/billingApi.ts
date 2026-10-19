import { request } from "./api";
import type { QuoteResponse } from "@/utils/valorCombinado";

export type { QuoteResponse };

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
  coupon?: {
    code: string; discount_pct: number; trial_days: number;
    // 11/09/2026 — desconto em reais e por varios meses
    discount_value?: number; discount_months?: number;
    discounted_value?: number | null; first_full_due_date?: string | null;
  } | null;
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
  // 11/09/2026 — cupom em reais (discount_value) e por varios meses
  // (discount_months > 1: "R$ 50 nas 3 primeiras mensalidades").
  discount_value?: number;
  discount_months?: number;
  discounted_value?: number | null;      // cada mensalidade com desconto
  discounted_months?: number;            // 0 em cupom de dias gratis
  first_full_charge_date?: string | null; // 1a mensalidade cheia (prevista)
};

// GET /companies/:id/billing/status
export type BillingStatusResponse = {
  plan: string;
  billing_status: string;
  billing_cycle: string;
  trial_active: boolean;
  trial_days_left: number;
  trial_ends_at: string | null;
  next_billing_date: string | null;
  has_payment_method: boolean;
  vertical_active: string | null;
  allowed_plans: string[];
  // 21/09/2026 — empresa sem CNPJ válido: o checkout precisa pedir CPF/CNPJ.
  // Ausente em backend anterior a essa data.
  needs_cpf_cnpj?: boolean;
  // 11/09/2026 — desconto de varios meses ainda valendo nesta assinatura.
  // Mensalidades que vencem ANTES de first_full_due_date levam o desconto.
  discount?: BillingDiscount | null;
};
export type BillingDiscount = {
  code: string;
  discount_amount: number;
  months: number;
  first_full_due_date: string;
};

// GET /companies/:id/billing/invoices
export type BillingInvoice = {
  id: string;
  value: number;
  status: string;
  due_date: string;
  payment_date: string | null;
  billing_type: string;
  invoice_url: string | null;
  bank_slip_url: string | null;
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

// 13/10/2026 (Aura-backend #811) — assento de temporada: um acesso extra com
// validade fixa que expira sozinho. GET/POST/DELETE em
// /companies/:id/billing/seat-pass (POST e DELETE só o dono ou a Aura).
export type SeatPassCobranca = {
  forma: "assinatura_asaas" | "cortesia";
  valor_unitario: number;
  valor_mensal: number;
  mensalidades_ate_o_fim: number;
  valor_maximo_total: number;
  de: string;                    // YYYY-MM-DD
  ate: string;                   // YYYY-MM-DD
  texto: string;                 // pronto para a tela
};
export type SeatPass = {
  id: string;
  qty: number;
  status: "ativo" | "expirado" | "cancelado" | string;
  agendado: boolean;             // contratado, começa em starts_at
  aplicado: boolean;             // já somado aos acessos da loja
  starts_at: string;
  ends_at: string;
  cortesia: boolean;
  origem: string;
  sync_pendente: boolean;
  encerrado_em: string | null;
  motivo_encerramento: string | null;
  criado_em: string;
  cobranca: SeatPassCobranca;
};
export type SeatPassEstado = {
  temporada: { id: string; nome: string; starts_at: string; ends_at: string };
  preco_assento_mensal: number;
  pode_contratar: boolean;
  // temporada_encerrada | limite_de_assentos | sem_assinatura | plano_nao_suportado | valor_customizado | null
  motivo_bloqueio: string | null;
  limite_restante: number;
  assentos_ativos: number;
  assentos_agendados: number;
  valor_mensal_atual: number;
  valido_ate: string | null;
  passes: SeatPass[];
  // Só com ?qty=N e a temporada aberta.
  previa?: SeatPassCobranca & { qty: number };
};
export type SeatPassContratado = {
  passe: SeatPass;
  cobranca: SeatPassCobranca;
  comeca_em: string;
  aplicado_agora: boolean;
  mensagem: string;
};

export var billingApi = {
  status: function(companyId: string) { return request<BillingStatusResponse>("/companies/" + companyId + "/billing/status"); },
  // 17/10/2026 (t2-04) — a tela de checkout abriu (hooks/useCheckoutViewed).
  // Backend: POST /billing/checkout-viewed grava audit_log 'checkout.viewed'
  // (no máximo 1 por empresa a cada 24h, também durante o trial).
  checkoutViewed: function(companyId: string) {
    return request<{ registrado: boolean }>("/companies/" + companyId + "/billing/checkout-viewed", { method: "POST", body: {}, retry: 0 });
  },
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
    // 21/09/2026 — CPF/CNPJ de quem paga (só dígitos). O Asaas não gera
    // cobrança sem documento e a maioria das empresas não tem CNPJ cadastrado.
    cpfCnpj?: string;
  }) {
    return request<SubscribeResponse>("/companies/" + companyId + "/billing/subscribe", {
      method: "POST",
      body: {
        plan: plan, billing_type: billingType || "PIX", cycle: cycle || "monthly",
        end_date: opts?.endDate, total_cycles: opts?.totalCycles,
        access_code: opts?.accessCode,
        cpf_cnpj: opts?.cpfCnpj,
        credit_card_token: opts?.creditCardToken, credit_card_holder_name: opts?.holderName,
        credit_card_holder_cpf: opts?.holderCpf, credit_card_holder_postal_code: opts?.holderPostalCode,
        credit_card_holder_address_number: opts?.holderAddressNumber, credit_card_holder_address: opts?.holderAddress,
      },
    });
  },
  cancel: function(companyId: string) { return request<any>("/companies/" + companyId + "/billing/cancel", { method: "POST" }); },
  invoices: function(companyId: string) { return request<{ total: number; invoices: BillingInvoice[] }>("/companies/" + companyId + "/billing/invoices"); },
  generatePix: function(companyId: string, paymentId: string) { return request<any>("/companies/" + companyId + "/billing/generate-pix/" + paymentId, { method: "POST" }); },
  plans: function() { return request<any>("/billing/plans"); },
  // 14/10/2026 — valor mensal da empresa para o plano/ciclo/forma escolhidos
  // (valor combinado pela equipe ou tabela). O checkout só usa a resposta com
  // custom:true; erro ou 404 (backend sem a rota) deixa o cálculo de tabela.
  quote: function(companyId: string, plan: string, cycle: string, billingType: string) {
    return request<QuoteResponse>(
      "/companies/" + companyId + "/billing/quote?plan=" + encodeURIComponent(plan) +
        "&cycle=" + encodeURIComponent(cycle) + "&billing_type=" + encodeURIComponent(billingType),
      { retry: 0, timeout: 8000 }
    );
  },
  // Karatê: estado do gate de cobrança. Federação usa o contrato default
  // (KarateGateResponse: state ok|blocked); dojô (F3c) passa o generic
  // explicitamente pro contrato required/plan/total (DojoGateResponse) —
  // mesmo endpoint, resposta decidida pelo backend a partir da vertical
  // da company do companyId informado.
  karateGate: function<T = KarateGateResponse>(companyId: string) { return request<T>("/companies/" + companyId + "/billing/karate-gate"); },
  // Assento de temporada (13/10/2026, #811). 409 SEM_ASSINATURA / TEMPORADA_ENCERRADA /
  // LIMITE_DE_ASSENTOS / VALOR_CUSTOMIZADO (Aura-backend#840: empresa com valor combinado), 503 MIGRATION_PENDING (rota existe, tabela ainda não).
  seatPass: {
    estado: function(companyId: string, qty?: number) {
      return request<SeatPassEstado>("/companies/" + companyId + "/billing/seat-pass" + (qty ? "?qty=" + qty : ""));
    },
    contratar: function(companyId: string, qty: number) {
      return request<SeatPassContratado>("/companies/" + companyId + "/billing/seat-pass", { method: "POST", body: { qty: qty }, retry: 0, timeout: 30000 });
    },
    cancelar: function(companyId: string, passId: string) {
      return request<{ cancelado: boolean; assentos_removidos: number }>("/companies/" + companyId + "/billing/seat-pass/" + encodeURIComponent(passId), { method: "DELETE", retry: 0, timeout: 30000 });
    },
  },
};
