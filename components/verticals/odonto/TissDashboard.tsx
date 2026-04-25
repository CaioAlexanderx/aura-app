// ============================================================
// AURA. — W2-02 F6: TissDashboard.tsx
//
// Tela full-screen pra gestao TISS completa. 3 sub-tabs:
//
//   Convenios -> CRUD + adicionar do catalogo (Bradesco/Amil/...)
//   Guias     -> Lista todas, criar nova (form polimorfico 4 tipos),
//                preview XML, deletar
//   Lotes     -> Cria lote (selecao de guias), download XML, parsear retorno
//
// Renderizado como Modal full-screen. Acesso a partir de:
//   - Sidebar Odonto > "TISS" (entry point principal)
//   - PatientHub > Cobrancas tab > "Faturar pra convenio"
// ============================================================

import { useState } from 'react';
import {
  Modal, View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, ActivityIndicator, Platform, Alert, Linking,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { Icon } from '@/components/Icon';

// ────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────

interface Insurance {
  id: string;
  name: string;
  razao_social?: string;
  cnpj?: string;
  ans_code?: string;
  provider_code?: string;
  contract_number?: string;
  upload_portal_url?: string;
  payment_deadline_days?: number;
  is_active: boolean;
  guides_count?: number;
  notes_billing?: string;
}

interface CatalogItem {
  id: string;
  name: string;
  razao_social?: string;
  cnpj?: string;
  ans_code?: string;
  upload_portal_url?: string;
  payment_deadline_days?: number;
  notes_billing?: string;
}

interface Guide {
  id: string;
  guide_number: string;
  guide_type: 'consulta' | 'sp_sadt' | 'honorario' | 'internacao';
  status: string;
  total_value: number;
  paid_value?: number;
  glossed_value?: number;
  service_date: string;
  patient_name?: string;
  patient_full_name?: string;
  insurance_name?: string;
  insurance_id: string;
  customer_id: string;
  card_number?: string;
  batch_id?: string | null;
  professional_cro?: string;
  procedures?: any;
}

interface Batch {
  id: string;
  batch_number: string;
  reference_month: string;
  insurance_id: string;
  insurance_name?: string;
  status: string;
  total_value: number;
  guide_count: number;
  total_paid?: number;
  total_glossed?: number;
  protocol_number?: string;
  upload_portal_url?: string;
  sent_at?: string;
  processed_at?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Pre-selecionar paciente (ao abrir do PatientHub) */
  initialPatientId?: string;
  initialPatientName?: string;
}

// ────────────────────────────────────────────────────────

const GUIDE_TYPE_LABELS: Record<string, string> = {
  consulta:   'Consulta',
  sp_sadt:    'SP/SADT (procedimentos)',
  honorario:  'Honorario individual',
  internacao: 'Solicitacao de internacao',
};

const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
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

function formatBRL(v: number | string): string {
  const n = parseFloat(String(v)) || 0;
  return n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d),)/g, '.');
}

function formatDateBR(iso?: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return '—'; }
}

// ────────────────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────────────────

export function TissDashboard({ visible, onClose, initialPatientId, initialPatientName }: Props) {
  const cid = useAuthStore().company?.id;
  const [tab, setTab] = useState<'convenios' | 'guias' | 'lotes'>('guias');
  const [showCatalog, setShowCatalog] = useState(false);
  const [showGuideForm, setShowGuideForm] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [editingInsurance, setEditingInsurance] = useState<Insurance | null>(null);
  const [editingGuide, setEditingGuide] = useState<Guide | null>(null);

  if (!cid) return null;

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={s.modal}>
          {/* Header */}
          <View style={s.header}>
            <Pressable onPress={onClose} hitSlop={10}>
              <Icon name="x" size={20} color="#94A3B8" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>TISS</Text>
              <Text style={s.headerSub}>Faturamento de convenios</Text>
            </View>
          </View>

          {/* Tabs */}
          <View style={s.tabs}>
            <TabBtn active={tab === 'convenios'} onPress={() => setTab('convenios')} label="Convenios" />
            <TabBtn active={tab === 'guias'}     onPress={() => setTab('guias')}     label="Guias" />
            <TabBtn active={tab === 'lotes'}     onPress={() => setTab('lotes')}     label="Lotes" />
          </View>

          <View style={{ flex: 1 }}>
            {tab === 'convenios' && (
              <InsuranceTab
                cid={cid}
                onAddFromCatalog={() => setShowCatalog(true)}
                onEdit={setEditingInsurance}
              />
            )}
            {tab === 'guias' && (
              <GuidesTab
                cid={cid}
                onCreate={() => { setEditingGuide(null); setShowGuideForm(true); }}
                onEdit={(g) => { setEditingGuide(g); setShowGuideForm(true); }}
                initialPatientId={initialPatientId}
              />
            )}
            {tab === 'lotes' && (
              <BatchesTab cid={cid} onCreate={() => setShowBatchForm(true)} />
            )}
          </View>
        </View>
      </Modal>

      {/* Modais */}
      <CatalogPickerModal
        visible={showCatalog}
        cid={cid}
        onClose={() => setShowCatalog(false)}
      />

      <GuideFormModal
        visible={showGuideForm}
        cid={cid}
        guide={editingGuide}
        initialPatientId={initialPatientId}
        initialPatientName={initialPatientName}
        onClose={() => { setShowGuideForm(false); setEditingGuide(null); }}
      />

      <BatchFormModal
        visible={showBatchForm}
        cid={cid}
        onClose={() => setShowBatchForm(false)}
      />

      <InsuranceFormModal
        visible={!!editingInsurance}
        cid={cid}
        insurance={editingInsurance}
        onClose={() => setEditingInsurance(null)}
      />
    </>
  );
}

