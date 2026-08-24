// ============================================================
// AURA DOJÔ — P0 Hub de Campeonatos: DELEGAÇÃO (cliente)
//
// Base /federation/:id/dojo/competitions e /dojo/delegations
// (Aura-backend, src/routes/karateDelegations.js — migration 294, JÁ
// aplicada em produção). É o "carrinho Sympla" do dojô: seleciona
// atletas/equipes, vê a cotação DRY-RUN (quote) com skips/avisos/cotas
// ANTES de submeter, e paga UM PIX consolidado (ou envia comprovante —
// modo manual, fila de conferência da federação).
//
// NÃO confundir com karateDojoFederativoApi.ts (inscrição avulsa em
// evento/exame da federação) nem com karateDojoEventsApi.ts (eventos
// PRÓPRIOS do dojô). Aqui é COMPETIÇÃO com pedido consolidado.
//
// Service próprio e pequeno — regra da casa (karateApi.ts não cresce).
// Normalização defensiva: campo ausente vira null/0, nunca quebra a UI.
// ============================================================
import { request } from "@/services/api";
import type { Scoresheet } from "@/services/karateCompetitionP1Api";

export type { Scoresheet };

// ── Tipos ───────────────────────────────────────────────────

export interface DelegationDivision {
  id: string;
  name: string;
  rules: {
    max_individual_per_dojo_per_category?: number | null;
    max_teams_per_dojo_per_category?: number | null;
    notes?: string | null;
  };
}

export interface OpenCompetition {
  id: string;
  name: string;
  season: number | null;
  /** 'YYYY-MM-DD' — data pura (formatar com utils/eventDate, tz-safe). */
  event_date: string | null;
  location: string | null;
  fee_amount: number | null;
  has_pricing: boolean;
  rectification_deadline: string | null;
  divisions: DelegationDivision[];
}

export interface EnrollmentCategory {
  id: string;
  name: string;
  modality: "kata" | "kumite" | "kihon_ippon" | "team_kata" | "team_kumite" | "enbu" | "fukugo";
  min_age: number | null;
  max_age: number | null;
  belt_min: string | null;
  belt_max: string | null;
  sex: "M" | "F" | "mixed";
  weight_class: string | null;
  max_entries: number | null;
  fee_amount: number | null;
  division_id: string | null;
  group_label: string | null;
  entry_count: number;
}

export interface QuoteLine {
  kind: "athlete" | "entry" | "team";
  ref: string;
  label: string;
  amount: number;
  exempted: boolean;
}

export interface DelegationQuote {
  mode: "per_athlete" | "per_entry" | "legacy";
  lines: QuoteLine[];
  exemptions: { earned: number; applied: number; officials_count: number };
  subtotal: number;
  discount: number;
  total: number;
}

export interface DelegationSkip {
  student_id?: string | null;
  team?: string;
  name?: string;
  category_id?: string;
  reason: string;
  message: string;
}

export interface DelegationFitWarning {
  student_id: string;
  name: string;
  category_id: string;
  category_name: string;
  warnings: string[];
}

export interface QuotaViolation {
  category_id: string;
  category_name: string | null;
  limit: number;
  existing: number;
  adding: number;
  over: number;
  is_team: boolean;
}

export interface DelegationAthleteInput {
  student_id: string;
  category_ids: string[];
}

// ── Triagem automática (P2.2) ───────────────────────────────
// POST .../delegation/triage — DRY-RUN: o sensei manda atleta+modalidades
// e o backend resolve a categoria pelos requisitos da federação (idade na
// data do evento, sexo, corte de graduação). Nada é gravado; o front usa
// o resultado para montar os category_ids do quote/submit (inalterados).

/** Modalidades INDIVIDUAIS (v1 da triagem não cobre equipes). */
export type IndividualModality = Exclude<EnrollmentCategory["modality"], "team_kata" | "team_kumite">;

export interface TriageCategoryRef {
  category_id: string;
  name: string;
  modality: string;
  group_label: string | null;
  division_id: string | null;
}

export interface TriageMiss {
  category: TriageCategoryRef;
  /** Critérios que falharam: 'age' | 'sex' | 'belt' | 'graduacao_minima' | 'graduacao_maxima'. */
  failed: string[];
}

export interface TriageModalityResult {
  modality: string;
  status: "resolved" | "ambiguous" | "no_fit";
  /** status='resolved' — o match único. */
  category?: TriageCategoryRef;
  /** status='ambiguous' — o sensei só desempata. */
  options?: TriageCategoryRef[];
  /** status='no_fit' — candidatas e por que cada uma não serviu. */
  considered?: TriageMiss[];
  message?: string;
}

export type TriageAthleteStatus =
  | "ok" | "ID_INVALIDO" | "ALUNO_NAO_ENCONTRADO" | "ALUNO_NAO_FEDERADO" | "SEM_MODALIDADE";

