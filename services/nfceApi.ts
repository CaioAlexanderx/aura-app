// ============================================================
// AURA. — NFC-e/NF-e API client (rotas /companies/:id/nfce/*)
//
// Substitui o nfeApi antigo (que batia em /nfe/* legado e mandava
// payload fictício). Use este client em qualquer tela que precisa
// emitir, listar ou cancelar NFC-e/NF-e.
// ============================================================

import { request } from "./api";

// ── Types ───────────────────────────────────────────────────
export type NfeKind = "nfce" | "nfe";

export type NfceStatus =
  | "processando"
  | "autorizada"
  | "rejeitada"
  | "cancelada"
  | "erro";

export type NfceEmissionItem = {
  product_id?: string | null;
  product_name?: string;
  name?: string;
  description?: string;
  quantity: number;
  unit_price: number;
  ncm?: string;
  cfop?: string;
  unit?: string;
  barcode?: string | null;
  discount?: number;
};

export type NfceEmission = {
  id: string;
  numero: number;
  serie: number;
  tipo: NfeKind;
  chave_acesso: string | null;
  protocolo: string | null;
  status: NfceStatus;
  customer_cpf: string | null;
  customer_name: string | null;
  total_nfce: number;
  payment_method: string | null;
  xml_url: string | null;
  pdf_url: string | null;
  qr_code: string | null;       // string completa do QR (NFC-e infNFeSupl.qrCode)
  url_consulta: string | null;  // URL de consulta SEFAZ (infNFeSupl.urlChave)
  authorized_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  error_message: string | null;
};

export type NfceStats = {
  total: number;
  authorized: number;
  cancelled: number;
  total_nfe: number;
  total_nfce: number;
  total_value: number;
};

export type NfceConfig = {
  id: string;
  company_id: string;
  serie_nfce: number;
  next_number: number;
  ambiente: "homologacao" | "producao";
  uf: string;
  inscricao_estadual: string | null;
  is_active: boolean;
  csc_id: string | null;
};

export type NfceConfigResponse = {
  config: NfceConfig | null;
  instrucoes: { nfce: string; nfe: string; dica: string };
};

export type EmitBody = {
  items: NfceEmissionItem[];
  tipo?: NfeKind;
  customer_cpf?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  recipient_cnpj?: string | null;
  payment_method?: string;
  payment_change?: number;
  sale_id?: string;
  transaction_id?: string;
  observacoes?: string;
};

export type EmitResponse = {
  nfce: NfceEmission;
  tipo: NfeKind;
  pdf_url: string | null;
  xml_url: string | null;
  qr_code: string | null;
  url_consulta: string | null;
};

// Erro retornado em rejeição: 502 + payload original Nuvem Fiscal
export type EmitErrorPayload = {
  error: string;
  payload?: any;
  nfce_id?: string;
};

// ── API ─────────────────────────────────────────────────────
export const nfceApi = {
  list: (companyId: string, filters?: { status?: NfceStatus; tipo?: NfeKind; start?: string; end?: string }) => {
    const qs: string[] = [];
    if (filters?.status) qs.push("status=" + encodeURIComponent(filters.status));
    if (filters?.tipo)   qs.push("tipo="   + encodeURIComponent(filters.tipo));
    if (filters?.start)  qs.push("start="  + encodeURIComponent(filters.start));
    if (filters?.end)    qs.push("end="    + encodeURIComponent(filters.end));
    const suffix = qs.length ? "?" + qs.join("&") : "";
    return request<{ emissions: NfceEmission[]; stats: NfceStats }>(
      "/companies/" + companyId + "/nfce" + suffix,
      { retry: 1 }
    );
  },

  get: (companyId: string, emissionId: string) =>
    request<{ emission: NfceEmission }>(
      "/companies/" + companyId + "/nfce/" + emissionId,
      { retry: 1 }
    ),

  emit: (companyId: string, body: EmitBody) =>
    request<EmitResponse>(
      "/companies/" + companyId + "/nfce/emit",
      { method: "POST", body, retry: 0, timeout: 30000 }
    ),

  cancel: (companyId: string, emissionId: string, reason: string) =>
    request<{ nfce: NfceEmission }>(
      "/companies/" + companyId + "/nfce/" + emissionId + "/cancel",
      { method: "POST", body: { reason }, retry: 0, timeout: 15000 }
    ),

  getConfig: (companyId: string) =>
    request<NfceConfigResponse>(
      "/companies/" + companyId + "/nfce/config",
      { retry: 1 }
    ),
};
