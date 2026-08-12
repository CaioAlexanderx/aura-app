// ============================================================
// AURA KARATÊ — Filiação do dojô à federação (F6) + apontamento de
// registro no aceite (F11)
//
// Duas pontas do MESMO fluxo (Aura-backend#424 + migration 252):
//   • Lado DOJÔ (JWT do dojô)       — GET/POST /federation/:id/dojo/connection
//   • Lado FEDERAÇÃO (JWT federação) — GET /federation/:id/affiliation-requests[/metrics]
//                                       POST .../:requestId/approve|reject
//
// Vive num service PRÓPRIO e pequeno: services/karateApi.ts já tem 125 KB
// e a regra da casa é edição cirúrgica — nada de tocar nele por uma
// feature nova (mesmo racional de karateDojoInfoApi.ts/karateConnectionsApi.ts).
//
// Normalização DEFENSIVA nas duas pontas: campos ausentes viram null/[]
// em vez de quebrar a UI — mesmo racional de karateDojoInfoApi.ts.
//
// DECISÃO (27/07/2026): a federação NUNCA abre filiação pelo dojô — é
// sempre o dojô self-serve que se filia. `origin`/`requested_by` (migration
// 255), `pending_by_origin` e `openRequest()` (POST /affiliation-requests)
// foram REMOVIDOS daqui — o backend também está revertendo esses campos.
// Contrato self-serve puro: list, metrics, approve, reject.
//
// ── F11 (10/08/2026): APROVAR TAMBÉM É APONTAR ──────────────
// A federação tem 105 dojôs cadastrados como REGISTRO FEDERATIVO (código
// FPKT + praticantes), e o sensei que assina a Aura chega por uma conta
// NOVA e vazia. No aceite a federação diz QUAL daqueles registros é ele
// (`target_company_id`) e a conta do sensei PASSA A SER aquela linha.
// O campo é OPCIONAL: sem ele o aceite é o de sempre (dojô novo).
//
// ⚠️ `dojo_id` da resposta é o do REGISTRO quando houve apontamento — a
// conta que pediu volta em `requester_company_id`. Não trocar um pelo outro.
// ============================================================
import { request } from "@/services/api";

// ── Lado dojô ────────────────────────────────────────────────
export type DojoConnectionStatus = "none" | "pending" | "approved" | "rejected";

export interface DojoConnectionRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

export interface DojoConnectionFederationInfo {
  name: string;
  slug: string;
}

export interface DojoConnectionInfo {
  status: DojoConnectionStatus;
  linked: boolean;
  linked_at: string | null;
  request: DojoConnectionRequest | null;
  federation: DojoConnectionFederationInfo | null;
  /** Migration 252 ainda não aplicada nesse ambiente — degradar, não quebrar. */
  schema_pending: boolean;
}

export interface DojoConnectionRequestBody {
  contact_name: string;
  contact_phone: string;
  contact_email?: string;
  cnpj?: string;
  cpf?: string;
  address?: string;
  city?: string;
  state?: string;
  students_count?: number;
  notes?: string;
}

export interface DojoConnectionCreateResult {
  id: string;
  status: "pending";
  created_at: string;
  already_pending: boolean;
}

// ── Lado federação ───────────────────────────────────────────
export type AffiliationRequestStatus = "pending" | "approved" | "rejected";

export interface AffiliationRequestDojo {
  id: string;
  name: string;
}

