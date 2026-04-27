// AURA. — PatientHub — orchestrator
// 11 sub-tabs + header: IA | Exame | Doc | TCLE | Portal
// Decomposicao: PatientHubSubTabs (9 sub-tabs) + modais separados

import { useState } from 'react';
import {
  Modal, View, Text, StyleSheet,
  Platform, Pressable,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { OdontoSubNav } from './OdontoSubNav';
import { PortalShareModal } from './PortalShareModal';
import { ConsentCollectModal } from './ConsentCollectModal';
import { DentalAiChat } from './DentalAiChat';
import { ImplantWorkflow } from './ImplantWorkflow';
import { OrthoWorkflow } from './OrthoWorkflow';
import { DocumentEmitter } from './DocumentEmitter';
import { VoiceEvolution } from './VoiceEvolution';
import { ExamRequestPanel } from './ExamRequestPanel';
import {
  DataTab, AnamneseTab, OdontogramaTab, PeriogramaTab,
  ProntuarioTab, ImagensTab, OrcamentosTab, CobrancasTab, FichasTab,
} from './PatientHubSubTabs';
import type { SubTab } from './sections';

export interface PatientLite {
  id: string;
  name: string;
  full_name?: string;
  phone?: string | null;
  email?: string | null;
  cpf?: string | null;
  birthday?: string | null;
  notes?: string | null;
  is_patient?: boolean;
}

interface Props {
  visible: boolean;
  patient: PatientLite | null;
  onClose: () => void;
  onEdit?: (patient: PatientLite) => void;
}

const HUB_TABS: SubTab[] = [
  { id: 'dados',       label: 'Dados',       component: () => null },
  { id: 'anamnese',    label: 'Anamnese',    component: () => null },
  { id: 'odontograma', label: 'Odontograma', component: () => null },
  { id: 'periograma',  label: 'Periograma',  component: () => null, badge: 'novo' },
  { id: 'prontuario',  label: 'Prontuario',  component: () => null },
  { id: 'imagens',     label: 'Imagens',     component: () => null },
  { id: 'orcamentos',  label: 'Orcamentos',  component: () => null },
  { id: 'cobrancas',   label: 'Cobrancas',   component: () => null },
  { id: 'fichas',      label: 'Fichas',      component: () => null },
  { id: 'implantes',   label: 'Implantes',   component: () => null },
  { id: 'ortodontia',  label: 'Ortodontia',  component: () => null },
];

export function PatientHub({ visible, patient, onClose, onEdit }: Props) {
  const qc = useQueryClient();
  const [activeTab,   setActiveTab]   = useState('dados');
  const [portalOpen,  setPortalOpen]  = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [aiOpen,      setAiOpen]      = useState(false);
  const [docOpen,     setDocOpen]     = useState(false);
  const [voiceOpen,   setVoiceOpen]   = useState(false);
  const [examOpen,    setExamOpen]    = useState(false);

  if (!patient) return null;

  const renderTab = () => {
    switch (activeTab) {
      case 'dados':       return <DataTab patient={patient} />;
      case 'anamnese':    return <AnamneseTab patient={patient} />;
      case 'odontograma': return <OdontogramaTab patient={patient} />;
      case 'periograma':  return <PeriogramaTab patient={patient} />;
      case 'prontuario':  return <ProntuarioTab patient={patient} onVoice={() => setVoiceOpen(true)} />;
      case 'imagens':     return <ImagensTab patient={patient} />;
      case 'orcamentos':  return <OrcamentosTab patient={patient} />;
      case 'cobrancas':   return <CobrancasTab patient={patient} />;
      case 'fichas':      return <FichasTab patient={patient} />;
      case 'implantes':   return <ImplantWorkflow patient={patient} />;
      case 'ortodontia':  return <OrthoWorkflow patient={patient} />;
      default:            return <DataTab patient={patient} />;
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}>
        <View style={st.modal}>
          {/* Header */}
          <View style={st.header}>
            <View style={st.headerLeft}>
              <View style={st.avatar}>
                <Text style={st.avatarText}>{(patient.name||'?').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.headerName}>{patient.full_name || patient.name}</Text>
                <Text style={st.headerMeta}>{patient.phone || 'Sem telefone'}{patient.is_patient === false ? ' • Lead' : ''}</Text>
              </View>
            </View>
            <View style={st.headerActions}>
              <Pressable onPress={() => setAiOpen(true)} style={[st.iconBtn, st.iconBtnAi]}>
                <Text style={st.iconBtnTextAi}>✨ IA</Text>
              </Pressable>
              <Pressable onPress={() => setExamOpen(true)} style={[st.iconBtn, st.iconBtnExam]}>
                <Text style={st.iconBtnTextExam}>🔬 Exame</Text>
              </Pressable>
              <Pressable onPress={() => setDocOpen(true)} style={[st.iconBtn, st.iconBtnDoc]}>
                <Text style={st.iconBtnTextDoc}>🗒️ Doc</Text>
              </Pressable>
              <Pressable onPress={() => setConsentOpen(true)} style={[st.iconBtn, st.iconBtnConsent]}>
                <Text style={st.iconBtnTextConsent}>TCLE</Text>
              </Pressable>
              <Pressable onPress={() => setPortalOpen(true)} style={[st.iconBtn, st.iconBtnPortal]}>
                <Text style={st.iconBtnTextPortal}>Portal</Text>
              </Pressable>
              {onEdit && (
                <Pressable onPress={() => onEdit(patient)} style={st.iconBtn}>
                  <Text style={st.iconBtnText}>Editar</Text>
                </Pressable>
              )}
              <Pressable onPress={onClose} style={st.iconBtn}>
                <Text style={st.iconBtnText}>Fechar</Text>
              </Pressable>
            </View>
          </View>

          <OdontoSubNav tabs={HUB_TABS} activeId={activeTab} onChange={setActiveTab} />
          <View style={{ flex: 1 }}>{renderTab()}</View>
        </View>
      </Modal>

      {/* Modais overlay */}
      <PortalShareModal visible={portalOpen} patientId={patient.id} patientName={patient.full_name||patient.name} patientPhone={patient.phone||undefined} onClose={() => setPortalOpen(false)} />
      <ConsentCollectModal visible={consentOpen} patientId={patient.id} patientName={patient.full_name||patient.name} patientPhone={patient.phone||undefined} onClose={() => setConsentOpen(false)} onSigned={() => { qc.invalidateQueries({ queryKey: ['dental-consent-docs', patient.id] }); }} />
      <DentalAiChat visible={aiOpen} onClose={() => setAiOpen(false)} initialPatientId={patient.id} initialPatientName={patient.full_name||patient.name} />
      <DocumentEmitter visible={docOpen} patient={patient} onClose={() => setDocOpen(false)} />

      <Modal visible={voiceOpen} animationType="slide" onRequestClose={() => setVoiceOpen(false)} presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}>
        <VoiceEvolution patient={patient} onClose={() => setVoiceOpen(false)} onSaved={() => { setVoiceOpen(false); qc.invalidateQueries({ queryKey: ['dental-prescriptions', patient.id] }); }} />
      </Modal>

      <Modal visible={examOpen} animationType="slide" onRequestClose={() => setExamOpen(false)} presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}>
        <ExamRequestPanel patient={patient} onClose={() => setExamOpen(false)} onSaved={() => setExamOpen(false)} />
      </Modal>
    </>
  );
}

