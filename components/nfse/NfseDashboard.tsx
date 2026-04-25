// ============================================================
// AURA. — W2-03 F4: NfseDashboard.tsx (cross-vertical)
//
// Componente full-screen pra gestao de NFS-e. Funciona em
// QUALQUER vertical (odonto, barber, food, estetica, pet).
//
// 3 modos via maquina de estados interna:
//   list     -> lista de NFS-e + filtros + botao "Emitir"
//   emit     -> formulario de emissao com pre-fill do paciente
//   config   -> setup wizard (provider + credenciais + dados fiscais)
//
// Estado especial:
//   needsConfig -> renderiza tela de boas-vindas com CTA pra config
// ============================================================

import { useState, useEffect } from 'react';
import {
  Modal, View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, ActivityIndicator, Platform, Alert, Linking,
  KeyboardAvoidingView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { Icon } from '@/components/Icon';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface NfseConfig {
  id?: string;
  provider: 'nuvem_fiscal' | 'norte_notas' | 'mock';
  ambiente: 'producao' | 'homologacao';
  inscricao_municipal?: string;
  regime_tributario?: string;
  regime_especial?: string;
  optante_simples_nacional: boolean;
  default_service_code?: string;
  default_cnae?: string;
  default_iss_rate?: number;
  serie?: string;
  next_rps_number?: number;
  is_active: boolean;
  has_api_key?: boolean;
  has_certificate?: boolean;
}

interface Nfse {
  id: string;
  rps_number: number;
  rps_serie: string;
  nfse_number?: string;
  verification_code?: string;
  status: 'pendente' | 'processando' | 'autorizada' | 'rejeitada' | 'cancelada';
  rejection_reason?: string;
  recipient_name: string;
  recipient_doc?: string;
  recipient_type: 'pf' | 'pj';
  service_description: string;
  service_amount: number;
  iss_value: number;
  iss_rate: number;
  net_amount?: number;
  issued_at?: string;
  pdf_url?: string;
  xml_url?: string;
  provider?: string;
  customer_full_name?: string;
  customer_name?: string;
  source_type?: string;
  created_at: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Pre-fill do tomador ao emitir (ex: abrindo do PatientHub) */
  initialRecipient?: {
    customer_id?: string;
    name: string;
    doc?: string;
    email?: string;
    phone?: string;
    type?: 'pf' | 'pj';
  };
  /** Pre-fill do servico (ex: emitindo a partir de pagamento de plano) */
  initialService?: {
    description: string;
    amount: number;
    payment_id?: string;
    treatment_plan_id?: string;
    appointment_id?: string;
    source_type?: string;
  };
}

// ─────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  pendente:    { bg: 'rgba(148,163,184,0.15)', fg: '#94A3B8', label: 'Pendente' },
  processando: { bg: 'rgba(99,102,241,0.15)',  fg: '#6366F1', label: 'Processando' },
  autorizada:  { bg: 'rgba(16,185,129,0.15)',  fg: '#10B981', label: 'Autorizada' },
  rejeitada:   { bg: 'rgba(239,68,68,0.15)',   fg: '#EF4444', label: 'Rejeitada' },
  cancelada:   { bg: 'rgba(148,163,184,0.15)', fg: '#94A3B8', label: 'Cancelada' },
};

const PROVIDER_LABELS: Record<string, string> = {
  nuvem_fiscal: 'Nuvem Fiscal',
  norte_notas:  'Norte Notas',
  mock:         'Mock (teste)',
};

function formatBRL(v: number | string | null | undefined): string {
  const n = parseFloat(String(v || 0)) || 0;
  return n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d),)/g, '.');
}

function formatDateBR(iso?: string | null): string {
  if (!iso) return '\u2014';
  try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return '\u2014'; }
}

function maskCpfCnpj(doc: string, type: 'pf' | 'pj'): string {
  const digits = doc.replace(/\D/g, '');
  if (type === 'pf') {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2}).*/, '$1.$2.$3-$4');
  }
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
}

// ═════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════

