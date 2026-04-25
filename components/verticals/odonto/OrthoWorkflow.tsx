// ============================================================
// AURA. — OrthoWorkflow (W3 Sprint 2)
// Tab "Ortodontia" dentro do PatientHub.
//
// Funcionalidades:
//   - Lista tratamentos ortodonticos do paciente
//   - Timeline de sessoes (barra de progresso mensal)
//   - Card expandivel: detalhe fio superior/inferior + evolucao
//   - Formulario inline para criar novo tratamento
//   - Registrar sessao (PATCH: concluir, fio, evolucao)
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
const APPLIANCE_LABELS: Record<string, string> = {
  brackets_metal:    'Brackets Metal',
  brackets_ceramic:  'Brackets Ceramica',
  brackets_sapphire: 'Brackets Safira',
  alinhadores:       'Alinhadores',
  retainer:          'Retentor',
  expansor:          'Expansor',
  aparelho_movel:    'Aparelho Movel',
  outro:             'Outro',
};

const APPLIANCE_ICON: Record<string, string> = {
  brackets_metal:    '\uD83E\uDDB7',
  brackets_ceramic:  '\u2728',
  brackets_sapphire: '\uD83D\uDC8E',
  alinhadores:       '\uD83D\uDC4C',
  retainer:          '\uD83D\uDD12',
  expansor:          '\u2194\uFE0F',
  aparelho_movel:    '\uD83D\uDD27',
  outro:             '\u2699\uFE0F',
};

const STATUS_LABEL: Record<string, string> = {
  planning:  'Planejamento',
  active:    'Ativo',
  retention: 'Retencao',
  completed: 'Concluido',
  abandoned: 'Abandonado',
};

const STATUS_COLOR: Record<string, string> = {
  planning:  '#94A3B8',
  active:    '#10B981',
  retention: '#8B5CF6',
  completed: '#06B6D4',
  abandoned: '#EF4444',
};

const SESSION_TYPE_LABEL: Record<string, string> = {
  avaliacao:      'Avaliacao',
  instalacao:     'Instalacao',
  adjustment:     'Ajuste',
  wire_change:    'Troca de fio',
  bracket_repair: 'Reparo bracket',
  retainer_check: 'Checar retentor',
  removal:        'Remocao',
  photos:         'Fotos',
  xray:           'Raio-X',
  other:          'Outro',
};

const APPLIANCE_OPTIONS = Object.keys(APPLIANCE_LABELS);
const SESSION_TYPE_OPTIONS = ['adjustment', 'wire_change', 'avaliacao', 'instalacao', 'bracket_repair', 'retainer_check', 'removal', 'photos', 'xray', 'other'];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function fmt(v?: string | null) {
  if (!v) return '\u2014';
  try { return new Date(v).toLocaleDateString('pt-BR'); } catch { return '\u2014'; }
}

