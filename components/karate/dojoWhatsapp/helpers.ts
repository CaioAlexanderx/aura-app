// ============================================================
// Helpers — WhatsApp Cloud API no dojô (Onda 5b)
//
// Traduz para pt-BR tudo que o backend/Meta devolve em inglês e/ou em
// snake_case: status de template, status da fila, skip_reason e
// last_error. Regra do módulo: NUNCA mostrar código cru pro sensei —
// código desconhecido vira texto humanizado (underscore → espaço), e o
// original fica só como detalhe secundário quando ajuda no suporte.
//
// Fase 6 (14/09/2026): o crediário do varejo passou a usar as MESMAS
// guardas, e o varejo pinta com `Colors`, não com `KarateColors`. Para
// não existirem duas cópias divergentes da pergunta "pode ligar o envio
// automático?", toda a DECISÃO mudou para components/whatsapp/waGuards.ts
// (sem uma cor sequer) e este arquivo virou a camada de TEMA do dojô:
// re-exporta o que não tem cor e resolve `tone` em KarateColors.
//
// O que a tela do dojô importa daqui continua com a mesma assinatura e o
// mesmo texto de antes — inclusive os rótulos que dizem "do dojô", que
// entram por DOJO_LABELS abaixo.
// ============================================================
import { KarateColors } from "@/constants/karateTheme";
import { WaOutboxStatus, WaQualityRating, WaStatus, WaTemplateStatus } from "@/services/waApi";
import {
  WaAutoBlocker, WaAutoBlockersOptions, WaBadgeTone,
  waAutoBlockers as waAutoBlockersCore,
  waOutboxStatusSpec, waQualitySpec, waTemplateStatusSpec,
} from "@/components/whatsapp/waGuards";

// Sem cor nenhuma: o dojô e o varejo usam exatamente estes.
export {
  WA_QUEUE_CHIP_ORDER, WA_TEST_DAILY_CAP, fmtAmountBR, fmtDayMonthBR, fmtDueDateBR,
  fmtPhoneBR, fmtWhenBR, isValidWaPhone, isWaErrorCode, mapWaError, waCategoryLabel,
  waConnectMode, waErrorLabel, waPausedReasonLabel, waPreviewSkippedSummary,
  waPreviewSkippedTotal, waQueueChips, waSkipReasonLabel, waSkipReasonShort,
  waTemplatesReadyFor, waTestsSentToday,
} from "@/components/whatsapp/waGuards";
export type {
  WaAutoBlocker, WaAutoBlockersOptions, WaConnectMode, WaMappedError,
} from "@/components/whatsapp/waGuards";

export interface WaBadgeView {
  label: string;
  icon: string;
  color: string;
  bg: string;
}

/** `tone` (intenção) → par de cores do tema do karatê. */
function tonePair(tone: WaBadgeTone): { color: string; bg: string } {
  switch (tone) {
    case "ok": return { color: KarateColors.ok, bg: KarateColors.okSoft };
    case "warn": return { color: KarateColors.warn, bg: KarateColors.warnSoft };
    case "danger": return { color: KarateColors.danger, bg: KarateColors.dangerSoft };
    case "primary": return { color: KarateColors.primary, bg: KarateColors.primarySoft };
    default: return { color: KarateColors.neutral, bg: KarateColors.neutralSoft };
  }
}

// ── Status do template (vem da Meta via webhook) ─────────
export function waTemplateStatusView(status: WaTemplateStatus | null | undefined): WaBadgeView {
  const spec = waTemplateStatusSpec(status);
  return { label: spec.label, icon: spec.icon, ...tonePair(spec.tone) };
}

// ── Status da fila de envio (outbox) ─────────────────────
export function waOutboxStatusView(status: WaOutboxStatus | null | undefined): WaBadgeView {
  const spec = waOutboxStatusSpec(status);
  return { label: spec.label, icon: spec.icon, ...tonePair(spec.tone) };
}

/** quality_rating da Meta → selo. null/ausente = sem selo (não inventa). */
export function waQualityView(rating: WaQualityRating | null | undefined): WaBadgeView | null {
  const spec = waQualitySpec(rating);
  if (!spec) return null;
  return { label: spec.label, icon: spec.icon, ...tonePair(spec.tone) };
}

// ── Guardas de custo, com a voz do dojô ──────────────────
/**
 * Os rótulos abaixo são os do DOJÔ ("o número do dojô", "na aba
 * WhatsApp"). O varejo chama waAutoBlockers de waGuards direto, com os
 * rótulos dele — a decisão é a mesma, o texto é que fala com quem lê.
 */
const DOJO_LABELS: WaAutoBlockersOptions["labels"] = {
  SEM_STATUS: "Não foi possível verificar o WhatsApp do dojô — recarregue antes de ligar o envio automático.",
  CONEXAO: "Conecte o número do dojô na aba WhatsApp.",
  TOKEN: "A autorização da Meta expirou — reconecte o número do dojô.",
  TEMPLATE: "Template de cobrança ainda não aprovado pela Meta.",
};

export function waAutoBlockers(
  status: WaStatus | null | undefined,
  opts?: WaAutoBlockersOptions
): WaAutoBlocker[] {
  return waAutoBlockersCore(status, {
    ...(opts || {}),
    labels: { ...DOJO_LABELS, ...(opts?.labels || {}) },
  });
}
