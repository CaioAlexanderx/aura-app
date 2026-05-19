import { request } from "./api";

export type AccessCodeRow = {
  id: string;
  code: string;
  type: "trial" | "promo" | "manual" | "referral";
  plan: "essencial" | "negocio" | "expansao" | "personalizado";
  discount_pct: number;
  trial_days: number;
  max_uses: number;
  uses: number;
  referrer_id: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type CreateAccessCodeBody = {
  code: string;
  type: "trial" | "promo" | "manual";
  plan: "essencial" | "negocio" | "expansao" | "personalizado";
  trial_days?: number;
  discount_pct?: number;
  max_uses?: number;
  expires_at?: string | null;
};

// 12/05/2026 — Onda 1 Gestao Aura v2
export type AdminNote = {
  id: number;
  body: string;
  created_at: string;
  author_user_id: string;
  author_name: string | null;
  author_email: string | null;
};
export type AdminAuditLog = {
  id: number;
  action: string;            // 'extend_trial' | 'set_extra_seats' | etc
  payload: Record<string, any> | null;
  reason: string | null;
  created_at: string;
  company_id: string | null;
  staff_user_id: string;
  staff_name: string | null;
  staff_email: string | null;
  company_trade_name: string | null;
  company_legal_name: string | null;
};
export type ExtendTrialResponse = {
  trial_ends_at: string;
  previous_trial_ends_at: string | null;
  days_added: number;
};
export type SetExtraSeatsResponse = {
  extra_seats_granted: number;
  previous_extra_seats_granted: number;
  changed: boolean;
};

export var adminApi = {
  dashboard: function() { return request<any>("/admin/dashboard"); },
  clients: function() { return request<any>("/admin/clients"); },
  clientModules: function(companyId: string) { return request<any>("/admin/clients/" + companyId + "/modules"); },
  updateModules: function(companyId: string, overrides: Record<string, boolean>) {
    return request<any>("/admin/clients/" + companyId + "/modules", { method: "PUT", body: { overrides: overrides } });
  },
  setPlan: function(companyId: string, plan: string) {
    return request<{ company: any; visible_modules: string[]; changed: boolean; message: string }>(
      "/admin/clients/" + companyId + "/plan", { method: "PATCH", body: { plan: plan }, retry: 0 }
    );
  },
  setVertical: function(companyId: string, vertical: string | null) {
    return request<{ company: any; changed: boolean; message: string }>(
      "/admin/clients/" + companyId + "/vertical", { method: "PATCH", body: { vertical: vertical }, retry: 0 }
    );
  },
  // 19/05/2026 — Sub-vertical (Fase B1 do benchmark de mercado)
  // Sub-segmentacao manual via Gestao Aura. Whitelist por vertical principal
  // (varejo: calcados, moda, perfumaria, etc).
  setSubVertical: function(companyId: string, subVertical: string | null) {
    return request<{ company: any; changed: boolean; message: string }>(
      "/admin/clients/" + companyId + "/sub-vertical", { method: "PATCH", body: { sub_vertical: subVertical }, retry: 0 }
    );
  },
  subVerticalOptions: function() {
    return request<{ by_vertical: Record<string, string[]> }>(
      "/admin/sub-verticals/options"
    );
  },
  // 12/05/2026 — Notas CRM
  notes: {
    list: function(companyId: string) {
      return request<{ notes: AdminNote[] }>("/admin/clients/" + companyId + "/notes");
    },
    create: function(companyId: string, body: string) {
      return request<{ note: AdminNote }>(
        "/admin/clients/" + companyId + "/notes",
        { method: "POST", body: { body: body }, retry: 0 }
      );
    },
  },
  // 12/05/2026 — Estender trial + audit log
  extendTrial: function(companyId: string, days: number, reason?: string) {
    return request<ExtendTrialResponse>(
      "/admin/clients/" + companyId + "/extend-trial",
      { method: "PATCH", body: { days: days, reason: reason || null }, retry: 0 }
    );
  },
  // 12/05/2026 (tarde) — Acessos extras pagos (caso Alynne/Encanto)
  // count e o numero absoluto desejado (0-100). Backend grava em
  // companies.extra_seats_granted e propaga pra summarizeSeats em
  // todas as rotas /members/*.
  setExtraSeats: function(companyId: string, count: number, reason?: string) {
    return request<SetExtraSeatsResponse>(
      "/admin/clients/" + companyId + "/extra-seats",
      { method: "PATCH", body: { count: count, reason: reason || null }, retry: 0 }
    );
  },
  auditLog: function(params?: { company_id?: string; action?: string; limit?: number }) {
    var qs: string[] = [];
    if (params?.company_id) qs.push("company_id=" + encodeURIComponent(params.company_id));
    if (params?.action)     qs.push("action=" + encodeURIComponent(params.action));
    if (params?.limit)      qs.push("limit=" + params.limit);
    var suffix = qs.length ? "?" + qs.join("&") : "";
    return request<{ logs: AdminAuditLog[] }>("/admin/audit-log" + suffix);
  },
  accessCodes: {
    list: function(params?: { type?: string; is_active?: boolean; q?: string; limit?: number }) {
      var qs: string[] = [];
      if (params?.type) qs.push("type=" + encodeURIComponent(params.type));
      if (params?.is_active !== undefined) qs.push("is_active=" + (params.is_active ? "true" : "false"));
      if (params?.q) qs.push("q=" + encodeURIComponent(params.q));
      if (params?.limit) qs.push("limit=" + params.limit);
      var suffix = qs.length ? "?" + qs.join("&") : "";
      return request<{ total: number; codes: AccessCodeRow[] }>("/admin/access-codes" + suffix);
    },
    create: function(body: CreateAccessCodeBody) {
      return request<{ code: AccessCodeRow }>("/admin/access-codes", { method: "POST", body: body, retry: 0 });
    },
    toggle: function(id: string, is_active: boolean) {
      return request<{ code: AccessCodeRow }>("/admin/access-codes/" + id, { method: "PATCH", body: { is_active: is_active } });
    },
  },
};
