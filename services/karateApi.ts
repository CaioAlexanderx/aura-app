// ============================================================
// KARATE API — Aura Karâtê
//
// Wired against karate-fase0-openapi.yaml (Fase 0),
// karate-fase1-openapi.yaml v0.2.0 (Fase 1 – Track B financial),
// karate-fase2-openapi.yaml v0.2.0 (Fase 2 – Track C eventos/exames),
// Track P (alerts, search, notifications),
// Track H (configurações da federação: equipe, recursos, identidade, régua),
// Track J (certificado como fluxo de pedido: estados, lote, entrega, e-mail).
// Usa o request() core de services/api.ts (Bearer JWT auto).
// ============================================================
import { request, ApiError } from "@/services/api";

// ─────────────────────────────────────────────────────────────────
// HAS_HISTORY — propagação estruturada do 409 de exclusão
//
// O backend responde 409 com body { code:'HAS_HISTORY', counts:{...} }
// quando um dojô/praticante tem histórico que impede o hard delete; a
// tela então oferece "Desativar" em vez de "Excluir definitivamente".
//
// O request() core já lança ApiError(status:409, data) nesse caso; aqui
// re-lançamos um erro com `code:'HAS_HISTORY'`, `counts` e `status:409`
// expostos no próprio objeto, para a tela não precisar cavar `err.data`.
// ─────────────────────────────────────────────────────────────────
export type HasHistoryCounts = Record<string, number>;

export class HasHistoryError extends Error {
  code: "HAS_HISTORY";
  status: 409;
  counts: HasHistoryCounts;
  data: any;
  constructor(counts: HasHistoryCounts, data?: any) {
    super("Registro possui histórico vinculado (HAS_HISTORY).");
    this.name = "HasHistoryError";
    this.code = "HAS_HISTORY";
    this.status = 409;
    this.counts = counts || {};
    this.data = data ?? null;
  }
}

/**
 * Executa um delete e converte o 409 HAS_HISTORY do backend num
 * HasHistoryError estruturado. Qualquer outro erro é propagado intacto;
 * o caminho de sucesso retorna o JSON da resposta.
 */
