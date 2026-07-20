// ============================================================
// AURA DOJÔ — F3a: Mensalidades do dojô (planos, assinaturas, cobranças, PIX)
// F3b: Conta Aura (BaaS opt-in — ativação, status, seletor de recebimento)
// F3c: Régua de cobrança (lembretes automáticos por e-mail)
//
// Cliente tipado do Aura-backend PR "f3a-dojo-billing" / "f3b-conta-aura" /
// "f3c-dojo-regua-gate" (em paralelo — o backend está sendo construído a
// partir do MESMO contrato deste arquivo). Base: /federation/:id/dojo/billing —
// Bearer = JWT normal do app via request() core (Canal A).
//
// Vive num service pequeno separado, mesmo racional do
// karateDojoStudentsApi (karateApi.ts tem 125 KB e é intocável).
//
// Erros do backend (todos via ApiError.data.code, ver helpers.ts do
// módulo components/karate/dojoMensalidades p/ mapeamento pt-BR):
//   422 VALIDATION_ERROR · 503 SCHEMA_PENDING (migration pendente) ·
//   409 PIX_NAO_CONFIGURADO (POST /charges/:id/pix) ·
//   409 no cancel de cobrança já paga ·
//   503 BAAS_DISABLED (flag off) · 409 BAAS_JA_ATIVADO ·
//   409 PROVIDER_NAO_DISPONIVEL (baas sem approved).
// ============================================================
import { request } from "@/services/api";

export type DojoChargeStatus = "pending" | "paid" | "overdue" | "cancelled";
export type DojoChargePaymentMethod = "pix" | "dinheiro" | "cartao" | "outro";

// ── Planos ──────────────────────────────────────────────────
export interface DojoBillingPlan {
  id: string;
  name: string;
  amount: number;
  due_day: number;
  active: boolean;
  students_count: number;
}

/** Campo ausente (undefined) = não mexe. Espelha PATCH parcial do backend. */
export interface DojoBillingPlanPayload {
  name?: string;
  amount?: number;
  due_day?: number;
  active?: boolean;
}

export interface DojoBillingPlansListResponse {
  data: DojoBillingPlan[];
}

// ── Assinaturas ─────────────────────────────────────────────
export interface DojoSubscription {
  id: string;
  student_id: string;
  plan_id: string | null;
  amount: number;
  due_day: number;
  payer_guardian_id: string | null;
  active_from: string | null;
  canceled_at: string | null;
}

export interface DojoSubscribePayload {
  plan_id?: string | null;
  amount?: number;
  due_day?: number;
  payer_guardian_id?: string | null;
}

export interface DojoSubscriptionPersonRef {
  id: string;
  full_name: string;
}

export interface DojoSubscriptionListItem extends DojoSubscription {
  student: DojoSubscriptionPersonRef;
  guardian?: DojoSubscriptionPersonRef | null;
}

export interface DojoSubscriptionsListResponse {
  data: DojoSubscriptionListItem[];
}

// ── Geração de cobranças ────────────────────────────────────
export interface DojoGenerateChargesResult {
  created: number;
  skipped: number;
}

// ── Cobranças ───────────────────────────────────────────────
export interface DojoCharge {
  id: string;
  student: DojoSubscriptionPersonRef;
  guardian: DojoSubscriptionPersonRef | null;
  /** 'YYYY-MM'. */
  competence: string;
  amount: number;
  /** 'YYYY-MM-DD' — date puro, NUNCA new Date() direto. */
  due_date: string;
  status: DojoChargeStatus;
  paid_at: string | null;
  payment_method: DojoChargePaymentMethod | null;
  has_pix: boolean;
}

export interface DojoChargesSummary {
  total_amount: number;
  paid_amount: number;
  pending_count: number;
  overdue_count: number;
  paid_count: number;
}

export interface DojoChargesListResponse {
  data: DojoCharge[];
  summary: DojoChargesSummary;
}

export interface DojoChargesFilters {
  competence?: string;
  status?: DojoChargeStatus;
  q?: string;
}

export interface DojoChargePixResponse {
  payload: string;
  public_url: string;
  /**
   * Aditivo (F3b): quando a Conta Aura está ativa como forma de
   * recebimento, o backend devolve o provider usado nessa cobrança.
   * Campo opcional — trate a ausência como 'pix_manual'.
   */
  provider?: DojoBillingProvider;
}

export interface DojoConfirmChargePayload {
  method?: DojoChargePaymentMethod;
}

