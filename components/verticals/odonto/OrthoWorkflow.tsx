// AURA. — OrthoWorkflow — orchestrator
// Tab "Ortodontia" dentro do PatientHub.
// Decomposicao: OrthoSessionTimeline + OrthoTreatmentCard + OrthoTreatmentForm

import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { OrthoTreatmentCard } from './OrthoTreatmentCard';
import { OrthoTreatmentForm } from './OrthoTreatmentForm';
import type { PatientLite } from './PatientHub';

interface Props { patient: PatientLite; }

export function OrthoWorkflow({ patient }: Props) {
  const cid = useAuthStore().company?.id ?? '';
  const qc  = useQueryClient();
  const [showForm, setShowForm] = useState(false);

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

  if (error) return (
    <View style={st.center}>
      <Text style={st.errorTitle}>Erro ao carregar</Text>
      <Text style={st.errorMsg}>{(error as any)?.message || 'Tente novamente.'}</Text>
      <TouchableOpacity onPress={() => refetch()} style={st.retryBtn}>
        <Text style={st.retryBtnTxt}>Tentar novamente</Text>
      </TouchableOpacity>
    </View>
  );

  const treatments: any[] = data || [];

  return (
    <>
      <ScrollView style={st.root} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>Ortodontia</Text>
          <TouchableOpacity onPress={() => setShowForm(true)} style={st.addBtn}>
            <Text style={st.addBtnTxt}>+ Novo</Text>
          </TouchableOpacity>
        </View>

        {treatments.length === 0 ? (
          <View style={st.empty}>
            <Text style={st.emptyTitle}>🦷 Nenhum tratamento</Text>
            <Text style={st.emptyMsg}>
              Crie o primeiro tratamento ortodontico para acompanhar sessoes mensais e evolucao.
            </Text>
            <TouchableOpacity onPress={() => setShowForm(true)} style={st.addBtn}>
              <Text style={st.addBtnTxt}>Criar Tratamento</Text>
            </TouchableOpacity>
          </View>
        ) : (
          treatments.map(t => (
            <OrthoTreatmentCard key={t.id} t={t} companyId={cid} />
          ))
        )}
      </ScrollView>

      {showForm && (
        <OrthoTreatmentForm
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

const st = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#0F172A', paddingHorizontal: 16, paddingTop: 12 },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorTitle:    { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  errorMsg:      { color: '#94A3B8', fontSize: 13, textAlign: 'center' },
  retryBtn:      { marginTop: 16, backgroundColor: '#1E293B', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtnTxt:   { color: '#8B5CF6', fontSize: 13, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle:  { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  addBtn:        { backgroundColor: '#8B5CF6', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  addBtnTxt:     { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  empty:         { padding: 32, alignItems: 'center' },
  emptyTitle:    { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyMsg:      { color: '#94A3B8', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
});

export default OrthoWorkflow;