export interface AffiliationRequestRow {
  id: string;
  dojo: AffiliationRequestDojo | null;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  cnpj: string | null;
  cpf: string | null;
  city: string | null;
  state: string | null;
  students_count: number | null;
  notes: string | null;
  status: AffiliationRequestStatus;
  created_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

export interface AffiliationRequestsList {
  data: AffiliationRequestRow[];
  count: number;
}

export interface AffiliationOldestPending {
  criada_em: string;
  dias: number;
}

export interface AffiliationRequestsMetrics {
  pending: number;
  approved: number;
  rejected: number;
  mais_antiga: AffiliationOldestPending | null;
}

/**
 * F11 — o que o backend devolve QUANDO houve apontamento de registro.
 * Ausente no aceite comum (dojô novo). Campos opcionais porque a resposta
 * vem crua do backend: `migrated`/`kept_at_source` são objetos livres
 * (tabela → nº de linhas) e a tela só usa o total.
 */
export interface AffiliationAssumption {
  assumed: boolean;
  from_company_id: string | null;
  from_company_name: string | null;
  to_company_id: string | null;
  to_company_name: string | null;
  user_id?: string | null;
  from_company_was_empty?: boolean;
  from_company_discarded?: boolean;
  migrated?: Record<string, number>;
  kept_at_source?: Record<string, number>;
  schema_pending?: string[];
  migrated_rows?: number;
  trail_persisted?: boolean;
}

export interface AffiliationApproveResult {
  ok: boolean;
  /** ⚠️ COM apontamento este é o id do REGISTRO, não o da conta que pediu. */
  dojo_id: string;
  fpkt_affiliation_id: string;
  linked_at: string;
  /** Só quando houve apontamento. */
  assumption?: AffiliationAssumption | null;
  /** Só quando houve apontamento: a conta que pediu (e foi desativada). */
  requester_company_id?: string | null;
  /** Só quando houve apontamento: frase pronta do backend. */
  message?: string | null;
}

export interface AffiliationRejectResult {
  ok: boolean;
}

// ── F11: registros federativos candidatos ────────────────────
// Fonte: GET /federation/:id/dojos — a MESMA rota da lista de dojôs da
// federação. Ela aceita `q` (ILIKE em companies.name OR
// fpkt_affiliation_id), `page` e `pageSize` (camelCase na entrada,
// `page_size` na saída) e devolve as contagens de praticantes por dojô.
//
// ⚠️ LIMITE CONHECIDO DO CONTRATO (F11 front): essa rota NÃO expõe o dono
// do registro (owner_id / "é o usuário-sistema?"), então NÃO existe filtro
// "dojôs desta federação ainda sem dono" e a lista NÃO consegue marcar de
// antemão quais registros já foram reclamados. Quem adjudica é o backend,
// no approve: TARGET_ALREADY_CLAIMED / TARGET_OWNER_INCONSISTENT. A tela
// trata os dois com mensagem própria. Fase de backend pendente: parâmetro
// `unclaimed=true` + booleano por linha.
export interface RegistryCandidate {
  id: string;
  name: string;
  fpkt_affiliation_id: string | null;
  city: string | null;
  state: string | null;
  region: string | null;
  /** DATE puro (YYYY-MM-DD) — formatar sem `new Date()` para não deslocar fuso. */
  affiliation_since: string | null;
  /** karate_annuity_plan: anual|semestral|trimestral, null = federação não definiu. */
  annuity_plan: string | null;
  is_active: boolean;
  practitioner_count: number;
  active_practitioner_count: number | null;
}

export interface RegistryCandidatesPage {
  data: RegistryCandidate[];
  total: number;
  page: number;
  page_size: number;
}

export interface RegistryAnnuityRow {
  reference_period: string | null;
  amount: number | null;
  due_date: string | null;
  paid_at: string | null;
  status: string | null;
}

export interface RegistryAnnuitySummary {
  total: number;
  open_count: number;
  latest: RegistryAnnuityRow | null;
}

function num(v: any): number | null {
  const n = typeof v === "string" ? parseInt(v, 10) : v;
  return typeof n === "number" && isFinite(n) ? n : null;
}
/** numeric do Postgres chega como string ("150.00") — parseInt truncaria. */
function dec(v: any): number | null {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && isFinite(n) ? n : null;
}
function str(v: any): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function normalizeDojoConnection(raw: any): DojoConnectionInfo {
  const r = raw && typeof raw === "object" ? raw : {};
  const validStatus: DojoConnectionStatus[] = ["none", "pending", "approved", "rejected"];
  const status: DojoConnectionStatus = validStatus.includes(r.status) ? r.status : "none";
  return {
    status,
    linked: !!r.linked,
    linked_at: str(r.linked_at),
    request: r.request && typeof r.request === "object"
      ? {
          id: String(r.request.id),
          status: r.request.status,
          created_at: r.request.created_at,
          reviewed_at: str(r.request.reviewed_at),
          rejection_reason: str(r.request.rejection_reason),
        }
      : null,
    federation: r.federation && typeof r.federation === "object"
      ? { name: str(r.federation.name) || "", slug: str(r.federation.slug) || "" }
      : null,
    schema_pending: !!r.schema_pending,
  };
}

function normalizeAffiliationRow(raw: any): AffiliationRequestRow {
  const r = raw && typeof raw === "object" ? raw : {};
  const validStatus: AffiliationRequestStatus[] = ["pending", "approved", "rejected"];
  return {
    id: String(r.id),
    dojo: r.dojo && typeof r.dojo === "object"
      ? { id: String(r.dojo.id), name: str(r.dojo.name) || "Dojô sem nome" }
      : null,
    contact_name: str(r.contact_name) || "",
    contact_phone: str(r.contact_phone) || "",
    contact_email: str(r.contact_email),
    cnpj: str(r.cnpj),
    cpf: str(r.cpf),
    city: str(r.city),
    state: str(r.state),
    students_count: num(r.students_count),
    notes: str(r.notes),
    status: validStatus.includes(r.status) ? r.status : "pending",
    created_at: r.created_at,
    reviewed_at: str(r.reviewed_at),
    rejection_reason: str(r.rejection_reason),
  };
}

// O endereço vem DECOMPOSTO da rota de dojôs (address_city/address_state).
// `city`/`state` aparecem em tipos antigos do repo e são aceitos como
// fallback — ausência aqui é neutra, nunca erro.
function normalizeRegistryCandidate(raw: any): RegistryCandidate {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    id: String(r.id),
    name: str(r.name) || "Registro sem nome",
    fpkt_affiliation_id: str(r.fpkt_affiliation_id),
    city: str(r.address_city) || str(r.city),
    state: str(r.address_state) || str(r.state),
    region: str(r.region),
    affiliation_since: str(r.affiliation_since),
    annuity_plan: str(r.karate_annuity_plan),
    is_active: r.is_active !== false,
    practitioner_count: num(r.practitioner_count) ?? 0,
    active_practitioner_count: num(r.active_practitioner_count),
  };
}

