/**
 * Mapa canônico de status do Aura Studio → pt-BR + cor semântica.
 * Item #8 da análise UX/UI: lojista não decora códigos técnicos.
 * Usar `labelStudioStatus(status)` em qualquer lugar que renderize status.
 *
 * Fase 0 do redesign (30/05/2026): a COR agora deriva de StudioSemantic
 * (constants/studio-semantic.ts) — fonte única, theme-aware, AA-validada.
 * Removido o hardcode de hex (e o ROSA pra awaiting_customization, que
 * violava o guardrail "nunca magenta pra estado"). As funções de cor
 * aceitam `isDark` (default false = light, backward compat).
 */

import { StudioColors } from './studio-tokens';
import {
  getStudioSemantic,
  intentForStatus,
  type StudioIntent,
} from './studio-semantic';

export type StudioProductionStatus =
  | 'awaiting_customization'
  | 'pending_art'
  | 'approved'
  | 'in_production'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export type StudioApprovalStatus =
  | 'pending'
  | 'approved'
  | 'changes_requested'
  | 'expired';

export type StudioBulkEventStatus =
  | 'draft'
  | 'confirmed'
  | 'in_production'
  | 'delivered'
  | 'cancelled';

/* ------------------------------ Labels -------------------------------- */

const PRODUCTION_LABELS: Record<StudioProductionStatus, string> = {
  awaiting_customization: 'Aguardando personalização',
  pending_art: 'Aguardando arte',
  approved: 'Arte aprovada',
  in_production: 'Em produção',
  ready: 'Pronto pra entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

const APPROVAL_LABELS: Record<StudioApprovalStatus, string> = {
  pending: 'Aguardando cliente',
  approved: 'Cliente aprovou',
  changes_requested: 'Cliente pediu ajuste',
  expired: 'Link expirado',
};

const BULK_EVENT_LABELS: Record<StudioBulkEventStatus, string> = {
  draft: 'Rascunho',
  confirmed: 'Confirmado',
  in_production: 'Em produção',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

/* ------------------------------ API ----------------------------------- */

export function labelStudioStatus(status: string | null | undefined): string {
  if (!status) return '—';
  if (status in PRODUCTION_LABELS) return PRODUCTION_LABELS[status as StudioProductionStatus];
  if (status in APPROVAL_LABELS) return APPROVAL_LABELS[status as StudioApprovalStatus];
  if (status in BULK_EVENT_LABELS) return BULK_EVENT_LABELS[status as StudioBulkEventStatus];
  // fallback humano: snake_case → "Snake Case"
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Cor de chip de status: { bg, fg } derivado de StudioSemantic.
 * bg = soft, fg = ink. Theme-aware via `isDark` (default light).
 */
export function colorStudioStatus(
  status: string | null | undefined,
  isDark = false,
): { bg: string; fg: string } {
  const sem = getStudioSemantic(isDark);
  const intent = intentForStatus(status);
  const t = sem[intent];
  return { bg: t.soft, fg: t.ink };
}

/** Cor base (ponto/ícone) de um status — para dots e bordas. */
export function baseStudioStatus(status: string | null | undefined, isDark = false): string {
  return getStudioSemantic(isDark)[intentForStatus(status)].base;
}

/**
 * Severity de alerta studio (low_stock, overdue, etc) → cores semânticas.
 * info → production(azul) · warning → waiting(âmbar) · danger → danger(vermelho).
 */
export function colorStudioAlert(
  severity: 'info' | 'warning' | 'danger' | string | null | undefined,
  isDark = false,
) {
  const sem = getStudioSemantic(isDark);
  const map: Record<string, StudioIntent> = {
    danger: 'danger',
    warning: 'waiting',
    info: 'production',
  };
  const t = sem[map[severity as string] ?? 'production'];
  return { bg: t.soft, fg: t.ink, border: t.base };
}

/**
 * Cor accent padrão pra borda de elemento Studio (uso geral em chip/pill neutro).
 */
export const StudioStatusAccent = StudioColors.primary;

/**
 * Ordem canônica das colunas do KDS Studio (board /studio/(estudio)/producao).
 * Sub-onda Marketplaces S-0 (25/05/2026): adiciona awaiting_customization como
 * primeira coluna — pedidos ML/Shopee chegam nessa fila ANTES de virar pending_art.
 */
export const STUDIO_KDS_COLUMNS: ReadonlyArray<StudioProductionStatus> = [
  'awaiting_customization',
  'pending_art',
  'approved',
  'in_production',
  'ready',
  'delivered',
] as const;
