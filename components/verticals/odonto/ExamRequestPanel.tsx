// ============================================================
// AURA. — ExamRequestPanel (GAP-04)
// Painel dedicado para solicitação de exames odontológicos.
//
// Reutiliza a infra de dental_documents (GAP-01):
//   POST /dental/documents com doc_type = 'pedido_exame'
//
// UX otimizada para velocidade — diferente do DocumentEmitter
// genérico (3 steps), aqui o dentista:
//   1. Toca o tipo de exame (botões visuais)
//   2. Preenche só os campos relevantes (adaptados por tipo)
//   3. Preview inline
//   4. Envia por WhatsApp ou salva
//
// Tipos de exame:
//   Imagem: RX Periapical | RX Panorâmico | CBCT | Bite-Wing
//   Lab:    Hemograma+Coag | Glicemia | Pré-Op Completo | Personalizado
// ============================================================

import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { request } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import type { PatientLite } from '@/components/verticals/odonto/PatientHub';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const EXAM_TYPES: {
  id: string;
  label: string;
  icon: string;
  group: 'image' | 'lab';
  templateName: string;
  fields: string[];
}[] = [
  // Imagem
  { id: 'rx_peri',  label: 'RX Periapical',      icon: '🦷', group: 'image', templateName: 'RX Periapical',              fields: ['elementos_dentarios', 'indicacao_clinica', 'observacoes'] },
  { id: 'rx_pano',  label: 'RX Panorâmico',       icon: '📐', group: 'image', templateName: 'RX Panoramico',              fields: ['indicacao_clinica', 'observacoes'] },
  { id: 'cbct',     label: 'Tomografia CBCT',      icon: '🔬', group: 'image', templateName: 'Tomografia CBCT',            fields: ['regiao', 'fov', 'indicacao_clinica', 'observacoes'] },
  { id: 'bwx',      label: 'Bite-Wing',            icon: '📷', group: 'image', templateName: 'RX Interproximal (Bite-Wing)', fields: ['regiao', 'observacoes'] },
  // Lab
  { id: 'hemog',    label: 'Hemograma + Coag',    icon: '🩸', group: 'lab',   templateName: 'Hemograma + Coagulograma',   fields: ['observacoes'] },
  { id: 'glicemia', label: 'Glicemia em Jejum',    icon: '🧪', group: 'lab',   templateName: 'Glicemia em Jejum',          fields: ['observacoes'] },
  { id: 'preop',    label: 'Pré-Op Completo',      icon: '🏥', group: 'lab',   templateName: 'Pre-Operatorio Completo',    fields: ['procedimento_cirurgico', 'urgencia', 'observacoes'] },
  { id: 'custom',   label: 'Personalizado',         icon: '📋', group: 'lab',   templateName: 'Pedido de Exames',           fields: ['exames', 'hipotese_diagnostica', 'observacoes'] },
];

const INDICACOES = [
  'Diagnóstico', 'Planejamento cirúrgico', 'Pré-operatório',
  'Acompanhamento pós-operatório', 'Retratamento endodôntico',
  'Avaliação periodontal', 'Planejamento implante', 'Urgência',
];

const FOV_OPTIONS = ['Pequeno (4x4cm)', 'Médio (8x8cm)', 'Grande (14x14cm)'];

const REGIAO_OPTIONS = [
  'Superior direita', 'Superior esquerda', 'Inferior direita', 'Inferior esquerda',
  'Arco superior completo', 'Arco inferior completo', 'ATM direita', 'ATM esquerda',
  'ATM bilateral', 'Terço médio da face',
];

