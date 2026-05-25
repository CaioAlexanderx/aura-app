/**
 * Mapa canônico de status do Aura Studio → pt-BR.
 * Item #8 da análise UX/UI: lojista não decora códigos técnicos.
 * Usar `labelStudioStatus(status)` em qualquer lugar que renderize status.
 */

import { StudioColors } from './studio-tokens';

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

/* ------------------------------ Produção ------------------------------ */

const PRODUCTION_LABELS: Record<StudioProductionStatus, string> = {
  awaiting_customization: 'Aguardando personalização',
  pending_art: 'Aguardando arte',
  approved: 'Arte aprovada',
  in_production: 'Em produção',
  ready: 'Pronto pra entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

const PRODUCTION_COLORS: Record<StudioProductionStatus, { bg: string; fg: string }> = {
  awaiting_customization: { bg: '#FCE7F3', fg: '#9D174D' }, // pink (cliente de marketplace, precisa coletar)
  pending_art: { bg: '#FEF3C7', fg: '#92400E' }, // amber
  approved: { bg: '#DBEAFE', fg: '#1E40AF' }, // blue
  in_production: { bg: '#EDE9FE', fg: '#5B21B6' }, // violet
  ready: { bg: '#D1FAE5', fg: '#065F46' }, // emerald
  delivered: { bg: '#F1F5F9', fg: '#475569' }, // slate
  cancelled: { bg: '#FEE2E2', fg: '#991B1B' }, // red
};

/* ------------------------------ Aprovação ----------------------------- */

const APPROVAL_LABELS: Record<StudioApprovalStatus, string> = {
  pending: 'Aguardando cliente',
  approved: 'Cliente aprovou',
  changes_requested: 'Cliente pediu ajuste',
  expired: 'Link expirado',
};

const APPROVAL_COLORS: Record<StudioApprovalStatus, { bg: string; fg: string }> = {
  pending: { bg: '#FEF3C7', fg: '#92400E' },
  approved: { bg: '#D1FAE5', fg: '#065F46' },
  changes_requested: { bg: '#FED7AA', fg: '#9A3412' },
  expired: { bg: '#F1F5F9', fg: '#64748B' },
};

/* ------------------------------ Evento -------------------------------- */

const BULK_EVENT_LABELS: Record<StudioBulkEventStatus, string> = {
  draft: 'Rascunho',
  confirmed: 'Confirmado',
  in_production: 'Em produção',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

const BULK_EVENT_COLORS: Record<StudioBulkEventStatus, { bg: string; fg: string }> = {
  draft: { bg: '#F1F5F9', fg: '#475569' },
  confirmed: { bg: '#DBEAFE', fg: '#1E40AF' },
  in_production: { bg: '#EDE9FE', fg: '#5B21B6' },
  delivered: { bg: '#D1FAE5', fg: '#065F46' },
  cancelled: { bg: '#FEE2E2', fg: '#991B1B' },
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

export function colorStudioStatus(status: string | null | undefined): { bg: string; fg: string } {
  if (!status) return { bg: '#F1F5F9', fg: '#64748B' };
  if (status in PRODUCTION_COLORS) return PRODUCTION_COLORS[status as StudioProductionStatus];
  if (status in APPROVAL_COLORS) return APPROVAL_COLORS[status as StudioApprovalStatus];
  if (status in BULK_EVENT_COLORS) return BULK_EVENT_COLORS[status as StudioBulkEventStatus];
  return { bg: '#F1F5F9', fg: '#64748B' };
}

/**
 * Severity de alerta studio (low_stock, overdue, etc) → cores.
 */
export function colorStudioAlert(severity: 'info' | 'warning' | 'danger' | string | null | undefined) {
  switch (severity) {
    case 'danger':
      return { bg: '#FEE2E2', fg: '#991B1B', border: '#FCA5A5' };
    case 'warning':
      return { bg: '#FEF3C7', fg: '#92400E', border: '#FCD34D' };
    case 'info':
    default:
      return { bg: '#DBEAFE', fg: '#1E40AF', border: '#93C5FD' };
  }
}

/**
 * Cor accent padrão pra borda de elemento Studio (uso geral em chip/pill neutro).
 */
export const StudioStatusAccent = StudioColors.primary;

/**
 * Ordem canônica das colunas do KDS Studio (board /studio/(estudio)/producao).
 * Sub-onda Marketplaces S-0 (25/05/2026): adiciona awaiting_customization como
 * primeira coluna — pedidos ML/Shopee chegam nessa fila ANTES de virar pending_art.
 * Lojista coleta a personalizacao via modal e o status avanca pra pending_art.
 *
 * KDS UI deve ler dessa lista pra montar as colunas, evitando hardcoded ordens
 * em multiples lugares.
 */
export const STUDIO_KDS_COLUMNS: ReadonlyArray<StudioProductionStatus> = [
  'awaiting_customization',
  'pending_art',
  'approved',
  'in_production',
  'ready',
  'delivered',
] as const;
