// ============================================================
// dentalAiApi — cliente HTTP da IA Aura Modo Consulta (PR19)
//
// Wraps endpoints do backend PR18 (src/routes/dentalConsultaAi.js
// + dentalAiSettings.js):
//   POST  /companies/:cid/dental/ai/consulta         (5 intents)
//   GET   /companies/:cid/dental/ai/consulta/usage   (stats mes)
//   GET   /companies/:cid/dental/ai/settings         (estado)
//   PATCH /companies/:cid/dental/ai/settings         (toggle)
//   POST  /companies/:cid/dental/ai/settings/consent (LGPD)
//
// Mantido fino: so tipos e funcoes que chamam request().
// React Query / cache fica em hooks/useDentalAiConsulta.ts.
// ============================================================

import { request } from "./api";

export type AiIntent = "brief" | "suggestion" | "qa" | "summarize" | "prescribe";

export interface AiToothChange {
  tooth_number: number;
  prev_status?: string | null;
  status: string;
  notes?: string | null;
}

export interface AiConsultaRequest {
  intent: AiIntent;
  appointmentId: string;
  patientId: string;
  query?: string;
  context?: {
    transcripts?: string[];
    toothChanges?: AiToothChange[];
  };
}

export interface AiConsultaResponse {
  ok: boolean;
  intent: AiIntent;
  text: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  latency_ms: number;
  quota: {
    used: number;
    total: number | null;
    remaining: number | null;
    unlimited?: boolean;
  };
  simulated?: boolean;
  // erros podem chegar via 429/403/500 — request() lanca ApiError
}

export interface AiUsageResponse {
  month_start: string;
  stats: {
    total_calls: number;
    ok_calls: number;
    error_calls: number;
    tokens_in_total: number;
    tokens_out_total: number;
    cost_usd_total: number;
    avg_latency_ms: number;
  };
  quota: { used: number | null; total: number | null; remaining: number | null; unlimited?: boolean };
}

export interface AiSettingsResponse {
  plan: string;
  vertical_active: string;
  ai_enabled: boolean;
  ai_consent_at: string | null;
  ai_consent_version: string | null;
  ai_consent_current_version: string;
  ai_consent_outdated: boolean;
  quota_total: number | null;
  quota_used: number;
  quota_remaining: number | null;
  cost_usd_month: number;
  consent_text: string;
}

export const dentalAiApi = {
  consulta(cid: string, body: AiConsultaRequest) {
    return request<AiConsultaResponse>(`/companies/${cid}/dental/ai/consulta`, {
      method: "POST",
      body,
      timeout: 35000, // LLM pode demorar ate 30s
      retry: 0,       // sem retry — caro e nao-idempotente
    });
  },

  usage(cid: string) {
    return request<AiUsageResponse>(`/companies/${cid}/dental/ai/consulta/usage`);
  },

  settings(cid: string) {
    return request<AiSettingsResponse>(`/companies/${cid}/dental/ai/settings`);
  },

  toggle(cid: string, body: { ai_enabled: boolean; accept_consent?: boolean }) {
    return request<{ ok: true; ai_enabled: boolean }>(`/companies/${cid}/dental/ai/settings`, {
      method: "PATCH",
      body,
    });
  },

  acceptConsent(cid: string) {
    return request<{ ok: true; consent_version: string; consent_at: string }>(
      `/companies/${cid}/dental/ai/settings/consent`,
      { method: "POST" }
    );
  },
};
