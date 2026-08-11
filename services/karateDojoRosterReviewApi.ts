// ============================================================
// AURA DOJÔ — F11.3: revisão do plantel herdado (lado DOJÔ)
//
// Cliente tipado do Aura-backend (src/routes/karateDojoRosterReview.js +
// src/services/karateDojoRosterReviewService.js, migration 276). Base:
// /federation/:id/dojo — mesmo padrão de karateDojoStudentsApi.ts /
// karateDojoTagsApi.ts (Bearer via request() core; GET aceita Canal A e
// B, POST exige Canal A → 403 PORTAL_READ_ONLY).
//
// ── ⚠️ O QUE ESTE SERVICE NÃO FAZ ───────────────────────────
// NÃO INATIVA NINGUÉM. "Não reconhecido" não é "inativo": o praticante
// pode ter MUDADO DE DOJÔ. `complete` devolve `practitioners_changed`
// SEMPRE false e o que ele gera são AVISOS para a federação — quem
// inativa/transfere/mantém é ela, pela rota dela
// (services/karateRosterReviewNoticesApi.ts). O vocabulário desta camada
// segue a mesma regra: nada aqui se chama "inativar" ou "excluir".
//
// ── VOLUME E RETOMADA ───────────────────────────────────────
//   • listRoster é paginado (limit até ROSTER_PAGE_MAX=200) e tem busca;
//   • mark aceita até ROSTER_MARK_MAX=500 ids por chamada — quem precisa
//     marcar mais que isso usa markInChunks();
//   • estado PERSISTE no servidor: marca metade hoje, termina amanhã. A
//     revisão nasce na PRIMEIRA marcação — getState() NUNCA a cria.
//
// Vive num service pequeno e próprio (mesmo racional de
// karateDojoTagsApi.ts): karateApi.ts já passa de 125 KB e não é tocado
// por feature nova.
//
// Normalização DEFENSIVA (mesmo racional de karateDojoFederativoApi.ts):
// campo ausente vira null/[]/0 em vez de quebrar a UI.
// ============================================================
import { request, ApiError } from "@/services/api";

// ── Constantes de contrato (espelham o backend) ─────────────────────────
/** Teto de ids por chamada de /mark (MAX_BATCH no service do backend). */
export const ROSTER_MARK_MAX = 500;
/** Teto de `limit` em /roster (MAX_LIMIT no service do backend). */
export const ROSTER_PAGE_MAX = 200;
/** Página default da tela de revisão. */
export const ROSTER_PAGE_SIZE = 50;

export type RosterReviewStatus = "in_progress" | "completed";
/** Estado por praticante. 'pending' = ainda NÃO revisado (ausência de linha). */
export type RosterReviewItemStatus = "recognized" | "not_recognized" | "pending";
/** O que se pode enviar em /mark — 'pending' é o DESMARCAR. */
export type RosterMarkStatus = RosterReviewItemStatus;
/** O que fazer com quem ficou sem marcação, no ato de concluir. */
export type RosterPendingPolicy = "not_recognized" | "recognized";

export interface RosterReview {
  id: string;
  dojo_id: string | null;
  federation_id: string | null;
  assumption_id: string | null;
  status: RosterReviewStatus;
  started_by_label: string | null;
  started_at: string | null;
  completed_by_label: string | null;
  completed_at: string | null;
  inherited_total: number | null;
  recognized_count: number | null;
  not_recognized_count: number | null;
  notices_created: number | null;
}

/** Contagens do plantel INTEIRO (independem de filtro/página). */
export interface RosterSummary {
  inherited_total: number;
  recognized: number;
  not_recognized: number;
  pending: number;
  /** Quantos deles a FEDERAÇÃO já tem como inativos (sinal, não marcação). */
  inactive_in_federation: number;
}

export interface RosterPractitioner {
  practitioner_id: string;
  name: string;
  karate_registration_number: string | null;
  birth_date: string | null;
  /** is_active NA FEDERAÇÃO — não é a marcação do sensei. */
  is_active: boolean;
  photo_url: string | null;
  review_status: RosterReviewItemStatus;
  reviewed_at: string | null;
}

