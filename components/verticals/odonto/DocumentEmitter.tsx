// ============================================================
// AURA. — DocumentEmitter (GAP-01)
// Modal de emissão de documentos clínicos no PatientHub.
//
// Tipos: Receituário Simples | Controlado | Atestado Comparecimento
//        Atestado Incapacidade | Pedido de Exame | Encaminhamento
//
// Fluxo: Seleciona tipo → Preenche campos → Preview → Assinar → Enviar WA
// ============================================================

import { useState, useEffect } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, ActivityIndicator, Alert,
  Platform, Linking,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import type { PatientLite } from '@/components/verticals/odonto/PatientHub';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const DOC_TYPES = [
  { id: 'receituario_simples',     label: 'Receituário Simples',         icon: '\uD83D\uDC8A', color: '#06B6D4' },
  { id: 'receituario_controlado',  label: 'Receituário Controlado',      icon: '\uD83D\uDEA8', color: '#EF4444' },
  { id: 'atestado_comparecimento', label: 'Atestado Comparecimento',     icon: '\uD83D\uDCC5', color: '#10B981' },
  { id: 'atestado_incapacidade',   label: 'Atestado Incapacidade',       icon: '\uD83C\uDFE5', color: '#F59E0B' },
  { id: 'pedido_exame',            label: 'Pedido de Exames',            icon: '\uD83D\uDD2C', color: '#8B5CF6' },
  { id: 'encaminhamento',          label: 'Encaminhamento',              icon: '\uD83D\uDCE4', color: '#6366F1' },
];

// Labels legíveis por variável
const VAR_LABELS: Record<string, string> = {
  paciente:              'Nome do paciente',
  data:                  'Data',
  data_nascimento:       'Data de nascimento',
  cpf:                   'CPF',
  endereco:              'Endereço',
  medicamentos:          'Medicamento(s)',
  posologia:             'Posologia / Uso',
  duracao:               'Duração do tratamento',
  quantidade:            'Quantidade',
  cid:                   'CID',
  observacoes:           'Observações',
  data_consulta:         'Data da consulta',
  hora_inicio:           'Horário de início',
  hora_fim:              'Horário de término',
  dias:                  'Dias de afastamento',
  data_inicio:           'Data de início',
  exames:                'Exames solicitados',
  hipotese_diagnostica:  'Hipótese diagnóstica',
  urgencia:              'Urgência',
  especialidade:         'Especialidade',
  motivo:                'Motivo do encaminhamento',
};

// Vars que usam TextInput multilinha
const MULTILINE_VARS = new Set([
  'medicamentos', 'exames', 'observacoes', 'motivo', 'hipotese_diagnostica',
]);

