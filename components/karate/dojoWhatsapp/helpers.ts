// ============================================================
// Helpers — WhatsApp Cloud API no dojô (Onda 5b)
//
// Traduz para pt-BR tudo que o backend/Meta devolve em inglês e/ou em
// snake_case: status de template, status da fila, skip_reason e
// last_error. Regra do módulo: NUNCA mostrar código cru pro sensei —
// código desconhecido vira texto humanizado (underscore → espaço), e o
// original fica só como detalhe secundário quando ajuda no suporte.
// ============================================================
import { KarateColors } from "@/constants/karateTheme";
import {
  WaOutboxStatus, WaQualityRating, WaQueueCounts, WaStatus, WaTemplateStatus,
} from "@/services/waApi";

export interface WaBadgeView {
  label: string;
  icon: string;
  color: string;
  bg: string;
}

/** Código cru (snake_case/UPPER) → texto legível, fallback universal. */
function humanize(code: string): string {
  const s = String(code || "").replace(/[_-]+/g, " ").trim().toLowerCase();
  if (!s) return "";
  return s[0].toUpperCase() + s.slice(1);
}

// ── Status do template (vem da Meta via webhook) ─────────
export function waTemplateStatusView(status: WaTemplateStatus | null | undefined): WaBadgeView {
  const up = String(status || "").toUpperCase();
  if (up === "APPROVED") {
    return { label: "Aprovado", icon: "check_circle", color: KarateColors.ok, bg: KarateColors.okSoft };
  }
  if (up === "REJECTED") {
    return { label: "Recusado", icon: "x_circle", color: KarateColors.danger, bg: KarateColors.dangerSoft };
  }
  if (up === "PAUSED" || up === "DISABLED") {
    return { label: up === "PAUSED" ? "Pausado" : "Desativado", icon: "alert", color: KarateColors.warn, bg: KarateColors.warnSoft };
  }
  if (up === "PENDING" || up === "IN_APPEAL" || up === "PENDING_DELETION" || up === "") {
    return { label: up === "IN_APPEAL" ? "Em recurso" : "Em análise", icon: "clock", color: KarateColors.neutral, bg: KarateColors.neutralSoft };
  }
  return { label: humanize(up), icon: "clock", color: KarateColors.neutral, bg: KarateColors.neutralSoft };
}

/** Categoria da Meta (UTILITY/MARKETING/AUTHENTICATION) → pt-BR. */
export function waCategoryLabel(category: string | null | undefined): string {
  const up = String(category || "").toUpperCase();
  if (up === "UTILITY") return "Utilidade";
  if (up === "MARKETING") return "Marketing";
  if (up === "AUTHENTICATION") return "Autenticação";
  if (!up) return "—";
  return humanize(up);
}

// ── Status da fila de envio (outbox) ─────────────────────
export function waOutboxStatusView(status: WaOutboxStatus | null | undefined): WaBadgeView {
  switch (String(status || "")) {
    case "read":
      return { label: "Lida", icon: "eye", color: KarateColors.ok, bg: KarateColors.okSoft };
    case "delivered":
      return { label: "Entregue", icon: "check_circle", color: KarateColors.ok, bg: KarateColors.okSoft };
    case "sent":
      return { label: "Enviada", icon: "send", color: KarateColors.primary, bg: KarateColors.primarySoft };
    case "failed":
      return { label: "Falhou", icon: "alert", color: KarateColors.danger, bg: KarateColors.dangerSoft };
    case "skipped":
      return { label: "Não enviada", icon: "x_circle", color: KarateColors.warn, bg: KarateColors.warnSoft };
    case "pending":
      return { label: "Na fila", icon: "clock", color: KarateColors.neutral, bg: KarateColors.neutralSoft };
    default:
      return { label: humanize(String(status || "—")) || "—", icon: "clock", color: KarateColors.neutral, bg: KarateColors.neutralSoft };
  }
}

