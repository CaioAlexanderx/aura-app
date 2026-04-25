// ============================================================
// AURA. — PatientHub (W1+W2+W3+GAP-01+GAP-02+GAP-04)
// 11 sub-tabs + header: IA | Exame | Doc | TCLE | Portal
//
// GAP-02: botao 'Voz' no Prontuario -> VoiceEvolution modal
// GAP-04: botao 'Exame' no header -> ExamRequestPanel modal
// ============================================================

import { useState } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Linking, Platform, Pressable, Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { OdontoSubNav } from '@/components/verticals/odonto/OdontoSubNav';
import { AnamneseWizard, type AnamneseData } from '@/components/verticals/odonto/AnamneseWizard';
import { ClinicalImages } from '@/components/verticals/odonto/ClinicalImages';
import { Periograma } from '@/components/verticals/odonto/Periograma';
import { FichaEspecialidade } from '@/components/verticals/odonto/FichaEspecialidade';
import { OdontogramaSVG } from '@/components/verticals/odonto/OdontogramaSVG';
import { ProntuarioTimeline } from '@/components/verticals/odonto/ProntuarioTimeline';
import { AddPerioExamModal } from '@/components/verticals/odonto/AddPerioExamModal';
import { AddSpecialtyFormModal } from '@/components/verticals/odonto/AddSpecialtyFormModal';
import { AddClinicalImageModal } from '@/components/verticals/odonto/AddClinicalImageModal';
import { PortalShareModal } from '@/components/verticals/odonto/PortalShareModal';
import { ConsentCollectModal } from '@/components/verticals/odonto/ConsentCollectModal';
import { DentalAiChat } from '@/components/verticals/odonto/DentalAiChat';
import { ImplantWorkflow } from '@/components/verticals/odonto/ImplantWorkflow';
import { OrthoWorkflow } from '@/components/verticals/odonto/OrthoWorkflow';
import { DocumentEmitter } from '@/components/verticals/odonto/DocumentEmitter';
import { VoiceEvolution } from '@/components/verticals/odonto/VoiceEvolution';       // GAP-02
import { ExamRequestPanel } from '@/components/verticals/odonto/ExamRequestPanel'; // GAP-04
import type { SubTab } from '@/components/verticals/odonto/sections';

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

function formatBRL(v: number): string {
  if (!isFinite(v)) return '0,00';
  const [intPart, decPart] = v.toFixed(2).split('.');
  return `${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decPart}`;
}
function formatDateBR(iso?: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return '—'; }
}
function planStatusBg(s: string) {
  if (['aprovado','concluido'].includes(s)) return 'rgba(16,185,129,0.15)';
  if (['recusado','cancelado'].includes(s)) return 'rgba(239,68,68,0.15)';
  if (['enviado','em_tratamento'].includes(s)) return 'rgba(6,182,212,0.15)';
  return 'rgba(148,163,184,0.15)';
}
function planStatusColor(s: string) {
  if (['aprovado','concluido'].includes(s)) return '#10B981';
  if (['recusado','cancelado'].includes(s)) return '#EF4444';
  if (['enviado','em_tratamento'].includes(s)) return '#06B6D4';
  return '#94A3B8';
}
function planStatusLabel(s: string) {
  const m: Record<string,string> = {
    rascunho:'Rascunho', enviado:'Enviado', aprovado:'Aprovado',
    recusado:'Recusado', em_tratamento:'Em tratamento',
    concluido:'Concluido', cancelado:'Cancelado',
  };
  return m[s] || s;
}

