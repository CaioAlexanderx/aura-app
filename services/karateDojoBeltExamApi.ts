// ============================================================
// AURA DOJÔ — F10: exame de faixa do dojô (kyu) — cliente
//
// Base /federation/:id/dojo/graduation-exams (Aura-backend,
// src/routes/karateDojoBeltExams.js — migrations 264/265/272, EM
// PRODUÇÃO há dias sem nenhuma tela consumindo). NÃO confundir com
// /dojo/belt-exams/:examId/candidates (karateDojoFederativoApi.ts): aquele
// é o dojô SUBMETENDO candidatos à banca DA FEDERAÇÃO (faixa preta,
// dan). Este é o SENSEI graduando os próprios alunos até Marrom 1º kyu —
// ato interno do dojô, sem gate de conexão (dojô sem filiação também
// gradua os próprios alunos).
//
// A hierarquia dos três quesitos (Kihon/Kata/Kumite) é 〇 círculo >
// △ triângulo > □ quadrado (fonte: karateDojoBeltExamService.js,
// QUESITO_RANK). O valor trafega como texto nomeado
// ('circulo'|'triangulo'|'quadrado') — o símbolo é decisão de
// apresentação da UI, nunca do dado.
//
// O lançamento em lote (submitResults) é tudo-ou-nada: um item inválido
// devolve 422 com `errors: [{student_id, code, message}]` e NADA é
// gravado — diferente do idioma "skipped" de karateDojoEventsApi/
// karateDojoFederativoApi. `submitResults` propaga o ApiError como está
// (e.data.errors) para a tela decidir como mostrar por aluno.
//
// Normalização DEFENSIVA (mesmo racional dos irmãos): campo ausente vira
// null em vez de quebrar a UI ("dado faltante ≠ pendência").
//
// GAP CONHECIDO (confirmado no backend, F10 #663 — ficha de graduação do
// aluno): não existe rota "todos os resultados de UM aluno" — GET
// .../graduation-exams/:examId só devolve results[] de TODOS os alunos
// DAQUELE exame. `listStudentResults()` abaixo agrega no cliente (lista
// os exames do dojô paginados + busca cada detalhe, filtrando pelo
// student_id) — aceitável porque só roda sob demanda (ex.: ao emitir a
// ficha de graduação em PDF), nunca no mount de uma tela de listagem.
// ============================================================
import { request } from "@/services/api";

export type QuesitoValue = "circulo" | "triangulo" | "quadrado";
export type DojoBeltExamStatus = "draft" | "completed" | "cancelled";
export type DojoBeltExamResultValue = "approved" | "failed";

// ── Escada do sensei (GET /dojo/belt-ladder) ────────────────────────────

export interface BeltLadderStep {
  level: string;
  color_label: string;
  kyu: number | null;
  dan: number | null;
  label: string;
  rank: number;
  order: number | null;
  /** false só para a faixa preta — o dojô não concede. */
  grantable_by_dojo: boolean;
}

export interface BeltLadderCeiling {
  level: string;
  kyu: number;
  label: string;
}

export interface BeltLadderResponse {
  data: BeltLadderStep[];
  count: number;
  schema: string;
  ceiling: BeltLadderCeiling | null;
  ceiling_reason: string | null;
}

// ── Exame ────────────────────────────────────────────────────────────────

export interface DojoBeltExam {
  id: string;
  dojo_id: string | null;
  federation_id: string | null;
  /** 'YYYY-MM-DD'. */
  exam_date: string | null;
  title: string | null;
  examiner_name: string | null;
  notes: string | null;
  status: DojoBeltExamStatus;
  created_by_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  results_count: number;
  approved_count: number;
}

export interface CreateDojoBeltExamPayload {
  /** 'YYYY-MM-DD'. */
  exam_date: string;
  title?: string;
  examiner_name?: string;
  notes?: string;
}

export interface UpdateDojoBeltExamPayload {
  exam_date?: string;
  title?: string;
  examiner_name?: string;
  notes?: string;
}

export interface DojoBeltExamListResponse {
  data: DojoBeltExam[];
  count: number;
  page: number;
  pageSize: number;
  schema_pending?: boolean;
}

// ── Faixa (view composta — vem pronta do backend) ──────────────────────

export interface BeltView {
  level: string;
  kyu: number | null;
  dan: number | null;
  label: string | null;
  order: number | null;
  rank: number | null;
}

export interface ExamResultQuesitos {
  kihon: QuesitoValue | null;
  kata: QuesitoValue | null;
  kumite: QuesitoValue | null;
}

export interface ExamResultCertificate {
  requested: boolean;
  order_id: string | null;
}

