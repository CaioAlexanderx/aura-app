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

export class HasHistoryError extends Error {
  readonly status = 409;
  readonly code   = "HAS_HISTORY";
  constructor(public readonly counts: Record<string, number>) {
    super("HAS_HISTORY");
    this.name = "HasHistoryError";
  }
}

/** Envolve uma promise e converte 409 HAS_HISTORY em HasHistoryError. */
async function withHasHistory<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e: any) {
    if (e instanceof ApiError && e.status === 409 && e.data?.code === "HAS_HISTORY") {
      throw new HasHistoryError(e.data.counts ?? {});
    }
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────────
// Tipos compartilhados
// ─────────────────────────────────────────────────────────────────
export type BeltSchema = "kyu" | "dan";
export type DojoStatus = "active" | "inactive";
export type AffiliationModel = "anual" | "semestral" | "trimestral";
export type AffiliationStatus = "active" | "inactive";
export type AnnuityStatus =
  | "pending"
  | "paid"
  | "due"
  | "overdue"
  | "defaulting"
  | "suspended"
  | "no_charge"
  | "cancelled";
export type OverdueTargetType = "dojo" | "cpf";
export type ReminderChannel = "email" | "whatsapp";

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardPayload {
  kpis: {
    total_practitioners: number;
    affiliated_dojos: number;
    open_exams: number;
    revenue_ytd: number;
  };
  belt_distribution: BeltDistributionItem[];
  recent_exams: BeltExam[];
  announcements?: string[];
}

export interface BeltDistributionItem {
  belt_level: string;
  belt_name: string;
  belt_schema: BeltSchema;
  count: number;
  pct: number;
}

// ── Praticante ─────────────────────────────────────────────────

export interface PractitionerListItem {
  id: string;
  full_name: string;
  karate_registration_number: string;
  dojo_id?: string;
  dojo_name: string;
  belt_name: string | null;
  affiliation_status: AffiliationStatus;
  // Papéis na federação (equipe técnica do dojô)
  is_arbiter?: boolean;
  is_instructor?: boolean;
  is_examiner?: boolean;
  is_assistant?: boolean;
}

export interface BeltHistoryEntry {
  id: string;
  belt_level: string;
  belt_name: string;
  belt_schema: BeltSchema;
  graduated_at: string;
  is_legacy: boolean;
  exam_id: string | null;
  notes?: string | null;
  cbkt_number?: string | null;
}

export interface CurrentBelt {
  belt_level: string;
  belt_name: string;
  current_since: string;
}

export interface GraduationInput {
  belt_level: string;
  belt_name?: string;
  belt_schema?: string;
  graduated_at: string; // YYYY-MM-DD
  notes?: string | null;
  cbkt_number?: string | null;
}

export interface TransferRecord {
  id: string;
  from_dojo_id: string | null;
  to_dojo_id: string;
  from_dojo_name: string | null;
  to_dojo_name: string;
  transferred_at: string;
  reason: string | null;
}

export interface TransferInput {
  to_dojo_id: string;
  transferred_at: string; // YYYY-MM-DD
  reason?: string | null;
}

export interface Practitioner {
  id: string;
  full_name: string;
  karate_registration_number: string;
  dojo_id: string;
  dojo_name: string;
  belt_level: string | null;
  belt_name: string | null;
  affiliation_status: AffiliationStatus;
  is_active: boolean;
  created_at: string;
  // Papéis na federação (equipe técnica do dojô)
  is_arbiter?: boolean;
  is_instructor?: boolean;
  is_examiner?: boolean;
  is_assistant?: boolean;
}

export interface PractitionerDetail extends Practitioner {
  cpf: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  rg: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  guardian_name: string | null;
  guardian_cpf: string | null;
  guardian_phone: string | null;
  guardian_relationship: string | null;
  address: string | null;
  graduated_at: string | null;
  affiliation_since: string | null;
  // F9: 'masculino' | 'feminino' | 'outro' ou null
  sex: string | null;
  belt_history: BeltHistoryEntry[];
  transfers: TransferRecord[];
  current_belt: CurrentBelt | null;
  // F5cd: último exame de faixa do praticante (para exibição na ficha).
  last_exam?: { date: string; belt_name: string | null; exam_name: string | null; event_date: string | null } | null;
  // F5cd: quantidade de cursos concluídos nos últimos 2 anos.
  course_count_2y?: number;
  // Mantido por compat — pode não existir no shape atual do backend.
  course_count_last_year?: number;
}

export interface PractitionerInput {
  full_name: string;
  dojo_id: string;
  cpf?: string | null;
  email?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  address?: string | null;
  karate_registration_number?: string | null;
  belt_level?: string | null;
  graduated_at?: string | null;
  affiliation_since?: string | null;
  // F9: 'masculino' | 'feminino' | 'outro' ou null
  sex?: string | null;
  // Papéis na federação (equipe técnica do dojô)
  is_arbiter?: boolean;
  is_instructor?: boolean;
  is_examiner?: boolean;
  is_assistant?: boolean;
}

// ── Dojô ───────────────────────────────────────────────────────

export interface Dojo {
  id: string;
  name: string;
  legal_name: string | null;
  slug: string | null;
  region: string | null;
  city: string | null;
  state: string | null;
  affiliation_model: AffiliationModel;
  affiliation_since: string | null;
  is_active: boolean;
  sensei_name: string | null;
  sensei_practitioner_id: string | null;
  practitioner_count: number;
  created_at: string;
  dojo_name?: string | null;
}

// Membro da equipe técnica do dojô (Sensei + corpo de auxiliares).
// `roles` vem do backend como chaves canônicas: instructor | arbiter | examiner | sensei | senpai | assistant.
export interface TechnicalTeamMember {
  practitioner_id: string;
  name: string;
  roles: string[];
  belt_level: string | null;
}

export interface DojoDetail extends Dojo {
  owner_id: string | null;
  phone: string | null;
  email: string | null;
  cnpj: string | null;
  address: string | null;
  practitioners: PractitionerListItem[];
  // Campos adicionais consumidos por app/karate/(federation)/dojos/[dojoId].tsx
  // (tipo historicamente incompleto — resto do shape segue implícito/any).
  technical_team: TechnicalTeamMember[];
}

export interface DojoInput {
  name: string;
  region?: string | null;
  city?: string | null;
  state?: string | null;
  affiliation_model: AffiliationModel;
  affiliation_since?: string | null;
  phone?: string | null;
  email?: string | null;
  cnpj?: string | null;
  address?: string | null;
}

export interface ExportDojoParams {
  status?: "active" | "all";
  include_belts?: boolean;
  include_transfers?: boolean;
  belt?: string;
}

export interface ExportDojoPayload {
  dojos: object[];
  practitioners: object[];
  belt_history?: object[];
  transfers?: object[];
}

// Linha da exportação em massa de dojôs (GET /federation/:id/dojos/export) —
// NÃO confundir com ExportDojoPayload (export de UM dojô, round-trip com o
// import em DojoExportModal). Mesmo padrão de exportAllPractitioners.
export interface DojoExportRow {
  nome: string | null;
  codigo_fpkt: string | null;
  status: string;
  regiao: string | null;
  modelo_filiacao: string | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  total_praticantes: number;
  praticantes_ativos: number;
}

// ── Fase 4: Roster do dojô (status + financeiro) ────────────────

export type MemberFinanceiroStatus = "nao_aplicavel" | "sem_cobranca" | "em_dia" | "atrasado";

export interface DojoMemberStanding {
  student_id: string;
  full_name: string;
  karate_registration_number: string | null;
  is_active: boolean;
  belt_level: string | null;
  belt_name: string | null;
  is_black_belt: boolean;
  financeiro: MemberFinanceiroStatus;
  valor_em_aberto: number | null;
}

/** Filtro de status do roster paginado (aba Todos / Ativos / Inativos). */
export type RosterStatusFilter = "all" | "active" | "inactive";

/**
 * Contagens do quadro INTEIRO do dojo — vêm agregadas do banco e NÃO dependem
 * da página/aba atual. É o que alimenta os KPIs do detalhe do dojô agora que a
 * lista não vem mais inteira para o cliente.
 */
export interface DojoRosterSummary {
  total: number;
  active: number;
  inactive: number;
  black_belt_total: number;
  black_belt_paid: number;
  black_belt_overdue: number;
}

/** Página do roster: Paginated<DojoMemberStanding> + summary do quadro inteiro. */
export interface DojoRosterPage extends Paginated<DojoMemberStanding> {
  summary: DojoRosterSummary;
}

// ── Cascata de inativação + validação de quadro (federação) ─────
//
// Fluxo:
//   1. Federação pode SOLICITAR atualização cadastral (request-roster-update)
//      a qualquer momento, independente de inativar o dojô — gera um link
//      público (token) para o dojô confirmar/atualizar o quadro. NÃO mexe
//      em is_active.
//   2. GET roster-validation devolve o estado dessa solicitação (pending/
//      validated/none) para o banner no topo do detalhe do dojô.
//   3. Ao inativar o dojô, a federação escolhe entre "Inativar todos os
//      praticantes" (PATCH is_active:false — a cascata do backend cuida do
//      resto) ou "Redistribuir" (POST redistribute — decide, praticante a
//      praticante, entre transferir para outro dojô ou inativar; o backend
//      aplica as decisões E inativa o dojô numa chamada só).

export type RosterValidationStatus = "none" | "pending" | "validated";

export interface RosterValidation {
  status: RosterValidationStatus;
  requested_at: string | null;
  validated_at: string | null;
  validated_by: string | null;
  url: string | null;
}

export interface RequestRosterUpdateResult {
  status: RosterValidationStatus;
  requested_at: string | null;
  token: string | null;
  url: string;
}

export type RedistributeAction = "transfer" | "inactivate";

export interface RedistributeDecision {
  student_id: string;
  action: RedistributeAction;
  /** Obrigatório quando action==='transfer'. */
  destination_dojo_id?: string | null;
}

export interface RedistributeDojoInput {
  decisions: RedistributeDecision[];
  inactivate_dojo: boolean;
}

export interface RedistributeDojoResult {
  transferred?: number;
  inactivated?: number;
  dojo_inactivated?: boolean;
  [key: string]: unknown;
}

// ── Importação CSV / FPKT ──────────────────────────────────────

export interface ImportResult {
  preview?: boolean;
  dojos_found?: number;
  practitioners_found?: number;
  errors?: string[];
  imported?: { dojos: number; practitioners: number };
}

// ── Busca / Notificações (Track P) ─────────────────────────────

export interface SearchResultItem {
  type: "dojo" | "practitioner" | "exam";
  id: string;
  label: string;
  sub?: string;
}

export interface SearchResult {
  items: SearchResultItem[];
  total: number;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
}

export interface NotificationsPayload {
  items: NotificationItem[];
  unread_count: number;
}

// ── Financeiro (Fase 1) ─────────────────────────────────────────

export interface FinancialOverview {
  revenue_ytd: number;
  pending_annuities: number;
  overdue_count: number;
  recent_payments: PaymentSummary[];
}

export interface PaymentSummary {
  id: string;
  amount: number;
  paid_at: string;
  description: string;
}

export interface AnnualFee {
  id: string;
  affiliation_model: AffiliationModel;
  amount: number;
  effective_from: string;
}

export interface AnnualFeeInput {
  affiliation_model: AffiliationModel;
  amount: number;
}

export interface DojoAnnuity {
  dojo_id: string;
  dojo_name: string;
  // Campos abaixo refletem o shape real de GET /financial/annuities/dojos e do
  // POST .../charge (ver karateAnnuities.js) — a interface antiga (id/payment_method/
  // nfse_ref/created_at) não batia com a resposta real da API.
  fpkt_affiliation_id?: string | null;
  whatsapp?: string | null;
  reference_period: string;
  amount: number;
  due_date: string;
  paid_at: string | null;
  status: AnnuityStatus;
  days_overdue?: number;
  nfse_id?: string | null;
  // annuity_id / annuity_history_id (aliases idênticos — mesmo registro de
  // karate_dojo_annuity_history) e transaction_id: desde o PR #353 do
  // aura-backend o GET de listagem já devolve os três por linha (antes só
  // vinham na resposta do POST .../charge, o que deixava "Cobrar PIX" e
  // "Editar" mortos na aba Anuidades — os ids nunca chegavam à UI).
  annuity_id?: string | null;
  annuity_history_id?: string | null;
  transaction_id?: string | null;
  // Fase F2 (aditivo) — só populados quando a migration 222 (parcelas) já
  // foi aplicada no ambiente (HAS_INSTALLMENTS em karateAnnuities.js).
  // `amount`/`due_date`/`status` acima continuam vindo do rollup do header
  // (sincronizado com as parcelas); `total`/`paid_total` são a soma real
  // das parcelas (podem diferir de `amount` só em casos de correção manual).
  plan?: AnnuityPlan | null;
  installments?: AnnuityInstallment[];
  paid_total?: number;
  total?: number;
}

export interface CpfAnnuity {
  id: string;
  practitioner_id: string;
  full_name: string;
  karate_registration_number?: string | null;
  whatsapp?: string | null;
  reference_period: string;
  amount: number;
  due_date: string;
  paid_at: string | null;
  status: AnnuityStatus;
  created_at?: string;
  // transaction_id: GET /financial/annuities/cpf devolve isso por linha
  // (ver karateAnnuities.js) — necessário para POST .../cpf/{id}/pix
  // (createCpfPixIntent). Antes vivia num type local CpfAnnuityWithTx em
  // CpfAnnuitiesTab.tsx; promovido aqui conforme o próprio comentário
  // daquele workaround já previa.
  transaction_id?: string | null;
  // Fase F2 (aditivo) — ver mesmo comentário em DojoAnnuity.
  plan?: AnnuityPlan | null;
  installments?: AnnuityInstallment[];
  paid_total?: number;
  total?: number;
}

// ─────────────────────────────────────────────────────────────────
// Fase F2 — Hub de Anuidades (parcelas, planos, KPIs agregados)
//
// Wired against PR #354 (Fase F1 — modelo de parcelas) e #355 (Fase F2 —
// KPIs do hub + paginação real + vigência por plano) do aura-backend.
// Campos aditivos: só existem quando a migration 222 já foi aplicada no
// ambiente (HAS_INSTALLMENTS em karateAnnuities.js) — por isso os campos
// novos em DojoAnnuity/CpfAnnuity acima são todos opcionais; o backend cai
// pro shape legado (single-row, sem installments) em deployment parcial.
// ─────────────────────────────────────────────────────────────────

/** Plano de anuidade — dojô usa os 3; praticante (cpf) só usa 'anual' (N=1). */
export type AnnuityPlan = "anual" | "semestral" | "trimestral";

/** Uma parcela de anuidade (karate_annuity_installments). status persistido é
 *  SÓ 'pending'|'paid' — "vencida"/"a vencer"/"futura" são rótulos derivados
 *  no cliente a partir de due_date, nunca persistidos. */
export interface AnnuityInstallment {
  id: string;
  seq: number;
  amount: number;
  due_date: string | null;
  paid_at: string | null;
  status: "pending" | "paid";
  transaction_id: string | null;
}

/** Alias de status aceitos pelo filtro `status` de /annuities/dojos e /cpf,
 *  além do vocabulário de AnnuityStatus — espelham os buckets do summary
 *  (STATUS_ALIASES em karateAnnuities.js): em_aberto = tudo não pago;
 *  atrasado = não pago E já vencido. */
export type AnnuityStatusFilter = AnnuityStatus | "em_aberto" | "atrasado" | "all";

export interface AnnuitySummaryBucket {
  valor: number;
  count: number;
}
export interface AnnuitySummarySegment {
  previsto: AnnuitySummaryBucket;
  recebido: AnnuitySummaryBucket;
  em_aberto: AnnuitySummaryBucket;
  atrasado: AnnuitySummaryBucket;
}
/** GET /financial/annuities/summary — os 4 KPIs do hub, JÁ agregados no
 *  banco (NUNCA somar no cliente — ver karateAnnuitySummary.js). */
export interface AnnuitySummaryResponse {
  year: string;
  total: AnnuitySummarySegment;
  dojo: AnnuitySummarySegment;
  praticante: AnnuitySummarySegment;
}

/** Tabela de anuidades por PLANO (Fase F2) — karate_annual_fees com
 *  plan/due_months (migration 222). Coexiste com o shape legado por
 *  size_tier (AnnualFee/AnnualFeeInput acima, usados pela vigência antiga). */
export interface AnnuityFeePlan {
  id: string;
  fee_type: "dojo" | "cpf";
  size_tier: string | null;
  plan: AnnuityPlan | null;
  amount: number;
  due_months: number[] | null;
  effective_from: string;
}

/** Body de PUT /financial/fees no formato NOVO (plan-based). Vigência
 *  append-only: NUNCA altera parcelas já geradas — só a próxima geração
 *  (próximo /charge ou próxima temporada) usa o valor novo. */
export interface AnnuityFeePlanInput {
  fee_type: "dojo" | "cpf";
  plan: AnnuityPlan;
  amount: number;
  due_months: number[];
  /** Opcional — default hoje no backend. */
  effective_from?: string;
}

/** Body de POST .../installments/:id/pay (baixa manual de UMA parcela). */
export interface InstallmentPayInput {
  paid_at?: string; // 'YYYY-MM-DD', default hoje no backend
  payment_method?: "pix" | "dinheiro" | "transferencia" | "outro";
  amount?: number;
}

/** Resposta de POST .../installments/:id/pay. */
export interface InstallmentPayResult {
  installment_id: string;
  annuity_id: string;
  seq: number;
  amount: number;
  paid_at: string;
  payment_method: string | null;
  status: "paid";
  transaction_id: string | null;
  annuity_status?: string | null;
  idempotent_hit: boolean;
}

/** Body de PATCH .../installments/:id — corrige amount/due_date de UMA
 *  parcela NÃO paga (409 se já paga). */
export type InstallmentUpdateInput = Partial<{
  amount: number;
  due_date: string;
}>;

export interface InstallmentUpdateResult {
  installment_id: string;
  annuity_id: string;
  seq: number;
  amount: number;
  due_date: string | null;
  status: string;
  transaction_id: string | null;
  annuity_amount: number | null;
  annuity_due_date: string | null;
}

/** Resposta de PATCH .../:annuityId/plan (troca de plano — só dojô; praticante
 *  só tem 'anual' e recebe 422 VALIDATION_ERROR se tentado). */
export interface AnnuityPlanChangeResult {
  annuity_id: string;
  dojo_id: string;
  plan: AnnuityPlan;
  amount: number;
  due_date: string | null;
  installments: AnnuityInstallment[];
  paid_total: number;
  total: number;
}

/** Resposta de POST /annuities/:annuityId/void — void GENÉRICO (funciona
 *  para dojô OU praticante, só o annuityId; diferente do voidAnnuity()
 *  legado, que exige dojoId no path e só cobre dojô). */
export interface VoidAnnuityGenericResult {
  voided: boolean;
  idempotent_hit: boolean;
  annuity_id: string;
  dojo_id?: string | null;
  practitioner_id?: string | null;
  reference_period?: string;
  transaction_ids?: string[];
}

// ─────────────────────────────────────────────────────────────────
// Fase F3 — Campanha anual de anuidades + cobrança em lote
// (POST /financial/annuities/campaign/preview | /campaign | /batch —
// ver src/routes/karateAnnuityCampaign.js no backend, PR #356.)
//
// Elegibilidade (replicada aqui só como documentação — a fonte real é o
// backend): dojô = ativo E sem anuidade lançada na temporada; praticante =
// ATIVO **E** faixa-preta **E** sem anuidade lançada na temporada. A UI
// nunca decide elegibilidade sozinha — sempre reflete o preview/resultado
// que o backend devolveu.
// ─────────────────────────────────────────────────────────────────
export type AnnuityCampaignScope = "dojos" | "practitioners" | "both";

/** Um alvo de dojô no preview — `due_date`/`due_date_ajustada` já refletem
 *  o vencimento que `/campaign` VAI usar (default seguro ou override). */
export interface AnnuityCampaignPreviewDojo {
  dojo_id: string;
  name: string;
  plan_default: AnnuityPlan;
  amount: number;
  due_date: string | null;
  due_date_ajustada: boolean;
}

export interface AnnuityCampaignPreviewPractitioner {
  practitioner_id: string;
  name: string;
  karate_registration_number: string | null;
  amount: number;
  due_date: string | null;
  due_date_ajustada: boolean;
}

export interface AnnuityCampaignPreviewResponse {
  dojos: AnnuityCampaignPreviewDojo[];
  practitioners: AnnuityCampaignPreviewPractitioner[];
  totals: {
    dojos_count: number;
    practitioners_count: number;
    valor_previsto: number;
  };
}

export type AnnuityCampaignTargetType = "dojo" | "practitioner";

export interface AnnuityCampaignCreated {
  type: AnnuityCampaignTargetType;
  id: string;
  name: string;
  annuity_id: string;
  plan: AnnuityPlan;
  installments_count: number;
  due_date: string | null;
  due_date_ajustada: boolean;
  total: number;
}

export interface AnnuityCampaignSkipped {
  type: AnnuityCampaignTargetType;
  id: string;
  name: string;
  /** Quase sempre 'already_has_annuity_this_season' — reexecução idempotente. */
  reason: string;
}

export interface AnnuityCampaignError {
  type: AnnuityCampaignTargetType;
  id: string;
  name: string | null;
  reason: string;
}

/** Resposta comum de POST /campaign e POST /batch — nunca all-or-nothing:
 *  um alvo que falha vai para `errors[]`, os demais continuam. */
export interface AnnuityCampaignResult {
  created: AnnuityCampaignCreated[];
  skipped: AnnuityCampaignSkipped[];
  errors: AnnuityCampaignError[];
}

export interface AnnuityBatchTarget {
  type: AnnuityCampaignTargetType;
  id: string;
}

// ── Fase F4 — e-mail de cobrança (envio manual + lote) e remoção de
//    cobrança em lote. Espelha o shape real de karateAnnuityBilling.js
//    (aura-backend PR #359) — nunca all-or-nothing, sempre listas.
export interface AnnuitySendEmailResult {
  sent: true;
  installment_id: string;
  annuity_id: string;
  recipient: string;
  provider_id: string | null;
}

export interface AnnuityEmailBatchSent {
  installment_id: string;
  name: string;
  recipient: string;
  provider_id: string | null;
}
/** reason: 'sem_email' (sem e-mail cadastrado — estado normal, não é erro)
 *  ou 'parcela_ja_paga'. */
export interface AnnuityEmailBatchSkipped {
  installment_id: string;
  name: string;
  reason: "sem_email" | "parcela_ja_paga" | string;
}
export interface AnnuityEmailBatchError {
  installment_id: string;
  name?: string;
  reason: string;
}
export interface AnnuityEmailBatchResult {
  sent: AnnuityEmailBatchSent[];
  skipped: AnnuityEmailBatchSkipped[];
  errors: AnnuityEmailBatchError[];
}

export interface AnnuityVoidBatchRemoved {
  annuity_id: string;
  dojo_id: string | null;
  practitioner_id: string | null;
  reference_period: string;
  transaction_ids: unknown;
}
/** reason: 'has_paid_installment' | 'has_nfse' | 'not_found'. */
export interface AnnuityVoidBatchSkipped {
  annuity_id: string;
  reason: "has_paid_installment" | "has_nfse" | "not_found" | string;
}
export interface AnnuityVoidBatchError {
  annuity_id: string;
  reason: string;
}
export interface AnnuityVoidBatchResult {
  removed: AnnuityVoidBatchRemoved[];
  skipped: AnnuityVoidBatchSkipped[];
  errors: AnnuityVoidBatchError[];
}

export type AnnuityUpdateInput = Partial<{
  amount: number;
  due_date: string;
  reference_period: string;
  status: AnnuityStatus;
}>;

// Resposta real de POST .../dojos/:dojoId/:annuityId/void (karateAnnuities.js).
// NÃO retorna a anuidade — o lançamento é apagado (ver comentário da rota).
export interface VoidAnnuityResult {
  voided: boolean;
  idempotent_hit: boolean;
  annuity_id: string;
  dojo_id?: string;
  reference_period?: string;
  transaction_id?: string | null;
  transaction_cancelled?: boolean;
}

export interface ChargeInput {
  reference_period: string;
  amount: number;
  due_date: string;
  payment_method?: string;
}

// Body real de POST .../dojos/{dojoId}/pix (karateAnnuities.js) — cria PIX
// intent para uma cobrança JÁ lançada. O backend deriva valor/descrição da
// linha de karate_dojo_annuity_history; não recebe reference_period/amount.
export interface DojoPixInput {
  annuity_history_id: string;
}

// Body real de POST .../cpf/{practitionerId}/pix — idem, mas a cobrança CPF
// não tem tabela de histórico própria; o intent referencia a transaction.
export interface CpfPixInput {
  transaction_id: string;
}

// Shape real da resposta de POST .../pix e do item retornado por
// createDojoPixIntent/createCpfPixIntent (karateAnnuities.js). NÃO tem
// `id`/`qr_code`/`amount` — é `intent_id`/`payload`/`qr_image`, consumidos
// assim em PixPaymentModal.tsx (intent.intent_id, intent.payload, intent.qr_image).
export interface PixIntent {
  intent_id: string;
  payment_intent_id?: string;
  /** Copia-e-cola PIX (BR Code). */
  payload: string;
  /** Base64/data URL do QR, quando o provider devolve imagem pronta. */
  qr_image?: string | null;
  status: "pending" | "paid" | "expired";
  expires_at: string;
  provider?: string;
}

export interface PixStatusResponse {
  status: "pending" | "paid" | "expired" | "cancelled";
  paid_at?: string;
}

export interface PaymentResult {
  confirmed: boolean;
  annuity_id?: string;
  nfse_ref?: string;
  paid_at?: string;
}

export interface OverdueItem {
  id: string;
  target_type: OverdueTargetType;
  name: string;
  amount: number;
  due_date: string;
  days_overdue: number;
}

// ─────────────────────────────────────────────────────────────────
// Fase 5 — Financeiro: valores em aberto segmentados
//
// GET /federation/:id/financial/open-items
// Duas correntes de cobrança distintas (pretas CPF x dojôs), retornadas
// SEGMENTADAS — nunca somadas num único número.
// ─────────────────────────────────────────────────────────────────
export interface OpenItemPreta {
  student_id: string;
  full_name: string;
  karate_registration_number: string;
  whatsapp: string | null;
  dojo_id: string | null;
  dojo_nome: string | null;
  valor_em_aberto: number;
  annuity_due_date: string | null;
}

export interface OpenItemDojo {
  dojo_id: string;
  nome: string;
}

export interface OpenItemsResponse {
  pretas: { count: number; total: number; items: OpenItemPreta[] };
  dojos: { count: number; items: OpenItemDojo[] };
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string | null;
  notes: string | null;
}

export interface ExpenseInput {
  description: string;
  amount: number;
  date: string;
  category?: string | null;
  notes?: string | null;
}

// Lançamentos (Track B v2) — receitas + despesas num só extrato.
export type EntryKind = "income" | "expense";
export type ExpenseCategory =
  | "expense_cost"
  | "expense_repasse"
  | "expense_certificate"
  | "expense_award"
  | "expense_other";
export type IncomeCategory =
  | "income_event"
  | "income_sponsorship"
  | "income_donation"
  | "income_sale"
  | "income_other";
// Categoria de um lançamento (depende do kind).
export type EntryCategory = ExpenseCategory | IncomeCategory;

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
  id: string;
  annuity_id: string;
  nfse_number: string | null;
  status: string;
  issued_at: string | null;
  pdf_url: string | null;
}

