// ============================================================
// AURA. — PatientHub (W1-01)
// Drill-down do paciente com sub-tabs internas.
// Substitui o pattern antigo de ter que navegar entre 5 tabs
// diferentes pra ver dados de UM paciente.
//
// Sub-tabs:
//   Dados        - cadastro, contato, plano, ultimas visitas
//   Anamnese     - AnamneseWizard wirado (GET/PUT real)
//   Odontograma  - OdontogramaSVG por patient_id (TODO)
//   Periograma   - Periograma (TODO wire patientId)
//   Prontuario   - ProntuarioTimeline filtrada (TODO)
//   Imagens      - ClinicalImages (TODO endpoint R2 upload - W1-02)
//   Orcamentos   - filtro de orcamentos por customer_id (TODO)
//   Cobrancas    - filtro de cobrancas por customer_id (TODO)
//   Fichas       - FichaEspecialidade
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
  /** Callback opcional pra editar dados do paciente */
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
  { id: 'imagens',     label: 'Imagens',       component: () => null, badge: 'beta' },
  { id: 'orcamentos',  label: 'Orcamentos',    component: () => null },
  { id: 'cobrancas',   label: 'Cobrancas',     component: () => null },
  { id: 'fichas',      label: 'Fichas',        component: () => null },
];

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

// ────────────────────────────────────────────────────────────
// AnamneseTab (W1-01): GET/PUT wirado via useQuery + useMutation
// ────────────────────────────────────────────────────────────
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
        method: 'PUT',
        body: { data: anamnesisData },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dental-anamnesis', cid, patient.id] });
      Alert.alert('Anamnese salva', 'Dados registrados com sucesso.');
    },
    onError: (err: any) => {
      Alert.alert('Erro', err?.message || 'Nao foi possivel salvar a anamnese.');
    },
  });

  if (isLoading) {
    return (
      <View style={[styles.tabContent, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color="#06B6D4" />
      </View>
    );
  }

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

  // data.anamnesis e null na primeira vez (wizard comeca vazio)
  const initial = (data as any)?.anamnesis as Partial<AnamneseData> | null;
  const updatedAt = (data as any)?.updated_at;

  return (
    <View style={styles.tabContent}>
      {updatedAt && (
        <View style={styles.infoBadge}>
          <Text style={styles.infoBadgeText}>
            Ultima atualizacao: {new Date(updatedAt).toLocaleDateString('pt-BR')}
          </Text>
        </View>
      )}
      <AnamneseWizard
        initialData={initial || undefined}
        onComplete={(data) => saveMut.mutate(data)}
      />
      {saveMut.isPending && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator color="#06B6D4" />
          <Text style={styles.savingText}>Salvando...</Text>
        </View>
      )}
    </View>
  );
}

function OdontogramaTabContent({ patient }: { patient: PatientLite }) {
  return <Placeholder title="Odontograma" message={`Odontograma de ${patient.name} sera wirado em W1-01 (fase 2).`} />;
}

function PeriogramaTab({ patient }: { patient: PatientLite }) {
  return (
    <View style={styles.tabContent}>
      <Periograma />
    </View>
  );
}

function ProntuarioTabContent({ patient }: { patient: PatientLite }) {
  return <Placeholder title="Prontuario" message={`Timeline filtrada de ${patient.name} - W1-01 (fase 2).`} />;
}

function ImagensTab({ patient }: { patient: PatientLite }) {
  return (
    <View style={styles.tabContent}>
      <ClinicalImages />
    </View>
  );
}

function OrcamentosTabContent({ patient }: { patient: PatientLite }) {
  return <Placeholder title="Orcamentos" message={`Orcamentos de ${patient.name} - filtro a wirar.`} />;
}

function CobrancasTabContent({ patient }: { patient: PatientLite }) {
  return <Placeholder title="Cobrancas" message={`Parcelas e cobrancas de ${patient.name} - filtro a wirar.`} />;
}

function FichasTab({ patient }: { patient: PatientLite }) {
  return (
    <View style={styles.tabContent}>
      <FichaEspecialidade />
    </View>
  );
}

function Placeholder({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.placeholderWrap}>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderMessage}>{message}</Text>
      <Text style={styles.placeholderHint}>
        Esta sub-tab esta no backlog. Veja docs/ODT_BACKLOG_V2.md.
      </Text>
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────
export function PatientHub({ visible, patient, onClose, onEdit }: Props) {
  const [activeTab, setActiveTab] = useState('dados');

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

  return (
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
  );
}

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#06B6D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  headerMeta: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#1E293B',
    borderRadius: 8,
  },
  iconBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  dataSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  fieldRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  fieldLabel: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 2,
  },
  fieldValue: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '500',
  },
  notesText: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 20,
  },
  waButton: {
    marginTop: 12,
    backgroundColor: '#10B981',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  waButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  infoBadge: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: 'rgba(6,182,212,0.08)',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(6,182,212,0.2)',
  },
  infoBadgeText: {
    color: '#06B6D4',
    fontSize: 11,
    fontWeight: '600',
  },
  savingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  savingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  placeholderWrap: {
    flex: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  placeholderMessage: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  placeholderHint: {
    color: '#64748B',
    fontSize: 11,
    fontStyle: 'italic',
  },
});

export default PatientHub;