function normalizeRegistryAnnuityRow(raw: any): RegistryAnnuityRow {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    reference_period: str(r.reference_period),
    amount: dec(r.amount),
    due_date: str(r.due_date),
    paid_at: str(r.paid_at),
    status: str(r.status),
  };
}

export const karateAffiliationApi = {
  // ── Lado dojô ──────────────────────────────────────────────
  getConnection: async (federationId: string): Promise<DojoConnectionInfo> =>
    normalizeDojoConnection(await request<any>(`/federation/${federationId}/dojo/connection`)),

  requestConnection: (
    federationId: string,
    body: DojoConnectionRequestBody
  ): Promise<DojoConnectionCreateResult> =>
    request(`/federation/${federationId}/dojo/connection`, { method: "POST", body }),

  // ── Lado federação ─────────────────────────────────────────
  listRequests: async (
    federationId: string,
    status?: AffiliationRequestStatus
  ): Promise<AffiliationRequestsList> => {
    const qs = status ? `?status=${status}` : "";
    const res = await request<any>(`/federation/${federationId}/affiliation-requests${qs}`);
    const data = Array.isArray(res?.data) ? res.data.map(normalizeAffiliationRow) : [];
    return { data, count: typeof res?.count === "number" ? res.count : data.length };
  },

  getMetrics: async (federationId: string): Promise<AffiliationRequestsMetrics> => {
    const res = await request<any>(`/federation/${federationId}/affiliation-requests/metrics`);
    const r = res && typeof res === "object" ? res : {};
    return {
      pending: num(r.pending) ?? 0,
      approved: num(r.approved) ?? 0,
      rejected: num(r.rejected) ?? 0,
      mais_antiga: r.mais_antiga ?? null,
    };
  },

  // ── F11: busca de registros candidatos ─────────────────────
  // São 105 registros: a tela EXIGE busca (nome ou número FPKT) e nunca
  // despeja a lista inteira. `pageSize` é intencionalmente pequeno — o
  // objetivo é reconhecer o dojô, não paginar um catálogo.
  listRegistryCandidates: async (
    federationId: string,
    opts: { q?: string; page?: number; pageSize?: number } = {}
  ): Promise<RegistryCandidatesPage> => {
    const qs = new URLSearchParams();
    const q = (opts.q || "").trim();
    if (q) qs.set("q", q);
    qs.set("page", String(opts.page && opts.page > 0 ? opts.page : 1));
    qs.set("pageSize", String(opts.pageSize && opts.pageSize > 0 ? opts.pageSize : 8));
    const res = await request<any>(`/federation/${federationId}/dojos?${qs.toString()}`);
    const data = Array.isArray(res?.data) ? res.data.map(normalizeRegistryCandidate) : [];
    return {
      data,
      total: num(res?.total) ?? data.length,
      page: num(res?.page) ?? 1,
      // saída é `page_size` (snake); `pageSize` aceito por segurança.
      page_size: num(res?.page_size) ?? num(res?.pageSize) ?? data.length,
    };
  },

  // ── F11: anuidade do registro, só para a PRÉVIA ────────────
  // A lista de dojôs não carrega anuidade (só o PLANO); o histórico real
  // vive no detalhe. É consulta de enfeite da prévia: qualquer falha vira
  // `null` e a tela simplesmente não mostra o bloco — nunca um erro que
  // atrapalhe a aprovação.
  getRegistryAnnuity: async (
    federationId: string,
    dojoId: string
  ): Promise<RegistryAnnuitySummary | null> => {
    try {
      const res = await request<any>(`/federation/${federationId}/dojos/${dojoId}`);
      const raw = Array.isArray(res?.annuity_history) ? res.annuity_history : [];
      const rows: RegistryAnnuityRow[] = raw.map(normalizeRegistryAnnuityRow);
      return {
        total: rows.length,
        open_count: rows.filter((r) => !r.paid_at).length,
        // o backend já devolve ORDER BY reference_period DESC
        latest: rows.length ? rows[0] : null,
      };
    } catch {
      return null;
    }
  },

  /**
   * Aprovar = conectar. E, quando `targetCompanyId` vem, também APONTAR:
   * a conta do sensei passa a SER aquele registro federativo.
   * Sem `targetCompanyId` o corpo é exatamente o de antes (dojô novo).
   */
  approve: (
    federationId: string,
    requestId: string,
    fpktNumber: string,
    targetCompanyId?: string | null
  ): Promise<AffiliationApproveResult> => {
    const target = (targetCompanyId || "").trim();
    return request(`/federation/${federationId}/affiliation-requests/${requestId}/approve`, {
      method: "POST",
      body: target
        ? { fpkt_number: fpktNumber, target_company_id: target }
        : { fpkt_number: fpktNumber },
    });
  },

  reject: (
    federationId: string,
    requestId: string,
    reason: string
  ): Promise<AffiliationRejectResult> =>
    request(`/federation/${federationId}/affiliation-requests/${requestId}/reject`, {
      method: "POST",
      body: { reason },
    }),
};
