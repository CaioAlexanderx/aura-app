// ============================================================
// AURA. — Certificado A1 pelo cliente (rotas /companies/:id/fiscal-certificate)
// 14/10/2026 — contrato do backend (Aura-backend, feat/cert-a1-cliente):
//
//   GET  → { cert: { subject_cn, not_before, not_after, days_left, updated_at } | null,
//            empresa_cnpj, pode_enviar }          (só metadados, nenhum segredo)
//   POST { pfx_base64, password } → 201 { subject_cn, not_before, not_after, days_left }
//   Erros: { error: "mensagem em português", code } — ver utils/certificadoA1.ts
//
// SEGREDO: este cliente não loga nada e não guarda o corpo do POST em lugar
// nenhum (nem cache do react-query: quem chama usa uma função comum, não
// useMutation, que mantém as variáveis na memória).
// ============================================================

import { request } from "./api";
import type { CertInfo } from "@/utils/certificadoA1";

export type FiscalCertificateGet = {
  cert: CertInfo | null;
  /** CNPJ da empresa, só dígitos. */
  empresa_cnpj: string | null;
  /** O servidor decide: só o dono (ou a equipe Aura) envia. */
  pode_enviar: boolean;
};

export type FiscalCertificateUploadBody = { pfx_base64: string; password: string };

export type FiscalCertificateUploadResult = {
  subject_cn: string;
  not_before: string | null;
  not_after: string;
  days_left: number | null;
};

const base = (companyId: string) => "/companies/" + companyId + "/fiscal-certificate";

export const fiscalCertificateApi = {
  get: (companyId: string) =>
    request<FiscalCertificateGet>(base(companyId)),

  // retry: 0 — o envio NÃO se repete sozinho (a senha já foi consumida e o
  // servidor conta tentativas por empresa); timeout maior pela abertura do .pfx.
  upload: (companyId: string, body: FiscalCertificateUploadBody) =>
    request<FiscalCertificateUploadResult>(base(companyId), {
      method: "POST",
      body,
      retry: 0,
      timeout: 20000,
    }),
};
