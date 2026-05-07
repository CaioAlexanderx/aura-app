import { request } from "./api";

// Legacy NFS-e / NFC-e via /nfe route.
// NFC-e canonica usa /nfce/* (ver nfceApi.ts quando criado).
export var nfeApi = {
  list: function(companyId: string, type?: string, status?: string) {
    var qs = [type && "type=" + type, status && "status=" + status].filter(Boolean).join("&");
    return request<{ total: number; documents: any[] }>("/companies/" + companyId + "/nfe" + (qs ? "?" + qs : ""));
  },
  get: function(companyId: string, ref: string) { return request<any>("/companies/" + companyId + "/nfe/" + ref); },
  setup: function(companyId: string) { return request<any>("/companies/" + companyId + "/nfe/setup", { method: "POST", timeout: 15000 }); },
  uploadCertificate: function(companyId: string, body: { certificate: string; password: string }) {
    return request<any>("/companies/" + companyId + "/nfe/certificate", { method: "POST", body: body, timeout: 15000 });
  },
  emitNfse: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/nfe/emit/nfse", { method: "POST", body: body, timeout: 20000 }); },
  emitNfce: function(companyId: string, body: any) { return request<any>("/companies/" + companyId + "/nfe/emit/nfce", { method: "POST", body: body, timeout: 20000 }); },
  cancel: function(companyId: string, ref: string, justificativa?: string) {
    return request<any>("/companies/" + companyId + "/nfe/" + ref + "/cancel", { method: "POST", body: { justificativa: justificativa }, timeout: 15000 });
  },
};