export interface TriageAthleteResult {
  student_id: string | null;
  name?: string;
  status: TriageAthleteStatus;
  message?: string;
  /** belt_level atual do praticante (quando federado e graduado). */
  belt?: string | null;
  /** Um item por modalidade pedida (status='ok'). */
  triage?: TriageModalityResult[];
}

export interface TriageBody {
  athletes: { student_id: string; modalities: string[] }[];
}

export interface TriageResponse {
  competition_id: string;
  event_date: string | null;
  results: TriageAthleteResult[];
}

export interface DelegationTeamInput {
  name: string;
  sex: "M" | "F" | "mixed";
  category_ids: string[];
  titular_ids: string[];
  reserve_ids: string[];
}

export interface DelegationBody {
  athletes: DelegationAthleteInput[];
  teams: DelegationTeamInput[];
  officials_count: number;
}

export interface QuoteResponse {
  quote: DelegationQuote;
  skipped: DelegationSkip[];
  warnings: DelegationFitWarning[];
  quota_violations: QuotaViolation[];
  athletes_count: number;
  teams_count: number;
}

export type OrderStatus =
  | "draft" | "submitted" | "awaiting_payment" | "awaiting_confirmation" | "paid" | "cancelled";
export type PaymentMode = "aura_pay" | "pix_direct" | "manual";

export interface DelegationPayment {
  payment_intent_id?: string;
  payload?: string;
  qr_image?: string | null;
  expires_at?: string | null;
  provider?: string;
  amount?: number;
  error?: string;
}

export interface SubmitResponse {
  order: {
    id: string;
    status: OrderStatus;
    payment_mode: PaymentMode;
    total_amount: number;
    created_at: string;
  };
  quote: DelegationQuote;
  enrolled: {
    athletes: { student_id: string; name: string; category_id: string; entry_id: string }[];
    teams: { team_key: string; team_id: string; name: string; category_ids: string[]; entry_ids: string[]; members: number }[];
  };
  skipped: DelegationSkip[];
  warnings: DelegationFitWarning[];
  payment: DelegationPayment | null;
}

export interface DelegationOrderSummary {
  id: string;
  competition_id: string;
  competition_name: string;
  event_date: string | null;
  status: OrderStatus;
  payment_mode: PaymentMode;
  total_amount: number;
  officials_count: number;
  receipt_url: string | null;
  created_at: string;
  confirmed_at: string | null;
}

export interface DelegationOrderEntry {
  id: string;
  category_id: string;
  category_name: string;
  status: string;
  fee_paid: boolean;
  student_id: string | null;
  student_name: string | null;
  team_id: string | null;
  team_name: string | null;
}

export interface DelegationOrderDetail {
  id: string;
  competition: { id: string; name: string; event_date: string | null };
  status: OrderStatus;
  payment_mode: PaymentMode;
  total_amount: number;
  officials_count: number;
  quote: DelegationQuote | Record<string, never>;
  receipt_url: string | null;
  created_at: string;
  confirmed_at: string | null;
  entries: DelegationOrderEntry[];
}

// ── Minhas chaves (Onda B) ──────────────────────────────────
// O "procurar minha chave no PDF / na parede do ginásio", só que no
// celular: o sensei vê APENAS as categorias onde tem atleta e imprime a
// MESMA folha da federação. A súmula devolvida é o payload `Scoresheet`
// de karateCompetitionP1Api — nada é remontado aqui, o gerador de HTML
// (buildScoresheetHtml/printScoresheet) é literalmente o mesmo.

/** Status da chave de uma categoria (espelha o da federação). */
export type MyBracketStatus = "not_generated" | "draft" | "locked" | "done";

export interface MyBracketCategory {
  id: string;
  name: string;
  modality: string;
  group_label: string | null;
  division_name: string | null;
  /** KOTO — a área/tatame do ginásio. É o que o sensei procura primeiro. */
  area_name: string | null;
  area_order: number | null;
  bracket_status: MyBracketStatus;
  kata_mode: string | null;
  /** Nomes dos MEUS atletas nessa categoria. */
  my_athletes: string[];
}

export interface MyBracketsResponse {
  /** false = a federação ainda não publicou as chaves. */
  published: boolean;
  competition_name?: string | null;
  data: MyBracketCategory[];
}

/** 404 NOT_PUBLISHED — chaves despublicadas entre o load e o toque. */
export function isNotPublishedError(e: any): boolean {
  if (!e) return false;
  return [e?.code, e?.data?.code, e?.data?.error, e?.message]
    .filter(Boolean)
    .some((v: any) => String(v).toUpperCase().includes("NOT_PUBLISHED"));
}

