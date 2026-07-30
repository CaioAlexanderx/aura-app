// ============================================================
// AURA DOJÔ — F2: Alunos do dojô (registro PRÓPRIO) + responsáveis
//
// Cliente tipado do Aura-backend PR #403 (src/routes/karateDojoStudents.js,
// migration 242). Base: /federation/:id/dojo — Bearer = JWT normal do app
// via request() core (Canal A; o portal Canal B é somente leitura e NÃO
// usa este service).
//
// DECISÃO CENTRAL (F2): o aluno do dojô NÃO é o praticante federado
// (karate_practitioners/customers). É registro próprio em
// karate_dojo_students; practitioner_id fica NULL até o modelo de sync
// com a FPKT ser definido.
//
// F5a (Aura-backend#425 + migration 253): o sensei DECLARA se o aluno é
// federado; a federação CONFIRMA. Não federado = privado do dojô
// (mensalidade/turma/presença). Federado = existe também no cadastro da
// federação. practitioner_id deixa de ser sempre NULL: passa a apontar
// pro praticante assim que o vínculo é efetivado (número FPKT existente
// OU aprovação de uma solicitação — a aprovação em si é tratada pelo
// fluxo de filiação, não por este service).
//
// Vive num service pequeno separado: karateApi.ts tem 125 KB e a regra
// da casa é edição cirúrgica (mesmo racional do karateDojoInfoApi).
//
// Regra da casa "dado faltante ≠ pendência": todo campo além de
// full_name é opcional — o backend só recusa dado INVÁLIDO (422) e
// menor de 18 sem responsável (422 MENOR_SEM_RESPONSAVEL, LGPD).
//
// QA prod 30/07 (item 1, regressão): Aura-backend#429 introduziu
// paginação em GET .../students (default limit=100, máximo 500 — antes
// era LIMIT 1000 fixo, sem paginação real). Dojô com >100 alunos via só
// os 100 primeiros, e busca/filtros da tela (client-side) não alcançam
// quem ficou de fora. `limit`/`offset` abaixo deixam o caller pedir o
// teto (DOJO_STUDENTS_MAX_LIMIT) — paginação de verdade fica pra depois;
// por ora, ninguém pode sumir em silêncio.
// ============================================================
import { request } from "@/services/api";

export type DojoStudentStatus = "active" | "inactive";
export type DojoStudentSex = "M" | "F" | "other";
/** 'none' (nunca pediu) · 'pending' (solicitação enviada à federação) · 'linked' (federado). */
export type DojoStudentFederationLinkStatus = "none" | "pending" | "linked";

export interface DojoGuardian {
  id: string;
  full_name: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  /** Presente no GET /guardians (contagem de alunos vinculados). */
  students_count?: number;
  created_at?: string;
  updated_at?: string;
}

/** Responsável embutido no aluno (lista traz um subconjunto; ficha traz cpf/email também). */
export interface DojoStudentGuardianRef {
  id: string;
  full_name: string | null;
  phone: string | null;
  relationship: string | null;
  cpf?: string | null;
  email?: string | null;
}

