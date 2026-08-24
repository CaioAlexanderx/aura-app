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
import { WaOutboxStatus, WaQueueCounts, WaTemplateStatus } from "@/services/waApi";

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
};

/** skip_reason → frase pt-BR. Código desconhecido vira texto humanizado. */
export function waSkipReasonLabel(reason: string | null | undefined): string | null {
  const raw = String(reason || "").trim();
  if (!raw) return null;
  return SKIP_REASON_PT[raw.toLowerCase()] || humanize(raw);
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
export function mapWaError(e: any): { code: string | null; message: string } {
  const code = e?.data?.code ?? e?.code ?? null;
  if (code === "NAO_CONECTADO") {
    return {
      code,
      message: "O WhatsApp do dojô ainda não está conectado — falta o número e o token da Cloud API.",
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

// ── Formatação ───────────────────────────────────────────
/** Telefone em dígitos → '+55 (11) 91234-5678' (best-effort, nunca quebra). */
export function fmtPhoneBR(phone: string | null | undefined): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "—";
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  const ddi = digits.startsWith("55") ? "+55 " : "";
  if (local.length === 11) return `${ddi}(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `${ddi}(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return String(phone || "—");
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

/** Só dígitos, com no mínimo 10 — mesma régua do wa.me do módulo de cobrança. */
export function isValidWaPhone(phone: string): boolean {
  return String(phone || "").replace(/\D/g, "").length >= 10;
}