export const BRACKET_STATUS_LABEL: Record<MyBracketStatus, string> = {
  not_generated: "Chave ainda não sorteada",
  draft: "Chave provisória",
  locked: "Chave oficial",
  done: "Encerrada",
};

// ── Cliente ─────────────────────────────────────────────────

const base = (fid: string) => `/federation/${fid}/dojo`;

export const karateDelegationsApi = {
  /** Vitrine: campeonatos 'open' da federação. { data, not_linked? } */
  listOpenCompetitions: (fid: string): Promise<{ data: OpenCompetition[]; not_linked?: boolean; schema_pending?: boolean }> =>
    request(`${base(fid)}/competitions`),

  listCategories: (fid: string, competitionId: string): Promise<{ data: EnrollmentCategory[]; schema_pending?: boolean }> =>
    request(`${base(fid)}/competitions/${competitionId}/categories`),

  /** Cotação DRY-RUN — não grava nada. Usada a cada mudança do carrinho. */
  quote: (fid: string, competitionId: string, body: DelegationBody): Promise<QuoteResponse> =>
    request(`${base(fid)}/competitions/${competitionId}/delegation/quote`, { method: "POST", body }),

  /** Triagem automática DRY-RUN (P2.2) — resolve a categoria por atleta×modalidade. */
  triageDelegation: (fid: string, competitionId: string, body: TriageBody): Promise<TriageResponse> =>
    request(`${base(fid)}/competitions/${competitionId}/delegation/triage`, { method: "POST", body }),

  /** Submete a delegação. Mutação — NUNCA retry (risco de duplicar pedido). */
  submit: (
    fid: string,
    competitionId: string,
    body: DelegationBody & { payment_mode: Exclude<PaymentMode, "aura_pay"> }
  ): Promise<SubmitResponse> =>
    request(`${base(fid)}/competitions/${competitionId}/delegation`, { method: "POST", body, retry: 0, timeout: 30000 }),

  /** Minhas chaves: categorias do campeonato onde o dojô tem atleta. */
  getMyBrackets: (fid: string, competitionId: string): Promise<MyBracketsResponse> =>
    request(`${base(fid)}/competitions/${competitionId}/my-brackets`),

  /** Súmula da categoria — MESMO payload da federação (para imprimir). */
  getMyScoresheet: (fid: string, competitionId: string, categoryId: string): Promise<Scoresheet> =>
    request(`${base(fid)}/competitions/${competitionId}/categories/${categoryId}/scoresheet`),

  listOrders: (fid: string): Promise<{ data: DelegationOrderSummary[]; schema_pending?: boolean }> =>
    request(`${base(fid)}/delegations`),

  getOrder: (fid: string, orderId: string): Promise<{ order: DelegationOrderDetail }> =>
    request(`${base(fid)}/delegations/${orderId}`),

  /** Comprovante (modo manual): PDF/JPEG/PNG/WebP até ~5MB, base64. */
  uploadReceipt: (
    fid: string,
    orderId: string,
    fileBase64: string,
    contentType: string
  ): Promise<{ order: { id: string; status: OrderStatus; receipt_url: string; receipt_uploaded_at: string } }> =>
    request(`${base(fid)}/delegations/${orderId}/receipt`, {
      method: "POST",
      body: { file_base64: fileBase64, content_type: contentType },
      retry: 0,
      timeout: 30000,
    }),
};

// ── Helpers de apresentação (compartilhados pelas telas) ────

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "Rascunho",
  submitted: "Enviado",
  awaiting_payment: "Aguardando pagamento",
  awaiting_confirmation: "Em conferência",
  paid: "Confirmado",
  cancelled: "Cancelado",
};

export const MODALITY_LABEL: Record<EnrollmentCategory["modality"], string> = {
  kata: "Kata",
  kumite: "Kumite",
  kihon_ippon: "Kihon Ippon",
  team_kata: "Kata Equipe",
  team_kumite: "Kumite Equipe",
  enbu: "Enbu",
  fukugo: "Fukugo",
};

export function isTeamModality(m: EnrollmentCategory["modality"]): boolean {
  return m === "team_kata" || m === "team_kumite";
}

/** Critério reprovado da triagem → texto legível (pt-BR, tom do produto). */
export const TRIAGE_FAIL_LABEL: Record<string, string> = {
  age: "idade fora da faixa da categoria",
  sex: "sexo diferente do exigido",
  belt: "graduação fora do corte da categoria",
  graduacao_minima: "graduação abaixo da mínima exigida",
  graduacao_maxima: "graduação acima da máxima permitida",
};

export function triageFailLabel(criterion: string): string {
  return TRIAGE_FAIL_LABEL[criterion] || `critério "${criterion}" não atendido`;
}

export function formatBRL(v: number | null | undefined): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}
