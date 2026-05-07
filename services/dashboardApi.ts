import { request } from "./api";

export var dashboardApi = {
  aggregate: function(companyId: string, token?: string) { return request<any>("/companies/" + companyId + "/dashboard", { token: token }); },
  summary: function(companyId: string, token?: string) { return request<any>("/companies/" + companyId + "/withdrawal/summary", { token: token }); },
  sparkline: function(companyId: string, days?: number, token?: string) {
    return request<any>("/companies/" + companyId + "/dashboard/sparkline?days=" + (days || 7), { token: token });
  },
};

export var aiApi = {
  chat: function(companyId: string, message: string, context?: string, history?: any[]) {
    return request<any>("/companies/" + companyId + "/ai/chat", {
      method: "POST", body: { message: message, context: context || "geral", history: history || [] }, timeout: 30000,
    });
  },
  activity: function(companyId: string, limit?: number) {
    return request<any>("/companies/" + companyId + "/ai/activity?limit=" + (limit || 20));
  },
};
