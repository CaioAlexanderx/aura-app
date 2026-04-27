// AURA. — TISS Types, constants e helpers
// Extraido de TissDashboard.tsx (decomposicao).

export interface Insurance {
  id: string; name: string; razao_social?: string; cnpj?: string;
  ans_code?: string; provider_code?: string; contract_number?: string;
  upload_portal_url?: string; payment_deadline_days?: number;
  is_active: boolean; guides_count?: number; notes_billing?: string;
}

export interface CatalogItem {
  id: string; name: string; razao_social?: string; cnpj?: string;
  ans_code?: string; upload_portal_url?: string;
  payment_deadline_days?: number; notes_billing?: string;
}

export interface Guide {
  id: string; guide_number: string;
  guide_type: 'consulta' | 'sp_sadt' | 'honorario' | 'internacao';
  status: string; total_value: number; paid_value?: number; glossed_value?: number;
  service_date: string; patient_name?: string; patient_full_name?: string;
  insurance_name?: string; insurance_id: string; customer_id: string;
  card_number?: string; batch_id?: string | null;
  professional_cro?: string; procedures?: any;
}

export interface Batch {
  id: string; batch_number: string; reference_month: string;
  insurance_id: string; insurance_name?: string; status: string;
  total_value: number; guide_count: number; total_paid?: number;
  total_glossed?: number; protocol_number?: string;
  upload_portal_url?: string; sent_at?: string; processed_at?: string;
}

export const GUIDE_TYPE_LABELS: Record<string, string> = {
  consulta:   'Consulta',
  sp_sadt:    'SP/SADT (procedimentos)',
  honorario:  'Honorario individual',
  internacao: 'Solicitacao de internacao',
};

export const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  rascunho:           { bg: 'rgba(148,163,184,0.15)', fg: '#94A3B8', label: 'Rascunho' },
  pendente_auth:      { bg: 'rgba(245,158,11,0.15)',  fg: '#F59E0B', label: 'Aguardando autorizacao' },
  autorizada:         { bg: 'rgba(6,182,212,0.15)',   fg: '#06B6D4', label: 'Autorizada' },
  enviada:            { bg: 'rgba(99,102,241,0.15)',  fg: '#6366F1', label: 'Enviada' },
  em_analise:         { bg: 'rgba(245,158,11,0.15)',  fg: '#F59E0B', label: 'Em analise' },
  paga:               { bg: 'rgba(16,185,129,0.15)',  fg: '#10B981', label: 'Paga' },
  paga_parcial:       { bg: 'rgba(245,158,11,0.15)',  fg: '#F59E0B', label: 'Paga parcial' },
  glosada:            { bg: 'rgba(239,68,68,0.15)',   fg: '#EF4444', label: 'Glosada' },
  negada:             { bg: 'rgba(239,68,68,0.15)',   fg: '#EF4444', label: 'Negada' },
  recursada:          { bg: 'rgba(239,68,68,0.15)',   fg: '#EF4444', label: 'Recursada' },
  autorizada_parcial: { bg: 'rgba(245,158,11,0.15)',  fg: '#F59E0B', label: 'Autorizada parcial' },
};

export function formatBRL(v: number | string): string {
  const n = parseFloat(String(v)) || 0;
  return n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d),)/g, '.');
}

export function formatDateBR(iso?: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return '—'; }
}

// Shared styles tokens reutilizados nas sub-tabs
export const TISS_TOKENS = {
  card: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
    backgroundColor: '#1E293B', borderRadius: 10, padding: 12,
    marginBottom: 8, borderWidth: 0.5, borderColor: '#334155',
  },
  cardSelected: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderColor: 'rgba(167,139,250,0.5)',
  },
  cardTitle: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' as const },
  cardSub:   { color: '#CBD5E1', fontSize: 12, marginTop: 2 },
  cardMeta:  { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  label: {
    color: '#a78bfa', fontSize: 11, fontWeight: '700' as const,
    textTransform: 'uppercase' as const, letterSpacing: 0.6,
    marginTop: 14, marginBottom: 6,
  },
  input: {
    backgroundColor: '#1E293B', borderRadius: 8, padding: 10,
    borderWidth: 0.5, borderColor: '#334155',
    color: '#E2E8F0', fontSize: 13, marginBottom: 6,
  },
  btn: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    alignItems: 'center' as const, justifyContent: 'center' as const,
    flexDirection: 'row' as const, gap: 6,
  },
  btnPrimary:     { backgroundColor: '#7c3aed' },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' as const },
  btnGhost:       { backgroundColor: '#1E293B', borderWidth: 0.5, borderColor: '#334155' },
  btnGhostText:   { color: '#a78bfa', fontSize: 13, fontWeight: '600' as const },
  empty: { padding: 32, alignItems: 'center' as const, gap: 8 },
  emptyTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' as const, textAlign: 'center' as const },
  emptySub:   { color: '#94A3B8', fontSize: 12, textAlign: 'center' as const, maxWidth: 320, lineHeight: 18 },
  actionsRow: { flexDirection: 'row' as const, gap: 8, padding: 12 },
  badge:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 9, fontWeight: '700' as const, textTransform: 'uppercase' as const, letterSpacing: 0.4 },
  backdrop:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' as const },
  sheet:     { backgroundColor: '#0F172A', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' as any, borderWidth: 1, borderColor: '#1E293B' },
  sheetHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  sheetTitle:  { color: '#FFFFFF', fontSize: 15, fontWeight: '700' as const, flex: 1 },
};
