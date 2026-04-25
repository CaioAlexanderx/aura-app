// ============================================================
// AURA. — PatientHub (W1-01 + W1-02 + W2-01 portal + W2-04 TCLE + W2-05 IA)
// Drill-down do paciente com 9/9 sub-tabs totalmente wiradas.
//
// Sub-tabs:
//   Dados        - contato, identificacao, WhatsApp 1-click
//   Anamnese     - AnamneseWizard + GET/PUT
//   Odontograma  - OdontogramaSVG + chart GET/POST
//   Periograma   - Periograma + GET/POST + AddPerioExamModal
//   Prontuario   - ProntuarioTimeline filtrado
//   Imagens      - ClinicalImages + GET/POST/DELETE + AddClinicalImageModal (W1-02)
//   Orcamentos   - treatment-plans?customer_id filter
//   Cobrancas    - billing/patient/:pid
//   Fichas       - FichaEspecialidade + GET/POST + AddSpecialtyFormModal
//
// Header actions:
//   IA     (W2-05) — chat IA com contexto profundo do paciente (Expansao only)
//   TCLE   (W2-04) — coleta termo de consentimento assinado
//   Portal (W2-01) — gera link de portal pra paciente acompanhar
//   Editar         — edita dados do paciente
//   Fechar         — fecha o hub
//
// Renderizado como Modal full-screen sobreposto a OdontoScreen.
// ============================================================

import { useState } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Linking, Platform, Pressable, Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { OdontoSubNav } from '@/components/verticals/odonto/OdontoSubNav';
import { AnamneseWizard, type AnamneseData } from '@/components/verticals/odonto/AnamneseWizard';
import { ClinicalImages } from '@/components/verticals/odonto/ClinicalImages';
import { Periograma } from '@/components/verticals/odonto/Periograma';
import { FichaEspecialidade } from '@/components/verticals/odonto/FichaEspecialidade';
import { OdontogramaSVG } from '@/components/verticals/odonto/OdontogramaSVG';
import { ProntuarioTimeline } from '@/components/verticals/odonto/ProntuarioTimeline';
import { AddPerioExamModal } from '@/components/verticals/odonto/AddPerioExamModal';
import { AddSpecialtyFormModal } from '@/components/verticals/odonto/AddSpecialtyFormModal';
import { AddClinicalImageModal } from '@/components/verticals/odonto/AddClinicalImageModal';
import { PortalShareModal } from '@/components/verticals/odonto/PortalShareModal';
import { ConsentCollectModal } from '@/components/verticals/odonto/ConsentCollectModal';
import { DentalAiChat } from '@/components/verticals/odonto/DentalAiChat';
import type { SubTab } from '@/components/verticals/odonto/sections';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
export interface PatientLite {
  id: string;          // customer_id (D-UNIFY)
  name: string;
  full_name?: string;
  phone?: string | null;
  email?: string | null;
  cpf?: string | null;
  birthday?: string | null;
  notes?: string | null;
  is_patient?: boolean;
}

interface Props {
  visible: boolean;
  patient: PatientLite | null;
  onClose: () => void;
  onEdit?: (patient: PatientLite) => void;
}

// ────────────────────────────────────────────────────────────
// Sub-tabs config
// ────────────────────────────────────────────────────────────
const HUB_TABS: SubTab[] = [
  { id: 'dados',       label: 'Dados',         component: () => null },
  { id: 'anamnese',    label: 'Anamnese',      component: () => null },
  { id: 'odontograma', label: 'Odontograma',   component: () => null },
  { id: 'periograma',  label: 'Periograma',    component: () => null, badge: 'novo' },
  { id: 'prontuario',  label: 'Prontuario',    component: () => null },
  { id: 'imagens',     label: 'Imagens',       component: () => null },
  { id: 'orcamentos',  label: 'Orcamentos',    component: () => null },
  { id: 'cobrancas',   label: 'Cobrancas',     component: () => null },
  { id: 'fichas',      label: 'Fichas',        component: () => null },
];