export interface DojoBeltExamResultRow {
  id: string;
  student_id: string;
  name: string | null;
  practitioner_id: string | null;
  federated: boolean;
  result: DojoBeltExamResultValue;
  from_belt: BeltView | null;
  /** Para reprovado: a faixa PRETENDIDA, não uma graduação. */
  to_belt: BeltView | null;
  to_belt_name: string | null;
  notes: string | null;
  belt_history_id: string | null;
  quesitos: ExamResultQuesitos;
  certificate: ExamResultCertificate;
  created_at: string | null;
}

export interface GetDojoBeltExamResponse {
  exam: DojoBeltExam | null;
  results: DojoBeltExamResultRow[];
  count: number;
  attachments: DojoBeltExamAttachment[];
}

/**
 * Um resultado do aluno já achatado com a data/título/examinador do
 * exame que o produziu — formato de saída de `listStudentResults`
 * (agregação por aluno, ver GAP CONHECIDO no topo do arquivo). Usado
 * pela Ficha de Graduação do aluno (carteira 10º ao 1º kyu, F10 #663)
 * para montar o histórico completo de UM aluno a partir de vários
 * exames do dojô.
 */
export interface StudentExamResult extends DojoBeltExamResultRow {
  exam_date: string | null;
  exam_title: string | null;
  /** karate_dojo_belt_exams.examiner_name — texto livre, mora no EXAME (não por resultado). */
  examiner_name: string | null;
}

// ── Lançamento em lote ───────────────────────────────────────────────────

export interface SubmitResultItem {
  student_id: string;
  result: DojoBeltExamResultValue;
  /** Obrigatório se result==='approved'. */
  to_belt_level?: string;
  /** Obrigatório quando to_belt_level==='marrom' (3 kyus na mesma cor). */
  to_belt_kyu?: number;
  request_certificate?: boolean;
  notes?: string;
  kihon?: QuesitoValue;
  kata?: QuesitoValue;
  kumite?: QuesitoValue;
}

export interface SubmitResultsDelivery {
  delivery_type?: "pickup" | "mail";
  addr_cep?: string;
  addr_logradouro?: string;
  addr_numero?: string;
  addr_complemento?: string;
  addr_cidade?: string;
  observacao?: string;
}

export interface SubmitResultsPayload {
  results: SubmitResultItem[];
  delivery?: SubmitResultsDelivery;
}

/** Item de erro do lote — 422 derruba TUDO, nada é gravado. */
export interface SubmitResultsErrorItem {
  student_id: string | null;
  code: string;
  message: string;
}

export interface AppliedResultCertificate {
  requested: boolean;
  created: boolean;
  order_id: string | null;
  reason: string | null;
  message: string | null;
}

export interface AppliedResult {
  result_id: string;
  student_id: string;
  name: string | null;
  practitioner_id: string | null;
  federated: boolean;
  result: DojoBeltExamResultValue;
  from_belt: BeltView | null;
  to_belt: BeltView | null;
  belt_history_id: string | null;
  belt_history: "created" | "reused" | null;
  /** 'ALUNO_NAO_FEDERADO' | 'SEM_FEDERACAO' | null — por que o espelho na federação não aconteceu. */
  belt_history_skipped_reason: string | null;
  student_belt_updated: boolean;
  quesitos: ExamResultQuesitos;
  certificate: AppliedResultCertificate;
}

export interface SubmitResultsSummary {
  total: number;
  approved: number;
  failed: number;
  not_federated: number;
  belt_history_created: number;
  belt_history_reused: number;
  certificates_requested: number;
  certificates_created: number;
}

export interface SubmitResultsResponse {
  exam: DojoBeltExam;
  completed: true;
  results: AppliedResult[];
  summary: SubmitResultsSummary;
  /** true quando alguma migration (colunas opcionais, quesitos inclusos) ainda não rodou neste ambiente. */
  schema_degraded?: boolean;
}

// ── Anexos (ficha/comprovante do exame — R2, karate_documents) ─────────

export interface DojoBeltExamAttachment {
  id: string;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  note: string | null;
  uploaded_by: string | null;
  created_at: string | null;
  download_url: string;
}

export interface UploadAttachmentInput {
  /** Base64 puro, sem prefixo "data:<type>;base64,". */
  content: string;
  filename: string;
  content_type: string;
  note?: string;
}

// ── Normalização defensiva ───────────────────────────────────────────────

function str(v: any): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function num(v: any): number | null {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && isFinite(n) ? n : null;
}
function bool(v: any): boolean {
  return v === true;
}

