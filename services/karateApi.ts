// ============================================================
// KARATE API — Aura Karatê
//
// Wired against karate-fase0-openapi.yaml (Fase 0),
// karate-fase1-openapi.yaml v0.2.0 (Fase 1 – Track B financial),
// and karate-fase2-openapi.yaml v0.2.0 (Fase 2 – Track C eventos/exames).
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
// Fase 1 — Financial types (karate-fase1-openapi.yaml v0.2.0)
// ─────────────────────────────────────────────────────────────

export type AnnuityStatus = "paid" | "due" | "overdue" | "defaulting" | "suspended";
export type SizeTier = "up_to_40" | "41_90" | "91_150" | "over_150";
export type ExpenseCategory =
  | "expense_cost"
  | "expense_repasse"
  | "expense_certificate"
  | "expense_award"
  | "expense_other";
export type NfseStatus = "pending" | "issued" | "error" | "cancelled";
export type OverdueTargetType = "dojo" | "cpf";
export type ReminderChannel = "whatsapp" | "email";
export type PixProvider = "static_brcode" | "asaas";

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

export interface DojoPixInput {
  annuity_history_id: string;
}

export interface CpfPixInput {
  transaction_id: string;
}

export interface PixIntent {
  intent_id: string;
  payment_intent_id: string;
  payload: string;
  qr_image?: string | null;
  status: "pending" | "paid" | "expired";
  expires_at: string | null;
  provider: PixProvider;
  _warn?: string | null;
}

export interface PixStatusResponse {
  intent_id: string;
  payment_intent_id: string;
  provider: string;
  status: "pending" | "paid" | "expired";
  expires_at: string | null;
  paid_at: string | null;
}

export interface PaymentResult {
  intent_id: string;
  transaction_id: string | null;
  status: "paid";
  paid_at: string;
  nfse_id: string | null;
  idempotent_hit: boolean;
}

export interface DojoAnnuity {
  dojo_id: string;
  dojo_name: string;
  fpkt_affiliation_id: string;
  amount: number;
  reference_period: string;
  due_date: string | null;
  paid_at: string | null;
  status: AnnuityStatus;
  days_overdue: number;
  nfse_id: string | null;
  transaction_id: string | null;
  annuity_history_id: string | null;
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
  status: string;
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

// ─────────────────────────────────────────────────────────────
// Fase 2 — Exames + Graduações types (karate-fase2-openapi.yaml v0.2.0)
// ─────────────────────────────────────────────────────────────

export type ExamStatus = "draft" | "open" | "closed" | "cancelled";
export type CandidateResult = "pending" | "approved" | "rejected";
export type CertificateStatus = "pending" | "generated" | "sent" | "error";
export type CourseType = "seminar" | "technical" | "referee" | "other";

/** Exame de faixa — karate_belt_exams */
export interface BeltExam {
  id: string;
  federation_id: string;
  title: string;
  exam_date: string;          // ISO date
  location: string;
  target_belt: string;        // belt_level key
  status: ExamStatus;
  candidate_count: number;
  created_at: string;
}

export interface BeltExamInput {
  title: string;
  exam_date: string;
  location: string;
  target_belt: string;
  notes?: string | null;
}

/** Examinador na banca — karate_exam_examiners */
export interface Examiner {
  id: string;
  practitioner_id: string;
  name: string;
  belt_level: string;
  role: "chief" | "member";
}

export interface ExaminerInput {
  practitioner_id: string;
  role: "chief" | "member";
}

/** Critério de elegibilidade individual */
export interface EligibilityCheck {
  criterion: string;    // "min_time_in_belt" | "kata_required" | "course_required"
  ok: boolean;
  required: string | number | null;
  actual: string | number | null;
  label: string;        // human-readable label
}

/** Resultado de elegibilidade — DECISÃO FPKT #1: sempre aviso, nunca bloqueia */
export interface EligibilityResult {
  practitioner_id: string;
  target_belt: string;
  eligible: boolean;          // informativo
  // is_hard_block is ALWAYS false per FPKT decision — not included in shape
  checks: EligibilityCheck[];
  warnings: string[];         // mensagens de aviso para exibir na UI
}

/** Candidato em exame — karate_belt_exam_candidates */
export interface ExamCandidate {
  id: string;
  exam_id: string;
  practitioner_id: string;
  full_name: string;
  karate_registration_number: string;
  current_belt: string | null;
  target_belt: string;
  result: CandidateResult;
  notes: string | null;
  eligibility: EligibilityResult | null;  // anexado na inscrição
  certificate_status: CertificateStatus | null;
  certificate_url: string | null;
}

export interface EnrollCandidateInput {
  practitioner_id: string;
  target_belt: string;
}

export interface UpdateCandidateResultInput {
  result: "approved" | "rejected";
  notes?: string | null;
}

/** Requisito de graduação — karate_belt_requirements (DECISÃO FPKT #2: pode ser provisório) */
export interface BeltRequirement {
  id: string;
  belt_level: string;
  belt_name: string;
  min_months_in_current: number;
  kata_required: string[];    // nomes dos katas obrigatórios
  course_required: boolean;
  notes: string | null;
  /** DECISÃO FPKT #2: false = provisório; UI mostra banner de aviso */
  confirmed: boolean;
  updated_at: string;
}

export interface BeltRequirementInput {
  min_months_in_current: number;
  kata_required: string[];
  course_required: boolean;
  notes?: string | null;
  confirmed: boolean;
}

/** Curso / evento de formação — karate_events */
export interface CourseEvent {
  id: string;
  federation_id: string;
  title: string;
  event_type: CourseType;
  event_date: string;
  location: string;
  instructor: string | null;
  enrolled_count: number;
  created_at: string;
}

export interface CourseEventInput {
  title: string;
  event_type: CourseType;
  event_date: string;
  location: string;
  instructor?: string | null;
}

export interface CourseEnrollInput {
  practitioner_id: string;
}

/** Certificado — DECISÃO FPKT #3: emissão sob demanda via /issue */
export interface Certificate {
  id: string;
  candidate_id: string;
  practitioner_id: string;
  full_name: string;
  belt_level: string;
  exam_date: string;
  status: CertificateStatus;
  issued_at: string | null;
  pdf_url: string | null;
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

