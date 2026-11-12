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
  // 12/11/2026: venceu / vence em até 30 dias (calculado no backend)
  vencido?: boolean;
  vence_em_breve?: boolean;
} | null;

// 12/11/2026: onde o certificado A1 da empresa foi cadastrado.
//   cofre = o certificado que a emissão usa hoje (NFC-e e NFS-e);
//   os demais são envios antigos, sem validade conhecida (pedir de novo).
export type FonteCertificado = "cofre" | "nfse_legado" | "nuvem_fiscal_legado" | "nfce_legado";

export type EstadoRequisito = "ok" | "falta" | "problema" | "aviso" | "opcional";

export type Requisito = {
  chave: string;
  rotulo: string;
  estado: EstadoRequisito;
  detalhe: string;
  vale_ate?: string;
  uf?: string;
  ambiente?: string;
  serie?: string | number;
  proximo_numero?: string | number;
};

export type RequisitosNfce = { configurada: boolean; pronta: boolean; itens: Requisito[] };
export type RequisitosNfse = { configurada: boolean; apta: boolean; pendencias: string[]; itens: Requisito[] };

export type NfseResumo = {
  provider: string | null;
  ambiente: string | null;
  ativa: boolean;
  municipio_ibge: string | null;
} | null;

// NFS-e (emissor nacional) sem segredo, como o detalhe devolve.
export type NfseConfigPublica = {
  provider: string | null;
  ambiente: string | null;
  is_active: boolean | null;
  serie: string | null;
  next_dps_number: string | null;
  municipio_ibge: string | null;
  ctribnac_padrao: string | null;
  cnbs_padrao: string | null;
  op_simp_nac: number | null;
  reg_ap_trib_sn: number | null;
  p_tot_trib_sn: number | string | null;
  default_iss_rate: number | string | null;
  inscricao_municipal: string | null;
  outro_emissor: boolean | null;
  outro_emissor_serie: string | null;
  outro_emissor_ultimo_numero: string | null;
  ultimo_teste_status: string | null;
  ultimo_teste_mensagem: string | null;
  [k: string]: any;
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
  // ── 12/11/2026 (acréscimos; backend antigo não manda) ──
  na_lista_por?: "nfce_config" | "certificado";
  nfce_configurada?: boolean;
  nfse_configurada?: boolean;
  nfse?: NfseResumo;
  certificado_fontes?: FonteCertificado[];
  uf?: string | null;
  municipio?: string | null;
  nfce_pronta?: boolean;
  nfse_apta?: boolean;
  faltas?: { nfce: number; nfse: number };
};

// Item da busca (GET /empresas-sem-config) — empresa que já existe no sistema
// (cadastrada pelo próprio cliente) mas ainda não tem nfce_config. Alimenta o
// botão "Adicionar empresa" no painel.
export type EmpresaSemConfig = {
  company_id: string;
  name: string;
  legal_name: string;
  trade_name: string | null;
  cnpj: string | null;
  address_state: string | null;
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
  ambiente: string | null;       // 'homologacao' | 'producao' | null (sem config ainda)
  uf: string | null;
  provider: ProviderMode | null;
  serie_nfce: number | null;
  next_number: number | null;
  serie_sefaz_sp: number | null;
  next_number_sefaz_sp: number | null;
  csc_id: string | null;
  csc_ok: boolean;
  is_active: boolean | null;     // null = empresa ainda não tem nfce_config
};

export type AuraNotasDetail = {
  company: AuraNotasCompanyProfile;
  config: AuraNotasConfig;
  cert: CertInfo;
  stats_30d: Stats30d;
  breaker_open: boolean;
  // ── 12/11/2026 (acréscimos) ──
  nfce_configurada?: boolean;
  nfse_configurada?: boolean;
  nfse?: NfseConfigPublica;
  certificado_fontes?: FonteCertificado[];
  ufs_atendidas?: string[];
  requisitos?: { nfce: RequisitosNfce; nfse: RequisitosNfse };
};

// PUT /:companyId/fiscal — subconjunto editável dos campos fiscais + roteamento
// (UPSERT no backend: cria a linha de nfce_config se a empresa ainda não tiver)
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
  // 12/11/2026: próximo número da emissão própria + confirmações explícitas
  // (o backend responde 409 CONFIRMAR_PRODUCAO / CONFIRMAR_NUMERACAO sem elas)
  next_number_sefaz_sp?: number | null;
  confirmar_producao?: boolean;
  confirmar_numeracao?: boolean;
};

// PUT /:companyId/nfse — NFS-e pela equipe, com as regras do lojista.
export type NfseUpdateBody = {
  ambiente?: "producao_restrita" | "producao";
  is_active?: boolean;
  serie?: string;
  next_dps_number?: number;
  municipio_ibge?: string;
  ctribnac_padrao?: string;
  cnbs_padrao?: string | null;
  op_simp_nac?: number | null;
  p_tot_trib_sn?: number | null;
  inscricao_municipal?: string | null;
  outro_emissor?: boolean | null;
  outro_emissor_serie?: string | null;
  outro_emissor_ultimo_numero?: number | null;
  confirmar_producao?: boolean;
  confirmar_numeracao?: boolean;
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
    return request<{ companies: AuraNotasCompany[]; ufs_atendidas?: string[] }>(BASE + "/companies");
  },
  // Botão "Adicionar empresa": busca empresas já existentes no sistema (por
  // nome/CNPJ) que ainda não têm configuração fiscal no Aura Notas.
  searchEmpresasSemConfig: function(q?: string) {
    var qs = q && q.trim() ? "?q=" + encodeURIComponent(q.trim()) : "";
    return request<{ companies: EmpresaSemConfig[] }>(BASE + "/empresas-sem-config" + qs);
  },
  detail: function(companyId: string) {
    return request<AuraNotasDetail>(BASE + "/" + companyId);
  },
  updateFiscal: function(companyId: string, body: FiscalUpdateBody) {
    return request<{ ok: boolean }>(BASE + "/" + companyId + "/fiscal", { method: "PUT", body: body, retry: 0 });
  },
  // Botão "Remover": tira só a configuração fiscal do Aura Notas (nfce_config +
  // certificado A1) — a empresa em si continua existindo normalmente. Backend
  // recusa com 409 { code: "HAS_EMISSIONS" } se a empresa já emitiu alguma nota.
  // 12/11/2026: se a empresa usa NFS-e, o A1 é o mesmo; o backend só apaga
  // com apagarCertificado (409 CERTIFICADO_DA_NFSE sem ele).
  removeFiscal: function(companyId: string, opts?: { apagarCertificado?: boolean }) {
    var qs = opts && opts.apagarCertificado ? "?certificado=apagar" : "";
    return request<{ ok: boolean; certificado_removido?: boolean; nfse_afetada?: boolean }>(BASE + "/" + companyId + "/fiscal" + qs, { method: "DELETE", retry: 0 });
  },
  updateNfse: function(companyId: string, body: NfseUpdateBody) {
    return request<{ ok: boolean }>(BASE + "/" + companyId + "/nfse", { method: "PUT", body: body, retry: 0 });
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