// ── Exames (Fase 2) ─────────────────────────────────────────────

export type ExamStatus = "draft" | "open" | "done" | "closed" | "cancelled";
export type CandidateResult = "pending" | "approved" | "rejected";
export type CertificateStatus = "pending" | "generated" | "sent" | "error";
export type CourseType = "seminar" | "technical" | "referee" | "other";

// Bloco A — formulário de inscrição configurável por evento (migration 200).
export type RegistrationFieldType = "text" | "number" | "select" | "checkbox" | "date" | "phone";

export interface RegistrationField {
  key: string;
  label: string;
  type: RegistrationFieldType;
  required: boolean;
  options?: string[];
}

/** Exame de faixa — karate_belt_exams */
export interface BeltExam {
  id: string;
  federation_id: string;
  title: string;
  exam_date: string;          // ISO date
  location: string;
  target_belt: string;        // belt_level key (null/empty for curso)
  exam_type?: string;         // 'exame' | 'curso' — backend v2; ausente = exame
  status: ExamStatus;
  candidate_count: number;
  created_at: string;
  /** Bloco A — campos extras do formulário de inscrição pública (migration 200). */
  registration_fields?: RegistrationField[];
  /** Descrição/regras do evento (migration 203) — editável e exibida no portal. */
  description?: string | null;
}

