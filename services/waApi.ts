// ============================================================
// waApi — WhatsApp Cloud API da company (Onda 5b)
//
// Cliente tipado do Aura-backend, rotas /companies/:companyId/whatsapp/*.
// Bearer = JWT normal do app via request() core (Canal A); o dono da
// company é quem pode chamar. No karatê, o dojô É uma company —
// companyId = id da company do sensei logado (useAuthStore().company.id).
//
// A régua de mensalidades (karateDojoBillingApi) ganhou o campo
// `send_whatsapp_auto`: quando ligado, além do e-mail ela enfileira
// TEMPLATES de WhatsApp automaticamente por aqui. A fila manual wa.me
// (dojo/reminders/whatsapp-queue) continua existindo e é independente.
//
// Erros conhecidos (ApiError.data.code — ver mapWaError em
// components/karate/dojoWhatsapp/helpers.ts):
//   409 NAO_CONECTADO — sem WABA/token configurado para a company.
//   409 TOKEN_EXPIRADO — o token existe mas a Meta o recusou. O corpo traz
//     `error` já em pt-BR (é o que vai pra tela) e `detail` com o texto da
//     Meta em inglês — detalhe de suporte, NUNCA na tela principal.
// `schema_pending` NÃO é erro: vem true dentro do GET /status quando a
// migration ainda não rodou no ambiente (estado vazio, nunca crash).
// ============================================================
import { request } from "@/services/api";

// ── Status ────────────────────────────────────
/** Contadores da fila por status. Campos ausentes = zero (backend omite). */
export interface WaQueueCounts {
  pending?: number;
  sent?: number;
  delivered?: number;
  read?: number;
  failed?: number;
  skipped?: number;
}

export interface WaStatus {
  /** Já vem false quando a Meta recusou o token (ver token_expired). */
  connected: boolean;
  phone_display: string | null;
  waba_id: string | null;
  queue: WaQueueCounts;
  /** true = migration pendente no ambiente; a UI mostra estado vazio. */
  schema_pending: boolean;
  /**
   * true = o número está cadastrado mas o token da Meta venceu — estado de
   * AVISO (reconectar), não de "nunca conectou". Opcional: backend antigo
   * não devolve o campo.
   */
  token_expired?: boolean;
  /** ISO de quando o token venceu; null/ausente quando não dá pra saber. */
  token_expired_at?: string | null;
}

// ── Templates ─────────────────────────────────
/** Status vem da Meta via webhook. Aberto a string: a Meta cria estados novos. */
export type WaTemplateStatus = "APPROVED" | "REJECTED" | "PENDING" | (string & {});

export interface WaTemplate {
  name: string;
  language: string;
  category: string;
  status: WaTemplateStatus;
  body_preview: string | null;
  last_status_at: string | null;
}

export interface WaTemplatesResponse {
  data: WaTemplate[];
}

export interface WaSyncResult {
  synced: number;
}

// ── Outbox (fila de envio) ────────────────────
export type WaOutboxStatus =
  | "pending" | "sent" | "delivered" | "read" | "failed" | "skipped" | (string & {});

export interface WaOutboxItem {
  id: string;
  to_phone: string;
  kind: string | null;
  template_name: string | null;
  status: WaOutboxStatus;
  skip_reason: string | null;
  attempts: number | null;
  last_error: string | null;
  source_type: string | null;
  created_at: string;
}

export interface WaOutboxResponse {
  /** Últimos 50, mais recentes primeiro. */
  data: WaOutboxItem[];
}

// ── Envio de teste ────────────────────────────
export interface WaTestSendPayload {
  /** Telefone do destinatário (dígitos; o backend normaliza o DDI). */
  to: string;
  template_name?: string;
  language?: string;
  components?: unknown[];
  /** Texto livre (só funciona dentro da janela de 24h). */
  text?: string;
}

export interface WaTestSendOutcome {
  status: WaOutboxStatus;
  skip_reason: string | null;
  last_error: string | null;
  wa_message_id: string | null;
}

export interface WaTestSendResult {
  outbox_id: string;
  result: WaTestSendOutcome;
  batch: unknown;
}

// ── Opt-in / opt-out do contato ───────────────
export interface WaOptPayload {
  phone: string;
  action: "in" | "out";
}

const base = (companyId: string) => `/companies/${companyId}/whatsapp`;

export const waApi = {
  getStatus: (companyId: string): Promise<WaStatus> =>
    request<WaStatus>(`${base(companyId)}/status`),

  listTemplates: (companyId: string): Promise<WaTemplatesResponse> =>
    request<WaTemplatesResponse>(`${base(companyId)}/templates`),

  syncTemplates: (companyId: string): Promise<WaSyncResult> =>
    request<WaSyncResult>(`${base(companyId)}/templates/sync`, {
      method: "POST",
      // Ida à Meta pode passar dos 10s default.
      timeout: 20000,
    }),

  listOutbox: (companyId: string): Promise<WaOutboxResponse> =>
    request<WaOutboxResponse>(`${base(companyId)}/outbox`),

  testSend: (companyId: string, payload: WaTestSendPayload): Promise<WaTestSendResult> =>
    request<WaTestSendResult>(`${base(companyId)}/test-send`, {
      method: "POST",
      body: payload,
      timeout: 20000,
    }),

  setContactOpt: (companyId: string, payload: WaOptPayload): Promise<void> =>
    request<void>(`${base(companyId)}/contacts/opt`, {
      method: "POST",
      body: payload,
    }),
};