// ── Sub-tab components ────────────────────────────────────────
function DataTab({ patient }: { patient: PatientLite }) {
  const Field = ({ label, value }: { label: string; value?: string | null }) => (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  );
  return (
    <ScrollView style={styles.tabContent}>
      <View style={styles.dataSection}>
        <Text style={styles.sectionTitle}>Contato</Text>
        <Field label="Nome completo" value={patient.full_name || patient.name} />
        <Field label="Telefone" value={patient.phone} />
        <Field label="Email" value={patient.email} />
        {patient.phone && (
          <TouchableOpacity
            onPress={() => Linking.openURL(`https://wa.me/55${patient.phone!.replace(/\D/g,'')}`).catch(()=>{})}
            style={styles.waButton}
          >
            <Text style={styles.waButtonText}>{'\uD83D\uDCAC'} Conversar no WhatsApp</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.dataSection}>
        <Text style={styles.sectionTitle}>Identificacao</Text>
        <Field label="CPF" value={patient.cpf} />
        <Field label="Data nascimento" value={patient.birthday} />
      </View>
      {patient.notes && (
        <View style={styles.dataSection}>
          <Text style={styles.sectionTitle}>Observacoes</Text>
          <Text style={styles.notesText}>{patient.notes}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function AnamneseTab({ patient }: { patient: PatientLite }) {
  const cid = useAuthStore().company?.id;
  const qc  = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['dental-anamnesis', cid, patient.id],
    queryFn:  () => request(`/companies/${cid}/dental/patients/${patient.id}/anamnesis`),
    enabled: !!cid && !!patient.id, staleTime: 60000,
  });
  const saveMut = useMutation({
    mutationFn: (d: AnamneseData) =>
      request(`/companies/${cid}/dental/patients/${patient.id}/anamnesis`, { method: 'PUT', body: { data: d } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dental-anamnesis', cid, patient.id] }); Alert.alert('Anamnese salva','Dados registrados.'); },
    onError: (e: any) => Alert.alert('Erro', e?.message),
  });
  if (isLoading) return <View style={styles.loadingWrap}><ActivityIndicator color="#06B6D4" /></View>;
  if (error) return <View style={styles.placeholderWrap}><Text style={styles.placeholderTitle}>Erro</Text><Text style={styles.placeholderMessage}>{(error as any)?.message}</Text></View>;
  return (
    <View style={styles.tabContent}>
      {(data as any)?.updated_at && <View style={styles.infoBadge}><Text style={styles.infoBadgeText}>Atualizado: {formatDateBR((data as any).updated_at)}</Text></View>}
      <AnamneseWizard initialData={(data as any)?.anamnesis || undefined} onComplete={d => saveMut.mutate(d)} />
      {saveMut.isPending && <View style={styles.savingOverlay}><ActivityIndicator color="#06B6D4" /><Text style={styles.savingText}>Salvando...</Text></View>}
    </View>
  );
}

function OdontogramaTabContent({ patient }: { patient: PatientLite }) {
  const cid = useAuthStore().company?.id;
  const qc  = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['dental-chart', cid, patient.id],
    queryFn:  () => request(`/companies/${cid}/dental/patients/${patient.id}/chart`),
    enabled: !!cid && !!patient.id, staleTime: 15000,
  });
  const mut = useMutation({
    mutationFn: (p: { tooth: number; status: string }) =>
      request(`/companies/${cid}/dental/patients/${patient.id}/chart`, { method: 'POST', body: { tooth_number: p.tooth, status: p.status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dental-chart', cid, patient.id] }),
    onError: (e: any) => Alert.alert('Erro', e?.message),
  });
  if (isLoading) return <View style={styles.loadingWrap}><ActivityIndicator color="#06B6D4" /></View>;
  if (error) return <View style={styles.placeholderWrap}><Text style={styles.placeholderTitle}>Erro</Text></View>;
  const teeth = ((data as any)?.teeth || []).map((t: any) => {
    const faces: any = { M:null,D:null,O:null,V:null,L:null };
    (t.faces||[]).forEach((f: any) => { if (f.face && f.face in faces) faces[f.face]=f.status||null; });
    return { number: t.tooth, status: (t.faces&&t.faces[0]?.status)||'higido', faces };
  });
  return <ScrollView style={styles.tabContent}><OdontogramaSVG teeth={teeth} onStatusChange={(n,s)=>mut.mutate({tooth:n,status:s})} /></ScrollView>;
}

function PeriogramaTab({ patient }: { patient: PatientLite }) {
  const cid = useAuthStore().company?.id;
  const qc  = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['dental-perio', cid, patient.id],
    queryFn:  () => request(`/companies/${cid}/dental/patients/${patient.id}/perio`),
    enabled: !!cid && !!patient.id, staleTime: 30000,
  });
  if (isLoading) return <View style={styles.loadingWrap}><ActivityIndicator color="#06B6D4" /></View>;
  if (error) return <View style={styles.placeholderWrap}><Text style={styles.placeholderTitle}>Erro</Text></View>;
  const charts = ((data as any)?.charts||[]).map((c: any) => ({
    id:c.id,exam_date:c.exam_date,measurements:c.measurements||{},
    bleeding_sites:c.bleeding_sites||0,total_sites:c.total_sites||0,
    bleeding_index:c.bleeding_index||0,plaque_index:c.plaque_index||0,
    diagnosis:c.diagnosis,notes:c.notes,
  }));
  return (
    <>
      <ScrollView style={styles.tabContent}><Periograma charts={charts} patientName={patient.full_name||patient.name} onAddExam={()=>setShowAdd(true)} onViewChart={()=>{}} /></ScrollView>
      <AddPerioExamModal visible={showAdd} patientId={patient.id} patientName={patient.full_name||patient.name} onClose={()=>setShowAdd(false)} onSaved={()=>qc.invalidateQueries({queryKey:['dental-perio',cid,patient.id]})} />
    </>
  );
}

// GAP-02: aceita onVoice para abrir VoiceEvolution
function ProntuarioTabContent({ patient, onVoice }: { patient: PatientLite; onVoice?: () => void }) {
  const cid = useAuthStore().company?.id;
  const { data, isLoading } = useQuery({
    queryKey: ['dental-prescriptions', cid, patient.id],
    queryFn:  () => request(`/companies/${cid}/dental/patients/${patient.id}/prescriptions`),
    enabled: !!cid && !!patient.id, staleTime: 15000,
  });
  if (isLoading) return <View style={styles.loadingWrap}><ActivityIndicator color="#06B6D4" /></View>;
  const entries = ((data as any)?.prescriptions||[]).map((p: any) => ({ id:p.id,type:p.doc_type||'receituario',date:p.issued_at,description:p.content,professional:'' }));
  return (
    <View style={{ flex: 1 }}>
      {/* Botao de ditado por voz (GAP-02) */}
      {onVoice && (
        <TouchableOpacity onPress={onVoice} style={styles.voiceBtn}>
          <Text style={styles.voiceBtnText}>{'🎤'} Registrar por voz</Text>
        </TouchableOpacity>
      )}
      {!entries.length
        ? <View style={styles.placeholderWrap}><Text style={styles.placeholderTitle}>Sem registros</Text><Text style={styles.placeholderMessage}>Use o botao de voz acima para registrar evoluções por ditado, ou salve documentos pela aba Doc</Text></View>
        : <ScrollView style={styles.tabContent}><ProntuarioTimeline entries={entries} patientName={patient.full_name||patient.name} /></ScrollView>
      }
    </View>
  );
}

function ImagensTab({ patient }: { patient: PatientLite }) {
  const cid = useAuthStore().company?.id;
  const qc  = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['dental-images', cid, patient.id],
    queryFn:  () => request(`/companies/${cid}/dental/patients/${patient.id}/images`),
    enabled: !!cid && !!patient.id, staleTime: 30000,
  });
  const delMut = useMutation({
    mutationFn: (id: string) => request(`/companies/${cid}/dental/images/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dental-images', cid, patient.id] }),
    onError: (e: any) => Alert.alert('Erro', e?.message),
  });
  if (isLoading) return <View style={styles.loadingWrap}><ActivityIndicator color="#06B6D4" /></View>;
  const images = ((data as any)?.images||[]).map((i: any) => ({
    id:i.id,url:i.url,thumbnail_url:i.thumbnail_url||i.url,tooth_number:i.tooth_number,
    image_type:i.image_type,description:i.description,taken_at:i.taken_at,uploaded_at:i.created_at||i.uploaded_at,
  }));
  return (
    <>
      <ScrollView style={styles.tabContent}>
        <ClinicalImages images={images} patientName={patient.full_name||patient.name} onUpload={()=>setShowAdd(true)}
          onImagePress={(img: any)=>Linking.openURL(img.url).catch(()=>{})}
          onDelete={(id: string)=>Alert.alert('Excluir?','Acao irreversivel.',[{text:'Cancelar',style:'cancel'},{text:'Excluir',style:'destructive',onPress:()=>delMut.mutate(id)}])}
        />
      </ScrollView>
      <AddClinicalImageModal visible={showAdd} patientId={patient.id} patientName={patient.full_name||patient.name} onClose={()=>setShowAdd(false)} onSaved={()=>qc.invalidateQueries({queryKey:['dental-images',cid,patient.id]})} />
    </>
  );
}

function OrcamentosTabContent({ patient }: { patient: PatientLite }) {
  const cid = useAuthStore().company?.id;
  const { data, isLoading } = useQuery({
    queryKey: ['dental-plans-patient', cid, patient.id],
    queryFn:  () => request(`/companies/${cid}/dental/treatment-plans?customer_id=${patient.id}`),
    enabled: !!cid && !!patient.id, staleTime: 30000,
  });
  if (isLoading) return <View style={styles.loadingWrap}><ActivityIndicator color="#06B6D4" /></View>;
  const plans = (data as any)?.plans || [];
  if (!plans.length) return <View style={styles.placeholderWrap}><Text style={styles.placeholderTitle}>Sem orcamentos</Text></View>;
  return (
    <ScrollView style={styles.tabContent}>
      {plans.map((p: any) => (
        <View key={p.id} style={styles.planCard}>
          <View style={styles.planCardHeader}>
            <Text style={styles.planNumber}>#{p.plan_number||p.id.slice(0,8)}</Text>
            <View style={[styles.statusChip,{backgroundColor:planStatusBg(p.status)}]}><Text style={[styles.statusChipText,{color:planStatusColor(p.status)}]}>{planStatusLabel(p.status)}</Text></View>
          </View>
          <Text style={styles.planTotal}>R$ {formatBRL(parseFloat(p.total)||0)}</Text>
          <Text style={styles.planMeta}>{parseInt(p.items_count)||0} procedimento(s)</Text>
          <Text style={styles.planDate}>Criado em {formatDateBR(p.created_at)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function CobrancasTabContent({ patient }: { patient: PatientLite }) {
  const cid = useAuthStore().company?.id;
  const { data, isLoading } = useQuery({
    queryKey: ['dental-billing-patient', cid, patient.id],
    queryFn:  () => request(`/companies/${cid}/dental/billing/patient/${patient.id}`),
    enabled: !!cid && !!patient.id, staleTime: 30000,
  });
  if (isLoading) return <View style={styles.loadingWrap}><ActivityIndicator color="#06B6D4" /></View>;
  const installments = (data as any)?.installments || [];
  if (!installments.length) return <View style={styles.placeholderWrap}><Text style={styles.placeholderTitle}>Sem parcelas</Text></View>;
  return (
    <ScrollView style={styles.tabContent}>
      <View style={styles.summaryRow}>
        {[['Em aberto','#F59E0B',(data as any)?.total_pending],['Vencido','#EF4444',(data as any)?.total_overdue],['Pago','#10B981',(data as any)?.total_paid]].map(([l,c,v])=>(
          <View key={String(l)} style={styles.summaryCard}><Text style={styles.summaryLabel}>{l}</Text><Text style={[styles.summaryValue,{color:String(c)}]}>R$ {formatBRL(parseFloat(String(v))||0)}</Text></View>
        ))}
      </View>
      {installments.map((p: any)=>{
        const isPaid=p.status==='paid', days=parseInt(p.days_overdue)||0, isOvd=!isPaid&&days>0, amt=parseFloat(p.amount)||0;
        return (
          <View key={p.payment_id} style={[styles.installmentCard,isOvd&&styles.installmentCardOverdue,isPaid&&styles.installmentCardPaid]}>
            <View style={{flex:1}}><Text style={styles.installmentNumber}>Parcela {p.installment_number}</Text><Text style={styles.installmentDate}>{isPaid?`Pago em ${formatDateBR(p.paid_at)}`:isOvd?`Venceu ha ${days}d`:`Vence em ${formatDateBR(p.due_date)}`}</Text></View>
            <Text style={[styles.installmentAmount,isPaid&&{color:'#10B981'},isOvd&&{color:'#EF4444'}]}>R$ {formatBRL(amt)}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

function FichasTab({ patient }: { patient: PatientLite }) {
  const cid = useAuthStore().company?.id;
  const qc  = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [initSpec, setInitSpec] = useState<string|undefined>(undefined);
  const { data, isLoading } = useQuery({
    queryKey: ['dental-specialty-forms', cid, patient.id],
    queryFn:  () => request(`/companies/${cid}/dental/patients/${patient.id}/specialty-forms`),
    enabled: !!cid && !!patient.id, staleTime: 30000,
  });
  if (isLoading) return <View style={styles.loadingWrap}><ActivityIndicator color="#06B6D4" /></View>;
  const forms = ((data as any)?.forms||[]).map((f: any) => ({
    id:f.id,patient_id:f.patient_id||f.customer_id,specialty:f.specialty,
    form_data:f.form_data||{},professional_id:f.professional_id,notes:f.notes,created_at:f.created_at,
  }));
  return (
    <>
      <ScrollView style={styles.tabContent}>
        <FichaEspecialidade forms={forms} patientName={patient.full_name||patient.name}
          onAddForm={s=>{setInitSpec(s);setShowAdd(true);}} onViewForm={()=>{}} />
      </ScrollView>
      <AddSpecialtyFormModal visible={showAdd} patientId={patient.id} patientName={patient.full_name||patient.name}
        initialSpecialty={initSpec} onClose={()=>{setShowAdd(false);setInitSpec(undefined);}}
        onSaved={()=>qc.invalidateQueries({queryKey:['dental-specialty-forms',cid,patient.id]})} />
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────
export function PatientHub({ visible, patient, onClose, onEdit }: Props) {
  const qc = useQueryClient();
  const [activeTab,   setActiveTab]   = useState('dados');
  const [portalOpen,  setPortalOpen]  = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [aiOpen,      setAiOpen]      = useState(false);
  const [docOpen,     setDocOpen]     = useState(false);
  const [voiceOpen,   setVoiceOpen]   = useState(false); // GAP-02
  const [examOpen,    setExamOpen]    = useState(false); // GAP-04

  if (!patient) return null;

  const renderTab = () => {
    switch (activeTab) {
      case 'dados':       return <DataTab patient={patient} />;
      case 'anamnese':    return <AnamneseTab patient={patient} />;
      case 'odontograma': return <OdontogramaTabContent patient={patient} />;
      case 'periograma':  return <PeriogramaTab patient={patient} />;
      case 'prontuario':  return <ProntuarioTabContent patient={patient} onVoice={() => setVoiceOpen(true)} />;
      case 'imagens':     return <ImagensTab patient={patient} />;
      case 'orcamentos':  return <OrcamentosTabContent patient={patient} />;
      case 'cobrancas':   return <CobrancasTabContent patient={patient} />;
      case 'fichas':      return <FichasTab patient={patient} />;
      case 'implantes':   return <ImplantWorkflow patient={patient} />;
      case 'ortodontia':  return <OrthoWorkflow patient={patient} />;
      default:            return <DataTab patient={patient} />;
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}
        presentationStyle={Platform.OS==='ios'?'pageSheet':'fullScreen'}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(patient.name||'?').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.headerInfo}>
                <Text style={styles.headerName}>{patient.full_name||patient.name}</Text>
                <Text style={styles.headerMeta}>{patient.phone||'Sem telefone'}{patient.is_patient===false?' \u2022 Lead':''}</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              {/* IA */}
              <Pressable onPress={()=>setAiOpen(true)} style={[styles.iconBtn,styles.iconBtnAi]}>
                <Text style={styles.iconBtnTextAi}>\u2728 IA</Text>
              </Pressable>
              {/* Exame (GAP-04) */}
              <Pressable onPress={()=>setExamOpen(true)} style={[styles.iconBtn,styles.iconBtnExam]}>
                <Text style={styles.iconBtnTextExam}>\uD83D\uDD2C Exame</Text>
              </Pressable>
              {/* Doc (GAP-01) */}
              <Pressable onPress={()=>setDocOpen(true)} style={[styles.iconBtn,styles.iconBtnDoc]}>
                <Text style={styles.iconBtnTextDoc}>\uD83D\uDCC4 Doc</Text>
              </Pressable>
              {/* TCLE */}
              <Pressable onPress={()=>setConsentOpen(true)} style={[styles.iconBtn,styles.iconBtnConsent]}>
                <Text style={styles.iconBtnTextConsent}>TCLE</Text>
              </Pressable>
              {/* Portal */}
              <Pressable onPress={()=>setPortalOpen(true)} style={[styles.iconBtn,styles.iconBtnPortal]}>
                <Text style={styles.iconBtnTextPortal}>Portal</Text>
              </Pressable>
              {onEdit && <Pressable onPress={()=>onEdit(patient)} style={styles.iconBtn}><Text style={styles.iconBtnText}>Editar</Text></Pressable>}
              <Pressable onPress={onClose} style={styles.iconBtn}><Text style={styles.iconBtnText}>Fechar</Text></Pressable>
            </View>
          </View>
          <OdontoSubNav tabs={HUB_TABS} activeId={activeTab} onChange={setActiveTab} />
          <View style={styles.content}>{renderTab()}</View>
        </View>
      </Modal>

      {/* Modals overlay */}
      <PortalShareModal visible={portalOpen} patientId={patient.id} patientName={patient.full_name||patient.name} patientPhone={patient.phone||undefined} onClose={()=>setPortalOpen(false)} />
      <ConsentCollectModal visible={consentOpen} patientId={patient.id} patientName={patient.full_name||patient.name} patientPhone={patient.phone||undefined} onClose={()=>setConsentOpen(false)} onSigned={()=>{ qc.invalidateQueries({queryKey:['dental-consent-docs',patient.id]}); }} />
      <DentalAiChat visible={aiOpen} onClose={()=>setAiOpen(false)} initialPatientId={patient.id} initialPatientName={patient.full_name||patient.name} />
      <DocumentEmitter visible={docOpen} patient={patient} onClose={()=>setDocOpen(false)} />

      {/* GAP-02: VoiceEvolution — abre sobre o PatientHub */}
      <Modal visible={voiceOpen} animationType="slide" onRequestClose={()=>setVoiceOpen(false)}
        presentationStyle={Platform.OS==='ios'?'pageSheet':'fullScreen'}>
        <VoiceEvolution
          patient={patient}
          onClose={()=>setVoiceOpen(false)}
          onSaved={()=>{
            setVoiceOpen(false);
            qc.invalidateQueries({queryKey:['dental-prescriptions',patient.id]});
          }}
        />
      </Modal>

      {/* GAP-04: ExamRequestPanel — abre sobre o PatientHub */}
      <Modal visible={examOpen} animationType="slide" onRequestClose={()=>setExamOpen(false)}
        presentationStyle={Platform.OS==='ios'?'pageSheet':'fullScreen'}>
        <ExamRequestPanel
          patient={patient}
          onClose={()=>setExamOpen(false)}
          onSaved={()=>setExamOpen(false)}
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modal: { flex:1, backgroundColor:'#0F172A' },
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingTop:Platform.OS==='ios'?16:24, paddingBottom:12, borderBottomWidth:1, borderBottomColor:'#1E293B', gap:12 },
  headerLeft: { flexDirection:'row', alignItems:'center', gap:12, flex:1 },
  avatar: { width:44, height:44, borderRadius:22, backgroundColor:'#06B6D4', alignItems:'center', justifyContent:'center' },
  avatarText: { color:'#FFFFFF', fontSize:18, fontWeight:'700' },
  headerInfo: { flex:1 },
  headerName: { color:'#FFFFFF', fontSize:16, fontWeight:'700' },
  headerMeta: { color:'#94A3B8', fontSize:12, marginTop:2 },
  headerActions: { flexDirection:'row', gap:5, flexWrap:'wrap', justifyContent:'flex-end', maxWidth:240 },
  iconBtn: { paddingHorizontal:8, paddingVertical:6, backgroundColor:'#1E293B', borderRadius:8 },
  iconBtnText: { color:'#94A3B8', fontSize:11, fontWeight:'600' },
  iconBtnPortal: { backgroundColor:'rgba(167,139,250,0.15)', borderWidth:1, borderColor:'rgba(167,139,250,0.4)' },
  iconBtnTextPortal: { color:'#a78bfa', fontSize:11, fontWeight:'700' },
  iconBtnConsent: { backgroundColor:'rgba(6,182,212,0.15)', borderWidth:1, borderColor:'rgba(6,182,212,0.4)' },
  iconBtnTextConsent: { color:'#06B6D4', fontSize:11, fontWeight:'700' },
  iconBtnAi: { backgroundColor:'#7c3aed', borderWidth:1, borderColor:'#a78bfa' },
  iconBtnTextAi: { color:'#FFFFFF', fontSize:11, fontWeight:'700' },
  iconBtnDoc: { backgroundColor:'rgba(245,158,11,0.15)', borderWidth:1, borderColor:'rgba(245,158,11,0.4)' },
  iconBtnTextDoc: { color:'#F59E0B', fontSize:11, fontWeight:'700' },
  iconBtnExam: { backgroundColor:'rgba(16,185,129,0.15)', borderWidth:1, borderColor:'rgba(16,185,129,0.4)' }, // GAP-04
  iconBtnTextExam: { color:'#10B981', fontSize:11, fontWeight:'700' },
  voiceBtn: { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'#4C1D95', paddingHorizontal:14, paddingVertical:9, borderRadius:10, margin:16, marginBottom:8, alignSelf:'flex-start' }, // GAP-02
  voiceBtnText: { color:'#FFFFFF', fontSize:13, fontWeight:'700' },
  content: { flex:1 },
  tabContent: { flex:1, padding:16 },
  loadingWrap: { flex:1, alignItems:'center', justifyContent:'center', padding:32 },
  dataSection: { marginBottom:20 },
  sectionTitle: { color:'#94A3B8', fontSize:11, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:8 },
  fieldRow: { paddingVertical:8, borderBottomWidth:1, borderBottomColor:'#1E293B' },
  fieldLabel: { color:'#64748B', fontSize:11, marginBottom:2 },
  fieldValue: { color:'#E2E8F0', fontSize:14, fontWeight:'500' },
  notesText: { color:'#CBD5E1', fontSize:13, lineHeight:20 },
  waButton: { marginTop:12, backgroundColor:'#10B981', paddingVertical:10, paddingHorizontal:16, borderRadius:8, alignItems:'center' },
  waButtonText: { color:'#FFFFFF', fontSize:13, fontWeight:'700' },
  infoBadge: { marginBottom:12, padding:8, backgroundColor:'rgba(6,182,212,0.08)', borderRadius:6, borderWidth:0.5, borderColor:'rgba(6,182,212,0.2)' },
  infoBadgeText: { color:'#06B6D4', fontSize:11, fontWeight:'600' },
  savingOverlay: { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(15,23,42,0.7)', alignItems:'center', justifyContent:'center', gap:12 },
  savingText: { color:'#FFFFFF', fontSize:13, fontWeight:'600' },
  placeholderWrap: { flex:1, padding:32, alignItems:'center', justifyContent:'center' },
  placeholderTitle: { color:'#FFFFFF', fontSize:18, fontWeight:'700', marginBottom:8 },
  placeholderMessage: { color:'#94A3B8', fontSize:13, textAlign:'center', lineHeight:20 },
  planCard: { backgroundColor:'#1E293B', borderRadius:12, padding:14, marginBottom:10, borderWidth:0.5, borderColor:'#334155' },
  planCardHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:6 },
  planNumber: { color:'#E2E8F0', fontSize:13, fontWeight:'700' },
  statusChip: { paddingHorizontal:8, paddingVertical:3, borderRadius:6 },
  statusChipText: { fontSize:10, fontWeight:'700', textTransform:'uppercase', letterSpacing:0.5 },
  planTotal: { color:'#FFFFFF', fontSize:18, fontWeight:'700', marginVertical:4 },
  planMeta: { color:'#94A3B8', fontSize:12 },
  planDate: { color:'#64748B', fontSize:11, marginTop:4 },
  summaryRow: { flexDirection:'row', gap:8, marginBottom:16 },
  summaryCard: { flex:1, backgroundColor:'#1E293B', borderRadius:10, padding:10, alignItems:'center', borderWidth:0.5, borderColor:'#334155' },
  summaryLabel: { color:'#94A3B8', fontSize:10, fontWeight:'600', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 },
  summaryValue: { fontSize:15, fontWeight:'700' },
  installmentCard: { flexDirection:'row', alignItems:'center', backgroundColor:'#1E293B', borderRadius:10, padding:12, marginBottom:8, borderWidth:0.5, borderColor:'#334155', gap:10 },
  installmentCardOverdue: { borderColor:'rgba(239,68,68,0.4)', backgroundColor:'rgba(239,68,68,0.06)' },
  installmentCardPaid: { opacity:0.6 },
  installmentNumber: { color:'#E2E8F0', fontSize:13, fontWeight:'600' },
  installmentDate: { color:'#94A3B8', fontSize:11, marginTop:2 },
  installmentAmount: { color:'#E2E8F0', fontSize:15, fontWeight:'700' },
});

export default PatientHub;
