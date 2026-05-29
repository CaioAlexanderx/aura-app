// ============================================================
// AURA. — NFC-e/NF-e API client (rotas /companies/:id/nfce/*)
// ============================================================

import { request } from "./api";

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

// Pagamento individual da NFC-e (usado em multi-pagamento).
// method: chave interna ('pix','dinheiro','credito','debito',...) — backend mapeia pra tPag SEFAZ.
// value: valor desse pagamento. Soma dos values deve bater com total da nota.
export type NfcePaymentEntry = {
  method: string;
  value: number;
  change?: number;
  indPag?: 0 | 1;
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
  qr_code: string | null;
  url_consulta: string | null;
  authorized_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  error_message: string | null;
  // Campos opcionais — só vêm no GET /:id (SELECT *), ausentes na LIST.
  // Usados pelo fluxo de Reemissão (carrega items+sale_id da nota rejeitada).
  sale_id?: string | null;
  transaction_id?: string | null;
  items?: NfceEmissionItem[];
  payment_change?: number | null;
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
  /** Se true, o PDV emite NFC-e automaticamente após finalizar a venda. */
  auto_emit_nfce: boolean;
};

export type NfceConfigResponse = {
  config: NfceConfig | null;
  instrucoes: { nfce: string; nfe: string; dica: string };
};

export type NfceConfigUpdateBody = Partial<{
  serie_nfce: number;
  ambiente: "homologacao" | "producao";
  uf: string;
  inscricao_estadual: string | null;
  csc_id: string | null;
  csc_token: string | null;
  auto_emit_nfce: boolean;
}>;

export type EmitBody = {
  items: NfceEmissionItem[];
  tipo?: NfeKind;
  customer_cpf?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  recipient_cnpj?: string | null;
  /** Multi-pagamento: array de { method, value, change?, indPag? } */
  payments?: NfcePaymentEntry[];
  /** Legado: shape singular. Use `payments[]` quando possível. */
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
  /** True quando idempotência por sale_id retornou nota existente. */
  idempotent?: boolean;
};

export type EmitErrorPayload = {
  error: string;
  payload?: any;
  nfce_id?: string;
};

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

  saveConfig: (companyId: string, body: NfceConfigUpdateBody) =>
    request<{ config: NfceConfig }>(
      "/companies/" + companyId + "/nfce/config",
      { method: "POST", body, retry: 0 }
    ),
};
