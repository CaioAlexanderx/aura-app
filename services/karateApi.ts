// ============================================================
// KARATE API — Aura Karatê
//
// Wired against karate-fase0-openapi.yaml (Fase 0) and
// karate-fase1-openapi.yaml (Fase 1 – Track B financial).
// Usa o request() core de services/api.ts (Bearer JWT auto).
// ============================================================
import { request } from "@/services/api";

// ─────────────────────────────────────────────────────────────
// Fase 0 types
// ─────────────────────────────────────────────────────────────
export type DojoStatus = "active" | "expiring" | "overdue" | "defaulting" | "suspended";
export type AffiliationModel = "annual" | "biannual" | "quarterly";
export type AffiliationStatus = "active" | "pending" | "inactive";
export type BeltSchema = "legacy" | "fpkt_shotokan";

export interface Dojo {
  id: string;
  fpkt_affiliation_id: string;
  name: string;
  cnpj: string | null;
  sensei_cpf: string | null;
  region: string;
  affiliation_model: AffiliationModel;
  affiliation_since: string;
  dojo_founded_year: number | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: DojoStatus;
  practitioner_count: number;
}

export interface DojoInput {
  name: string;
  cnpj?: string | null;
  sensei_cpf?: string | null;
  region?: string;
  affiliation_model: AffiliationModel;
  affiliation_since?: string;
  dojo_founded_year?: number | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface TechnicalTeamMember {
  practitioner_id: string;
  name: string;
  belt_level: string;
  roles: string[];
}

export interface AnnuityHistoryEntry {
  reference_period: string;
  amount: number;
  paid_at: string | null;
  status: DojoStatus;
}

export interface DojoDetail extends Dojo {
  technical_team: TechnicalTeamMember[];
  annuity_history: AnnuityHistoryEntry[];
}

export interface PractitionerListItem {
  id: string;
  full_name: string;
  karate_registration_number: string;
  dojo_name: string;
  belt_name: string | null;
  affiliation_status: AffiliationStatus;
}

export interface BeltHistoryEntry {
  id: string;
  belt_level: string;
  belt_name: string;
  belt_schema: BeltSchema;
  graduated_at: string;
  is_legacy: boolean;
  exam_id: string | null;
}

export interface CurrentBelt {
  belt_level: string;
  belt_name: string;
  current_since: string;
}

export interface PractitionerInput {
  full_name: string;
  cpf?: string | null;
  rg?: string | null;
  birth_date?: string;
  email?: string | null;
  phone?: string | null;
  dojo_id: string;
  is_student?: boolean;
  parent_guardian_id?: string | null;
  is_arbiter?: boolean;
  is_instructor?: boolean;
  is_examiner?: boolean;
  photo_url?: string | null;
}

export interface Practitioner extends PractitionerInput {
  id: string;
  karate_registration_number: string;
  affiliation_status: AffiliationStatus;
  current_belt: CurrentBelt | null;
}

export interface PractitionerDetail extends Practitioner {
  belt_history: BeltHistoryEntry[];
}

export interface BeltDistributionItem {
  belt_level: string;
  belt_name: string;
  count: number;
}

export interface DashboardKPIs {
  dojo_count: number;
  practitioner_count: number;
  revenue_ytd: number;
  overdue_rate: number;
}

export interface UpcomingEvent {
  title: string;
  date: string;
  location: string;
  registered_count: number;
}

export interface OverdueDojo {
  dojo_id: string;
  name: string;
  amount: number;
  days_overdue: number;
}

export interface DashboardPayload {
  kpis: DashboardKPIs;
  upcoming_events: UpcomingEvent[];
  overdue_dojos: OverdueDojo[];
  belt_distribution: BeltDistributionItem[];
}

export interface Paginated<T> {
  page: number;
  page_size: number;
  total: number;
  data: T[];
}

export interface ImportResult {
  mode: "preview" | "commit";
  total_rows: number;
  valid_rows: number;
  committed: number;
  errors: Array<{ row: number; field: string; message: string }>;
}

// ─────────────────────────────────────────────────────────────
// Fase 1 — Financial types (karate-fase1-openapi.yaml)
// ─────────────────────────────────────────────────────────────

export type AnnuityStatus = "paid" | "due" | "overdue" | "defaulting" | "suspended";
export type SizeTier = "up_to_40" | "41_90" | "91_150" | "over_150";
export type ExpenseCategory =
  | "expense_cost"
  | "expense_repasse"
  | "expense_certificate"
  | "expense_award"
  | "expense_other";
export type PaymentMethod = "pix" | "boleto" | "cartao" | "dinheiro" | "transferencia";
export type NfseStatus = "pending" | "issued" | "error" | "cancelled";
export type OverdueTargetType = "dojo" | "cpf";
export type ReminderChannel = "whatsapp" | "email";

export interface AnnualFeeInput {
  fee_type: "dojo" | "cpf";
  size_tier?: SizeTier;
  amount: number;
}

export interface AnnualFee extends AnnualFeeInput {
  id: string;
  effective_from: string;
}

export interface ChargeInput {
  amount: number;
  due_date: string;
  reference_period: string;
}

export interface PaymentInput {
  amount: number;
  method: PaymentMethod;
  paid_at?: string;
  idempotency_key?: string;
  emit_nfse?: boolean;
}

export interface PaymentResult {
  transaction_id: string;
  status: "paid";
  nfse_id: string | null;
  idempotent_hit: boolean;
}

export interface DojoAnnuity {
  dojo_id: string;
  dojo_name: string;
  fpkt_affiliation_id: string;
  size_tier: SizeTier;
  amount: number;
  reference_period: string;
  due_date: string | null;
  paid_at: string | null;
  status: AnnuityStatus;
  days_overdue: number;
  nfse_id: string | null;
}

export interface CpfAnnuity {
  practitioner_id: string;
  full_name: string;
  karate_registration_number: string;
  amount: number;
  reference_period: string;
  due_date: string | null;
  paid_at: string | null;
  status: AnnuityStatus;
}

export interface Expense {
  id: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  due_date?: string;
  reference_type?: string | null;
  reference_id?: string | null;
  created_at: string;
}

export interface ExpenseInput {
  amount: number;
  category: ExpenseCategory;
  description: string;
  due_date?: string;
  reference_type?: string | null;
  reference_id?: string | null;
}

export interface NfseItem {
  nfse_id: string;
  transaction_id: string;
  number: string | null;
  amount: number;
  status: NfseStatus;
  issued_at: string | null;
}

export interface OverdueItem {
  target_type: OverdueTargetType;
  target_id: string;
  name: string;
  amount: number;
  days_overdue: number;
  status: AnnuityStatus;
  last_reminder_at: string | null;
}

export interface DRECategory {
  category: string;
  amount: number;
}

export interface CashflowMonth {
  month: string;
  inflow: number;
  outflow: number;
  balance: number;
}

export interface ProjectedReceivable {
  due_date: string;
  amount: number;
}

export interface FinancialOverview {
  period: { from: string; to: string };
  dre: {
    revenue: DRECategory[];
    expenses: DRECategory[];
    net: number;
  };
  cashflow: CashflowMonth[];
  projected_receivables: ProjectedReceivable[];
}

// PIX intent types (MVP — client-side QR rendering)
export interface PixIntentInput {
  amount: number;
  description?: string;
  idempotency_key?: string;
}

export interface PixIntent {
  intent_id: string;
  payload: string;        // copia-e-cola PIX (EMV string) — usado para gerar QR no client
  qr_image?: string;      // base64 PNG opcional do backend; front usa payload se ausente
  amount: number;
  expires_at: string;
  status: "pending" | "paid" | "expired" | "error";
}

export interface PixStatusResponse {
  intent_id: string;
  status: "pending" | "paid" | "expired" | "error";
  paid_at?: string;
}

// ─────────────────────────────────────────────────────────────
// API calls — Fase 0
// ─────────────────────────────────────────────────────────────
export const karateApi = {
  // Dashboard
  getDashboard: (federationId: string): Promise<DashboardPayload> =>
    request(`/federation/${federationId}/dashboard`),

  getBeltDistribution: (federationId: string): Promise<BeltDistributionItem[]> =>
    request(`/federation/${federationId}/belt-distribution`),

  // Dojôs
  listDojos: (
    federationId: string,
    params?: { region?: string; status?: DojoStatus; affiliation_model?: AffiliationModel; q?: string; page?: number; pageSize?: number }
  ): Promise<Paginated<Dojo>> => {
    const qs = new URLSearchParams();
    if (params?.region) qs.set("region", params.region);
    if (params?.status) qs.set("status", params.status);
    if (params?.affiliation_model) qs.set("affiliation_model", params.affiliation_model);
    if (params?.q) qs.set("q", params.q);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/dojos${query}`);
  },

  getDojo: (federationId: string, dojoId: string): Promise<DojoDetail> =>
    request(`/federation/${federationId}/dojos/${dojoId}`),

  createDojo: (federationId: string, body: DojoInput): Promise<Dojo> =>
    request(`/federation/${federationId}/dojos`, { method: "POST", body }),

  updateDojo: (federationId: string, dojoId: string, body: Partial<DojoInput>): Promise<Dojo> =>
    request(`/federation/${federationId}/dojos/${dojoId}`, { method: "PATCH", body }),

  // Praticantes
  listPractitioners: (
    federationId: string,
    params?: { dojo_id?: string; belt_level?: string; affiliation_status?: AffiliationStatus; role?: string; q?: string; page?: number; pageSize?: number }
  ): Promise<Paginated<PractitionerListItem>> => {
    const qs = new URLSearchParams();
    if (params?.dojo_id) qs.set("dojo_id", params.dojo_id);
    if (params?.belt_level) qs.set("belt_level", params.belt_level);
    if (params?.affiliation_status) qs.set("affiliation_status", params.affiliation_status);
    if (params?.role) qs.set("role", params.role);
    if (params?.q) qs.set("q", params.q);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/practitioners${query}`);
  },