const st = StyleSheet.create({
  modal:         { flex: 1, backgroundColor: '#0F172A' },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 16 : 24, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B', gap: 12 },
  headerLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar:        { width: 44, height: 44, borderRadius: 22, backgroundColor: '#06B6D4', alignItems: 'center', justifyContent: 'center' },
  avatarText:    { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  headerName:    { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  headerMeta:    { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 240 },
  iconBtn:            { paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#1E293B', borderRadius: 8 },
  iconBtnText:        { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  iconBtnAi:          { backgroundColor: '#7c3aed', borderWidth: 1, borderColor: '#a78bfa' },
  iconBtnTextAi:      { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  iconBtnExam:        { backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.4)' },
  iconBtnTextExam:    { color: '#10B981', fontSize: 11, fontWeight: '700' },
  iconBtnDoc:         { backgroundColor: 'rgba(245,158,11,0.15)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)' },
  iconBtnTextDoc:     { color: '#F59E0B', fontSize: 11, fontWeight: '700' },
  iconBtnConsent:     { backgroundColor: 'rgba(6,182,212,0.15)', borderWidth: 1, borderColor: 'rgba(6,182,212,0.4)' },
  iconBtnTextConsent: { color: '#06B6D4', fontSize: 11, fontWeight: '700' },
  iconBtnPortal:      { backgroundColor: 'rgba(167,139,250,0.15)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.4)' },
  iconBtnTextPortal:  { color: '#a78bfa', fontSize: 11, fontWeight: '700' },
});

export default PatientHub;