export interface BeltExamInput {
  title: string;
  exam_date: string;
  location: string;
  target_belt: string;
  notes?: string | null;
  description?: string | null;
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
  /** Bloco A — respostas do inscrito aos registration_fields do evento (migration 200). */
  registration_responses?: Record<string, unknown>;
  /**
   * Bloco C — elegibilidade a certificado (migration 202), calculada no
   * fechamento do evento (POST /belt-exams/:examId/close): curso -> todos;
   * exame/graus -> apenas aprovados. false até o evento fechar.
   */
  certificate_eligible?: boolean;
}

export interface EnrollCandidateInput {
  practitioner_id: string;
  target_belt: string;
}

/** Inscrição em curso/evento sem faixa alvo (student_id = practitioner_id). */
export interface AddExamCandidateInput {
  student_id: string;
  target_belt?: string;
}

export interface UpdateCandidateResultInput {
  result: "approved" | "rejected";
  notes?: string | null;
}

/**
 * Resultado do ajuste de matrícula ao aprovar uma graduação de faixa-preta.
 * - "updated":       o sufixo do Dan foi trocado automaticamente (2º–6º Dan).
 * - "notify_create": Shodan (1º Dan) — a federação precisa criar a matrícula NNN-Y-SHO.
 * - "review":        7º Dan+ ou formato inesperado — revisar a matrícula manualmente.
 */