const VALID_EXAM_STATUSES: DojoBeltExamStatus[] = ["draft", "completed", "cancelled"];
const VALID_RESULTS: DojoBeltExamResultValue[] = ["approved", "failed"];
const VALID_QUESITOS: QuesitoValue[] = ["circulo", "triangulo", "quadrado"];

function normQuesito(v: any): QuesitoValue | null {
  return VALID_QUESITOS.includes(v) ? v : null;
}

function normalizeExam(raw: any): DojoBeltExam | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw;
  return {
    id: String(r.id ?? ""),
    dojo_id: str(r.dojo_id),
    federation_id: str(r.federation_id),
    exam_date: str(r.exam_date),
    title: str(r.title),
    examiner_name: str(r.examiner_name),
    notes: str(r.notes),
    status: VALID_EXAM_STATUSES.includes(r.status) ? r.status : "draft",
    created_by_name: str(r.created_by_name),
    created_at: str(r.created_at),
    updated_at: str(r.updated_at),
    results_count: typeof r.results_count === "number" ? r.results_count : 0,
    approved_count: typeof r.approved_count === "number" ? r.approved_count : 0,
  };
}

function normalizeBeltView(raw: any): BeltView | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    level: str(raw.level) || "",
    kyu: typeof raw.kyu === "number" ? raw.kyu : null,
    dan: typeof raw.dan === "number" ? raw.dan : null,
    label: str(raw.label),
    order: typeof raw.order === "number" ? raw.order : null,
    rank: typeof raw.rank === "number" ? raw.rank : null,
  };
}

function normalizeResultRow(raw: any): DojoBeltExamResultRow {
  const r = raw && typeof raw === "object" ? raw : {};
  const q = r.quesitos && typeof r.quesitos === "object" ? r.quesitos : {};
  const c = r.certificate && typeof r.certificate === "object" ? r.certificate : {};
  return {
    id: String(r.id ?? ""),
    student_id: String(r.student_id ?? ""),
    name: str(r.name),
    practitioner_id: str(r.practitioner_id),
    federated: bool(r.federated),
    result: VALID_RESULTS.includes(r.result) ? r.result : "failed",
    from_belt: normalizeBeltView(r.from_belt),
    to_belt: normalizeBeltView(r.to_belt),
    to_belt_name: str(r.to_belt_name),
    notes: str(r.notes),
    belt_history_id: str(r.belt_history_id),
    quesitos: { kihon: normQuesito(q.kihon), kata: normQuesito(q.kata), kumite: normQuesito(q.kumite) },
    certificate: { requested: bool(c.requested), order_id: str(c.order_id) },
    created_at: str(r.created_at),
  };
}

function normalizeAppliedResult(raw: any): AppliedResult {
  const r = raw && typeof raw === "object" ? raw : {};
  const q = r.quesitos && typeof r.quesitos === "object" ? r.quesitos : {};
  const c = r.certificate && typeof r.certificate === "object" ? r.certificate : {};
  return {
    result_id: String(r.result_id ?? ""),
    student_id: String(r.student_id ?? ""),
    name: str(r.name),
    practitioner_id: str(r.practitioner_id),
    federated: bool(r.federated),
    result: VALID_RESULTS.includes(r.result) ? r.result : "failed",
    from_belt: normalizeBeltView(r.from_belt),
    to_belt: normalizeBeltView(r.to_belt),
    belt_history_id: str(r.belt_history_id),
    belt_history: r.belt_history === "created" || r.belt_history === "reused" ? r.belt_history : null,
    belt_history_skipped_reason: str(r.belt_history_skipped_reason),
    student_belt_updated: bool(r.student_belt_updated),
    quesitos: { kihon: normQuesito(q.kihon), kata: normQuesito(q.kata), kumite: normQuesito(q.kumite) },
    certificate: {
      requested: bool(c.requested),
      created: bool(c.created),
      order_id: str(c.order_id),
      reason: str(c.reason),
      message: str(c.message),
    },
  };
}

function normalizeLadderStep(raw: any): BeltLadderStep {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    level: str(r.level) || "",
    color_label: str(r.color_label) || "",
    kyu: typeof r.kyu === "number" ? r.kyu : null,
    dan: typeof r.dan === "number" ? r.dan : null,
    label: str(r.label) || "",
    rank: typeof r.rank === "number" ? r.rank : 0,
    order: typeof r.order === "number" ? r.order : null,
    grantable_by_dojo: r.grantable_by_dojo === true,
  };
}