  getAnnualFees: (federationId: string): Promise<AnnualFee[]> =>
    request(`/federation/${federationId}/financial/fees`),

  updateAnnualFees: (
    federationId: string,
    body: { effective_from: string; fees: AnnualFeeInput[] }
  ): Promise<AnnualFee[]> =>
    request(`/federation/${federationId}/financial/fees`, { method: "PUT", body }),

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

  createDojoPixIntent: (
    federationId: string,
    dojoId: string,
    body: DojoPixInput
  ): Promise<PixIntent> =>
    request(`/federation/${federationId}/financial/annuities/dojos/${dojoId}/pix`, {
      method: "POST",
      body,
    }),

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

  chargeCpfAnnuity: (
    federationId: string,
    practitionerId: string,
    body: ChargeInput
  ): Promise<CpfAnnuity> =>
    request(`/federation/${federationId}/financial/annuities/cpf/${practitionerId}/charge`, {
      method: "POST",
      body,
    }),

  createCpfPixIntent: (
    federationId: string,
    practitionerId: string,
    body: CpfPixInput
  ): Promise<PixIntent> =>
    request(`/federation/${federationId}/financial/annuities/cpf/${practitionerId}/pix`, {
      method: "POST",
      body,
    }),

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

  getPixStatus: (
    federationId: string,
    intentId: string
  ): Promise<PixStatusResponse> =>
    request(`/federation/${federationId}/financial/payments/${intentId}/status`),

  confirmPixManual: (
    federationId: string,
    intentId: string,
    body?: { paid_at?: string; emit_nfse?: boolean }
  ): Promise<PaymentResult> =>
    request(`/federation/${federationId}/financial/payments/${intentId}/confirm`, {
      method: "POST",
      body: body ?? {},
    }),

  // ─────────────────────────────────────────────────────────────
  // Fase 2 — Belt Exams (karate-fase2-openapi.yaml v0.2.0)
  // ─────────────────────────────────────────────────────────────

