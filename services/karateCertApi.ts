// karateCertApi — cliente de API dos certificados (Fase 3/4/5).
import { request } from "@/services/api";
import type { CertLayout, CertSeal } from "@/components/karate/certificado/buildCertificateHtml";

export interface CertTemplateRow {
  id: string;
  name: string;
  layout: CertLayout;
  title: string;
  body_mode: "default" | "custom";
  body_text: string | null;
  seals: CertSeal[];
  is_default: boolean;
  active: boolean;
  created_at: string;
}
export interface CertTemplateInput {
  name?: string;
  layout?: CertLayout;
  title?: string;
  body_mode?: "default" | "custom";
  body_text?: string | null;
  seals?: CertSeal[];
  is_default?: boolean;
  active?: boolean;
}
export interface IssuedCertificate {
  id: string;
  student_id: string;
  verify_token: string;
  data_snapshot: any;
  template_snapshot: any;
  revoked: boolean;
  issued_at: string;
}

export const certApi = {
  listTemplates: (fedId: string): Promise<CertTemplateRow[]> =>
    request(`/federation/${fedId}/certificate-templates`),
  createTemplate: (fedId: string, body: CertTemplateInput): Promise<CertTemplateRow> =>
    request(`/federation/${fedId}/certificate-templates`, { method: "POST", body }),
  updateTemplate: (fedId: string, id: string, patch: CertTemplateInput): Promise<CertTemplateRow> =>
    request(`/federation/${fedId}/certificate-templates/${id}`, { method: "PATCH", body: patch }),
  deleteTemplate: (fedId: string, id: string): Promise<{ ok: boolean }> =>
    request(`/federation/${fedId}/certificate-templates/${id}`, { method: "DELETE" }),

  uploadSeal: (fedId: string, image_base64: string, image_content_type: string): Promise<{ url: string }> =>
    request(`/federation/${fedId}/certificate-seals`, { method: "POST", body: { image_base64, image_content_type }, timeout: 60000 }),

  emit: (fedId: string, examId: string, body: { template_id?: string; template?: any; dates_text?: string; issued_date_text?: string; location?: string; student_ids?: string[] }): Promise<{ issued: number; skipped: number; eligible: number }> =>
    request(`/federation/${fedId}/belt-exams/${examId}/certificates`, { method: "POST", body }),
  listIssued: (fedId: string, examId: string): Promise<IssuedCertificate[]> =>
    request(`/federation/${fedId}/belt-exams/${examId}/certificates`),
};