export interface RosterReviewState {
  /** A revisão ABERTA; se não houver, a última concluída. null = nunca revisou. */
  review: RosterReview | null;
  summary: RosterSummary;
  /** true quando a migration 276 ainda não rodou neste ambiente. */
  schema_pending: boolean;
}

export interface RosterPage {
  /** id da revisão ABERTA (null quando não há uma). */
  review_id: string | null;
  data: RosterPractitioner[];
  count: number;
  limit: number;
  offset: number;
  schema_pending?: boolean;
}

export interface RosterMarkResult {
  review: RosterReview | null;
  status: RosterMarkStatus;
  marked: number;
  /** ids que não pertencem a este dojô — nunca escrevem, nunca dão 500. */
  skipped: string[];
  skipped_count: number;
  summary: RosterSummary;
}

export interface RosterCompleteResult {
  review: RosterReview | null;
  summary: RosterSummary;
  notices_created: number;
  /**
   * SEMPRE false — o contrato em um campo: avisamos, não inativamos.
   * A UI usa isso para poder afirmar "nada foi alterado no cadastro".
   */
  practitioners_changed: boolean;
}

export interface ListRosterParams {
  q?: string;
  /** status NA FEDERAÇÃO (active|inactive) — não é a marcação do sensei. */
  status?: "active" | "inactive";
  review_status?: RosterReviewItemStatus;
  limit?: number;
  offset?: number;
}

// ── Normalização defensiva ──────────────────────────────────────────────

function str(v: any): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function int(v: any, fallback = 0): number {
  const n = typeof v === "string" ? parseInt(v, 10) : v;
  return typeof n === "number" && isFinite(n) ? n : fallback;
}
function intOrNull(v: any): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? parseInt(v, 10) : v;
  return typeof n === "number" && isFinite(n) ? n : null;
}

const EMPTY_SUMMARY: RosterSummary = {
  inherited_total: 0,
  recognized: 0,
  not_recognized: 0,
  pending: 0,
  inactive_in_federation: 0,
};

function normalizeSummary(raw: any): RosterSummary {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    inherited_total: int(r.inherited_total),
    recognized: int(r.recognized),
    not_recognized: int(r.not_recognized),
    pending: int(r.pending),
    inactive_in_federation: int(r.inactive_in_federation),
  };
}

function normalizeReview(raw: any): RosterReview | null {
  if (!raw || typeof raw !== "object" || !raw.id) return null;
  return {
    id: String(raw.id),
    dojo_id: str(raw.dojo_id),
    federation_id: str(raw.federation_id),
    assumption_id: str(raw.assumption_id),
    status: raw.status === "completed" ? "completed" : "in_progress",
    started_by_label: str(raw.started_by_label),
    started_at: str(raw.started_at),
    completed_by_label: str(raw.completed_by_label),
    completed_at: str(raw.completed_at),
    inherited_total: intOrNull(raw.inherited_total),
    recognized_count: intOrNull(raw.recognized_count),
    not_recognized_count: intOrNull(raw.not_recognized_count),
    notices_created: intOrNull(raw.notices_created),
  };
}

function normalizeItemStatus(raw: any): RosterReviewItemStatus {
  // A AUSÊNCIA é o estado: sem linha de item, o praticante é 'pending'.
  return raw === "recognized" || raw === "not_recognized" ? raw : "pending";
}

function normalizePractitioner(raw: any): RosterPractitioner {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    practitioner_id: String(r.practitioner_id ?? r.id ?? ""),
    name: str(r.name) || "Sem nome",
    karate_registration_number: str(r.karate_registration_number),
    birth_date: str(r.birth_date),
    is_active: r.is_active === true,
    photo_url: str(r.photo_url),
    review_status: normalizeItemStatus(r.review_status),
    reviewed_at: str(r.reviewed_at),
  };
}

function qs(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const k of Object.keys(params)) {
    const v = params[k];
    if (v != null && v !== "") parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(v)));
  }
  return parts.length ? "?" + parts.join("&") : "";
}

const base = (federationId: string) => "/federation/" + federationId + "/dojo/roster-review";

