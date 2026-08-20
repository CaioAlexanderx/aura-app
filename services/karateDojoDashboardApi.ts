// ============================================================
// AURA KARATÊ — Painel do dojô: dashboard agregado (Onda 4)
//
//   GET /federation/:id/dojo/dashboard
//
// Um único endpoint que devolve os três blocos "ferramentas do sensei"
// do painel: evasão (alunos sem treinar há ~30 dias), aniversariantes do
// mês e candidatos a exame (por engajamento/presença, NÃO elegibilidade
// formal). Bearer = JWT normal do app via request() core (Canal A;
// requireDojoAccess no aura-backend).
//
// schema_pending: quando a migração de presença ainda não rodou no
// ambiente, o backend responde com schema_pending=true e listas vazias.
// O painel trata isso como "sem dados", nunca como erro — mesmo racional
// dos cards F3a/F4 (silenciosos em indisponibilidade de feature).
//
// Vive num service pequeno separado: karateApi.ts é grande e a regra da
// casa é edição cirúrgica (mesmo racional de karateDojoInfoApi).
// ============================================================
import { request } from "@/services/api";

/** Aluno em risco de evasão — sem presença registrada há ~30 dias. */
export interface DojoEvasaoStudent {
  id: string;
  full_name: string;
  belt_label: string | null;
  /** 'YYYY-MM-DD' | null (null = nunca treinou). Parse manual, nunca new Date() direto. */
  last_attendance: string | null;
}

/** Aniversariante do mês corrente. */
export interface DojoBirthdayStudent {
  id: string;
  full_name: string;
  belt_label: string | null;
  /** 'YYYY-MM-DD'. */
  birth_date: string;
  /** Dia do mês (1..31). */
  day: number;
}

/** Candidato a exame por ENGAJAMENTO (presenças nos últimos 90 dias). */
export interface DojoExamCandidateStudent {
  id: string;
  full_name: string;
  belt_label: string | null;
  presences_90d: number;
}

export interface DojoDashboard {
  evasao: { count: number; students: DojoEvasaoStudent[] };
  birthdays: { count: number; students: DojoBirthdayStudent[] };
  exam_candidates: { count: number; students: DojoExamCandidateStudent[] };
  /** true = migração de presença ainda não aplicada → tratar como listas vazias. */
  schema_pending: boolean;
}

function arr<T>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}

function block<T>(raw: any): { count: number; students: T[] } {
  const students = arr<T>(raw?.students);
  const count = typeof raw?.count === "number" ? raw.count : students.length;
  return { count, students };
}

/** Normalização defensiva: envelope ausente/parcial vira blocos vazios, nunca throw. */
export function normalizeDojoDashboard(raw: any): DojoDashboard {
  const d = raw && typeof raw === "object" ? raw : {};
  return {
    evasao: block<DojoEvasaoStudent>(d.evasao),
    birthdays: block<DojoBirthdayStudent>(d.birthdays),
    exam_candidates: block<DojoExamCandidateStudent>(d.exam_candidates),
    schema_pending: d.schema_pending === true,
  };
}

export const karateDojoDashboardApi = {
  getDojoDashboard: async (federationId: string): Promise<DojoDashboard> =>
    normalizeDojoDashboard(
      await request<any>(`/federation/${federationId}/dojo/dashboard`)
    ),
};