function TabBtn({ active, onPress, label }: { active: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} style={[s.tab, active && s.tabActive]}>
      <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

// ────────────────────────────────────────────────────────
// TAB 1: CONVENIOS
// ────────────────────────────────────────────────────────

function InsuranceTab({ cid, onAddFromCatalog, onEdit }: {
  cid: string; onAddFromCatalog: () => void; onEdit: (i: Insurance) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['tiss-insurance', cid],
    queryFn: () => request<{ insurance: Insurance[] }>(`/companies/${cid}/dental/tiss/insurance`),
    enabled: !!cid,
  });

  const items = data?.insurance || [];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
      <View style={s.actionsRow}>
        <Pressable onPress={onAddFromCatalog} style={[s.btn, s.btnPrimary, { flex: 1 }]}>
          <Icon name="plus" size={14} color="#fff" />
          <Text style={s.btnPrimaryText}>Adicionar do catalogo</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#06B6D4" style={{ marginTop: 24 }} />
      ) : items.length === 0 ? (
        <View style={s.empty}>
          <Icon name="briefcase" size={32} color="#475569" />
          <Text style={s.emptyTitle}>Nenhum convenio cadastrado</Text>
          <Text style={s.emptySub}>
            Adicione do catalogo Aura (Bradesco, Amil, SulAmerica, Unimed) ou crie manualmente.
          </Text>
        </View>
      ) : items.map(i => (
        <Pressable key={i.id} onPress={() => onEdit(i)} style={s.card}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>{i.name}</Text>
            {i.ans_code && <Text style={s.cardMeta}>ANS: {i.ans_code}</Text>}
            {i.provider_code && <Text style={s.cardMeta}>Cod. prestador: {i.provider_code}</Text>}
            <Text style={s.cardMeta}>
              {i.guides_count || 0} guias • {i.payment_deadline_days || 30}d prazo
            </Text>
          </View>
          {!i.is_active && <View style={s.inactiveBadge}><Text style={s.inactiveText}>Inativo</Text></View>}
          <Icon name="chevron_right" size={16} color="#475569" />
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ────────────────────────────────────────────────────────
// TAB 2: GUIAS
// ────────────────────────────────────────────────────────

function GuidesTab({ cid, onCreate, onEdit, initialPatientId }: {
  cid: string; onCreate: () => void; onEdit: (g: Guide) => void; initialPatientId?: string;
}) {
  const [filter, setFilter] = useState<string>('all');
  const params = filter === 'all' ? '' : `?status=${filter}`;
  const customerParam = initialPatientId
    ? (params ? `&customer_id=${initialPatientId}` : `?customer_id=${initialPatientId}`)
    : '';

  const { data, isLoading } = useQuery({
    queryKey: ['tiss-guides', cid, filter, initialPatientId],
    queryFn: () => request<{ guides: Guide[]; stats: any[] }>(
      `/companies/${cid}/dental/tiss/guides${params}${customerParam}`
    ),
    enabled: !!cid,
  });

  const items = data?.guides || [];

  return (
    <View style={{ flex: 1 }}>
      <View style={s.filtersRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['all', 'rascunho', 'enviada', 'paga', 'glosada'].map(st => (
            <Pressable
              key={st}
              onPress={() => setFilter(st)}
              style={[s.chip, filter === st && s.chipActive]}
            >
              <Text style={[s.chipText, filter === st && s.chipTextActive]}>
                {st === 'all' ? 'Todas' : STATUS_COLORS[st]?.label || st}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={s.actionsRow}>
        <Pressable onPress={onCreate} style={[s.btn, s.btnPrimary, { flex: 1 }]}>
          <Icon name="plus" size={14} color="#fff" />
          <Text style={s.btnPrimaryText}>Nova guia</Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingTop: 0 }}>
        {isLoading ? (
          <ActivityIndicator color="#06B6D4" style={{ marginTop: 24 }} />
        ) : items.length === 0 ? (
          <View style={s.empty}>
            <Icon name="file" size={32} color="#475569" />
            <Text style={s.emptyTitle}>Nenhuma guia</Text>
            <Text style={s.emptySub}>Clique em "Nova guia" pra comecar.</Text>
          </View>
        ) : items.map(g => (
          <Pressable key={g.id} onPress={() => onEdit(g)} style={s.card}>
            <View style={{ flex: 1 }}>
              <View style={s.cardRow}>
                <Text style={s.cardTitle}>{g.guide_number}</Text>
                <StatusBadge status={g.status} />
              </View>
              <Text style={s.cardSub}>
                {GUIDE_TYPE_LABELS[g.guide_type]} • {g.patient_full_name || g.patient_name}
              </Text>
              <Text style={s.cardMeta}>
                {g.insurance_name} • {formatDateBR(g.service_date)} • R$ {formatBRL(g.total_value)}
              </Text>
              {g.paid_value && Number(g.paid_value) > 0 && (
                <Text style={[s.cardMeta, { color: '#10B981' }]}>
                  Pago: R$ {formatBRL(g.paid_value)}
                </Text>
              )}
              {g.glossed_value && Number(g.glossed_value) > 0 && (
                <Text style={[s.cardMeta, { color: '#EF4444' }]}>
                  Glosado: R$ {formatBRL(g.glossed_value)}
                </Text>
              )}
            </View>
            <Icon name="chevron_right" size={16} color="#475569" />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_COLORS[status] || STATUS_COLORS.rascunho;
  return (
    <View style={[s.badge, { backgroundColor: config.bg }]}>
      <Text style={[s.badgeText, { color: config.fg }]}>{config.label}</Text>
    </View>
  );
}

// ────────────────────────────────────────────────────────
// TAB 3: LOTES
// ────────────────────────────────────────────────────────

function BatchesTab({ cid, onCreate }: { cid: string; onCreate: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['tiss-batches', cid],
    queryFn: () => request<{ batches: Batch[] }>(`/companies/${cid}/dental/tiss/batches`),
    enabled: !!cid,
  });

  const items = data?.batches || [];

  function downloadXml(b: Batch) {
    const url = `${process.env.EXPO_PUBLIC_API_URL}/companies/${cid}/dental/tiss/batches/${b.id}/xml`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Erro', 'Nao foi possivel baixar o XML.');
    });
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={s.actionsRow}>
        <Pressable onPress={onCreate} style={[s.btn, s.btnPrimary, { flex: 1 }]}>
          <Icon name="plus" size={14} color="#fff" />
          <Text style={s.btnPrimaryText}>Novo lote</Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingTop: 0 }}>
        {isLoading ? (
          <ActivityIndicator color="#06B6D4" />
        ) : items.length === 0 ? (
          <View style={s.empty}>
            <Icon name="package" size={32} color="#475569" />
            <Text style={s.emptyTitle}>Nenhum lote criado</Text>
            <Text style={s.emptySub}>
              Lotes agrupam varias guias do mesmo convenio pra envio mensal.
            </Text>
          </View>
        ) : items.map(b => (
          <View key={b.id} style={s.card}>
            <View style={{ flex: 1 }}>
              <View style={s.cardRow}>
                <Text style={s.cardTitle}>{b.batch_number}</Text>
                <StatusBadge status={b.status} />
              </View>
              <Text style={s.cardSub}>
                {b.insurance_name} • {b.reference_month}
              </Text>
              <Text style={s.cardMeta}>
                {b.guide_count} guias • R$ {formatBRL(b.total_value)}
              </Text>
              {Number(b.total_paid || 0) > 0 && (
                <Text style={[s.cardMeta, { color: '#10B981' }]}>
                  Recebido: R$ {formatBRL(b.total_paid!)}
                </Text>
              )}
              {Number(b.total_glossed || 0) > 0 && (
                <Text style={[s.cardMeta, { color: '#EF4444' }]}>
                  Glosado: R$ {formatBRL(b.total_glossed!)}
                </Text>
              )}
              {b.protocol_number && (
                <Text style={s.cardMeta}>Protocolo: {b.protocol_number}</Text>
              )}
              <View style={[s.actionsRow, { marginTop: 8 }]}>
                <Pressable onPress={() => downloadXml(b)} style={[s.btnSm, s.btnSmGhost]}>
                  <Icon name="download" size={12} color="#a78bfa" />
                  <Text style={s.btnSmGhostText}>XML</Text>
                </Pressable>
                {b.upload_portal_url && (
                  <Pressable
                    onPress={() => Linking.openURL(b.upload_portal_url!)}
                    style={[s.btnSm, s.btnSmGhost]}
                  >
                    <Icon name="external_link" size={12} color="#06B6D4" />
                    <Text style={[s.btnSmGhostText, { color: '#06B6D4' }]}>Portal</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ────────────────────────────────────────────────────────
// MODAL: CATALOG PICKER (Bradesco, Amil, ...)
// ────────────────────────────────────────────────────────

function CatalogPickerModal({ visible, cid, onClose }: {
  visible: boolean; cid: string; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [providerCode, setProviderCode] = useState('');
  const [contractNumber, setContractNumber] = useState('');

  const { data } = useQuery({
    queryKey: ['tiss-catalog', cid],
    queryFn: () => request<{ catalog: CatalogItem[] }>(`/companies/${cid}/dental/tiss/catalog`),
    enabled: !!cid && visible,
  });

  const cloneMut = useMutation({
    mutationFn: () => request(`/companies/${cid}/dental/tiss/catalog/${selected!.id}/clone`, {
      method: 'POST',
      body: { provider_code: providerCode, contract_number: contractNumber },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tiss-insurance', cid] });
      Alert.alert('Convenio adicionado', `${selected!.name} foi adicionado ao seu cadastro.`);
      reset();
    },
    onError: (err: any) => {
      Alert.alert('Erro', err?.body?.error || 'Nao foi possivel adicionar.');
    },
  });

  function reset() {
    setSelected(null);
    setProviderCode('');
    setContractNumber('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={reset}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>
              {selected ? selected.name : 'Catalogo de convenios'}
            </Text>
            <Pressable onPress={reset} hitSlop={10}>
              <Icon name="x" size={18} color="#94A3B8" />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ padding: 14 }}>
            {!selected ? (
              <>
                <Text style={s.help}>
                  Estes sao os convenios pre-cadastrados pela Aura. Selecione um e
                  preencha o codigo de prestador da sua clinica.
                </Text>
                {(data?.catalog || []).map(c => (
                  <Pressable key={c.id} onPress={() => setSelected(c)} style={s.card}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>{c.name}</Text>
                      {c.razao_social && (
                        <Text style={s.cardMeta} numberOfLines={1}>{c.razao_social}</Text>
                      )}
                      {c.ans_code && <Text style={s.cardMeta}>ANS: {c.ans_code}</Text>}
                      {c.cnpj && <Text style={s.cardMeta}>CNPJ: {c.cnpj}</Text>}
                    </View>
                    <Icon name="chevron_right" size={16} color="#475569" />
                  </Pressable>
                ))}
              </>
            ) : (
              <>
                <Text style={s.help}>
                  Para usar {selected.name}, informe seus dados de prestador no
                  contrato com a operadora:
                </Text>
                <Text style={s.label}>Codigo do prestador *</Text>
                <Text style={s.helpSm}>Geralmente o CNPJ da clinica ou um codigo proprio fornecido pela operadora</Text>
                <TextInput
                  value={providerCode}
                  onChangeText={setProviderCode}
                  style={s.input}
                  placeholder="Ex: 12345678000190"
                  placeholderTextColor="#475569"
                />

                <Text style={s.label}>Numero do contrato (opcional)</Text>
                <TextInput
                  value={contractNumber}
                  onChangeText={setContractNumber}
                  style={s.input}
                  placeholder="Ex: 0001234"
                  placeholderTextColor="#475569"
                />

                <View style={[s.actionsRow, { marginTop: 16 }]}>
                  <Pressable onPress={() => setSelected(null)} style={[s.btn, s.btnGhost]}>
                    <Text style={s.btnGhostText}>Voltar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => cloneMut.mutate()}
                    disabled={!providerCode.trim() || cloneMut.isPending}
                    style={[s.btn, s.btnPrimary, !providerCode.trim() && { opacity: 0.5 }]}
                  >
                    {cloneMut.isPending
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={s.btnPrimaryText}>Adicionar</Text>}
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────
// MODAL: INSURANCE FORM (edicao)
// ────────────────────────────────────────────────────────

function InsuranceFormModal({ visible, cid, insurance, onClose }: {
  visible: boolean; cid: string; insurance: Insurance | null; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [providerCode, setProviderCode] = useState(insurance?.provider_code || '');
  const [contractNumber, setContractNumber] = useState(insurance?.contract_number || '');
  const [paymentDays, setPaymentDays] = useState(String(insurance?.payment_deadline_days || 30));

  // Reset quando troca de insurance
  if (insurance && (insurance.provider_code || '') !== providerCode &&
      (insurance.provider_code || '') !== '' && providerCode === '') {
    setProviderCode(insurance.provider_code || '');
    setContractNumber(insurance.contract_number || '');
    setPaymentDays(String(insurance.payment_deadline_days || 30));
  }

  const updateMut = useMutation({
    mutationFn: () => request(`/companies/${cid}/dental/tiss/insurance/${insurance!.id}`, {
      method: 'PATCH',
      body: {
        provider_code: providerCode,
        contract_number: contractNumber,
        payment_deadline_days: parseInt(paymentDays) || 30,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tiss-insurance', cid] });
      Alert.alert('Salvo', 'Convenio atualizado.');
      onClose();
    },
    onError: (err: any) => Alert.alert('Erro', err?.body?.error || 'Nao foi possivel salvar.'),
  });

  if (!insurance) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>{insurance.name}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Icon name="x" size={18} color="#94A3B8" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 14 }}>
            {insurance.upload_portal_url && (
              <Pressable
                onPress={() => Linking.openURL(insurance.upload_portal_url!)}
                style={[s.card, { backgroundColor: 'rgba(6,182,212,0.1)', borderColor: 'rgba(6,182,212,0.3)' }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardTitle, { color: '#06B6D4' }]}>Portal do convenio</Text>
                  <Text style={[s.cardMeta, { color: '#06B6D4' }]} numberOfLines={1}>
                    {insurance.upload_portal_url}
                  </Text>
                </View>
                <Icon name="external_link" size={14} color="#06B6D4" />
              </Pressable>
            )}

            {insurance.notes_billing && (
              <View style={[s.card, { backgroundColor: 'rgba(245,158,11,0.08)' }]}>
                <Text style={[s.cardMeta, { color: '#F59E0B' }]}>{insurance.notes_billing}</Text>
              </View>
            )}

            <Text style={s.label}>Codigo do prestador</Text>
            <TextInput value={providerCode} onChangeText={setProviderCode} style={s.input} />

            <Text style={s.label}>Numero do contrato</Text>
            <TextInput value={contractNumber} onChangeText={setContractNumber} style={s.input} />

            <Text style={s.label}>Prazo de pagamento (dias)</Text>
            <TextInput
              value={paymentDays}
              onChangeText={setPaymentDays}
              style={s.input}
              keyboardType="numeric"
            />

            <Pressable
              onPress={() => updateMut.mutate()}
              disabled={updateMut.isPending}
              style={[s.btn, s.btnPrimary, { marginTop: 16 }]}
            >
              {updateMut.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.btnPrimaryText}>Salvar</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────
// MODAL: GUIDE FORM (4 tipos)
// ────────────────────────────────────────────────────────

interface ProcedureRow {
  tuss_code: string;
  description: string;
  unit_value: string;
  quantity: string;
  tooth?: string;
}

function GuideFormModal({ visible, cid, guide, initialPatientId, initialPatientName, onClose }: {
  visible: boolean; cid: string; guide: Guide | null;
  initialPatientId?: string; initialPatientName?: string; onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!guide;

  const [guideType, setGuideType] = useState<'consulta' | 'sp_sadt' | 'honorario' | 'internacao'>('sp_sadt');
  const [insuranceId, setInsuranceId] = useState<string>('');
  const [patientId, setPatientId] = useState<string>(initialPatientId || '');
  const [patientName, setPatientName] = useState<string>(initialPatientName || '');
  const [cardId, setCardId] = useState<string>('');
  const [serviceDate, setServiceDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [authNumber, setAuthNumber] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [professionalCro, setProfessionalCro] = useState('');
  const [cidCode, setCidCode] = useState('');
  const [clinicalIndication, setClinicalIndication] = useState('');
  const [procedures, setProcedures] = useState<ProcedureRow[]>([
    { tuss_code: '', description: '', unit_value: '', quantity: '1' },
  ]);

  const { data: insuranceData } = useQuery({
    queryKey: ['tiss-insurance', cid],
    queryFn: () => request<{ insurance: Insurance[] }>(`/companies/${cid}/dental/tiss/insurance`),
    enabled: !!cid && visible,
  });

  const { data: cardsData } = useQuery({
    queryKey: ['tiss-cards', cid, patientId],
    queryFn: () => request<{ cards: any[] }>(`/companies/${cid}/dental/tiss/patients/${patientId}/cards`),
    enabled: !!cid && !!patientId && visible,
  });

  const createMut = useMutation({
    mutationFn: () => {
      const body: any = {
        customer_id: patientId,
        insurance_id: insuranceId,
        patient_insurance_id: cardId || null,
        guide_type: guideType,
        service_date: serviceDate,
        professional_cro: professionalCro,
        professional_council_uf: 'SP',
        professional_cbo: '223208',
        auth_number: authNumber || null,
        auth_password: authPassword || null,
        procedures: procedures
          .filter(p => p.tuss_code && p.unit_value)
          .map(p => ({
            tuss_code: p.tuss_code,
            description: p.description,
            unit_value: parseFloat(p.unit_value) || 0,
            value: parseFloat(p.unit_value) || 0,
            quantity: parseInt(p.quantity) || 1,
            tooth: p.tooth || null,
            table_id: '22',
          })),
      };
      if (guideType === 'internacao') {
        body.cid_code = cidCode;
        body.clinical_indication = clinicalIndication;
        body.hospital_admission_at = new Date(serviceDate).toISOString();
        body.hospital_regime = 'hospitalar';
      }
      return request(`/companies/${cid}/dental/tiss/guides`, { method: 'POST', body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tiss-guides', cid] });
      Alert.alert('Guia criada', 'A guia foi salva como rascunho.');
      onClose();
    },
    onError: (err: any) => Alert.alert('Erro', err?.body?.error || 'Nao foi possivel criar.'),
  });

  function addProcedure() {
    setProcedures([...procedures, { tuss_code: '', description: '', unit_value: '', quantity: '1' }]);
  }

  function updateProcedure(idx: number, key: keyof ProcedureRow, value: string) {
    const next = [...procedures];
    next[idx] = { ...next[idx], [key]: value };
    setProcedures(next);
  }

  function removeProcedure(idx: number) {
    setProcedures(procedures.filter((_, i) => i !== idx));
  }

  const totalValue = procedures.reduce((s, p) =>
    s + (parseFloat(p.unit_value) || 0) * (parseInt(p.quantity) || 1), 0
  );

  const canSubmit = !!patientId && !!insuranceId && !!professionalCro
    && procedures.some(p => p.tuss_code && p.unit_value);

  const insurances = insuranceData?.insurance || [];
  const cards = cardsData?.cards || [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.modal}>
        <View style={s.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Icon name="x" size={20} color="#94A3B8" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{isEdit ? `Guia ${guide?.guide_number}` : 'Nova guia TISS'}</Text>
            <Text style={s.headerSub}>R$ {formatBRL(totalValue)}</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 80 }}>
          {/* Tipo de guia */}
          <Text style={s.label}>Tipo de guia *</Text>
          <View style={s.chipRow}>
            {(['consulta', 'sp_sadt', 'honorario', 'internacao'] as const).map(t => (
              <Pressable
                key={t}
                onPress={() => setGuideType(t)}
                style={[s.chip, guideType === t && s.chipActive]}
              >
                <Text style={[s.chipText, guideType === t && s.chipTextActive]}>
                  {GUIDE_TYPE_LABELS[t]}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Convenio */}
          <Text style={s.label}>Convenio *</Text>
          <View>
            {insurances.length === 0 ? (
              <View style={[s.card, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                <Text style={[s.cardMeta, { color: '#F59E0B' }]}>
                  Cadastre um convenio na aba "Convenios" antes de criar guias.
                </Text>
              </View>
            ) : insurances.map(i => (
              <Pressable
                key={i.id}
                onPress={() => setInsuranceId(i.id)}
                style={[s.card, insuranceId === i.id && s.cardSelected]}
              >
                <Text style={s.cardTitle}>{i.name}</Text>
                {i.ans_code && <Text style={s.cardMeta}>ANS: {i.ans_code}</Text>}
              </Pressable>
            ))}
          </View>

          {/* Paciente */}
          <Text style={s.label}>Paciente *</Text>
          {patientName ? (
            <View style={[s.card, s.cardSelected]}>
              <Text style={s.cardTitle}>{patientName}</Text>
            </View>
          ) : (
            <Text style={s.helpSm}>
              Abra esta tela a partir do prontuario do paciente pra preencher automaticamente.
            </Text>
          )}

          {/* Carteirinha */}
          {patientId && cards.length > 0 && (
            <>
              <Text style={s.label}>Carteirinha</Text>
              {cards.map(c => (
                <Pressable
                  key={c.id}
                  onPress={() => setCardId(c.id)}
                  style={[s.card, cardId === c.id && s.cardSelected]}
                >
                  <Text style={s.cardTitle}>{c.card_number}</Text>
                  <Text style={s.cardMeta}>{c.insurance_name} {c.plan_name && `• ${c.plan_name}`}</Text>
                  {c.card_valid_until && (
                    <Text style={s.cardMeta}>Valida ate {formatDateBR(c.card_valid_until)}</Text>
                  )}
                </Pressable>
              ))}
            </>
          )}

          {/* Dados profissional */}
          <Text style={s.label}>CRO do profissional *</Text>
          <TextInput
            value={professionalCro}
            onChangeText={setProfessionalCro}
            style={s.input}
            placeholder="Ex: 12345"
            placeholderTextColor="#475569"
          />

          {/* Data servico */}
          <Text style={s.label}>Data do atendimento *</Text>
          <TextInput
            value={serviceDate}
            onChangeText={setServiceDate}
            style={s.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#475569"
          />

          {/* Autorizacao */}
          <Text style={s.label}>Numero de autorizacao (opcional)</Text>
          <TextInput value={authNumber} onChangeText={setAuthNumber} style={s.input} />

          <Text style={s.label}>Senha de autorizacao (opcional)</Text>
          <TextInput value={authPassword} onChangeText={setAuthPassword} style={s.input} />

          {/* Internacao */}
          {guideType === 'internacao' && (
            <>
              <Text style={s.label}>CID-10 *</Text>
              <TextInput
                value={cidCode}
                onChangeText={setCidCode}
                style={s.input}
                placeholder="Ex: K02.9"
                placeholderTextColor="#475569"
              />
              <Text style={s.label}>Indicacao clinica *</Text>
              <TextInput
                value={clinicalIndication}
                onChangeText={setClinicalIndication}
                style={[s.input, { minHeight: 70 }]}
                multiline
              />
            </>
          )}

          {/* Procedimentos */}
          <Text style={[s.label, { marginTop: 16 }]}>Procedimentos *</Text>
          {procedures.map((p, idx) => (
            <View key={idx} style={[s.card, { gap: 6 }]}>
              <View style={s.cardRow}>
                <Text style={s.cardSub}>Procedimento {idx + 1}</Text>
                {procedures.length > 1 && (
                  <Pressable onPress={() => removeProcedure(idx)} hitSlop={10}>
                    <Icon name="trash" size={14} color="#EF4444" />
                  </Pressable>
                )}
              </View>
              <TextInput
                value={p.tuss_code}
                onChangeText={(v) => updateProcedure(idx, 'tuss_code', v)}
                style={s.input}
                placeholder="Codigo TUSS (ex: 81000034)"
                placeholderTextColor="#475569"
              />
              <TextInput
                value={p.description}
                onChangeText={(v) => updateProcedure(idx, 'description', v)}
                style={s.input}
                placeholder="Descricao"
                placeholderTextColor="#475569"
              />
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TextInput
                  value={p.unit_value}
                  onChangeText={(v) => updateProcedure(idx, 'unit_value', v)}
                  style={[s.input, { flex: 1 }]}
                  placeholder="Valor unit."
                  placeholderTextColor="#475569"
                  keyboardType="decimal-pad"
                />
                <TextInput
                  value={p.quantity}
                  onChangeText={(v) => updateProcedure(idx, 'quantity', v)}
                  style={[s.input, { width: 80 }]}
                  placeholder="Qtd"
                  placeholderTextColor="#475569"
                  keyboardType="numeric"
                />
                <TextInput
                  value={p.tooth || ''}
                  onChangeText={(v) => updateProcedure(idx, 'tooth', v)}
                  style={[s.input, { width: 70 }]}
                  placeholder="Dente"
                  placeholderTextColor="#475569"
                />
              </View>
            </View>
          ))}

          <Pressable onPress={addProcedure} style={[s.btn, s.btnGhost, { marginTop: 4 }]}>
            <Icon name="plus" size={14} color="#a78bfa" />
            <Text style={s.btnGhostText}>Adicionar procedimento</Text>
          </Pressable>

          {/* Submit */}
          <Pressable
            onPress={() => createMut.mutate()}
            disabled={!canSubmit || createMut.isPending}
            style={[s.btn, s.btnPrimary, { marginTop: 20 }, !canSubmit && { opacity: 0.5 }]}
          >
            {createMut.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.btnPrimaryText}>Salvar guia</Text>}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────
// MODAL: BATCH FORM (criar lote)
// ────────────────────────────────────────────────────────

function BatchFormModal({ visible, cid, onClose }: {
  visible: boolean; cid: string; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [insuranceId, setInsuranceId] = useState('');
  const [referenceMonth, setReferenceMonth] = useState(
    new Date().toISOString().substring(0, 7) // YYYY-MM
  );
  const [selectedGuides, setSelectedGuides] = useState<Set<string>>(new Set());

  const { data: insuranceData } = useQuery({
    queryKey: ['tiss-insurance', cid],
    queryFn: () => request<{ insurance: Insurance[] }>(`/companies/${cid}/dental/tiss/insurance`),
    enabled: !!cid && visible,
  });

  const { data: guidesData } = useQuery({
    queryKey: ['tiss-guides-pending', cid, insuranceId],
    queryFn: () => request<{ guides: Guide[] }>(
      `/companies/${cid}/dental/tiss/guides?insurance_id=${insuranceId}&batch_id=null`
    ),
    enabled: !!cid && !!insuranceId && visible,
  });

  const createMut = useMutation({
    mutationFn: () => request(`/companies/${cid}/dental/tiss/batches`, {
      method: 'POST',
      body: {
        insurance_id: insuranceId,
        guide_ids: Array.from(selectedGuides),
        reference_month: referenceMonth,
      },
    }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['tiss-batches', cid] });
      qc.invalidateQueries({ queryKey: ['tiss-guides', cid] });
      Alert.alert(
        'Lote criado',
        `Lote ${data.batch.batch_number} gerado com ${data.total_guias} guias. XML pronto pra download.`
      );
      onClose();
    },
    onError: (err: any) => Alert.alert('Erro', err?.body?.error || 'Nao foi possivel gerar o lote.'),
  });

  function toggle(id: string) {
    const next = new Set(selectedGuides);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedGuides(next);
  }

  const guides = guidesData?.guides || [];
  const insurances = insuranceData?.insurance || [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.modal}>
        <View style={s.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Icon name="x" size={20} color="#94A3B8" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Novo lote</Text>
            <Text style={s.headerSub}>{selectedGuides.size} guias selecionadas</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 80 }}>
          <Text style={s.label}>Convenio *</Text>
          {insurances.map(i => (
            <Pressable
              key={i.id}
              onPress={() => { setInsuranceId(i.id); setSelectedGuides(new Set()); }}
              style={[s.card, insuranceId === i.id && s.cardSelected]}
            >
              <Text style={s.cardTitle}>{i.name}</Text>
            </Pressable>
          ))}

          <Text style={s.label}>Mes de referencia *</Text>
          <TextInput
            value={referenceMonth}
            onChangeText={setReferenceMonth}
            style={s.input}
            placeholder="YYYY-MM"
            placeholderTextColor="#475569"
          />

          {insuranceId && (
            <>
              <Text style={[s.label, { marginTop: 16 }]}>
                Guias disponiveis ({guides.length})
              </Text>
              {guides.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptySub}>
                    Nenhuma guia em rascunho/autorizada/pendente sem lote para este convenio.
                  </Text>
                </View>
              ) : guides.map(g => {
                const checked = selectedGuides.has(g.id);
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => toggle(g.id)}
                    style={[s.card, checked && s.cardSelected]}
                  >
                    <View style={[s.checkbox, checked && s.checkboxOn]}>
                      {checked && <Icon name="check" size={10} color="#fff" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>{g.guide_number}</Text>
                      <Text style={s.cardSub}>
                        {g.patient_full_name || g.patient_name} • R$ {formatBRL(g.total_value)}
                      </Text>
                      <Text style={s.cardMeta}>
                        {GUIDE_TYPE_LABELS[g.guide_type]} • {formatDateBR(g.service_date)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </>
          )}

          <Pressable
            onPress={() => createMut.mutate()}
            disabled={!insuranceId || selectedGuides.size === 0 || createMut.isPending}
            style={[
              s.btn, s.btnPrimary, { marginTop: 20 },
              (!insuranceId || selectedGuides.size === 0) && { opacity: 0.5 },
            ]}
          >
            {createMut.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.btnPrimaryText}>
                  Gerar XML ({selectedGuides.size} guias)
                </Text>}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────
// STYLES
// ────────────────────────────────────────────────────────

const s = StyleSheet.create({
  modal: { flex: 1, backgroundColor: '#0F172A' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 14 : 22,
    paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  headerSub: { color: '#94A3B8', fontSize: 11, marginTop: 1 },

  // Tabs
  tabs: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1E293B',
    paddingHorizontal: 14, gap: 14,
  },
  tab: { paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#a78bfa' },
  tabText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#a78bfa' },

  // Cards / lista
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1E293B', borderRadius: 10, padding: 12,
    marginBottom: 8, borderWidth: 0.5, borderColor: '#334155',
  },
  cardSelected: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderColor: 'rgba(167,139,250,0.5)',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },
  cardSub: { color: '#CBD5E1', fontSize: 12, marginTop: 2 },
  cardMeta: { color: '#94A3B8', fontSize: 11, marginTop: 2 },

  // Badge
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  inactiveBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
    backgroundColor: 'rgba(148,163,184,0.2)',
  },
  inactiveText: { color: '#94A3B8', fontSize: 9, fontWeight: '700' },

  // Filtros / chips
  filtersRow: { padding: 12, paddingBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
    backgroundColor: '#1E293B', borderWidth: 0.5, borderColor: '#334155',
    marginRight: 6,
  },
  chipActive: { backgroundColor: '#7c3aed', borderColor: '#a78bfa' },
  chipText: { color: '#CBD5E1', fontSize: 11, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  // Empty
  empty: { padding: 32, alignItems: 'center', gap: 8 },
  emptyTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  emptySub: { color: '#94A3B8', fontSize: 12, textAlign: 'center', maxWidth: 320, lineHeight: 18 },

  // Form
  label: {
    color: '#a78bfa', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginTop: 14, marginBottom: 6,
  },
  helpSm: { color: '#64748B', fontSize: 11, marginBottom: 6, lineHeight: 16 },
  help: { color: '#94A3B8', fontSize: 12, marginBottom: 12, lineHeight: 18 },
  input: {
    backgroundColor: '#1E293B', borderRadius: 8, padding: 10,
    borderWidth: 0.5, borderColor: '#334155',
    color: '#E2E8F0', fontSize: 13, marginBottom: 6,
  } as any,

  // Actions
  actionsRow: { flexDirection: 'row', gap: 8, padding: 12 },
  btn: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
  },
  btnPrimary: { backgroundColor: '#7c3aed' },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnGhost: {
    backgroundColor: '#1E293B', borderWidth: 0.5, borderColor: '#334155',
  },
  btnGhostText: { color: '#a78bfa', fontSize: 13, fontWeight: '600' },

  btnSm: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  btnSmGhost: {
    backgroundColor: 'rgba(167,139,250,0.1)',
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)',
  },
  btnSmGhostText: { color: '#a78bfa', fontSize: 11, fontWeight: '600' },

  // Checkbox (lista de selecao)
  checkbox: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 1.5, borderColor: '#475569',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#7c3aed', borderColor: '#a78bfa' },

  // Sheets / modals
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '92%', borderWidth: 1, borderColor: '#1E293B',
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  sheetTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', flex: 1 },
});

export default TissDashboard;
