// ============================================================
// AURA. — Ações da ficha do cliente (linha expandida)
// I0.5: os 3 botões mortos da linha expandida (Enviar WhatsApp,
// Pedir avaliação, Ver histórico) ganham ação de verdade, e
// "Receber pagamento" troca o window.prompt por modal (ver
// ReceberPagamentoModal.tsx).
//
// WhatsApp reaproveita normalizeBrPhone/buildWaMeUrl de
// services/messaging — a MESMA normalização E.164 (DDI 55 quando
// falta) já usada no fluxo de aniversário. Não reinventa a roda.
//
// "Pedir avaliação": não existe endpoint manual utilizável aqui —
// companiesApi.requestReview existe mas exige sale_id, que a lista
// de clientes não carrega (custaria 1 fetch extra por cliente só
// pra habilitar um botão opcional). O fluxo real de avaliação roda
// automático pós-venda (ver ReviewsList/companiesApi.reviews). Por
// isso o botão aqui abre wa.me com o pedido — mesmo padrão do botão
// "Enviar WhatsApp" — em vez de fingir um endpoint que não dá pra
// alimentar direito. Detalhe explicado no PR.
// ============================================================
import { buildWaMeUrl, normalizeBrPhone } from "@/services/messaging";

/** Primeiro nome — usado nas saudações ("Oi, {nome}!"). */
export function firstName(fullName: string | null | undefined): string {
  const trimmed = (fullName || "").trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0];
}

/** true se o telefone normaliza pra um E.164 BR válido (wa.me consegue usar). */
export function hasUsablePhone(phone: string | null | undefined): boolean {
  return normalizeBrPhone(phone) !== null;
}

export function buildGreetingMessage(customerName: string, storeName: string): string {
  return `Oi, ${firstName(customerName)}! Aqui é da ${storeName}. Como podemos te ajudar? 🙂`;
}

export function buildReviewRequestMessage(customerName: string, storeName: string): string {
  return (
    `Oi, ${firstName(customerName)}! Aqui é da ${storeName}. ` +
    `Adoraríamos saber o que você achou da sua última compra — ` +
    `pode deixar sua avaliação pra gente? É rapidinho! 🙂⭐`
  );
}

/** Link wa.me pronto pro botão "Enviar WhatsApp". null se telefone inválido/ausente. */
export function buildGreetingWaLink(
  phone: string | null | undefined,
  customerName: string,
  storeName: string
): string | null {
  return buildWaMeUrl(phone, buildGreetingMessage(customerName, storeName));
}

/** Link wa.me pronto pro botão "Pedir avaliação". null se telefone inválido/ausente. */
export function buildReviewRequestWaLink(
  phone: string | null | undefined,
  customerName: string,
  storeName: string
): string | null {
  return buildWaMeUrl(phone, buildReviewRequestMessage(customerName, storeName));
}

/** Abre uma URL externa em nova aba (web); cai pra navegação direta se o popup for bloqueado. */
export function openExternalUrl(url: string): void {
  if (typeof window === "undefined") return;
  let opened: Window | null = null;
  if (typeof window.open === "function") {
    opened = window.open(url, "_blank", "noopener,noreferrer");
  }
  if (!opened) {
    try { (window as any).location.href = url; } catch { /* sem navegação disponível — noop */ }
  }
}