/** Rótulo curto por status, usado nos chips do card de status. */
export const WA_QUEUE_CHIP_ORDER: { key: keyof WaQueueCounts; label: string }[] = [
  { key: "pending", label: "Na fila" },
  { key: "sent", label: "Enviadas" },
  { key: "delivered", label: "Entregues" },
  { key: "read", label: "Lidas" },
  { key: "failed", label: "Falharam" },
  { key: "skipped", label: "Não enviadas" },
];

/** Só os contadores presentes e > 0, na ordem canônica (chips inline). */
export function waQueueChips(queue: WaQueueCounts | null | undefined): { key: string; label: string; count: number }[] {
  const q = queue || {};
  const out: { key: string; label: string; count: number }[] = [];
  for (const { key, label } of WA_QUEUE_CHIP_ORDER) {
    const n = q[key];
    if (typeof n === "number" && n > 0) out.push({ key: String(key), label, count: n });
  }
  return out;
}

// ── Motivos de não envio (skip_reason) ───────────────────
const SKIP_REASON_PT: Record<string, string> = {
  opt_out: "O destinatário pediu para não receber (opt-out).",
  opted_out: "O destinatário pediu para não receber (opt-out).",
  no_opt_in: "O destinatário ainda não autorizou receber mensagens.",
  no_phone: "Sem telefone cadastrado.",
  invalid_phone: "Telefone inválido.",
  no_template: "Nenhum template aprovado para esta mensagem.",
  template_not_approved: "O template ainda não foi aprovado pela Meta.",
  not_connected: "WhatsApp não conectado.",
  nao_conectado: "WhatsApp não conectado.",
  disabled: "Envio automático por WhatsApp desligado.",
  duplicate: "Mensagem repetida — já havia sido enviada.",
  already_sent: "Mensagem repetida — já havia sido enviada.",
  rate_limited: "Limite de envios da Meta atingido. Tente mais tarde.",
  window_closed: "Fora da janela de 24h — só é possível enviar template aprovado.",
  quiet_hours: "Fora do horário permitido para envio.",
  no_recipient: "Sem destinatário elegível.",

  // ── Guardas de custo (Fase 2) ──────────────────────────
  // Cada uma destas impediu uma mensagem PAGA de sair. O sensei precisa
  // ler o motivo em português e saber o que fazer a respeito.
  template_nao_aprovado: "O template de cobrança ainda não foi aprovado pela Meta.",
  addon_inativo: "O adicional de WhatsApp automático não está ativo neste dojô.",
  limite_diario: "Limite diário de mensagens do dojô atingido — o restante sai amanhã.",
  limite_por_contato: "Este contato já recebeu o máximo de mensagens do dia.",
  qualidade_baixa: "Envios pausados: a Meta rebaixou a qualidade do número.",
  telefone_invalido_meta: "A Meta informou que este número não recebe mensagens.",
  pausado: "Envios pausados para este dojô.",
  // Motivos que só aparecem na prévia (nunca chegam a virar linha na fila).
  ja_enviado: "Já recebeu o lembrete deste vencimento.",
  sem_telefone: "Sem telefone cadastrado.",
  telefone_invalido: "Telefone inválido.",
};

/** skip_reason → frase pt-BR. Código desconhecido vira texto humanizado. */
export function waSkipReasonLabel(reason: string | null | undefined): string | null {
  const raw = String(reason || "").trim();
  if (!raw) return null;
  return SKIP_REASON_PT[raw.toLowerCase()] || humanize(raw);
}

/**
 * Rótulo CURTO do mesmo motivo, para a linha de resumo da prévia
 * ("opt-out 3 · já enviados 2"). A frase longa não cabe numa contagem.
 */
const SKIP_REASON_SHORT_PT: Record<string, string> = {
  opt_out: "opt-out",
  opted_out: "opt-out",
  no_opt_in: "sem autorização",
  no_phone: "sem telefone",
  sem_telefone: "sem telefone",
  invalid_phone: "telefone inválido",
  telefone_invalido: "telefone inválido",
  telefone_invalido_meta: "número recusado pela Meta",
  ja_enviado: "já enviados",
  already_sent: "já enviados",
  duplicate: "já enviados",
  template_nao_aprovado: "template não aprovado",
  template_not_approved: "template não aprovado",
  addon_inativo: "sem o adicional",
  limite_diario: "acima do limite do dia",
  limite_por_contato: "limite por contato",
  qualidade_baixa: "qualidade baixa",
  pausado: "envios pausados",
};

