// ============================================================
// AURA DOJÔ — F4: Turmas (CRUD, matrícula, chamada) + check-in QR
//
// Cliente tipado do Aura-backend PR "f4-dojo-turmas" (backend construído
// em paralelo a partir do MESMO contrato deste arquivo). Base:
// /federation/:id/dojo — Bearer = JWT normal do app via request() core
// (Canal A). Vive num service pequeno separado, mesmo racional dos
// demais services karateDojo* (karateApi.ts tem 125 KB e é intocável).
//
// weekdays: 0=domingo..6=sábado (convenção JS Date#getDay/getUTCDay).
// Horários 'HH:MM' | null. Datas de chamada 'YYYY-MM-DD' — sempre
// tz-safe (parse manual / Date.UTC, nunca new Date('YYYY-MM-DD') local).
//
// Erros (ApiError.data.code, mapeados em pt-BR por helpers.ts do módulo
// components/karate/dojoTurmas):
//   409 HAS_HISTORY (excluir turma com presenças — sugere inativar) ·
//   409 ALREADY_ENROLLED · 422 (aluno inativo na matrícula) ·
//   503 SCHEMA_PENDING (migration pendente) ·
//   409 QR_DESABILITADO / NOT_ENROLLED / NO_CLASS_TODAY (check-in QR).
// ============================================================
import { request } from "@/services/api";

export interface DojoClass {
  id: string;
  name: string;
  weekdays: number[];
  start_time: string | null;
  end_time: string | null;
  modality: string | null;
  active: boolean;
  students_count: number;
}

export interface DojoClassPayload {
  name?: string;
  weekdays?: number[];
  start_time?: string | null;
  end_time?: string | null;
  modality?: string | null;
  active?: boolean;
}

export interface DojoClassesListResponse {
  data: DojoClass[];
  schema_pending?: boolean;
}

export type DojoClassStudentStatus = "active" | "inactive";

export interface DojoClassStudent {
  student_id: string;
  full_name: string;
  belt_label: string | null;
  status: DojoClassStudentStatus;
  enrolled_at: string | null;
}

export interface DojoClassStudentsResponse {
  data: DojoClassStudent[];
}

export type DojoAttendanceMethod = "manual" | "qr";

export interface DojoAttendanceRow {
  student_id: string;
  full_name: string;
  belt_label: string | null;
  present: boolean | null;
  method: DojoAttendanceMethod | null;
}

export interface DojoAttendanceResponse {
  date: string;
  data: DojoAttendanceRow[];
}

export interface DojoAttendanceRecord {
  student_id: string;
  present: boolean;
}

export interface DojoSaveAttendanceResult {
  saved: number;
}

export interface DojoAttendanceByClass {
  class_id: string;
  class_name: string;
  present_count: number;
  last_present_date: string | null;
}

export interface DojoAttendanceRecent {
  date: string;
  class_name: string;
  present: boolean;
  method: DojoAttendanceMethod | null;
}

export interface DojoAttendanceSummary {
  total_present: number;
  present_30d: number;
  present_90d: number;
  by_class: DojoAttendanceByClass[];
  recent: DojoAttendanceRecent[];
}

export interface DojoClassesSettings {
  qr_checkin_enabled: boolean;
}

export interface DojoStudentQrResponse {
  token: string;
}

export interface DojoCheckinPersonRef {
  id: string;
  full_name: string;
  belt_label: string | null;
}

export interface DojoCheckinClassRef {
  id: string;
  name: string;
}

export interface DojoCheckinResult {
  student: DojoCheckinPersonRef;
  class: DojoCheckinClassRef;
  date: string;
  already_checked: boolean;
}

const base = (federationId: string) => `/federation/${federationId}/dojo`;

export const karateDojoClassesApi = {
  listClasses: (federationId: string): Promise<DojoClassesListResponse> =>
    request<DojoClassesListResponse>(`${base(federationId)}/classes`),

  createClass: (federationId: string, payload: DojoClassPayload): Promise<DojoClass> =>
    request<DojoClass>(`${base(federationId)}/classes`, { method: "POST", body: payload }),

  updateClass: (federationId: string, classId: string, payload: DojoClassPayload): Promise<DojoClass> =>
    request<DojoClass>(`${base(federationId)}/classes/${classId}`, { method: "PATCH", body: payload }),

  deleteClass: (federationId: string, classId: string): Promise<{ deleted: boolean; id: string }> =>
    request<{ deleted: boolean; id: string }>(`${base(federationId)}/classes/${classId}`, { method: "DELETE" }),

  listClassStudents: (federationId: string, classId: string): Promise<DojoClassStudentsResponse> =>
    request<DojoClassStudentsResponse>(`${base(federationId)}/classes/${classId}/students`),

  enrollStudent: (federationId: string, classId: string, studentId: string): Promise<void> =>
    request<void>(`${base(federationId)}/classes/${classId}/enroll`, {
      method: "POST",
      body: { student_id: studentId },
    }),

  unenrollStudent: (federationId: string, classId: string, studentId: string): Promise<void> =>
    request<void>(`${base(federationId)}/classes/${classId}/enroll/${studentId}`, { method: "DELETE" }),

  getAttendance: (federationId: string, classId: string, date: string): Promise<DojoAttendanceResponse> =>
    request<DojoAttendanceResponse>(
      `${base(federationId)}/classes/${classId}/attendance?date=${encodeURIComponent(date)}`
    ),

  saveAttendance: (
    federationId: string,
    classId: string,
    date: string,
    records: DojoAttendanceRecord[]
  ): Promise<DojoSaveAttendanceResult> =>
    request<DojoSaveAttendanceResult>(`${base(federationId)}/classes/${classId}/attendance`, {
      method: "PUT",
      body: { date, records },
    }),

  getStudentAttendanceSummary: (federationId: string, studentId: string): Promise<DojoAttendanceSummary> =>
    request<DojoAttendanceSummary>(`${base(federationId)}/students/${studentId}/attendance-summary`),

  getSettings: (federationId: string): Promise<DojoClassesSettings> =>
    request<DojoClassesSettings>(`${base(federationId)}/classes/settings`),

  updateSettings: (federationId: string, payload: DojoClassesSettings): Promise<DojoClassesSettings> =>
    request<DojoClassesSettings>(`${base(federationId)}/classes/settings`, { method: "PUT", body: payload }),

  getStudentQr: (federationId: string, studentId: string): Promise<DojoStudentQrResponse> =>
    request<DojoStudentQrResponse>(`${base(federationId)}/students/${studentId}/qr`),

  checkin: (federationId: string, token: string, classId?: string): Promise<DojoCheckinResult> =>
    request<DojoCheckinResult>(`${base(federationId)}/classes/checkin`, {
      method: "POST",
      body: classId ? { token, class_id: classId } : { token },
    }),
};
