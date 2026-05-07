import { request } from "./api";

export var employeesApi = {
  list: function(companyId: string, includeInactive?: boolean) {
    return request<{ total: number; employees: any[] }>("/companies/" + companyId + "/employees" + (includeInactive ? "?include_inactive=true" : ""));
  },
  create: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/employees", { method: "POST", body: body }); },
  update: function(companyId: string, eid: string, body: any) { return request<any>("/companies/" + companyId + "/employees/" + eid, { method: "PATCH", body: body }); },
  remove: function(companyId: string, eid: string) { return request<any>("/companies/" + companyId + "/employees/" + eid, { method: "DELETE" }); },
};
