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
//   403 ADDON_REQUIRED — o adicional "WhatsApp automático" não está ativo
//     para a company (gate do PUT reminder-config).
//   409 TEMPLATE_NAO_APROVADO — o template de cobrança ainda não passou
//     pela Meta.
// `schema_pending` NÃO é erro: vem true dentro do GET /status quando a
// migration ainda não rodou no ambiente (estado vazio, nunca crash).
//
// Fase 3 (conexão própria + guardas de custo): CADA MENSAGEM CUSTA
// DINHEIRO. O /status ganhou os campos que a UI usa para tornar
// impossível ligar o automático sem addon, sem número conectado e sem
// template aprovado — e o /preview diz, ANTES de ligar, quantas
// mensagens sairiam. Todos os campos novos são OPCIONAIS: backend
// anterior à Fase 1 simplesmente não os devolve, e nada na tela pode
// quebrar por causa disso (ausente = desconhecido, nunca = liberado).
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

/** Nota de qualidade do número na Meta. Aberto a string: a Meta muda. */
export type WaQualityRating = "GREEN" | "YELLOW" | "RED" | (string & {});

/** Consumo do mês/dia. Campos ausentes = backend anterior à Fase 1. */
export interface WaUsage {
  today_sent?: number;
  month_sent?: number;
  /** Teto diário por company (env WA_DAILY_CAP no backend, default 300). */
  daily_cap?: number;
}

/** Parâmetros do Embedded Signup da Meta (vêm do env do backend). */
export interface WaEmbeddedSignup {
  app_id?: string | null;
  config_id?: string | null;
  graph_version?: string | null;
}

/**
 * Presets de template que o backend sabe criar (Fase 6c). O mapeamento
 * regra do crediário → preset: lembrete/confirmacao/vencimento →
 * `parcela_lembrete`; atraso_1/atraso_2 → `parcela_atraso`; `bloqueio`
 * não é WhatsApp. A mensalidade do dojô continua sendo o default (sem
 * preset).
 */
export type WaTemplatePreset = "mensalidade_lembrete" | "parcela_lembrete" | "parcela_atraso";

/** Quais templates já estão APPROVED na Meta. Chave ausente = não. */
export type WaTemplatesReady = Partial<Record<WaTemplatePreset, boolean>> & Record<string, boolean | undefined>;

/** Templates que a régua do crediário precisa antes de ligar o automático. */
export const WA_CREDIARIO_TEMPLATES: WaTemplatePreset[] = ["parcela_lembrete", "parcela_atraso"];

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

  // ── Fase 1f: guardas de custo (todos opcionais) ──────────
  /** Adicional "WhatsApp automático" ativo para a company. */
  addon_active?: boolean;
  /** Template de cobrança existe e está APPROVED na Meta. */
  template_ready?: boolean;
  /** Nome efetivo do template de cobrança (env do backend ou default). */
  template_name?: string | null;
  /** Status conhecido desse template (APPROVED/PENDING/REJECTED/…). */
  template_status?: string | null;
  /**
   * Fase 6c — um template por tipo de aviso, cada um aprovado (ou não)
   * pela Meta separadamente. `template_ready` acima continua sendo só o
   * da mensalidade do dojô (legado).
   *
   * Chave AUSENTE = NÃO aprovada. Omissão nunca vira liberação: é por aí
   * que sairia mensagem paga com template que a Meta ainda vai recusar.
   */
  templates_ready?: WaTemplatesReady;
  quality_rating?: WaQualityRating | null;
  /** QUALIDADE_BAIXA | CONTA_RESTRITA | MANUAL — fila pausada. */
  paused_reason?: string | null;
  /** subscribed_apps feito (sem isso o webhook nunca recebe evento). */
  subscribed?: boolean;
  /** /register do número feito na Cloud API. */
  registered?: boolean;
  usage?: WaUsage;
  embedded_signup?: WaEmbeddedSignup | null;
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

// ── Conexão do número (Embedded Signup) ───────
export interface WaConnectPayload {
  /** Código do Facebook Login for Business (response_type 'code'). */
  code: string;
  /** Vêm do evento WA_EMBEDDED_SIGNUP; o backend descobre sozinho se faltar. */
  waba_id?: string | null;
  phone_number_id?: string | null;
}

