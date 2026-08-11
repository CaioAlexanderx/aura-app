// ============================================================
// AURA DOJÔ — F11.3: avisos da revisão do plantel (lado FEDERAÇÃO)
//
// Cliente tipado do Aura-backend (src/routes/karateRosterReviewNoticesAdmin.js
// + src/services/karateRosterReviewNoticeService.js, migration 276).
// Base: /federation/:id — guards de karateRoles (leitura para todos os
// papéis de leitura, decisão só staffWrite), mesmo par de
// karatePractitionerRequestsAdmin.
//
// ── O QUE CHEGA AQUI ────────────────────────────────────────
// Cada linha diz UMA coisa: "o sensei do dojô X não reconhece esta
// pessoa como aluno atual dele, em tal data". É um FATO RELATADO PELO
// DOJÔ, não uma constatação da federação — e NÃO significa que a pessoa
// parou de treinar: ela pode ter mudado de dojô.
//
// Por isso a listagem traz LADO A LADO o SNAPSHOT do momento do aviso e o
// ESTADO ATUAL do praticante, com o derivado `practitioner_left_dojo`
// ("ele já saiu daquele dojô"). Divergência entre os dois é quase sempre
// transferência não registrada.
//
// As três decisões: inactivated | transferred | kept. Inativar e
// transferir são escopados pelo dojô que avisou — se a pessoa já saiu de
// lá, o backend devolve 409 PRATICANTE_JA_SAIU_DO_DOJO (ver
// mapNoticeDecisionError; a UI mostra frase, nunca erro cru).
//
// Service pequeno e próprio (karateApi.ts não é tocado por feature nova).
// Normalização defensiva: campo ausente vira null, nunca quebra a UI.
// ============================================================
import { request, ApiError } from "@/services/api";

export const NOTICES_PAGE_MAX = 200;
export const NOTICES_PAGE_SIZE = 50;

/** 'pending' = a federação ainda não olhou. */
export type NoticeDecision = "pending" | "inactivated" | "transferred" | "kept";
/** O que a federação pode DECIDIR (pending não é decisão). */
export type NoticeDecisionInput = "inactivated" | "transferred" | "kept";

export interface RosterReviewNotice {
  id: string;
  review_id: string | null;
  /** Dojô que AVISOU (o que emitiu o aviso), não necessariamente o de hoje. */
  dojo_id: string | null;
  dojo_name: string | null;
  practitioner_id: string;

  // ── Snapshot do momento do aviso ──────────────────────────────────────
  practitioner_name: string | null;
  practitioner_fpkt_number: string | null;
  /** is_active do praticante NO INSTANTE do aviso. */
  practitioner_was_active: boolean;

  // ── Estado ATUAL (undefined quando a listagem não resolveu) ───────────
  practitioner_current_dojo_id?: string | null;
  practitioner_current_is_active?: boolean | null;
  /** true = hoje ele está em OUTRO dojô. Sinal de transferência não registrada. */
  practitioner_left_dojo?: boolean;

  reason: string;
  reported_at: string | null;
  reported_by_label: string | null;

  decision: NoticeDecision;
  decision_note: string | null;
  destination_dojo_id: string | null;
  decided_by_label: string | null;
  decided_at: string | null;
}

export interface NoticesSummary {
  total: number;
  pending: number;
  inactivated: number;
  transferred: number;
  kept: number;
}

export interface NoticesPage {
  data: RosterReviewNotice[];
  count: number;
  limit: number;
  offset: number;
  summary: NoticesSummary;
  /** true quando a migration 276 ainda não rodou neste ambiente. */
  schema_pending?: boolean;
}

export interface DecideNoticeBody {
  decision: NoticeDecisionInput;
  note?: string;
  /** Obrigatório quando decision='transferred'. */
  destination_dojo_id?: string;
}