// ── Erros: código do backend → frase pt-BR ──────────────────────────────
// Mesma ideia de mapFederationError (dojoAlunos/helpers.ts). NENHUMA
// mensagem daqui fala em inativar/excluir — a revisão não faz isso.

export function rosterReviewErrorCode(e: any): string | null {
  if (e instanceof ApiError) {
    const data: any = e.data;
    if (data && typeof data === "object" && typeof data.code === "string") return data.code;
  }
  const code = (e as any)?.data?.code ?? (e as any)?.code;
  return typeof code === "string" ? code : null;
}

/** Números que vêm junto do 409 REVISAO_INCOMPLETA (evita 2ª chamada). */
export function rosterReviewErrorSummary(e: any): RosterSummary | null {
  const raw = (e as any)?.data?.summary;
  return raw && typeof raw === "object" ? normalizeSummary(raw) : null;
}

export function mapRosterReviewError(e: any): string {
  switch (rosterReviewErrorCode(e)) {
    case "PORTAL_READ_ONLY":
      return "O portal do dojô é somente leitura. Entre com a conta do dojô para revisar o plantel.";
    case "SCHEMA_PENDING":
      return "A revisão do plantel ainda não está disponível neste ambiente.";
    case "REVISAO_NAO_INICIADA":
      return "Marque ao menos um praticante antes de concluir a revisão.";
    case "REVISAO_JA_CONCLUIDA":
      return "Esta revisão já foi concluída. Recarregue a tela para ver o resultado.";
    case "REVISAO_INCOMPLETA":
      return "Ainda há praticantes sem marcação. Escolha o que fazer com eles antes de concluir.";
    case "BATCH_TOO_LARGE":
      return "Máximo de " + ROSTER_MARK_MAX + " praticantes por vez.";
    case "INVALID_PRACTITIONER_ID":
      return "A seleção contém um praticante inválido. Recarregue a lista e tente de novo.";
    case "VALIDATION_ERROR":
      return (e as any)?.data?.error || "Não foi possível registrar a marcação.";
    default:
      return (e as any)?.data?.error || "Não foi possível concluir a operação. Tente de novo.";
  }
}

// ── API ─────────────────────────────────────────────────────────────────

