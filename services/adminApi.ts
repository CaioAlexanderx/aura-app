import { request } from "./api";

export type AccessCodeRow = {
  id: string;
  code: string;
  type: "trial" | "promo" | "manual" | "referral";
  plan: "essencial" | "negocio" | "expansao" | "personalizado";
  discount_pct: number;
  trial_days: number;
  max_uses: number;
  uses: number;
  referrer_id: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // 11/09/2026 (migration 326) — ausentes antes da migration subir
  discount_value?: number;
  discount_months?: number;
  restrict_to_plan?: boolean;
};
export type CreateAccessCodeBody = {
  code: string;
  type: "trial" | "promo" | "manual";
  plan: "essencial" | "negocio" | "expansao" | "personalizado";
  trial_days?: number;
  discount_pct?: number;
  max_uses?: number;
  expires_at?: string | null;
  discount_value?: number;     // reais por mensalidade (nunca junto com discount_pct)
  discount_months?: number;    // 1 = so a 1a mensalidade
  restrict_to_plan?: boolean;  // true = so vale no `plan`
};

export type AdminBannerRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  html_content: string | null;
  cta_label: string | null;
  cta_url: string | null;
  cta_route: string | null;
  target_company_id: string | null;
  target_plan: string | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  read_count?: number;
  last_emailed_at?: string | null;   // último e-mail enviado (migration 347 do backend)
  email_count?: number;
};

// E-mail de notificação de empresa específica (18/09/2026).
export type BannerRecipient = {
  email: string;
  sources: ("owner" | "company" | "member")[];
  name: string | null;
  selected: boolean;           // sugestão do backend: dono e empresa marcados
};
export type BannerRecipientsResponse = {
  company: { id: string; name: string | null; legal_name: string | null; vertical: string | null };
  recipients: BannerRecipient[];
};
export type SendBannerEmailBody = {
  recipients: string[];
  subject?: string;
  pix?: { code: string; amount?: number | null; due_date?: string | null } | null;
};
export type SendBannerEmailResult = {
  sent: { email: string; provider_id: string | null }[];
  failed: { email: string; error: string }[];
};
// Pedidos de disparo preparados pelo Claude (migration 348 do backend).
export type DispatchResult = {
  http_status?: number;
  sent?: { email: string }[];
  failed?: { email: string; error: string }[];
  error?: string;
};
export type DispatchRequestRow = {
  id: string;
  action: string;                       // hoje: "notification_email"
  note: string | null;                  // o pedido em linguagem natural
  status: "awaiting_approval" | "processing" | "done" | "failed" | "rejected";
  requested_via: string;
  created_at: string;
  expires_at: string;
  expired: boolean;
  decided_by_name: string | null;
  decided_at: string | null;
  result: DispatchResult | null;
  error: string | null;
  preview: null | {
    error?: string;
    banner?: { id: string; title: string; is_active: boolean; expires_at: string | null };
    company?: { id: string; name: string | null; legal_name: string | null } | null;
    recipients?: string[];
    subject?: string;
    pix?: { code: string; amount?: number | null; due_date?: string | null } | null;
  };
};
export type CreateBannerBody = {
  title: string;
  body?: string | null;
  html_content?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  cta_route?: string | null;
  target_company_id?: string | null;
  target_plan?: string | null;
  expires_at?: string | null;
  is_active?: boolean;
};

// 12/05/2026 — Onda 1 Gestao Aura v2
export type AdminNote = {
  id: number;
  body: string;
  created_at: string;
  author_user_id: string;
  author_name: string | null;
  author_email: string | null;
};
export type AdminAuditLog = {
  id: number;
  action: string;            // 'extend_trial' | 'set_extra_seats' | 'resync_subscription' | etc
  payload: Record<string, any> | null;
  reason: string | null;
  created_at: string;
  company_id: string | null;
  staff_user_id: string;
  staff_name: string | null;
  staff_email: string | null;
  company_trade_name: string | null;
  company_legal_name: string | null;
};
export type ExtendTrialResponse = {
  trial_ends_at: string;
  previous_trial_ends_at: string | null;
  days_added: number;
};

