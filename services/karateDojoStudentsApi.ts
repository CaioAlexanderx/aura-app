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
// F5b (30/07 — Aura-backend#447 + migration 262): DECISÃO DE PRODUTO —
// o fluxo de informação SOBE (dojô → federação). O dojô é fonte da
// identidade da pessoa; vincular um aluno a um praticante passa a dar ao
// dojô o direito de sobrescrever a ficha daquela pessoa na federação. Até
// aqui, POST .../federate com { fpkt_number } vinculava IMEDIATO — o
// backend gravava antes de qualquer conferência (achado em prod: aluna de
// 12 anos vinculada a praticante nascido em 2020, CPF diferente, sem
// aviso algum). Agora a MESMA rota primeiro faz PREVIEW (não grava) e só
// grava com { fpkt_number, confirm: true, resolution }. Ver
// previewFederateByNumber/confirmFederateByNumber abaixo.
//
// F7.0 (30/07 — Aura-backend#446/#447/#448 + migration 262): o aluno do
// dojô ganhou os campos que faltavam para o dojô SER a fonte da
// identidade: rg + endereço completo (zip_code/street/number/complement/
// neighborhood/city/state) — mesmo vocabulário que o lado da federação já
// usa (customers), para a sincronização dojô→federação (F7.2) ser cópia
// coluna-a-coluna. Foto NÃO entra aqui: karate_dojo_students não tem
// endpoint de upload próprio (photo_url é campo morto desde a 242) — sem
// endpoint, não há UI a construir.
//
// F8.2 (01/08 — pedido do Caio: ficha do aluno igual à ficha do
// praticante da federação; endpoint de foto criado em PR paralelo do
// backend, mesmo padrão do upload de foto do praticante): o aluno ganha
// um campo PERMANENTE de foto (karate_photo_url, gravado pelo backend
// após o upload — mesmo racional de karate_photo_url no praticante) e o
// endpoint dedicado POST .../students/:sid/photo (uploadStudentPhoto,
// abaixo). O antigo `photo_url` (campo morto da 242, nunca teve endpoint)
// segue aqui só por compatibilidade — não usar para leitura/escrita novas.
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
  /** F7.0 (migration 262) — o dojô é fonte da identidade da pessoa. */
  rg: string | null;
  sex: DojoStudentSex | null;
  phone: string | null;
  email: string | null;
  /** F7.0 (migration 262) — mesmo vocabulário de customers, para a sincronização F7.2 ser cópia coluna-a-coluna. */
  zip_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  /** Campo morto desde a migration 242 (nunca teve endpoint de upload) — mantido só por compatibilidade. Não usar para leitura/escrita novas; ver karate_photo_url abaixo. */
  photo_url: string | null;
  /**
   * F8.2 (01/08/2026) — foto do aluno, mesmo padrão do karate_photo_url do
   * praticante: gravado pelo backend após POST .../students/:id/photo
   * (uploadStudentPhoto, abaixo). Este é o campo PERMANENTE a usar na UI
   * (preview da ficha, avatar) — `photo_url` acima é legado/morto.
   */
  karate_photo_url: string | null;
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
  /** F7.0 (migration 262). */
  rg?: string | null;
  sex?: DojoStudentSex | null;
  phone?: string | null;
  email?: string | null;
  /** F7.0 (migration 262) — endereço completo, mesmo vocabulário de customers. */
  zip_code?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
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

// ── F5a: solicitação de filiação (Aura-backend#425 + migration 253) ─────

/** POST .../federate com { request: true, ...ficha } — cria pedido; a federação decide depois. */
export interface FederateByRequestResult {
  linked: false;
  request_id: string;
  status: "pending";
}

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

// ── F5b: vínculo por número FPKT — PREVIEW (não grava) + CONFIRM (grava) ──
// (Aura-backend#447 + migration 262 — ver nota de decisão no topo do
// arquivo). Mesma rota POST .../students/:sid/federate: sem `confirm`,
// devolve o praticante encontrado e a comparação campo a campo, SEM
// gravar nada; com `confirm: true`, grava.

export type FederationCompareSide = "dojo" | "federation";

/** Praticante encontrado ao pré-visualizar/confirmar o vínculo por número FPKT. */
export interface FederationPractitionerInfo {
  id: string;
  name: string;
  fpkt_number: string;
  dojo_id: string | null;
  dojo_name: string | null;
  is_active: boolean;
  identity_managed_by: string | null;
}

/** Um dos campos comparados dojô × federação (sempre 15, nome/nascimento/CPF/RG/sexo/telefone/e-mail/endereço por campo/foto). */
export interface FederationComparisonField {
  field: string;
  label: string;
  dojo_value: string | null;
  federation_value: string | null;
  /** Dado ausente de um lado NUNCA é divergência (regra da casa: ausente ≠ inválido). */
  diverges: boolean;
  /** "dojo" | "federation" | null (null quando os dois lados estão vazios ou iguais). */
  suggested: FederationCompareSide | null;
}

/** Motivo pelo qual a confirmação está bloqueada (ex.: CPF_CONFLITANTE — sem override possível). */
export interface FederationBlocker {
  code: string;
  message: string;
}