export const karateDojoRosterReviewApi = {
  /**
   * Estado da revisão + contagens do plantel inteiro (barra de progresso).
   * ⚠️ NÃO cria revisão: abrir a tela para olhar não é começar a revisar.
   */
  getState: async (federationId: string): Promise<RosterReviewState> => {
    const res = await request<any>(base(federationId));
    return {
      review: normalizeReview(res?.review),
      summary: res?.summary ? normalizeSummary(res.summary) : { ...EMPTY_SUMMARY },
      schema_pending: res?.schema_pending === true,
    };
  },

  /** O plantel herdado, paginado, com a marcação da revisão aberta. */
  listRoster: async (federationId: string, params: ListRosterParams = {}): Promise<RosterPage> => {
    const res = await request<any>(
      base(federationId) + "/roster" + qs({
        q: params.q,
        status: params.status,
        review_status: params.review_status,
        limit: params.limit != null ? Math.min(params.limit, ROSTER_PAGE_MAX) : undefined,
        offset: params.offset,
      })
    );
    const data = Array.isArray(res?.data) ? res.data.map(normalizePractitioner) : [];
    return {
      review_id: str(res?.review_id),
      data,
      count: int(res?.count, data.length),
      limit: int(res?.limit, params.limit ?? ROSTER_PAGE_SIZE),
      offset: int(res?.offset, params.offset ?? 0),
      schema_pending: res?.schema_pending === true ? true : undefined,
    };
  },

  /**
   * Marcação EM LOTE (até ROSTER_MARK_MAX ids). 'pending' DESMARCA —
   * errar um clique não pode ser irreversível.
   *
   * Idempotente: reenviar o mesmo lote faz UPDATE do status, nunca uma
   * segunda linha. Id que não é deste dojô volta em `skipped`.
   */
  mark: async (
    federationId: string,
    practitionerIds: string[],
    status: RosterMarkStatus
  ): Promise<RosterMarkResult> => {
    const res = await request<any>(base(federationId) + "/mark", {
      method: "POST",
      body: { practitioner_ids: practitionerIds, status },
    });
    return {
      review: normalizeReview(res?.review),
      status: (res?.status as RosterMarkStatus) ?? status,
      marked: int(res?.marked),
      skipped: Array.isArray(res?.skipped) ? res.skipped.map((x: any) => String(x)) : [],
      skipped_count: int(res?.skipped_count),
      summary: res?.summary ? normalizeSummary(res.summary) : { ...EMPTY_SUMMARY },
    };
  },

  /**
   * Marca uma lista de QUALQUER tamanho, quebrando em lotes de
   * ROSTER_MARK_MAX. Devolve o `summary` da ÚLTIMA chamada (o mais
   * recente) com `marked` acumulado — é o que a tela mostra.
   *
   * Sequencial de propósito: duas marcações simultâneas do mesmo dojô
   * disputariam a criação da revisão (o backend resolve, mas o total
   * acumulado ficaria menos previsível para quem lê a tela).
   */
  markInChunks: async (
    federationId: string,
    practitionerIds: string[],
    status: RosterMarkStatus
  ): Promise<RosterMarkResult> => {
    const ids = Array.from(new Set(practitionerIds.filter(Boolean)));
    let acc: RosterMarkResult = {
      review: null,
      status,
      marked: 0,
      skipped: [],
      skipped_count: 0,
      summary: { ...EMPTY_SUMMARY },
    };
    for (let i = 0; i < ids.length; i += ROSTER_MARK_MAX) {
      const chunk = ids.slice(i, i + ROSTER_MARK_MAX);
      // eslint-disable-next-line no-await-in-loop
      const res = await karateDojoRosterReviewApi.mark(federationId, chunk, status);
      acc = {
        review: res.review,
        status: res.status,
        marked: acc.marked + res.marked,
        skipped: acc.skipped.concat(res.skipped),
        skipped_count: acc.skipped_count + res.skipped_count,
        summary: res.summary,
      };
    }
    return acc;
  },

  /**
   * Percorre a paginação e devolve TODOS os ids que batem com o filtro —
   * é o que permite "aplicar à busca atual" sem 300 cliques.
   *
   * `hardCap` existe para a tela nunca montar uma seleção que ela mesma
   * não consegue explicar ao usuário (o maior dojô da planilha tem 288).
   */
  collectIds: async (
    federationId: string,
    params: Omit<ListRosterParams, "limit" | "offset"> = {},
    hardCap = 5000
  ): Promise<{ ids: string[]; total: number; truncated: boolean }> => {
    const ids: string[] = [];
    let offset = 0;
    let total = 0;
    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      const page = await karateDojoRosterReviewApi.listRoster(federationId, {
        ...params,
        limit: ROSTER_PAGE_MAX,
        offset,
      });
      total = page.count;
      for (const p of page.data) ids.push(p.practitioner_id);
      offset += page.data.length;
      if (!page.data.length || ids.length >= total || ids.length >= hardCap) break;
    }
    return { ids: ids.slice(0, hardCap), total, truncated: ids.length > hardCap };
  },

  /**
   * Fecha a revisão e GERA OS AVISOS para a federação.
   *
   * Sem `pendingPolicy` e com gente não revisada → 409 REVISAO_INCOMPLETA
   * (com `summary` no corpo, ver rosterReviewErrorSummary). "Não revisado"
   * e "não reconhecido" são estados diferentes: a política é uma ESCOLHA
   * explícita do sensei, nunca um default.
   */
  complete: async (
    federationId: string,
    pendingPolicy?: RosterPendingPolicy
  ): Promise<RosterCompleteResult> => {
    const res = await request<any>(base(federationId) + "/complete", {
      method: "POST",
      body: pendingPolicy ? { pending_policy: pendingPolicy } : {},
    });
    return {
      review: normalizeReview(res?.review),
      summary: res?.summary ? normalizeSummary(res.summary) : { ...EMPTY_SUMMARY },
      notices_created: int(res?.notices_created),
      // Nunca assumir pelo cliente: se um dia o backend disser true, a UI
      // precisa saber. Hoje é sempre false — avisamos, não inativamos.
      practitioners_changed: res?.practitioners_changed === true,
    };
  },
};