  /** GET /federation/{id}/belt-exams */
  listBeltExams: (
    federationId: string,
    params?: { status?: ExamStatus; page?: number; pageSize?: number }
  ): Promise<Paginated<BeltExam>> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/belt-exams${query}`);
  },

  /** POST /federation/{id}/belt-exams */
  createBeltExam: (federationId: string, body: BeltExamInput): Promise<BeltExam> =>
    request(`/federation/${federationId}/belt-exams`, { method: "POST", body }),

  /** GET /federation/{id}/belt-exams/{examId} */
  getBeltExam: (federationId: string, examId: string): Promise<BeltExam & { examiners: Examiner[]; candidates: ExamCandidate[] }> =>
    request(`/federation/${federationId}/belt-exams/${examId}`),

  /** PATCH /federation/{id}/belt-exams/{examId} */
  updateBeltExam: (federationId: string, examId: string, body: Partial<BeltExamInput>): Promise<BeltExam> =>
    request(`/federation/${federationId}/belt-exams/${examId}`, { method: "PATCH", body }),

  // ─────────────────────────────────────────────────────────────
  // Fase 2 — Examiners (banca)
  // ─────────────────────────────────────────────────────────────

  /** GET /federation/{id}/belt-exams/{examId}/examiners */
  listExaminers: (federationId: string, examId: string): Promise<Examiner[]> =>
    request(`/federation/${federationId}/belt-exams/${examId}/examiners`),

  /** POST /federation/{id}/belt-exams/{examId}/examiners */
  addExaminer: (federationId: string, examId: string, body: ExaminerInput): Promise<Examiner> =>
    request(`/federation/${federationId}/belt-exams/${examId}/examiners`, { method: "POST", body }),

  // ─────────────────────────────────────────────────────────────
  // Fase 2 — Candidates
  // DECISÃO FPKT #1: POST always returns 201 with eligibility.warnings;
  // never returns 422 for eligibility — inscription is never blocked.
  // ─────────────────────────────────────────────────────────────

  /** POST /federation/{id}/belt-exams/{examId}/candidates
   *  Always 201 — eligibility is advisory only (never blocks). */
  enrollCandidate: (
    federationId: string,
    examId: string,
    body: EnrollCandidateInput
  ): Promise<ExamCandidate> =>
    request(`/federation/${federationId}/belt-exams/${examId}/candidates`, { method: "POST", body }),

  /** PATCH /federation/{id}/belt-exams/{examId}/candidates/{candidateId}
   *  Lança resultado. RBAC: examResults guard on backend. */
  updateCandidateResult: (
    federationId: string,
    examId: string,
    candidateId: string,
    body: UpdateCandidateResultInput
  ): Promise<ExamCandidate> =>
    request(`/federation/${federationId}/belt-exams/${examId}/candidates/${candidateId}`, {
      method: "PATCH",
      body,
    }),

  /** POST /federation/{id}/belt-exams/{examId}/close
   *  Fecha exame. NÃO emite certificados (DECISÃO FPKT #3). */
  closeBeltExam: (federationId: string, examId: string): Promise<{ closed: true; approved_count: number }> =>
    request(`/federation/${federationId}/belt-exams/${examId}/close`, { method: "POST", body: {} }),

  // ─────────────────────────────────────────────────────────────
  // Fase 2 — Eligibility (DECISÃO FPKT #1: informativo, nunca bloqueia)
  // ─────────────────────────────────────────────────────────────

  /** GET /federation/{id}/practitioners/{practitionerId}/eligibility/{targetBelt} */
  checkEligibility: (
    federationId: string,
    practitionerId: string,
    targetBelt: string
  ): Promise<EligibilityResult> =>
    request(`/federation/${federationId}/practitioners/${practitionerId}/eligibility/${targetBelt}`),

  // ─────────────────────────────────────────────────────────────
  // Fase 2 — Belt Requirements
  // DECISÃO FPKT #2: confirmed=false → provisório; UI shows banner.
  // ─────────────────────────────────────────────────────────────

  /** GET /federation/{id}/belt-requirements */
  listBeltRequirements: (federationId: string): Promise<BeltRequirement[]> =>
    request(`/federation/${federationId}/belt-requirements`),

  /** PUT /federation/{id}/belt-requirements */
  updateBeltRequirements: (
    federationId: string,
    body: { requirements: Array<{ belt_level: string } & BeltRequirementInput> }
  ): Promise<BeltRequirement[]> =>
    request(`/federation/${federationId}/belt-requirements`, { method: "PUT", body }),

  // ─────────────────────────────────────────────────────────────
  // Fase 2 — Courses / Events
  // ─────────────────────────────────────────────────────────────

  /** GET /federation/{id}/courses */
  listCourses: (
    federationId: string,
    params?: { page?: number; pageSize?: number }
  ): Promise<Paginated<CourseEvent>> => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/courses${query}`);
  },

  /** POST /federation/{id}/courses */
  createCourse: (federationId: string, body: CourseEventInput): Promise<CourseEvent> =>
    request(`/federation/${federationId}/courses`, { method: "POST", body }),

  /** POST /federation/{id}/courses/{eventId}/enroll */
  enrollCourse: (
    federationId: string,
    eventId: string,
    body: CourseEnrollInput
  ): Promise<{ enrolled: true }> =>
    request(`/federation/${federationId}/courses/${eventId}/enroll`, { method: "POST", body }),

  // ─────────────────────────────────────────────────────────────
  // Fase 2 — Certificates
  // DECISÃO FPKT #3: emissão sob demanda; /issue é chamado pelo admin.
  // Fechar exame NÃO gera certificados automaticamente.
  // ─────────────────────────────────────────────────────────────

  /** POST /federation/{id}/certificates/{candidateId}/issue
   *  Solicita emissão do certificado (sob demanda). */
  issueCertificate: (
    federationId: string,
    candidateId: string
  ): Promise<Certificate> =>
    request(`/federation/${federationId}/certificates/${candidateId}/issue`, { method: "POST", body: {} }),

  /** GET /federation/{id}/certificates/{candidateId} */
  getCertificate: (federationId: string, candidateId: string): Promise<Certificate> =>
    request(`/federation/${federationId}/certificates/${candidateId}`),
};