export function waSkipReasonShort(reason: string | null | undefined): string | null {
  const raw = String(reason || "").trim();
  if (!raw) return null;
  return SKIP_REASON_SHORT_PT[raw.toLowerCase()] || humanize(raw).toLowerCase();
}

/**
 * `skipped` da prévia → "opt-out 3 · já enviados 2 · sem telefone 1".
 * Zeros somem: motivo que não pulou ninguém só faz ruído.
 */
export function waPreviewSkippedSummary(
  skipped: Record<string, number> | null | undefined
): string | null {
  const s = skipped || {};
  const parts: string[] = [];
  for (const key of Object.keys(s)) {
    const n = Number(s[key]);
    if (!Number.isFinite(n) || n <= 0) continue;
    parts.push(`${waSkipReasonShort(key)} ${n}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

/** Soma de todos os pulados da prévia (0 quando ausente). */
export function waPreviewSkippedTotal(
  skipped: Record<string, number> | null | undefined
): number {
  const s = skipped || {};
  let total = 0;
  for (const key of Object.keys(s)) {
    const n = Number(s[key]);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  return total;
}

/**
 * last_error costuma vir como mensagem da Meta (inglês, às vezes JSON).
 * Não dá pra traduzir tudo — o que dá é apresentar sem parecer stack
 * trace: corta em 180 chars e desembrulha o campo `message` se for JSON.
 */
export function waErrorLabel(err: string | null | undefined): string | null {
  const raw = String(err || "").trim();
  if (!raw) return null;
  let txt = raw;
  if (txt.startsWith("{") || txt.startsWith("[")) {
    try {
      const parsed = JSON.parse(txt);
      const msg = parsed?.error?.message || parsed?.message;
      if (typeof msg === "string" && msg) txt = msg;
    } catch {
      // Mantém o texto cru — melhor que esconder o erro do suporte.
    }
  }
  return txt.length > 180 ? `${txt.slice(0, 177)}…` : txt;
}

// ── Erros da API → pt-BR ─────────────────────────────────
/**
 * `detail` é o texto cru da Meta (inglês). Fica AQUI só para suporte —
 * a tela principal mostra `message` e nada mais.
 */
export interface WaMappedError {
  code: string | null;
  message: string;
  detail?: string | null;
}

export function mapWaError(e: any): WaMappedError {
  const code = e?.data?.code ?? e?.code ?? null;
  if (code === "TOKEN_EXPIRADO") {
    return {
      code,
      // O backend já manda esta frase em pt-BR; o fallback é só rede de proteção.
      message:
        e?.data?.error ||
        "A conexão com o WhatsApp expirou. Reconecte o número do dojô para voltar a enviar.",
      detail: e?.data?.detail ?? null,
    };
  }
  if (code === "NAO_CONECTADO") {
    return {
      code,
      message: "O WhatsApp do dojô ainda não está conectado — falta o número e o token da Cloud API.",
    };
  }
  if (code === "ADDON_REQUIRED") {
    return {
      code,
      // O backend manda a frase comercial certa; o fallback é rede de proteção.
      message:
        e?.data?.error ||
        "O envio automático por WhatsApp é um adicional do plano. Fale com a Aura para ativar.",
    };
  }
  if (code === "TEMPLATE_NAO_APROVADO") {
    return {
      code,
      message:
        e?.data?.error ||
        "O template de cobrança ainda não foi aprovado pela Meta — sem ele não é possível iniciar conversa.",
    };
  }
  if (code === "SCHEMA_PENDING") {
    return { code, message: "O WhatsApp ainda não está disponível neste ambiente (atualização pendente no servidor)." };
  }
  if (code === "VALIDATION_ERROR") {
    const errs: string[] = Array.isArray(e?.data?.errors) ? e.data.errors : [];
    return { code, message: errs[0] || "Dados inválidos — confira o telefone e o template." };
  }
  return { code, message: e?.data?.error || e?.message || "Não foi possível concluir. Tente de novo." };
}

/**
 * Códigos que NASCEM do WhatsApp mas chegam por rotas de outros módulos
 * (o PUT reminder-config da régua devolve ADDON_REQUIRED/NAO_CONECTADO).
 * mapBillingError não os conhece — pior, ele transforma qualquer 409 em
 * "Essa cobrança já foi paga". Quem salva a régua checa isto primeiro.
 */
const WA_ERROR_CODES = new Set([
  "ADDON_REQUIRED", "NAO_CONECTADO", "TOKEN_EXPIRADO", "TEMPLATE_NAO_APROVADO",
]);

export function isWaErrorCode(code: unknown): boolean {
  return typeof code === "string" && WA_ERROR_CODES.has(code);
}

// ── Guardas de custo: por que NÃO dá para ligar o automático ──
/**
 * Cada mensagem custa dinheiro. Esta função é a única fonte da verdade
 * sobre "pode ligar o envio automático?" — a régua e a aba WhatsApp leem
 * daqui, para não divergirem.
 *
 * Regra dos campos novos: AUSENTE = DESCONHECIDO, e desconhecido NUNCA
 * libera. `addon_active: undefined` (backend anterior à Fase 1) bloqueia
 * igual a `false` — é melhor o sensei falar com a Aura do que o dojô
 * descobrir o addon pela fatura. `status` nulo (falha ao carregar) idem.
 */
export interface WaAutoBlocker {
  code: "SEM_STATUS" | "ADDON" | "CONEXAO" | "TOKEN" | "TEMPLATE" | "PAUSADO";
  label: string;
}

export function waAutoBlockers(status: WaStatus | null | undefined): WaAutoBlocker[] {
  const out: WaAutoBlocker[] = [];
  if (!status) {
    return [{
      code: "SEM_STATUS",
      label: "Não foi possível verificar o WhatsApp do dojô — recarregue antes de ligar o envio automático.",
    }];
  }
  if (status.addon_active !== true) {
    out.push({ code: "ADDON", label: "Adicional não ativo — fale com a Aura para contratar o WhatsApp automático." });
  }
  if (status.token_expired === true) {
    out.push({ code: "TOKEN", label: "A autorização da Meta expirou — reconecte o número do dojô." });
  } else if (!status.connected) {
    out.push({ code: "CONEXAO", label: "Conecte o número do dojô na aba WhatsApp." });
  }
  if (status.template_ready !== true) {
    out.push({ code: "TEMPLATE", label: "Template de cobrança ainda não aprovado pela Meta." });
  }
  if (status.paused_reason) {
    out.push({ code: "PAUSADO", label: `Envios pausados: ${waPausedReasonLabel(status.paused_reason)}` });
  }
  return out;
}

/** wa_paused_reason → frase pt-BR (minúscula, entra no meio da frase). */
export function waPausedReasonLabel(reason: string | null | undefined): string {
  const up = String(reason || "").toUpperCase();
  if (up === "QUALIDADE_BAIXA") return "a Meta rebaixou a qualidade do número.";
  if (up === "CONTA_RESTRITA") return "a conta do WhatsApp está restrita na Meta.";
  if (up === "MANUAL") return "a fila foi pausada manualmente pela Aura.";
  if (!up) return "motivo não informado.";
  return `${humanize(up).toLowerCase()}.`;
}

/** quality_rating da Meta → selo. null/ausente = sem selo (não inventa). */
export function waQualityView(rating: WaQualityRating | null | undefined): WaBadgeView | null {
  const up = String(rating || "").toUpperCase();
  if (up === "GREEN") return { label: "Qualidade alta", icon: "check_circle", color: KarateColors.ok, bg: KarateColors.okSoft };
  if (up === "YELLOW") return { label: "Qualidade média", icon: "alert", color: KarateColors.warn, bg: KarateColors.warnSoft };
  if (up === "RED") return { label: "Qualidade baixa", icon: "alert", color: KarateColors.danger, bg: KarateColors.dangerSoft };
  if (!up) return null;
  return { label: humanize(up), icon: "clock", color: KarateColors.neutral, bg: KarateColors.neutralSoft };
}

// ── Estado do cartão de conexão (Embedded Signup) ────────
/**
 * O Embedded Signup é um popup do Facebook: só existe no navegador. No
 * celular o sensei não tem como concluir o fluxo, então em vez de um
 * botão que não funciona ele lê para onde ir.
 *
 * `indisponivel` = o backend não devolveu app_id/config_id (env do
 * Railway ainda não configurado, ou backend anterior à Fase 1) — a tela
 * explica em vez de abrir um popup que a Meta recusaria.
 */
export type WaConnectMode = "conectado" | "nativo" | "indisponivel" | "reconectar" | "conectar";

export function waConnectMode(isWeb: boolean, status: WaStatus | null | undefined): WaConnectMode {
  if (status?.connected && status?.token_expired !== true) return "conectado";
  if (!isWeb) return "nativo";
  const es = status?.embedded_signup;
  if (!es || !es.app_id || !es.config_id) return "indisponivel";
  if (status?.token_expired === true) return "reconectar";
  return "conectar";
}

// ── Limite diário de ENVIOS DE TESTE ─────────────────────
/** Mesmo teto fixo do backend (Fase 2f): 5 testes por dia por company. */
export const WA_TEST_DAILY_CAP = 5;

/**
 * Conta, na fila já carregada, os testes criados HOJE. Contagem no
 * cliente de propósito: serve para AVISAR antes do clique; quem barra de
 * verdade é o backend. Fuso do device — o teto é grosso o bastante para
 * a diferença de algumas horas não enganar ninguém.
 */
export function waTestsSentToday(
  items: { source_type?: string | null; created_at?: string | null }[] | null | undefined
): number {
  const list = Array.isArray(items) ? items : [];
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  let n = 0;
  for (const it of list) {
    if (String(it?.source_type || "") !== "teste") continue;
    if (!it?.created_at) continue;
    const dt = new Date(it.created_at);
    if (Number.isNaN(dt.getTime())) continue;
    if (dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d) n += 1;
  }
  return n;
}

// ── Formatação ───────────────────────────────────────────
/**
 * Telefone → '+55 (11) 91234-5678'. A máscara BR só entra quando o número
 * É brasileiro: DDI 55 + 12 ou 13 dígitos no total (10 ou 11 locais).
 *
 * Qualquer outro país sai como veio, com '+' na frente e SEM máscara — o
 * número de teste da Meta (+1 555-630-9005 → 15556309005) tem 11 dígitos e
 * virava '(15) 55630-9005' quando a máscara olhava só o tamanho.
 */
export function fmtPhoneBR(phone: string | null | undefined): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "—";
  const isBR = digits.startsWith("55") && (digits.length === 12 || digits.length === 13);
  if (isBR) {
    const local = digits.slice(2);
    if (local.length === 11) return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
    return `+55 (${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return `+${digits}`;
}

/** Timestamp ISO → 'DD/MM HH:mm' (fuso do device). '—' se ausente. */
export function fmtWhenBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
}

/** Timestamp ISO → 'DD/MM' (data seca, sem hora). null se ausente/inválido. */
export function fmtDayMonthBR(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Valor da cobrança na prévia → 'R$ 150,00'. null/ausente some da linha. */
export function fmtAmountBR(v: number | null | undefined): string | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** 'YYYY-MM-DD' (data seca do backend) → 'DD/MM'. Sem fuso no meio. */
export function fmtDueDateBR(date: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date || ""));
  if (!m) return fmtDayMonthBR(date);
  return `${m[3]}/${m[2]}`;
}

/** Só dígitos, com no mínimo 10 — mesma régua do wa.me do módulo de cobrança. */
export function isValidWaPhone(phone: string): boolean {
  return String(phone || "").replace(/\D/g, "").length >= 10;
}