export interface WaConnectResult {
  connected: boolean;
  phone_display?: string | null;
  waba_id?: string | null;
  phone_number_id?: string | null;
  /** subscribed_apps na WABA — sem isso o webhook não recebe nada. */
  subscribed?: boolean;
  /** /register do número (PIN) — sem isso a Meta recusa o envio (133010). */
  registered?: boolean;
  /** Passos que falharam sem impedir a conexão. Já vêm em pt-BR. */
  warnings?: string[];
}

// ── Prévia do disparo automático (sem enfileirar) ─
/**
 * Contagem por motivo de pulo. Chaves conhecidas: OPT_OUT, JA_ENVIADO,
 * SEM_TELEFONE, TELEFONE_INVALIDO, TEMPLATE_NAO_APROVADO, LIMITE_DIARIO,
 * LIMITE_POR_CONTATO, PAUSADO, ADDON_INATIVO. Aberto porque o backend
 * pode ganhar motivos novos — a UI traduz o que conhece e humaniza o resto.
 */
export type WaPreviewSkipped = Record<string, number>;

/** Qual régua a prévia simula. Omitido no backend = mensalidade do dojô. */
export type WaPreviewSource = "crediario" | (string & {});

export interface WaPreviewItem {
  student_name?: string | null;
  /** No crediário quem recebe é cliente, não aluno — o backend reusa o shape. */
  customer_name?: string | null;
  /** Já vem mascarado pelo backend — nunca o telefone inteiro. */
  phone_masked?: string | null;
  amount?: number | null;
  due_date?: string | null;
  /** null = entraria no envio; preenchido = motivo do pulo. */
  reason?: string | null;
}

export interface WaPreview {
  date: string;
  template_name?: string | null;
  /** Quantas mensagens SAIRIAM (e seriam cobradas) nessa data. */
  would_send: number;
  skipped?: WaPreviewSkipped;
  /** Máx. 200 itens — amostra, não a lista completa. */
  items?: WaPreviewItem[];
}

// ── Criação do template de cobrança ───────────
export interface WaCreateTemplateResult {
  name: string;
  language: string;
  meta?: unknown;
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

  /**
   * Troca o `code` do Embedded Signup pelo token da company e registra o
   * número (subscribed_apps + /register). Ida à Meta em vários passos —
   * o timeout default de 10s não dá conta.
   */
  connect: (companyId: string, payload: WaConnectPayload): Promise<WaConnectResult> =>
    request<WaConnectResult>(`${base(companyId)}/connect`, {
      method: "POST",
      body: payload,
      timeout: 30000,
    }),

  disconnect: (companyId: string): Promise<void> =>
    request<void>(`${base(companyId)}/disconnect`, { method: "POST", timeout: 20000 }),

  /**
   * Quantas mensagens sairiam na data — SEM enfileirar nada. É o que a
   * régua mostra antes de deixar ligar o automático.
   *
   * `source` escolhe a régua simulada: omitido = mensalidade do dojô
   * (comportamento da Fase 2, mantido para não quebrar a tela do dojô);
   * 'crediario' = régua de parcelas do varejo. O segundo argumento
   * aceita a data solta (chamada antiga) ou o objeto.
   */
  getPreview: (
    companyId: string,
    opts?: string | { source?: WaPreviewSource; date?: string | null }
  ): Promise<WaPreview> => {
    const o = typeof opts === "string" ? { date: opts } : (opts || {});
    const qs: string[] = [];
    if (o.source) qs.push(`source=${encodeURIComponent(o.source)}`);
    if (o.date) qs.push(`date=${encodeURIComponent(o.date)}`);
    return request<WaPreview>(`${base(companyId)}/preview${qs.length ? `?${qs.join("&")}` : ""}`);
  },

  listTemplates: (companyId: string): Promise<WaTemplatesResponse> =>
    request<WaTemplatesResponse>(`${base(companyId)}/templates`),

  /**
   * Sem body = template de cobrança padrão do backend (mensalidade do
   * dojô, nome do env). Com `preset` = um dos templates do crediário
   * (Fase 6c) — o backend manda o texto UTILITY pt-BR já formatado.
   */
  createTemplate: (
    companyId: string,
    opts?: { preset?: WaTemplatePreset }
  ): Promise<WaCreateTemplateResult> =>
    request<WaCreateTemplateResult>(`${base(companyId)}/templates`, {
      method: "POST",
      body: opts?.preset ? { preset: opts.preset } : {},
      timeout: 20000,
    }),

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
