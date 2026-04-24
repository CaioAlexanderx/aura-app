// ============================================================
// AURA. — AddPerioExamModal (W1-01 f3)
//
// Modal simplificado pra criar um novo exame periodontal.
// MVP: cabecalho do exame (data, indices, diagnostico, notas).
// Input completo dente-a-dente fica pra V2.
//
// Uso:
//   <AddPerioExamModal
//     visible
//     patientId={p.id}
//     patientName={p.name}
//     onClose={...}
//     onSaved={() => qc.invalidateQueries(['dental-perio'])}
//   />
// ============================================================

import { useState } from 'react';
import {
  Modal, View, Text, ScrollView, TextInput, Pressable,
  StyleSheet, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { request } from '@/services/api';
import { useAuthStore } from '@/stores/auth';

interface Props {
  visible: boolean;
  patientId: string;
  patientName?: string;
  onClose: () => void;
  onSaved?: () => void;
}

export function AddPerioExamModal({ visible, patientId, patientName, onClose, onSaved }: Props) {
  const cid = useAuthStore().company?.id;

  const [examDate, setExamDate]       = useState<string>(today());
  const [bleedingIdx, setBleedingIdx] = useState<string>('0');
  const [plaqueIdx, setPlaqueIdx]     = useState<string>('0');
  const [diagnosis, setDiagnosis]     = useState<string>('');
  const [notes, setNotes]             = useState<string>('');
  const [bleedingSites, setBleedSites] = useState<string>('');
  const [totalSites, setTotalSites]    = useState<string>('');

  const saveMut = useMutation({
    mutationFn: () =>
      request(`/companies/${cid}/dental/patients/${patientId}/perio`, {
        method: 'POST',
        body: {
          exam_date:      examDate || null,
          bleeding_index: clampPct(bleedingIdx),
          plaque_index:   clampPct(plaqueIdx),
          bleeding_sites: clampInt(bleedingSites),
          total_sites:    clampInt(totalSites),
          diagnosis:      diagnosis.trim() || null,
          notes:          notes.trim() || null,
          measurements:   {},
        },
      }),
    onSuccess: () => {
      Alert.alert('Exame salvo', 'Periograma registrado com sucesso.');
      onSaved?.();
      reset();
      onClose();
    },
    onError: (err: any) => {
      Alert.alert('Erro', err?.message || 'Nao foi possivel salvar o exame.');
    },
  });

  function reset() {
    setExamDate(today());
    setBleedingIdx('0');
    setPlaqueIdx('0');
    setDiagnosis('');
    setNotes('');
    setBleedSites('');
    setTotalSites('');
  }

  function handleSave() {
    const bi = parseInt(bleedingIdx) || 0;
    const pi = parseInt(plaqueIdx) || 0;
    if (bi < 0 || bi > 100 || pi < 0 || pi > 100) {
      Alert.alert('Valor invalido', 'Indices devem estar entre 0 e 100%.');
      return;
    }
    saveMut.mutate();
  }

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
            <Text style={s.title}>Novo exame periodontal</Text>
            {patientName && <Text style={s.subtitle}>{patientName}</Text>}
          </View>
          <Pressable onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeBtnText}>Cancelar</Text>
          </Pressable>
        </View>

        <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
          <Field label="Data do exame">
            <TextInput
              style={s.input}
              value={examDate}
              onChangeText={setExamDate}
              placeholder="AAAA-MM-DD"
              placeholderTextColor="#64748B"
            />
            <Text style={s.hint}>Formato ISO (ex: 2026-04-24)</Text>
          </Field>

          <View style={s.row}>
            <Field label="Indice de sangramento %" style={{ flex: 1 }}>
              <TextInput
                style={[s.input, indexColor(bleedingIdx, 20)]}
                value={bleedingIdx}
                onChangeText={setBleedingIdx}
                keyboardType="numeric"
                placeholder="0-100"
                placeholderTextColor="#64748B"
              />
              <Text style={s.hint}>&gt;20% indica doenca ativa</Text>
            </Field>

            <Field label="Indice de placa %" style={{ flex: 1 }}>
              <TextInput
                style={[s.input, indexColor(plaqueIdx, 30)]}
                value={plaqueIdx}
                onChangeText={setPlaqueIdx}
                keyboardType="numeric"
                placeholder="0-100"
                placeholderTextColor="#64748B"
              />
              <Text style={s.hint}>&gt;30% higiene inadequada</Text>
            </Field>
          </View>

          <View style={s.row}>
            <Field label="Sites com sangramento" style={{ flex: 1 }}>
              <TextInput
                style={s.input}
                value={bleedingSites}
                onChangeText={setBleedSites}
                keyboardType="numeric"
                placeholder="Opcional"
                placeholderTextColor="#64748B"
              />
            </Field>
            <Field label="Total de sites" style={{ flex: 1 }}>
              <TextInput
                style={s.input}
                value={totalSites}
                onChangeText={setTotalSites}
                keyboardType="numeric"
                placeholder="Opcional"
                placeholderTextColor="#64748B"
              />
            </Field>
          </View>

          <Field label="Diagnostico">
            <TextInput
              style={[s.input, { minHeight: 60 }]}
              value={diagnosis}
              onChangeText={setDiagnosis}
              multiline
              placeholder="Ex: Periodontite estagio III grau B"
              placeholderTextColor="#64748B"
            />
          </Field>

          <Field label="Observacoes">
            <TextInput
              style={[s.input, { minHeight: 80 }]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Opcional"
              placeholderTextColor="#64748B"
            />
          </Field>

          <View style={s.infoBox}>
            <Text style={s.infoText}>
              Versao simplificada pra MVP. Input completo dente-a-dente
              (6 medicoes por elemento, 32 dentes) sera liberado em breve.
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
              : <Text style={s.saveBtnText}>Salvar exame</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ──────── Helpers ────────
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function pad(n: number): string { return String(n).padStart(2, '0'); }
function clampPct(v: string): number {
  const n = parseInt(v) || 0;
  return Math.max(0, Math.min(100, n));
}
function clampInt(v: string): number {
  const n = parseInt(v) || 0;
  return Math.max(0, n);
}
function indexColor(v: string, threshold: number) {
  const n = parseInt(v) || 0;
  if (n > threshold) return { borderColor: '#F59E0B' };
  if (n > 0)         return { borderColor: '#10B981' };
  return {};
}

// ──────── Subcomponente Field ────────
function Field({ label, children, style }: { label: string; children: any; style?: any }) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
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
    gap: 12,
  },
  title:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  subtitle: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  closeBtn: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#1E293B', borderRadius: 8 },
  closeBtnText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },

  body:        { flex: 1 },
  bodyContent: { padding: 16, gap: 0 },

  row: { flexDirection: 'row', gap: 10 },

  label: {
    color: '#94A3B8', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6,
  },
  input: {
    backgroundColor: '#1E293B', borderRadius: 8, padding: 10,
    color: '#fff', fontSize: 14,
    borderWidth: 1, borderColor: '#334155',
  },
  hint: { color: '#64748B', fontSize: 10, marginTop: 4 },

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

export default AddPerioExamModal;
