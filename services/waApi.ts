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

/**
 * Fase 8b — a COTA mensal de mensagens promocionais.
 *
 * O WhatsApp oficial passou a fazer parte do plano Negócio e do Aura
 * Dojô: cobrança e lembrete (UTILITY) são ilimitados na prática, e o
 * marketing vem com 100 mensagens por mês inclusas. Passou disso, a loja
 * compra um pacote de 100 na própria tela.
 *
 * TODOS os campos são opcionais, e de propósito: o backend da Fase 8b
 * sobe depois deste app. Sem eles a tela mostra exatamente o que mostrava
 * antes (uso do mês e teto do dia) — nunca um "0 de 0" que parece cota
 * zerada quando na verdade é só backend antigo.
 */
export interface WaUsageMarketing {
  /** Promocionais que já saíram no mês (America/Sao_Paulo). */
  month_sent?: number;
  /** Cota inclusa no plano (default 100). */
  quota_base?: number;
  /** Soma dos pacotes ativos e dentro da validade. */
  packs_qty?: number;
  /** quota_base + packs_qty. */
  quota?: number;
  /** max(0, quota - month_sent). 0 = cota esgotada, marketing parado. */
  remaining?: number;
  /** Preço do pacote extra, em centavos (default 4900). */
  pack_price_cents?: number;
  /** Tamanho do pacote extra (default 100). */
  pack_qty?: number;
}

/** Uso justo das mensagens de cobrança (UTILITY). Silencioso para o lojista. */
export interface WaUsageUtility {
  month_sent?: number;
  cap?: number;
}

/** Consumo do mês/dia. Campos ausentes = backend anterior à Fase 1. */
export interface WaUsage {
  today_sent?: number;
  month_sent?: number;
  /** Teto diário por company (env WA_DAILY_CAP no backend, default 300). */
  daily_cap?: number;
  /** Fase 8b — cota mensal de marketing. Ausente = backend anterior. */
  marketing?: WaUsageMarketing;
  /** Fase 8b — uso justo da cobrança. Ausente = backend anterior. */
  utility?: WaUsageUtility;
}

// ── Pacotes extras de mensagens promocionais (Fase 8b) ──
export type WaMarketingPackStatus = "pending" | "active" | "cancelled" | (string & {});

export interface WaMarketingPack {
  id: string;
  qty: number;
  price_cents?: number | null;
  status: WaMarketingPackStatus;
  valid_from?: string | null;
  valid_until?: string | null;
  /** Link do Pix/boleto do Asaas. null = ativação manual pela Aura. */
  payment_url?: string | null;
  activated_at?: string | null;
  created_at?: string | null;
}

export interface WaMarketingPacksResponse {
  /** Últimos 12, mais recentes primeiro. */
  data: WaMarketingPack[];
}

export interface WaMarketingPackResult {
  pack?: WaMarketingPack | null;
  /** Presente = a loja paga agora e o pacote entra quando confirmar. */
  payment_url?: string | null;
  /** true = sem cobrança automática; a Aura ativa o pacote na mão. */
  needs_manual?: boolean;
}

/** Parâmetros do Embedded Signup da Meta (vêm do env do backend). */
export interface WaEmbeddedSignup {
  app_id?: string | null;
  config_id?: string | null;
  graph_version?: string | null;
}

/**
 * Modo de conexão do Embedded Signup (doc da Meta "Onboard WhatsApp
 * Business app users"). `padrao` exige um número fora do app WhatsApp
 * Business do celular (comportamento histórico). `coexistence` deixa o
 * MESMO número no app do celular E na Cloud API — o celular pede para
 * escanear um QR code durante a conexão.
 *
 * DEPENDE do backend (aura-backend, branch claude/whatsapp-coexistence,
 * ainda não mergeada): sem esse deploy, `mode` é ignorado pelo
 * `/connect` e os campos `coexistence`/`is_on_biz_app` nunca vêm no
 * response — por isso são opcionais aqui, seguindo a mesma regra dos
 * outros campos novos deste arquivo (ausente = desconhecido).
 */
export type WaSignupMode = "padrao" | "coexistence";

/**
 * Presets de template que o backend sabe criar (Fase 6c). O mapeamento
 * regra do crediário → preset: lembrete/confirmacao/vencimento →
 * `parcela_lembrete`; atraso_1/atraso_2 → `parcela_atraso`; `bloqueio`
 * não é WhatsApp. A mensalidade do dojô continua sendo o default (sem
 * preset).
 */
export type WaTemplatePreset =
  | "mensalidade_lembrete"
  | "parcela_lembrete"
  | "parcela_atraso"
  // Fases 7/8 — categoria MARKETING na Meta, mais cara por mensagem que
  // as de cobrança (UTILITY) e sujeita a limite por usuário.
  | "reativacao_cupom"
  | "aniversario_cupom";