function todayBR() {
  return new Date().toLocaleDateString('pt-BR');
}

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  patient: PatientLite;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────
// DocumentEmitter
// ─────────────────────────────────────────────────────────────
export function DocumentEmitter({ visible, patient, onClose }: Props) {
  const cid = useAuthStore().company?.id ?? '';
  const qc  = useQueryClient();

  const [step, setStep]         = useState<'type' | 'form' | 'preview'>('type');
  const [docType, setDocType]   = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [createdDoc, setCreatedDoc] = useState<any | null>(null);

  // Reset ao fechar
  useEffect(() => {
    if (!visible) {
      setStep('type');
      setDocType(null);
      setFormData({});
      setCreatedDoc(null);
    }
  }, [visible]);

  // Busca templates do tipo selecionado
  const { data: templatesData, isLoading: loadingTemplates } = useQuery({
    queryKey: ['dental-doc-templates', cid, docType],
    queryFn: () => request(`/companies/${cid}/dental/documents/templates?doc_type=${docType}`),
    enabled: !!cid && !!docType,
    staleTime: 300000,
  });

  const template = templatesData?.templates?.[0] ?? null;
  const variables: string[] = template?.variables ?? [];

  // Pré-preenche campos automáticos ao selecionar tipo
  useEffect(() => {
    if (!docType || !patient) return;
    setFormData({
      paciente: patient.full_name || patient.name,
      cpf:      patient.cpf || '',
      data:     todayBR(),
    });
  }, [docType, patient]);

  // Mutations
  const createMut = useMutation({
    mutationFn: () =>
      request(`/companies/${cid}/dental/documents`, {
        method: 'POST',
        body: {
          customer_id:  patient.id,
          doc_type:     docType,
          template_id:  template?.id,
          content_data: formData,
        },
      }),
    onSuccess: (data) => {
      setCreatedDoc(data.document);
      setStep('preview');
      qc.invalidateQueries({ queryKey: ['dental-documents', cid, patient.id] });
    },
    onError: (err: any) => Alert.alert('Erro', err?.message || 'Não foi possível criar o documento.'),
  });

  const signMut = useMutation({
    mutationFn: () =>
      request(`/companies/${cid}/dental/documents/${createdDoc?.id}/sign`, { method: 'PATCH' }),
    onSuccess: (data) => {
      setCreatedDoc(data.document);
      Alert.alert('Assinado', 'Documento assinado com sucesso.');
    },
    onError: (err: any) => Alert.alert('Erro', err?.message || 'Erro ao assinar.'),
  });

  const sendWAMut = useMutation({
    mutationFn: () =>
      request(`/companies/${cid}/dental/documents/${createdDoc?.id}/send-whatsapp`, {
        method: 'PATCH',
        body: { phone: patient.phone },
      }),
    onSuccess: () => {
      // Abre WhatsApp com o texto do documento
      const phone = patient.phone?.replace(/\D/g, '');
      const text  = encodeURIComponent(
        `*${DOC_TYPES.find(d => d.id === docType)?.label ?? 'Documento'}*\n\n` +
        (createdDoc?.rendered_text ?? '')
      );
      Linking.openURL(`https://wa.me/55${phone}?text=${text}`).catch(() => {});
      Alert.alert('Enviado', 'Documento marcado como enviado via WhatsApp.');
    },
    onError: (err: any) => Alert.alert('Erro', err?.message || 'Erro ao registrar envio.'),
  });

  // ── Step: type selector ──────────────────────────────────
  function renderTypeStep() {
    return (
      <ScrollView style={s.stepScroll}>
        <Text style={s.stepTitle}>Selecione o documento</Text>
        <Text style={s.stepSub}>Paciente: {patient.full_name || patient.name}</Text>
        <View style={s.typeGrid}>
          {DOC_TYPES.map(dt => (
            <TouchableOpacity
              key={dt.id}
              onPress={() => { setDocType(dt.id); setStep('form'); }}
              style={[s.typeCard, { borderColor: `${dt.color}55` }]}
              activeOpacity={0.8}
            >
              <Text style={s.typeIcon}>{dt.icon}</Text>
              <Text style={[s.typeLabel, { color: dt.color }]}>{dt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  }

  // ── Step: form ───────────────────────────────────────────
  function renderFormStep() {
    if (loadingTemplates) {
      return <View style={s.center}><ActivityIndicator color="#06B6D4" /></View>;
    }

    const dt = DOC_TYPES.find(d => d.id === docType);

    return (
      <ScrollView style={s.stepScroll} keyboardShouldPersistTaps="handled">
        <View style={s.formHeader}>
          <Text style={s.typeIcon}>{dt?.icon}</Text>
          <View>
            <Text style={s.stepTitle}>{dt?.label}</Text>
            <Text style={s.stepSub}>{patient.full_name || patient.name}</Text>
          </View>
        </View>

        {variables.map(varName => {
          const isMulti = MULTILINE_VARS.has(varName);
          return (
            <View key={varName} style={s.fieldWrap}>
              <Text style={s.fieldLabel}>
                {VAR_LABELS[varName] || varName}
                {(varName === 'medicamentos' || varName === 'exames') ? ' *' : ''}
              </Text>
              <TextInput
                style={[s.fieldInput, isMulti && s.fieldInputMulti]}
                placeholder={`Ex: ${VAR_LABELS[varName] || varName}...`}
                placeholderTextColor="#475569"
                multiline={isMulti}
                numberOfLines={isMulti ? 4 : 1}
                value={formData[varName] ?? ''}
                onChangeText={v => setFormData(prev => ({ ...prev, [varName]: v }))}
              />
            </View>
          );
        })}

        <TouchableOpacity
          onPress={() => createMut.mutate()}
          disabled={createMut.isPending}
          style={[s.primaryBtn, createMut.isPending && { opacity: 0.6 }]}
        >
          {createMut.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.primaryBtnText}>Gerar documento</Text>
          }
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // ── Step: preview ────────────────────────────────────────
  function renderPreviewStep() {
    const dt       = DOC_TYPES.find(d => d.id === docType);
    const isSigned = !!createdDoc?.signed_at;
    const isSentWA = !!createdDoc?.sent_whatsapp_at;

    return (
      <ScrollView style={s.stepScroll}>
        <View style={s.previewHeader}>
          <Text style={s.typeIcon}>{dt?.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.stepTitle}>{dt?.label}</Text>
            <Text style={s.docNumber}>{createdDoc?.doc_number}</Text>
          </View>
          {isSigned && (
            <View style={s.signedBadge}>
              <Text style={s.signedBadgeText}>\u2713 Assinado</Text>
            </View>
          )}
        </View>

        {/* Texto renderizado */}
        <View style={s.previewBox}>
          <Text style={s.previewText}>{createdDoc?.rendered_text}</Text>
        </View>

        {/* Ações */}
        <View style={s.actionsRow}>
          {!isSigned && (
            <TouchableOpacity
              onPress={() => signMut.mutate()}
              disabled={signMut.isPending}
              style={[s.actionBtn, { backgroundColor: '#10B981' }]}
            >
              {signMut.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.actionBtnText}>\uD83D\uDD8A Assinar</Text>
              }
            </TouchableOpacity>
          )}

          {patient.phone && (
            <TouchableOpacity
              onPress={() => sendWAMut.mutate()}
              disabled={sendWAMut.isPending || isSentWA}
              style={[
                s.actionBtn,
                { backgroundColor: isSentWA ? '#1E293B' : '#25D366' },
              ]}
            >
              {sendWAMut.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.actionBtnText}>
                    {isSentWA ? '\u2713 Enviado' : '\uD83D\uDCAC WhatsApp'}
                  </Text>
              }
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => { setStep('type'); setDocType(null); setCreatedDoc(null); }}
            style={[s.actionBtn, { backgroundColor: '#1E293B' }]}
          >
            <Text style={[s.actionBtnText, { color: '#94A3B8' }]}>+ Novo</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <View style={s.modal}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>
            {step === 'type'    ? 'Emitir Documento' :
             step === 'form'    ? 'Preencher dados' :
                                  'Documento gerado'}
          </Text>
          <View style={s.headerRight}>
            {step !== 'type' && (
              <TouchableOpacity
                onPress={() => step === 'form' ? setStep('type') : setStep('form')}
                style={s.backBtn}
              >
                <Text style={s.backBtnText}>\u2190 Voltar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Indicador de etapas */}
        <View style={s.stepIndicator}>
          {(['type', 'form', 'preview'] as const).map((st, i) => (
            <View key={st} style={s.stepDotWrap}>
              {i > 0 && <View style={[s.stepLine, step !== 'type' && i <= (['type','form','preview'].indexOf(step)) && { backgroundColor: '#06B6D4' }]} />}
              <View style={[
                s.stepDot,
                step === st && { backgroundColor: '#06B6D4' },
                (['type','form','preview'].indexOf(step) > i) && { backgroundColor: '#10B981' },
              ]} />
            </View>
          ))}
        </View>

        {/* Conteúdo por etapa */}
        {step === 'type'    && renderTypeStep()}
        {step === 'form'    && renderFormStep()}
        {step === 'preview' && renderPreviewStep()}
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  modal:  { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  headerRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  backBtn:  { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#1E293B', borderRadius: 8 },
  backBtnText: { color: '#06B6D4', fontSize: 12, fontWeight: '600' },
  closeBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#1E293B', borderRadius: 8 },
  closeBtnText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },

  stepIndicator: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, gap: 0 },
  stepDotWrap:   { flexDirection: 'row', alignItems: 'center' },
  stepDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: '#334155' },
  stepLine:      { width: 40, height: 2, backgroundColor: '#334155' },

  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stepScroll:{ flex: 1, paddingHorizontal: 16, paddingTop: 8 },

  stepTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  stepSub:   { color: '#94A3B8', fontSize: 12, marginBottom: 16 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 24 },
  typeCard: {
    width: '47%', backgroundColor: '#1E293B', borderRadius: 12,
    padding: 14, alignItems: 'center', gap: 8,
    borderWidth: 1,
  },
  typeIcon:  { fontSize: 28 },
  typeLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },

  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  fieldWrap:  { marginBottom: 14 },
  fieldLabel: {
    color: '#94A3B8', fontSize: 11, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: '#1E293B', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    color: '#FFFFFF', fontSize: 14,
    borderWidth: 1, borderColor: '#334155',
  },
  fieldInputMulti: { height: 90, textAlignVertical: 'top' },

  primaryBtn: {
    backgroundColor: '#06B6D4', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  docNumber:     { color: '#475569', fontSize: 11, fontWeight: '600' },
  signedBadge:   { backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  signedBadgeText: { color: '#10B981', fontSize: 10, fontWeight: '700' },

  previewBox: {
    backgroundColor: '#1E293B', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#334155', marginBottom: 16,
  },
  previewText: { color: '#E2E8F0', fontSize: 13, lineHeight: 22, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  actionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingBottom: 32 },
  actionBtn:  { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', minWidth: 90 },
  actionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});

export default DocumentEmitter;
