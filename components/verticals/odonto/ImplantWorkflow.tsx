// ============================================================
// AURA. — ImplantWorkflow (W3 Sprint 1 F3)
// Tab "Implantes" dentro do PatientHub.
//
// Funcionalidades:
//   - Lista tratamentos do paciente (GET /dental/implants/treatments?customer_id=)
//   - Timeline visual das 7 fases por tratamento
//   - Card expandivel: implantes por dente (FDI) + lot_number ANVISA
//   - Formulario inline para criar novo tratamento
//   - PATCH de fase (concluir / agendar)
//   - Selector de marca (globais seed + customizadas da clinica)
// ============================================================

import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, Modal, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import type { PatientLite } from '@/components/verticals/odonto/PatientHub';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const PHASE_KIND_LABEL: Record<string, string> = {
  planning:         'Planejamento',
  surgery:          'Cirurgia',
  osseointegration: 'Osseointegra\u00e7\u00e3o',
  reopening:        'Reabertura',
  impression:       'Moldagem',
  prosthesis:       'Pr\u00f3tese',
  followup:         'Follow-up',
};

const PHASE_STATUS_COLOR: Record<string, string> = {
  planned:     '#475569',
  in_progress: '#06B6D4',
  completed:   '#10B981',
  delayed:     '#F59E0B',
  skipped:     '#334155',
};

const TREATMENT_STATUS_LABEL: Record<string, string> = {
  planning:         'Planejamento',
  pre_surgical:     'Pr\u00e9-cir\u00fargico',
  surgical:         'Cir\u00fargico',
  osseointegration: 'Osseointegra\u00e7\u00e3o',
  prosthetic:       'Prot\u00e9tico',
  completed:        'Conclu\u00eddo',
  abandoned:        'Abandonado',
};

const TREATMENT_STATUS_COLOR: Record<string, string> = {
  planning:         '#94A3B8',
  pre_surgical:     '#6366F1',
  surgical:         '#06B6D4',
  osseointegration: '#F59E0B',
  prosthetic:       '#8B5CF6',
  completed:        '#10B981',
  abandoned:        '#EF4444',
};

const SURGERY_TYPES = ['Convencional', 'Guiada', 'Imediata', 'Mini-implante', 'Zigom\u00e1tico'];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function fmt(v?: string | null) {
  if (!v) return '\u2014';
  try { return new Date(v).toLocaleDateString('pt-BR'); } catch { return '\u2014'; }
}

