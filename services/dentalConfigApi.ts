import { request } from "@/services/api";

// ============================================================
// AURA. — Dental Practitioners + Settings API (D-FIX #1+#6)
//
// Wrapper isolado pra nao inflar o services/api.ts (36KB).
// Backend rotas:
//   GET    /companies/:id/dental/settings
//   PUT    /companies/:id/dental/settings
//   GET    /companies/:id/dental/practitioners
//   POST   /companies/:id/dental/practitioners
//   PATCH  /companies/:id/dental/practitioners/:pid
//   DELETE /companies/:id/dental/practitioners/:pid
// ============================================================

export type DentalChairSettings = {
  chairs_active: boolean[];
  chair_practitioner_ids: (string | null)[];
};

export type DentalSettingsResponse = {
  settings: DentalChairSettings;
  plan: string;
  max_chairs: number;
};

export type DentalPractitioner = {
  id: string;
  name: string;
  cro: string | null;
  specialty: string | null;
  color: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  is_owner: boolean;
  created_at: string;
  updated_at: string;
};

export type CreatePractitionerBody = {
  name: string;
  cro?: string | null;
  specialty?: string | null;
  color?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type UpdatePractitionerBody = Partial<CreatePractitionerBody> & {
  is_active?: boolean;
};

export var dentalConfigApi = {
  // Settings (chairs + assignments)
  getSettings: function(companyId: string) {
    return request<DentalSettingsResponse>(
      "/companies/" + companyId + "/dental/settings",
      { retry: 1 }
    );
  },
  saveSettings: function(companyId: string, settings: DentalChairSettings) {
    return request<DentalSettingsResponse>(
      "/companies/" + companyId + "/dental/settings",
      { method: "PUT", body: settings, retry: 0 }
    );
  },

  // Practitioners CRUD
  listPractitioners: function(companyId: string) {
    return request<{ total: number; practitioners: DentalPractitioner[]; bootstrapped?: boolean }>(
      "/companies/" + companyId + "/dental/practitioners",
      { retry: 1 }
    );
  },
  createPractitioner: function(companyId: string, body: CreatePractitionerBody) {
    return request<{ practitioner: DentalPractitioner }>(
      "/companies/" + companyId + "/dental/practitioners",
      { method: "POST", body: body, retry: 0 }
    );
  },
  updatePractitioner: function(companyId: string, pid: string, body: UpdatePractitionerBody) {
    return request<{ practitioner: DentalPractitioner }>(
      "/companies/" + companyId + "/dental/practitioners/" + pid,
      { method: "PATCH", body: body, retry: 0 }
    );
  },
  deletePractitioner: function(companyId: string, pid: string) {
    return request<{ deleted: boolean }>(
      "/companies/" + companyId + "/dental/practitioners/" + pid,
      { method: "DELETE", retry: 0 }
    );
  },
};

export default dentalConfigApi;