// ─────────────────────────────────────────────────────────────
// Session Timeline — barra horizontal de sessoes
// ─────────────────────────────────────────────────────────────
function SessionTimeline({ sessions, totalPlanned, treatmentId, companyId }: {
  sessions: any[];
  totalPlanned: number;
  treatmentId: string;
  companyId: string;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any | null>(null);
  const [evolText, setEvolText] = useState('');
  const [wireU, setWireU] = useState('');
  const [wireL, setWireL] = useState('');

  const patchMut = useMutation({
    mutationFn: (body: any) =>
      request(`/companies/${companyId}/dental/ortho/treatments/${treatmentId}/sessions/${selected.id}`, {
        method: 'PATCH', body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ortho-treatments'] });
      setSelected(null);
    },
    onError: (err: any) => Alert.alert('Erro', err?.message || 'Nao foi possivel atualizar a sessao.'),
  });

  const done = sessions.filter(s => s.status === 'completed').length;
  const total = Math.max(totalPlanned, sessions.length);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const sorted = [...sessions].sort((a, b) => a.session_number - b.session_number);

  return (
    <>
      {/* Progresso geral */}
      <View style={st.progressWrap}>
        <View style={st.progressBar}>
          <View style={[st.progressFill, { width: `${pct}%` }]} />
        </View>
        <Text style={st.progressLabel}>{done}/{total} sessoes ({pct}%)</Text>
      </View>

      {/* Dots de sessoes */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.sessionScroll}>
        <View style={st.sessionRow}>
          {sorted.map((s, i) => {
            const isDone = s.status === 'completed';
            const isCancelled = s.status === 'cancelled';
            const color = isDone ? '#10B981' : isCancelled ? '#EF4444' : '#475569';
            return (
              <TouchableOpacity key={s.id} onPress={() => { setSelected(s); setEvolText(s.evolution || ''); setWireU(s.wire_upper || ''); setWireL(s.wire_lower || ''); }} style={st.sessionStep}>
                {i > 0 && <View style={[st.sessionConnector, { backgroundColor: isDone ? '#10B981' : '#1E293B' }]} />}
                <View style={[st.sessionDot, { backgroundColor: color, borderColor: color }]}>
                  {isDone && <Text style={st.sessionDotCheck}>\u2713</Text>}
                </View>
                <Text style={st.sessionDotLabel} numberOfLines={1}>S{s.session_number}</Text>
                {s.planned_date && (
                  <Text style={st.sessionDotDate} numberOfLines={1}>
                    {fmt(s.planned_date).slice(0, 5)}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
          {/* Slots vazios ate totalPlanned */}
          {Array.from({ length: Math.max(0, totalPlanned - sessions.length) }).map((_, i) => (
            <View key={`empty-${i}`} style={st.sessionStep}>
              {(i + sessions.length) > 0 && <View style={[st.sessionConnector, { backgroundColor: '#1E293B' }]} />}
              <View style={[st.sessionDot, { backgroundColor: '#1E293B', borderColor: '#334155', borderStyle: 'dashed' }]} />
              <Text style={st.sessionDotLabel}>S{sessions.length + i + 1}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Modal de sessao */}
      {selected && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSelected(null)}>
          <View style={st.sessionModalOverlay}>
            <View style={st.sessionModalCard}>
              <Text style={st.sessionModalTitle}>
                Sessao {selected.session_number} — {SESSION_TYPE_LABEL[selected.session_type] || selected.session_type}
              </Text>
              {selected.planned_date && (
                <Text style={st.sessionModalMeta}>Data: {fmt(selected.planned_date)}</Text>
              )}
              {selected.status === 'completed' && (
                <Text style={[st.sessionModalMeta, { color: '#10B981' }]}>\u2713 Concluida em {fmt(selected.completed_date)}</Text>
              )}

              {selected.status !== 'completed' && (
                <>
                  <Text style={st.sessionModalLabel}>Fio superior</Text>
                  <TextInput
                    style={st.sessionInput}
                    placeholder="Ex: 0.014 NiTi"
                    placeholderTextColor="#475569"
                    value={wireU}
                    onChangeText={setWireU}
                  />
                  <Text style={st.sessionModalLabel}>Fio inferior</Text>
                  <TextInput
                    style={st.sessionInput}
                    placeholder="Ex: 0.019x0.025 SS"
                    placeholderTextColor="#475569"
                    value={wireL}
                    onChangeText={setWireL}
                  />
                  <Text style={st.sessionModalLabel}>Evolucao / observacoes</Text>
                  <TextInput
                    style={[st.sessionInput, { height: 72, textAlignVertical: 'top' }]}
                    placeholder="Descreva o que foi feito..."
                    placeholderTextColor="#475569"
                    multiline
                    value={evolText}
                    onChangeText={setEvolText}
                  />
                </>
              )}

              {selected.status === 'completed' && (
                <>
                  {selected.wire_upper && <Text style={st.sessionModalMeta}>\u2191 Fio sup: {selected.wire_upper}</Text>}
                  {selected.wire_lower && <Text style={st.sessionModalMeta}>\u2193 Fio inf: {selected.wire_lower}</Text>}
                  {selected.evolution && <Text style={st.sessionModalNotes}>{selected.evolution}</Text>}
                </>
              )}

              <View style={st.sessionModalBtns}>
                {selected.status !== 'completed' && (
                  <TouchableOpacity
                    onPress={() => patchMut.mutate({
                      status: 'completed',
                      wire_upper: wireU || undefined,
                      wire_lower: wireL || undefined,
                      evolution: evolText || undefined,
                    })}
                    style={[st.sessionBtn, { backgroundColor: '#10B981' }]}
                    disabled={patchMut.isPending}
                  >
                    {patchMut.isPending
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={st.sessionBtnText}>Registrar como concluida</Text>
                    }
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setSelected(null)} style={[st.sessionBtn, { backgroundColor: '#1E293B' }]}>
                  <Text style={[st.sessionBtnText, { color: '#94A3B8' }]}>Fechar</Text>
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
function TreatmentCard({ t, companyId }: { t: any; companyId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [showAddSession, setShowAddSession] = useState(false);
  const qc = useQueryClient();

  const statusColor = STATUS_COLOR[t.status] || '#94A3B8';
  const statusLabel = STATUS_LABEL[t.status] || t.status;
  const appIcon = APPLIANCE_ICON[t.appliance_type] || '\uD83E\uDDB7';
  const appLabel = APPLIANCE_LABELS[t.appliance_type] || t.appliance_type;
  const sessions = t.sessions || [];
  const done = parseInt(t.sessions_done || sessions.filter((s: any) => s.status === 'completed').length) || 0;
  const planned = parseInt(t.total_sessions_planned) || 18;

  // Adicionar sessao rapida
  const [sessionType, setSessionType] = useState('adjustment');
  const [sessionDate, setSessionDate] = useState('');
  const addMut = useMutation({
    mutationFn: () =>
      request(`/companies/${companyId}/dental/ortho/treatments/${t.id}/sessions`, {
        method: 'POST',
        body: {
          session_type: sessionType,
          planned_date: sessionDate || undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ortho-treatments'] });
      setShowAddSession(false);
      setSessionDate('');
    },
    onError: (err: any) => Alert.alert('Erro', err?.message || 'Nao foi possivel adicionar sessao.'),
  });

  return (
    <View style={st.card}>
      {/* Header */}
      <TouchableOpacity onPress={() => setExpanded(e => !e)} style={st.cardHeader} activeOpacity={0.8}>
        <View style={st.cardHeaderLeft}>
          <Text style={st.cardIcon}>{appIcon}</Text>
          <View>
            <Text style={st.cardNumber}>{t.treatment_number}</Text>
            <Text style={st.cardAppliance}>{appLabel}</Text>
          </View>
        </View>
        <View style={st.cardHeaderRight}>
          <View style={[st.statusChip, { backgroundColor: `${statusColor}22` }]}>
            <Text style={[st.statusChipText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          <Text style={st.expandIcon}>{expanded ? '\u25B2' : '\u25BC'}</Text>
        </View>
      </TouchableOpacity>

      {/* Meta */}
      <View style={st.metaRow}>
        {t.start_date && <Text style={st.metaChip}>\uD83D\uDCC5 Inicio: {fmt(t.start_date)}</Text>}
        {t.expected_end_date && <Text style={st.metaChip}>\uD83C\uDFC1 Prev: {fmt(t.expected_end_date)}</Text>}
        {t.practitioner_name && <Text style={st.metaChip}>\uD83D\uDC64 {t.practitioner_name}</Text>}
        {t.estimated_duration_months && <Text style={st.metaChip}>\u23F1 {t.estimated_duration_months} meses</Text>}
      </View>

      {/* Timeline de sessoes */}
      <SessionTimeline
        sessions={sessions}
        totalPlanned={planned}
        treatmentId={t.id}
        companyId={companyId}
      />

      {/* Expanded: chief complaint + adicionar sessao */}
      {expanded && (
        <View style={st.expandedSection}>
          {t.chief_complaint && (
            <View style={st.expandedBlock}>
              <Text style={st.expandedLabel}>Queixa principal</Text>
              <Text style={st.expandedText}>{t.chief_complaint}</Text>
            </View>
          )}
          {t.diagnosis && (
            <View style={st.expandedBlock}>
              <Text style={st.expandedLabel}>Diagnostico</Text>
              <Text style={st.expandedText}>{t.diagnosis}</Text>
            </View>
          )}

          {/* Botao adicionar sessao */}
          {!showAddSession ? (
            <TouchableOpacity onPress={() => setShowAddSession(true)} style={st.addSessionBtn}>
              <Text style={st.addSessionBtnText}>+ Adicionar sessao</Text>
            </TouchableOpacity>
          ) : (
            <View style={st.addSessionForm}>
              <Text style={st.formLabel}>Tipo de sessao</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {SESSION_TYPE_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setSessionType(opt)}
                    style={[st.typeChip, sessionType === opt && st.typeChipActive]}
                  >
                    <Text style={[st.typeChipText, sessionType === opt && st.typeChipTextActive]}>
                      {SESSION_TYPE_LABEL[opt] || opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={[st.formLabel, { marginTop: 10 }]}>Data planejada (DD/MM/AAAA)</Text>
              <TextInput
                style={st.formInput}
                placeholder="Opcional"
                placeholderTextColor="#475569"
                value={sessionDate}
                onChangeText={setSessionDate}
                keyboardType="numeric"
              />
              <View style={st.addSessionBtns}>
                <TouchableOpacity
                  onPress={() => addMut.mutate()}
                  disabled={addMut.isPending}
                  style={[st.addSessionConfirm, addMut.isPending && { opacity: 0.6 }]}
                >
                  {addMut.isPending
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={st.addSessionConfirmText}>Adicionar</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowAddSession(false)} style={st.addSessionCancel}>
                  <Text style={st.addSessionCancelText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// New Treatment Form
// ─────────────────────────────────────────────────────────────
interface NewTreatmentFormProps {
  companyId: string;
  customerId: string;
  onClose: () => void;
  onCreated: () => void;
}

function NewTreatmentForm({ companyId, customerId, onClose, onCreated }: NewTreatmentFormProps) {
  const [applianceType, setApplianceType] = useState('brackets_metal');
  const [arch, setArch] = useState('both');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [startDate, setStartDate] = useState('');
  const [durationMonths, setDurationMonths] = useState('18');
  const [sessionsPlanned, setSessionsPlanned] = useState('18');
  const [totalValue, setTotalValue] = useState('');
  const [notes, setNotes] = useState('');

  const qc = useQueryClient();

  const createMut = useMutation({
    mutationFn: () =>
      request(`/companies/${companyId}/dental/ortho/treatments`, {
        method: 'POST',
        body: {
          customer_id: customerId,
          appliance_type: applianceType,
          arch,
          chief_complaint: chiefComplaint || undefined,
          start_date: startDate || undefined,
          estimated_duration_months: parseInt(durationMonths) || 18,
          total_sessions_planned: parseInt(sessionsPlanned) || 18,
          total_value: totalValue ? parseFloat(totalValue.replace(',', '.')) : undefined,
          notes: notes || undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ortho-treatments'] });
      onCreated();
    },
    onError: (err: any) => Alert.alert('Erro', err?.message || 'Nao foi possivel criar o tratamento.'),
  });

  return (
    <Modal visible animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}>
      <View style={st.formModal}>
        <View style={st.formHeader}>
          <Text style={st.formTitle}>Novo Tratamento Ortodontico</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={st.formClose}>Cancelar</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={st.formScroll} keyboardShouldPersistTaps="handled">

          <Text style={st.formLabel}>Tipo de aparelho</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            {APPLIANCE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt}
                onPress={() => setApplianceType(opt)}
                style={[st.typeChip, applianceType === opt && st.typeChipActive]}
              >
                <Text style={st.typeChipIcon}>{APPLIANCE_ICON[opt]}</Text>
                <Text style={[st.typeChipText, applianceType === opt && st.typeChipTextActive]}>
                  {APPLIANCE_LABELS[opt]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={st.formLabel}>Arcada</Text>
          <View style={st.archRow}>
            {['both', 'upper', 'lower'].map(a => (
              <TouchableOpacity
                key={a}
                onPress={() => setArch(a)}
                style={[st.archChip, arch === a && st.archChipActive]}
              >
                <Text style={[st.archChipText, arch === a && st.archChipTextActive]}>
                  {a === 'both' ? 'Ambas' : a === 'upper' ? 'Superior' : 'Inferior'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={st.formLabel}>Queixa principal</Text>
          <TextInput
            style={[st.formInput, { height: 72, textAlignVertical: 'top' }]}
            placeholder="Descreva a queixa do paciente..."
            placeholderTextColor="#475569"
            multiline
            value={chiefComplaint}
            onChangeText={setChiefComplaint}
          />

          <Text style={st.formLabel}>Data de inicio</Text>
          <TextInput
            style={st.formInput}
            placeholder="DD/MM/AAAA"
            placeholderTextColor="#475569"
            value={startDate}
            onChangeText={setStartDate}
            keyboardType="numeric"
          />

          <View style={st.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={st.formLabel}>Duracao (meses)</Text>
              <TextInput
                style={st.formInput}
                placeholder="18"
                placeholderTextColor="#475569"
                keyboardType="numeric"
                value={durationMonths}
                onChangeText={setDurationMonths}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.formLabel}>Sessoes previstas</Text>
              <TextInput
                style={st.formInput}
                placeholder="18"
                placeholderTextColor="#475569"
                keyboardType="numeric"
                value={sessionsPlanned}
                onChangeText={setSessionsPlanned}
              />
            </View>
          </View>

          <Text style={st.formLabel}>Valor total (R$)</Text>
          <TextInput
            style={st.formInput}
            placeholder="Ex: 3800,00"
            placeholderTextColor="#475569"
            keyboardType="decimal-pad"
            value={totalValue}
            onChangeText={setTotalValue}
          />

          <Text style={st.formLabel}>Observacoes</Text>
          <TextInput
            style={[st.formInput, { height: 72, textAlignVertical: 'top' }]}
            placeholder="Observacoes adicionais..."
            placeholderTextColor="#475569"
            multiline
            value={notes}
            onChangeText={setNotes}
          />

          <TouchableOpacity
            onPress={() => createMut.mutate()}
            disabled={createMut.isPending}
            style={[st.submitBtn, createMut.isPending && { opacity: 0.6 }]}
          >
            {createMut.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={st.submitBtnText}>Criar Tratamento</Text>
            }
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Main: OrthoWorkflow
// ─────────────────────────────────────────────────────────────
interface Props { patient: PatientLite; }

export function OrthoWorkflow({ patient }: Props) {
  const cid = useAuthStore().company?.id ?? '';
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ortho-treatments', cid, patient.id],
    queryFn: async () => {
      const list = await request(
        `/companies/${cid}/dental/ortho/treatments?customer_id=${patient.id}&limit=50`
      );
      const treatments = list?.treatments || [];
      const withDetails = await Promise.all(
        treatments.map((t: any) =>
          request(`/companies/${cid}/dental/ortho/treatments/${t.id}`)
            .then(d => d?.treatment ?? t)
            .catch(() => t)
        )
      );
      return withDetails;
    },
    enabled: !!cid && !!patient.id,
    staleTime: 30000,
  });

  if (isLoading) return <View style={st.center}><ActivityIndicator color="#8B5CF6" /></View>;

  if (error) {
    return (
      <View style={st.center}>
        <Text style={st.errorTitle}>Erro ao carregar</Text>
        <Text style={st.errorMsg}>{(error as any)?.message || 'Tente novamente.'}</Text>
        <TouchableOpacity onPress={() => refetch()} style={st.retryBtn}>
          <Text style={st.retryBtnText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const treatments: any[] = data || [];

  return (
    <>
      <ScrollView style={st.root} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>Ortodontia</Text>
          <TouchableOpacity onPress={() => setShowForm(true)} style={st.addBtn}>
            <Text style={st.addBtnText}>+ Novo</Text>
          </TouchableOpacity>
        </View>

        {treatments.length === 0 ? (
          <View style={st.empty}>
            <Text style={st.emptyTitle}>\uD83E\uDDB7 Nenhum tratamento</Text>
            <Text style={st.emptyMsg}>
              Crie o primeiro tratamento ortodontico para acompanhar as sessoes mensais e a evolucao do paciente ao longo dos meses.
            </Text>
            <TouchableOpacity onPress={() => setShowForm(true)} style={st.emptyBtn}>
              <Text style={st.emptyBtnText}>Criar Tratamento</Text>
            </TouchableOpacity>
          </View>
        ) : (
          treatments.map(t => (
            <TreatmentCard key={t.id} t={t} companyId={cid} />
          ))
        )}
      </ScrollView>

      {showForm && (
        <NewTreatmentForm
          companyId={cid}
          customerId={patient.id}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ['ortho-treatments', cid, patient.id] });
          }}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A', paddingHorizontal: 16, paddingTop: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  errorMsg: { color: '#94A3B8', fontSize: 13, textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: '#1E293B', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: '#8B5CF6', fontSize: 13, fontWeight: '600' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  addBtn: { backgroundColor: '#8B5CF6', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  addBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // Card
  card: {
    backgroundColor: '#1E293B', borderRadius: 14, padding: 14,
    marginBottom: 12, borderWidth: 0.5, borderColor: '#334155',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardIcon: { fontSize: 24 },
  cardNumber: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  cardAppliance: { color: '#94A3B8', fontSize: 11, marginTop: 1 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusChipText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  expandIcon: { color: '#475569', fontSize: 10 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  metaChip: { color: '#94A3B8', fontSize: 11, backgroundColor: '#0F172A', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },

  // Progress
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  progressBar: { flex: 1, height: 5, backgroundColor: '#0F172A', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 5, backgroundColor: '#8B5CF6', borderRadius: 3 },
  progressLabel: { color: '#64748B', fontSize: 11, minWidth: 70, textAlign: 'right' },

  // Session timeline
  sessionScroll: { marginBottom: 4 },
  sessionRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  sessionStep: { flexDirection: 'row', alignItems: 'center' },
  sessionConnector: { width: 16, height: 2, marginTop: -22 },
  sessionDot: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  sessionDotCheck: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  sessionDotLabel: { color: '#64748B', fontSize: 8, marginTop: 2, width: 28, textAlign: 'center' },
  sessionDotDate: { color: '#475569', fontSize: 7, width: 28, textAlign: 'center' },

  // Session modal
  sessionModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  sessionModalCard: {
    backgroundColor: '#1E293B', borderRadius: 16, padding: 20,
    width: '100%', maxWidth: 380, borderWidth: 1, borderColor: '#334155',
  },
  sessionModalTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  sessionModalMeta: { color: '#94A3B8', fontSize: 12, marginBottom: 3 },
  sessionModalNotes: { color: '#CBD5E1', fontSize: 12, marginTop: 6, lineHeight: 18 },
  sessionModalLabel: { color: '#64748B', fontSize: 11, fontWeight: '600', marginTop: 10, marginBottom: 4, textTransform: 'uppercase' },
  sessionInput: {
    backgroundColor: '#0F172A', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    color: '#FFFFFF', fontSize: 13, borderWidth: 1, borderColor: '#334155',
  },
  sessionModalBtns: { flexDirection: 'row', gap: 8, marginTop: 14 },
  sessionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  sessionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  // Expanded
  expandedSection: { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 12, marginTop: 8 },
  expandedBlock: { marginBottom: 10 },
  expandedLabel: { color: '#64748B', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  expandedText: { color: '#CBD5E1', fontSize: 12, lineHeight: 18 },
  addSessionBtn: {
    marginTop: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: '#8B5CF6',
    borderRadius: 8, paddingVertical: 9, alignItems: 'center',
  },
  addSessionBtnText: { color: '#8B5CF6', fontSize: 13, fontWeight: '600' },
  addSessionForm: { marginTop: 8, gap: 4 },
  addSessionBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  addSessionConfirm: { flex: 1, backgroundColor: '#8B5CF6', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  addSessionConfirmText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  addSessionCancel: { flex: 1, backgroundColor: '#1E293B', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  addSessionCancelText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },

  // Empty
  empty: { padding: 32, alignItems: 'center' },
  emptyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyMsg: { color: '#94A3B8', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn: { backgroundColor: '#8B5CF6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  emptyBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Form modal
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
  formLabel: {
    color: '#94A3B8', fontSize: 11, fontWeight: '600',
    marginBottom: 6, marginTop: 14,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  formInput: {
    backgroundColor: '#1E293B', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    color: '#FFFFFF', fontSize: 14, borderWidth: 1, borderColor: '#334155',
  },
  twoCol: { flexDirection: 'row', gap: 10 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#1E293B', marginRight: 8, borderWidth: 1, borderColor: '#334155',
  },
  typeChipActive: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  typeChipIcon: { fontSize: 14 },
  typeChipText: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  typeChipTextActive: { color: '#FFFFFF' },
  archRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  archChip: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  archChipActive: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  archChipText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  archChipTextActive: { color: '#FFFFFF' },
  submitBtn: {
    backgroundColor: '#8B5CF6', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

export default OrthoWorkflow;
