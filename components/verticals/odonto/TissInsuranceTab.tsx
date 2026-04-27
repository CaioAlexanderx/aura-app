// AURA. — TissInsuranceTab
// Tab "Convenios" + CatalogPickerModal + InsuranceFormModal.
// Extraido de TissDashboard.tsx (decomposicao).

import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, ActivityIndicator, Alert, Modal, Linking,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/services/api';
import { Icon } from '@/components/Icon';
import type { Insurance, CatalogItem } from './tissTypes';
import { TISS_TOKENS } from './tissTypes';

// ─── InsuranceTab ─────────────────────────────────────────────
interface InsuranceTabProps {
  cid: string;
  onAddFromCatalog: () => void;
  onEdit: (i: Insurance) => void;
}

export function TissInsuranceTab({ cid, onAddFromCatalog, onEdit }: InsuranceTabProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['tiss-insurance', cid],
    queryFn: () => request<{ insurance: Insurance[] }>(`/companies/${cid}/dental/tiss/insurance`),
    enabled: !!cid,
  });
  const items = data?.insurance || [];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
      <Pressable onPress={onAddFromCatalog} style={[st.actionsRow, st.btnPrimary, { flex: 0, marginBottom: 12, paddingHorizontal: 12 }]}>
        <Icon name="plus" size={14} color="#fff" />
        <Text style={st.btnPrimaryText}>Adicionar do catalogo</Text>
      </Pressable>

      {isLoading ? (
        <ActivityIndicator color="#06B6D4" style={{ marginTop: 24 }} />
      ) : items.length === 0 ? (
        <View style={st.empty}>
          <Icon name="briefcase" size={32} color="#475569" />
          <Text style={st.emptyTitle}>Nenhum convenio cadastrado</Text>
          <Text style={st.emptySub}>Adicione do catalogo Aura (Bradesco, Amil, SulAmerica, Unimed) ou crie manualmente.</Text>
        </View>
      ) : items.map(i => (
        <Pressable key={i.id} onPress={() => onEdit(i)} style={st.card}>
          <View style={{ flex: 1 }}>
            <Text style={st.cardTitle}>{i.name}</Text>
            {i.ans_code       && <Text style={st.cardMeta}>ANS: {i.ans_code}</Text>}
            {i.provider_code  && <Text style={st.cardMeta}>Cod. prestador: {i.provider_code}</Text>}
            <Text style={st.cardMeta}>{i.guides_count || 0} guias • {i.payment_deadline_days || 30}d prazo</Text>
          </View>
          {!i.is_active && <View style={st.inactiveBadge}><Text style={st.inactiveText}>Inativo</Text></View>}
          <Icon name="chevron_right" size={16} color="#475569" />
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── CatalogPickerModal ───────────────────────────────────────
interface CatalogProps { visible: boolean; cid: string; onClose: () => void; }

export function TissCatalogModal({ visible, cid, onClose }: CatalogProps) {
  const qc = useQueryClient();
  const [selected,       setSelected]       = useState<CatalogItem | null>(null);
  const [providerCode,   setProviderCode]   = useState('');
  const [contractNumber, setContractNumber] = useState('');

  const { data } = useQuery({
    queryKey: ['tiss-catalog', cid],
    queryFn: () => request<{ catalog: CatalogItem[] }>(`/companies/${cid}/dental/tiss/catalog`),
    enabled: !!cid && visible,
  });

  const cloneMut = useMutation({
    mutationFn: () => request(`/companies/${cid}/dental/tiss/catalog/${selected!.id}/clone`, {
      method: 'POST', body: { provider_code: providerCode, contract_number: contractNumber },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tiss-insurance', cid] });
      Alert.alert('Convenio adicionado', `${selected!.name} foi adicionado.`);
      reset();
    },
    onError: (e: any) => Alert.alert('Erro', e?.body?.error || 'Nao foi possivel adicionar.'),
  });

  function reset() { setSelected(null); setProviderCode(''); setContractNumber(''); onClose(); }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={reset}>
      <View style={st.backdrop}>
        <View style={st.sheet}>
          <View style={st.sheetHeader}>
            <Text style={st.sheetTitle}>{selected ? selected.name : 'Catalogo de convenios'}</Text>
            <Pressable onPress={reset} hitSlop={10}><Icon name="x" size={18} color="#94A3B8" /></Pressable>
          </View>
          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ padding: 14 }}>
            {!selected ? (
              (data?.catalog || []).map(c => (
                <Pressable key={c.id} onPress={() => setSelected(c)} style={st.card}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.cardTitle}>{c.name}</Text>
                    {c.razao_social && <Text style={st.cardMeta} numberOfLines={1}>{c.razao_social}</Text>}
                    {c.ans_code && <Text style={st.cardMeta}>ANS: {c.ans_code}</Text>}
                  </View>
                  <Icon name="chevron_right" size={16} color="#475569" />
                </Pressable>
              ))
            ) : (
              <>
                <Text style={st.label}>Codigo do prestador *</Text>
                <TextInput value={providerCode} onChangeText={setProviderCode} style={st.input} placeholder="Ex: 12345678000190" placeholderTextColor="#475569" />
                <Text style={st.label}>Numero do contrato (opcional)</Text>
                <TextInput value={contractNumber} onChangeText={setContractNumber} style={st.input} placeholder="Ex: 0001234" placeholderTextColor="#475569" />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                  <Pressable onPress={() => setSelected(null)} style={[st.btn, st.btnGhost]}><Text style={st.btnGhostText}>Voltar</Text></Pressable>
                  <Pressable onPress={() => cloneMut.mutate()} disabled={!providerCode.trim() || cloneMut.isPending} style={[st.btn, st.btnPrimary, !providerCode.trim() && { opacity: 0.5 }]}>
                    {cloneMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.btnPrimaryText}>Adicionar</Text>}
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── InsuranceFormModal ───────────────────────────────────────
interface InsFormProps { visible: boolean; cid: string; insurance: Insurance | null; onClose: () => void; }

export function TissInsuranceFormModal({ visible, cid, insurance, onClose }: InsFormProps) {
  const qc = useQueryClient();
  const [providerCode,   setProviderCode]   = useState(insurance?.provider_code || '');
  const [contractNumber, setContractNumber] = useState(insurance?.contract_number || '');
  const [paymentDays,    setPaymentDays]    = useState(String(insurance?.payment_deadline_days || 30));

  const updateMut = useMutation({
    mutationFn: () => request(`/companies/${cid}/dental/tiss/insurance/${insurance!.id}`, {
      method: 'PATCH',
      body: { provider_code: providerCode, contract_number: contractNumber, payment_deadline_days: parseInt(paymentDays) || 30 },
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tiss-insurance', cid] }); Alert.alert('Salvo', 'Convenio atualizado.'); onClose(); },
    onError: (e: any) => Alert.alert('Erro', e?.body?.error || 'Nao foi possivel salvar.'),
  });

  if (!insurance) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={st.backdrop}>
        <View style={st.sheet}>
          <View style={st.sheetHeader}>
            <Text style={st.sheetTitle}>{insurance.name}</Text>
            <Pressable onPress={onClose} hitSlop={10}><Icon name="x" size={18} color="#94A3B8" /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 14 }}>
            {insurance.upload_portal_url && (
              <Pressable onPress={() => Linking.openURL(insurance.upload_portal_url!)} style={[st.card, { backgroundColor: 'rgba(6,182,212,0.1)', borderColor: 'rgba(6,182,212,0.3)' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[st.cardTitle, { color: '#06B6D4' }]}>Portal do convenio</Text>
                  <Text style={[st.cardMeta, { color: '#06B6D4' }]} numberOfLines={1}>{insurance.upload_portal_url}</Text>
                </View>
                <Icon name="external_link" size={14} color="#06B6D4" />
              </Pressable>
            )}
            {insurance.notes_billing && (
              <View style={[st.card, { backgroundColor: 'rgba(245,158,11,0.08)' }]}>
                <Text style={[st.cardMeta, { color: '#F59E0B' }]}>{insurance.notes_billing}</Text>
              </View>
            )}
            <Text style={st.label}>Codigo do prestador</Text>
            <TextInput value={providerCode} onChangeText={setProviderCode} style={st.input} />
            <Text style={st.label}>Numero do contrato</Text>
            <TextInput value={contractNumber} onChangeText={setContractNumber} style={st.input} />
            <Text style={st.label}>Prazo de pagamento (dias)</Text>
            <TextInput value={paymentDays} onChangeText={setPaymentDays} style={st.input} keyboardType="numeric" />
            <Pressable onPress={() => updateMut.mutate()} disabled={updateMut.isPending} style={[st.btn, st.btnPrimary, { marginTop: 16, flex: 0, paddingHorizontal: 20 }]}>
              {updateMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.btnPrimaryText}>Salvar</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  actionsRow:      { flexDirection: 'row', gap: 8, alignItems: 'center' },
  btn:             { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  btnPrimary:      { backgroundColor: '#7c3aed' },
  btnPrimaryText:  { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnGhost:        { backgroundColor: '#1E293B', borderWidth: 0.5, borderColor: '#334155' },
  btnGhostText:    { color: '#a78bfa', fontSize: 13, fontWeight: '600' },
  card:            { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1E293B', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: '#334155' },
  cardTitle:       { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },
  cardMeta:        { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  inactiveBadge:   { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(148,163,184,0.2)' },
  inactiveText:    { color: '#94A3B8', fontSize: 9, fontWeight: '700' },
  empty:           { padding: 32, alignItems: 'center', gap: 8 },
  emptyTitle:      { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  emptySub:        { color: '#94A3B8', fontSize: 12, textAlign: 'center', maxWidth: 320, lineHeight: 18 },
  label:           { color: '#a78bfa', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 14, marginBottom: 6 },
  input:           { backgroundColor: '#1E293B', borderRadius: 8, padding: 10, borderWidth: 0.5, borderColor: '#334155', color: '#E2E8F0', fontSize: 13, marginBottom: 6 } as any,
  backdrop:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:           { backgroundColor: '#0F172A', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' as any, borderWidth: 1, borderColor: '#1E293B' },
  sheetHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  sheetTitle:      { color: '#FFFFFF', fontSize: 15, fontWeight: '700', flex: 1 },
});