export function NfseDashboard({ visible, onClose, initialRecipient, initialService }: Props) {
  const cid = useAuthStore().company?.id;
  const [mode, setMode] = useState<'list' | 'emit' | 'config'>('list');

  // Reset ao fechar
  useEffect(() => {
    if (!visible) {
      setMode(initialService ? 'emit' : 'list');
    } else if (initialService) {
      setMode('emit');
    }
  }, [visible, initialService]);

  if (!cid) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.modal}>
        <Header
          title={mode === 'emit' ? 'Emitir NFS-e' : mode === 'config' ? 'Config NFS-e' : 'Notas Fiscais'}
          subtitle={mode === 'list' ? 'Gestao de NFS-e' : undefined}
          onBack={mode !== 'list' ? () => setMode('list') : undefined}
          onClose={onClose}
        />

        {mode === 'list' && (
          <ListMode
            cid={cid}
            onEmit={() => setMode('emit')}
            onConfig={() => setMode('config')}
          />
        )}
        {mode === 'emit' && (
          <EmitMode
            cid={cid}
            initialRecipient={initialRecipient}
            initialService={initialService}
            onSuccess={() => setMode('list')}
            onConfig={() => setMode('config')}
          />
        )}
        {mode === 'config' && (
          <ConfigMode cid={cid} onDone={() => setMode('list')} />
        )}
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────
// Header reusavel
// ─────────────────────────────────────────────────────────

