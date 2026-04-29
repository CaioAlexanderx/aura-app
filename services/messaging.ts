// ============================================================
// AURA. — Messaging service (BE-06)
// Abstração de envio de mensagem (aniversário, retenção etc).
//
// Estratégias suportadas:
//   - 'wa_link' : abre wa.me em nova aba; quem manda é o humano
//   - 'wa_api'  : POST /companies/:id/whatsapp/send (Meta Cloud API)
//
// O front escolhe o channel via feature flag ('whatsapp_api' em
// company.module_overrides). Quando o backend tiver tokens válidos
// e o cliente liberar a flag, comuta automaticamente — sem refactor.
//
// Fluxo de aniversário (em BirthdayCouponModal):
//   1. birthdayApi.createCoupon(...)   → coupon
//   2. messaging.renderTemplate(...)   → texto final
//   3. messaging.sendBirthdayMessage({...}) → abre wa.me OU API
//   4. birthdayApi.logSent(...)        → grava histórico
// ============================================================

import { birthdayApi } from "@/services/api";

// ── Tipos públicos ─────────────────────────────────────────
export type MessagingChannel = "wa_link" | "wa_api";

export type BirthdayMessagePayload = {
  companyId: string;
  customer: { id: string; name: string; phone: string | null };
  coupon: {
    id: string;
    code: string;
    discount_type: "percent" | "fixed";
    discount_value: number;
    expires_at: string | null;
  };
  message: string;
  channel?: MessagingChannel;  // default decidido pelo helper resolveChannel
};

export type BirthdaySendResult =
  | { ok: true; channel: MessagingChannel; logged: boolean }
  | { ok: false; reason: "no_phone" | "invalid_phone" | "popup_blocked" | "api_error"; details?: string };

// ── E.164 BR — normalização de telefone ────────────────────
// Aceita: "(11) 98765-4321", "11987654321", "5511987654321",
//         "+55 11 98765-4321", "98765-4321" (assume DDD 11? não — exige DDD).
// Retorna string só de dígitos no formato 55DDDNNNNNNNNN (12-13 dígitos)
// ou null se inválido.
//
// Regras:
//   - Remove tudo que não é dígito.
//   - Se começa com 55 e tem 12-13 dígitos, retorna como veio.
//   - Se tem 10-11 dígitos (DDD + número), prepende 55.
//   - Caso contrário, retorna null (telefone inválido pra wa.me).
export function normalizeBrPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;

  // Já está em E.164 BR (55 + DDD + número)
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  // 10 dígitos (DDD + 8) ou 11 dígitos (DDD + 9 — celular com nono dígito)
  if (digits.length === 10 || digits.length === 11) {
    return "55" + digits;
  }

  // Outros tamanhos: provavelmente malformado
  return null;
}

// ── Construtor de URL wa.me ────────────────────────────────
export function buildWaMeUrl(phone: string | null | undefined, message: string): string | null {
  const normalized = normalizeBrPhone(phone);
  if (!normalized) return null;
  // wa.me usa o número sem o "+" e a mensagem URL-encoded
  return "https://wa.me/" + normalized + "?text=" + encodeURIComponent(message);
}

// ── Renderizador de template ───────────────────────────────
// Substitui variáveis {{nome}}, {{empresa}}, {{cupom}}, {{validade}},
// {{descricao_desconto}} no texto.
export type TemplateVars = {
  nome: string;
  empresa: string;
  cupom: string;
  validade: string;            // já formatado pt-BR (ex: 06/05)
  descricao_desconto: string;  // ex: "10% de desconto" ou "R$ 10 de desconto"
};

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{\{nome\}\}/g, vars.nome)
    .replace(/\{\{empresa\}\}/g, vars.empresa)
    .replace(/\{\{cupom\}\}/g, vars.cupom)
    .replace(/\{\{validade\}\}/g, vars.validade)
    .replace(/\{\{descricao_desconto\}\}/g, vars.descricao_desconto);
}

// ── Helpers de formatação pra montar TemplateVars ──────────
export function formatDiscountDescription(
  discount_type: "percent" | "fixed",
  discount_value: number
): string {
  if (discount_type === "percent") {
    // Sem decimal pra valores inteiros (10% em vez de 10,00%)
    const v = Number.isInteger(discount_value)
      ? String(discount_value)
      : discount_value.toFixed(2).replace(".", ",");
    return v + "% de desconto";
  }
  // fixed: R$ X,XX
  return "R$ " + discount_value.toFixed(2).replace(".", ",") + " de desconto";
}

export function formatExpiresAt(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return dd + "/" + mm;
  } catch {
    return "—";
  }
}

// ── Resolução de channel via feature flag ──────────────────
// company.module_overrides.whatsapp_api === true → 'wa_api'
// senão → 'wa_link' (default seguro)
export function resolveChannel(companyOverrides?: Record<string, boolean>): MessagingChannel {
  return companyOverrides?.whatsapp_api === true ? "wa_api" : "wa_link";
}

// ── Envio principal ────────────────────────────────────────
// Estratégias separadas; futuramente é só plugar a wa_api.
export async function sendBirthdayMessage(
  payload: BirthdayMessagePayload
): Promise<BirthdaySendResult> {
  const channel: MessagingChannel = payload.channel ?? "wa_link";

  if (channel === "wa_link") {
    return sendViaWaLink(payload);
  }

  // wa_api: ainda não implementado nesta fase — fallback explícito
  // pra wa_link. Quando whatsappApi.send existir, trocar este branch.
  return sendViaWaLink({ ...payload, channel: "wa_link" });
}

async function sendViaWaLink(payload: BirthdayMessagePayload): Promise<BirthdaySendResult> {
  const url = buildWaMeUrl(payload.customer.phone, payload.message);
  if (!url) {
    return {
      ok: false,
      reason: payload.customer.phone ? "invalid_phone" : "no_phone",
      details: payload.customer.phone || undefined,
    };
  }

  // Web: window.open. RN nativo seria Linking.openURL — mas o aura-app
  // é web-first (Cloudflare Pages); cobrimos só a janela aqui.
  let opened: Window | null = null;
  if (typeof window !== "undefined" && typeof window.open === "function") {
    opened = window.open(url, "_blank", "noopener,noreferrer");
  }

  if (!opened && typeof window !== "undefined") {
    // popup bloqueado: tenta navegação direta como último recurso
    try { (window as any).location.href = url; }
    catch { return { ok: false, reason: "popup_blocked" }; }
  }

  // Registra envio no backend (não-bloqueante pro usuário; falha silenciosa
  // não compromete o fluxo — a mensagem já foi aberta)
  let logged = false;
  try {
    await birthdayApi.logSent(payload.companyId, {
      customer_id: payload.customer.id,
      coupon_id: payload.coupon.id,
      method: "wa_link",
      message: payload.message,
    });
    logged = true;
  } catch (err) {
    // não derruba o fluxo
    console.warn("[messaging] logSent falhou:", err);
  }

  return { ok: true, channel: "wa_link", logged };
}