export interface DecideNoticeResult {
  notice: RosterReviewNotice | null;
  effect: {
    /** false em 'kept'; true em inativar/transferir. */
    practitioner_changed: boolean;
    is_active?: boolean;
    moved_to_dojo_id?: string | null;
    moved_to_dojo_name?: string | null;
  };
}

export interface ListNoticesParams {
  decision?: NoticeDecision;
  dojo_id?: string;
  q?: string;
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

export const EMPTY_NOTICES_SUMMARY: NoticesSummary = {
  total: 0, pending: 0, inactivated: 0, transferred: 0, kept: 0,
};

function normalizeSummary(raw: any): NoticesSummary {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    total: int(r.total),
    pending: int(r.pending),
    inactivated: int(r.inactivated),
    transferred: int(r.transferred),
    kept: int(r.kept),
  };
}

const DECISIONS: NoticeDecision[] = ["pending", "inactivated", "transferred", "kept"];

function normalizeNotice(raw: any): RosterReviewNotice {
  const r = raw && typeof raw === "object" ? raw : {};
  const notice: RosterReviewNotice = {
    id: String(r.id ?? ""),
    review_id: str(r.review_id),
    dojo_id: str(r.dojo_id),
    dojo_name: str(r.dojo_name),
    practitioner_id: String(r.practitioner_id ?? ""),
    practitioner_name: str(r.practitioner_name),
    practitioner_fpkt_number: str(r.practitioner_fpkt_number),
    practitioner_was_active: r.practitioner_was_active === true,
    reason: str(r.reason) || "nao_reconhecido_pelo_sensei",
    reported_at: str(r.reported_at),
    reported_by_label: str(r.reported_by_label),
    decision: DECISIONS.indexOf(r.decision) >= 0 ? r.decision : "pending",
    decision_note: str(r.decision_note),
    destination_dojo_id: str(r.destination_dojo_id),
    decided_by_label: str(r.decided_by_label),
    decided_at: str(r.decided_at),
  };
  // ⚠️ `undefined` e `null` significam coisas DIFERENTES aqui: undefined =
  // a listagem não resolveu o praticante (não dá para comparar com o
  // snapshot); null = resolveu e o campo é nulo. Só copiamos quando o
  // backend mandou a chave — "dado faltante ≠ pendência".
  if (r.practitioner_current_dojo_id !== undefined) {
    notice.practitioner_current_dojo_id = str(r.practitioner_current_dojo_id);
  }
  if (r.practitioner_current_is_active !== undefined) {
    notice.practitioner_current_is_active =
      r.practitioner_current_is_active === null ? null : r.practitioner_current_is_active === true;
  }
  if (r.practitioner_left_dojo !== undefined) {
    notice.practitioner_left_dojo = r.practitioner_left_dojo === true;
  }
  return notice;
}

function qs(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const k of Object.keys(params)) {
    const v = params[k];
    if (v != null && v !== "") parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(v)));
  }
  return parts.length ? "?" + parts.join("&") : "";
}

const base = (federationId: string) => "/federation/" + federationId + "/roster-review-notices";

// ── Erros → frase pt-BR ─────────────────────────────────────────────────

export function noticeErrorCode(e: any): string | null {
  if (e instanceof ApiError) {
    const data: any = e.data;
    if (data && typeof data === "object" && typeof data.code === "string") return data.code;
  }
  const code = (e as any)?.data?.code ?? (e as any)?.code;
  return typeof code === "string" ? code : null;
}