function fmtBRL(v?: number | string | null) {
  const n = parseFloat(v as string) || 0;
  if (!isFinite(n)) return '0,00';
  const [int, dec] = n.toFixed(2).split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

// ─────────────────────────────────────────────────────────────
// Phase Timeline
// ─────────────────────────────────────────────────────────────
function PhaseDot({ kind, status, onPress }: {
  kind: string;
  status: string;
  onPress: () => void;
}) {
  const color = PHASE_STATUS_COLOR[status] || '#475569';
  const done  = status === 'completed';
  return (
    <TouchableOpacity onPress={onPress} style={styles.phaseDotWrap}>
      <View style={[styles.phaseDot, { backgroundColor: color, borderColor: done ? '#10B981' : color }]}>
        {done && <Text style={styles.phaseDotCheck}>\u2713</Text>}
      </View>
      <Text style={styles.phaseDotLabel} numberOfLines={1}>{PHASE_KIND_LABEL[kind] || kind}</Text>
    </TouchableOpacity>
  );
}

function PhaseTimeline({ phases, treatmentId, companyId }: {
  phases: any[];
  treatmentId: string;
  companyId: string;
}) {
  const qc = useQueryClient();
  const [selectedPhase, setSelectedPhase] = useState<any | null>(null);

  const patchMut = useMutation({
    mutationFn: ({ phaseId, status, notes }: { phaseId: string; status: string; notes?: string }) =>
      request(`/companies/${companyId}/dental/implants/treatments/${treatmentId}/phases/${phaseId}`, {
        method: 'PATCH', body: { status, notes },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['implant-treatments'] });
      setSelectedPhase(null);
    },
    onError: (err: any) => Alert.alert('Erro', err?.message || 'Nao foi possivel atualizar a fase.'),
  });

  const sorted = [...phases].sort((a, b) => a.phase_number - b.phase_number);

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timelineScroll}>
        <View style={styles.timelineRow}>
          {sorted.map((ph, i) => (
            <View key={ph.id} style={styles.timelineStep}>
              {i > 0 && (
                <View style={[
                  styles.timelineConnector,
                  { backgroundColor: ph.status === 'completed' ? '#10B981' : '#1E293B' },
                ]} />
              )}
              <PhaseDot
                kind={ph.kind}
                status={ph.status}
                onPress={() => setSelectedPhase(ph)}
              />
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Modal rapido de fase */}
      {selectedPhase && (
        <Modal
          visible={!!selectedPhase}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedPhase(null)}
        >
          <View style={styles.phaseModalOverlay}>
            <View style={styles.phaseModalCard}>
              <Text style={styles.phaseModalTitle}>
                {PHASE_KIND_LABEL[selectedPhase.kind] || selectedPhase.kind}
              </Text>
              <Text style={styles.phaseModalStatus}>
                Status: {selectedPhase.status === 'completed' ? '\u2713 Concluida' : selectedPhase.status}
              </Text>
              {selectedPhase.planned_date && (
                <Text style={styles.phaseModalMeta}>Agendada: {fmt(selectedPhase.planned_date)}</Text>
              )}
              {selectedPhase.completed_date && (
                <Text style={styles.phaseModalMeta}>Concluida: {fmt(selectedPhase.completed_date)}</Text>
              )}
              {selectedPhase.notes && (
                <Text style={styles.phaseModalNotes}>{selectedPhase.notes}</Text>
              )}
              <View style={styles.phaseModalBtns}>
                {selectedPhase.status !== 'completed' && (
                  <TouchableOpacity
                    onPress={() => patchMut.mutate({ phaseId: selectedPhase.id, status: 'completed' })}
                    style={[styles.phaseBtn, { backgroundColor: '#10B981' }]}
                    disabled={patchMut.isPending}
                  >
                    {patchMut.isPending
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.phaseBtnText}>Marcar concluida</Text>
                    }
                  </TouchableOpacity>
                )}
                {selectedPhase.status === 'planned' && (
                  <TouchableOpacity
                    onPress={() => patchMut.mutate({ phaseId: selectedPhase.id, status: 'in_progress' })}
                    style={[styles.phaseBtn, { backgroundColor: '#06B6D4' }]}
                    disabled={patchMut.isPending}
                  >
                    <Text style={styles.phaseBtnText}>Iniciar fase</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setSelectedPhase(null)}
                  style={[styles.phaseBtn, { backgroundColor: '#1E293B' }]}
                >
                  <Text style={[styles.phaseBtnText, { color: '#94A3B8' }]}>Fechar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Treatment Card
// ─────────────────────────────────────────────────────────────
function TreatmentCard({ treatment, companyId }: { treatment: any; companyId: string }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = TREATMENT_STATUS_COLOR[treatment.status] || '#94A3B8';
  const statusLabel = TREATMENT_STATUS_LABEL[treatment.status] || treatment.status;

  const phases   = treatment.phases   || [];
  const implants = treatment.implants || [];
  const doneCount = phases.filter((p: any) => p.status === 'completed').length;

  return (
    <View style={styles.treatmentCard}>
      {/* Header */}
      <TouchableOpacity onPress={() => setExpanded(e => !e)} style={styles.treatmentHeader} activeOpacity={0.8}>
        <View style={styles.treatmentHeaderLeft}>
          <Text style={styles.treatmentNumber}>{treatment.treatment_number}</Text>
          <View style={[styles.statusChip, { backgroundColor: `${statusColor}22` }]}>
            <Text style={[styles.statusChipText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        <Text style={styles.expandIcon}>{expanded ? '\u25B2' : '\u25BC'}</Text>
      </TouchableOpacity>

      {/* Summary row */}
      <View style={styles.treatmentMeta}>
        {treatment.surgery_date && (
          <Text style={styles.metaChip}>\uD83D\uDCC5 Cirurgia: {fmt(treatment.surgery_date)}</Text>
        )}
        {treatment.practitioner_name && (
          <Text style={styles.metaChip}>\uD83D\uDC64 {treatment.practitioner_name}</Text>
        )}
        {treatment.total_value && (
          <Text style={styles.metaChip}>R$ {fmtBRL(treatment.total_value)}</Text>
        )}
      </View>

      {/* Progress */}
      <View style={styles.progressRow}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: phases.length > 0 ? `${(doneCount / phases.length) * 100}%` : '0%' },
            ]}
          />
        </View>
        <Text style={styles.progressLabel}>{doneCount}/{phases.length} fases</Text>
      </View>

      {/* Phase Timeline */}
      {phases.length > 0 && (
        <PhaseTimeline phases={phases} treatmentId={treatment.id} companyId={companyId} />
      )}

      {/* Expanded: implantes */}
      {expanded && (
        <View style={styles.expandedSection}>
          {implants.length === 0 ? (
            <Text style={styles.noImplantsText}>Nenhum pino registrado ainda.</Text>
          ) : (
            implants.map((imp: any) => (
              <View key={imp.id} style={styles.implantRow}>
                <View style={styles.toothBadge}>
                  <Text style={styles.toothBadgeText}>{imp.tooth_number}</Text>
                </View>
                <View style={styles.implantInfo}>
                  <Text style={styles.implantBrand}>{imp.brand_name || imp.brand_name_global || 'Marca n\u00e3o informada'}</Text>
                  {imp.model && <Text style={styles.implantModel}>{imp.model}</Text>}
                  {imp.lot_number && (
                    <View style={styles.lotRow}>
                      <Text style={styles.lotLabel}>Lote ANVISA:</Text>
                      <Text style={styles.lotValue}>{imp.lot_number}</Text>
                    </View>
                  )}
                  {imp.size_diameter_mm && imp.size_length_mm && (
                    <Text style={styles.implantSize}>
                      \u2300 {imp.size_diameter_mm} mm \u00d7 {imp.size_length_mm} mm
                    </Text>
                  )}
                </View>
                <View style={[
                  styles.implantStatusDot,
                  { backgroundColor: imp.status === 'active' ? '#10B981' : imp.status === 'failed' ? '#EF4444' : '#475569' },
                ]} />
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// New Treatment Form (inline modal)
// ─────────────────────────────────────────────────────────────
interface NewTreatmentFormProps {
  companyId: string;
  customerId: string;
  brands: any[];
  onClose: () => void;
  onCreated: () => void;
}

function NewTreatmentForm({ companyId, customerId, brands, onClose, onCreated }: NewTreatmentFormProps) {
  const [diagnosis, setDiagnosis]     = useState('');
  const [surgeryDate, setSurgeryDate] = useState('');
  const [surgeryType, setSurgeryType] = useState('Convencional');
  const [totalValue, setTotalValue]   = useState('');
  const [notes, setNotes]             = useState('');
  const [usesGraft, setUsesGraft]     = useState(false);

  const qc = useQueryClient();

  const createMut = useMutation({
    mutationFn: () =>
      request(`/companies/${companyId}/dental/implants/treatments`, {
        method: 'POST',
        body: {
          customer_id: customerId,
          diagnosis:   diagnosis || undefined,
          surgery_date: surgeryDate || undefined,
          surgery_type: surgeryType,
          uses_graft:  usesGraft,
          total_value: totalValue ? parseFloat(totalValue.replace(',', '.')) : undefined,
          notes:       notes || undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['implant-treatments'] });
      onCreated();
    },
    onError: (err: any) => Alert.alert('Erro', err?.message || 'Nao foi possivel criar o tratamento.'),
  });

  return (
    <Modal visible animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}>
      <View style={styles.formModal}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Novo Tratamento de Implante</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.formClose}>Cancelar</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">

          <Text style={styles.formLabel}>Diagn\u00f3stico inicial</Text>
          <TextInput
            style={styles.formInput}
            placeholder="Ex: Edentulismo parcial posterior..."
            placeholderTextColor="#475569"
            multiline
            numberOfLines={3}
            value={diagnosis}
            onChangeText={setDiagnosis}
          />

          <Text style={styles.formLabel}>Data da cirurgia (DD/MM/AAAA)</Text>
          <TextInput
            style={styles.formInput}
            placeholder="Ex: 20/06/2026"
            placeholderTextColor="#475569"
            value={surgeryDate}
            onChangeText={setSurgeryDate}
            keyboardType="numeric"
          />

          <Text style={styles.formLabel}>Tipo de cirurgia</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {SURGERY_TYPES.map(st => (
              <TouchableOpacity
                key={st}
                onPress={() => setSurgeryType(st)}
                style={[styles.typeChip, surgeryType === st && styles.typeChipActive]}
              >
                <Text style={[styles.typeChipText, surgeryType === st && styles.typeChipTextActive]}>
                  {st}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.checkRow}>
            <TouchableOpacity
              onPress={() => setUsesGraft(g => !g)}
              style={[styles.checkbox, usesGraft && styles.checkboxChecked]}
            >
              {usesGraft && <Text style={styles.checkboxMark}>\u2713</Text>}
            </TouchableOpacity>
            <Text style={styles.checkLabel}>Utiliza enxerto \u00f3sseo</Text>
          </View>

          <Text style={styles.formLabel}>Valor total estimado (R$)</Text>
          <TextInput
            style={styles.formInput}
            placeholder="Ex: 4500,00"
            placeholderTextColor="#475569"
            keyboardType="decimal-pad"
            value={totalValue}
            onChangeText={setTotalValue}
          />

          <Text style={styles.formLabel}>Observa\u00e7\u00f5es</Text>
          <TextInput
            style={[styles.formInput, { height: 80 }]}
            placeholder="Observa\u00e7\u00f5es cl\u00ednicas..."
            placeholderTextColor="#475569"
            multiline
            value={notes}
            onChangeText={setNotes}
          />

          <View style={styles.formInfoBox}>
            <Text style={styles.formInfoText}>
              \u2139\uFE0F  7 fases ser\u00e3o criadas automaticamente: Planejamento, Cirurgia, Osseointegra\u00e7\u00e3o, Reabertura, Moldagem, Pr\u00f3tese e Acompanhamento.
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => createMut.mutate()}
            disabled={createMut.isPending}
            style={[styles.submitBtn, createMut.isPending && { opacity: 0.6 }]}
          >
            {createMut.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>Criar Tratamento</Text>
            }
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Main: ImplantWorkflow
// ─────────────────────────────────────────────────────────────
interface Props { patient: PatientLite; }

export function ImplantWorkflow({ patient }: Props) {
  const cid = useAuthStore().company?.id ?? '';
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  // Busca tratamentos do paciente (com phases+implants inclusos via GET detail)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['implant-treatments', cid, patient.id],
    queryFn: async () => {
      const list = await request(
        `/companies/${cid}/dental/implants/treatments?customer_id=${patient.id}&limit=50`
      );
      // Para cada tratamento, busca detalhe com phases+implants
      const treatments = (list?.treatments || []);
      const withDetails = await Promise.all(
        treatments.map((t: any) =>
          request(`/companies/${cid}/dental/implants/treatments/${t.id}`)
            .then(d => d?.treatment ?? t)
            .catch(() => t)
        )
      );
      return withDetails;
    },
    enabled: !!cid && !!patient.id,
    staleTime: 30000,
  });

  // Marcas para o formulario de implante (usado no form de novo tratamento)
  const { data: brandsData } = useQuery({
    queryKey: ['implant-brands', cid],
    queryFn: () => request(`/companies/${cid}/dental/implants/brands`),
    enabled: !!cid,
    staleTime: 300000,
  });
  const brands = brandsData?.brands || [];

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color="#06B6D4" /></View>;
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Erro ao carregar</Text>
        <Text style={styles.errorMsg}>{(error as any)?.message || 'Tente novamente.'}</Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const treatments: any[] = data || [];

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Implantodontia</Text>
          <TouchableOpacity onPress={() => setShowForm(true)} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Novo</Text>
          </TouchableOpacity>
        </View>

        {/* Legend */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.legendScroll}>
          {Object.entries(PHASE_STATUS_COLOR).map(([k, c]) => (
            <View key={k} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: c }]} />
              <Text style={styles.legendText}>
                {k === 'planned' ? 'Planejada' : k === 'in_progress' ? 'Em andamento' : k === 'completed' ? 'Conclu\u00edda' : k === 'delayed' ? 'Atrasada' : 'Ignorada'}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Treatments */}
        {treatments.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>\uD83E\uDDB7 Nenhum tratamento</Text>
            <Text style={styles.emptyMsg}>
              Crie o primeiro tratamento de implante para este paciente para acompanhar cada fase do processo.
            </Text>
            <TouchableOpacity onPress={() => setShowForm(true)} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>Criar Tratamento</Text>
            </TouchableOpacity>
          </View>
        ) : (
          treatments.map(t => (
            <TreatmentCard key={t.id} treatment={t} companyId={cid} />
          ))
        )}
      </ScrollView>

      {showForm && (
        <NewTreatmentForm
          companyId={cid}
          customerId={patient.id}
          brands={brands}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ['implant-treatments', cid, patient.id] });
          }}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A', paddingHorizontal: 16, paddingTop: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  errorMsg: { color: '#94A3B8', fontSize: 13, textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: '#1E293B', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: '#06B6D4', fontSize: 13, fontWeight: '600' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  addBtn: { backgroundColor: '#06B6D4', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  addBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  legendScroll: { marginBottom: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 14, gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: '#94A3B8', fontSize: 11 },

  // Treatment Card
  treatmentCard: {
    backgroundColor: '#1E293B', borderRadius: 14, padding: 14,
    marginBottom: 12, borderWidth: 0.5, borderColor: '#334155',
  },
  treatmentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  treatmentHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  treatmentNumber: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusChipText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  expandIcon: { color: '#475569', fontSize: 10 },

  treatmentMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  metaChip: { color: '#94A3B8', fontSize: 11, backgroundColor: '#0F172A', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  progressBar: { flex: 1, height: 4, backgroundColor: '#0F172A', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: '#10B981', borderRadius: 2 },
  progressLabel: { color: '#64748B', fontSize: 11, minWidth: 50, textAlign: 'right' },

  // Phase Timeline
  timelineScroll: { marginBottom: 4 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  timelineStep: { flexDirection: 'row', alignItems: 'center' },
  timelineConnector: { width: 20, height: 2, marginTop: -18 },
  phaseDotWrap: { alignItems: 'center', width: 52 },
  phaseDot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  phaseDotCheck: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  phaseDotLabel: { color: '#64748B', fontSize: 8, marginTop: 4, width: 52, textAlign: 'center' },

  // Phase Modal
  phaseModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  phaseModalCard: {
    backgroundColor: '#1E293B', borderRadius: 16, padding: 20,
    width: '100%', maxWidth: 360, borderWidth: 1, borderColor: '#334155',
  },
  phaseModalTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  phaseModalStatus: { color: '#06B6D4', fontSize: 13, marginBottom: 4 },
  phaseModalMeta: { color: '#94A3B8', fontSize: 12, marginBottom: 2 },
  phaseModalNotes: { color: '#CBD5E1', fontSize: 12, marginTop: 8, lineHeight: 18 },
  phaseModalBtns: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  phaseBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', minWidth: 100 },
  phaseBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  // Expanded implants
  expandedSection: { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 12, marginTop: 8 },
  noImplantsText: { color: '#64748B', fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  implantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#0F172A' },
  toothBadge: { backgroundColor: '#0F172A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 44, alignItems: 'center' },
  toothBadgeText: { color: '#06B6D4', fontSize: 14, fontWeight: '700' },
  implantInfo: { flex: 1 },
  implantBrand: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },
  implantModel: { color: '#94A3B8', fontSize: 11, marginTop: 1 },
  lotRow: { flexDirection: 'row', gap: 4, marginTop: 3 },
  lotLabel: { color: '#64748B', fontSize: 10, fontWeight: '600' },
  lotValue: { color: '#F59E0B', fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] },
  implantSize: { color: '#475569', fontSize: 10, marginTop: 2 },
  implantStatusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },

  // Empty
  empty: { padding: 32, alignItems: 'center' },
  emptyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyMsg: { color: '#94A3B8', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn: { backgroundColor: '#06B6D4', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  emptyBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Form Modal
  formModal: { flex: 1, backgroundColor: '#0F172A' },
  formHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  formTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  formClose: { color: '#EF4444', fontSize: 14, fontWeight: '600' },
  formScroll: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  formLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  formInput: {
    backgroundColor: '#1E293B', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: '#FFFFFF', fontSize: 14, borderWidth: 1, borderColor: '#334155',
  },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#1E293B', marginRight: 8, borderWidth: 1, borderColor: '#334155',
  },
  typeChipActive: { backgroundColor: '#06B6D4', borderColor: '#06B6D4' },
  typeChipText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  typeChipTextActive: { color: '#FFFFFF' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#475569',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#06B6D4', borderColor: '#06B6D4' },
  checkboxMark: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  checkLabel: { color: '#CBD5E1', fontSize: 13 },
  formInfoBox: {
    backgroundColor: 'rgba(6,182,212,0.08)', borderRadius: 8, padding: 12,
    borderWidth: 0.5, borderColor: 'rgba(6,182,212,0.2)', marginTop: 16,
  },
  formInfoText: { color: '#06B6D4', fontSize: 12, lineHeight: 18 },
  submitBtn: {
    backgroundColor: '#06B6D4', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

export default ImplantWorkflow;
