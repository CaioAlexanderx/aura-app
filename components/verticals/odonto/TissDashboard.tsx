// AURA. — TissDashboard — orchestrator
// Gestao TISS completa: Convenios | Guias | Lotes.
// Decomposicao: tissTypes + TissInsuranceTab + TissGuidesTab + TissBatchesTab

import { useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useAuthStore } from '@/stores/auth';
import { Icon } from '@/components/Icon';
import type { Insurance, Guide } from './tissTypes';
import { TissInsuranceTab, TissCatalogModal, TissInsuranceFormModal } from './TissInsuranceTab';
import { TissGuidesTab, TissGuideFormModal } from './TissGuidesTab';
import { TissBatchesTab, TissBatchFormModal } from './TissBatchesTab';

interface Props {
  visible: boolean;
  onClose: () => void;
  initialPatientId?:   string;
  initialPatientName?: string;
}

export function TissDashboard({ visible, onClose, initialPatientId, initialPatientName }: Props) {
  const cid = useAuthStore().company?.id;
  const [tab,              setTab]              = useState<'convenios' | 'guias' | 'lotes'>('guias');
  const [showCatalog,      setShowCatalog]      = useState(false);
  const [showGuideForm,    setShowGuideForm]    = useState(false);
  const [showBatchForm,    setShowBatchForm]    = useState(false);
  const [editingInsurance, setEditingInsurance] = useState<Insurance | null>(null);
  const [editingGuide,     setEditingGuide]     = useState<Guide | null>(null);

  if (!cid) return null;

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={st.modal}>
          {/* Header */}
          <View style={st.header}>
            <Pressable onPress={onClose} hitSlop={10}>
              <Icon name="x" size={20} color="#94A3B8" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={st.headerTitle}>TISS</Text>
              <Text style={st.headerSub}>Faturamento de convenios</Text>
            </View>
          </View>

          {/* Tabs */}
          <View style={st.tabs}>
            {(['convenios', 'guias', 'lotes'] as const).map(t => (
              <Pressable key={t} onPress={() => setTab(t)} style={[st.tab, tab === t && st.tabActive]}>
                <Text style={[st.tabText, tab === t && st.tabTextActive]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flex: 1 }}>
            {tab === 'convenios' && (
              <TissInsuranceTab
                cid={cid}
                onAddFromCatalog={() => setShowCatalog(true)}
                onEdit={setEditingInsurance}
              />
            )}
            {tab === 'guias' && (
              <TissGuidesTab
                cid={cid}
                onCreate={() => { setEditingGuide(null); setShowGuideForm(true); }}
                onEdit={g => { setEditingGuide(g); setShowGuideForm(true); }}
                initialPatientId={initialPatientId}
              />
            )}
            {tab === 'lotes' && (
              <TissBatchesTab cid={cid} onCreate={() => setShowBatchForm(true)} />
            )}
          </View>
        </View>
      </Modal>

      <TissCatalogModal
        visible={showCatalog}
        cid={cid}
        onClose={() => setShowCatalog(false)}
      />
      <TissGuideFormModal
        visible={showGuideForm}
        cid={cid}
        guide={editingGuide}
        initialPatientId={initialPatientId}
        initialPatientName={initialPatientName}
        onClose={() => { setShowGuideForm(false); setEditingGuide(null); }}
      />
      <TissBatchFormModal
        visible={showBatchForm}
        cid={cid}
        onClose={() => setShowBatchForm(false)}
      />
      <TissInsuranceFormModal
        visible={!!editingInsurance}
        cid={cid}
        insurance={editingInsurance}
        onClose={() => setEditingInsurance(null)}
      />
    </>
  );
}

const st = StyleSheet.create({
  modal:        { flex: 1, backgroundColor: '#0F172A' },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingTop: Platform.OS === 'ios' ? 14 : 22, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  headerTitle:  { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  headerSub:    { color: '#94A3B8', fontSize: 11, marginTop: 1 },
  tabs:         { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1E293B', paddingHorizontal: 14, gap: 14 },
  tab:          { paddingVertical: 12 },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: '#a78bfa' },
  tabText:      { color: '#64748B', fontSize: 13, fontWeight: '600' },
  tabTextActive:{ color: '#a78bfa' },
});

export default TissDashboard;
