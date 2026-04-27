// AURA. — ImplantWorkflow — orchestrator
// Tab "Implantes" dentro do PatientHub.
// Decomposicao: ImplantPhaseTimeline + ImplantTreatmentCard + form inline

import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, Modal, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { ImplantTreatmentCard } from './ImplantTreatmentCard';
import { PHASE_STATUS_COLOR } from './ImplantPhaseTimeline';
import type { PatientLite } from './PatientHub';

const SURGERY_TYPES = ['Convencional', 'Guiada', 'Imediata', 'Mini-implante', 'Zigomático'];

interface Props { patient: PatientLite; }

export function ImplantWorkflow({ patient }: Props) {
  const cid = useAuthStore().company?.id ?? '';
  const qc  = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['implant-treatments', cid, patient.id],
    queryFn: async () => {
      const list = await request(`/companies/${cid}/dental/implants/treatments?customer_id=${patient.id}&limit=50`);
      const treatments = list?.treatments || [];
      const withDetails = await Promise.all(
        treatments.map((t: any) =>
          request(`/companies/${cid}/dental/implants/treatments/${t.id}`)
            .then(d => d?.treatment ?? t).catch(() => t)
        )
      );
      return withDetails;
    },
    enabled: !!cid && !!patient.id,
    staleTime: 30000,
  });

  const { data: brandsData } = useQuery({
    queryKey: ['implant-brands', cid],
    queryFn: () => request(`/companies/${cid}/dental/implants/brands`),
    enabled: !!cid, staleTime: 300000,
  });
  const brands = brandsData?.brands || [];

  if (isLoading) return <View style={st.center}><ActivityIndicator color="#06B6D4" /></View>;
  if (error) return (
    <View style={st.center}>
      <Text style={st.errTitle}>Erro ao carregar</Text>
      <TouchableOpacity onPress={() => refetch()} style={st.retryBtn}>
        <Text style={st.retryTxt}>Tentar novamente</Text>
      </TouchableOpacity>
    </View>
  );

  const treatments: any[] = data || [];

  return (
    <>
      <ScrollView style={st.root} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>Implantodontia</Text>
          <TouchableOpacity onPress={() => setShowForm(true)} style={st.addBtn}>
            <Text style={st.addBtnTxt}>+ Novo</Text>
          </TouchableOpacity>
        </View>

        {/* Legenda */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          {Object.entries(PHASE_STATUS_COLOR).map(([k, c]) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14, gap: 5 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c }} />
              <Text style={{ color: '#94A3B8', fontSize: 11 }}>
                {k === 'planned' ? 'Planejada' : k === 'in_progress' ? 'Em andamento' : k === 'completed' ? 'Concluída' : k === 'delayed' ? 'Atrasada' : 'Ignorada'}
              </Text>
            </View>
          ))}
        </ScrollView>

        {treatments.length === 0 ? (
          <View style={st.empty}>
            <Text style={st.emptyTitle}>🦷 Nenhum tratamento</Text>
            <Text style={st.emptyMsg}>Crie o primeiro tratamento de implante para acompanhar cada fase do processo.</Text>
            <TouchableOpacity onPress={() => setShowForm(true)} style={st.addBtn}>
              <Text style={st.addBtnTxt}>Criar Tratamento</Text>
            </TouchableOpacity>
          </View>
        ) : (
          treatments.map(t => <ImplantTreatmentCard key={t.id} treatment={t} companyId={cid} />)
        )}
      </ScrollView>

      {showForm && (
        <ImplantForm
          companyId={cid}
          customerId={patient.id}
          brands={brands}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['implant-treatments', cid, patient.id] }); }}
        />
      )}
    </>
  );
}