/** Resposta do preview (não grava nada). */
export interface FederatePreviewResult {
  preview: true;
  practitioner: FederationPractitionerInfo;
  /** true quando o praticante já está federado em OUTRO dojô — vincular aqui transfere. */
  is_transfer: boolean;
  /** false → a confirmação fica indisponível; ver `blockers`. */
  can_link: boolean;
  blockers: FederationBlocker[];
  comparison: FederationComparisonField[];
}

/** field → qual lado vale ("dojo" | "federation"); campo omitido usa o `suggested` do preview. */
export type FederationResolution = Record<string, FederationCompareSide>;

/** Um campo que foi de fato sobrescrito na confirmação. */
export interface FederationAppliedField {
  field: string;
  from: string | null;
  value: string | null;
}

/** Resposta da confirmação (grava — efetiva o vínculo e aplica a resolução campo a campo). */
export interface FederateConfirmResult {
  linked: true;
  practitioner: FederationPractitionerInfo;
  applied: FederationAppliedField[];
  is_transfer: boolean;
}

// ── F8.2: upload de foto do aluno (mesmo padrão do praticante, ver
// karateApi.ts#uploadPractitionerPhoto) — endpoint criado em PR paralelo
// do backend. ─────────────────────────────────────────────────────────

export interface UploadStudentPhotoInput {
  /** Base64 puro, sem prefixo "data:<type>;base64,". */
  content: string;
  content_type?: "image/jpeg" | "image/png" | "image/webp";
}

export interface UploadStudentPhotoResult {
  photo_url: string;
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
   * F5b: pré-visualiza o vínculo por número FPKT — NÃO grava nada. Devolve
   * o praticante encontrado, se é transferência (`is_transfer`), se o
   * vínculo pode acontecer (`can_link`; se false, ver `blockers`) e a
   * comparação campo a campo dojô × federação (`comparison` — 15 campos
   * sempre presentes; dado ausente de um lado nunca é divergência).
   * Erros: 404 FPKT_NUMBER_NOT_FOUND, 409 DOJO_NAO_CONECTADO (mapeados em
   * helpers.ts, mapFederationError). Bloqueios como CPF_CONFLITANTE vêm
   * no corpo 200 (`blockers`), não como exceção.
   */
  previewFederateByNumber: (
    federationId: string,
    studentId: string,
    fpktNumber: string
  ): Promise<FederatePreviewResult> =>
    request<FederatePreviewResult>(`${base(federationId)}/students/${studentId}/federate`, {
      method: "POST",
      body: { fpkt_number: fpktNumber },
    }),

  /**
   * F5b: confirma o vínculo depois da conferência — grava. `resolution`
   * decide, campo a campo, qual lado vale ("dojo" | "federation"); campo
   * omitido usa o `suggested` do preview. A partir daqui o CADASTRO
   * daquela pessoa na federação passa a ser mantido pelo dojô (fluxo de
   * informação sobe — decisão de produto 30/07). Erros: os do preview +
   * 409 CPF_CONFLITANTE (sem override — corrigir o cadastro ou usar outro
   * número), 409 PRATICANTE_JA_VINCULADO (nome novo do código; o backend
   * também manda `legacy_code: "PRACTITIONER_JA_VINCULADO"` durante a
   * transição — tratar os dois, ver mapFederationError), 503
   * SCHEMA_PENDING_262 (migration 262 ainda não aplicada neste ambiente —
   * o preview funciona normalmente, só a confirmação falha).
   */
  confirmFederateByNumber: (
    federationId: string,
    studentId: string,
    fpktNumber: string,
    resolution?: FederationResolution
  ): Promise<FederateConfirmResult> =>
    request<FederateConfirmResult>(`${base(federationId)}/students/${studentId}/federate`, {
      method: "POST",
      body: { fpkt_number: fpktNumber, confirm: true, resolution: resolution ?? {} },
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

  /**
   * Desvincula — devolve a gestão da ficha à federação: o dojô deixa de
   * poder sobrescrever os dados dessa pessoa por aqui. O praticante
   * CONTINUA existindo no cadastro da federação, só o vínculo com este
   * aluno some.
   */
  unfederate: (federationId: string, studentId: string): Promise<{ unlinked: boolean }> =>
    request<{ unlinked: boolean }>(`${base(federationId)}/students/${studentId}/federate`, {
      method: "DELETE",
    }),

  /**
   * F8.2 (01/08/2026): faz upload da foto do aluno — mesmo mecanismo de
   * karateApi.ts#uploadPractitionerPhoto (JSON + base64 → R2, endpoint
   * criado em PR paralelo do backend).
   *
   * POST /federation/:federationId/dojo/students/:studentId/photo
   * Body: { content: "<base64 puro>", content_type?: "image/jpeg"|"image/png"|"image/webp" }
   * Resposta: { photo_url: "https://r2..." }
   *
   * O backend grava karate_photo_url no banco — não é necessário enviar
   * karate_photo_url no PATCH do aluno após esta chamada.
   */
  uploadStudentPhoto: (
    federationId: string,
    studentId: string,
    body: UploadStudentPhotoInput
  ): Promise<UploadStudentPhotoResult> =>
    request<UploadStudentPhotoResult>(`${base(federationId)}/students/${studentId}/photo`, {
      method: "POST",
      body,
    }),
};