function Header({ title, subtitle, onBack, onClose }: {
  title: string; subtitle?: string; onBack?: () => void; onClose: () => void;
}) {
  return (
    <View style={s.header}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={10}>
          <Icon name="arrow_left" size={20} color="#a78bfa" />
        </Pressable>
      ) : (
        <Pressable onPress={onClose} hitSlop={10}>
          <Icon name="x" size={20} color="#94A3B8" />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <Text style={s.headerTitle}>{title}</Text>
        {subtitle && <Text style={s.headerSub}>{subtitle}</Text>}
      </View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════
// MODE 1: LIST
// ═════════════════════════════════════════════════════════

function ListMode({ cid, onEmit, onConfig }: {
  cid: string; onEmit: () => void; onConfig: () => void;
}) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: configData } = useQuery({
    queryKey: ['nfse-config', cid],
    queryFn: () => request<{ config: NfseConfig | null; has_config: boolean }>(`/companies/${cid}/nfse/config`),
    enabled: !!cid,
  });

  const config = configData?.config;
  const hasConfig = configData?.has_config && config?.is_active;

  const params = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
  const { data, isLoading } = useQuery({
    queryKey: ['nfse-list', cid, statusFilter],
    queryFn: () => request<{ nfse: Nfse[]; stats: any[] }>(`/companies/${cid}/nfse${params}`),
    enabled: !!cid && !!hasConfig,
  });

  const refreshMut = useMutation({
    mutationFn: (nid: string) => request(`/companies/${cid}/nfse/${nid}/refresh`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nfse-list', cid] }),
  });

  const cancelMut = useMutation({
    mutationFn: (p: { nid: string; reason: string }) =>
      request(`/companies/${cid}/nfse/${p.nid}/cancel`, {
        method: 'POST', body: { reason: p.reason },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nfse-list', cid] });
      Alert.alert('Cancelada', 'NFS-e cancelada com sucesso.');
    },
    onError: (err: any) => Alert.alert('Erro', err?.body?.error || 'Nao foi possivel cancelar.'),
  });

  function handleCancel(nfse: Nfse) {
    Alert.prompt(
      'Cancelar NFS-e',
      'Digite o motivo do cancelamento (minimo 15 caracteres):',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar nota', style: 'destructive',
          onPress: (reason) => {
            if (!reason || reason.length < 15) {
              Alert.alert('Erro', 'Motivo precisa ter no minimo 15 caracteres.');
              return;
            }
            cancelMut.mutate({ nid: nfse.id, reason });
          },
        },
      ],
      'plain-text'
    );
  }

  // Setup needed
  if (!hasConfig) {
    return (
      <View style={s.setupNeeded}>
        <View style={s.heroIcon}>
          <Icon name="file_text" size={36} color="#a78bfa" />
        </View>
        <Text style={s.heroTitle}>Configure NFS-e</Text>
        <Text style={s.heroSub}>
          Para emitir Notas Fiscais de Servico voce precisa configurar o provider
          e os dados fiscais da sua empresa.
        </Text>
        <View style={s.featureCard}>
          <View style={s.featureRow}>
            <Icon name="check" size={14} color="#10B981" />
            <Text style={s.featureText}>Nuvem Fiscal: cobertura nacional</Text>
          </View>
          <View style={s.featureRow}>
            <Icon name="check" size={14} color="#10B981" />
            <Text style={s.featureText}>Modo homologacao gratuito pra testar</Text>
          </View>
          <View style={s.featureRow}>
            <Icon name="check" size={14} color="#10B981" />
            <Text style={s.featureText}>Mock: emite NFS-e simuladas pra dev</Text>
          </View>
        </View>
        <Pressable onPress={onConfig} style={s.btnPrimary}>
          <Icon name="settings" size={14} color="#fff" />
          <Text style={s.btnPrimaryText}>Configurar agora</Text>
        </Pressable>
      </View>
    );
  }

  const items = data?.nfse || [];

  return (
    <View style={{ flex: 1 }}>
      {/* Filtros */}
      <View style={s.filtersBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['all', 'pendente', 'processando', 'autorizada', 'rejeitada', 'cancelada'].map(st => (
            <Pressable
              key={st}
              onPress={() => setStatusFilter(st)}
              style={[s.chip, statusFilter === st && s.chipActive]}
            >
              <Text style={[s.chipText, statusFilter === st && s.chipTextActive]}>
                {st === 'all' ? 'Todas' : STATUS_COLORS[st]?.label || st}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Actions */}
      <View style={s.actionsRow}>
        <Pressable onPress={onEmit} style={[s.btn, s.btnPrimary, { flex: 1 }]}>
          <Icon name="plus" size={14} color="#fff" />
          <Text style={s.btnPrimaryText}>Emitir NFS-e</Text>
        </Pressable>
        <Pressable onPress={onConfig} style={[s.btn, s.btnGhost]}>
          <Icon name="settings" size={14} color="#a78bfa" />
        </Pressable>
      </View>

      {/* Lista */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingTop: 0 }}>
        {isLoading ? (
          <ActivityIndicator color="#a78bfa" style={{ marginTop: 24 }} />
        ) : items.length === 0 ? (
          <View style={s.empty}>
            <Icon name="file_text" size={32} color="#475569" />
            <Text style={s.emptyTitle}>Nenhuma NFS-e emitida</Text>
            <Text style={s.emptySub}>Clique em "Emitir NFS-e" pra comecar.</Text>
          </View>
        ) : items.map(n => (
          <View key={n.id} style={s.card}>
            <View style={{ flex: 1 }}>
              <View style={s.cardRow}>
                <Text style={s.cardTitle}>
                  {n.nfse_number ? `NFS-e ${n.nfse_number}` : `RPS ${n.rps_serie}-${n.rps_number}`}
                </Text>
                <View style={[s.badge, { backgroundColor: STATUS_COLORS[n.status]?.bg }]}>
                  <Text style={[s.badgeText, { color: STATUS_COLORS[n.status]?.fg }]}>
                    {STATUS_COLORS[n.status]?.label}
                  </Text>
                </View>
              </View>
              <Text style={s.cardSub} numberOfLines={1}>
                {n.recipient_name}
                {n.recipient_doc && ` \u2022 ${maskCpfCnpj(n.recipient_doc, n.recipient_type)}`}
              </Text>
              <Text style={s.cardMeta} numberOfLines={2}>{n.service_description}</Text>
              <Text style={s.cardMeta}>
                R$ {formatBRL(n.service_amount)} \u2022 ISS R$ {formatBRL(n.iss_value)} ({n.iss_rate}%)
              </Text>
              {n.issued_at && (
                <Text style={s.cardMeta}>Emitida em {formatDateBR(n.issued_at)}</Text>
              )}
              {n.rejection_reason && (
                <Text style={[s.cardMeta, { color: '#EF4444' }]} numberOfLines={3}>
                  {n.rejection_reason}
                </Text>
              )}

              {/* Actions per row */}
              <View style={[s.actionsRow, { marginTop: 8, padding: 0 }]}>
                {n.pdf_url && (
                  <Pressable
                    onPress={() => Linking.openURL(n.pdf_url!)}
                    style={[s.btnSm, s.btnSmGhost]}
                  >
                    <Icon name="download" size={11} color="#a78bfa" />
                    <Text style={s.btnSmGhostText}>PDF</Text>
                  </Pressable>
                )}
                {n.xml_url && (
                  <Pressable
                    onPress={() => Linking.openURL(n.xml_url!)}
                    style={[s.btnSm, s.btnSmGhost]}
                  >
                    <Icon name="download" size={11} color="#06B6D4" />
                    <Text style={[s.btnSmGhostText, { color: '#06B6D4' }]}>XML</Text>
                  </Pressable>
                )}
                {(n.status === 'pendente' || n.status === 'processando' || n.status === 'rejeitada') && (
                  <Pressable
                    onPress={() => refreshMut.mutate(n.id)}
                    style={[s.btnSm, s.btnSmGhost]}
                  >
                    <Icon name="refresh" size={11} color="#10B981" />
                    <Text style={[s.btnSmGhostText, { color: '#10B981' }]}>Atualizar</Text>
                  </Pressable>
                )}
                {n.status === 'autorizada' && (
                  <Pressable
                    onPress={() => handleCancel(n)}
                    style={[s.btnSm, s.btnSmGhost]}
                  >
                    <Icon name="x" size={11} color="#EF4444" />
                    <Text style={[s.btnSmGhostText, { color: '#EF4444' }]}>Cancelar</Text>
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

// ═════════════════════════════════════════════════════════
// MODE 2: EMIT
// ═════════════════════════════════════════════════════════

function EmitMode({ cid, initialRecipient, initialService, onSuccess, onConfig }: {
  cid: string;
  initialRecipient?: Props['initialRecipient'];
  initialService?: Props['initialService'];
  onSuccess: () => void;
  onConfig: () => void;
}) {
  const qc = useQueryClient();

  // Tomador
  const [recipientName, setRecipientName] = useState(initialRecipient?.name || '');
  const [recipientDoc, setRecipientDoc] = useState(initialRecipient?.doc || '');
  const [recipientType, setRecipientType] = useState<'pf' | 'pj'>(initialRecipient?.type || 'pf');
  const [recipientEmail, setRecipientEmail] = useState(initialRecipient?.email || '');

  // Servico
  const [description, setDescription] = useState(initialService?.description || '');
  const [amount, setAmount] = useState(String(initialService?.amount || ''));
  const [issRetained, setIssRetained] = useState(false);

  const { data: configData } = useQuery({
    queryKey: ['nfse-config', cid],
    queryFn: () => request<{ config: NfseConfig | null }>(`/companies/${cid}/nfse/config`),
    enabled: !!cid,
  });
  const config = configData?.config;

  const emitMut = useMutation({
    mutationFn: () => {
      const body: any = {
        recipient_name: recipientName.trim(),
        recipient_doc: recipientDoc.replace(/\D/g, ''),
        recipient_type: recipientType,
        recipient_email: recipientEmail.trim() || undefined,
        service_description: description.trim(),
        service_amount: parseFloat(amount.replace(',', '.')),
        iss_retained: issRetained,
      };
      if (initialService?.payment_id) body.payment_id = initialService.payment_id;
      if (initialService?.treatment_plan_id) body.treatment_plan_id = initialService.treatment_plan_id;
      if (initialService?.appointment_id) body.appointment_id = initialService.appointment_id;
      if (initialService?.source_type) body.source_type = initialService.source_type;
      if (initialRecipient?.customer_id) body.customer_id = initialRecipient.customer_id;
      return request<{ nfse_id: string; status: string; nfse_number?: string }>(
        `/companies/${cid}/nfse`, { method: 'POST', body }
      );
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['nfse-list', cid] });
      const msg = data.status === 'autorizada' && data.nfse_number
        ? `NFS-e ${data.nfse_number} emitida com sucesso!`
        : `NFS-e em status: ${data.status}. Atualize na lista.`;
      Alert.alert('Sucesso', msg);
      onSuccess();
    },
    onError: (err: any) => {
      const msg = err?.body?.error || 'Nao foi possivel emitir.';
      Alert.alert('Erro ao emitir', msg);
    },
  });

  const finalAmount = parseFloat(amount.replace(',', '.')) || 0;
  const issRate = config?.default_iss_rate || 2;
  const issValue = (finalAmount * issRate) / 100;

  const docDigits = recipientDoc.replace(/\D/g, '');
  const docValid = recipientType === 'pf' ? docDigits.length === 11 : docDigits.length === 14;

  const canSubmit = !!recipientName && docValid && !!description && finalAmount > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 80 }}>
        {/* Provider info */}
        {config && (
          <View style={s.infoBanner}>
            <Icon name="info" size={12} color="#a78bfa" />
            <Text style={s.infoBannerText}>
              {PROVIDER_LABELS[config.provider]} \u2022 {config.ambiente === 'producao' ? 'Producao' : 'Homologacao'}
            </Text>
            <Pressable onPress={onConfig} hitSlop={10}>
              <Icon name="settings" size={12} color="#a78bfa" />
            </Pressable>
          </View>
        )}

        {/* TOMADOR */}
        <Text style={s.section}>Tomador (cliente)</Text>

        <Text style={s.label}>Tipo</Text>
        <View style={s.chipRow}>
          {(['pf', 'pj'] as const).map(t => (
            <Pressable
              key={t}
              onPress={() => setRecipientType(t)}
              style={[s.chip, recipientType === t && s.chipActive]}
            >
              <Text style={[s.chipText, recipientType === t && s.chipTextActive]}>
                {t === 'pf' ? 'Pessoa Fisica' : 'Pessoa Juridica'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>Nome / Razao Social *</Text>
        <TextInput
          value={recipientName}
          onChangeText={setRecipientName}
          style={s.input}
          placeholder={recipientType === 'pf' ? 'Nome completo' : 'Razao social'}
          placeholderTextColor="#475569"
        />

        <Text style={s.label}>{recipientType === 'pf' ? 'CPF *' : 'CNPJ *'}</Text>
        <TextInput
          value={recipientDoc}
          onChangeText={setRecipientDoc}
          style={s.input}
          placeholder={recipientType === 'pf' ? '000.000.000-00' : '00.000.000/0000-00'}
          placeholderTextColor="#475569"
          keyboardType="numeric"
        />
        {recipientDoc && !docValid && (
          <Text style={s.helpErr}>
            {recipientType === 'pf' ? 'CPF deve ter 11 digitos' : 'CNPJ deve ter 14 digitos'}
          </Text>
        )}

        <Text style={s.label}>Email (opcional)</Text>
        <TextInput
          value={recipientEmail}
          onChangeText={setRecipientEmail}
          style={s.input}
          placeholder="cliente@email.com"
          placeholderTextColor="#475569"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {/* SERVICO */}
        <Text style={s.section}>Servico</Text>

        <Text style={s.label}>Descricao do servico *</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          style={[s.input, { minHeight: 70 }]}
          placeholder="Ex: Consulta odontologica de avaliacao + radiografia panoramica"
          placeholderTextColor="#475569"
          multiline
        />

        <Text style={s.label}>Valor (R$) *</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          style={s.input}
          placeholder="0,00"
          placeholderTextColor="#475569"
          keyboardType="decimal-pad"
        />

        {/* RESUMO TRIBUTARIO */}
        {finalAmount > 0 && config && (
          <View style={s.summaryBox}>
            <Text style={s.summaryTitle}>Resumo</Text>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Valor do servico</Text>
              <Text style={s.summaryValue}>R$ {formatBRL(finalAmount)}</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>ISS ({issRate}%)</Text>
              <Text style={s.summaryValue}>R$ {formatBRL(issValue)}</Text>
            </View>
            {issRetained && (
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>ISS retido pelo tomador</Text>
                <Text style={[s.summaryValue, { color: '#F59E0B' }]}>Sim</Text>
              </View>
            )}
            <View style={[s.summaryRow, { borderTopWidth: 0.5, borderTopColor: '#334155', paddingTop: 6, marginTop: 4 }]}>
              <Text style={[s.summaryLabel, { fontWeight: '700', color: '#E2E8F0' }]}>Liquido</Text>
              <Text style={[s.summaryValue, { fontWeight: '700', color: '#10B981' }]}>
                R$ {formatBRL(issRetained ? finalAmount - issValue : finalAmount)}
              </Text>
            </View>
          </View>
        )}

        <Pressable
          onPress={() => setIssRetained(!issRetained)}
          style={s.toggleRow}
        >
          <View style={[s.checkbox, issRetained && s.checkboxOn]}>
            {issRetained && <Icon name="check" size={10} color="#fff" />}
          </View>
          <Text style={s.toggleLabel}>ISS retido pelo tomador</Text>
        </Pressable>
        <Text style={s.helpSm}>
          Marque se o cliente (PJ) ira reter o ISS no pagamento. Geralmente fica desmarcado.
        </Text>

        {/* SUBMIT */}
        <Pressable
          onPress={() => emitMut.mutate()}
          disabled={!canSubmit || emitMut.isPending}
          style={[s.btnPrimary, { marginTop: 20 }, !canSubmit && { opacity: 0.5 }]}
        >
          {emitMut.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Icon name="check" size={14} color="#fff" />
              <Text style={s.btnPrimaryText}>Emitir NFS-e</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ═════════════════════════════════════════════════════════
// MODE 3: CONFIG
// ═════════════════════════════════════════════════════════

function ConfigMode({ cid, onDone }: { cid: string; onDone: () => void }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['nfse-config', cid],
    queryFn: () => request<{ config: NfseConfig | null; has_config: boolean }>(`/companies/${cid}/nfse/config`),
    enabled: !!cid,
  });

  const [provider, setProvider] = useState<'nuvem_fiscal' | 'norte_notas' | 'mock'>('nuvem_fiscal');
  const [ambiente, setAmbiente] = useState<'producao' | 'homologacao'>('homologacao');
  const [apiKey, setApiKey] = useState('');
  const [im, setIm] = useState('');
  const [serviceCode, setServiceCode] = useState('');
  const [issRate, setIssRate] = useState('2.00');
  const [optanteSimples, setOptanteSimples] = useState(true);
  const [isActive, setIsActive] = useState(false);

  // Hidrata estado quando dados chegam
  useEffect(() => {
    if (!data?.config) return;
    const c = data.config;
    setProvider(c.provider);
    setAmbiente(c.ambiente);
    setIm(c.inscricao_municipal || '');
    setServiceCode(c.default_service_code || '');
    setIssRate(String(c.default_iss_rate || '2.00'));
    setOptanteSimples(c.optante_simples_nacional);
    setIsActive(c.is_active);
  }, [data?.config]);

  const saveMut = useMutation({
    mutationFn: () => {
      const body: any = {
        provider,
        ambiente,
        inscricao_municipal: im.trim() || undefined,
        default_service_code: serviceCode.trim() || undefined,
        default_iss_rate: parseFloat(issRate.replace(',', '.')) || 2.00,
        optante_simples_nacional: optanteSimples,
        is_active: isActive,
      };
      if (apiKey.trim()) body.api_key = apiKey.trim();
      return request(`/companies/${cid}/nfse/config`, { method: 'PUT', body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nfse-config', cid] });
      Alert.alert('Salvo', 'Config NFS-e atualizada.');
      onDone();
    },
    onError: (err: any) => Alert.alert('Erro', err?.body?.error || 'Nao foi possivel salvar.'),
  });

  if (isLoading) {
    return <ActivityIndicator color="#a78bfa" style={{ marginTop: 40 }} />;
  }

  const config = data?.config;
  const hasApiKey = config?.has_api_key;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 80 }}>
      {/* Provider */}
      <Text style={s.section}>Provider</Text>
      <View style={s.chipRow}>
        {(['nuvem_fiscal', 'mock'] as const).map(p => (
          <Pressable
            key={p}
            onPress={() => setProvider(p)}
            style={[s.chip, provider === p && s.chipActive]}
          >
            <Text style={[s.chipText, provider === p && s.chipTextActive]}>
              {PROVIDER_LABELS[p]}
            </Text>
          </Pressable>
        ))}
        {/* Norte Notas escondido enquanto for placeholder */}
      </View>
      <Text style={s.helpSm}>
        Mock = simula NFS-e sem chamar API real. Use em testes. Nuvem Fiscal = provider real.
      </Text>

      {/* Ambiente */}
      <Text style={s.label}>Ambiente</Text>
      <View style={s.chipRow}>
        {(['homologacao', 'producao'] as const).map(a => (
          <Pressable
            key={a}
            onPress={() => setAmbiente(a)}
            style={[s.chip, ambiente === a && s.chipActive]}
          >
            <Text style={[s.chipText, ambiente === a && s.chipTextActive]}>
              {a === 'homologacao' ? 'Homologacao' : 'Producao'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* API Key */}
      {provider !== 'mock' && (
        <>
          <Text style={s.label}>
            API Key {hasApiKey ? '(ja configurada)' : '*'}
          </Text>
          <TextInput
            value={apiKey}
            onChangeText={setApiKey}
            style={s.input}
            placeholder={hasApiKey ? 'Deixe em branco pra manter atual' : 'Cole sua API key'}
            placeholderTextColor="#475569"
            secureTextEntry
            autoCapitalize="none"
          />
          <Text style={s.helpSm}>
            Sua chave fica cifrada no banco com AES-256-GCM. Nunca exibimos de volta.
          </Text>
        </>
      )}

      {/* Dados fiscais */}
      <Text style={s.section}>Dados fiscais</Text>

      <Text style={s.label}>Inscricao Municipal *</Text>
      <TextInput
        value={im}
        onChangeText={setIm}
        style={s.input}
        placeholder="Ex: 1234567"
        placeholderTextColor="#475569"
      />
      <Text style={s.helpSm}>
        IM da prefeitura onde a clinica esta cadastrada. Sem IM, nao da pra emitir.
      </Text>

      <Text style={s.label}>Codigo de servico padrao</Text>
      <TextInput
        value={serviceCode}
        onChangeText={setServiceCode}
        style={s.input}
        placeholder="Ex: 0401 (odonto)"
        placeholderTextColor="#475569"
      />
      <Text style={s.helpSm}>
        Codigo da Lista de Servicos (LC 116/2003) ou municipal. Pra Odonto: 04.13 ou 0401.
      </Text>

      <Text style={s.label}>Aliquota ISS padrao (%)</Text>
      <TextInput
        value={issRate}
        onChangeText={setIssRate}
        style={s.input}
        placeholder="2.00"
        placeholderTextColor="#475569"
        keyboardType="decimal-pad"
      />
      <Text style={s.helpSm}>
        Em Jacarei, ISS de servico de saude e 2%. Confirme com sua prefeitura.
      </Text>

      <Pressable
        onPress={() => setOptanteSimples(!optanteSimples)}
        style={s.toggleRow}
      >
        <View style={[s.checkbox, optanteSimples && s.checkboxOn]}>
          {optanteSimples && <Icon name="check" size={10} color="#fff" />}
        </View>
        <Text style={s.toggleLabel}>Optante do Simples Nacional</Text>
      </Pressable>

      <Pressable
        onPress={() => setIsActive(!isActive)}
        style={s.toggleRow}
      >
        <View style={[s.checkbox, isActive && s.checkboxOn]}>
          {isActive && <Icon name="check" size={10} color="#fff" />}
        </View>
        <Text style={s.toggleLabel}>NFS-e ativa (permite emitir)</Text>
      </Pressable>

      <Pressable
        onPress={() => saveMut.mutate()}
        disabled={saveMut.isPending}
        style={[s.btnPrimary, { marginTop: 20 }]}
      >
        {saveMut.isPending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Icon name="check" size={14} color="#fff" />
            <Text style={s.btnPrimaryText}>Salvar configuracao</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

// ═════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════

const s = StyleSheet.create({
  modal: { flex: 1, backgroundColor: '#0F172A' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 14 : 22,
    paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  headerSub: { color: '#94A3B8', fontSize: 11, marginTop: 1 },

  // Setup needed
  setupNeeded: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 14 },
  heroIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(167,139,250,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.4)',
    marginBottom: 4,
  },
  heroTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  heroSub: { color: '#94A3B8', fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 360 },

  featureCard: {
    backgroundColor: '#1E293B', borderRadius: 12, padding: 14, gap: 8,
    borderWidth: 0.5, borderColor: '#334155', width: '100%', maxWidth: 380,
  },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  featureText: { color: '#CBD5E1', fontSize: 12, flex: 1, lineHeight: 18 },

  // Filtros
  filtersBar: { padding: 12, paddingBottom: 8 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
    backgroundColor: '#1E293B', borderWidth: 0.5, borderColor: '#334155',
    marginRight: 6,
  },
  chipActive: { backgroundColor: '#7c3aed', borderColor: '#a78bfa' },
  chipText: { color: '#CBD5E1', fontSize: 11, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },

  // Cards
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#1E293B', borderRadius: 10, padding: 12,
    marginBottom: 8, borderWidth: 0.5, borderColor: '#334155',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },
  cardSub: { color: '#CBD5E1', fontSize: 12, marginTop: 4 },
  cardMeta: { color: '#94A3B8', fontSize: 11, marginTop: 2 },

  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },

  // Empty
  empty: { padding: 32, alignItems: 'center', gap: 8 },
  emptyTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  emptySub: { color: '#94A3B8', fontSize: 12, textAlign: 'center' },

  // Form
  section: {
    color: '#a78bfa', fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: 18, marginBottom: 8,
  },
  label: {
    color: '#E2E8F0', fontSize: 11, fontWeight: '600',
    marginTop: 12, marginBottom: 4,
  },
  helpSm: { color: '#64748B', fontSize: 11, marginTop: 4, lineHeight: 16 },
  helpErr: { color: '#EF4444', fontSize: 11, marginTop: 4 },
  input: {
    backgroundColor: '#1E293B', borderRadius: 8, padding: 10,
    borderWidth: 0.5, borderColor: '#334155',
    color: '#E2E8F0', fontSize: 13,
  } as any,

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10,
  },
  checkbox: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 1.5, borderColor: '#475569',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#7c3aed', borderColor: '#a78bfa' },
  toggleLabel: { color: '#E2E8F0', fontSize: 13 },

  // Summary
  summaryBox: {
    backgroundColor: 'rgba(16,185,129,0.06)',
    borderWidth: 0.5, borderColor: 'rgba(16,185,129,0.2)',
    borderRadius: 10, padding: 12, marginTop: 12, gap: 6,
  },
  summaryTitle: {
    color: '#10B981', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: '#CBD5E1', fontSize: 12 },
  summaryValue: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },

  // Info banner
  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: 'rgba(167,139,250,0.1)',
    borderRadius: 6, marginBottom: 8,
  },
  infoBannerText: { color: '#a78bfa', fontSize: 11, fontWeight: '500', flex: 1 },

  // Actions
  actionsRow: { flexDirection: 'row', gap: 8, padding: 12 },
  btn: {
    paddingVertical: 11, paddingHorizontal: 16, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
  },
  btnPrimary: {
    backgroundColor: '#7c3aed',
    paddingVertical: 11, paddingHorizontal: 16, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
  },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnGhost: {
    backgroundColor: '#1E293B', borderWidth: 0.5, borderColor: '#334155',
    paddingHorizontal: 14,
  },

  btnSm: {
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  btnSmGhost: {
    backgroundColor: 'rgba(167,139,250,0.1)',
    borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)',
  },
  btnSmGhostText: { color: '#a78bfa', fontSize: 11, fontWeight: '600' },
});

export default NfseDashboard;
