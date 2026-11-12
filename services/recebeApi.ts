// ============================================================
// Recebe na Aura — API da subconta (RA-06, 12/11/2026)
//
// Backend (Aura-backend, routes/companyRecebe.js):
//   GET  /companies/:id/recebe/status            situação + 4 blocos
//   POST /companies/:id/recebe/status/atualizar  lê de novo na Asaas
// Flag RECEBE_NA_AURA_ENABLED desligada → 404 RECEBE_INDISPONIVEL; quem não
// é dono/admin → 403. As duas respostas querem dizer "esta tela não existe
// para você": a tela some (hooks/useRecebeNaAura.ts).
// ============================================================
import { request } from "@/services/api";

export type RecebeBlocoKey = "dados_comerciais" | "documentos" | "dados_bancarios" | "geral";
export type RecebeBlocoStatus = "PENDING" | "AWAITING_APPROVAL" | "APPROVED" | "REJECTED" | null;
export type RecebeBloco = { key: RecebeBlocoKey; status: RecebeBlocoStatus };

export type RecebeStatus = {
  enabled: boolean;
  product_name: string;
  /** none | creating | created | docs_pending | under_review | approved | rejected */
  status: string;
  holder_type: "PJ" | "PF" | "MEI" | null;
  onboarding_url: string | null;
  account: {
    agency: string | null;
    account: string | null;
    account_digit: string | null;
    wallet_id_masked: string | null;
  } | null;
  /** null = sem subconta. */
  blocks: RecebeBloco[] | null;
  blocks_updated_at: string | null;
  created_at: string | null;
};

export const recebeApi = {
  getStatus(companyId: string) {
    return request<RecebeStatus>(`/companies/${companyId}/recebe/status`, { retry: 0 });
  },
  atualizarStatus(companyId: string) {
    return request<RecebeStatus>(`/companies/${companyId}/recebe/status/atualizar`, { method: "POST", retry: 0 });
  },
};
