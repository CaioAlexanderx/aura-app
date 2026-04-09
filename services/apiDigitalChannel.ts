// AURA. — api.ts patch: add digital channel endpoints to companiesApi
// This file should be merged into the main companiesApi object in services/api.ts
// Add these 3 methods after the appointments section:

// Digital Channel + Storefront + Dominio
//   digitalChannel: (companyId: string) => request<any>(`/companies/${companyId}/digital-channel`),
//   updateDigitalChannel: (companyId: string, body: any) => request<any>(`/companies/${companyId}/digital-channel`, { method: "PUT", body }),
//   requestDomain: (companyId: string, domain: string, plan: string) => request<any>(`/companies/${companyId}/digital-channel/request-domain`, { method: "POST", body: { domain, plan } }),

import { companiesApi, request } from './api';

// Extend companiesApi with digital channel methods
Object.assign(companiesApi, {
  digitalChannel: (companyId: string) => request<any>(`/companies/${companyId}/digital-channel`),
  updateDigitalChannel: (companyId: string, body: any) => request<any>(`/companies/${companyId}/digital-channel`, { method: "PUT", body }),
  requestDomain: (companyId: string, domain: string, plan: string) => request<any>(`/companies/${companyId}/digital-channel/request-domain`, { method: "POST", body: { domain, plan } }),
});

export { companiesApi };
