// karateDojoCertApi — cliente do certificado NÃO OFICIAL do PRÓPRIO DOJÔ
// (F9.1, Aura-backend#PR-271/karateDojoCertificates.js). Espelha
// services/karateCertApi.ts (o client do certificado OFICIAL da
// federação) na forma — mesmos nomes de método, mesmo formato de
// template — mas aponta para /federation/:id/dojo/* (não
// /federation/:id/*) e usa "own-certificates" (não "certificates"), de
// propósito: /dojo/cert-orders JÁ SIGNIFICA o pedido OFICIAL à federação
// (karateDojoFederativoApi.ts). Reusar um nome parecido misturaria dois
// documentos com peso jurídico diferente.
//
// signatories É A DIFERENÇA ESTRUTURAL vs a federação: aqui mora no
// TEMPLATE (o exame do dojô não tem tabela de "instrutores do evento").
// Ver migration 271 (Aura-backend) e o comentário de topo de
// karateDojoCertificates.js.
import { request } from "@/services/api";
import type { CertLayout, CertFont, CertSeal, CertSignatory } from "@/components/karate/certificado/buildCertificateHtml";

export interface DojoCertTemplateRow {
  id: string;
  name: string;
  layout: CertLayout;
  title: string;
  body_mode: "default" | "custom";
  body_text: string | null;
  seals: CertSeal[];
  signatories: CertSignatory[];
  font: CertFont;
  text_scale: number | null;
  auto_fit: boolean;
  is_default: boolean;
  active: boolean;
  created_at: string;
}

export interface DojoCertTemplateInput {
  name?: string;
  layout?: CertLayout;
  title?: string;
  body_mode?: "default" | "custom";
  body_text?: string | null;
  seals?: CertSeal[];
  signatories?: CertSignatory[];
  font?: CertFont;
  text_scale?: number | null;
  auto_fit?: boolean;
  is_default?: boolean;
  active?: boolean;
}

export interface DojoIssuedCertificate {
  id: string;
  student_id: string;
  verify_token: string;
  data_snapshot: any;
  template_snapshot: any;
  revoked: boolean;
  issued_at: string;
}

export interface EmitOwnCertificatesBody {
  template_id?: string;
  template?: DojoCertTemplateInput;
  dates_text?: string;
  issued_date_text?: string;
  location?: string;
  /** Sem filtro = todos os APROVADOS do exame (mesmo comportamento da federação). */
  student_ids?: string[];
}

export interface EmitOwnCertificatesResult {
  issued: number;
  skipped: number;
  eligible: number;
  ids: string[];
}

function str(v: any): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function normalizeTemplate(raw: any): DojoCertTemplateRow {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    id: String(r.id ?? ""),
    name: str(r.name) || "Modelo",
    layout: (["A", "B", "C", "D", "E"].includes(r.layout) ? r.layout : "A") as CertLayout,
    title: str(r.title) || "CERTIFICADO",
    body_mode: r.body_mode === "custom" ? "custom" : "default",
    body_text: str(r.body_text),
    seals: Array.isArray(r.seals) ? r.seals : [],
    signatories: Array.isArray(r.signatories) ? r.signatories : [],
    font: (["classica", "imponente", "elegante", "sofisticada", "tradicional"].includes(r.font) ? r.font : "classica") as CertFont,
    text_scale: typeof r.text_scale === "number" ? r.text_scale : null,
    auto_fit: r.auto_fit === true,
    is_default: r.is_default === true,
    active: r.active !== false,
    created_at: str(r.created_at) || "",
  };
}
function normalizeIssued(raw: any): DojoIssuedCertificate {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    id: String(r.id ?? ""),
    student_id: String(r.student_id ?? ""),
    verify_token: String(r.verify_token ?? ""),
    data_snapshot: r.data_snapshot ?? {},
    template_snapshot: r.template_snapshot ?? {},
    revoked: r.revoked === true,
    issued_at: str(r.issued_at) || "",
  };
}

const base = (federationId: string) => `/federation/${federationId}/dojo`;

export const karateDojoCertApi = {
  // ── Modelo (template) do dojô ──────────────────────────────
  listTemplates: async (federationId: string): Promise<DojoCertTemplateRow[]> => {
    const res = await request<any>(`${base(federationId)}/certificate-templates`);
    return Array.isArray(res?.data) ? res.data.map(normalizeTemplate) : [];
  },
  createTemplate: (federationId: string, body: DojoCertTemplateInput): Promise<DojoCertTemplateRow> =>
    request<any>(`${base(federationId)}/certificate-templates`, { method: "POST", body }).then(normalizeTemplate),
  updateTemplate: (federationId: string, id: string, patch: DojoCertTemplateInput): Promise<DojoCertTemplateRow> =>
    request<any>(`${base(federationId)}/certificate-templates/${id}`, { method: "PATCH", body: patch }).then(normalizeTemplate),
  deleteTemplate: (federationId: string, id: string): Promise<{ ok: boolean }> =>
    request(`${base(federationId)}/certificate-templates/${id}`, { method: "DELETE" }),

  // ── Upload de selo OU assinatura (purpose muda só o namespace no R2) ──
  uploadAsset: (
    federationId: string,
    image_base64: string,
    image_content_type: string,
    purpose: "seal" | "signature" = "seal"
  ): Promise<{ url: string }> =>
    request(`${base(federationId)}/certificate-assets`, {
      method: "POST",
      body: { image_base64, image_content_type, purpose },
      timeout: 60000,
    }),

  // ── Emissão em massa a partir de um exame concluído ────────
  emit: (federationId: string, examId: string, body: EmitOwnCertificatesBody): Promise<EmitOwnCertificatesResult> =>
    request(`${base(federationId)}/graduation-exams/${examId}/own-certificates`, { method: "POST", body }),

  // ── Emitidos DESTE exame ───────────────────────────────────
  listIssuedByExam: async (federationId: string, examId: string): Promise<DojoIssuedCertificate[]> => {
    const res = await request<any>(`${base(federationId)}/graduation-exams/${examId}/own-certificates`);
    return Array.isArray(res?.data) ? res.data.map(normalizeIssued) : [];
  },

  // ── Status geral — todos os certificados do dojô emitidos (paginado) ──
  listAllIssued: async (
    federationId: string,
    opts: { page?: number; pageSize?: number } = {}
  ): Promise<{ data: DojoIssuedCertificate[]; count: number; page: number; pageSize: number }> => {
    const qs: string[] = [];
    if (opts.page != null) qs.push(`page=${opts.page}`);
    if (opts.pageSize != null) qs.push(`pageSize=${opts.pageSize}`);
    const res = await request<any>(`${base(federationId)}/own-certificates${qs.length ? `?${qs.join("&")}` : ""}`);
    const data = Array.isArray(res?.data) ? res.data.map(normalizeIssued) : [];
    return {
      data,
      count: typeof res?.count === "number" ? res.count : data.length,
      page: typeof res?.page === "number" ? res.page : 1,
      pageSize: typeof res?.pageSize === "number" ? res.pageSize : data.length,
    };
  },
};

export default karateDojoCertApi;
