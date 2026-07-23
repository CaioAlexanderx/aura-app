// ============================================================
// KARATE CARD API — Aura Karatê (Track D / Fase 3)
//
// Endpoints da Carteirinha Digital + verificação pública.
// Contrato: docs/karate-fase3-openapi.yaml v0.3.3 (Aura-backend #162).
//
// Mantido SEPARADO de services/karateApi.ts (Fases 0–2) para que a camada
// Track D evolua sem tocar no arquivo grande. Reaproveita o request() core
// (Bearer JWT) nas rotas autenticadas e usa fetch direto (sem auth) para o
// verify público.
// ============================================================
import { request } from "@/services/api";

export type CardStatus = "active" | "revoked";

export interface MembershipCard {
  id: string;
  federation_id: string;
  student_id: string;
  student_name: string;
  /** Apenas contexto autenticado (admin/holder) — NUNCA no verify público. */
  birth_date?: string | null;
  /** Apenas contexto autenticado (admin/holder) — NUNCA no verify público. */
  cpf?: string | null;
  card_number: string | null;
  /** Nº CBKT da faixa vigente (aparece na carteirinha do faixa-preta). */
  cbkt_number?: string | null;
  belt: string | null;        // nível (ex.: "2dan")
  belt_name: string | null;   // nome PT (ex.: "Preta")
  dojo_id: string | null;
  dojo_name: string | null;
  photo_url: string | null;
  is_minor: boolean;
  issued_at: string;
  verify_token: string;
  status: CardStatus;          // carteirinha SEM validade por tempo: active | revoked
  /** Logo/nome da federação emissora (companies.karate_logo_url/logo_url). Usado no header da carteirinha. */
  federation_name?: string | null;
  federation_logo?: string | null;
}

export interface IssueCardResult extends MembershipCard {
  renewed?: boolean;
  warnings?: string[];
  _note?: string;
}

export interface CardListItem {
  id: string;
  student_id: string;
  student_name: string;
  card_number: string | null;
  belt_name: string | null;
  dojo_name: string | null;
  is_minor: boolean;
  status: CardStatus;
  issued_at: string;
}

export interface IssueBatchResult {
  eligible: number;
  issued: number;
  errors: Array<{ student_id: string; error: string }>;
  _note?: string;
}

// ── Fila de impressão (migration 233 — sisteminha de gestão) ────────
// Estados sobre a MESMA linha de karate_membership_cards:
//   'to_print' (gerada, esperando) -> 'printed' (clique em imprimir,
//   NÃO é prova de impressão real) -> 'delivered' (só confirmação manual).
//   'out_of_queue' — ramo lateral a partir de 'to_print' (aura-backend#402):
//   a federação tira da fila pra controlar o que imprime de fato. NÃO é
//   revogação — a carteirinha continua ativa/válida. 'return-to-queue'
//   devolve pra 'to_print' (mesma rota usada por "Não saiu / reimprimir").
//   Só aceita tirar da fila a partir de 'to_print' — 'printed'/'delivered'
//   são recusados pelo backend.
export type PrintStatus = "to_print" | "printed" | "delivered" | "out_of_queue";

export interface QueueItem {
  id: string;
  student_id: string;
  student_name: string;
  card_number: string | null;
  belt_name: string | null;
  dojo_id: string | null;
  dojo_name: string | null;
  is_minor: boolean;
  print_status: PrintStatus;
  issued_at: string;
  printed_at: string | null;
  delivered_at: string | null;
  /** Preenchido quando a carteirinha é tirada da fila (aba "Fora da fila"). Carteirinha CONTINUA VÁLIDA — isto não é revogação. */
  out_of_queue_at: string | null;
  /** Nº de vezes que a carteirinha foi de fato marcada como impressa. 1 = 1ª via. */
  print_count: number;
}

export interface QueueCounters {
  to_print: number;
  printed: number;
  delivered: number;
  out_of_queue: number;
}

export interface QueueDojoBreakdown {
  dojo_id: string | null;
  dojo_name: string;
  count: number;
}

export interface QueueListResult {
  page: number;
  page_size: number;
  total: number;
  print_status: PrintStatus;
  counters: QueueCounters;
  dojos: QueueDojoBreakdown[];
  data: QueueItem[];
}

export interface QueueMutationResult {
  ok: string[];
  errors: Array<{ id: string; error: string }>;
  total: number;
  _note?: string;
}

/** Situação pública — derivada da ANUIDADE CPF (não do cartão; o cartão só vira revogada). */
export type VerifyStatus = "valida" | "vencida" | "revogada";

export interface CardVerification {
  valid: boolean;
  status: VerifyStatus;
  validade: string | null;      // due_date da anuidade (referência) ou null
  belt: string | null;          // nível (ex.: "2dan")
  belt_name: string | null;     // nome PT (ex.: "Preta")
  belt_since: string | null;
  dojo_name: string | null;
  federation_name: string | null;
  federation_logo: string | null;
  is_minor: boolean;
  display_name: string;         // menor → "Primeiro S."
  card_number: string | null;   // mantido mesmo p/ menor (decisão FPKT)
}