// Contrato do billing_sync (backend: services/seatSubscription.js).
// O service e best-effort e NUNCA lanca: ou volta { updated: true, value, ... }
// ou { updated: false, skipped: <motivo> }.
export type BillingSync = {
  updated: boolean;
  skipped?: string;          // 'value_unchanged' | 'cancelled' | 'no_subscription' | 'invalid_plan' | 'fetch_failed' | 'subscription_<status>' | 'error'
  value?: number;            // valor novo da assinatura (plano + 19 x seats)
  previousValue?: number;    // valor que estava no Asaas antes do PUT
  subscriptionId?: string;
  seats?: number;
  error?: string;
};
export type SetExtraSeatsResponse = {
  extra_seats_granted: number;
  previous_extra_seats_granted: number;
  changed: boolean;
  billing_sync?: BillingSync;
};
export type ResyncSubscriptionResponse = {
  extra_seats_granted: number;
  billing_status: string | null;
  billing_sync: BillingSync;
};

export type SetSegmentBody = {
  segment: "varejo" | "matcon" | "otica" | "assistencia" | "studio" | "outro";
  extras?: "os"[];
  disable?: ("matcon" | "otica" | "os")[];
};
export type SegmentFlags = { matcon_enabled: boolean; otica_enabled: boolean; os_enabled: boolean; studio_enabled: boolean };
export type SetSegmentResponse = {
  segment: SetSegmentBody["segment"] | null;
  segment_source: "cnae" | "landing" | "user" | "staff" | null;
  vertical_active: string | null;
  flags: SegmentFlags;
};

// ── Painel Hoje (13/10/2026, Aura-backend #807) ─────────────────────────────
// Formato bruto de /admin/painel/*. A tela não usa estes tipos direto:
// components/admin/painel/adaptadores.ts traduz para o modelo da tela.
// Exemplos reais: __tests__/__fixtures__/painel/*.json.
export type PainelApiPonto = {
  rotulo: string;
  valor: number | null;
  texto?: string;        // rótulo pronto ("22 d", "nunca", "4/5")
  [extra: string]: any;  // pct, pagantes, anuais, trials, visitas, rejeitadas, mrr…
};
export type PainelApiBlocoResumo = {
  id: string;
  titulo: string;
  grupo: "negocio" | "produto" | "operacao";
  valor: number | null;
  unidade: string | null;
  variacao: { d7: number | null; d30: number | null } | null;
  serie: PainelApiPonto[];
  resumo: string | null;
  fonte: string | null;
};
export type PainelApiAlerta = {
  tipo: string;          // pagante_anual_vencendo | trial_com_venda_vencendo | pagamento_sem_loja | nfce_rejeitada
  company_id: string | null;
  titulo: string;
  detalhe: string | null;
  verbo: string | null;
  bloco: string | null;
};
export type PainelApiHoje = {
  dia: string;
  calculado_em: string;
  proximo_calculo: string;
  ao_vivo: boolean;
  blocos: PainelApiBlocoResumo[];
  alertas: PainelApiAlerta[];
};
export type PainelApiColuna = {
  chave: string;
  rotulo: string;
  tipo: "texto" | "loja" | "numero" | "moeda" | "data" | "data_hora" | "booleano";
};
export type PainelApiLista = {
  titulo: string;
  colunas: PainelApiColuna[];
  linhas: Record<string, any>[];
};
export type PainelApiDetalhe = {
  id: string;
  titulo: string;
  periodo: number;
  calculado_em: string;
  ao_vivo: boolean;
  valor: number | null;
  unidade: string | null;
  resumo: string | null;
  fonte: string | null;
  indicadores: { rotulo: string; valor: number | string | null; nota: string | null }[];
  listas: PainelApiLista[];
  series: { titulo: string; tipo: "barras" | "barras_h" | "linha" | "rosca" | "funil"; pontos: PainelApiPonto[] }[];
  insight: string | null;
};
export type PainelApiFicha = {
  company_id: string;
  nome: string;
  telefone: string | null;
  cliente: Record<string, any>;
  health: { score: number; risk_level: string; [k: string]: any } | null;
  logins: { ultimos_30d: number; dias_ativos_30d: number; ultimo_acesso: string | null };
  asaas: { evento: string; quando: string; valor: number | null; vencimento: string | null }[];
  modulos: string[];
  modulos_detalhe: { id: string; nome: string; usou_30d: boolean; eventos_30d: number; ultimo_uso: string | null }[];
  vendas_por_semana: { rotulo: string; valor: number }[];
  alertas: PainelApiAlerta[];
  linha_do_tempo: { tipo: string; quando: string; titulo: string; valor: number | null }[];
};
export type PainelApiLayout = {
  padrao: boolean;
  atualizado_em: string | null;
  blocos: { id: string; visivel: boolean; titulo: string; grupo: string }[];
};
export type PainelApiRecalcular = {
  ok: boolean;
  dia: string;
  duracao_ms: number;
  blocos: string[];
  alertas: number;
  health_atualizados: number;
  mrr_total: number;
  erros: any[];
};