export interface CandidateRegistrationOutcome {
  action: "updated" | "notify_create" | "review";
  dan?: number | null;
  from?: string | null;
  to?: string | null;
  message?: string | null;
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
  // Fase F4 — texto livre editável pela federação (assunto/mensagem da
  // régua e do envio manual). null = usa o default hardcoded do backend
  // (karateReminderTemplate.js) — nunca string vazia (PUT normaliza
  // "" -> null). Variáveis aceitas: ver KARATE_REMINDER_VARS abaixo.
  subject_template?: string | null;
  body_template?: string | null;
  updated_at?: string | null;
}

// Fase F4 — variáveis aceitas em subject_template/body_template (espelha
// KNOWN_VARS de karateReminderTemplate.js no backend). Usado pelos chips
// do editor e pelo render de pré-visualização client-side (dados de
// exemplo — nunca chama o backend pra montar a prévia).
export const KARATE_REMINDER_VARS = ["nome", "competencia", "valor", "vencimento", "planos", "pix_copia_cola"] as const;
export type KarateReminderVar = typeof KARATE_REMINDER_VARS[number];

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
// P6 — Upload de foto do praticante
// ─────────────────────────────────────────────────────────────────

export interface UploadPhotoInput {
  /** Base64 puro, sem prefixo "data:<type>;base64,". */
  content: string;
  content_type?: "image/jpeg" | "image/png" | "image/webp";
}