function normalizeAttachment(raw: any): DojoBeltExamAttachment {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    id: String(r.id ?? ""),
    filename: str(r.filename) || "arquivo",
    content_type: str(r.content_type),
    size_bytes: num(r.size_bytes),
    note: str(r.note),
    uploaded_by: str(r.uploaded_by),
    created_at: str(r.created_at),
    download_url: str(r.download_url) || "",
  };
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

/** Teto de páginas ao agregar exames de um aluno em listStudentResults — trava de segurança. */
const LIST_STUDENT_RESULTS_MAX_PAGES = 20;
const LIST_STUDENT_RESULTS_PAGE_SIZE = 50;

export const karateDojoBeltExamApi = {
  /** GET /dojo/belt-ladder — o que o sensei pode conceder (preta já vem marcada grantable_by_dojo:false). */
  getBeltLadder: async (federationId: string): Promise<BeltLadderResponse> => {
    const res = await request<any>(`${base(federationId)}/belt-ladder`);
    const data = Array.isArray(res?.data) ? res.data.map(normalizeLadderStep) : [];
    return {
      data,
      count: typeof res?.count === "number" ? res.count : data.length,
      schema: str(res?.schema) || "fpkt_shotokan",
      ceiling: res?.ceiling && typeof res.ceiling === "object"
        ? { level: str(res.ceiling.level) || "marrom", kyu: num(res.ceiling.kyu) || 1, label: str(res.ceiling.label) || "Marrom 1º kyu" }
        : null,
      ceiling_reason: str(res?.ceiling_reason),
    };
  },

  listExams: async (
    federationId: string,
    opts: { status?: DojoBeltExamStatus; page?: number; pageSize?: number } = {}
  ): Promise<DojoBeltExamListResponse> => {
    const res = await request<any>(
      `${base(federationId)}/graduation-exams${qs({
        status: opts.status,
        page: opts.page != null ? String(opts.page) : undefined,
        pageSize: opts.pageSize != null ? String(opts.pageSize) : undefined,
      })}`
    );
    const data = Array.isArray(res?.data) ? res.data.map(normalizeExam).filter(Boolean) as DojoBeltExam[] : [];
    return {
      data,
      count: typeof res?.count === "number" ? res.count : data.length,
      page: typeof res?.page === "number" ? res.page : 1,
      pageSize: typeof res?.pageSize === "number" ? res.pageSize : data.length,
      schema_pending: res?.schema_pending === true,
    };
  },

  getExam: async (federationId: string, examId: string): Promise<GetDojoBeltExamResponse> => {
    const res = await request<any>(`${base(federationId)}/graduation-exams/${examId}`);
    return {
      exam: normalizeExam(res?.exam),
      results: Array.isArray(res?.results) ? res.results.map(normalizeResultRow) : [],
      count: typeof res?.count === "number" ? res.count : 0,
      attachments: Array.isArray(res?.attachments) ? res.attachments.map(normalizeAttachment) : [],
    };
  },

  /**
   * Agrega TODOS os resultados de um aluno em todos os exames do dojô
   * (ver GAP CONHECIDO no topo do arquivo e StudentExamResult, acima):
   * não existe rota "todos os resultados de UM aluno" no backend. Lista
   * os exames paginados (listExams), busca o detalhe de cada um
   * (getExam) e filtra pelo student_id. Ordena por exam_date asc.
   *
   * Roda só sob demanda (ex.: ao emitir a Ficha de Graduação em PDF —
   * components/karate/dojoAlunos/FichaGraduacaoSection.tsx), nunca no
   * mount de uma tela de listagem — evitaria N+1 requests toda vez que
   * o sensei abre a ficha de um aluno.
   *
   * Falha ao listar uma página encerra a agregação com o que já foi
   * coletado; falha ao buscar o detalhe de um exame individual só deixa
   * aquele exame de fora (não derruba os demais).
   */
  listStudentResults: async (federationId: string, studentId: string): Promise<StudentExamResult[]> => {
    const out: StudentExamResult[] = [];
    let page = 1;
    for (let i = 0; i < LIST_STUDENT_RESULTS_MAX_PAGES; i++) {
      let list: DojoBeltExamListResponse;
      try {
        list = await karateDojoBeltExamApi.listExams(federationId, { page, pageSize: LIST_STUDENT_RESULTS_PAGE_SIZE });
      } catch {
        break;
      }
      const exams = list?.data || [];
      if (!exams.length) break;
      const details = await Promise.all(
        exams.map((e) => karateDojoBeltExamApi.getExam(federationId, e.id).catch(() => null))
      );
      for (const d of details) {
        if (!d || !d.exam) continue;
        const hit = (d.results || []).find((r) => r.student_id === studentId);
        if (hit) out.push({ ...hit, exam_date: d.exam.exam_date, exam_title: d.exam.title, examiner_name: d.exam.examiner_name });
      }
      if (exams.length < LIST_STUDENT_RESULTS_PAGE_SIZE) break;
      page += 1;
    }
    out.sort((a, b) => (a.exam_date || "").localeCompare(b.exam_date || ""));
    return out;
  },

  createExam: async (federationId: string, payload: CreateDojoBeltExamPayload): Promise<DojoBeltExam> => {
    const res = await request<any>(`${base(federationId)}/graduation-exams`, { method: "POST", body: payload });
    const exam = normalizeExam(res?.exam);
    if (!exam) throw new Error("Resposta inesperada do servidor ao criar o exame.");
    return exam;
  },

  updateExam: async (
    federationId: string,
    examId: string,
    payload: UpdateDojoBeltExamPayload
  ): Promise<GetDojoBeltExamResponse> => {
    const res = await request<any>(`${base(federationId)}/graduation-exams/${examId}`, {
      method: "PATCH",
      body: payload,
    });
    return {
      exam: normalizeExam(res?.exam),
      results: Array.isArray(res?.results) ? res.results.map(normalizeResultRow) : [],
      count: typeof res?.count === "number" ? res.count : 0,
      attachments: [],
    };
  },

  cancelExam: async (federationId: string, examId: string): Promise<GetDojoBeltExamResponse> => {
    const res = await request<any>(`${base(federationId)}/graduation-exams/${examId}/cancel`, { method: "POST" });
    return {
      exam: normalizeExam(res?.exam),
      results: Array.isArray(res?.results) ? res.results.map(normalizeResultRow) : [],
      count: typeof res?.count === "number" ? res.count : 0,
      attachments: [],
    };
  },

  /**
   * O LANÇAMENTO EM LOTE. Tudo-ou-nada: 422 derruba o lote inteiro e NADA
   * é gravado — a exceção propaga como ApiError com `e.data.errors:
   * [{student_id, code, message}]` (ver services/api.ts#ApiError). A tela
   * decide como mostrar cada erro por aluno; este client não engole nada.
   */
  submitResults: async (
    federationId: string,
    examId: string,
    payload: SubmitResultsPayload
  ): Promise<SubmitResultsResponse> => {
    const res = await request<any>(`${base(federationId)}/graduation-exams/${examId}/results`, {
      method: "POST",
      body: payload,
      // Lote pode disparar N pedidos de certificado sequenciais depois do
      // commit (requestCertificates) — teto maior que o default de 10s.
      timeout: 30000,
    });
    const exam = normalizeExam(res?.exam);
    if (!exam) throw new Error("Resposta inesperada do servidor ao lançar o resultado.");
    const results = Array.isArray(res?.results) ? res.results.map(normalizeAppliedResult) : [];
    const s = res?.summary && typeof res.summary === "object" ? res.summary : {};
    return {
      exam,
      completed: true,
      results,
      summary: {
        total: num(s.total) ?? results.length,
        approved: num(s.approved) ?? 0,
        failed: num(s.failed) ?? 0,
        not_federated: num(s.not_federated) ?? 0,
        belt_history_created: num(s.belt_history_created) ?? 0,
        belt_history_reused: num(s.belt_history_reused) ?? 0,
        certificates_requested: num(s.certificates_requested) ?? 0,
        certificates_created: num(s.certificates_created) ?? 0,
      },
      schema_degraded: res?.schema_degraded === true,
    };
  },

  listAttachments: async (federationId: string, examId: string): Promise<DojoBeltExamAttachment[]> => {
    const res = await request<any>(`${base(federationId)}/graduation-exams/${examId}/attachments`);
    return Array.isArray(res?.data) ? res.data.map(normalizeAttachment) : [];
  },

  uploadAttachments: async (
    federationId: string,
    examId: string,
    files: UploadAttachmentInput[]
  ): Promise<DojoBeltExamAttachment[]> => {
    const res = await request<any>(`${base(federationId)}/graduation-exams/${examId}/attachments`, {
      method: "POST",
      body: files.length === 1 ? files[0] : { files },
      timeout: 20000,
    });
    return Array.isArray(res?.data) ? res.data.map(normalizeAttachment) : [];
  },

  deleteAttachment: async (
    federationId: string,
    examId: string,
    docId: string
  ): Promise<{ deleted: boolean; id: string }> =>
    request<{ deleted: boolean; id: string }>(
      `${base(federationId)}/graduation-exams/${examId}/attachments/${docId}`,
      { method: "DELETE" }
    ),
};
