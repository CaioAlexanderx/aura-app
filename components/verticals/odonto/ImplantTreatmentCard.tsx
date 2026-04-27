// AURA. — ImplantTreatmentCard
// Card expandivel do tratamento de implante com timeline de fases e lista de pinos.
// Extraido de ImplantWorkflow.tsx (decomposicao).

import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ImplantPhaseTimeline, PHASE_STATUS_COLOR } from './ImplantPhaseTimeline';

const TREATMENT_STATUS_LABEL: Record<string, string> = {
  planning:'Planejamento', pre_surgical:'Pré-cirúrgico', surgical:'Cirúrgico',
  osseointegration:'Osseointegração', prosthetic:'Protético',
  completed:'Concluído', abandoned:'Abandonado',
};
const TREATMENT_STATUS_COLOR: Record<string, string> = {
  planning:'#94A3B8', pre_surgical:'#6366F1', surgical:'#06B6D4',
  osseointegration:'#F59E0B', prosthetic:'#8B5CF6',
  completed:'#10B981', abandoned:'#EF4444',
};

function fmt(v?: string | null) {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('pt-BR'); } catch { return '—'; }
}
function fmtBRL(v?: number | string | null) {
  const n = parseFloat(v as string) || 0;
  const [int, dec] = n.toFixed(2).split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

interface Props { treatment: any; companyId: string; }

export function ImplantTreatmentCard({ treatment, companyId }: Props) {
  const [expanded, setExpanded] = useState(false);

  const statusColor = TREATMENT_STATUS_COLOR[treatment.status] || '#94A3B8';
  const statusLabel = TREATMENT_STATUS_LABEL[treatment.status] || treatment.status;
  const phases      = treatment.phases   || [];
  const implants    = treatment.implants || [];
  const doneCount   = phases.filter((p: any) => p.status === 'completed').length;

  return (
    <View style={st.card}>
      {/* Header */}
      <TouchableOpacity onPress={() => setExpanded(e => !e)} style={st.header} activeOpacity={0.8}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={st.number}>{treatment.treatment_number}</Text>
          <View style={[st.statusChip, { backgroundColor: `${statusColor}22` }]}>
            <Text style={[st.statusTxt, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        <Text style={{ color: '#475569', fontSize: 10 }}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* Meta */}
      <View style={st.metaRow}>
        {treatment.surgery_date     && <Text style={st.metaChip}>📅 Cirurgia: {fmt(treatment.surgery_date)}</Text>}
        {treatment.practitioner_name && <Text style={st.metaChip}>👤 {treatment.practitioner_name}</Text>}
        {treatment.total_value       && <Text style={st.metaChip}>R$ {fmtBRL(treatment.total_value)}</Text>}
      </View>

      {/* Progresso */}
      <View style={st.progressRow}>
        <View style={st.progressBar}>
          <View style={[st.progressFill, { width: phases.length > 0 ? `${(doneCount / phases.length) * 100}%` : '0%' }]} />
        </View>
        <Text style={st.progressLabel}>{doneCount}/{phases.length} fases</Text>
      </View>

      {/* Timeline de fases */}
      {phases.length > 0 && (
        <ImplantPhaseTimeline phases={phases} treatmentId={treatment.id} companyId={companyId} />
      )}

      {/* Expanded: pinos */}
      {expanded && (
        <View style={st.expanded}>
          {implants.length === 0 ? (
            <Text style={st.noImplants}>Nenhum pino registrado ainda.</Text>
          ) : (
            implants.map((imp: any) => (
              <View key={imp.id} style={st.implantRow}>
                <View style={st.toothBadge}>
                  <Text style={st.toothTxt}>{imp.tooth_number}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.brandTxt}>{imp.brand_name || imp.brand_name_global || 'Marca não informada'}</Text>
                  {imp.model      && <Text style={st.modelTxt}>{imp.model}</Text>}
                  {imp.lot_number && (
                    <View style={{ flexDirection: 'row', gap: 4, marginTop: 3 }}>
                      <Text style={st.lotLbl}>Lote ANVISA:</Text>
                      <Text style={st.lotVal}>{imp.lot_number}</Text>
                    </View>
                  )}
                  {imp.size_diameter_mm && imp.size_length_mm && (
                    <Text style={st.sizeTxt}>∅ {imp.size_diameter_mm} mm × {imp.size_length_mm} mm</Text>
                  )}
                </View>
                <View style={[st.statusDot, { backgroundColor: imp.status === 'active' ? '#10B981' : imp.status === 'failed' ? '#EF4444' : '#475569' }]} />
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  card:        { backgroundColor: '#1E293B', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 0.5, borderColor: '#334155' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  number:      { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  statusChip:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusTxt:   { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  metaRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  metaChip:    { color: '#94A3B8', fontSize: 11, backgroundColor: '#0F172A', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  progressBar: { flex: 1, height: 4, backgroundColor: '#0F172A', borderRadius: 2, overflow: 'hidden' },
  progressFill:{ height: 4, backgroundColor: '#10B981', borderRadius: 2 },
  progressLabel:{ color: '#64748B', fontSize: 11, minWidth: 50, textAlign: 'right' },
  expanded:    { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 12, marginTop: 8 },
  noImplants:  { color: '#64748B', fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  implantRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#0F172A' },
  toothBadge:  { backgroundColor: '#0F172A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 44, alignItems: 'center' },
  toothTxt:    { color: '#06B6D4', fontSize: 14, fontWeight: '700' },
  brandTxt:    { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },
  modelTxt:    { color: '#94A3B8', fontSize: 11, marginTop: 1 },
  lotLbl:      { color: '#64748B', fontSize: 10, fontWeight: '600' },
  lotVal:      { color: '#F59E0B', fontSize: 10, fontWeight: '700' },
  sizeTxt:     { color: '#475569', fontSize: 10, marginTop: 2 },
  statusDot:   { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
});