// ────────────────────────────────────────────────────────────
// Helpers formatacao
// ────────────────────────────────────────────────────────────
function formatBRL(v: number): string {
  if (!isFinite(v)) return '0,00';
  const fixed = v.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${withSep},${decPart}`;
}

function formatDateBR(iso?: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return '—'; }
}

function planStatusBg(status: string): string {
  switch (status) {
    case 'aprovado':
    case 'concluido':     return 'rgba(16,185,129,0.15)';
    case 'recusado':
    case 'cancelado':     return 'rgba(239,68,68,0.15)';
    case 'enviado':
    case 'em_tratamento': return 'rgba(6,182,212,0.15)';
    default:              return 'rgba(148,163,184,0.15)';
  }
}

function planStatusColor(status: string): string {
  switch (status) {
    case 'aprovado':
    case 'concluido':     return '#10B981';
    case 'recusado':
    case 'cancelado':     return '#EF4444';
    case 'enviado':
    case 'em_tratamento': return '#06B6D4';
    default:              return '#94A3B8';
  }
}

function planStatusLabel(status: string): string {
  const map: Record<string, string> = {
    rascunho:      'Rascunho',
    enviado:       'Enviado',
    aprovado:      'Aprovado',
    recusado:      'Recusado',
    em_tratamento: 'Em tratamento',
    concluido:     'Concluido',
    cancelado:     'Cancelado',
  };
  return map[status] || status;
}

// ────────────────────────────────────────────────────────────
// Sub-tab renderers
// ────────────────────────────────────────────────────────────
function DataTab({ patient }: { patient: PatientLite }) {
  const openWhatsApp = () => {
    if (!patient.phone) return;
    const phone = patient.phone.replace(/\D/g, '');
    const url = `https://wa.me/55${phone}`;
    Linking.openURL(url).catch(() => {});
  };

  const Field = ({ label, value }: { label: string; value?: string | null }) => (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.tabContent}>
      <View style={styles.dataSection}>
        <Text style={styles.sectionTitle}>Contato</Text>
        <Field label="Nome completo" value={patient.full_name || patient.name} />
        <Field label="Telefone"      value={patient.phone} />
        <Field label="Email"         value={patient.email} />
        {patient.phone && (
          <TouchableOpacity onPress={openWhatsApp} style={styles.waButton}>
            <Text style={styles.waButtonText}>{'\u{1F4AC}'} Conversar no WhatsApp</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.dataSection}>
        <Text style={styles.sectionTitle}>Identificacao</Text>
        <Field label="CPF"             value={patient.cpf} />
        <Field label="Data nascimento" value={patient.birthday} />
      </View>

      {patient.notes && (
        <View style={styles.dataSection}>
          <Text style={styles.sectionTitle}>Observacoes</Text>
          <Text style={styles.notesText}>{patient.notes}</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ── Anamnese (fase 1) ───────────────────────────────────────
function AnamneseTab({ patient }: { patient: PatientLite }) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dental-anamnesis', cid, patient.id],
    queryFn: () => request(`/companies/${cid}/dental/patients/${patient.id}/anamnesis`),
    enabled: !!cid && !!patient.id,
    staleTime: 60000,
  });

  const saveMut = useMutation({
    mutationFn: (anamnesisData: AnamneseData) =>
      request(`/companies/${cid}/dental/patients/${patient.id}/anamnesis`, {
        method: 'PUT', body: { data: anamnesisData },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dental-anamnesis', cid, patient.id] });
      Alert.alert('Anamnese salva', 'Dados registrados com sucesso.');
    },
    onError: (err: any) => Alert.alert('Erro', err?.message || 'Nao foi possivel salvar a anamnese.'),
  });

  if (isLoading) return <View style={styles.loadingWrap}><ActivityIndicator color="#06B6D4" /></View>;
  if (error) {
    return (
      <View style={styles.placeholderWrap}>
        <Text style={styles.placeholderTitle}>Erro ao carregar</Text>
        <Text style={styles.placeholderMessage}>
          {(error as any)?.message || 'Nao foi possivel carregar a anamnese.'}
        </Text>
      </View>
    );
  }

  const initial = (data as any)?.anamnesis as Partial<AnamneseData> | null;
  const updatedAt = (data as any)?.updated_at;

  return (
    <View style={styles.tabContent}>
      {updatedAt && (
        <View style={styles.infoBadge}>
          <Text style={styles.infoBadgeText}>Ultima atualizacao: {formatDateBR(updatedAt)}</Text>
        </View>
      )}
      <AnamneseWizard initialData={initial || undefined} onComplete={(data) => saveMut.mutate(data)} />
      {saveMut.isPending && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator color="#06B6D4" />
          <Text style={styles.savingText}>Salvando...</Text>
        </View>
      )}
    </View>
  );
}