// Extrato OFX × Asaas (13/10/2026, Aura-backend #810). Rotas adminOnly em
// /admin/painel/ofx. Ids de extrato e de lançamento são BIGINT (string).
export type OfxValorN = { n: number; valor: number };
export type OfxExtratoResumoMes = { id: string; nome_arquivo: string | null; importado_em: string; total_creditos: number; linhas: number };
export type OfxMes = {
  mes: string;                       // "2026-10"
  rotulo: string;                    // "Out/2026"
  asaas: number;
  pagamentos: number;
  banco: number | null;              // null = mês sem extrato
  diferenca: number | null;          // banco − asaas
  status: "sem extrato" | "conciliado" | "pendências";
  detalhe: string | null;
  conciliado: OfxValorN | null;
  pendentes: OfxValorN | null;
  sem_credito: OfxValorN | null;
  extratos: OfxExtratoResumoMes[];
};
export type OfxExtratosResponse = { dia?: string; meses: OfxMes[] };
export type OfxLancamento = {
  id: string;
  data: string;                      // "YYYY-MM-DD"
  valor: number;                     // crédito > 0, débito < 0
  descricao: string | null;
  fitid: string | null;
  tipo: string;                      // "credito" | "debito"
  status: "pendente" | "conciliado" | "ignorado";
  conciliado_com: string | null;
  com_taxa: boolean;
};
export type OfxPagamentoDisponivel = { pagamento_id: string; log_id: string | null; company_id: string | null; valor: number; liquido: number | null; data: string };
export type OfxExtratoDetalhe = {
  extrato: { id: string; mes: string; nome_arquivo: string | null; importado_em: string; importado_por?: string | null; total_creditos: number; linhas: number };
  resumo: {
    creditos: number; total_creditos: number; debitos: number;
    conciliados: { n: number; valor: number; com_taxa: number };
    pendentes: OfxValorN; ignorados: OfxValorN;
  };
  lancamentos: OfxLancamento[];
  pagamentos_disponiveis: OfxPagamentoDisponivel[];
};
export type OfxImportacao = {
  ok: boolean;
  duplicado: boolean;
  extrato?: { id: string; mes: string; nome_arquivo: string | null };
  extrato_id?: string;
  importados: number;
  duplicados: number;
  creditos?: number;
  conciliados?: number;
  com_taxa?: number;
  pendentes?: number;
};

