// AURA. — OrthoSessionTimeline
// Timeline horizontal de sessoes + modal de registro.
// Extraido de OrthoWorkflow.tsx (decomposicao).

import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/services/api';

export const SESSION_TYPE_LABEL: Record<string, string> = {
  avaliacao:'Avaliacao', instalacao:'Instalacao', adjustment:'Ajuste',
  wire_change:'Troca de fio', bracket_repair:'Reparo bracket',
  retainer_check:'Checar retentor', removal:'Remocao',
  photos:'Fotos', xray:'Raio-X', other:'Outro',
};

export function fmtDate(v?: string | null) {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('pt-BR'); } catch { return '—'; }
}

interface Props {
  sessions:     any[];
  totalPlanned: number;
  treatmentId:  string;
  companyId:    string;
}

export function OrthoSessionTimeline({ sessions, totalPlanned, treatmentId, companyId }: Props) {
  const qc = useQueryClient();
  const [sel,   setSel]   = useState<any | null>(null);
  const [evol,  setEvol]  = useState('');
  const [wireU, setWireU] = useState('');
  const [wireL, setWireL] = useState('');

  const patch = useMutation({
    mutationFn: (body: any) =>
      request(`/companies/${companyId}/dental/ortho/treatments/${treatmentId}/sessions/${sel.id}`, {
        method: 'PATCH', body,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ortho-treatments'] }); setSel(null); },
    onError:   (e: any) => Alert.alert('Erro', e?.message),
  });

  const done   = sessions.filter(s => s.status === 'completed').length;
  const total  = Math.max(totalPlanned, sessions.length);
  const pct    = total > 0 ? Math.round((done / total) * 100) : 0;
  const sorted = [...sessions].sort((a, b) => a.session_number - b.session_number);

  return (
    <>
      {/* Barra de progresso */}
      <View style={st.progressWrap}>
        <View style={st.progressBar}>
          <View style={[st.progressFill, { width: `${pct}%` }]} />
        </View>
        <Text style={st.progressLabel}>{done}/{total} ({pct}%)</Text>
      </View>

      {/* Dots de sessoes */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 }}>
          {sorted.map((sess, i) => {
            const isDone = sess.status === 'completed';
            const col    = isDone ? '#10B981' : sess.status === 'cancelled' ? '#EF4444' : '#475569';
            return (
              <TouchableOpacity
                key={sess.id}
                onPress={() => { setSel(sess); setEvol(sess.evolution || ''); setWireU(sess.wire_upper || ''); setWireL(sess.wire_lower || ''); }}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                {i > 0 && <View style={{ width: 16, height: 2, backgroundColor: isDone ? '#10B981' : '#1E293B', marginTop: -22 }} />}
                <View>
                  <View style={[st.dot, { backgroundColor: col, borderColor: col }]}>
                    {isDone && <Text style={st.dotCheck}>✓</Text>}
                  </View>
                  <Text style={st.dotLabel}>S{sess.session_number}</Text>
                  {sess.planned_date && <Text style={st.dotDate}>{fmtDate(sess.planned_date).slice(0, 5)}</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
          {/* Slots vazios */}
          {Array.from({ length: Math.max(0, totalPlanned - sessions.length) }).map((_, i) => (
            <View key={`e${i}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
              {(i + sessions.length) > 0 && <View style={{ width: 16, height: 2, backgroundColor: '#1E293B', marginTop: -22 }} />}
              <View>
                <View style={[st.dot, { backgroundColor: '#1E293B', borderColor: '#334155' }]} />
                <Text style={st.dotLabel}>S{sessions.length + i + 1}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Modal de sessao */}
      {sel && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSel(null)}>
          <View style={st.overlay}>
            <View style={st.card}>
              <Text style={st.cardTitle}>
                Sessao {sel.session_number} — {SESSION_TYPE_LABEL[sel.session_type] || sel.session_type}
              </Text>
              {sel.planned_date && <Text style={st.meta}>Data: {fmtDate(sel.planned_date)}</Text>}
              {sel.status === 'completed' && (
                <Text style={[st.meta, { color: '#10B981' }]}>✓ Concluida em {fmtDate(sel.completed_date)}</Text>
              )}
              {sel.status !== 'completed' && (
                <>
                  <Text style={st.lbl}>Fio superior</Text>
                  <TextInput style={st.inp} placeholder="Ex: 0.014 NiTi" placeholderTextColor="#475569" value={wireU} onChangeText={setWireU} />
                  <Text style={st.lbl}>Fio inferior</Text>
                  <TextInput style={st.inp} placeholder="Ex: 0.019x0.025 SS" placeholderTextColor="#475569" value={wireL} onChangeText={setWireL} />
                  <Text style={st.lbl}>Evolucao</Text>
                  <TextInput style={[st.inp, { height: 72, textAlignVertical: 'top' }]} placeholder="Descreva o que foi feito..." placeholderTextColor="#475569" multiline value={evol} onChangeText={setEvol} />
                </>
              )}
              {sel.status === 'completed' && (
                <>
                  {sel.wire_upper && <Text style={st.meta}>↑ {sel.wire_upper}</Text>}
                  {sel.wire_lower && <Text style={st.meta}>↓ {sel.wire_lower}</Text>}
                  {sel.evolution  && <Text style={[st.meta, { lineHeight: 18 }]}>{sel.evolution}</Text>}
                </>
              )}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                {sel.status !== 'completed' && (
                  <TouchableOpacity
                    onPress={() => patch.mutate({ status: 'completed', wire_upper: wireU || undefined, wire_lower: wireL || undefined, evolution: evol || undefined })}
                    style={[st.btn, { backgroundColor: '#10B981' }]}
                    disabled={patch.isPending}
                  >
                    {patch.isPending
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={st.btnTxt}>Registrar como concluida</Text>
                    }
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setSel(null)} style={[st.btn, { backgroundColor: '#1E293B' }]}>
                  <Text style={[st.btnTxt, { color: '#94A3B8' }]}>Fechar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const st = StyleSheet.create({
  progressWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  progressBar:   { flex: 1, height: 5, backgroundColor: '#0F172A', borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: 5, backgroundColor: '#8B5CF6', borderRadius: 3 },
  progressLabel: { color: '#64748B', fontSize: 11, minWidth: 60, textAlign: 'right' },
  dot:           { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotCheck:      { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  dotLabel:      { color: '#64748B', fontSize: 8, marginTop: 2, width: 28, textAlign: 'center' },
  dotDate:       { color: '#475569', fontSize: 7, width: 28, textAlign: 'center' },
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card:          { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, width: '100%', maxWidth: 380, borderWidth: 1, borderColor: '#334155' },
  cardTitle:     { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  meta:          { color: '#94A3B8', fontSize: 12, marginBottom: 3 },
  lbl:           { color: '#64748B', fontSize: 11, fontWeight: '600', marginTop: 10, marginBottom: 4, textTransform: 'uppercase' },
  inp:           { backgroundColor: '#0F172A', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, color: '#FFFFFF', fontSize: 13, borderWidth: 1, borderColor: '#334155' },
  btn:           { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnTxt:        { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});
