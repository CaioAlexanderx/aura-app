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