async function withHasHistory<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (err: any) {
    const status = err?.status;
    const data = err instanceof ApiError ? err.data : err?.data;
    const code = data?.code ?? err?.code;
    if (status === 409 && code === "HAS_HISTORY") {
      throw new HasHistoryError(data?.counts ?? {}, data);
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────
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
  // Endereço: `address` (texto livre legado) + campos estruturados (NF-e).
  address: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
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
  // Endereço: `address` legado opcional + campos estruturados (NF-e).
  address?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
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
  /** Status do praticante: ativo/inativo (editável na ficha). */
  is_active?: boolean;
}

export interface Practitioner extends PractitionerInput {
  id: string;
  karate_registration_number: string;
  affiliation_status: AffiliationStatus;
  current_belt: CurrentBelt | null;
  /** Nome do dojô atual — usado para pré-selecionar o dojô no modal de edição. */
  dojo_name?: string | null;
}

export interface PractitionerDetail extends Practitioner {
  belt_history: BeltHistoryEntry[];
}

/** Graduação manual registrada pelo detalhe (append em karate_belt_history). */
export interface GraduationInput {
  belt_level: string;        // chave canônica ou nome de cor
  belt_name?: string;        // rótulo exibido (default = belt_level)
  belt_schema?: BeltSchema;  // 'fpkt_shotokan' (default) | 'legacy'
  graduated_at?: string;     // 'YYYY-MM-DD' (default hoje)
  notes?: string | null;
}

// ── Track N — Transferência de praticante entre dojôs ──────────
export interface TransferInput {
  destination_dojo_id: string;
  transferred_at?: string;   // 'YYYY-MM-DD' (retroativa opcional; default hoje)
  reason?: string;
}

export interface TransferRecord {
  id: string;
  practitioner_id: string;
  origin_dojo_id: string | null;
  destination_dojo_id: string;
  origin_dojo_name: string | null;
  destination_dojo_name: string | null;
  reason: string | null;
  transferred_at: string;
  initiated_by?: string | null;
  initiated_by_name?: string | null;
  created_at: string;
}

export interface BeltDistributionItem {
  belt_level: string;
  belt_name: string;
  count: number;
  /** back#252: ordem canônica de hierarquia (Branca<…<Preta 1º→2º<…<Vermelha por último). Opcional. */
  rank?: number;
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

// Track P — alertas do dashboard
export type AlertSeverity = "danger" | "warn" | "info";

export interface DashboardAlert {
  type: string;
  severity: AlertSeverity;
  title: string;
  count: number;
  action_path?: string | null;
}

export interface DashboardPayload {
  kpis: DashboardKPIs;
  upcoming_events: UpcomingEvent[];
  overdue_dojos: OverdueDojo[];
  belt_distribution: BeltDistributionItem[];
  /** back#252: total real de praticantes (independe da distribuição visível, que oculta a Vermelha). Opcional. */
  practitioner_total?: number;
  /** Track P: alertas derivados (opcional — backend pode não retornar ainda) */
  alerts?: DashboardAlert[];
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

// ── Export de dados do dojô (round-trip com o import FPKT) ──────
/** Filtros do export — espelham os query params do endpoint. */
export interface ExportDojoParams {
  status?: "all" | "active" | "inactive";
  include_belts?: boolean;
  include_transfers?: boolean;
  belt?: string;
}

/** Academia (dojô) no payload de export. */
export interface ExportDojoInfo {
  id: string;
  cod: string | null;
  name: string | null;
  fpkt_affiliation_id: string | null;
  status: string | null;
  is_active?: boolean;
  cnpj: string | null;
  region: string | null;
  address: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  phone: string | null;
  email: string | null;
}

/** Aluno (praticante) no payload de export. */
export interface ExportPraticante {
  id: string;
  cod_aluno: string | null;
  numero_fpkt: string | null;
  nome: string | null;
  nascimento: string | null;
  cpf: string | null;
  rg: string | null;
  email: string | null;
  telefone: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  situacao: string | null;
  faixa_atual: string | null;
  faixa_level: string | null;
  academia_name: string | null;
}

/** Evento de faixa (trajetória) no payload de export. */
export interface ExportBeltEvent {
  practitioner_ref: string | null;
  practitioner_name: string | null;
  faixa: string | null;
  belt_level: string | null;
  data: string | null;
}

/** Transferência no payload de export. */
export interface ExportTransfer {
  practitioner_ref: string | null;
  practitioner_name: string | null;
  origem: string | null;
  destino: string | null;
  data: string | null;
}

export interface ExportDojoPayload {
  federation_id: string;
  generated_at: string;
  filters: { status: string; include_belts: boolean; include_transfers: boolean; belt: string | null };
  dojo: ExportDojoInfo;
  praticantes: ExportPraticante[];
  belt_events: ExportBeltEvent[];
  transfers: ExportTransfer[];
}

// Track P — busca rápida
export interface SearchDojoResult {
  id: string;
  name: string;
  fpkt_affiliation_id: string | null;
  region: string | null;
  practitioner_count: number;
  _type: "dojo";
}

export interface SearchPractitionerResult {
  id: string;
  full_name: string;
  karate_registration_number: string | null;
  dojo_name: string | null;
  belt_name: string | null;
  _type: "practitioner";
}

export interface SearchResult {
  q: string;
  dojos: SearchDojoResult[];
  practitioners: SearchPractitionerResult[];
}

// Track P — notificações
export interface NotificationItem {
  id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  detail: string | null;
  reference_type: string | null;
  reference_id: string | null;
  action_path?: string | null;
  created_at: string;
}

export interface NotificationsPayload {
  total: number;
  items: NotificationItem[];
}

// ─────────────────────────────────────────────────────────────────
// Fase 1 — Financial types (karate-fase1-openapi.yaml v0.2.0)
// ─────────────────────────────────────────────────────────────────

export type AnnuityStatus = "paid" | "due" | "overdue" | "defaulting" | "suspended";
export type SizeTier = "up_to_40" | "41_90" | "91_150" | "over_150";
export type ExpenseCategory =
  | "expense_cost"
  | "expense_repasse"
  | "expense_certificate"
  | "expense_award"
  | "expense_other";
// Lançamentos (Track B v2) — receitas + despesas num só extrato.
export type EntryKind = "income" | "expense";
export type IncomeCategory =
  | "income_event"
  | "income_sponsorship"
  | "income_donation"
  | "income_sale"
  | "income_other";
// Categoria de um lançamento (depende do kind).
export type EntryCategory = ExpenseCategory | IncomeCategory;
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

/** Campos editáveis de uma anuidade (dojô/CPF) — todos opcionais (PATCH). */
export interface AnnuityUpdateInput {
  amount?: number;
  due_date?: string;
  reference_period?: string;
  status?: AnnuityStatus;
  paid_at?: string | null;
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
  /** 'income' | 'expense' — default 'expense' p/ compat com respostas antigas. */
  kind?: EntryKind;
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

// ── Lançamentos (entradas + saídas) — /financial/expenses v2 ──────
/** Item do extrato unificado retornado por GET /financial/expenses. */
export interface FinancialEntry {
  id: string;
  kind: EntryKind;
  amount: number;
  category: EntryCategory;
  description: string;
  due_date: string | null;
  status: string;
  created_at: string;
}

/** Payload de criação de lançamento (POST /financial/expenses). */
export interface FinancialEntryInput {
  kind?: EntryKind;            // default 'expense' no backend
  amount: number;              // > 0
  category: EntryCategory;
  description: string;
  due_date?: string;           // YYYY-MM-DD (default hoje no backend)
}

/** Campos editáveis de um lançamento (PATCH /financial/expenses/:id). kind NÃO muda. */
export interface FinancialEntryUpdate {
  amount?: number;
  category?: EntryCategory;
  description?: string;
  due_date?: string;
}

export interface EntriesQuery {
  kind?: EntryKind;
  category?: EntryCategory;
  q?: string;
  from?: string;               // YYYY-MM-DD
  to?: string;                 // YYYY-MM-DD
  page?: number;
  pageSize?: number;
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

// ─────────────────────────────────────────────────────────────────
// Fase 2 — Exames + Graduações types (karate-fase2-openapi.yaml v0.2.0)
// ─────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────
// Track H — Configurações da Federação types
// ─────────────────────────────────────────────────────────────────

export type KarateRole = "federation_admin" | "federation_staff" | "federation_examiner";
export type RegimeTributario = "simples_nacional" | "lucro_presumido" | "imune_isenta";

export interface FederationMember {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  role: KarateRole;
  role_label: string;
  status: "ativo" | "pendente";
  is_pending: boolean;
}

export interface InviteMemberInput {
  email: string;
  role: KarateRole;
}

export interface InviteMemberResult extends FederationMember {
  invite_url: string;
}

export interface KarateFlags {
  competicoes: boolean;
  carteirinha: boolean;
  conexao: boolean;
  portal: boolean;
}

export interface FederationIdentity {
  name: string | null;
  slug: string | null;
  logo_url: string | null;
  wa_phone_display: string | null;
  secretary_email: string | null;
  cnpj: string | null;
  legal_name: string | null;
  inscricao_municipal: string | null;
  regime_tributario: RegimeTributario | null;
  regime_label: string | null;
  city: string | null;
  state: string | null;
}

export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM";

export interface FederationPayments {
  pix_key: string | null;
  pix_key_type: PixKeyType | null;
  pix_holder_name: string | null;
  pix_holder_city: string | null;
  configured: boolean;
}

export interface ReminderConfig {
  enabled: boolean;
  channel: "email" | "whatsapp";
  offsets_days: number[];
  updated_at?: string | null;
}

export interface ReminderLogItem {
  id: string;
  annuity_id: string | null;
  dojo_id: string | null;
  channel: string;
  recipient: string | null;
  rule_code: string | null;
  status: string;
  provider_id: string | null;
  error: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────
// Track J — Certificado como fluxo de pedido
// ─────────────────────────────────────────────────────────────────

/** Estados do pedido de certificado físico */
export type CertOrderStatus =
  | "pending"       // aguardando pagamento / confirmação
  | "paid"          // pago, aguardando produção
  | "producing"     // em produção / impressão
  | "dispatched"    // despachado para entrega
  | "delivered"     // entregue ao destinatário
  | "refused"       // recusado / devolvido
  | "cancelled";    // cancelado

/** Modalidade de entrega */
export type DeliveryType = "pickup" | "mail" | "dojo_batch";

/** Entrada no histórico de estado do pedido */
export interface CertOrderHistoryEntry {
  id: string;
  order_id: string;
  status: CertOrderStatus;
  note: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

/** Pedido de certificado físico — karate_cert_orders */
export interface CertOrder {
  id: string;
  federation_id: string;
  candidate_id: string;
  practitioner_id: string;
  full_name: string;
  belt_level: string;
  belt_name: string;
  exam_date: string;
  delivery_type: DeliveryType;
  delivery_address: string | null;
  dojo_id: string | null;
  dojo_name: string | null;
  status: CertOrderStatus;
  paid_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  tracking_code: string | null;
  notes: string | null;
  history: CertOrderHistoryEntry[];
  created_at: string;
  updated_at: string;
}

/** Payload para criar pedido de certificado */
export interface CreateCertOrderInput {
  candidate_id: string;
  delivery_type: DeliveryType;
  delivery_address?: string | null;
  dojo_id?: string | null;
  notes?: string | null;
}

/** Payload para avançar status de lote */
export interface BatchStatusInput {
  order_ids: string[];
  status: CertOrderStatus;
  note?: string | null;
  tracking_code?: string | null;
}

/** Resultado da operação em lote */
export interface BatchStatusResult {
  updated: number;
  skipped: number;
  errors: Array<{ order_id: string; reason: string }>;
}

// ─────────────────────────────────────────────────────────────────
// API calls — Fase 0 + 1 + 2 + Track H + Track J
// ─────────────────────────────────────────────────────────────────
export const karateApi = {
  // Dashboard
  getDashboard: (federationId: string): Promise<DashboardPayload> =>
    request(`/federation/${federationId}/dashboard`),

  getBeltDistribution: (federationId: string): Promise<BeltDistributionItem[]> =>
    request(`/federation/${federationId}/belt-distribution`),

  // Track P — busca rápida federation-wide
  search: (federationId: string, q: string): Promise<SearchResult> => {
    const qs = new URLSearchParams({ q });
    return request(`/federation/${federationId}/search?${qs.toString()}`);
  },

  // Track P — notificações
  getNotifications: (federationId: string, limit?: number): Promise<NotificationsPayload> => {
    const qs = new URLSearchParams();
    if (limit) qs.set("limit", String(limit));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/notifications${query}`);
  },

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

  /** Atualiza o dojô (envia o patch inteiro; aceita is_active / name / legal_name). */
  updateDojo: (
    federationId: string,
    dojoId: string,
    body: Partial<DojoInput> & { is_active?: boolean; legal_name?: string | null }
  ): Promise<Dojo> =>
    request(`/federation/${federationId}/dojos/${dojoId}`, { method: "PATCH", body }),

  /**
   * Exclui o dojô. Sem histórico → hard delete (204/JSON). Com histórico,
   * o backend responde 409 { code:'HAS_HISTORY', counts } e este método
   * rejeita com HasHistoryError (status:409, counts) para a tela decidir
   * entre Desativar (updateDojo is_active:false) e Excluir definitivamente.
   * `cascade:true` força a remoção em cascata do histórico.
   */
  deleteDojo: (
    federationId: string,
    dojoId: string,
    { cascade }: { cascade?: boolean } = {}
  ): Promise<{ deleted: boolean }> => {
    const query = cascade ? "?cascade=true" : "";
    return withHasHistory(
      request(`/federation/${federationId}/dojos/${dojoId}${query}`, { method: "DELETE" })
    );
  },

  /** Export de dados do dojô no formato do import (abas Academias/Alunos/Histórico). */
  exportDojoData: (
    federationId: string,
    dojoId: string,
    params?: ExportDojoParams
  ): Promise<ExportDojoPayload> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.include_belts !== undefined) qs.set("include_belts", String(params.include_belts));
    if (params?.include_transfers !== undefined) qs.set("include_transfers", String(params.include_transfers));
    if (params?.belt) qs.set("belt", params.belt);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/dojos/${dojoId}/export-data${query}`);
  },

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

  /** Atualiza a ficha do praticante (inclui is_active / status). */
  updatePractitioner: (
    federationId: string,
    practitionerId: string,
    body: Partial<PractitionerInput> & { is_active?: boolean }
  ): Promise<PractitionerDetail> =>
    request(`/federation/${federationId}/practitioners/${practitionerId}`, { method: "PATCH", body }),

  /** Registra uma graduação manual (faixa + data) no histórico do praticante. */
  addBeltGraduation: (
    federationId: string,
    practitionerId: string,
    body: GraduationInput
  ): Promise<BeltHistoryEntry> =>
    request(`/federation/${federationId}/practitioners/${practitionerId}/graduations`, { method: "POST", body }),

  /**
   * Exclui o praticante. Sem histórico → hard delete. Com histórico
   * (graduações, transferências, carteirinhas, ...), o backend responde
   * 409 { code:'HAS_HISTORY', counts } e este método rejeita com
   * HasHistoryError (status:409, counts) para a tela oferecer Desativar
   * (updatePractitioner is_active:false) em vez de excluir. `cascade:true`
   * remove o histórico em cascata.
   */
  deletePractitioner: (
    federationId: string,
    practitionerId: string,
    { cascade }: { cascade?: boolean } = {}
  ): Promise<{ deleted: boolean }> => {
    const query = cascade ? "?cascade=true" : "";
    return withHasHistory(
      request(`/federation/${federationId}/practitioners/${practitionerId}${query}`, { method: "DELETE" })
    );
  },

  /** Edita uma graduação do histórico (belt_level / belt_name / graduated_at). */
  updateGraduation: (
    federationId: string,
    practitionerId: string,
    graduationId: string,
    payload: Partial<GraduationInput>
  ): Promise<BeltHistoryEntry> =>
    request(`/federation/${federationId}/practitioners/${practitionerId}/graduations/${graduationId}`, {
      method: "PATCH",
      body: payload,
    }),

  /** Remove uma graduação do histórico do praticante. */
  deleteGraduation: (
    federationId: string,
    practitionerId: string,
    graduationId: string
  ): Promise<{ deleted: boolean }> =>
    request(`/federation/${federationId}/practitioners/${practitionerId}/graduations/${graduationId}`, {
      method: "DELETE",
    }),

  // ── Track N — Transferência de praticante entre dojôs ──────────
  listTransfers: (
    federationId: string,
    practitionerId: string
  ): Promise<Paginated<TransferRecord> | { data: TransferRecord[] }> =>
    request(`/federation/${federationId}/practitioners/${practitionerId}/transfers`),

  transferPractitioner: (
    federationId: string,
    practitionerId: string,
    body: TransferInput
  ): Promise<TransferRecord> =>
    request(`/federation/${federationId}/practitioners/${practitionerId}/transfer`, { method: "POST", body }),

  /** Edita uma transferência registrada (reason / transferred_at). */
  updateTransfer: (
    federationId: string,
    practitionerId: string,
    transferId: string,
    payload: Partial<Pick<TransferInput, "reason" | "transferred_at">>
  ): Promise<TransferRecord> =>
    request(`/federation/${federationId}/practitioners/${practitionerId}/transfers/${transferId}`, {
      method: "PATCH",
      body: payload,
    }),

  /** Remove uma transferência registrada do praticante. */
  deleteTransfer: (
    federationId: string,
    practitionerId: string,
    transferId: string
  ): Promise<{ deleted: boolean }> =>
    request(`/federation/${federationId}/practitioners/${practitionerId}/transfers/${transferId}`, {
      method: "DELETE",
    }),

  // ── Carteirinha ────────────────────────────────────────────────
  /** Revoga a carteirinha ativa do praticante. */
  revokeCard: (
    federationId: string,
    practitionerId: string
  ): Promise<{ revoked: boolean }> =>
    request(`/federation/${federationId}/practitioners/${practitionerId}/card/revoke`, {
      method: "POST",
      body: {},
    }),

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

  // ─────────────────────────────────────────────────────────────────
  // Fase 1 — Financial endpoints
  // ─────────────────────────────────────────────────────────────────

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

  /** Edita uma anuidade de dojô já lançada (valor, vencimento, período, status). */
  updateAnnuity: (
    federationId: string,
    dojoId: string,
    annuityId: string,
    payload: AnnuityUpdateInput
  ): Promise<DojoAnnuity> =>
    request(`/federation/${federationId}/financial/annuities/dojos/${dojoId}/${annuityId}`, {
      method: "PATCH",
      body: payload,
    }),

  /** Anula (estorna) uma anuidade de dojô já lançada. */
  voidAnnuity: (
    federationId: string,
    dojoId: string,
    annuityId: string
  ): Promise<DojoAnnuity> =>
    request(`/federation/${federationId}/financial/annuities/dojos/${dojoId}/${annuityId}/void`, {
      method: "POST",
      body: {},
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

  // ── Lançamentos (entradas + saídas) — extrato unificado v2 ──────
  /** Lista lançamentos (income + expense) com filtros opcionais. */
  listEntries: (
    federationId: string,
    filters?: EntriesQuery
  ): Promise<Paginated<FinancialEntry>> => {
    const qs = new URLSearchParams();
    if (filters?.kind) qs.set("kind", filters.kind);
    if (filters?.category) qs.set("category", filters.category);
    if (filters?.q) qs.set("q", filters.q);
    if (filters?.from) qs.set("from", filters.from);
    if (filters?.to) qs.set("to", filters.to);
    if (filters?.page) qs.set("page", String(filters.page));
    if (filters?.pageSize) qs.set("pageSize", String(filters.pageSize));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/financial/expenses${query}`);
  },

  /** Cria um lançamento (entrada ou saída). */
  createEntry: (federationId: string, body: FinancialEntryInput): Promise<FinancialEntry> =>
    request(`/federation/${federationId}/financial/expenses`, { method: "POST", body }),

  /** Edita um lançamento existente (kind não muda). */
  updateEntry: (
    federationId: string,
    entryId: string,
    body: FinancialEntryUpdate
  ): Promise<FinancialEntry> =>
    request(`/federation/${federationId}/financial/expenses/${entryId}`, { method: "PATCH", body }),

  /** Exclui um lançamento. */
  deleteEntry: (
    federationId: string,
    entryId: string
  ): Promise<{ deleted: boolean; id: string }> =>
    request(`/federation/${federationId}/financial/expenses/${entryId}`, { method: "DELETE" }),

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

  // ─────────────────────────────────────────────────────────────────
  // Fase 2 — Belt Exams
  // ─────────────────────────────────────────────────────────────────

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

  createBeltExam: (federationId: string, body: BeltExamInput): Promise<BeltExam> =>
    request(`/federation/${federationId}/belt-exams`, { method: "POST", body }),

  getBeltExam: (federationId: string, examId: string): Promise<BeltExam & { examiners: Examiner[]; candidates: ExamCandidate[] }> =>
    request(`/federation/${federationId}/belt-exams/${examId}`),

  updateBeltExam: (federationId: string, examId: string, body: Partial<BeltExamInput>): Promise<BeltExam> =>
    request(`/federation/${federationId}/belt-exams/${examId}`, { method: "PATCH", body }),

  listExaminers: (federationId: string, examId: string): Promise<Examiner[]> =>
    request(`/federation/${federationId}/belt-exams/${examId}/examiners`),

  addExaminer: (federationId: string, examId: string, body: ExaminerInput): Promise<Examiner> =>
    request(`/federation/${federationId}/belt-exams/${examId}/examiners`, { method: "POST", body }),

  enrollCandidate: (
    federationId: string,
    examId: string,
    body: EnrollCandidateInput
  ): Promise<ExamCandidate> =>
    request(`/federation/${federationId}/belt-exams/${examId}/candidates`, { method: "POST", body }),

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

  closeBeltExam: (federationId: string, examId: string): Promise<{ closed: true; approved_count: number }> =>
    request(`/federation/${federationId}/belt-exams/${examId}/close`, { method: "POST", body: {} }),

  checkEligibility: (
    federationId: string,
    practitionerId: string,
    targetBelt: string
  ): Promise<EligibilityResult> =>
    request(`/federation/${federationId}/practitioners/${practitionerId}/eligibility/${targetBelt}`),

  listBeltRequirements: (federationId: string): Promise<BeltRequirement[]> =>
    request(`/federation/${federationId}/belt-requirements`),

  updateBeltRequirements: (
    federationId: string,
    body: { requirements: Array<{ belt_level: string } & BeltRequirementInput> }
  ): Promise<BeltRequirement[]> =>
    request(`/federation/${federationId}/belt-requirements`, { method: "PUT", body }),

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

  createCourse: (federationId: string, body: CourseEventInput): Promise<CourseEvent> =>
    request(`/federation/${federationId}/courses`, { method: "POST", body }),

  enrollCourse: (
    federationId: string,
    eventId: string,
    body: CourseEnrollInput
  ): Promise<{ enrolled: true }> =>
    request(`/federation/${federationId}/courses/${eventId}/enroll`, { method: "POST", body }),

  issueCertificate: (
    federationId: string,
    candidateId: string
  ): Promise<Certificate> =>
    request(`/federation/${federationId}/certificates/${candidateId}/issue`, { method: "POST", body: {} }),

  getCertificate: (federationId: string, candidateId: string): Promise<Certificate> =>
    request(`/federation/${federationId}/certificates/${candidateId}`),

  // ─────────────────────────────────────────────────────────────────
  // Track H — Configurações da Federação
  // ─────────────────────────────────────────────────────────────────

  // Régua de cobrança (Track I)
  getReminderConfig: (federationId: string): Promise<{ config: ReminderConfig }> =>
    request(`/federation/${federationId}/reminder-config`),

  updateReminderConfig: (
    federationId: string,
    body: { enabled: boolean; channel?: "email" | "whatsapp"; offsets_days?: number[] }
  ): Promise<{ config: ReminderConfig }> =>
    request(`/federation/${federationId}/reminder-config`, { method: "PUT", body }),

  getReminderLog: (
    federationId: string,
    limit?: number
  ): Promise<{ items: ReminderLogItem[] }> => {
    const qs = new URLSearchParams();
    if (limit) qs.set("limit", String(limit));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/reminder-log${query}`);
  },

  runReminders: (
    federationId: string,
    body?: { today?: string }
  ): Promise<{ result: unknown }> =>
    request(`/federation/${federationId}/reminders/run`, { method: "POST", body: body ?? {} }),

  // Equipe FPKT
  listFederationMembers: (federationId: string): Promise<{ members: FederationMember[] }> =>
    request(`/federation/${federationId}/settings/members`),

  inviteFederationMember: (
    federationId: string,
    body: InviteMemberInput
  ): Promise<InviteMemberResult> =>
    request(`/federation/${federationId}/settings/members/invite`, { method: "POST", body }),

  updateFederationMemberRole: (
    federationId: string,
    memberId: string,
    role: KarateRole
  ): Promise<{ id: string; role: string; role_label: string }> =>
    request(`/federation/${federationId}/settings/members/${memberId}/role`, {
      method: "PATCH",
      body: { role },
    }),

  removeFederationMember: (
    federationId: string,
    memberId: string
  ): Promise<{ removed: boolean }> =>
    request(`/federation/${federationId}/settings/members/${memberId}`, { method: "DELETE" }),

  // Feature flags
  getFederationFlags: (federationId: string): Promise<{ flags: KarateFlags }> =>
    request(`/federation/${federationId}/settings/flags`),

  updateFederationFlags: (
    federationId: string,
    flags: Partial<KarateFlags>
  ): Promise<{ flags: KarateFlags }> =>
    request(`/federation/${federationId}/settings/flags`, { method: "PUT", body: { flags } }),

  // Identidade + Fiscal
  getFederationIdentity: (federationId: string): Promise<FederationIdentity> =>
    request(`/federation/${federationId}/settings/identity`),

  updateFederationIdentity: (
    federationId: string,
    body: Partial<FederationIdentity & { secretary_email?: string }>
  ): Promise<{ updated: boolean }> =>
    request(`/federation/${federationId}/settings/identity`, { method: "PUT", body }),

  // Recebimento — chave PIX da federação (anuidades de dojô / filiação)
  getFederationPayments: (federationId: string): Promise<FederationPayments> =>
    request(`/federation/${federationId}/settings/payments`),

  updateFederationPayments: (
    federationId: string,
    body: { pix_key: string; pix_key_type?: PixKeyType | null; pix_holder_name: string; pix_holder_city?: string | null }
  ): Promise<{ updated: boolean; configured: boolean }> =>
    request(`/federation/${federationId}/settings/payments`, { method: "PUT", body }),

  // ─────────────────────────────────────────────────────────────────
  // Track J — Pedidos de certificado físico
  // ─────────────────────────────────────────────────────────────────

  /** Cria pedido de certificado físico para um candidato aprovado. */
  createCertOrder: (
    federationId: string,
    body: CreateCertOrderInput
  ): Promise<CertOrder> =>
    request(`/federation/${federationId}/cert-orders`, { method: "POST", body }),

  /** Lista pedidos de certificado do praticante logado (portal praticante). */
  listMyCertOrders: (federationId: string): Promise<{ orders: CertOrder[] }> =>
    request(`/federation/${federationId}/cert-orders/mine`),

  /** Lista todos os pedidos de certificado da federação (visão admin). */
  listCertOrders: (
    federationId: string,
    params?: { status?: CertOrderStatus; page?: number; pageSize?: number }
  ): Promise<Paginated<CertOrder>> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/cert-orders${query}`);
  },

  /** Detalhe de um pedido de certificado. */
  getCertOrder: (federationId: string, orderId: string): Promise<CertOrder> =>
    request(`/federation/${federationId}/cert-orders/${orderId}`),

  /** Avança o estado de um pedido individual. */
  advanceCertOrderStatus: (
    federationId: string,
    orderId: string,
    body: { status: CertOrderStatus; note?: string | null; tracking_code?: string | null }
  ): Promise<CertOrder> =>
    request(`/federation/${federationId}/cert-orders/${orderId}/status`, {
      method: "PATCH",
      body,
    }),

  /** Avança o estado de múltiplos pedidos em lote. */
  batchCertOrderStatus: (
    federationId: string,
    body: BatchStatusInput
  ): Promise<BatchStatusResult> =>
    request(`/federation/${federationId}/cert-orders/batch-status`, { method: "POST", body }),

  /** Recusa / cancela um pedido de certificado. */
  refuseCertOrder: (
    federationId: string,
    orderId: string,
    body?: { note?: string | null }
  ): Promise<CertOrder> =>
    request(`/federation/${federationId}/cert-orders/${orderId}/refuse`, {
      method: "POST",
      body: body ?? {},
    }),
};

// ─────────────────────────────────────────────────────────────────
// karateSettingsApi — compat shim (Track H)
//
// configuracoes/index.tsx importa este objeto diretamente de karateApi.ts.
// As assinaturas diferem ligeiramente (ex: inviteMember recebe email+role
// como args separados em vez de objeto). Este shim adapta e delega.
// ─────────────────────────────────────────────────────────────────
export const karateSettingsApi = {
  /** Lista membros da equipe da federação. */
  listMembers: (federationId: string): Promise<{ members: FederationMember[] }> =>
    karateApi.listFederationMembers(federationId),

  /** Convida membro — assinatura (fedId, email, role) conforme configuracoes/index.tsx. */
  inviteMember: (
    federationId: string,
    email: string,
    role: KarateRole
  ): Promise<InviteMemberResult> =>
    karateApi.inviteFederationMember(federationId, { email, role }),

  /** Edita papel do membro. */
  updateMemberRole: (
    federationId: string,
    memberId: string,
    role: string
  ): Promise<{ id: string; role: string; role_label: string }> =>
    karateApi.updateFederationMemberRole(federationId, memberId, role as KarateRole),

  /** Remove ou suspende membro. */
  removeMember: (
    federationId: string,
    memberId: string
  ): Promise<{ removed: boolean }> =>
    karateApi.removeFederationMember(federationId, memberId),

  /** Lê feature flags. */
  getFlags: (
    federationId: string
  ): Promise<{ flags: KarateFlags }> =>
    karateApi.getFederationFlags(federationId),

  /** Salva feature flags. */
  updateFlags: (
    federationId: string,
    flags: Partial<KarateFlags>
  ): Promise<{ flags: KarateFlags }> =>
    karateApi.updateFederationFlags(federationId, flags),

  /** Lê identidade, contato e dados fiscais. */
  getIdentity: (
    federationId: string
  ): Promise<FederationIdentity> =>
    karateApi.getFederationIdentity(federationId),

  /** Salva identidade, contato e dados fiscais. */
  updateIdentity: (
    federationId: string,
    body: Partial<FederationIdentity>
  ): Promise<{ updated: boolean }> =>
    karateApi.updateFederationIdentity(federationId, body),

  /** Lê a chave PIX de recebimento da federação. */
  getPayments: (
    federationId: string
  ): Promise<FederationPayments> =>
    karateApi.getFederationPayments(federationId),

  /** Define/atualiza a chave PIX de recebimento. */
  updatePayments: (
    federationId: string,
    body: { pix_key: string; pix_key_type?: PixKeyType | null; pix_holder_name: string; pix_holder_city?: string | null }
  ): Promise<{ updated: boolean; configured: boolean }> =>
    karateApi.updateFederationPayments(federationId, body),
};