// ── Config de recebimento (PIX do dojô) ─────────────────────
export interface DojoBillingConfig {
  pix_configured: boolean;
  pix_key_masked: string | null;
  pix_key_type: string | null;
}

export interface DojoBillingConfigPayload {
  pix_key: string;
  pix_key_type: string;
}

/** Opções de tipo de chave Pix pro seletor da UI (Asaas-padrão). */
export const PIX_KEY_TYPE_OPTIONS: { key: string; label: string }[] = [
  { key: "cpf", label: "CPF" },
  { key: "cnpj", label: "CNPJ" },
  { key: "email", label: "E-mail" },
  { key: "phone", label: "Telefone" },
  { key: "random", label: "Aleatória" },
];

// ── Conta Aura (BaaS opt-in, F3b) ────────────────────────────
// Subconta Asaas do dojô: o dojô escolhe entre continuar recebendo na
// própria chave Pix ('pix_manual') ou ativar a conta integrada ('baas'
// — conciliação automática, split de 0,5% embutido nas taxas). Atrás
// de flag no backend: enabled:false em produção até a homologação
// Asaas — nesse caso a UI (ContaAuraCard) não renderiza nada.
export type BaasStatus =
  | "none" | "created" | "docs_pending" | "under_review" | "approved" | "rejected";

export type DojoBillingProvider = "pix_manual" | "baas";

export interface DojoBaasAccount {
  agency: string;
  account: string;
  account_digit: string;
  wallet_id_masked: string;
}

export interface DojoBaasStatusResponse {
  enabled: boolean;
  status: BaasStatus;
  onboarding_url: string | null;
  provider: DojoBillingProvider;
  account: DojoBaasAccount | null;
}

export type BaasPersonType = "FISICA" | "JURIDICA";
export type BaasCompanyType = "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";

export interface DojoBaasActivatePayload {
  person_type: BaasPersonType;
  name: string;
  cpf_cnpj: string;
  /** Obrigatório quando person_type === 'FISICA'. 'YYYY-MM-DD'. */
  birth_date?: string;
  /** Obrigatório quando person_type === 'JURIDICA'. */
  company_type?: BaasCompanyType;
  email: string;
  mobile_phone: string;
  income_value: number;
  address: string;
  address_number: string;
  complement?: string;
  province: string;
  postal_code: string;
}

export interface DojoBaasActivateResponse {
  status: "created";
  onboarding_url: string | null;
}

export interface DojoBaasProviderResponse {
  provider: DojoBillingProvider;
}

// ── Régua de cobrança (lembretes automáticos, F3c) ──────────
// Lembretes por e-mail perto do vencimento, com offsets configuráveis
// em dias relativos ao vencimento (negativo = antes, 0 = no dia,
// positivo = depois). Execução agendada no backend + botão "rodar
// agora" no front — dedupe por dia (reenviar não duplica cobrança já
// avisada no mesmo dia).
export interface DojoReminderConfig {
  enabled: boolean;
  /** Inteiros -15..30, no máx. 6, únicos. */
  offsets: number[];
  send_email: boolean;
  updated_at: string | null;
}

export interface DojoReminderConfigPayload {
  enabled: boolean;
  offsets: number[];
  send_email: boolean;
}

export type DojoReminderChannel = "email";
export type DojoReminderLogStatus = "sent" | "failed" | "skipped_no_email";

export interface DojoReminderLogItem {
  id: string;
  charge_id: string;
  student_name: string;
  offset: number;
  channel: DojoReminderChannel;
  status: DojoReminderLogStatus;
  sent_at: string;
}

export interface DojoReminderLogResponse {
  data: DojoReminderLogItem[];
}

export interface DojoRunRemindersResult {
  sent: number;
  skipped: number;
  failed: number;
}

