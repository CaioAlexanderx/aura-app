// AURA. — OrthoTreatmentForm
// Modal de criacao de novo tratamento ortodontico.
// Extraido de OrthoWorkflow.tsx (decomposicao).

import { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/services/api';
import { APPLIANCE_LABELS, APPLIANCE_ICON } from './OrthoTreatmentCard';

const APPLIANCE_OPTIONS = Object.keys(APPLIANCE_LABELS);

interface Props {
  companyId:  string;
  customerId: string;
  onClose:    () => void;
  onCreated:  () => void;
}

export function OrthoTreatmentForm({ companyId, customerId, onClose, onCreated }: Props) {
  const [applianceType,    setApplianceType]    = useState('brackets_metal');
  const [arch,             setArch]             = useState('both');
  const [chiefComplaint,   setChiefComplaint]   = useState('');
  const [startDate,        setStartDate]        = useState('');
  const [durationMonths,   setDurationMonths]   = useState('18');
  const [sessionsPlanned,  setSessionsPlanned]  = useState('18');
  const [totalValue,       setTotalValue]       = useState('');
  const [notes,            setNotes]            = useState('');

  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () =>
      request(`/companies/${companyId}/dental/ortho/treatments`, {
        method: 'POST',
        body: {
          customer_id:                customerId,
          appliance_type:             applianceType,
          arch,
          chief_complaint:            chiefComplaint  || undefined,
          start_date:                 startDate       || undefined,
          estimated_duration_months:  parseInt(durationMonths)  || 18,
          total_sessions_planned:     parseInt(sessionsPlanned) || 18,
          total_value:                totalValue ? parseFloat(totalValue.replace(',', '.')) : undefined,
          notes:                      notes || undefined,
        },
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ortho-treatments'] }); onCreated(); },
    onError:   (e: any) => Alert.alert('Erro', e?.message || 'Nao foi possivel criar o tratamento.'),
  });

  return (
    <Modal visible animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}>
      <View style={st.modal}>
        <View style={st.header}>
          <Text style={st.title}>Novo Tratamento Ortodontico</Text>
          <TouchableOpacity onPress={onClose}><Text style={st.cancel}>Cancelar</Text></TouchableOpacity>
        </View>

        <ScrollView style={st.scroll} keyboardShouldPersistTaps="handled">
          <Text style={st.lbl}>Tipo de aparelho</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            {APPLIANCE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt}
                onPress={() => setApplianceType(opt)}
                style={[st.chip, applianceType === opt && st.chipActive]}
              >
                <Text style={st.chipIcon}>{APPLIANCE_ICON[opt]}</Text>
                <Text style={[st.chipTxt, applianceType === opt && st.chipTxtActive]}>{APPLIANCE_LABELS[opt]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={st.lbl}>Arcada</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
            {(['both', 'upper', 'lower'] as const).map(a => (
              <TouchableOpacity key={a} onPress={() => setArch(a)} style={[st.archChip, arch === a && st.archChipActive]}>
                <Text style={[st.archTxt, arch === a && st.archTxtActive]}>
                  {a === 'both' ? 'Ambas' : a === 'upper' ? 'Superior' : 'Inferior'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={st.lbl}>Queixa principal</Text>
          <TextInput style={[st.input, { height: 72, textAlignVertical: 'top' }]} placeholder="Descreva a queixa do paciente..." placeholderTextColor="#475569" multiline value={chiefComplaint} onChangeText={setChiefComplaint} />

          <Text style={st.lbl}>Data de inicio</Text>
          <TextInput style={st.input} placeholder="DD/MM/AAAA" placeholderTextColor="#475569" keyboardType="numeric" value={startDate} onChangeText={setStartDate} />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={st.lbl}>Duracao (meses)</Text>
              <TextInput style={st.input} placeholder="18" placeholderTextColor="#475569" keyboardType="numeric" value={durationMonths} onChangeText={setDurationMonths} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.lbl}>Sessoes previstas</Text>
              <TextInput style={st.input} placeholder="18" placeholderTextColor="#475569" keyboardType="numeric" value={sessionsPlanned} onChangeText={setSessionsPlanned} />
            </View>
          </View>

          <Text style={st.lbl}>Valor total (R$)</Text>
          <TextInput style={st.input} placeholder="Ex: 3800,00" placeholderTextColor="#475569" keyboardType="decimal-pad" value={totalValue} onChangeText={setTotalValue} />

          <Text style={st.lbl}>Observacoes</Text>
          <TextInput style={[st.input, { height: 72, textAlignVertical: 'top' }]} placeholder="Observacoes adicionais..." placeholderTextColor="#475569" multiline value={notes} onChangeText={setNotes} />

          <TouchableOpacity
            onPress={() => mut.mutate()}
            disabled={mut.isPending}
            style={[st.submitBtn, mut.isPending && { opacity: 0.6 }]}
          >
            {mut.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={st.submitTxt}>Criar Tratamento</Text>
            }
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  modal:        { flex: 1, backgroundColor: '#0F172A' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 16 : 24, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  title:        { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  cancel:       { color: '#EF4444', fontSize: 14, fontWeight: '600' },
  scroll:       { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  lbl:          { color: '#94A3B8', fontSize: 11, fontWeight: '600', marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:        { backgroundColor: '#1E293B', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#FFFFFF', fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1E293B', marginRight: 8, borderWidth: 1, borderColor: '#334155' },
  chipActive:   { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  chipIcon:     { fontSize: 14 },
  chipTxt:      { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  chipTxtActive:{ color: '#FFFFFF' },
  archChip:     { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  archChipActive:{ backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  archTxt:      { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  archTxtActive:{ color: '#FFFFFF' },
  submitBtn:    { backgroundColor: '#8B5CF6', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitTxt:    { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