export interface UploadPhotoResult {
  photo_url: string;
}

// ─────────────────────────────────────────────────────────────────
// Fase 2 — Anexos/Documentos (dojô e praticante)
// ─────────────────────────────────────────────────────────────────

export type DocumentOwnerType = "dojos" | "practitioners";

export interface KarateDocument {
  id: string;
  filename: string;
  content_type: string | null;
  size_bytes: number;
  note: string | null;
  created_at: string;
  download_url: string;
  /** true quando o R2 não está configurado (armazenamento simulado/temporário). */
  storage_mock?: boolean;
}

export interface UploadDocumentInput {
  /** Base64 puro, sem prefixo "data:<type>;base64,". */
  content: string;
  filename: string;
  content_type?: string;
  note?: string;
}

export interface DocumentDownloadResult {
  url: string;
  expires_in?: number;
  filename?: string;
  content_type?: string;
}

// ─────────────────────────────────────────────────────────────────
// API calls — Fase 0 + 1 + 2 + Track H + Track J
// ─────────────────────────────────────────────────────────────────
export interface SenseiEvent {
  id: string;
  name: string;
  exam_type: string;        // 'exame' | 'curso'
  event_date: string | null;
  location: string | null;
  fee_amount: number | null;
  status: ExamStatus;
}
export interface SenseiEventsResponse {
  events: SenseiEvent[];
  count: number;
  federation: { name: string | null; email: string | null; phone: string | null } | null;
}

export interface SenseiPractitioner {
  practitioner_id: string;
  name: string;
  is_active: boolean;
  belt_level: string | null;
  belt_name: string | null;
}
export interface SenseiPractitionersResponse {
  practitioners: SenseiPractitioner[];
  count: number;
}

export interface SenseiAnnuity {
  annuity_history_id: string;
  reference_period: string;
  amount: number | null;
  status: string;
  paid_at?: string | null;
  due_date: string | null;
}
export interface SenseiAnnuityResponse {
  pending: SenseiAnnuity | null;
  history: SenseiAnnuity[];
  pix: { key: string; key_type: string | null; holder_name: string | null } | null;
}

// ── Fase 6 — Painel + Saúde da rede: resumo de "standing" ──────────────
// Deriva das views karate_member_standing / karate_dojo_standing.
// financeiro de pretas ∈ {nao_aplicavel, sem_cobranca, em_dia, atrasado}
// (só se aplica a faixa-preta); financeiro de dojôs ∈ {em_dia, atrasado, inativo}.
export interface StandingSummary {
  praticantes: { ativos: number; inativos: number; total: number };
  pretas: { total: number; em_dia: number; atrasado: number; valor_em_aberto: number };
  dojos: { ativos: number; em_dia: number; atrasado: number; inativos: number };
}

