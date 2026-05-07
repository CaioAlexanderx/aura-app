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
