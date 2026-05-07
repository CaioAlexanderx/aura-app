import { request } from "./api";

export type InviteDetails = {
  company_name: string;
  role: string;
  email: string;
  masked_email: string;
  status: string;
};

export var inviteApi = {
  validate: function(inviteToken: string) {
    return request<InviteDetails>("/invite/" + inviteToken, { token: null, retry: 1 });
  },
  accept: function(inviteToken: string) {
    return request<{ accepted: boolean; company_id: string; role: string; message: string }>(
      "/invite/" + inviteToken + "/accept", { method: "POST", retry: 0 }
    );
  },
};

export var cnpjApi = {
  lookup: function(cnpj: string) {
    return request<any>("/onboarding/cnpj-lookup", { method: "POST", body: { cnpj: cnpj }, retry: 1 });
  },
};

export var onboardingApi = {
  get: function(companyId: string) { return request<any>("/companies/" + companyId + "/onboarding"); },
  stepCnpj: function(companyId: string, cnpj: string) {
    return request<any>("/companies/" + companyId + "/onboarding/step/cnpj", { method: "POST", body: { cnpj: cnpj } });
  },
  stepRegime: function(companyId: string, tax_regime: string) {
    return request<any>("/companies/" + companyId + "/onboarding/step/regime", { method: "POST", body: { tax_regime: tax_regime } });
  },
  stepPerfil: function(companyId: string, body: any) {
    return request<any>("/companies/" + companyId + "/onboarding/step/perfil", { method: "POST", body: body });
  },
};

export var referralsApi = {
  generate: function() { return request<{ code: string; existing: boolean }>("/referrals/generate", { method: "POST" }); },
  mine: function() { return request<any>("/referrals/mine"); },
};