export function mapNoticeDecisionError(e: any): string {
  switch (noticeErrorCode(e)) {
    case "PRATICANTE_JA_SAIU_DO_DOJO":
      // O caso mais importante: o aviso é uma foto do passado. Nunca
      // vazar o erro cru — explicar o que aconteceu e o que fazer.
      return "Este praticante não está mais no dojô que avisou — ele já foi movido de lá. Confira o cadastro atual antes de decidir; o aviso é uma foto do momento em que o sensei revisou.";
    case "AVISO_JA_DECIDIDO":
      return "Este aviso já foi decidido (talvez por outra pessoa da federação). A lista foi atualizada.";
    case "NOT_FOUND":
      return "Aviso não encontrado nesta federação.";
    case "DESTINATION_REQUIRED":
      return "Escolha o dojô de destino para transferir.";
    case "DESTINATION_INVALID":
      return "Dojô de destino não encontrado nesta federação.";
    case "DESTINATION_IS_ORIGIN":
      return "O dojô de destino é o mesmo que emitiu o aviso.";
    case "MIGRATION_PENDING":
      return "O histórico de transferências está indisponível — a transferência NÃO foi registrada. Tente de novo mais tarde.";
    case "SCHEMA_PENDING":
      return "Os avisos de revisão do plantel ainda não estão disponíveis neste ambiente.";
    case "VALIDATION_ERROR":
      return (e as any)?.data?.error || "Não foi possível registrar a decisão.";
    default:
      return (e as any)?.data?.error || "Não foi possível registrar a decisão. Tente de novo.";
  }
}

// ── API ─────────────────────────────────────────────────────────────────

export const karateRosterReviewNoticesApi = {
  /** A fila. `summary` acompanha a página (não muda com filtro/paginação). */
  list: async (federationId: string, params: ListNoticesParams = {}): Promise<NoticesPage> => {
    const res = await request<any>(
      base(federationId) + qs({
        decision: params.decision,
        dojo_id: params.dojo_id,
        q: params.q,
        limit: params.limit != null ? Math.min(params.limit, NOTICES_PAGE_MAX) : undefined,
        offset: params.offset,
      })
    );
    const data = Array.isArray(res?.data) ? res.data.map(normalizeNotice) : [];
    return {
      data,
      count: int(res?.count, data.length),
      limit: int(res?.limit, params.limit ?? NOTICES_PAGE_SIZE),
      offset: int(res?.offset, params.offset ?? 0),
      summary: res?.summary ? normalizeSummary(res.summary) : { ...EMPTY_NOTICES_SUMMARY },
      schema_pending: res?.schema_pending === true ? true : undefined,
    };
  },

  /** Só os contadores — usado pelo badge da aba (chamada leve). */
  getMetrics: async (federationId: string): Promise<NoticesSummary> => {
    const res = await request<any>(base(federationId) + "/metrics");
    return normalizeSummary(res);
  },

  /**
   * A DECISÃO da federação. `kept` não toca no praticante; `inactivated` e
   * `transferred` sim — e são escopados pelo dojô que avisou (409
   * PRATICANTE_JA_SAIU_DO_DOJO quando a pessoa já saiu de lá).
   */
  decide: async (
    federationId: string,
    noticeId: string,
    body: DecideNoticeBody
  ): Promise<DecideNoticeResult> => {
    const res = await request<any>(base(federationId) + "/" + noticeId + "/decision", {
      method: "POST",
      body: {
        decision: body.decision,
        note: body.note && body.note.trim() ? body.note.trim() : undefined,
        destination_dojo_id: body.decision === "transferred" ? body.destination_dojo_id : undefined,
      },
      // Uma decisão é um ato humano irrepetível: sem retry automático. Se
      // a rede cair depois do POST, o retry cairia em 409 AVISO_JA_DECIDIDO
      // e a tela mostraria erro para uma operação que DEU CERTO.
      retry: 0,
    });
    const effect = res?.effect && typeof res.effect === "object" ? res.effect : {};
    return {
      notice: res?.notice ? normalizeNotice(res.notice) : null,
      effect: {
        practitioner_changed: effect.practitioner_changed === true,
        is_active: typeof effect.is_active === "boolean" ? effect.is_active : undefined,
        moved_to_dojo_id: str(effect.moved_to_dojo_id),
        moved_to_dojo_name: str(effect.moved_to_dojo_name),
      },
    };
  },
};