// ── Odontograma (fase 2) ────────────────────────────────────
function OdontogramaTabContent({ patient }: { patient: PatientLite }) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dental-chart', cid, patient.id],
    queryFn: () => request(`/companies/${cid}/dental/patients/${patient.id}/chart`),
    enabled: !!cid && !!patient.id,
    staleTime: 15000,
  });

  const statusMut = useMutation({
    mutationFn: (p: { tooth: number; status: string }) =>
      request(`/companies/${cid}/dental/patients/${patient.id}/chart`, {
        method: 'POST', body: { tooth_number: p.tooth, status: p.status },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dental-chart', cid, patient.id] }),
    onError: (err: any) => Alert.alert('Erro', err?.message || 'Nao foi possivel atualizar o dente'),
  });

  if (isLoading) return <View style={styles.loadingWrap}><ActivityIndicator color="#06B6D4" /></View>;
  if (error) {
    return (
      <View style={styles.placeholderWrap}>
        <Text style={styles.placeholderTitle}>Erro ao carregar</Text>
        <Text style={styles.placeholderMessage}>
          {(error as any)?.message || 'Nao foi possivel carregar o odontograma.'}
        </Text>
      </View>
    );
  }

  const teethRaw = ((data as any)?.teeth) || [];
  const teeth = teethRaw.map((t: any) => {
    const faces: any = { M: null, D: null, O: null, V: null, L: null };
    (t.faces || []).forEach((f: any) => {
      if (f.face && faces.hasOwnProperty(f.face)) faces[f.face] = f.status || null;
    });
    return {
      number: t.tooth,
      status: (t.faces && t.faces[0]?.status) || 'higido',
      faces,
    };
  });

  return (
    <ScrollView style={styles.tabContent}>
      <OdontogramaSVG
        teeth={teeth}
        onStatusChange={(toothNum: number, status: string) =>
          statusMut.mutate({ tooth: toothNum, status })
        }
      />
    </ScrollView>
  );
}

// ── Periograma (fase 3) ─────────────────────────────────────
function PeriogramaTab({ patient }: { patient: PatientLite }) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['dental-perio', cid, patient.id],
    queryFn: () => request(`/companies/${cid}/dental/patients/${patient.id}/perio`),
    enabled: !!cid && !!patient.id,
    staleTime: 30000,
  });

  if (isLoading) return <View style={styles.loadingWrap}><ActivityIndicator color="#06B6D4" /></View>;
  if (error) {
    return (
      <View style={styles.placeholderWrap}>
        <Text style={styles.placeholderTitle}>Erro ao carregar</Text>
        <Text style={styles.placeholderMessage}>
          {(error as any)?.message || 'Nao foi possivel carregar os exames periodontais.'}
        </Text>
      </View>
    );
  }

  const charts = (((data as any)?.charts) || []).map((c: any) => ({
    id:              c.id,
    exam_date:       c.exam_date,
    measurements:    c.measurements || {},
    bleeding_sites:  c.bleeding_sites || 0,
    total_sites:     c.total_sites || 0,
    bleeding_index:  c.bleeding_index || 0,
    plaque_index:    c.plaque_index || 0,
    diagnosis:       c.diagnosis,
    notes:           c.notes,
  }));

  return (
    <>
      <ScrollView style={styles.tabContent}>
        <Periograma
          charts={charts}
          patientName={patient.full_name || patient.name}
          onAddExam={() => setShowAddModal(true)}
          onViewChart={(chartId) => {
            // TODO(fase 4): abrir modal de detalhe do exame
            console.log('view chart', chartId);
          }}
        />
      </ScrollView>
      <AddPerioExamModal
        visible={showAddModal}
        patientId={patient.id}
        patientName={patient.full_name || patient.name}
        onClose={() => setShowAddModal(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['dental-perio', cid, patient.id] })}
      />
    </>
  );
}

