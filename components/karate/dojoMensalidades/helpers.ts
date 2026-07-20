// ============================================================
// Helpers — Mensalidades do dojô (F3a) + Conta Aura (F3b) + Régua (F3c)
//
// Competência 'YYYY-MM' e datas 'YYYY-MM-DD' são SEMPRE tz-safe: parse
// manual por regex/split, nunca new Date('YYYY-MM') / new Date('YYYY-MM-DD')
// direto (em UTC-3 isso pode voltar um mês/dia).
// ============================================================
import { KarateColors } from "@/constants/karateTheme";
import { BaasStatus, DojoChargeStatus, DojoReminderLogStatus } from "@/services/karateDojoBillingApi";

const MESES_LONG = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

// ── Competência (mês de referência) ─────────────────────────

/** Competência atual no formato 'YYYY-MM' (tz local do device). */
export function currentCompetence(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Desloca uma competência 'YYYY-MM' por `delta` meses (+/-), tz-safe. */
export function shiftCompetence(competence: string, delta: number): string {
  const m = String(competence || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return currentCompetence();
  let y = parseInt(m[1], 10);
  let mo = parseInt(m[2], 10) + delta;
  while (mo > 12) { mo -= 12; y += 1; }
  while (mo < 1) { mo += 12; y -= 1; }
  return `${y}-${String(mo).padStart(2, "0")}`;
}

/** 'YYYY-MM' → 'Julho de 2026'. */
export function competenceLabel(competence: string): string {
  const m = String(competence || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return competence;
  const y = m[1];
  const mi = parseInt(m[2], 10) - 1;
  if (mi < 0 || mi > 11) return competence;
  const mes = MESES_LONG[mi];
  return `${mes[0].toUpperCase()}${mes.slice(1)} de ${y}`;
}

// ── Datas / valores ──────────────────────────────────────────

/** 'YYYY-MM-DD' → 'DD/MM/AAAA' ('—' se ausente/inválida). */
export function fmtDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function fmtBRL(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── Status da cobrança — sempre icon+texto (WCAG 1.4.1) ─────

export interface ChargeStatusView {
  key: DojoChargeStatus;
  label: string;
  icon: string;
  color: string;
  bg: string;
}

export function chargeStatusView(status: DojoChargeStatus | string | null | undefined): ChargeStatusView {
  switch (status) {
    case "paid":
      return { key: "paid", label: "Paga", icon: "check_circle", color: KarateColors.ok, bg: KarateColors.okSoft };
    case "overdue":
      return { key: "overdue", label: "Vencida", icon: "alert", color: KarateColors.danger, bg: KarateColors.dangerSoft };
    case "cancelled":
      return { key: "cancelled", label: "Cancelada", icon: "x", color: KarateColors.neutral, bg: KarateColors.neutralSoft };
    default:
      return { key: "pending", label: "Pendente", icon: "clock", color: KarateColors.warn, bg: KarateColors.warnSoft };
  }
}

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  outro: "Outro",
};

// ── Status da Conta Aura (BaaS opt-in, F3b) — sempre icon+texto ─────

export interface BaasStatusView {
  key: BaasStatus;
  label: string;
  icon: string;
  color: string;
  bg: string;
}

/** 'none' também tem uma view (usada só internamente — o card não exibe badge nesse estado). */
export function baasStatusView(status: BaasStatus | string | null | undefined): BaasStatusView {
  switch (status) {
    case "created":
      return { key: "created", label: "Ativação em andamento", icon: "clock", color: KarateColors.warn, bg: KarateColors.warnSoft };
    case "docs_pending":
      return { key: "docs_pending", label: "Documentos pendentes", icon: "alert", color: KarateColors.warn, bg: KarateColors.warnSoft };
    case "under_review":
      return { key: "under_review", label: "Em análise", icon: "clock", color: KarateColors.warn, bg: KarateColors.warnSoft };
    case "approved":
      return { key: "approved", label: "Conta aprovada", icon: "check_circle", color: KarateColors.ok, bg: KarateColors.okSoft };
    case "rejected":
      return { key: "rejected", label: "Cadastro recusado", icon: "alert", color: KarateColors.danger, bg: KarateColors.dangerSoft };
    default:
      return { key: "none", label: "Não ativada", icon: "wallet", color: KarateColors.neutral, bg: KarateColors.neutralSoft };
  }
}

// ── Erros da API → mensagem pt-BR (ApiError carrega body em e.data) ───

export function mapBillingError(e: any): { code: string | null; message: string } {
  const code = e?.data?.code ?? e?.code ?? null;
  const apiErrors: string[] = Array.isArray(e?.data?.errors) ? e.data.errors : [];
  if (code === "SCHEMA_PENDING") {
    return { code, message: "Mensalidades ainda não estão disponíveis neste ambiente (atualização pendente no servidor)." };
  }
  if (code === "PIX_NAO_CONFIGURADO") {
    return { code, message: "Configure a chave Pix do dojô antes de gerar cobranças por Pix." };
  }
  if (code === "BAAS_DISABLED") {
    return { code, message: "A Conta Aura ainda não está disponível neste ambiente." };
  }
  if (code === "BAAS_JA_ATIVADO") {
    return { code, message: "A Conta Aura já foi ativada para este dojô." };
  }
  if (code === "PROVIDER_NAO_DISPONIVEL") {
    return { code, message: "A Conta Aura ainda não foi aprovada pela instituição financeira — não é possível ativar o recebimento por ela." };
  }
  if (code === "VALIDATION_ERROR") {
    return { code, message: apiErrors[0] || "Dados inválidos — confira o formulário." };
  }
  if (e?.status === 409) {
    return { code: code || "CONFLICT", message: e?.data?.error || "Essa cobrança já foi paga — não é possível cancelar." };
  }
  if (code === "NOT_FOUND") {
    return { code, message: "Não encontrado — talvez tenha sido alterado em outra aba." };
  }
  return { code, message: e?.data?.error || e?.message || "Não foi possível concluir. Tente de novo." };
}

// ── Mensagem de cobrança via WhatsApp (padrão do crediário) ──

export function buildChargeWaMessage(opts: {
  dojoName: string;
  payerName: string;
  studentName: string;
  isPayerStudent: boolean;
  competence: string;
  amount: number;
  dueDate: string;
  status: DojoChargeStatus;
  pixPayload: string | null;
  publicUrl: string | null;
}): string {
  const { dojoName, payerName, studentName, isPayerStudent, competence, amount, dueDate, status, pixPayload, publicUrl } = opts;
  const linhaAluno = isPayerStudent ? "" : `\n• Aluno: ${studentName}`;
  const linhaPix = pixPayload ? `\n\nPague via Pix (copia e cola):\n${pixPayload}` : "";
  const linhaLink = publicUrl ? `\n\nOu pelo link: ${publicUrl}` : "";
  const statusSuffix = status === "overdue" ? " (vencida)" : status === "paid" ? " (paga)" : "";
  return (
    `Olá, ${payerName}!\n` +
    `Aqui é o ${dojoName}.\n\n` +
    `Mensalidade de ${competenceLabel(competence)}:${linhaAluno}\n` +
    `• Valor: ${fmtBRL(amount)}\n` +
    `• Vencimento: ${fmtDateBR(dueDate)}${statusSuffix}` +
    linhaPix +
    linhaLink +
    `\n\nQualquer dúvida, é só responder por aqui. Obrigado!`
  );
}

/** Monta a URL wa.me (dígitos limpos + DDI 55) ou null se telefone curto demais. */
export function buildWaUrl(phone: string, message: string): string | null {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
}

/** Valida dia de vencimento 1–28 (evita mês curto/fevereiro). */
export function isValidDueDay(day: number | null | undefined): boolean {
  return typeof day === "number" && Number.isInteger(day) && day >= 1 && day <= 28;
}

// ── Régua de cobrança (lembretes automáticos, F3c) ────────────

/** Limites do offset (dias relativos ao vencimento) espelhados do backend. */
export const REMINDER_OFFSET_MIN = -15;
export const REMINDER_OFFSET_MAX = 30;
export const REMINDER_OFFSET_MAX_COUNT = 6;

export const REMINDER_OFFSET_PRESETS: { value: number; label: string }[] = [
  { value: -3, label: "3 dias antes" },
  { value: 0, label: "No vencimento" },
  { value: 3, label: "3 dias depois" },
  { value: 7, label: "7 dias depois" },
];

/** offset (dias, negativo=antes/0=no dia/positivo=depois) → rótulo curto pt-BR. */
export function offsetLabel(offset: number): string {
  if (offset === 0) return "no vencimento";
  if (offset < 0) return `${Math.abs(offset)}d antes`;
  return `${offset}d depois`;
}

export interface ReminderLogStatusView {
  key: DojoReminderLogStatus;
  label: string;
  icon: string;
  color: string;
  bg: string;
}

export function reminderLogStatusView(
  status: DojoReminderLogStatus | string | null | undefined
): ReminderLogStatusView {
  switch (status) {
    case "sent":
      return { key: "sent", label: "Enviado", icon: "check_circle", color: KarateColors.ok, bg: KarateColors.okSoft };
    case "failed":
      return { key: "failed", label: "Falhou", icon: "alert", color: KarateColors.danger, bg: KarateColors.dangerSoft };
    default:
      return { key: "skipped_no_email", label: "Sem e-mail", icon: "alert_circle", color: KarateColors.neutral, bg: KarateColors.neutralSoft };
  }
}