export interface DojoStudent {
  id: string;
  full_name: string;
  /** 'YYYY-MM-DD' (date puro — NUNCA new Date() direto; parse manual). */
  birth_date: string | null;
  /** Idade computada pelo backend (tz-safe). */
  age: number | null;
  cpf: string | null;
  sex: DojoStudentSex | null;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  belt_label: string | null;
  belt_order: number | null;
  status: DojoStudentStatus;
  guardian_id: string | null;
  guardian: DojoStudentGuardianRef | null;
  consent_lgpd: boolean;
  notes: string | null;
  /**
   * Vínculo com a FPKT (F5a) — só deixa de ser null quando o vínculo é
   * EFETIVADO (número FPKT existente ou solicitação aprovada). O sensei
   * DECLARA (`federated`); a federação CONFIRMA.
   */
  practitioner_id: string | null;
  /** true quando o aluno existe também no cadastro da federação. */
  federated: boolean;
  /** Número FPKT do praticante vinculado (null se não federado). */
  fpkt_number: string | null;
  /** Nome do praticante na federação (pode divergir do nome cadastrado no dojô). */
  practitioner_name: string | null;
  federation_link_status: DojoStudentFederationLinkStatus;
  /** 'YYYY-MM-DD'. */
  enrolled_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DojoStudentsSummaryBelt {
  belt_label: string | null;
  belt_order: number | null;
  count: number;
}

export interface DojoStudentsSummary {
  total: number;
  active: number;
  inactive: number;
  /** Só alunos ATIVOS contam na pirâmide (regra do backend). */
  by_belt: DojoStudentsSummaryBelt[];
}

export interface DojoStudentsListResponse {
  data: DojoStudent[];
  count: number;
  summary?: DojoStudentsSummary;
  /** true quando a migration 242 ainda não rodou (lista vem vazia). */
  schema_pending?: boolean;
}

export interface DojoGuardiansListResponse {
  data: DojoGuardian[];
  count: number;
  schema_pending?: boolean;
}

/**
 * Payload de criação/edição. Campo ausente (undefined) = não mexe;
 * null/"" = limpa. Espelha validateStudentPayload do backend.
 */
export interface DojoStudentPayload {
  full_name?: string;
  birth_date?: string | null;
  cpf?: string | null;
  sex?: DojoStudentSex | null;
  phone?: string | null;
  email?: string | null;
  photo_url?: string | null;
  belt_label?: string | null;
  belt_order?: number | null;
  status?: DojoStudentStatus;
  guardian_id?: string | null;
  consent_lgpd?: boolean;
  notes?: string | null;
  enrolled_at?: string | null;
}

export interface DojoGuardianPayload {
  full_name?: string;
  cpf?: string | null;
  phone?: string | null;
  email?: string | null;
  relationship?: string | null;
}

/** Linha do import em lote (já parseada pelo front — o backend não lê arquivo). */
export interface DojoImportRow {
  full_name: string;
  birth_date?: string | null;
  cpf?: string | null;
  phone?: string | null;
  email?: string | null;
  belt_label?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
}

export interface DojoImportWarning {
  row: number;
  code: string;
  message: string;
}

export interface DojoImportResult {
  created: number;
  skipped: number;
  warnings: DojoImportWarning[];
}

/** Máximo de linhas por request de import (o front fatia em lotes). */
export const DOJO_IMPORT_MAX_ROWS = 500;

/**
 * Teto de itens por página aceito por GET .../students (Aura-backend#429:
 * default 100, máximo 500). Paginação real ainda não existe no front —
 * telas que precisam da lista inteira do dojô pedem este teto de uma vez
 * (500 cobre folgadamente o dojô típico; acima disso, item de paginação
 * de verdade fica pra outra tarefa — ver DojoStudentsListResponse.count).
 */
export const DOJO_STUDENTS_MAX_LIMIT = 500;

// ── F5a: vínculo com a federação (Aura-backend#425 + migration 253) ─────

/** Praticante encontrado/vinculado ao federar por número FPKT existente. */
export interface FederatedPractitionerRef {
  id: string;
  name: string;
  fpkt_number: string;
}

/** POST .../federate com { fpkt_number } — vínculo IMEDIATO (o back já confirma e liga). */
export interface FederateByNumberResult {
  linked: true;
  practitioner: FederatedPractitionerRef;
  /** true quando o praticante já estava federado em OUTRO dojô (transferência). */
  is_transfer: boolean;
}

/** POST .../federate com { request: true, ...ficha } — cria pedido; a federação decide depois. */
export interface FederateByRequestResult {
  linked: false;
  request_id: string;
  status: "pending";
}

export type FederateResult = FederateByNumberResult | FederateByRequestResult;

/**
 * Ficha H1 exigida pela federação na solicitação de filiação — TODOS os
 * campos abaixo são obrigatórios (o backend valida com 422). guardian_*
 * só entra quando o aluno é menor de 18 (LGPD — mesma regra do cadastro
 * próprio do dojô).
 */
export interface FederationRequestPayload {
  full_name: string;
  /** 'YYYY-MM-DD'. */
  birth_date: string;
  sex: DojoStudentSex;
  cpf: string;
  rg: string;
  phone: string;
  email: string;
  claimed_belt: string;
  zip_code: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  guardian_name?: string;
  guardian_phone?: string;
  guardian_relationship?: string;
}

function qs(params: Record<string, string | undefined>): string {
  const parts: string[] = [];
  for (const k of Object.keys(params)) {
    const v = params[k];
    if (v != null && v !== "") parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

const base = (federationId: string) => `/federation/${federationId}/dojo`;

export const karateDojoStudentsApi = {
  listStudents: (
    federationId: string,
    opts: {
      status?: DojoStudentStatus;
      q?: string;
      belt?: string;
      summary?: boolean;
      /** Ausente = todos; convive com status/q/belt. */
      federated?: boolean;
      /** Aura-backend#429: default 100, máximo 500 (ver DOJO_STUDENTS_MAX_LIMIT). */
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<DojoStudentsListResponse> =>
    request<DojoStudentsListResponse>(
      `${base(federationId)}/students${qs({
        status: opts.status,
        q: opts.q,
        belt: opts.belt,
        summary: opts.summary ? "1" : undefined,
        federated: opts.federated == null ? undefined : String(opts.federated),
        limit: opts.limit == null ? undefined : String(opts.limit),
        offset: opts.offset == null ? undefined : String(opts.offset),
      })}`
    ),

  getStudent: (federationId: string, studentId: string): Promise<DojoStudent> =>
    request<DojoStudent>(`${base(federationId)}/students/${studentId}`),

  createStudent: (federationId: string, payload: DojoStudentPayload): Promise<DojoStudent> =>
    request<DojoStudent>(`${base(federationId)}/students`, { method: "POST", body: payload }),

  updateStudent: (
    federationId: string,
    studentId: string,
    payload: DojoStudentPayload
  ): Promise<DojoStudent> =>
    request<DojoStudent>(`${base(federationId)}/students/${studentId}`, {
      method: "PATCH",
      body: payload,
    }),

  deleteStudent: (
    federationId: string,
    studentId: string
  ): Promise<{ deleted: boolean; id: string }> =>
    request<{ deleted: boolean; id: string }>(`${base(federationId)}/students/${studentId}`, {
      method: "DELETE",
    }),

  /** Lote ≤ 500 linhas por chamada; o import do backend é TOLERANTE (warnings, não 422). */
  importStudents: (federationId: string, rows: DojoImportRow[]): Promise<DojoImportResult> =>
    request<DojoImportResult>(`${base(federationId)}/students/import`, {
      method: "POST",
      body: { rows },
      // Lote grande numa transação única pode passar dos 10s default.
      timeout: 60000,
    }),

  listGuardians: (federationId: string): Promise<DojoGuardiansListResponse> =>
    request<DojoGuardiansListResponse>(`${base(federationId)}/guardians`),

  createGuardian: (federationId: string, payload: DojoGuardianPayload): Promise<DojoGuardian> =>
    request<DojoGuardian>(`${base(federationId)}/guardians`, { method: "POST", body: payload }),

  updateGuardian: (
    federationId: string,
    guardianId: string,
    payload: DojoGuardianPayload
  ): Promise<DojoGuardian> =>
    request<DojoGuardian>(`${base(federationId)}/guardians/${guardianId}`, {
      method: "PATCH",
      body: payload,
    }),

  /**
   * Federa por número FPKT existente — vínculo IMEDIATO (o back confirma
   * na hora: 200 {linked:true, practitioner, is_transfer}). Erros:
   * 404 FPKT_NUMBER_NOT_FOUND, 409 PRACTITIONER_JA_VINCULADO,
   * 409 JA_FEDERADO, 409 DOJO_NAO_CONECTADO (mapeados em helpers.ts,
   * mapFederationError).
   */
  federateByNumber: (
    federationId: string,
    studentId: string,
    fpktNumber: string
  ): Promise<FederateByNumberResult> =>
    request<FederateByNumberResult>(`${base(federationId)}/students/${studentId}/federate`, {
      method: "POST",
      body: { fpkt_number: fpktNumber },
    }),

  /**
   * Solicita filiação (ficha H1 completa) — cria pedido 'pending'; NÃO
   * federa na hora (a federação decide). Idempotente: repetir o mesmo
   * pedido com o aluno ainda 'pending' devolve o pedido existente em vez
   * de duplicar.
   */
  requestFederation: (
    federationId: string,
    studentId: string,
    payload: FederationRequestPayload
  ): Promise<FederateByRequestResult> =>
    request<FederateByRequestResult>(`${base(federationId)}/students/${studentId}/federate`, {
      method: "POST",
      body: { request: true, ...payload },
    }),

  /** Desvincula — o praticante CONTINUA existindo na federação, só o vínculo com este aluno some. */
  unfederate: (federationId: string, studentId: string): Promise<{ unlinked: boolean }> =>
    request<{ unlinked: boolean }>(`${base(federationId)}/students/${studentId}/federate`, {
      method: "DELETE",
    }),
};