/** Quais templates já estão APPROVED na Meta. Chave ausente = não. */
export type WaTemplatesReady = Partial<Record<WaTemplatePreset, boolean>> & Record<string, boolean | undefined>;

/** Templates que a régua do crediário precisa antes de ligar o automático. */
export const WA_CREDIARIO_TEMPLATES: WaTemplatePreset[] = ["parcela_lembrete", "parcela_atraso"];

/** Template da reativação (Fase 7) — um só, e MARKETING. */
export const WA_REATIVACAO_TEMPLATES: WaTemplatePreset[] = ["reativacao_cupom"];

/** Template do aniversário (Fase 8) — um só, e MARKETING. */
export const WA_ANIVERSARIO_TEMPLATES: WaTemplatePreset[] = ["aniversario_cupom"];

/** Os dois de marketing, para a tela de templates. */
export const WA_MARKETING_TEMPLATES: WaTemplatePreset[] = ["reativacao_cupom", "aniversario_cupom"];

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

  /**
   * Fases 7/8 — MARKETING. `marketing_consent_at` é a data em que o dono
   * declarou que os clientes autorizaram receber mensagens da loja; null
   * ou AUSENTE significa que não declarou, e sem isso nenhuma mensagem de
   * marketing sai (a de cobrança continua, é outra categoria).
   *
   * `marketing_ready` é o resumo do backend das condições que não são do
   * template: consentimento declarado + qualidade que a Meta ainda aceita
   * para marketing (YELLOW já barra) + fila não pausada. Ausente = não
   * pronto, como todo campo novo aqui.
   */
  marketing_consent_at?: string | null;
  marketing_ready?: boolean;

  quality_rating?: WaQualityRating | null;
  /** QUALIDADE_BAIXA | CONTA_RESTRITA | MANUAL — fila pausada. */
  paused_reason?: string | null;
  /** subscribed_apps feito (sem isso o webhook nunca recebe evento). */
  subscribed?: boolean;
  /** /register do número feito na Cloud API. */
  registered?: boolean;
  usage?: WaUsage;
  embedded_signup?: WaEmbeddedSignup | null;
  /**
   * true = número conectado em modo Coexistence (também ativo no app
   * WhatsApp Business do celular). Opcional: depende do backend da
   * branch claude/whatsapp-coexistence (ver WaSignupMode acima).
   */
  coexistence?: boolean;
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
  /** 'padrao' | 'coexistence' (ver WaSignupMode). Omitido = 'padrao' no backend. */
  mode?: WaSignupMode;
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
  /** true = conectado em modo Coexistence. Opcional (ver WaSignupMode). */
  coexistence?: boolean;
  /** true = a Meta confirma o número ativo no WhatsApp Business app do celular. Opcional (ver WaSignupMode). */
  is_on_biz_app?: boolean;
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
  customer_id?: string | null;
  /** Já vem mascarado pelo backend — nunca o telefone inteiro. */
  phone_masked?: string | null;
  amount?: number | null;
  due_date?: string | null;
  /** Reativação (Fase 7): o quanto o cliente já gastou e há quanto sumiu. */
  total_spent?: number | null;
  days_since?: number | null;
  /** null = entraria no envio; preenchido = motivo do pulo. */
  reason?: string | null;
}

export interface WaPreview {
  date?: string;
  /** 'crediario' | 'reativacao' | 'aniversario' — de qual régua é a prévia. */
  source?: string | null;
  /** Reativação: qual segmento foi simulado (at_risk | dormant | both). */
  segment?: string | null;
  template_name?: string | null;
  /** Quantas mensagens SAIRIAM (e seriam cobradas) nessa data. */
  would_send: number;
  skipped?: WaPreviewSkipped;
  /**
   * Motivo de a rotina INTEIRA não rodar (sem consentimento, sem addon,
   * desligada…) — diferente de `skipped`, que é por cliente.
   */
  skipped_reason?: string | null;
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

  // ── Pacotes extras de marketing (Fase 8b) ──────────────
  /**
   * Últimos pacotes comprados. 404/405 = backend anterior à Fase 8b —
   * quem chama trata como lista vazia, não como erro de tela.
   */
  listMarketingPacks: (companyId: string): Promise<WaMarketingPacksResponse> =>
    request<WaMarketingPacksResponse>(`${base(companyId)}/marketing-packs`),

  /**
   * Compra um pacote de mensagens promocionais. O backend cria a cobrança
   * avulsa no Asaas quando dá (devolve `payment_url`) e, quando não dá,
   * devolve `needs_manual` para a Aura ativar na mão — nos dois casos o
   * pacote nasce `pending` e só conta na cota depois de ativo.
   */
  buyMarketingPack: (companyId: string, qty: number = 100): Promise<WaMarketingPackResult> =>
    request<WaMarketingPackResult>(`${base(companyId)}/marketing-packs`, {
      method: "POST",
      body: { qty },
      // Pode ir ao Asaas criar a cobrança; 10s default não dá conta.
      timeout: 20000,
    }),
};
