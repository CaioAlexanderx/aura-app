// AURA. — OrthoTreatmentCard
// Card expandivel de tratamento ortodontico com timeline de sessoes.
// Extraido de OrthoWorkflow.tsx (decomposicao).

import { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/services/api';
import { OrthoSessionTimeline, SESSION_TYPE_LABEL, fmtDate } from './OrthoSessionTimeline';

export const APPLIANCE_LABELS: Record<string, string> = {
  brackets_metal:'Brackets Metal', brackets_ceramic:'Brackets Ceramica',
  brackets_sapphire:'Brackets Safira', alinhadores:'Alinhadores',
  retainer:'Retentor', expansor:'Expansor',
  aparelho_movel:'Aparelho Movel', outro:'Outro',
};

export const APPLIANCE_ICON: Record<string, string> = {
  brackets_metal:'🦷', brackets_ceramic:'✨', brackets_sapphire:'💎',
  alinhadores:'👌', retainer:'🔒', expansor:'↔️',
  aparelho_movel:'🔧', outro:'⚙️',
};

const STATUS_LABEL: Record<string, string> = {
  planning:'Planejamento', active:'Ativo', retention:'Retencao',
  completed:'Concluido', abandoned:'Abandonado',
};
const STATUS_COLOR: Record<string, string> = {
  planning:'#94A3B8', active:'#10B981', retention:'#8B5CF6',
  completed:'#06B6D4', abandoned:'#EF4444',
};

const SESSION_TYPE_OPTIONS = [
  'adjustment','wire_change','avaliacao','instalacao',
  'bracket_repair','retainer_check','removal','photos','xray','other',
];

interface Props { t: any; companyId: string; }

export function OrthoTreatmentCard({ t, companyId }: Props) {
  const [expanded,       setExpanded]       = useState(false);
  const [showAddSession, setShowAddSession] = useState(false);
  const [sessionType,    setSessionType]    = useState('adjustment');
  const [sessionDate,    setSessionDate]    = useState('');
  const qc = useQueryClient();

  const sessions  = t.sessions || [];
  const planned   = parseInt(t.total_sessions_planned) || 18;
  const statusCol = STATUS_COLOR[t.status] || '#94A3B8';

  const addMut = useMutation({
    mutationFn: () =>
      request(`/companies/${companyId}/dental/ortho/treatments/${t.id}/sessions`, {
        method: 'POST',
        body: { session_type: sessionType, planned_date: sessionDate || undefined },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ortho-treatments'] });
      setShowAddSession(false);
      setSessionDate('');
    },
    onError: (e: any) => Alert.alert('Erro', e?.message),
  });

  return (
    <View style={st.card}>
      {/* Header */}
      <TouchableOpacity onPress={() => setExpanded(e => !e)} style={st.header} activeOpacity={0.8}>
        <View style={st.headerLeft}>
          <Text style={st.icon}>{APPLIANCE_ICON[t.appliance_type] || '🦷'}</Text>
          <View>
            <Text style={st.number}>{t.treatment_number}</Text>
            <Text style={st.appliance}>{APPLIANCE_LABELS[t.appliance_type] || t.appliance_type}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[st.statusChip, { backgroundColor: `${statusCol}22` }]}>
            <Text style={[st.statusTxt, { color: statusCol }]}>{STATUS_LABEL[t.status] || t.status}</Text>
          </View>
          <Text style={{ color: '#475569', fontSize: 10 }}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {/* Meta */}
      <View style={st.metaRow}>
        {t.start_date           && <Text style={st.metaChip}>📅 Inicio: {fmtDate(t.start_date)}</Text>}
        {t.expected_end_date    && <Text style={st.metaChip}>🏁 Prev: {fmtDate(t.expected_end_date)}</Text>}
        {t.practitioner_name    && <Text style={st.metaChip}>👤 {t.practitioner_name}</Text>}
        {t.estimated_duration_months && <Text style={st.metaChip}>⏱ {t.estimated_duration_months} meses</Text>}
      </View>

      {/* Timeline */}
      <OrthoSessionTimeline
        sessions={sessions}
        totalPlanned={planned}
        treatmentId={t.id}
        companyId={companyId}
      />

      {/* Expanded */}
      {expanded && (
        <View style={st.expanded}>
          {t.chief_complaint && (
            <View style={st.block}>
              <Text style={st.blockLabel}>Queixa principal</Text>
              <Text style={st.blockText}>{t.chief_complaint}</Text>
            </View>
          )}
          {t.diagnosis && (
            <View style={st.block}>
              <Text style={st.blockLabel}>Diagnostico</Text>
              <Text style={st.blockText}>{t.diagnosis}</Text>
            </View>
          )}

          {!showAddSession ? (
            <TouchableOpacity onPress={() => setShowAddSession(true)} style={st.addSessionBtn}>
              <Text style={st.addSessionBtnTxt}>+ Adicionar sessao</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ marginTop: 8, gap: 4 }}>
              <Text style={st.blockLabel}>Tipo de sessao</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {SESSION_TYPE_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setSessionType(opt)}
                    style={[st.typeChip, sessionType === opt && st.typeChipActive]}
                  >
                    <Text style={[st.typeChipTxt, sessionType === opt && st.typeChipTxtActive]}>
                      {SESSION_TYPE_LABEL[opt] || opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={[st.blockLabel, { marginTop: 10 }]}>Data planejada</Text>
              <TextInput style={st.input} placeholder="DD/MM/AAAA (opcional)" placeholderTextColor="#475569" keyboardType="numeric" value={sessionDate} onChangeText={setSessionDate} />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity onPress={() => addMut.mutate()} disabled={addMut.isPending} style={[st.confirmBtn, addMut.isPending && { opacity: 0.6 }]}>
                  {addMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.confirmBtnTxt}>Adicionar</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowAddSession(false)} style={st.cancelBtn}>
                  <Text style={st.cancelBtnTxt}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  card:        { backgroundColor: '#1E293B', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 0.5, borderColor: '#334155' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon:        { fontSize: 24 },
  number:      { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  appliance:   { color: '#94A3B8', fontSize: 11, marginTop: 1 },
  statusChip:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusTxt:   { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  metaRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  metaChip:    { color: '#94A3B8', fontSize: 11, backgroundColor: '#0F172A', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  expanded:    { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 12, marginTop: 8 },
  block:       { marginBottom: 10 },
  blockLabel:  { color: '#64748B', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  blockText:   { color: '#CBD5E1', fontSize: 12, lineHeight: 18 },
  addSessionBtn:{ marginTop: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: '#8B5CF6', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  addSessionBtnTxt:{ color: '#8B5CF6', fontSize: 13, fontWeight: '600' },
  typeChip:    { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: '#1E293B', marginRight: 8, borderWidth: 1, borderColor: '#334155' },
  typeChipActive:  { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  typeChipTxt:     { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  typeChipTxtActive:{ color: '#FFFFFF' },
  input:       { backgroundColor: '#0F172A', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, color: '#FFFFFF', fontSize: 13, borderWidth: 1, borderColor: '#334155' },
  confirmBtn:  { flex: 1, backgroundColor: '#8B5CF6', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  confirmBtnTxt:{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  cancelBtn:   { flex: 1, backgroundColor: '#1E293B', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  cancelBtnTxt:{ color: '#94A3B8', fontSize: 13, fontWeight: '600' },
});