  getPractitioner: (federationId: string, practitionerId: string): Promise<PractitionerDetail> =>
    request(`/federation/${federationId}/practitioners/${practitionerId}`),

  createPractitioner: (federationId: string, body: PractitionerInput): Promise<Practitioner> =>
    request(`/federation/${federationId}/practitioners`, { method: "POST", body }),

  // Importação CSV
  importCSV: (
    federationId: string,
    file: FormData,
    mode: "preview" | "commit" = "preview"
  ): Promise<ImportResult> => {
    const baseUrl =
      (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
      "https://aura-backend-production-f805.up.railway.app/api/v1";
    const { useAuthStore } = require("@/stores/auth");
    const token = useAuthStore.getState().token;
    file.append("mode", mode);
    return fetch(`${baseUrl}/federation/${federationId}/practitioners/import`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: file,
    }).then((r) => r.json());
  },

  // ─────────────────────────────────────────────────────────────
  // Fase 1 — Financial endpoints
  // ─────────────────────────────────────────────────────────────

  // Visão geral (DRE + fluxo)
  getFinancialOverview: (
    federationId: string,
    params?: { from?: string; to?: string }
  ): Promise<FinancialOverview> => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/financial/overview${query}`);
  },

  // Tabela de anuidades
  getAnnualFees: (federationId: string): Promise<AnnualFee[]> =>
    request(`/federation/${federationId}/financial/fees`),

  updateAnnualFees: (
    federationId: string,
    body: { effective_from: string; fees: AnnualFeeInput[] }
  ): Promise<AnnualFee[]> =>
    request(`/federation/${federationId}/financial/fees`, { method: "PUT", body }),

  // Anuidades Dojô
  listDojoAnnuities: (
    federationId: string,
    params?: { status?: AnnuityStatus; page?: number; pageSize?: number }
  ): Promise<Paginated<DojoAnnuity>> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/financial/annuities/dojos${query}`);
  },

  chargeDojoAnnuity: (
    federationId: string,
    dojoId: string,
    body: ChargeInput
  ): Promise<DojoAnnuity> =>
    request(`/federation/${federationId}/financial/annuities/dojos/${dojoId}/charge`, {
      method: "POST",
      body,
    }),

  payDojoAnnuity: (
    federationId: string,
    dojoId: string,
    body: PaymentInput
  ): Promise<PaymentResult> =>
    request(`/federation/${federationId}/financial/annuities/dojos/${dojoId}/pay`, {
      method: "POST",
      body,
    }),

  // Anuidades CPF
  listCpfAnnuities: (
    federationId: string,
    params?: { status?: AnnuityStatus; page?: number; pageSize?: number }
  ): Promise<Paginated<CpfAnnuity>> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/financial/annuities/cpf${query}`);
  },

  payCpfAnnuity: (
    federationId: string,
    practitionerId: string,
    body: PaymentInput
  ): Promise<PaymentResult> =>
    request(`/federation/${federationId}/financial/annuities/cpf/${practitionerId}/pay`, {
      method: "POST",
      body,
    }),

  // Saídas
  listExpenses: (
    federationId: string,
    params?: { page?: number; pageSize?: number }
  ): Promise<Paginated<Expense>> => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/financial/expenses${query}`);
  },

  createExpense: (federationId: string, body: ExpenseInput): Promise<Expense> =>
    request(`/federation/${federationId}/financial/expenses`, { method: "POST", body }),

  // NFS-e
  listNfse: (
    federationId: string,
    params?: { page?: number; pageSize?: number }
  ): Promise<Paginated<NfseItem>> => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/financial/nfse${query}`);
  },

  // Inadimplência
  listOverdue: (federationId: string): Promise<OverdueItem[]> =>
    request(`/federation/${federationId}/financial/overdue`),

  remindOverdue: (
    federationId: string,
    targetId: string,
    body: { channel: ReminderChannel; target_type: OverdueTargetType }
  ): Promise<{ queued: boolean }> =>
    request(`/federation/${federationId}/financial/overdue/${targetId}/remind`, {
      method: "POST",
      body,
    }),

  // ─────────────────────────────────────────────────────────────
  // PIX intent / status / confirm manual
  // MVP: backend retorna payload (EMV) e QR opcional;
  // front gera QR a partir do payload client-side.
  // ─────────────────────────────────────────────────────────────

  createPixIntent: (
    federationId: string,
    body: PixIntentInput
  ): Promise<PixIntent> =>
    request(`/federation/${federationId}/financial/pix/intent`, {
      method: "POST",
      body,
    }),

  getPixStatus: (
    federationId: string,
    intentId: string
  ): Promise<PixStatusResponse> =>
    request(`/federation/${federationId}/financial/pix/intent/${intentId}/status`),

  confirmPixManual: (
    federationId: string,
    intentId: string
  ): Promise<{ confirmed: boolean }> =>
    request(`/federation/${federationId}/financial/pix/intent/${intentId}/confirm`, {
      method: "POST",
      body: {},
    }),
};
