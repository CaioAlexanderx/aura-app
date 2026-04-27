// AURA. — TissBatchesTab
// Tab "Lotes" + BatchFormModal.
// Extraido de TissDashboard.tsx (decomposicao).

import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, ActivityIndicator, Alert, Modal, Linking,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/services/api';
import { Icon } from '@/components/Icon';
import type { Batch, Guide, Insurance } from './tissTypes';
import { GUIDE_TYPE_LABELS, STATUS_COLORS, formatBRL, formatDateBR } from './tissTypes';

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_COLORS[status] || STATUS_COLORS.rascunho;
  return (
    <View style={[st.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[st.badgeText, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── BatchesTab ───────────────────────────────────────────────
interface BatchesTabProps { cid: string; onCreate: () => void; }

export function TissBatchesTab({ cid, onCreate }: BatchesTabProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['tiss-batches', cid],
    queryFn: () => request<{ batches: Batch[] }>(`/companies/${cid}/dental/tiss/batches`),
    enabled: !!cid,
  });
  const items = data?.batches || [];

  function downloadXml(b: Batch) {
    const url = `${process.env.EXPO_PUBLIC_API_URL}/companies/${cid}/dental/tiss/batches/${b.id}/xml`;
    Linking.openURL(url).catch(() => Alert.alert('Erro', 'Nao foi possivel baixar o XML.'));
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={st.actionsRow}>
        <Pressable onPress={onCreate} style={[st.btn, st.btnPrimary]}>
          <Icon name="plus" size={14} color="#fff" />
          <Text style={st.btnPrimaryText}>Novo lote</Text>
        </Pressable>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingTop: 0 }}>
        {isLoading ? (
          <ActivityIndicator color="#06B6D4" />
        ) : items.length === 0 ? (
          <View style={st.empty}>
            <Icon name="package" size={32} color="#475569" />
            <Text style={st.emptyTitle}>Nenhum lote criado</Text>
            <Text style={st.emptySub}>Lotes agrupam varias guias do mesmo convenio pra envio mensal.</Text>
          </View>
        ) : items.map(b => (
          <View key={b.id} style={st.card}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Text style={st.cardTitle}>{b.batch_number}</Text>
                <StatusBadge status={b.status} />
              </View>
              <Text style={st.cardSub}>{b.insurance_name} • {b.reference_month}</Text>
              <Text style={st.cardMeta}>{b.guide_count} guias • R$ {formatBRL(b.total_value)}</Text>
              {Number(b.total_paid || 0) > 0    && <Text style={[st.cardMeta, { color: '#10B981' }]}>Recebido: R$ {formatBRL(b.total_paid!)}</Text>}
              {Number(b.total_glossed || 0) > 0 && <Text style={[st.cardMeta, { color: '#EF4444' }]}>Glosado: R$ {formatBRL(b.total_glossed!)}</Text>}
              {b.protocol_number && <Text style={st.cardMeta}>Protocolo: {b.protocol_number}</Text>}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable onPress={() => downloadXml(b)} style={[st.btnSm, st.btnSmGhost]}>
                  <Icon name="download" size={12} color="#a78bfa" />
                  <Text style={st.btnSmGhostText}>XML</Text>
                </Pressable>
                {b.upload_portal_url && (
                  <Pressable onPress={() => Linking.openURL(b.upload_portal_url!)} style={[st.btnSm, st.btnSmGhost]}>
                    <Icon name="external_link" size={12} color="#06B6D4" />
                    <Text style={[st.btnSmGhostText, { color: '#06B6D4' }]}>Portal</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── BatchFormModal ───────────────────────────────────────────
interface BatchFormProps { visible: boolean; cid: string; onClose: () => void; }

export function TissBatchFormModal({ visible, cid, onClose }: BatchFormProps) {
  const qc = useQueryClient();
  const [insuranceId,     setInsuranceId]     = useState('');
  const [referenceMonth,  setReferenceMonth]  = useState(new Date().toISOString().substring(0, 7));
  const [selectedGuides,  setSelectedGuides]  = useState<Set<string>>(new Set());

  const { data: insData } = useQuery({
    queryKey: ['tiss-insurance', cid],
    queryFn: () => request<{ insurance: Insurance[] }>(`/companies/${cid}/dental/tiss/insurance`),
    enabled: !!cid && visible,
  });
  const { data: gData } = useQuery({
    queryKey: ['tiss-guides-pending', cid, insuranceId],
    queryFn: () => request<{ guides: Guide[] }>(`/companies/${cid}/dental/tiss/guides?insurance_id=${insuranceId}&batch_id=null`),
    enabled: !!cid && !!insuranceId && visible,
  });

  const createMut = useMutation({
    mutationFn: () => request(`/companies/${cid}/dental/tiss/batches`, {
      method: 'POST',
      body: { insurance_id: insuranceId, guide_ids: Array.from(selectedGuides), reference_month: referenceMonth },
    }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['tiss-batches', cid] });
      qc.invalidateQueries({ queryKey: ['tiss-guides', cid] });
      Alert.alert('Lote criado', `Lote ${data.batch.batch_number} gerado com ${data.total_guias} guias.`);
      onClose();
    },
    onError: (e: any) => Alert.alert('Erro', e?.body?.error || 'Nao foi possivel gerar o lote.'),
  });

  function toggle(id: string) {
    const next = new Set(selectedGuides);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedGuides(next);
  }

  const guides    = gData?.guides     || [];
  const insurances = insData?.insurance || [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[st.modal]}>
        <View style={st.header}>
          <Pressable onPress={onClose} hitSlop={10}><Icon name="x" size={20} color="#94A3B8" /></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={st.headerTitle}>Novo lote</Text>
            <Text style={st.headerSub}>{selectedGuides.size} guias selecionadas</Text>
          </View>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 80 }}>
          <Text style={st.label}>Convenio *</Text>
          {insurances.map(i => (
            <Pressable key={i.id} onPress={() => { setInsuranceId(i.id); setSelectedGuides(new Set()); }} style={[st.card, insuranceId === i.id && st.cardSelected]}>
              <Text style={st.cardTitle}>{i.name}</Text>
            </Pressable>
          ))}
          <Text style={st.label}>Mes de referencia *</Text>
          <TextInput value={referenceMonth} onChangeText={setReferenceMonth} style={st.input} placeholder="YYYY-MM" placeholderTextColor="#475569" />
          {insuranceId && (
            <>
              <Text style={[st.label, { marginTop: 16 }]}>Guias disponiveis ({guides.length})</Text>
              {guides.length === 0 ? (
                <Text style={st.emptySub}>Nenhuma guia disponivel para este convenio.</Text>
              ) : guides.map(g => {
                const checked = selectedGuides.has(g.id);
                return (
                  <Pressable key={g.id} onPress={() => toggle(g.id)} style={[st.card, checked && st.cardSelected]}>
                    <View style={[st.checkbox, checked && st.checkboxOn]}>
                      {checked && <Icon name="check" size={10} color="#fff" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.cardTitle}>{g.guide_number}</Text>
                      <Text style={st.cardSub}>{g.patient_full_name || g.patient_name} • R$ {formatBRL(g.total_value)}</Text>
                      <Text style={st.cardMeta}>{GUIDE_TYPE_LABELS[g.guide_type]} • {formatDateBR(g.service_date)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </>
          )}
          <Pressable
            onPress={() => createMut.mutate()}
            disabled={!insuranceId || selectedGuides.size === 0 || createMut.isPending}
            style={[st.btn, st.btnPrimary, { marginTop: 20, flex: 0 }, (!insuranceId || selectedGuides.size === 0) && { opacity: 0.5 }]}
          >
            {createMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.btnPrimaryText}>Gerar XML ({selectedGuides.size} guias)</Text>}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  modal:        { flex: 1, backgroundColor: '#0F172A' },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingTop: 22, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  headerTitle:  { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  headerSub:    { color: '#94A3B8', fontSize: 11, marginTop: 1 },
  actionsRow:   { flexDirection: 'row', gap: 8, padding: 12 },
  btn:          { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  btnPrimary:   { backgroundColor: '#7c3aed' },
  btnPrimaryText:{ color: '#fff', fontSize: 13, fontWeight: '700' },
  btnSm:        { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  btnSmGhost:   { backgroundColor: 'rgba(167,139,250,0.1)', borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)' },
  btnSmGhostText:{ color: '#a78bfa', fontSize: 11, fontWeight: '600' },
  card:         { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1E293B', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: '#334155' },
  cardSelected: { backgroundColor: 'rgba(167,139,250,0.12)', borderColor: 'rgba(167,139,250,0.5)' },
  cardTitle:    { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },
  cardSub:      { color: '#CBD5E1', fontSize: 12, marginTop: 2 },
  cardMeta:     { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  badge:        { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  badgeText:    { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  empty:        { padding: 32, alignItems: 'center', gap: 8 },
  emptyTitle:   { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  emptySub:     { color: '#94A3B8', fontSize: 12, textAlign: 'center', maxWidth: 320, lineHeight: 18 },
  label:        { color: '#a78bfa', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 14, marginBottom: 6 },
  input:        { backgroundColor: '#1E293B', borderRadius: 8, padding: 10, borderWidth: 0.5, borderColor: '#334155', color: '#E2E8F0', fontSize: 13, marginBottom: 6 } as any,
  checkbox:     { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#475569', alignItems: 'center', justifyContent: 'center' },
  checkboxOn:   { backgroundColor: '#7c3aed', borderColor: '#a78bfa' },
});
