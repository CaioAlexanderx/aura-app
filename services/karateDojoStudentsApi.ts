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
// Vive num service pequeno separado: karateApi.ts tem 125 KB e a regra
// da casa é edição cirúrgica (mesmo racional do karateDojoInfoApi).
//
// Regra da casa "dado faltante ≠ pendência": todo campo além de
// full_name é opcional — o backend só recusa dado INVÁLIDO (422) e
// menor de 18 sem responsável (422 MENOR_SEM_RESPONSAVEL, LGPD).
// ============================================================
import { request } from "@/services/api";

export type DojoStudentStatus = "active" | "inactive";
export type DojoStudentSex = "M" | "F" | "other";

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
  /** Vínculo futuro com a FPKT — sempre NULL na F2. */
  practitioner_id: string | null;
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
    opts: { status?: DojoStudentStatus; q?: string; belt?: string; summary?: boolean } = {}
  ): Promise<DojoStudentsListResponse> =>
    request<DojoStudentsListResponse>(
      `${base(federationId)}/students${qs({
        status: opts.status,
        q: opts.q,
        belt: opts.belt,
        summary: opts.summary ? "1" : undefined,
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
};