export var adminApi = {
  dashboard: function() { return request<any>("/admin/dashboard"); },
  clients: function() { return request<any>("/admin/clients"); },
  clientModules: function(companyId: string) { return request<any>("/admin/clients/" + companyId + "/modules"); },
  updateModules: function(companyId: string, overrides: Record<string, boolean>) {
    return request<any>("/admin/clients/" + companyId + "/modules", { method: "PUT", body: { overrides: overrides } });
  },
  setPlan: function(companyId: string, plan: string) {
    return request<{ company: any; visible_modules: string[]; changed: boolean; message: string }>(
      "/admin/clients/" + companyId + "/plan", { method: "PATCH", body: { plan: plan }, retry: 0 }
    );
  },
  setVertical: function(companyId: string, vertical: string | null) {
    return request<{ company: any; changed: boolean; message: string }>(
      "/admin/clients/" + companyId + "/vertical", { method: "PATCH", body: { vertical: vertical }, retry: 0 }
    );
  },
  // 05/10/2026 — Frente da empresa (Aura-backend #786). Grava
  // segment_source='staff'. 409 STUDIO_PLAN_REQUIRED quando a frente e
  // studio e o plano nao e Negocio ou superior.
  setSegment: function(companyId: string, body: SetSegmentBody) {
    return request<SetSegmentResponse>(
      "/admin/clients/" + companyId + "/segment", { method: "PATCH", body: body, retry: 0 }
    );
  },
  // 19/05/2026 — Sub-vertical (Fase B1 do benchmark de mercado)
  // Sub-segmentacao manual via Gestao Aura. Whitelist por vertical principal
  // (varejo: calcados, moda, perfumaria, etc).
  setSubVertical: function(companyId: string, subVertical: string | null) {
    return request<{ company: any; changed: boolean; message: string }>(
      "/admin/clients/" + companyId + "/sub-vertical", { method: "PATCH", body: { sub_vertical: subVertical }, retry: 0 }
    );
  },
  subVerticalOptions: function() {
    return request<{ by_vertical: Record<string, string[]> }>(
      "/admin/sub-verticals/options"
    );
  },
  // 12/05/2026 — Notas CRM
  notes: {
    list: function(companyId: string) {
      return request<{ notes: AdminNote[] }>("/admin/clients/" + companyId + "/notes");
    },
    create: function(companyId: string, body: string) {
      return request<{ note: AdminNote }>(
        "/admin/clients/" + companyId + "/notes",
        { method: "POST", body: { body: body }, retry: 0 }
      );
    },
  },
  // 12/05/2026 — Estender trial + audit log
  extendTrial: function(companyId: string, days: number, reason?: string) {
    return request<ExtendTrialResponse>(
      "/admin/clients/" + companyId + "/extend-trial",
      { method: "PATCH", body: { days: days, reason: reason || null }, retry: 0 }
    );
  },
  // 12/05/2026 (tarde) — Acessos extras pagos (caso Alynne/Encanto)
  // count e o numero absoluto desejado (0-100). Backend grava em
  // companies.extra_seats_granted e propaga pra summarizeSeats em
  // todas as rotas /members/*.
  //
  // 15/06/2026: o backend tambem sincroniza a assinatura no Asaas
  // (plano + 19 x seats) e devolve o resultado em billing_sync.
  setExtraSeats: function(companyId: string, count: number, reason?: string) {
    return request<SetExtraSeatsResponse>(
      "/admin/clients/" + companyId + "/extra-seats",
      { method: "PATCH", body: { count: count, reason: reason || null }, retry: 0 }
    );
  },
  // 11/07/2026 — Ressincronizar assinatura (Aura-backend#358)
  // Re-dispara o PUT no Asaas com plano + 19 x extra_seats_granted a partir do
  // estado ATUAL, sem alterar o count. Idempotente: se o valor ja bate, o
  // backend responde skipped='value_unchanged' e nao faz PUT.
  //
  // Existe porque setExtraSeats faz no-op quando o count nao muda — entao,
  // quando o sync falhava por motivo transitorio (empresa 'cancelled', Asaas
  // fora do ar), a unica saida era salvar 0 e depois 1, o que dispara um PUT
  // intermediario REMOVENDO o seat da assinatura.
  resyncSubscription: function(companyId: string, reason?: string) {
    return request<ResyncSubscriptionResponse>(
      "/admin/clients/" + companyId + "/resync-subscription",
      { method: "POST", body: { reason: reason || null }, retry: 0 }
    );
  },
  auditLog: function(params?: { company_id?: string; action?: string; limit?: number }) {
    var qs: string[] = [];
    if (params?.company_id) qs.push("company_id=" + encodeURIComponent(params.company_id));
    if (params?.action)     qs.push("action=" + encodeURIComponent(params.action));
    if (params?.limit)      qs.push("limit=" + params.limit);
    var suffix = qs.length ? "?" + qs.join("&") : "";
    return request<{ logs: AdminAuditLog[] }>("/admin/audit-log" + suffix);
  },
  accessCodes: {
    list: function(params?: { type?: string; is_active?: boolean; q?: string; limit?: number }) {
      var qs: string[] = [];
      if (params?.type) qs.push("type=" + encodeURIComponent(params.type));
      if (params?.is_active !== undefined) qs.push("is_active=" + (params.is_active ? "true" : "false"));
      if (params?.q) qs.push("q=" + encodeURIComponent(params.q));
      if (params?.limit) qs.push("limit=" + params.limit);
      var suffix = qs.length ? "?" + qs.join("&") : "";
      return request<{ total: number; codes: AccessCodeRow[] }>("/admin/access-codes" + suffix);
    },
    create: function(body: CreateAccessCodeBody) {
      return request<{ code: AccessCodeRow }>("/admin/access-codes", { method: "POST", body: body, retry: 0 });
    },
    toggle: function(id: string, is_active: boolean) {
      return request<{ code: AccessCodeRow }>("/admin/access-codes/" + id, { method: "PATCH", body: { is_active: is_active } });
    },
  },
  notifications: {
    list: function() {
      return request<{ banners: AdminBannerRow[] }>("/admin/notifications/banners");
    },
    create: function(body: CreateBannerBody) {
      return request<{ banner: AdminBannerRow }>("/admin/notifications/banners", { method: "POST", body: body, retry: 0 });
    },
    update: function(id: string, body: Partial<CreateBannerBody>) {
      return request<{ banner: AdminBannerRow }>("/admin/notifications/banners/" + id, { method: "PATCH", body: body, retry: 0 });
    },
    recipients: function(companyId: string) {
      return request<BannerRecipientsResponse>("/admin/notifications/recipients?company_id=" + encodeURIComponent(companyId));
    },
    sendEmail: function(id: string, body: SendBannerEmailBody) {
      return request<SendBannerEmailResult>("/admin/notifications/banners/" + id + "/email", { method: "POST", body: body, retry: 0 });
    },
    remove: function(id: string) {
      return request<{ deleted: boolean }>("/admin/notifications/banners/" + id, { method: "DELETE", retry: 0 });
    },
  },
  // Gestão Aura › Hoje (13/10/2026, Aura-backend #807). `hoje` e `bloco`
  // podem calcular ao vivo (alguns segundos), por isso o timeout maior.
  painel: {
    hoje: function() {
      return request<PainelApiHoje>("/admin/painel/hoje", { timeout: 30000 });
    },
    bloco: function(id: string, periodo?: number) {
      var q = periodo ? "?periodo=" + periodo : "";
      return request<PainelApiDetalhe>("/admin/painel/blocos/" + encodeURIComponent(id) + q, { timeout: 30000 });
    },
    ficha: function(companyId: string) {
      return request<PainelApiFicha>("/admin/painel/clientes/" + encodeURIComponent(companyId) + "/ficha", { timeout: 30000 });
    },
    layout: function() {
      return request<PainelApiLayout>("/admin/painel/layout");
    },
    salvarLayout: function(blocos: { id: string; visivel: boolean }[]) {
      return request<PainelApiLayout>("/admin/painel/layout", { method: "PUT", body: { blocos: blocos }, retry: 0 });
    },
    recalcular: function() {
      return request<PainelApiRecalcular>("/admin/painel/recalcular", { method: "POST", retry: 0, timeout: 120000 });
    },
    // Extrato OFX × Asaas (#810). O arquivo vai como texto em JSON (o backend
    // não tem multipart); `mes` (YYYY-MM) escolhe o mês quando o OFX cobre outro.
    ofx: {
      extratos: function(meses?: number) {
        return request<OfxExtratosResponse>("/admin/painel/ofx/extratos" + (meses ? "?meses=" + meses : ""), { timeout: 30000 });
      },
      detalhe: function(id: string) {
        return request<OfxExtratoDetalhe>("/admin/painel/ofx/extratos/" + encodeURIComponent(id), { timeout: 30000 });
      },
      importar: function(corpo: { ofx_content: string; mes?: string; nome_arquivo?: string }) {
        return request<OfxImportacao>("/admin/painel/ofx/extratos", { method: "POST", body: corpo, retry: 0, timeout: 60000 });
      },
      conciliar: function(extratoId: string, lancamentoId: string, pagamentoId: string) {
        return request<{ ok: boolean; lancamento: OfxLancamento }>(
          "/admin/painel/ofx/extratos/" + encodeURIComponent(extratoId) + "/lancamentos/" + encodeURIComponent(lancamentoId) + "/conciliar",
          { method: "POST", body: { pagamento_id: pagamentoId }, retry: 0 },
        );
      },
      ignorar: function(extratoId: string, lancamentoId: string) {
        return request<{ ok: boolean; lancamento: OfxLancamento }>(
          "/admin/painel/ofx/extratos/" + encodeURIComponent(extratoId) + "/lancamentos/" + encodeURIComponent(lancamentoId) + "/ignorar",
          { method: "POST", retry: 0 },
        );
      },
      reabrir: function(extratoId: string, lancamentoId: string) {
        return request<{ ok: boolean; lancamento: OfxLancamento }>(
          "/admin/painel/ofx/extratos/" + encodeURIComponent(extratoId) + "/lancamentos/" + encodeURIComponent(lancamentoId) + "/reabrir",
          { method: "POST", retry: 0 },
        );
      },
      apagar: function(extratoId: string) {
        return request<{ ok: boolean; id: string; lancamentos_removidos: number }>(
          "/admin/painel/ofx/extratos/" + encodeURIComponent(extratoId), { method: "DELETE", retry: 0 },
        );
      },
    },
  },
  // Pedidos de disparo preparados pelo Claude; só executam com aprovação.
  dispatchRequests: {
    list: function() {
      return request<{ requests: DispatchRequestRow[] }>("/admin/dispatch-requests");
    },
    approve: function(id: string) {
      return request<{ status: "done" | "failed"; result?: DispatchResult; error?: string }>("/admin/dispatch-requests/" + id + "/approve", { method: "POST", retry: 0 });
    },
    reject: function(id: string) {
      return request<{ status: "rejected" }>("/admin/dispatch-requests/" + id + "/reject", { method: "POST", retry: 0 });
    },
  },
};