// ─────────────────────────────────────────────────────────────
// Field label helper
// ─────────────────────────────────────────────────────────────
const FIELD_CONFIG: Record<string, { label: string; placeholder: string; multiline?: boolean; options?: string[] }> = {
  elementos_dentarios:   { label: 'Elemento(s) dentário(s)', placeholder: 'Ex: 11, 12, 21 (notação FDI)' },
  indicacao_clinica:     { label: 'Indicação clínica', placeholder: 'Selecione ou descreva', options: INDICACOES },
  regiao:                { label: 'Região', placeholder: 'Selecione a região', options: REGIAO_OPTIONS },
  fov:                   { label: 'Campo de visão (FOV)', placeholder: 'Selecione', options: FOV_OPTIONS },
  procedimento_cirurgico:{ label: 'Procedimento cirúrgico', placeholder: 'Ex: extração do dente 48, implante osseointegrado...' },
  urgencia:              { label: 'Urgência', placeholder: 'Normal / Urgente', options: ['Normal', 'Urgente'] },
  exames:                { label: 'Exames solicitados', placeholder: 'Liste os exames, um por linha...', multiline: true },
  hipotese_diagnostica:  { label: 'Hipótese diagnóstica', placeholder: 'Ex: Infecção odontogênica, cárie secundária...' },
  observacoes:           { label: 'Observações', placeholder: 'Observações adicionais (opcional)', multiline: true },
};

