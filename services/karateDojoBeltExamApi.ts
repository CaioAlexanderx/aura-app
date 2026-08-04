// ============================================================
// karateDojoBeltExamApi — F10: exames de graduação do PRÓPRIO dojô
// (karate_dojo_belt_exams / karate_dojo_belt_exam_results)
//
// Cliente tipado do Aura-backend (src/routes/karateDojoBeltExams.js +
// src/services/karateDojoBeltExamService.js, migrations 264/265/272).
// Base: /federation/:id/dojo — mesmo canal A (JWT normal) que
// karateDojoStudentsApi.ts já usa. NÃO confundir com
// /federation/:id/belt-exams (karateApi.ts#listBeltExams) — aquele é o
// exame da FEDERAÇÃO (banca, CriarExameModal.tsx); este é o exame que o
// PRÓPRIO sensei aplica no dojô (não pode graduar até faixa preta —
// CHECK no banco barra to_belt_level='preta').
//
// Quesitos (migration 272, F10): kihon/kata/kumite gravam o valor
// NOMEADO 'circulo' | 'triangulo' | 'quadrado' (sistema japonês 〇 › △ ›
// □) — nunca o glifo Unicode. Desenhar o símbolo é trabalho do front
// (ver buildFichaGraduacaoHtml.ts). Os três campos são independentes e
// opcionais — ausente = "não avaliado", nunca bloqueia nada, e
// `result` NUNCA é derivado deles (decisão explícita do sensei).
//
// GAP CONHECIDO (confirmado no backend antes de montar este cliente):
// não existe rota "todos os resultados de UM aluno" — GET
// .../graduation-exams/:examId só devolve results[] de TODOS os alunos
// DAQUELE exame. listStudentResults() abaixo agrega no cliente (lista os
// exames do dojô + busca cada detalhe, filtrando pelo student_id) — é
// aceitável porque só roda sob demanda, ao abrir a Ficha de Graduação
// pra impressão (não em toda renderização da ficha do aluno).
// ============================================================
import { request } from "@/services/api";

export type DojoExamQuesito = "circulo" | "triangulo" | "quadrado";
export type DojoExamResultValue = "approved" | "failed";
export type DojoExamStatus = "draft" | "completed" | "cancelled";

export interface DojoBeltView {
  level: string;
  kyu: number | null;
  dan: number | null;
  label: string | null;
  order: number | null;
  rank: number | null;
}

/** Uma linha de karate_dojo_belt_exam_results (um aluno, num exame). */
export interface DojoBeltExamResultRow {
  student_id: string;
  name: string | null;
  practitioner_id: string | null;
  federated: boolean;
  result: DojoExamResultValue;
  from_belt: DojoBeltView | null;
  to_belt: DojoBeltView | null;
  belt_history_id: string | null;
  quesitos: { kihon: DojoExamQuesito | null; kata: DojoExamQuesito | null; kumite: DojoExamQuesito | null };
  certificate: { requested: boolean; order_id: string | null };
  created_at: string;
}

/** karate_dojo_belt_exams (o "evento" — uma banca própria do dojô, uma data). */
export interface DojoBeltExam {
  id: string;
  dojo_id: string;
  federation_id: string | null;
  exam_date: string;
  title: string | null;
  examiner_name: string | null;
  notes: string | null;
  status: DojoExamStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DojoBeltExamDetail extends DojoBeltExam {
  results: DojoBeltExamResultRow[];
}

export interface DojoBeltLadderRow {
  level: string;
  kyu: number | null;
  dan: number | null;
  label: string;
  color_label?: string | null;
}

export interface DojoBeltLadderResponse {
  data: DojoBeltLadderRow[];
  count: number;
  schema: string;
  ceiling: string | null;
  ceiling_reason: string | null;
}

interface DojoExamsPage {
  data: DojoBeltExam[];
  count: number;
}

/** Um resultado do aluno já com a data/título do exame que o produziu (achatado p/ a ficha de graduação). */
export interface StudentExamResult extends DojoBeltExamResultRow {
  exam_date: string;
  exam_title: string | null;
  /** karate_dojo_belt_exams.examiner_name — texto livre, mora no EXAME (não por resultado). */
  examiner_name: string | null;
}

const base = (federationId: string) => `/federation/${federationId}/dojo`;

/** Teto de páginas ao agregar exames de um aluno — trava de segurança (ver listStudentResults). */
const LIST_STUDENT_RESULTS_MAX_PAGES = 20;
const LIST_STUDENT_RESULTS_PAGE_SIZE = 50;

export const karateDojoBeltExamApi = {
  listExams: (
    federationId: string,
    opts: { status?: DojoExamStatus; page?: number; pageSize?: number } = {}
  ): Promise<DojoExamsPage> => {
    const parts: string[] = [];
    if (opts.status) parts.push(`status=${encodeURIComponent(opts.status)}`);
    if (opts.page) parts.push(`page=${opts.page}`);
    if (opts.pageSize) parts.push(`pageSize=${opts.pageSize}`);
    const qs = parts.length ? `?${parts.join("&")}` : "";
    return request<DojoExamsPage>(`${base(federationId)}/graduation-exams${qs}`);
  },

  getExam: (federationId: string, examId: string): Promise<DojoBeltExamDetail> =>
    request<DojoBeltExamDetail>(`${base(federationId)}/graduation-exams/${examId}`),

  /** Escala de kyus que o dojô pode aplicar (schema fpkt_shotokan, teto = sem faixa-preta). */
  getBeltLadder: (federationId: string): Promise<DojoBeltLadderResponse> =>
    request<DojoBeltLadderResponse>(`${base(federationId)}/belt-ladder`),

  /**
   * Agrega TODOS os resultados de um aluno em todos os exames do dojô
   * (ver GAP CONHECIDO no topo do arquivo). Ordena por exam_date asc.
   * Falhas em exames individuais (ex.: um 404 isolado numa corrida) não
   * derrubam a agregação inteira — aquele exame só fica de fora.
   */
  async listStudentResults(federationId: string, studentId: string): Promise<StudentExamResult[]> {
    const out: StudentExamResult[] = [];
    let page = 1;
    for (let i = 0; i < LIST_STUDENT_RESULTS_MAX_PAGES; i++) {
      let list: DojoExamsPage;
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
        if (!d) continue;
        const hit = (d.results || []).find((r) => r.student_id === studentId);
        if (hit) out.push({ ...hit, exam_date: d.exam_date, exam_title: d.title, examiner_name: d.examiner_name ?? null });
      }
      if (exams.length < LIST_STUDENT_RESULTS_PAGE_SIZE) break;
      page += 1;
    }
    out.sort((a, b) => (a.exam_date || "").localeCompare(b.exam_date || ""));
    return out;
  },
};
