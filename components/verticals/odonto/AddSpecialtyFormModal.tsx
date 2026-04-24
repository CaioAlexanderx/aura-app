// ============================================================
// AURA. — AddSpecialtyFormModal (W1-01 f3)
//
// Modal dinamico pra criar ficha de especialidade.
// Fluxo em 2 steps:
//   Step 1: escolher specialty (grid 6 cards)
//   Step 2: preencher fields dinamicos baseado na specialty
//
// Se `initialSpecialty` for passado, pula direto pro Step 2.
//
// SPECIALTIES map espelha o de components/verticals/odonto/
// FichaEspecialidade.tsx. Em refactor futuro pode extrair pra
// shared constants.
// ============================================================

import { useState, useMemo } from 'react';
import {
  Modal, View, Text, ScrollView, TextInput, Pressable,
  StyleSheet, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { request } from '@/services/api';
import { useAuthStore } from '@/stores/auth';

// ──────── SPECIALTIES (espelho do FichaEspecialidade.tsx) ────────
const SPECIALTIES: Record<string, { label: string; icon: string; fields: string[] }> = {
  ortodontia: {
    label: 'Ortodontia',
    icon:  '\u{1F9B7}',
    fields: [
      'Classificacao de Angle', 'Overjet', 'Overbite',
      'Tipo aparelho', 'Fase tratamento', 'Alinhador numero', 'Proxima troca',
    ],
  },
  endodontia: {
    label: 'Endodontia',
    icon:  '\u{1FA7A}',
    fields: [
      'Dente', 'Numero canais', 'Comprimento trabalho',
      'Limas utilizadas', 'Cone principal', 'Cimento', 'Obturacao',
    ],
  },
  periodontia: {
    label: 'Periodontia',
    icon:  '\u{1F9EC}',
    fields: [
      'Classificacao doenca', 'Extensao', 'Estagio',
      'Grau', 'Sangramento', 'Plano tratamento perio',
    ],
  },
  cirurgia: {
    label: 'Cirurgia',
    icon:  '\u{1FA78}',
    fields: [
      'Tipo cirurgia', 'Anestesia', 'Tecnica',
      'Complicacoes', 'Pontos', 'Retorno',
    ],
  },
  implante: {
    label: 'Implante',
    icon:  '\u{1F9F4}',
    fields: [
      'Regiao', 'Marca implante', 'Diametro',
      'Comprimento', 'Torque', 'Tipo conexao', 'Pilar',
    ],
  },
  protese: {
    label: 'Protese',
    icon:  '\u{1F9B4}',
    fields: [
      'Tipo protese', 'Material', 'Cor',
      'Moldagem', 'Prova', 'Cimentacao', 'Laboratorio',
    ],
  },
};

const SPECIALTY_KEYS = Object.keys(SPECIALTIES);

interface Props {
  visible: boolean;
  patientId: string;
  patientName?: string;
  initialSpecialty?: string;
  onClose: () => void;
  onSaved?: () => void;
}

export function AddSpecialtyFormModal({
  visible, patientId, patientName, initialSpecialty, onClose, onSaved,
}: Props) {
  const cid = useAuthStore().company?.id;

  const [specialty, setSpecialty] = useState<string | null>(initialSpecialty || null);
  const [formData, setFormData]   = useState<Record<string, string>>({});
  const [notes, setNotes]         = useState<string>('');

  const fields = useMemo(
    () => (specialty ? SPECIALTIES[specialty]?.fields || [] : []),
    [specialty]
  );

  const saveMut = useMutation({
    mutationFn: () =>
      request(`/companies/${cid}/dental/patients/${patientId}/specialty-forms`, {
        method: 'POST',
        body: {
          specialty,
          form_data: formData,
          notes: notes.trim() || null,
        },
      }),
    onSuccess: () => {
      Alert.alert('Ficha salva', 'Ficha de especialidade registrada com sucesso.');
      onSaved?.();
      reset();
      onClose();
    },
    onError: (err: any) => {
      Alert.alert('Erro', err?.message || 'Nao foi possivel salvar a ficha.');
    },
  });

  function reset() {
    setSpecialty(initialSpecialty || null);
    setFormData({});
    setNotes('');
  }

  function handleSave() {
    if (!specialty) {
      Alert.alert('Atencao', 'Escolha uma especialidade antes de salvar.');
      return;
    }
    // Filtra so os campos preenchidos
    const filled = Object.entries(formData).reduce((acc, [k, v]) => {
      if (v && String(v).trim()) acc[k] = String(v).trim();
      return acc;
    }, {} as Record<string, string>);

    if (Object.keys(filled).length === 0 && !notes.trim()) {
      Alert.alert(
        'Ficha vazia',
        'Preencha ao menos um campo ou observacao antes de salvar.'
      );
      return;
    }
    setFormData(filled);
    saveMut.mutate();
  }

  // Step 1: escolha de specialty
  if (!specialty) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={onClose}
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      >
        <View style={s.modal}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Nova ficha de especialidade</Text>
              {patientName && <Text style={s.subtitle}>{patientName}</Text>}
            </View>
            <Pressable onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeBtnText}>Cancelar</Text>
            </Pressable>
          </View>

          <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
            <Text style={s.sectionLabel}>Escolha a especialidade</Text>
            <View style={s.specGrid}>
              {SPECIALTY_KEYS.map((key) => {
                const spec = SPECIALTIES[key];
                return (
                  <Pressable
                    key={key}
                    onPress={() => setSpecialty(key)}
                    style={s.specCard}
                  >
                    <Text style={s.specIcon}>{spec.icon}</Text>
                    <Text style={s.specLabel}>{spec.label}</Text>
                    <Text style={s.specFields}>{spec.fields.length} campos</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  }

  // Step 2: preenchimento dos fields
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
    >
      <View style={s.modal}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>
              {SPECIALTIES[specialty].icon} {SPECIALTIES[specialty].label}
            </Text>
            {patientName && <Text style={s.subtitle}>{patientName}</Text>}
          </View>
          {!initialSpecialty && (
            <Pressable onPress={() => setSpecialty(null)} style={s.closeBtn}>
              <Text style={s.closeBtnText}>Trocar</Text>
            </Pressable>
          )}
          <Pressable onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeBtnText}>Cancelar</Text>
          </Pressable>
        </View>

        <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
          {fields.map((field) => (
            <View key={field} style={{ marginBottom: 12 }}>
              <Text style={s.label}>{field}</Text>
              <TextInput
                style={s.input}
                value={formData[field] || ''}
                onChangeText={(v) => setFormData((prev) => ({ ...prev, [field]: v }))}
                placeholder={`Informar ${field.toLowerCase()}`}
                placeholderTextColor="#64748B"
              />
            </View>
          ))}

          <View style={{ marginTop: 8, marginBottom: 12 }}>
            <Text style={s.label}>Observacoes gerais</Text>
            <TextInput
              style={[s.input, { minHeight: 80 }]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Opcional"
              placeholderTextColor="#64748B"
            />
          </View>

          <View style={s.infoBox}>
            <Text style={s.infoText}>
              Todos os campos sao opcionais. Preencha somente o que se aplica
              ao atendimento atual. A ficha pode ser atualizada criando uma
              nova entrada da mesma especialidade.
            </Text>
          </View>
        </ScrollView>

        <View style={s.footer}>
          <Pressable
            onPress={handleSave}
            disabled={saveMut.isPending}
            style={[s.saveBtn, saveMut.isPending && { opacity: 0.5 }]}
          >
            {saveMut.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.saveBtnText}>Salvar ficha</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ──────── Styles ────────
const s = StyleSheet.create({
  modal:   { flex: 1, backgroundColor: '#0F172A' },
  header:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#1E293B',
    gap: 8,
  },
  title:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  subtitle: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  closeBtn: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#1E293B', borderRadius: 8 },
  closeBtnText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },

  body:        { flex: 1 },
  bodyContent: { padding: 16 },

  sectionLabel: {
    color: '#94A3B8', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12,
  },

  specGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  specCard: {
    minWidth: '45%', flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12, padding: 16,
    alignItems: 'center',
    borderWidth: 0.5, borderColor: '#334155',
    gap: 6,
  },
  specIcon:   { fontSize: 28 },
  specLabel:  { color: '#fff', fontSize: 14, fontWeight: '700' },
  specFields: { color: '#94A3B8', fontSize: 11 },

  label: {
    color: '#94A3B8', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6,
  },
  input: {
    backgroundColor: '#1E293B', borderRadius: 8, padding: 10,
    color: '#fff', fontSize: 14,
    borderWidth: 1, borderColor: '#334155',
  },

  infoBox: {
    marginTop: 4, padding: 10, backgroundColor: 'rgba(6,182,212,0.08)',
    borderRadius: 6, borderWidth: 0.5, borderColor: 'rgba(6,182,212,0.2)',
  },
  infoText: { color: '#06B6D4', fontSize: 11, lineHeight: 16 },

  footer:  { padding: 16, borderTopWidth: 1, borderTopColor: '#1E293B' },
  saveBtn: {
    backgroundColor: '#06B6D4', paddingVertical: 12, borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default AddSpecialtyFormModal;
