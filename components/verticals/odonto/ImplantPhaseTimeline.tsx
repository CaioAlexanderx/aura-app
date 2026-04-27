// AURA. — ImplantPhaseTimeline
// Timeline das fases do tratamento de implante + modal de atualizacao.
// Extraido de ImplantWorkflow.tsx (decomposicao).

import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/services/api';

export const PHASE_KIND_LABEL: Record<string, string> = {
  planning:         'Planejamento',
  surgery:          'Cirurgia',
  osseointegration: 'Osseointegração',
  reopening:        'Reabertura',
  impression:       'Moldagem',
  prosthesis:       'Prótese',
  followup:         'Follow-up',
};

export const PHASE_STATUS_COLOR: Record<string, string> = {
  planned:     '#475569',
  in_progress: '#06B6D4',
  completed:   '#10B981',
  delayed:     '#F59E0B',
  skipped:     '#334155',
};

function fmt(v?: string | null) {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('pt-BR'); } catch { return '—'; }
}

function PhaseDot({ kind, status, onPress }: { kind: string; status: string; onPress: () => void }) {
  const color = PHASE_STATUS_COLOR[status] || '#475569';
  const done  = status === 'completed';
  return (
    <TouchableOpacity onPress={onPress} style={st.dotWrap}>
      <View style={[st.dot, { backgroundColor: color, borderColor: done ? '#10B981' : color }]}>
        {done && <Text style={st.dotCheck}>✓</Text>}
      </View>
      <Text style={st.dotLabel} numberOfLines={1}>{PHASE_KIND_LABEL[kind] || kind}</Text>
    </TouchableOpacity>
  );
}

interface Props { phases: any[]; treatmentId: string; companyId: string; }

export function ImplantPhaseTimeline({ phases, treatmentId, companyId }: Props) {
  const qc = useQueryClient();
  const [sel, setSel] = useState<any | null>(null);

  const patch = useMutation({
    mutationFn: ({ phaseId, status }: { phaseId: string; status: string }) =>
      request(`/companies/${companyId}/dental/implants/treatments/${treatmentId}/phases/${phaseId}`, {
        method: 'PATCH', body: { status },
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['implant-treatments'] }); setSel(null); },
    onError:   (e: any) => Alert.alert('Erro', e?.message),
  });

  const sorted = [...phases].sort((a, b) => a.phase_number - b.phase_number);

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 }}>
          {sorted.map((ph, i) => (
            <View key={ph.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
              {i > 0 && (
                <View style={{ width: 20, height: 2, backgroundColor: ph.status === 'completed' ? '#10B981' : '#1E293B', marginTop: -18 }} />
              )}
              <PhaseDot kind={ph.kind} status={ph.status} onPress={() => setSel(ph)} />
            </View>
          ))}
        </View>
      </ScrollView>

      {sel && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSel(null)}>
          <View style={st.overlay}>
            <View style={st.card}>
              <Text style={st.cardTitle}>{PHASE_KIND_LABEL[sel.kind] || sel.kind}</Text>
              <Text style={st.cardStatus}>
                Status: {sel.status === 'completed' ? '✓ Concluída' : sel.status}
              </Text>
              {sel.planned_date   && <Text style={st.meta}>Agendada: {fmt(sel.planned_date)}</Text>}
              {sel.completed_date && <Text style={st.meta}>Concluída: {fmt(sel.completed_date)}</Text>}
              {sel.notes          && <Text style={[st.meta, { lineHeight: 18, marginTop: 6 }]}>{sel.notes}</Text>}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                {sel.status !== 'completed' && (
                  <TouchableOpacity
                    onPress={() => patch.mutate({ phaseId: sel.id, status: 'completed' })}
                    style={[st.btn, { backgroundColor: '#10B981' }]}
                    disabled={patch.isPending}
                  >
                    {patch.isPending
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={st.btnTxt}>Marcar concluída</Text>
                    }
                  </TouchableOpacity>
                )}
                {sel.status === 'planned' && (
                  <TouchableOpacity
                    onPress={() => patch.mutate({ phaseId: sel.id, status: 'in_progress' })}
                    style={[st.btn, { backgroundColor: '#06B6D4' }]}
                    disabled={patch.isPending}
                  >
                    <Text style={st.btnTxt}>Iniciar fase</Text>
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
  dotWrap:   { alignItems: 'center', width: 52 },
  dot:       { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotCheck:  { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  dotLabel:  { color: '#64748B', fontSize: 8, marginTop: 4, width: 52, textAlign: 'center' },
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card:      { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: '#334155' },
  cardTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  cardStatus:{ color: '#06B6D4', fontSize: 13, marginBottom: 4 },
  meta:      { color: '#94A3B8', fontSize: 12, marginBottom: 2 },
  btn:       { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', minWidth: 100 },
  btnTxt:    { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});
