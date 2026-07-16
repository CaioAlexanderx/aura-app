import { request } from "./api";

// ─── Aura Notas — Gestão fiscal staff ─────────────────────────────────────────
// UI interna (Gestão Aura) que substitui o painel da Nuvem Fiscal para a gestão
// fiscal das empresas: dados fiscais, CSC, certificado A1 e status da engine.
// Base: /admin/aura-notas (rotas staff-only; o backend exige is_staff).
// O shape abaixo é CONGELADO em conjunto com o backend.

export type ProviderMode = "auto" | "sefaz_sp" | "nuvemfiscal";

export type CertInfo = {
  subject_cn: string;
  not_before?: string;
  not_after: string;
  days_left: number;
  updated_at?: string;
} | null;

export type Stats30d = {
  total: number;
  engine: number;
  gateway: number;
  fallbacks: number;
};

export type LastEmission = {
  at: string;
  provider_used: string;
  status: string;
} | null;

// Item da lista (GET /companies)
export type AuraNotasCompany = {
  company_id: string;
  name: string;
  cnpj: string;
  ambiente: string;              // 'homologacao' | 'producao'
  provider: ProviderMode;        // override configurado
  provider_efetivo: string;      // 'sefaz_sp' | 'nuvemfiscal' — o que está sendo usado
  engine_capable: boolean;
  csc_ok: boolean;
  serie_sefaz_sp: number | null;
  cert: CertInfo;
  last_emission: LastEmission;
  stats_30d: Stats30d;
  breaker_open: boolean;
};

// Detalhe (GET /:companyId)
export type AuraNotasCompanyProfile = {
  legal_name: string;
  trade_name: string | null;
  cnpj: string;
  address_street: string | null;
  address_number: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  ibge_code: string | null;
  inscricao_estadual: string | null;
  tax_regime: string | null;
};

export type AuraNotasConfig = {
  ambiente: string;              // 'homologacao' | 'producao'
  uf: string | null;
  provider: ProviderMode;
  serie_nfce: number | null;
  next_number: number | null;
  serie_sefaz_sp: number | null;
  next_number_sefaz_sp: number | null;
  csc_id: string | null;
  csc_ok: boolean;
  is_active: boolean;
};

export type AuraNotasDetail = {
  company: AuraNotasCompanyProfile;
  config: AuraNotasConfig;
  cert: CertInfo;
  stats_30d: Stats30d;
  breaker_open: boolean;
};

// PUT /:companyId/fiscal — subconjunto editável dos campos fiscais + roteamento
export type FiscalUpdateBody = {
  legal_name?: string;
  trade_name?: string | null;
  inscricao_estadual?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_district?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  ibge_code?: string | null;
  tax_regime?: string | null;
  serie_nfce?: number | null;
  serie_sefaz_sp?: number | null;
  ambiente?: string;
  uf?: string | null;
  provider?: ProviderMode;
  is_active?: boolean;
};

export type CscUpdateBody = { csc_id: string; csc_token: string };

export type CertificateUploadBody = { pfx_base64: string; password: string };
export type CertificateUploadResponse = {
  subject_cn: string;
  not_before: string;
  not_after: string;
  days_left: number;
};

export type TestConexaoResponse = {
  ok: boolean;
  cStat: string | null;
  motivo: string | null;
  latency_ms: number | null;
};

var BASE = "/admin/aura-notas";

export var auraNotasApi = {
  listCompanies: function() {
    return request<{ companies: AuraNotasCompany[] }>(BASE + "/companies");
  },
  detail: function(companyId: string) {
    return request<AuraNotasDetail>(BASE + "/" + companyId);
  },
  updateFiscal: function(companyId: string, body: FiscalUpdateBody) {
    return request<{ ok: boolean }>(BASE + "/" + companyId + "/fiscal", { method: "PUT", body: body, retry: 0 });
  },
  updateCsc: function(companyId: string, body: CscUpdateBody) {
    return request<{ ok: boolean }>(BASE + "/" + companyId + "/csc", { method: "PUT", body: body, retry: 0 });
  },
  uploadCertificate: function(companyId: string, body: CertificateUploadBody) {
    return request<CertificateUploadResponse>(BASE + "/" + companyId + "/certificate", { method: "POST", body: body, retry: 0 });
  },
  testConexao: function(companyId: string) {
    return request<TestConexaoResponse>(BASE + "/" + companyId + "/test-conexao", { method: "POST", retry: 0, timeout: 20000 });
  },
};