export const karateApi = {
  // Dashboard
  getDashboard: (federationId: string): Promise<DashboardPayload> =>
    request(`/federation/${federationId}/dashboard`),

  /** GET /federation/:federationId/standing/summary — KPIs de standing (Fase 6) */
  getStandingSummary: (federationId: string): Promise<StandingSummary> =>
    request(`/federation/${federationId}/standing/summary`),

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

  /**
   * Exporta dojôs da federação (para .xlsx no FE) — MESMO padrão de
   * exportAllPractitioners: aceita os mesmos filtros opcionais que a
   * listagem (GET /federation/:id/dojos aceita): status, region,
   * affiliation_model, q. Sem filtros → exporta todos os dojôs da
   * federação. O botão "Exportar" da tela de Dojôs manda os filtros
   * ativos na tela (status e região), para o .xlsx bater exatamente com
   * o que está listado.
   */
  exportDojos: (
    federationId: string,
    filters?: { status?: string; region?: string; affiliation_model?: string; q?: string }
  ): Promise<{ total: number; dojos: DojoExportRow[] }> => {
    const qs = new URLSearchParams();
    if (filters?.status) qs.set("status", filters.status);
    if (filters?.region) qs.set("region", filters.region);
    if (filters?.affiliation_model) qs.set("affiliation_model", filters.affiliation_model);
    if (filters?.q) qs.set("q", filters.q);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/dojos/export${query}`, { method: "GET" });
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
   * entre Desativar (updateDojo is_active:false) e Excluir definitivamente
   * (cascade). `cascade:true` força a remoção em cascata do histórico.
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

  /**
   * Solicita atualização cadastral ao dojô — gera/renova um token público e
   * marca a validação do quadro como pendente. NÃO mexe em is_active (é
   * independente da cascata de inativação). A tela mostra o link retornado
   * com botão "Copiar link" (nunca envio automático de mensagem).
   */
  requestRosterUpdate: (
    federationId: string,
    dojoId: string
  ): Promise<RequestRosterUpdateResult> =>
    request(`/federation/${federationId}/dojos/${dojoId}/request-roster-update`, { method: "POST" }),

  /** Estado atual da validação do quadro (para o banner no topo do detalhe do dojô). */
  getRosterValidation: (
    federationId: string,
    dojoId: string
  ): Promise<RosterValidation> =>
    request(`/federation/${federationId}/dojos/${dojoId}/roster-validation`),

  /**
   * Redistribui os praticantes do dojô (transferir para outro dojô destino
   * ou inativar, decisão por decisão) e inativa o dojô numa chamada só —
   * usado pelo fluxo "Redistribuir praticantes" ao inativar o dojô, como
   * alternativa a "Inativar todos" (PATCH is_active:false simples).
   */
  redistributeDojo: (
    federationId: string,
    dojoId: string,
    body: RedistributeDojoInput
  ): Promise<RedistributeDojoResult> =>
    // Mutação — nunca fazer retry (risco de reaplicar transferência/inativação).
    // Dojôs grandes (ex.: 667 praticantes) ainda levam alguns segundos mesmo
    // com o backend em lote; timeout maior para dar folga (ver RequestOpts
    // em services/api.ts — há precedentes com timeout: 60000).
    request(`/federation/${federationId}/dojos/${dojoId}/redistribute`, {
      method: "POST", body, timeout: 60000, retry: 0,
    }),

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

  /**
   * Fase 4 — roster do dojô: praticantes com status (is_active) + financeiro
   * (só faixa-preta). PAGINADO NO SERVIDOR (11/07/2026): dojôs grandes (~400
   * praticantes) baixavam o quadro inteiro só para renderizar a seção.
   * Devolve { data, total, page, pageSize, summary } — summary traz as
   * contagens do quadro inteiro, independentes da página/aba.
   */
  getDojoMembersStanding: (
    federationId: string,
    dojoId: string,
    params?: { status?: RosterStatusFilter; page?: number; pageSize?: number; q?: string }
  ): Promise<DojoRosterPage> => {
    const qs = new URLSearchParams();
    if (params?.status && params.status !== "all") qs.set("status", params.status);
    qs.set("page", String(params?.page ?? 1));
    qs.set("pageSize", String(params?.pageSize ?? 50));
    if (params?.q) qs.set("q", params.q);
    return request<DojoRosterPage>(
      `/federation/${federationId}/dojos/${dojoId}/members-standing?${qs.toString()}`
    );
  },

  /**
   * Roster COMPLETO (sem LIMIT) — usado só onde a lista inteira é requisito,
   * hoje o modal de Redistribuição (precisa de todos os praticantes ativos
   * para decidir um a um). Não usar para renderizar a seção Praticantes.
   */
  getDojoMembersStandingAll: (
    federationId: string,
    dojoId: string,
    status: RosterStatusFilter = "all"
  ): Promise<DojoMemberStanding[]> => {
    const qs = new URLSearchParams({ all: "1" });
    if (status !== "all") qs.set("status", status);
    return request<{ data: DojoMemberStanding[] }>(
      `/federation/${federationId}/dojos/${dojoId}/members-standing?${qs.toString()}`
    ).then((res) => res.data || []);
  },

  // Praticantes
  listPractitioners: (
    federationId: string,
    params?: { dojo_id?: string; belt_level?: string; affiliation_status?: AffiliationStatus | "pending"; role?: string; q?: string; page?: number; pageSize?: number }
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

  /**
   * Exporta praticantes da federação (para .xlsx no FE).
   *
   * 11/07/2026: fix bug de produção — a tela de Praticantes chamava esta
   * função sem filtros, então o export SEMPRE baixava a federação inteira
   * (~9.600 praticantes) mesmo quando a lista na tela estava filtrada por
   * dojô (CTA "Ver praticantes" do detalhe do dojô, ?dojo_id=X). Agora
   * aceita os mesmos filtros opcionais que a listagem (GET /federation/:id/
   * practitioners aceita): dojo_id, status/affiliation_status, belt_level, q.
   * Sem filtros → comportamento antigo preservado (exporta todos).
   */
  exportAllPractitioners: (
    federationId: string,
    filters?: { dojo_id?: string; status?: string; belt_level?: string; q?: string }
  ): Promise<{
    total: number;
    practitioners: Array<{
      nome: string | null;
      numero_fpkt: string | null;
      cpf: string | null;
      rg: string | null;
      nascimento: string | null;
      email: string | null;
      telefone: string | null;
      dojo: string | null;
      dojo_fpkt: string | null;
      faixa: string | null;
      situacao: string;
    }>;
  }> => {
    const qs = new URLSearchParams();
    if (filters?.dojo_id) qs.set("dojo_id", filters.dojo_id);
    if (filters?.status) qs.set("status", filters.status);
    if (filters?.belt_level) qs.set("belt_level", filters.belt_level);
    if (filters?.q) qs.set("q", filters.q);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/practitioners/export${query}`, { method: "GET" });
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

  /**
   * Faz upload da foto do praticante.
   *
   * POST /federation/:federationId/practitioners/:practitionerId/photo
   * Body: { content: "<base64 puro>", content_type?: "image/jpeg"|"image/png"|"image/webp" }
   * Resposta: { photo_url: "https://r2..." }
   *
   * O backend grava karate_photo_url no banco — não é necessário enviar
   * photo_url no PATCH do praticante após esta chamada.
   */
  uploadPractitionerPhoto: (
    federationId: string,
    practitionerId: string,
    body: UploadPhotoInput
  ): Promise<UploadPhotoResult> =>
    request(`/federation/${federationId}/practitioners/${practitionerId}/photo`, {
      method: "POST",
      body,
    }),

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

  /** Fase F2 — aceita `year` (temporada) e `q` (busca por nome/código FPKT),
   *  além de `status`, que agora aceita os aliases agregados do hub
   *  (em_aberto/atrasado — ver AnnuityStatusFilter) e "all" (sem filtro). */
  listDojoAnnuities: (
    federationId: string,
    params?: { status?: AnnuityStatusFilter; year?: string; q?: string; page?: number; pageSize?: number }
  ): Promise<Paginated<DojoAnnuity>> => {
    const qs = new URLSearchParams();
    if (params?.status && params.status !== "all") qs.set("status", params.status);
    if (params?.year) qs.set("year", params.year);
    if (params?.q) qs.set("q", params.q);
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

  /** Gera o copia-e-cola PIX (BR Code estático) para a mensagem de cobrança wa.me/e-mail. Não persiste intent. */
  pixBrcode: (
    federationId: string,
    amount: number
  ): Promise<{ payload: string | null; provider: string | null }> =>
    request(`/federation/${federationId}/financial/annuities/pix-brcode`, {
      method: "POST",
      body: { amount },
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

  /** Anula (estorna) uma anuidade de dojô já lançada. Retorno real NÃO é
   * um DojoAnnuity — é { voided, idempotent_hit, annuity_id, ... } (ver
   * VoidAnnuityResult / POST .../:annuityId/void em karateAnnuities.js).
   * Funciona mesmo para cobranças já pagas (reverte a conciliação). */
  voidAnnuity: (
    federationId: string,
    dojoId: string,
    annuityId: string
  ): Promise<VoidAnnuityResult> =>
    request(`/federation/${federationId}/financial/annuities/dojos/${dojoId}/${annuityId}/void`, {
      method: "POST",
      body: {},
    }),

  /** Registra o pagamento de uma anuidade de dojô existente (baixa manual — PIX estática + confirmação). */
  payAnnuity: (
    federationId: string,
    dojoId: string,
    annuityId: string,
    payload: {
      paid_at?: string;          // 'YYYY-MM-DD' (default hoje no backend)
      payment_method?: "pix" | "dinheiro" | "transferencia" | "outro";
      amount?: number;
    }
  ): Promise<DojoAnnuity> =>
    request(`/federation/${federationId}/financial/annuities/dojos/${dojoId}/${annuityId}/pay`, {
      method: "POST",
      body: payload,
    }),

  /** Lança um período de anuidade já pago (sem cobrança prévia — PIX estática já recebido). */
  registerAnnuityPayment: (
    federationId: string,
    dojoId: string,
    payload: {
      reference_period: string;
      amount: number;
      paid_at?: string;          // 'YYYY-MM-DD'
      due_date?: string;         // 'YYYY-MM-DD'
      payment_method?: "pix" | "dinheiro" | "transferencia" | "outro";
    }
  ): Promise<DojoAnnuity> =>
    request(`/federation/${federationId}/financial/annuities/dojos/${dojoId}/pay`, {
      method: "POST",
      body: payload,
    }),

  /** Fase F2 — mesma extensão de listDojoAnnuities (year/q + status alias). */
  listCpfAnnuities: (
    federationId: string,
    params?: { status?: AnnuityStatusFilter; year?: string; q?: string; page?: number; pageSize?: number }
  ): Promise<Paginated<CpfAnnuity>> => {
    const qs = new URLSearchParams();
    if (params?.status && params.status !== "all") qs.set("status", params.status);
    if (params?.year) qs.set("year", params.year);
    if (params?.q) qs.set("q", params.q);
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

  // ── Fase F2 — Hub de Anuidades ──────────────────────────────────

  /** GET /financial/annuities/summary — os 4 KPIs do hub (previsto/recebido/
   *  em_aberto/atrasado), segmentados por dojo/praticante/total. Fonte única
   *  dos números do topo do hub — NUNCA somar a partir da listagem paginada. */
  getAnnuitySummary: (
    federationId: string,
    params?: { year?: string }
  ): Promise<AnnuitySummaryResponse> => {
    const qs = new URLSearchParams();
    if (params?.year) qs.set("year", params.year);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/financial/annuities/summary${query}`);
  },

  /** GET /financial/fees no shape NOVO (por plano — Fase F2). Mesmo endpoint
   *  de getAnnualFees; tipado à parte porque o shape (fee_type/plan/
   *  due_months) difere do legado por size_tier. */
  getFeePlans: (federationId: string): Promise<AnnuityFeePlan[]> =>
    request(`/federation/${federationId}/financial/fees`),

  /** PUT /financial/fees no formato NOVO (plan-based) — cria uma vigência
   *  única (append-only). NÃO usar para o formato legado por size_tier
   *  (updateAnnualFees, que manda { fees: [...] }). */
  updateFeePlan: (
    federationId: string,
    body: AnnuityFeePlanInput
  ): Promise<AnnuityFeePlan> =>
    request(`/federation/${federationId}/financial/fees`, { method: "PUT", body }),

  /** POST .../installments/:id/pay — baixa manual de UMA parcela (dojô ou
   *  praticante). Idempotente (parcela já paga devolve idempotent_hit:true). */
  payInstallment: (
    federationId: string,
    installmentId: string,
    body?: InstallmentPayInput
  ): Promise<InstallmentPayResult> =>
    request(`/federation/${federationId}/financial/annuities/installments/${installmentId}/pay`, {
      method: "POST",
      body: body ?? {},
    }),

  /** POST .../installments/:id/pix — cria intent PIX para UMA parcela.
   *  Resposta no mesmo shape de PixIntent (intent_id/payload/qr_image/...). */
  pixInstallment: (
    federationId: string,
    installmentId: string
  ): Promise<PixIntent> =>
    request(`/federation/${federationId}/financial/annuities/installments/${installmentId}/pix`, {
      method: "POST",
      body: {},
    }),

  /** PATCH .../installments/:id — corrige amount/due_date de UMA parcela
   *  ainda não paga (409 ALREADY_PAID se já paga). */
  updateInstallment: (
    federationId: string,
    installmentId: string,
    body: InstallmentUpdateInput
  ): Promise<InstallmentUpdateResult> =>
    request(`/federation/${federationId}/financial/annuities/installments/${installmentId}`, {
      method: "PATCH",
      body,
    }),

  /** PATCH .../:annuityId/plan — troca o plano de uma anuidade de DOJÔ
   *  (praticante só tem 'anual', 422 se tentado). 409 HAS_PAID_INSTALLMENT
   *  se alguma parcela já foi paga; 409 HAS_NFSE se já há nota emitida. */
  updateAnnuityPlan: (
    federationId: string,
    annuityId: string,
    plan: AnnuityPlan
  ): Promise<AnnuityPlanChangeResult> =>
    request(`/federation/${federationId}/financial/annuities/${annuityId}/plan`, {
      method: "PATCH",
      body: { plan },
    }),

  /** POST /annuities/:annuityId/void — void GENÉRICO (dojô OU praticante,
   *  só o annuityId). Prefira este a voidAnnuity() no hub F2: dispensa o
   *  dojoId no path e cobre também anuidades de praticante. Idempotente. */
  voidAnnuityGeneric: (
    federationId: string,
    annuityId: string
  ): Promise<VoidAnnuityGenericResult> =>
    request(`/federation/${federationId}/financial/annuities/${annuityId}/void`, {
      method: "POST",
      body: {},
    }),

  // ── Fase F3 — Campanha anual + cobrança em lote ──────────────────
  // Mesmo motor no backend (karateAnnuityCampaign.js): /campaign roda sobre
  // TODOS os elegíveis da temporada (menos `exclude`), /batch roda sobre uma
  // lista explícita de alvos (multi-seleção manual da tabela). Nenhum dos
  // dois é all-or-nothing — resposta sempre { created, skipped, errors }.
  //
  // retry:0 nas mutações (campaign/batch): o request() core tenta de novo
  // em erro de rede/timeout por padrão (retry:2), e reenviar um POST que
  // criou cobranças do lado do servidor mas cuja resposta se perdeu na volta
  // arriscaria duplo clique automático. O backend já é idempotente por
  // conta do índice único (dojo_id/practitioner_id, reference_period) — uma
  // reexecução manual do usuário cai em `skipped`, não duplica — mas evitar
  // o retry automático do client remove a superfície de risco por completo.

  /** POST .../campaign/preview — pré-visualização read-only. Mesma query de
   *  elegibilidade e mesmo cálculo de parcelas que /campaign vai usar (com o
   *  mesmo due_date, se informado) — é o preview que protege o usuário. */
  previewAnnuityCampaign: (
    federationId: string,
    body: { year: string; scope: AnnuityCampaignScope; due_date?: string }
  ): Promise<AnnuityCampaignPreviewResponse> =>
    request(`/federation/${federationId}/financial/annuities/campaign/preview`, {
      method: "POST",
      body,
    }),

  /** POST .../campaign — dispara a campanha sobre todos os elegíveis da
   *  temporada (menos `exclude`). `due_date` (opcional) sobrescreve o
   *  vencimento da primeira parcela gerada de CADA alvo processado. */
  runAnnuityCampaign: (
    federationId: string,
    body: {
      year: string;
      scope: AnnuityCampaignScope;
      exclude?: { dojo_ids?: string[]; practitioner_ids?: string[] };
      due_date?: string;
    }
  ): Promise<AnnuityCampaignResult> =>
    request(`/federation/${federationId}/financial/annuities/campaign`, {
      method: "POST",
      body,
      retry: 0,
    }),

  /** POST .../batch — mesmo motor da campanha, para a multi-seleção manual
   *  da tabela do hub. `plan` (opcional, default 'anual') só afeta alvos
   *  type='dojo'. Cada alvo é revalidado contra o banco no backend — a UI
   *  não precisa (e não deve) filtrar elegibilidade sozinha antes de mandar. */
  batchAnnuityCampaign: (
    federationId: string,
    body: { targets: AnnuityBatchTarget[]; year: string; plan?: AnnuityPlan; due_date?: string }
  ): Promise<AnnuityCampaignResult> =>
    request(`/federation/${federationId}/financial/annuities/batch`, {
      method: "POST",
      body,
      retry: 0,
    }),

  // ── Fase F4 — e-mail de cobrança de anuidade ─────────────────────
  // Envio manual (single ou lote) usa o MESMO template/blocos que a régua
  // automática usaria (subject_template/body_template da federação, se
  // configurados — senão o default hardcoded). Ausência de e-mail nunca é
  // erro: single -> 422 EMAIL_MISSING (mensagem já pronta em português,
  // sugerindo WhatsApp); lote -> entra em `skipped` (reason: 'sem_email').
  // retry:0 nos três — reenviar e-mail em duplicidade por causa de um
  // retry de rede é o cenário que a Fase F4 mais precisa evitar.

  /** POST .../installments/:id/send-email — reenvio manual é permitido
   *  (sem lock de idempotência; rule_code='manual' fica fora do índice
   *  único da régua automática, migration 223). */
  sendAnnuityInstallmentEmail: (
    federationId: string,
    installmentId: string
  ): Promise<AnnuitySendEmailResult> =>
    request(`/federation/${federationId}/financial/annuities/installments/${installmentId}/send-email`, {
      method: "POST",
      body: {},
      retry: 0,
    }),

  /** POST .../send-email-batch { installment_ids: [] } — nunca all-or-nothing. */
  sendAnnuityEmailBatch: (
    federationId: string,
    body: { installment_ids: string[] }
  ): Promise<AnnuityEmailBatchResult> =>
    request(`/federation/${federationId}/financial/annuities/send-email-batch`, {
      method: "POST",
      body,
      retry: 0,
    }),

  /** POST .../void-batch { annuity_ids: [] } — retirada de cobrança em
   *  lote (remoção do lançamento, NÃO estorno financeiro — a transaction
   *  cancelada já preserva a trilha). Pula (não erra) anuidade com parcela
   *  paga ou NFS-e emitida/em processamento (reason em `skipped`). */
  voidAnnuitiesBatch: (
    federationId: string,
    body: { annuity_ids: string[] }
  ): Promise<AnnuityVoidBatchResult> =>
    request(`/federation/${federationId}/financial/annuities/void-batch`, {
      method: "POST",
      body,
      retry: 0,
    }),

  // Fase 5 — valores em aberto segmentados (pretas CPF x dojôs). Somente
  // leitura: usado pela aba "Em aberto" para montar o workflow de cobrança
  // (seleção + "preparar cobrança"), sem disparar e-mail nenhum.
  getOpenItems: (federationId: string): Promise<OpenItemsResponse> =>
    request(`/federation/${federationId}/financial/open-items`),

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

  // Exclui o evento (só permitido sem inscritos/certificados — backend guarda).
  deleteBeltExam: (federationId: string, examId: string): Promise<{ ok: boolean; deleted: string }> =>
    request(`/federation/${federationId}/belt-exams/${examId}`, { method: "DELETE" }),

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

  /** Inscreve participante em curso (student_id enviado diretamente; target_belt opcional). */
  addExamCandidate: (
    federationId: string,
    examId: string,
    body: AddExamCandidateInput
  ): Promise<ExamCandidate> =>
    request(`/federation/${federationId}/belt-exams/${examId}/candidates`, {
      method: "POST",
      body: { student_id: body.student_id, ...(body.target_belt ? { target_belt: body.target_belt } : {}) },
    }),

  updateCandidateResult: (
    federationId: string,
    examId: string,
    candidateId: string,
    body: UpdateCandidateResultInput
  ): Promise<ExamCandidate & { registration?: CandidateRegistrationOutcome | null }> =>
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
    body: {
      enabled: boolean; channel?: "email" | "whatsapp"; offsets_days?: number[];
      // Fase F4 — string vazia ou ausente volta pro default do backend
      // (null); nunca precisa mandar as duas juntas.
      subject_template?: string | null; body_template?: string | null;
    }
  ): Promise<{ config: ReminderConfig }> =>
    // retry:0 — reenviar um PUT de config por causa de erro de rede não é
    // perigoso (idempotente por natureza, sempre sobrescreve o registro
    // inteiro), mas evitamos mesmo assim: um 422 de variável desconhecida
    // não deve ser mascarado por um retry que reenvia o MESMO body inválido.
    request(`/federation/${federationId}/reminder-config`, { method: "PUT", body, retry: 0 }),

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

  /** Painel do sensei: eventos abertos da federação (read-only). */
  listSenseiEvents: (federationId: string): Promise<SenseiEventsResponse> =>
    request(`/federation/${federationId}/dojo/events`),

  /** Painel do sensei: praticantes do dojô (read-only). */
  listSenseiPractitioners: (federationId: string): Promise<SenseiPractitionersResponse> =>
    request(`/federation/${federationId}/dojo/practitioners`),

  /** Painel do sensei: anuidade do dojô (pendência, histórico e Pix). */
  getSenseiAnnuity: (federationId: string): Promise<SenseiAnnuityResponse> =>
    request(`/federation/${federationId}/dojo/annuity`),

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

  // ── Fase 2 — Anexos/Documentos (dojô e praticante) ──────────────
  /** GET /federation/:fedId/:ownerType/:ownerId/documents */
  listDocuments: (
    federationId: string,
    ownerType: DocumentOwnerType,
    ownerId: string
  ): Promise<{ data: KarateDocument[] }> =>
    request(`/federation/${federationId}/${ownerType}/${ownerId}/documents`),

  /**
   * POST /federation/:fedId/:ownerType/:ownerId/documents
   * Body: { content: "<base64 puro>", filename, content_type?, note? }
   * Resposta 201 traz o documento criado; `storage_mock:true` indica que
   * o R2 não está configurado (armazenamento simulado/temporário).
   */
  uploadDocument: (
    federationId: string,
    ownerType: DocumentOwnerType,
    ownerId: string,
    body: UploadDocumentInput
  ): Promise<KarateDocument> =>
    request(`/federation/${federationId}/${ownerType}/${ownerId}/documents`, {
      method: "POST",
      body,
      timeout: 60000,
    }),

  /** GET /federation/:fedId/:ownerType/:ownerId/documents/:docId/download */
  getDocumentDownload: (
    federationId: string,
    ownerType: DocumentOwnerType,
    ownerId: string,
    docId: string
  ): Promise<DocumentDownloadResult> =>
    request(`/federation/${federationId}/${ownerType}/${ownerId}/documents/${docId}/download`),

  /** DELETE /federation/:fedId/:ownerType/:ownerId/documents/:docId */
  deleteDocument: (
    federationId: string,
    ownerType: DocumentOwnerType,
    ownerId: string,
    docId: string
  ): Promise<{ deleted: boolean }> =>
    request(`/federation/${federationId}/${ownerType}/${ownerId}/documents/${docId}`, {
      method: "DELETE",
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

// =================================================================
// Banners / Divulgacoes — Track Admin Banners
// =================================================================

export type BannerFormat = "square" | "story" | "landscape";
export type BannerPlacement = "hub" | "inscricao" | "ambos";

export interface Banner {
  id: string;
  federation_id: string;
  title: string | null;
  image_url: string;
  format: BannerFormat;
  placement: BannerPlacement;
  event_id: string | null;
  event_name: string | null;
  active: boolean;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  has_text: boolean;
  created_at: string;
}

export interface BannerCreateInput {
  image_base64: string;
  image_content_type: string;
  format: BannerFormat;
  title?: string | null;
  placement?: BannerPlacement;
  event_id?: string | null;
  sort_order?: number;
  active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  has_text?: boolean;
}

export interface BannerPatchInput {
  active?: boolean;
  sort_order?: number;
  title?: string | null;
  format?: BannerFormat;
  event_id?: string | null;
  placement?: BannerPlacement;
  has_text?: boolean;
}

export interface RegistrationLot {
  id: string;
  event_id: string;
  name: string;
  sort_order: number;
  price_member: number;
  price_nonmember: number;
  ends_at: string | null;
  active: boolean;
  created_at: string;
}

export interface RegistrationLotInput {
  name: string;
  sort_order?: number;
  price_member?: number;
  price_nonmember?: number;
  ends_at?: string | null;
  active?: boolean;
}

// Lotes de inscrição do evento (Fase 2). Montados sob /federation/:id/belt-exams/:examId/lots
export const lotApi = {
  listLots: (fedId: string, examId: string): Promise<RegistrationLot[]> =>
    request(`/federation/${fedId}/belt-exams/${examId}/lots`),
  createLot: (fedId: string, examId: string, body: RegistrationLotInput): Promise<RegistrationLot> =>
    request(`/federation/${fedId}/belt-exams/${examId}/lots`, { method: "POST", body }),
  updateLot: (fedId: string, examId: string, lotId: string, patch: Partial<RegistrationLotInput>): Promise<RegistrationLot> =>
    request(`/federation/${fedId}/belt-exams/${examId}/lots/${lotId}`, { method: "PATCH", body: patch }),
  deleteLot: (fedId: string, examId: string, lotId: string): Promise<{ ok: boolean }> =>
    request(`/federation/${fedId}/belt-exams/${examId}/lots/${lotId}`, { method: "DELETE" }),
};

export const bannerApi = {
  /** GET /federation/:fedId/banners */
  listBanners: (fedId: string): Promise<{ banners: Banner[] }> =>
    request(`/federation/${fedId}/banners`),

  /** POST /federation/:fedId/banners — JSON base64 variant */
  createBanner: (fedId: string, body: BannerCreateInput): Promise<{ banner: Banner }> =>
    request(`/federation/${fedId}/banners`, { method: "POST", body, timeout: 60000 }),

  /** PATCH /federation/:fedId/banners/:id */
  updateBanner: (fedId: string, id: string, patch: BannerPatchInput): Promise<{ banner: Banner }> =>
    request(`/federation/${fedId}/banners/${id}`, { method: "PATCH", body: patch }),

  /** DELETE /federation/:fedId/banners/:id */
  deleteBanner: (fedId: string, id: string): Promise<{ ok: boolean }> =>
    request(`/federation/${fedId}/banners/${id}`, { method: "DELETE" }),
};