interface Paginated<T> {
  page: number;
  page_size: number;
  total: number;
  data: T[];
}

function apiBase(): string {
  return (
    (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
    "https://aura-backend-production-f805.up.railway.app/api/v1"
  );
}

// ── Carteirinha virtual (link compartilhável, PR aura-backend#416/#417) ──
// Contexto mínimo pré-identidade — GET /public/karate/card/{token}.
export interface CardTokenPreview {
  requires_identity: true;
  dojo_name: string | null;
  federation_name: string | null;
  federation_logo: string | null;
}

// Cartão completo devolvido por POST /public/karate/card/{token}/verify
// após identidade confirmada. Shape próximo de MembershipCard, mas sem
// id/federation_id/student_id/dojo_id (o endpoint público não expõe IDs
// internos) e com revoked_at.
export interface VirtualCardResult {
  card_number: string | null;
  cbkt_number: string | null;
  student_name: string;
  birth_date: string | null;
  cpf: string | null;
  belt: string | null;
  belt_name: string | null;
  dojo_name: string | null;
  photo_url: string | null;
  is_minor: boolean;
  issued_at: string;
  revoked_at: string | null;
  status: CardStatus;
  verify_token: string;
  federation_name: string | null;
  federation_logo: string | null;
}

export interface CardIdentityInput {
  /** dd/mm/aaaa OU yyyy-mm-dd — o backend normaliza os dois formatos. */
  birth_date?: string;
  rg?: string;
  cpf?: string;
}

export const karateCardApi = {
  /** POST /federation/{id}/practitioners/{pid}/issue-card — emite/renova (staffWrite). */
  issueCard: (federationId: string, practitionerId: string): Promise<IssueCardResult> =>
    request(`/federation/${federationId}/practitioners/${practitionerId}/issue-card`, {
      method: "POST",
      body: {},
    }),

  /** GET /federation/{id}/practitioners/{pid}/card — carteirinha atual (read). 404 se inexistente. */
  getCard: (federationId: string, practitionerId: string): Promise<MembershipCard> =>
    request(`/federation/${federationId}/practitioners/${practitionerId}/card`),

  /** GET /federation/{id}/cards — listagem interna (read). */
  listCards: (
    federationId: string,
    params?: { status?: CardStatus; page?: number; pageSize?: number }
  ): Promise<Paginated<CardListItem>> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/cards${query}`);
  },

  /** POST /federation/{id}/cards/issue-batch — emissão em lote (adminOnly). */
  issueBatch: (
    federationId: string,
    body?: { only_missing?: boolean }
  ): Promise<IssueBatchResult> =>
    request(`/federation/${federationId}/cards/issue-batch`, {
      method: "POST",
      body: body ?? { only_missing: true },
    }),

  // ── Fila de impressão ────────────────────────────────────────
  /** GET /federation/{id}/cards/queue — lista de UMA etapa + contadores + dojôs. */
  listQueue: (
    federationId: string,
    params?: { print_status?: PrintStatus; dojo_id?: string; search?: string; page?: number; pageSize?: number }
  ): Promise<QueueListResult> => {
    const qs = new URLSearchParams();
    if (params?.print_status) qs.set("print_status", params.print_status);
    if (params?.dojo_id) qs.set("dojo_id", params.dojo_id);
    if (params?.search) qs.set("search", params.search);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/cards/queue${query}`);
  },

  /** POST /federation/{id}/cards/queue/mark-printed — "Imprimir selecionadas" (staffWrite). */
  markPrinted: (federationId: string, cardIds: string[]): Promise<QueueMutationResult> =>
    request(`/federation/${federationId}/cards/queue/mark-printed`, {
      method: "POST",
      body: { card_ids: cardIds },
    }),

  /** POST /federation/{id}/cards/queue/mark-delivered — confirmação manual (staffWrite). */
  markDelivered: (federationId: string, cardIds: string[]): Promise<QueueMutationResult> =>
    request(`/federation/${federationId}/cards/queue/mark-delivered`, {
      method: "POST",
      body: { card_ids: cardIds },
    }),

  /** POST /federation/{id}/cards/queue/return-to-queue — "não saiu" / reimprimir / devolver da aba "Fora da fila" (staffWrite). */
  returnToQueue: (federationId: string, cardIds: string[]): Promise<QueueMutationResult> =>
    request(`/federation/${federationId}/cards/queue/return-to-queue`, {
      method: "POST",
      body: { card_ids: cardIds },
    }),

  /**
   * POST /federation/{id}/cards/queue/remove-from-queue — "Tirar da fila" (staffWrite).
   * Só aceito a partir de 'to_print' (backend recusa printed/delivered — erro por
   * item, ver QueueMutationResult.errors). A carteirinha CONTINUA VÁLIDA, isto
   * NÃO é revogação — só sai da fila de impressão (PR aura-backend#402).
   */
  removeFromQueue: (federationId: string, cardIds: string[]): Promise<QueueMutationResult> =>
    request(`/federation/${federationId}/cards/queue/remove-from-queue`, {
      method: "POST",
      body: { card_ids: cardIds },
    }),

  /**
   * GET /public/karate/verify/{token} — verificação PÚBLICA (sem auth).
   * Retorna null quando o token não corresponde a nenhuma carteirinha (404).
   */
  verifyCard: async (token: string): Promise<CardVerification | null> => {
    const res = await fetch(
      `${apiBase()}/public/karate/verify/${encodeURIComponent(token)}`,
      { headers: { Accept: "application/json" } }
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Falha ao verificar registro (${res.status})`);
    return res.json();
  },

  /**
   * GET /public/karate/card/{token} — carteirinha VIRTUAL, passo LEVE
   * (pré-identidade, PR aura-backend#417). Devolve só contexto mínimo —
   * dojô/federação — SEM foto, nome, CPF, RG ou nascimento (o backend nem
   * faz JOIN em customers nesse passo, defesa em profundidade). O cartão
   * CHEIO só sai depois de confirmar identidade em verifyCardIdentity.
   * Retorna null em 404 (token não corresponde a nenhuma carteirinha).
   */
  getCardPreview: async (token: string): Promise<CardTokenPreview | null> => {
    const res = await fetch(
      `${apiBase()}/public/karate/card/${encodeURIComponent(token)}`,
      { headers: { Accept: "application/json" } }
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Falha ao carregar carteirinha (${res.status})`);
    return res.json();
  },

  /**
   * POST /public/karate/card/{token}/verify — gate de identidade que libera
   * o cartão CHEIO (com foto) da carteirinha virtual (PR aura-backend#417).
   * Body: { birth_date?, rg?, cpf? } — QUALQUER UM que bata com o
   * praticante dono do token libera. birth_date aceita "dd/mm/aaaa" OU
   * "yyyy-mm-dd" (o backend normaliza os dois formatos).
   *
   * Erros com `.code`:
   *   IDENTITY_MISMATCH (403) — token inexistente OU identidade errada;
   *     PROPOSITALMENTE indistinguíveis (anti-oráculo) — nunca revelar ao
   *     usuário qual dos dois aconteceu.
   *   VALIDATION_ERROR  (422) — nenhum campo plausível informado.
   *   RATE_LIMITED      (429) — 10 tentativas / 10 min por token+IP.
   *   NOT_FOUND         (404) — token com formato inválido (erro de input).
   */
  verifyCardIdentity: async (token: string, identity: CardIdentityInput): Promise<VirtualCardResult> => {
    const res = await fetch(
      `${apiBase()}/public/karate/card/${encodeURIComponent(token)}/verify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(identity),
      }
    );
    if (res.status === 403) {
      const e: any = new Error("Não foi possível confirmar sua identidade.");
      e.code = "IDENTITY_MISMATCH";
      throw e;
    }
    if (res.status === 422) {
      const e: any = new Error("Informe data de nascimento, RG ou CPF válidos.");
      e.code = "VALIDATION_ERROR";
      throw e;
    }
    if (res.status === 429) {
      const e: any = new Error("Muitas tentativas. Aguarde alguns minutos.");
      e.code = "RATE_LIMITED";
      throw e;
    }
    if (res.status === 404) {
      const e: any = new Error("Carteirinha não encontrada.");
      e.code = "NOT_FOUND";
      throw e;
    }
    if (!res.ok) throw new Error(`Falha ao confirmar identidade (${res.status})`);
    return res.json();
  },

  /**
   * POST /public/karate/verify/{token}/card — cópia digital autenticada (Item 6).
   * O praticante informa RG ou CPF; se conferir, devolve o cartão completo para
   * gerar o PDF frente/verso. Cadastro sem RG/CPF → { no_identity, whatsapp }.
   * Sem match → lança CardCopyMismatchError.
   */
  generateCardCopy: async (token: string, identifier: string): Promise<CardCopyResult> => {
    const res = await fetch(
      `${apiBase()}/public/karate/verify/${encodeURIComponent(token)}/card`,
      { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ identifier }) }
    );
    if (res.status === 404) throw new Error("Carteirinha não encontrada.");
    if (res.status === 401) { const e: any = new Error("RG ou CPF não confere com o cadastro."); e.code = "IDENTITY_MISMATCH"; throw e; }
    if (!res.ok) throw new Error(`Falha ao gerar cópia (${res.status})`);
    return res.json();
  },
};

export type CardCopyResult =
  | { card: MembershipCard }
  | { no_identity: true; whatsapp: string | null; federation_name: string | null };