function qs(params: Record<string, string | undefined>): string {
  const parts: string[] = [];
  for (const k of Object.keys(params)) {
    const v = params[k];
    if (v != null && v !== "") parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

const base = (federationId: string) => `/federation/${federationId}/dojo/billing`;

export const karateDojoBillingApi = {
  // Planos
  listPlans: (federationId: string): Promise<DojoBillingPlansListResponse> =>
    request<DojoBillingPlansListResponse>(`${base(federationId)}/plans`),

  createPlan: (federationId: string, payload: DojoBillingPlanPayload): Promise<DojoBillingPlan> =>
    request<DojoBillingPlan>(`${base(federationId)}/plans`, { method: "POST", body: payload }),

  updatePlan: (
    federationId: string,
    planId: string,
    payload: DojoBillingPlanPayload
  ): Promise<DojoBillingPlan> =>
    request<DojoBillingPlan>(`${base(federationId)}/plans/${planId}`, {
      method: "PATCH",
      body: payload,
    }),

  // Assinaturas
  subscribeStudent: (
    federationId: string,
    studentId: string,
    payload: DojoSubscribePayload
  ): Promise<DojoSubscription> =>
    request<DojoSubscription>(`${base(federationId)}/students/${studentId}/subscribe`, {
      method: "POST",
      body: payload,
    }),

  cancelSubscription: (federationId: string, studentId: string): Promise<void> =>
    request<void>(`${base(federationId)}/students/${studentId}/subscribe`, { method: "DELETE" }),

  listSubscriptions: (federationId: string): Promise<DojoSubscriptionsListResponse> =>
    request<DojoSubscriptionsListResponse>(`${base(federationId)}/subscriptions`),

  // Geração de cobranças (idempotente)
  generateCharges: (federationId: string, competence: string): Promise<DojoGenerateChargesResult> =>
    request<DojoGenerateChargesResult>(`${base(federationId)}/generate`, {
      method: "POST",
      body: { competence },
      // Lote de N alunos numa transação única pode passar dos 10s default.
      timeout: 20000,
    }),

  // Cobranças
  listCharges: (
    federationId: string,
    filters: DojoChargesFilters = {}
  ): Promise<DojoChargesListResponse> =>
    request<DojoChargesListResponse>(
      `${base(federationId)}/charges${qs({
        competence: filters.competence,
        status: filters.status,
        q: filters.q,
      })}`
    ),

  getChargePix: (federationId: string, chargeId: string): Promise<DojoChargePixResponse> =>
    request<DojoChargePixResponse>(`${base(federationId)}/charges/${chargeId}/pix`, {
      method: "POST",
    }),

  confirmCharge: (
    federationId: string,
    chargeId: string,
    payload: DojoConfirmChargePayload = {}
  ): Promise<DojoCharge> =>
    request<DojoCharge>(`${base(federationId)}/charges/${chargeId}/confirm`, {
      method: "POST",
      body: payload,
    }),

  cancelCharge: (federationId: string, chargeId: string): Promise<DojoCharge> =>
    request<DojoCharge>(`${base(federationId)}/charges/${chargeId}/cancel`, { method: "POST" }),

  // Config de recebimento
  getConfig: (federationId: string): Promise<DojoBillingConfig> =>
    request<DojoBillingConfig>(`${base(federationId)}/config`),

  updateConfig: (
    federationId: string,
    payload: DojoBillingConfigPayload
  ): Promise<DojoBillingConfig> =>
    request<DojoBillingConfig>(`${base(federationId)}/config`, { method: "PUT", body: payload }),

  // Conta Aura (BaaS opt-in, F3b)
  getBaas: (federationId: string): Promise<DojoBaasStatusResponse> =>
    request<DojoBaasStatusResponse>(`${base(federationId)}/baas`),

  activateBaas: (
    federationId: string,
    payload: DojoBaasActivatePayload
  ): Promise<DojoBaasActivateResponse> =>
    request<DojoBaasActivateResponse>(`${base(federationId)}/baas/activate`, {
      method: "POST",
      body: payload,
    }),

  setBaasProvider: (
    federationId: string,
    provider: DojoBillingProvider
  ): Promise<DojoBaasProviderResponse> =>
    request<DojoBaasProviderResponse>(`${base(federationId)}/baas/provider`, {
      method: "PUT",
      body: { provider },
    }),

  // Régua de cobrança (lembretes, F3c)
  getReminderConfig: (federationId: string): Promise<DojoReminderConfig> =>
    request<DojoReminderConfig>(`${base(federationId)}/reminder-config`),

  updateReminderConfig: (
    federationId: string,
    payload: DojoReminderConfigPayload
  ): Promise<DojoReminderConfig> =>
    request<DojoReminderConfig>(`${base(federationId)}/reminder-config`, {
      method: "PUT",
      body: payload,
    }),

  getReminderLog: (federationId: string, competence?: string): Promise<DojoReminderLogResponse> =>
    request<DojoReminderLogResponse>(`${base(federationId)}/reminder-log${qs({ competence })}`),

  runReminders: (federationId: string): Promise<DojoRunRemindersResult> =>
    request<DojoRunRemindersResult>(`${base(federationId)}/reminders/run`, {
      method: "POST",
      // Envio de lote de lembretes pode passar dos 10s default.
      timeout: 20000,
    }),
};