// ── Prontuario (fase 2) ─────────────────────────────────────
function ProntuarioTabContent({ patient }: { patient: PatientLite }) {
  const cid = useAuthStore().company?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ['dental-prescriptions', cid, patient.id],
    queryFn: () => request(`/companies/${cid}/dental/patients/${patient.id}/prescriptions`),
    enabled: !!cid && !!patient.id,
    staleTime: 15000,
  });

  if (isLoading) return <View style={styles.loadingWrap}><ActivityIndicator color="#06B6D4" /></View>;
  if (error) {
    return (
      <View style={styles.placeholderWrap}>
        <Text style={styles.placeholderTitle}>Erro ao carregar</Text>
        <Text style={styles.placeholderMessage}>
          {(error as any)?.message || 'Nao foi possivel carregar o prontuario.'}
        </Text>
      </View>
    );
  }

  const entries = (((data as any)?.prescriptions) || []).map((p: any) => ({
    id:           p.id,
    type:         p.doc_type || 'receituario',
    date:         p.issued_at,
    description:  p.content,
    professional: '',
  }));

  if (!entries.length) {
    return (
      <View style={styles.placeholderWrap}>
        <Text style={styles.placeholderTitle}>Sem registros</Text>
        <Text style={styles.placeholderMessage}>
          Nenhuma prescricao, atestado ou receituario registrado ate o momento.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.tabContent}>
      <ProntuarioTimeline entries={entries} patientName={patient.full_name || patient.name} />
    </ScrollView>
  );
}

