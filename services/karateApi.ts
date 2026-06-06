// ============================================================
// KARATE API — Aura Karatê
//
// Wired against karate-fase0-openapi.yaml contract.
// Usa o request() core de services/api.ts (Bearer JWT auto).
//
// TODO: substituir MOCK_FEDERATION_ID por leitura do
// store/context de federação quando o login de federação
// for implementado. Por ora, lemos de env ou fallback mock.
// ============================================================
import { request } from "@/services/api";

// — tipos espelhando o OpenAPI schema —

export type DojoStatus = "active" | "expiring" | "overdue" | "defaulting" | "suspended";
export type AffiliationModel = "annual" | "biannual" | "quarterly";
export type AffiliationStatus = "active" | "pending" | "inactive";
export type BeltSchema = "legacy" | "fpkt_shotokan";

export interface Dojo {
  id: string;
  fpkt_affiliation_id: string;
  name: string;
  cnpj: string | null;
  sensei_cpf: string | null;
  region: string;
  affiliation_model: AffiliationModel;
  affiliation_since: string;
  dojo_founded_year: number | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: DojoStatus;
  practitioner_count: number;
}

export interface DojoInput {
  name: string;
  cnpj?: string | null;
  sensei_cpf?: string | null;
  region?: string;
  affiliation_model: AffiliationModel;
  affiliation_since?: string;
  dojo_founded_year?: number | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface TechnicalTeamMember {
  practitioner_id: string;
  name: string;
  belt_level: string;
  roles: string[];
}

export interface AnnuityHistoryEntry {
  reference_period: string;
  amount: number;
  paid_at: string | null;
  status: DojoStatus;
}

export interface DojoDetail extends Dojo {
  technical_team: TechnicalTeamMember[];
  annuity_history: AnnuityHistoryEntry[];
}

export interface PractitionerListItem {
  id: string;
  full_name: string;
  karate_registration_number: string;
  dojo_name: string;
  belt_name: string | null;
  affiliation_status: AffiliationStatus;
}

export interface BeltHistoryEntry {
  id: string;
  belt_level: string;
  belt_name: string;
  belt_schema: BeltSchema;
  graduated_at: string;
  is_legacy: boolean;
  exam_id: string | null;
}

export interface CurrentBelt {
  belt_level: string;
  belt_name: string;
  current_since: string;
}

export interface PractitionerInput {
  full_name: string;
  cpf?: string | null;
  rg?: string | null;
  birth_date?: string;
  email?: string | null;
  phone?: string | null;
  dojo_id: string;
  is_student?: boolean;
  parent_guardian_id?: string | null;
  is_arbiter?: boolean;
  is_instructor?: boolean;
  is_examiner?: boolean;
  photo_url?: string | null;
}

export interface Practitioner extends PractitionerInput {
  id: string;
  karate_registration_number: string;
  affiliation_status: AffiliationStatus;
  current_belt: CurrentBelt | null;
}

export interface PractitionerDetail extends Practitioner {
  belt_history: BeltHistoryEntry[];
}

export interface BeltDistributionItem {
  belt_level: string;
  belt_name: string;
  count: number;
}

export interface DashboardKPIs {
  dojo_count: number;
  practitioner_count: number;
  revenue_ytd: number;
  overdue_rate: number;
}

export interface UpcomingEvent {
  title: string;
  date: string;
  location: string;
  registered_count: number;
}

export interface OverdueDojo {
  dojo_id: string;
  name: string;
  amount: number;
  days_overdue: number;
}

export interface DashboardPayload {
  kpis: DashboardKPIs;
  upcoming_events: UpcomingEvent[];
  overdue_dojos: OverdueDojo[];
  belt_distribution: BeltDistributionItem[];
}

export interface Paginated<T> {
  page: number;
  page_size: number;
  total: number;
  data: T[];
}

export interface ImportResult {
  mode: "preview" | "commit";
  total_rows: number;
  valid_rows: number;
  committed: number;
  errors: Array<{ row: number; field: string; message: string }>;
}

// ─────────────────────────────────────────────────────────────
// API calls
// ─────────────────────────────────────────────────────────────

export const karateApi = {
  // Dashboard
  getDashboard: (federationId: string): Promise<DashboardPayload> =>
    request(`/federation/${federationId}/dashboard`),

  getBeltDistribution: (federationId: string): Promise<BeltDistributionItem[]> =>
    request(`/federation/${federationId}/belt-distribution`),

  // Dojôs
  listDojos: (
    federationId: string,
    params?: { region?: string; status?: DojoStatus; affiliation_model?: AffiliationModel; q?: string; page?: number; pageSize?: number }
  ): Promise<Paginated<Dojo>> => {
    const qs = new URLSearchParams();
    if (params?.region) qs.set("region", params.region);
    if (params?.status) qs.set("status", params.status);
    if (params?.affiliation_model) qs.set("affiliation_model", params.affiliation_model);
    if (params?.q) qs.set("q", params.q);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/dojos${query}`);
  },

  getDojo: (federationId: string, dojoId: string): Promise<DojoDetail> =>
    request(`/federation/${federationId}/dojos/${dojoId}`),

  createDojo: (federationId: string, body: DojoInput): Promise<Dojo> =>
    request(`/federation/${federationId}/dojos`, { method: "POST", body }),

  updateDojo: (federationId: string, dojoId: string, body: Partial<DojoInput>): Promise<Dojo> =>
    request(`/federation/${federationId}/dojos/${dojoId}`, { method: "PATCH", body }),

  // Praticantes
  listPractitioners: (
    federationId: string,
    params?: { dojo_id?: string; belt_level?: string; affiliation_status?: AffiliationStatus; role?: string; q?: string; page?: number; pageSize?: number }
  ): Promise<Paginated<PractitionerListItem>> => {
    const qs = new URLSearchParams();
    if (params?.dojo_id) qs.set("dojo_id", params.dojo_id);
    if (params?.belt_level) qs.set("belt_level", params.belt_level);
    if (params?.affiliation_status) qs.set("affiliation_status", params.affiliation_status);
    if (params?.role) qs.set("role", params.role);
    if (params?.q) qs.set("q", params.q);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/federation/${federationId}/practitioners${query}`);
  },

  getPractitioner: (federationId: string, practitionerId: string): Promise<PractitionerDetail> =>
    request(`/federation/${federationId}/practitioners/${practitionerId}`),

  createPractitioner: (federationId: string, body: PractitionerInput): Promise<Practitioner> =>
    request(`/federation/${federationId}/practitioners`, { method: "POST", body }),

  // Importação CSV
  importCSV: (
    federationId: string,
    file: FormData,
    mode: "preview" | "commit" = "preview"
  ): Promise<ImportResult> => {
    // multipart/form-data — não usa JSON body, passa FormData direto
    // TODO: adaptar request() para suportar FormData ou usar fetch direto
    // Por ora, chamada direta ao fetch com base URL da env
    const baseUrl =
      (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
      "https://aura-backend-production-f805.up.railway.app/api/v1";
    const { useAuthStore } = require("@/stores/auth");
    const token = useAuthStore.getState().token;
    file.append("mode", mode);
    return fetch(`${baseUrl}/federation/${federationId}/practitioners/import`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: file,
    }).then((r) => r.json());
  },
};