// ─── Form inline ─────────────────────────────────────────────
function ImplantForm({ companyId, customerId, brands, onClose, onCreated }: any) {
  const [diagnosis,   setDiagnosis]   = useState('');
  const [surgeryDate, setSurgeryDate] = useState('');
  const [surgeryType, setSurgeryType] = useState('Convencional');
  const [totalValue,  setTotalValue]  = useState('');
  const [notes,       setNotes]       = useState('');
  const [usesGraft,   setUsesGraft]   = useState(false);

  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () =>
      request(`/companies/${companyId}/dental/implants/treatments`, {
        method: 'POST',
        body: { customer_id: customerId, diagnosis: diagnosis || undefined, surgery_date: surgeryDate || undefined, surgery_type: surgeryType, uses_graft: usesGraft, total_value: totalValue ? parseFloat(totalValue.replace(',', '.')) : undefined, notes: notes || undefined },
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['implant-treatments'] }); onCreated(); },
    onError: (e: any) => Alert.alert('Erro', e?.message),
  });

  return (
    <Modal visible animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}>
      <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
        <View style={st.formHeader}>
          <Text style={st.formTitle}>Novo Tratamento de Implante</Text>
          <TouchableOpacity onPress={onClose}><Text style={st.formCancel}>Cancelar</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={st.lbl}>Diagnóstico inicial</Text>
          <TextInput style={st.inp} placeholder="Ex: Edentulismo parcial posterior..." placeholderTextColor="#475569" multiline numberOfLines={3} value={diagnosis} onChangeText={setDiagnosis} />
          <Text style={st.lbl}>Data da cirurgia</Text>
          <TextInput style={st.inp} placeholder="DD/MM/AAAA" placeholderTextColor="#475569" keyboardType="numeric" value={surgeryDate} onChangeText={setSurgeryDate} />
          <Text style={st.lbl}>Tipo de cirurgia</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {SURGERY_TYPES.map(s => (
              <TouchableOpacity key={s} onPress={() => setSurgeryType(s)} style={[st.chip, surgeryType === s && st.chipActive]}>
                <Text style={[st.chipTxt, surgeryType === s && st.chipTxtActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={() => setUsesGraft(g => !g)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <View style={[st.check, usesGraft && st.checkActive]}>{usesGraft && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✓</Text>}</View>
            <Text style={{ color: '#CBD5E1', fontSize: 13 }}>Utiliza enxerto ósseo</Text>
          </TouchableOpacity>
          <Text style={st.lbl}>Valor total (R$)</Text>
          <TextInput style={st.inp} placeholder="Ex: 4500,00" placeholderTextColor="#475569" keyboardType="decimal-pad" value={totalValue} onChangeText={setTotalValue} />
          <Text style={st.lbl}>Observações</Text>
          <TextInput style={[st.inp, { height: 80 }]} placeholder="Observações clínicas..." placeholderTextColor="#475569" multiline value={notes} onChangeText={setNotes} />
          <View style={{ backgroundColor: 'rgba(6,182,212,0.08)', borderRadius: 8, padding: 12, borderWidth: 0.5, borderColor: 'rgba(6,182,212,0.2)', marginTop: 16 }}>
            <Text style={{ color: '#06B6D4', fontSize: 12, lineHeight: 18 }}>ℹ️  7 fases serão criadas automaticamente: Planejamento, Cirurgia, Osseointegração, Reabertura, Moldagem, Prótese e Acompanhamento.</Text>
          </View>
          <TouchableOpacity onPress={() => mut.mutate()} disabled={mut.isPending} style={[st.submitBtn, mut.isPending && { opacity: 0.6 }]}>
            {mut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={st.submitTxt}>Criar Tratamento</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#0F172A', paddingHorizontal: 16, paddingTop: 12 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errTitle:     { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  retryBtn:     { backgroundColor: '#1E293B', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryTxt:     { color: '#06B6D4', fontSize: 13, fontWeight: '600' },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  addBtn:       { backgroundColor: '#06B6D4', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  addBtnTxt:    { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  empty:        { padding: 32, alignItems: 'center' },
  emptyTitle:   { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyMsg:     { color: '#94A3B8', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  formHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 16 : 24, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  formTitle:    { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  formCancel:   { color: '#EF4444', fontSize: 14, fontWeight: '600' },
  lbl:          { color: '#94A3B8', fontSize: 11, fontWeight: '600', marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  inp:          { backgroundColor: '#1E293B', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#FFFFFF', fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  chip:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1E293B', marginRight: 8, borderWidth: 1, borderColor: '#334155' },
  chipActive:   { backgroundColor: '#06B6D4', borderColor: '#06B6D4' },
  chipTxt:      { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  chipTxtActive:{ color: '#FFFFFF' },
  check:        { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#475569', alignItems: 'center', justifyContent: 'center' },
  checkActive:  { backgroundColor: '#06B6D4', borderColor: '#06B6D4' },
  submitBtn:    { backgroundColor: '#06B6D4', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitTxt:    { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

export default ImplantWorkflow;