// ── Imagens (W1-02 WIRADA) ──────────────────────────────────
function ImagensTab({ patient }: { patient: PatientLite }) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['dental-images', cid, patient.id],
    queryFn: () => request(`/companies/${cid}/dental/patients/${patient.id}/images`),
    enabled: !!cid && !!patient.id,
    staleTime: 30000,
  });

  const deleteMut = useMutation({
    mutationFn: (imageId: string) =>
      request(`/companies/${cid}/dental/images/${imageId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dental-images', cid, patient.id] });
    },
    onError: (err: any) => {
      Alert.alert('Erro', err?.message || 'Nao foi possivel excluir a imagem.');
    },
  });

  if (isLoading) return <View style={styles.loadingWrap}><ActivityIndicator color="#06B6D4" /></View>;
  if (error) {
    return (
      <View style={styles.placeholderWrap}>
        <Text style={styles.placeholderTitle}>Erro ao carregar</Text>
        <Text style={styles.placeholderMessage}>
          {(error as any)?.message || 'Nao foi possivel carregar as imagens.'}
        </Text>
      </View>
    );
  }

  const images = (((data as any)?.images) || []).map((i: any) => ({
    id:            i.id,
    url:           i.url,
    thumbnail_url: i.thumbnail_url || i.url,
    tooth_number:  i.tooth_number,
    image_type:    i.image_type,
    description:   i.description,
    taken_at:      i.taken_at,
    uploaded_at:   i.created_at || i.uploaded_at,
  }));

  function handleImagePress(img: any) {
    // Abre URL no browser/sistema — usuario ve a imagem completa
    Linking.openURL(img.url).catch(() => {
      Alert.alert('Erro', 'Nao foi possivel abrir a imagem.');
    });
  }

  function handleDelete(imageId: string) {
    Alert.alert(
      'Excluir imagem?',
      'Esta acao nao pode ser desfeita. O arquivo sera removido do armazenamento.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => deleteMut.mutate(imageId),
        },
      ]
    );
  }

  return (
    <>
      <ScrollView style={styles.tabContent}>
        <ClinicalImages
          images={images}
          patientName={patient.full_name || patient.name}
          onUpload={() => setShowAddModal(true)}
          onImagePress={handleImagePress}
          onDelete={handleDelete}
        />
      </ScrollView>
      <AddClinicalImageModal
        visible={showAddModal}
        patientId={patient.id}
        patientName={patient.full_name || patient.name}
        onClose={() => setShowAddModal(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['dental-images', cid, patient.id] })}
      />
    </>
  );
}

// ── Orcamentos (fase 2) ─────────────────────────────────────
function OrcamentosTabContent({ patient }: { patient: PatientLite }) {
  const cid = useAuthStore().company?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ['dental-plans-patient', cid, patient.id],
    queryFn: () => request(`/companies/${cid}/dental/treatment-plans?customer_id=${patient.id}`),
    enabled: !!cid && !!patient.id,
    staleTime: 30000,
  });

  if (isLoading) return <View style={styles.loadingWrap}><ActivityIndicator color="#06B6D4" /></View>;
  if (error) {
    return (
      <View style={styles.placeholderWrap}>
        <Text style={styles.placeholderTitle}>Erro ao carregar</Text>
        <Text style={styles.placeholderMessage}>
          {(error as any)?.message || 'Nao foi possivel carregar os orcamentos.'}
        </Text>
      </View>
    );
  }

  const plans = ((data as any)?.plans) || [];

  if (!plans.length) {
    return (
      <View style={styles.placeholderWrap}>
        <Text style={styles.placeholderTitle}>Sem orcamentos</Text>
        <Text style={styles.placeholderMessage}>
          Nenhum orcamento criado ate o momento. Crie um novo pela aba Financeiro {'>'} Orcamentos.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.tabContent}>
      {plans.map((p: any) => {
        const total = parseFloat(p.total) || 0;
        const itemsCount = parseInt(p.items_count) || 0;
        const itemsDone = parseInt(p.items_done) || 0;
        return (
          <View key={p.id} style={styles.planCard}>
            <View style={styles.planCardHeader}>
              <Text style={styles.planNumber}>#{p.plan_number || p.id.slice(0, 8)}</Text>
              <View style={[styles.statusChip, { backgroundColor: planStatusBg(p.status) }]}>
                <Text style={[styles.statusChipText, { color: planStatusColor(p.status) }]}>
                  {planStatusLabel(p.status)}
                </Text>
              </View>
            </View>
            <Text style={styles.planTotal}>R$ {formatBRL(total)}</Text>
            <Text style={styles.planMeta}>
              {itemsCount} procedimento{itemsCount !== 1 ? 's' : ''}
              {itemsCount > 0 && ` • ${itemsDone} concluido${itemsDone !== 1 ? 's' : ''}`}
            </Text>
            <Text style={styles.planDate}>
              Criado em {formatDateBR(p.created_at)}
              {p.valid_until && ` • Validade ${formatDateBR(p.valid_until)}`}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ── Cobrancas (fase 2) ──────────────────────────────────────
function CobrancasTabContent({ patient }: { patient: PatientLite }) {
  const cid = useAuthStore().company?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ['dental-billing-patient', cid, patient.id],
    queryFn: () => request(`/companies/${cid}/dental/billing/patient/${patient.id}`),
    enabled: !!cid && !!patient.id,
    staleTime: 30000,
  });

  if (isLoading) return <View style={styles.loadingWrap}><ActivityIndicator color="#06B6D4" /></View>;
  if (error) {
    return (
      <View style={styles.placeholderWrap}>
        <Text style={styles.placeholderTitle}>Erro ao carregar</Text>
        <Text style={styles.placeholderMessage}>
          {(error as any)?.message || 'Nao foi possivel carregar as cobrancas.'}
        </Text>
      </View>
    );
  }

  const installments = ((data as any)?.installments) || [];
  const totalPending = parseFloat((data as any)?.total_pending) || 0;
  const totalOverdue = parseFloat((data as any)?.total_overdue) || 0;
  const totalPaid    = parseFloat((data as any)?.total_paid)    || 0;

  if (!installments.length) {
    return (
      <View style={styles.placeholderWrap}>
        <Text style={styles.placeholderTitle}>Sem parcelas</Text>
        <Text style={styles.placeholderMessage}>
          Nenhuma parcela registrada. Parcelas sao geradas quando um orcamento e aprovado.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.tabContent}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Em aberto</Text>
          <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>R$ {formatBRL(totalPending)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Vencido</Text>
          <Text style={[styles.summaryValue, { color: '#EF4444' }]}>R$ {formatBRL(totalOverdue)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Pago</Text>
          <Text style={[styles.summaryValue, { color: '#10B981' }]}>R$ {formatBRL(totalPaid)}</Text>
        </View>
      </View>

      {installments.map((p: any) => {
        const isPaid = p.status === 'paid';
        const daysOverdue = parseInt(p.days_overdue) || 0;
        const isOverdue = !isPaid && daysOverdue > 0;
        const amount = parseFloat(p.amount) || 0;

        let dateText = '';
        if (isPaid) dateText = `Pago em ${formatDateBR(p.paid_at)}`;
        else if (isOverdue) dateText = `Venceu ha ${daysOverdue} dia${daysOverdue !== 1 ? 's' : ''} (${formatDateBR(p.due_date)})`;
        else dateText = `Vence em ${formatDateBR(p.due_date)}`;

        return (
          <View
            key={p.payment_id}
            style={[
              styles.installmentCard,
              isOverdue && styles.installmentCardOverdue,
              isPaid && styles.installmentCardPaid,
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.installmentNumber}>
                Parcela {p.installment_number}
                {p.plan_number ? ` • Orc. #${p.plan_number}` : ''}
              </Text>
              <Text style={styles.installmentDate}>{dateText}</Text>
            </View>
            <Text
              style={[
                styles.installmentAmount,
                isPaid && { color: '#10B981' },
                isOverdue && { color: '#EF4444' },
              ]}
            >
              R$ {formatBRL(amount)}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ── Fichas (fase 3) ─────────────────────────────────────────
function FichasTab({ patient }: { patient: PatientLite }) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [initialSpecialty, setInitialSpecialty] = useState<string | undefined>(undefined);

  const { data, isLoading, error } = useQuery({
    queryKey: ['dental-specialty-forms', cid, patient.id],
    queryFn: () => request(`/companies/${cid}/dental/patients/${patient.id}/specialty-forms`),
    enabled: !!cid && !!patient.id,
    staleTime: 30000,
  });

  if (isLoading) return <View style={styles.loadingWrap}><ActivityIndicator color="#06B6D4" /></View>;
  if (error) {
    return (
      <View style={styles.placeholderWrap}>
        <Text style={styles.placeholderTitle}>Erro ao carregar</Text>
        <Text style={styles.placeholderMessage}>
          {(error as any)?.message || 'Nao foi possivel carregar as fichas.'}
        </Text>
      </View>
    );
  }

  const forms = (((data as any)?.forms) || []).map((f: any) => ({
    id:              f.id,
    patient_id:      f.patient_id || f.customer_id,
    specialty:       f.specialty,
    form_data:       f.form_data || {},
    professional_id: f.professional_id,
    notes:           f.notes,
    created_at:      f.created_at,
  }));

  return (
    <>
      <ScrollView style={styles.tabContent}>
        <FichaEspecialidade
          forms={forms}
          patientName={patient.full_name || patient.name}
          onAddForm={(specialty) => {
            setInitialSpecialty(specialty);
            setShowAddModal(true);
          }}
          onViewForm={(formId) => {
            // TODO(fase 4): abrir modal de detalhe da ficha
            console.log('view form', formId);
          }}
        />
      </ScrollView>
      <AddSpecialtyFormModal
        visible={showAddModal}
        patientId={patient.id}
        patientName={patient.full_name || patient.name}
        initialSpecialty={initialSpecialty}
        onClose={() => {
          setShowAddModal(false);
          setInitialSpecialty(undefined);
        }}
        onSaved={() => qc.invalidateQueries({ queryKey: ['dental-specialty-forms', cid, patient.id] })}
      />
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────
export function PatientHub({ visible, patient, onClose, onEdit }: Props) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('dados');
  const [portalOpen, setPortalOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  if (!patient) return null;

  const renderTab = () => {
    switch (activeTab) {
      case 'dados':       return <DataTab patient={patient} />;
      case 'anamnese':    return <AnamneseTab patient={patient} />;
      case 'odontograma': return <OdontogramaTabContent patient={patient} />;
      case 'periograma':  return <PeriogramaTab patient={patient} />;
      case 'prontuario':  return <ProntuarioTabContent patient={patient} />;
      case 'imagens':     return <ImagensTab patient={patient} />;
      case 'orcamentos':  return <OrcamentosTabContent patient={patient} />;
      case 'cobrancas':   return <CobrancasTabContent patient={patient} />;
      case 'fichas':      return <FichasTab patient={patient} />;
      default:            return <DataTab patient={patient} />;
    }
  };

  function handleConsentSigned() {
    // Invalida queries que poderiam mostrar TCLE no historico
    qc.invalidateQueries({ queryKey: ['dental-consent-docs', patient!.id] });
    qc.invalidateQueries({ queryKey: ['dental-prescriptions', patient!.id] });
  }

  return (
    <>
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
    >
      <View style={styles.modal}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(patient.name || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.headerName}>{patient.full_name || patient.name}</Text>
              <Text style={styles.headerMeta}>
                {patient.phone ? patient.phone : 'Sem telefone'}
                {patient.is_patient === false && ' \u2022 Lead'}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setAiOpen(true)}
              style={[styles.iconBtn, styles.iconBtnAi]}
            >
              <Text style={styles.iconBtnTextAi}>{'\u2728'} IA</Text>
            </Pressable>
            <Pressable
              onPress={() => setConsentOpen(true)}
              style={[styles.iconBtn, styles.iconBtnConsent]}
            >
              <Text style={styles.iconBtnTextConsent}>TCLE</Text>
            </Pressable>
            <Pressable
              onPress={() => setPortalOpen(true)}
              style={[styles.iconBtn, styles.iconBtnPortal]}
            >
              <Text style={styles.iconBtnTextPortal}>Portal</Text>
            </Pressable>
            {onEdit && (
              <Pressable onPress={() => onEdit(patient)} style={styles.iconBtn}>
                <Text style={styles.iconBtnText}>Editar</Text>
              </Pressable>
            )}
            <Pressable onPress={onClose} style={styles.iconBtn}>
              <Text style={styles.iconBtnText}>Fechar</Text>
            </Pressable>
          </View>
        </View>

        <OdontoSubNav tabs={HUB_TABS} activeId={activeTab} onChange={setActiveTab} />

        <View style={styles.content}>{renderTab()}</View>
      </View>
    </Modal>

    {/* W2-01: Modal de compartilhamento de portal */}
    <PortalShareModal
      visible={portalOpen}
      patientId={patient.id}
      patientName={patient.full_name || patient.name}
      patientPhone={patient.phone || undefined}
      onClose={() => setPortalOpen(false)}
    />

    {/* W2-04: Modal de coleta de TCLE (template -> form -> assinatura) */}
    <ConsentCollectModal
      visible={consentOpen}
      patientId={patient.id}
      patientName={patient.full_name || patient.name}
      patientPhone={patient.phone || undefined}
      onClose={() => setConsentOpen(false)}
      onSigned={handleConsentSigned}
    />

    {/* W2-05: IA Odonto com contexto profundo do paciente (Expansao only) */}
    <DentalAiChat
      visible={aiOpen}
      onClose={() => setAiOpen(false)}
      initialPatientId={patient.id}
      initialPatientName={patient.full_name || patient.name}
    />
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#1E293B',
    gap: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#06B6D4',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  headerInfo: { flex: 1 },
  headerName: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  headerMeta: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 6 },
  iconBtn: { paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#1E293B', borderRadius: 8 },
  iconBtnText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  iconBtnPortal: { backgroundColor: 'rgba(167,139,250,0.15)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.4)' },
  iconBtnTextPortal: { color: '#a78bfa', fontSize: 12, fontWeight: '700' },
  iconBtnConsent: { backgroundColor: 'rgba(6,182,212,0.15)', borderWidth: 1, borderColor: 'rgba(6,182,212,0.4)' },
  iconBtnTextConsent: { color: '#06B6D4', fontSize: 12, fontWeight: '700' },
  iconBtnAi: { backgroundColor: '#7c3aed', borderWidth: 1, borderColor: '#a78bfa' },
  iconBtnTextAi: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  content: { flex: 1 },
  tabContent: { flex: 1, padding: 16 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  // DataTab
  dataSection: { marginBottom: 20 },
  sectionTitle: {
    color: '#94A3B8', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
  },
  fieldRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  fieldLabel: { color: '#64748B', fontSize: 11, marginBottom: 2 },
  fieldValue: { color: '#E2E8F0', fontSize: 14, fontWeight: '500' },
  notesText: { color: '#CBD5E1', fontSize: 13, lineHeight: 20 },
  waButton: {
    marginTop: 12, backgroundColor: '#10B981',
    paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 8, alignItems: 'center',
  },
  waButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // Anamnese
  infoBadge: {
    marginBottom: 12, padding: 8,
    backgroundColor: 'rgba(6,182,212,0.08)', borderRadius: 6,
    borderWidth: 0.5, borderColor: 'rgba(6,182,212,0.2)',
  },
  infoBadgeText: { color: '#06B6D4', fontSize: 11, fontWeight: '600' },
  savingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.7)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  savingText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  // Placeholder
  placeholderWrap: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center' },
  placeholderTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  placeholderMessage: { color: '#94A3B8', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 16 },

  // Orcamentos
  planCard: {
    backgroundColor: '#1E293B', borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 0.5, borderColor: '#334155',
  },
  planCardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 6,
  },
  planNumber: { color: '#E2E8F0', fontSize: 13, fontWeight: '700' },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusChipText: {
    fontSize: 10, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  planTotal: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginVertical: 4 },
  planMeta: { color: '#94A3B8', fontSize: 12 },
  planDate: { color: '#64748B', fontSize: 11, marginTop: 4 },

  // Cobrancas
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryCard: {
    flex: 1, backgroundColor: '#1E293B', borderRadius: 10,
    padding: 10, alignItems: 'center',
    borderWidth: 0.5, borderColor: '#334155',
  },
  summaryLabel: {
    color: '#94A3B8', fontSize: 10, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  summaryValue: { fontSize: 15, fontWeight: '700' },
  installmentCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E293B', borderRadius: 10,
    padding: 12, marginBottom: 8,
    borderWidth: 0.5, borderColor: '#334155', gap: 10,
  },
  installmentCardOverdue: {
    borderColor: 'rgba(239,68,68,0.4)',
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  installmentCardPaid: { opacity: 0.6 },
  installmentNumber: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },
  installmentDate: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  installmentAmount: { color: '#E2E8F0', fontSize: 15, fontWeight: '700' },
});

export default PatientHub;