// ─────────────────────────────────────────────────────────────
// Small option chips
// ─────────────────────────────────────────────────────────────
function OptionChips({ options, value, onSelect }: { options: string[]; value: string; onSelect: (v: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt}
          onPress={() => onSelect(opt)}
          style={[st.optChip, value === opt && st.optChipActive]}
        >
          <Text style={[st.optChipText, value === opt && st.optChipTextActive]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
interface Props {
  patient: PatientLite;
  onClose?: () => void;
  onSaved?: (docId: string) => void;
}

export function ExamRequestPanel({ patient, onClose, onSaved }: Props) {
  const cid  = useAuthStore().company?.id ?? '';
  const user = useAuthStore().user;

  const [selectedExam, setSelectedExam] = useState<typeof EXAM_TYPES[0] | null>(null);
  const [fields, setFields]             = useState<Record<string, string>>({});
  const [preview, setPreview]           = useState('');
  const [step, setStep]                 = useState<'select' | 'fill' | 'preview' | 'done'>('select');

  // Busca templates
  const { data: templatesData } = useQuery({
    queryKey: ['dental-doc-templates', cid, 'pedido_exame'],
    queryFn: () => request(`/companies/${cid}/dental/documents/templates?doc_type=pedido_exame`),
    enabled: !!cid,
    staleTime: 300000,
  });

  const templates: any[] = templatesData?.templates || [];

  // Reset campos quando muda tipo de exame
  useEffect(() => {
    if (!selectedExam) return;
    const today = new Date().toLocaleDateString('pt-BR');
    setFields({
      paciente: patient.full_name || patient.name,
      data:     today,
      dentista: user?.name || '',
      cro:      '',
    });
  }, [selectedExam]);

  // Gera preview renderizando o template
  function buildPreview() {
    if (!selectedExam) return '';
    const tpl = templates.find(t => t.name === selectedExam.templateName || t.name.replace('ô', 'o').replace('â', 'a') === selectedExam.templateName);
    if (!tpl) return '';

    let content = tpl.content;
    Object.entries(fields).forEach(([key, val]) => {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), val || `[${key}]`);
    });
    // Remove variáveis não preenchidas
    content = content.replace(/\{\{[^}]+\}\}/g, '—');
    return content;
  }

  function handlePreview() {
    const p = buildPreview();
    setPreview(p);
    setStep('preview');
  }

  // Salvar documento
  const saveMut = useMutation({
    mutationFn: () =>
      request(`/companies/${cid}/dental/documents`, {
        method: 'POST',
        body: {
          doc_type:    'pedido_exame',
          patient_id:  patient.id,
          template_id: templates.find(t => t.name === selectedExam?.templateName)?.id,
          content:     preview,
          fields,
        },
      }),
    onSuccess: (data: any) => {
      setStep('done');
      onSaved?.(data?.document?.id);
    },
    onError: (err: any) => Alert.alert('Erro', err?.message || 'Não foi possível salvar.'),
  });

  // Enviar WhatsApp
  function sendWhatsApp() {
    const phone = patient.phone?.replace(/\D/g, '');
    if (!phone) {
      Alert.alert('Sem telefone', 'O paciente não tem telefone cadastrado.');
      return;
    }
    const text = encodeURIComponent(
      `Olá ${patient.name}! Segue sua solicitação de exame:\n\n${preview}\n\nQualquer dúvida estou à disposição.`
    );
    Linking.openURL(`https://wa.me/55${phone}?text=${text}`);
  }

  const field = (key: string) => fields[key] || '';
  const setField = (key: string, val: string) => setFields(prev => ({ ...prev, [key]: val }));

  // ─── STEP: SELECT ──────────────────────────────────────────
  if (step === 'select') {
    return (
      <View style={st.root}>
        <View style={st.header}>
          <Text style={st.title}>📋 Pedido de Exame</Text>
          <Text style={st.subtitle}>{patient.full_name || patient.name}</Text>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={st.closeBtn}>
              <Text style={st.closeBtnText}>Fechar</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={st.body}>
          {/* Imagem */}
          <Text style={st.groupLabel}>🖼️ Exames de Imagem</Text>
          <View style={st.examGrid}>
            {EXAM_TYPES.filter(e => e.group === 'image').map(e => (
              <TouchableOpacity
                key={e.id}
                onPress={() => { setSelectedExam(e); setStep('fill'); }}
                style={st.examCard}
                activeOpacity={0.8}
              >
                <Text style={st.examIcon}>{e.icon}</Text>
                <Text style={st.examLabel}>{e.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Laboratorial */}
          <Text style={st.groupLabel}>🧪 Exames Laboratoriais</Text>
          <View style={st.examGrid}>
            {EXAM_TYPES.filter(e => e.group === 'lab').map(e => (
              <TouchableOpacity
                key={e.id}
                onPress={() => { setSelectedExam(e); setStep('fill'); }}
                style={st.examCard}
                activeOpacity={0.8}
              >
                <Text style={st.examIcon}>{e.icon}</Text>
                <Text style={st.examLabel}>{e.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // ─── STEP: FILL ────────────────────────────────────────────
  if (step === 'fill' && selectedExam) {
    return (
      <View style={st.root}>
        <View style={st.header}>
          <View>
            <Text style={st.title}>{selectedExam.icon} {selectedExam.label}</Text>
            <Text style={st.subtitle}>{patient.full_name || patient.name}</Text>
          </View>
          <TouchableOpacity onPress={() => setStep('select')} style={st.closeBtn}>
            <Text style={st.closeBtnText}>← Voltar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={st.body} keyboardShouldPersistTaps="handled">
          {/* Dentista e CRO (sempre visíveis) */}
          <View style={st.twoCol}>
            <View style={{ flex: 2 }}>
              <Text style={st.fieldLabel}>Nome do dentista</Text>
              <TextInput
                style={st.fieldInput}
                placeholder="Dr(a). Nome"
                placeholderTextColor="#475569"
                value={field('dentista')}
                onChangeText={v => setField('dentista', v)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.fieldLabel}>CRO</Text>
              <TextInput
                style={st.fieldInput}
                placeholder="12345/SP"
                placeholderTextColor="#475569"
                value={field('cro')}
                onChangeText={v => setField('cro', v)}
              />
            </View>
          </View>

          {/* Campos dinâmicos por tipo */}
          {selectedExam.fields.map(fKey => {
            const cfg = FIELD_CONFIG[fKey];
            if (!cfg) return null;
            return (
              <View key={fKey}>
                <Text style={st.fieldLabel}>{cfg.label}</Text>
                {cfg.options ? (
                  <>
                    <OptionChips
                      options={cfg.options}
                      value={field(fKey)}
                      onSelect={v => setField(fKey, v)}
                    />
                    <TextInput
                      style={st.fieldInput}
                      placeholder={cfg.placeholder}
                      placeholderTextColor="#475569"
                      value={field(fKey)}
                      onChangeText={v => setField(fKey, v)}
                    />
                  </>
                ) : (
                  <TextInput
                    style={[st.fieldInput, cfg.multiline && { height: 80, textAlignVertical: 'top' }]}
                    placeholder={cfg.placeholder}
                    placeholderTextColor="#475569"
                    multiline={cfg.multiline}
                    value={field(fKey)}
                    onChangeText={v => setField(fKey, v)}
                  />
                )}
              </View>
            );
          })}

          <TouchableOpacity onPress={handlePreview} style={[st.primaryBtn, { marginTop: 20 }]}>
            <Text style={st.primaryBtnText}>👁️ Pré-visualizar</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // ─── STEP: PREVIEW ─────────────────────────────────────────
  if (step === 'preview') {
    return (
      <View style={st.root}>
        <View style={st.header}>
          <View>
            <Text style={st.title}>Pré-visualização</Text>
            <Text style={st.subtitle}>{selectedExam?.label}</Text>
          </View>
          <TouchableOpacity onPress={() => setStep('fill')} style={st.closeBtn}>
            <Text style={st.closeBtnText}>← Editar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={st.body}>
          {/* Preview do documento */}
          <View style={st.previewBox}>
            <Text style={st.previewContent}>{preview}</Text>
          </View>

          {/* Ações */}
          <View style={st.actionRow}>
            <TouchableOpacity
              onPress={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              style={[st.primaryBtn, { flex: 1 }, saveMut.isPending && { opacity: 0.5 }]}
            >
              {saveMut.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={st.primaryBtnText}>💾 Salvar no Prontuário</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={sendWhatsApp} style={st.waBtn}>
              <Text style={st.waBtnText}>💬 WhatsApp</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => setStep('select')} style={[st.secondaryBtn, { marginTop: 8 }]}>
            <Text style={st.secondaryBtnText}>Novo pedido</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // ─── STEP: DONE ────────────────────────────────────────────
  return (
    <View style={st.root}>
      <View style={[st.body, { alignItems: 'center', justifyContent: 'center', paddingTop: 80 }]}>
        <Text style={{ fontSize: 56 }}>✅</Text>
        <Text style={st.doneTitle}>Pedido salvo!</Text>
        <Text style={st.doneHint}>Registrado no prontuário do paciente.</Text>

        <TouchableOpacity onPress={sendWhatsApp} style={[st.waBtn, { marginTop: 20, paddingHorizontal: 28 }]}>
          <Text style={st.waBtnText}>💬 Enviar por WhatsApp</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { setStep('select'); setSelectedExam(null); setFields({}); setPreview(''); }}
          style={[st.primaryBtn, { marginTop: 10 }]}
        >
          <Text style={st.primaryBtnText}>+ Novo pedido</Text>
        </TouchableOpacity>

        {onClose && (
          <TouchableOpacity onPress={onClose} style={[st.secondaryBtn, { marginTop: 8 }]}>
            <Text style={st.secondaryBtnText}>Fechar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#0F172A' },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B', gap: 10 },
  title:      { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  subtitle:   { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  closeBtn:   { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#1E293B', borderRadius: 8 },
  closeBtnText:{ color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  body:       { flex: 1, padding: 16 },

  // Select step
  groupLabel: { color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 10 },
  examGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  examCard:   {
    width: '47%', backgroundColor: '#1E293B',
    borderRadius: 12, padding: 16, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#334155',
  },
  examIcon:   { fontSize: 28 },
  examLabel:  { color: '#FFFFFF', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  // Fill step
  twoCol:     { flexDirection: 'row', gap: 10, marginBottom: 4 },
  fieldLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '600', marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: { backgroundColor: '#1E293B', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, color: '#FFFFFF', fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  optChip:    { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', marginRight: 8, marginBottom: 8 },
  optChipActive:     { backgroundColor: '#4C1D95', borderColor: '#8B5CF6' },
  optChipText:       { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  optChipTextActive: { color: '#FFFFFF' },

  // Preview
  previewBox: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 20, marginBottom: 16 },
  previewContent:{ color: '#1E293B', fontSize: 13, lineHeight: 22, fontFamily: 'monospace' },
  actionRow:  { flexDirection: 'row', gap: 8 },
  waBtn:      { backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  waBtnText:  { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // Done
  doneTitle:  { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: 12 },
  doneHint:   { color: '#94A3B8', fontSize: 13, marginTop: 4 },

  // Shared
  primaryBtn: { backgroundColor: '#8B5CF6', borderRadius: 10, paddingVertical: 13, paddingHorizontal: 20, alignItems: 'center' },
  primaryBtnText:{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  secondaryBtn:{ backgroundColor: '#1E293B', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  secondaryBtnText:{ color: '#94A3B8', fontSize: 13, fontWeight: '600' },
});

export default ExamRequestPanel;
