// AURA. — PatientHubSubTabs
// 9 componentes de sub-tab do PatientHub, extraidos para decomposicao.
// Cada tab e responsavel por sua propria query e UI.

import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Linking, Alert, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { AnamneseWizard, type AnamneseData } from './AnamneseWizard';
import { ClinicalImages } from './ClinicalImages';
import { Periograma } from './Periograma';
import { FichaEspecialidade } from './FichaEspecialidade';
import { OdontogramaSVG } from './OdontogramaSVG';
import { ProntuarioTimeline } from './ProntuarioTimeline';
import { AddPerioExamModal } from './AddPerioExamModal';
import { AddSpecialtyFormModal } from './AddSpecialtyFormModal';
import { AddClinicalImageModal } from './AddClinicalImageModal';
import type { PatientLite } from './PatientHub';

// ─── Helpers ─────────────────────────────────────────────────
export function formatBRL(v: number): string {
  if (!isFinite(v)) return '0,00';
  const [int, dec] = v.toFixed(2).split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}
export function formatDateBR(iso?: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return '—'; }
}
export function planStatusBg(s: string) {
  if (['aprovado','concluido'].includes(s))       return 'rgba(16,185,129,0.15)';
  if (['recusado','cancelado'].includes(s))        return 'rgba(239,68,68,0.15)';
  if (['enviado','em_tratamento'].includes(s))     return 'rgba(6,182,212,0.15)';
  return 'rgba(148,163,184,0.15)';
}
export function planStatusColor(s: string) {
  if (['aprovado','concluido'].includes(s))        return '#10B981';
  if (['recusado','cancelado'].includes(s))        return '#EF4444';
  if (['enviado','em_tratamento'].includes(s))     return '#06B6D4';
  return '#94A3B8';
}
export function planStatusLabel(s: string) {
  const m: Record<string,string> = {
    rascunho:'Rascunho', enviado:'Enviado', aprovado:'Aprovado',
    recusado:'Recusado', em_tratamento:'Em tratamento',
    concluido:'Concluido', cancelado:'Cancelado',
  };
  return m[s] || s;
}

// ─── DataTab ──────────────────────────────────────────────────
export function DataTab({ patient }: { patient: PatientLite }) {
  const Field = ({ label, value }: { label: string; value?: string | null }) => (
    <View style={st.fieldRow}>
      <Text style={st.fieldLabel}>{label}</Text>
      <Text style={st.fieldValue}>{value || '—'}</Text>
    </View>
  );
  return (
    <ScrollView style={st.tab}>
      <View style={st.section}>
        <Text style={st.sectionTitle}>Contato</Text>
        <Field label="Nome completo" value={patient.full_name || patient.name} />
        <Field label="Telefone" value={patient.phone} />
        <Field label="Email" value={patient.email} />
        {patient.phone && (
          <TouchableOpacity
            onPress={() => Linking.openURL(`https://wa.me/55${patient.phone!.replace(/\D/g,'')}`).catch(()=>{})}
            style={st.waBtn}
          >
            <Text style={st.waBtnText}>💬 Conversar no WhatsApp</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={st.section}>
        <Text style={st.sectionTitle}>Identificacao</Text>
        <Field label="CPF" value={patient.cpf} />
        <Field label="Data nascimento" value={patient.birthday} />
      </View>
      {patient.notes && (
        <View style={st.section}>
          <Text style={st.sectionTitle}>Observacoes</Text>
          <Text style={st.notes}>{patient.notes}</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ─── AnamneseTab ─────────────────────────────────────────────
export function AnamneseTab({ patient }: { patient: PatientLite }) {
  const cid = useAuthStore().company?.id;
  const qc  = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['dental-anamnesis', cid, patient.id],
    queryFn:  () => request(`/companies/${cid}/dental/patients/${patient.id}/anamnesis`),
    enabled: !!cid && !!patient.id, staleTime: 60000,
  });
  const save = useMutation({
    mutationFn: (d: AnamneseData) =>
      request(`/companies/${cid}/dental/patients/${patient.id}/anamnesis`, { method: 'PUT', body: { data: d } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dental-anamnesis', cid, patient.id] }); Alert.alert('Anamnese salva','Dados registrados.'); },
    onError: (e: any) => Alert.alert('Erro', e?.message),
  });
  if (isLoading) return <View style={st.center}><ActivityIndicator color="#06B6D4" /></View>;
  if (error) return <View style={st.center}><Text style={st.errTitle}>Erro</Text><Text style={st.errMsg}>{(error as any)?.message}</Text></View>;
  return (
    <View style={st.tab}>
      {(data as any)?.updated_at && (
        <View style={st.infoBadge}><Text style={st.infoBadgeText}>Atualizado: {formatDateBR((data as any).updated_at)}</Text></View>
      )}
      <AnamneseWizard initialData={(data as any)?.anamnesis || undefined} onComplete={d => save.mutate(d)} />
      {save.isPending && (
        <View style={st.savingOverlay}><ActivityIndicator color="#06B6D4" /><Text style={st.savingText}>Salvando...</Text></View>
      )}
    </View>
  );
}

// ─── OdontogramaTab ──────────────────────────────────────────
export function OdontogramaTab({ patient }: { patient: PatientLite }) {
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
  if (isLoading) return <View style={st.center}><ActivityIndicator color="#06B6D4" /></View>;
  if (error) return <View style={st.center}><Text style={st.errTitle}>Erro</Text></View>;
  const teeth = ((data as any)?.teeth || []).map((t: any) => {
    const faces: any = { M:null,D:null,O:null,V:null,L:null };
    (t.faces||[]).forEach((f: any) => { if (f.face && f.face in faces) faces[f.face]=f.status||null; });
    return { number: t.tooth, status: (t.faces&&t.faces[0]?.status)||'higido', faces };
  });
  return <ScrollView style={st.tab}><OdontogramaSVG teeth={teeth} onStatusChange={(n,s)=>mut.mutate({tooth:n,status:s})} /></ScrollView>;
}

// ─── PeriogramaTab ───────────────────────────────────────────
export function PeriogramaTab({ patient }: { patient: PatientLite }) {
  const cid = useAuthStore().company?.id;
  const qc  = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['dental-perio', cid, patient.id],
    queryFn:  () => request(`/companies/${cid}/dental/patients/${patient.id}/perio`),
    enabled: !!cid && !!patient.id, staleTime: 30000,
  });
  if (isLoading) return <View style={st.center}><ActivityIndicator color="#06B6D4" /></View>;
  const charts = ((data as any)?.charts||[]).map((c: any) => ({
    id:c.id,exam_date:c.exam_date,measurements:c.measurements||{},
    bleeding_sites:c.bleeding_sites||0,total_sites:c.total_sites||0,
    bleeding_index:c.bleeding_index||0,plaque_index:c.plaque_index||0,
    diagnosis:c.diagnosis,notes:c.notes,
  }));
  return (
    <>
      <ScrollView style={st.tab}><Periograma charts={charts} patientName={patient.full_name||patient.name} onAddExam={()=>setShowAdd(true)} onViewChart={()=>{}} /></ScrollView>
      <AddPerioExamModal visible={showAdd} patientId={patient.id} patientName={patient.full_name||patient.name} onClose={()=>setShowAdd(false)} onSaved={()=>qc.invalidateQueries({queryKey:['dental-perio',cid,patient.id]})} />
    </>
  );
}

// ─── ProntuarioTab ───────────────────────────────────────────
export function ProntuarioTab({ patient, onVoice }: { patient: PatientLite; onVoice?: () => void }) {
  const cid = useAuthStore().company?.id;
  const { data, isLoading } = useQuery({
    queryKey: ['dental-prescriptions', cid, patient.id],
    queryFn:  () => request(`/companies/${cid}/dental/patients/${patient.id}/prescriptions`),
    enabled: !!cid && !!patient.id, staleTime: 15000,
  });
  if (isLoading) return <View style={st.center}><ActivityIndicator color="#06B6D4" /></View>;
  const entries = ((data as any)?.prescriptions||[]).map((p: any) => ({ id:p.id,type:p.doc_type||'receituario',date:p.issued_at,description:p.content,professional:'' }));
  return (
    <View style={{ flex: 1 }}>
      {onVoice && (
        <TouchableOpacity onPress={onVoice} style={st.voiceBtn}>
          <Text style={st.voiceBtnText}>🎤 Registrar por voz</Text>
        </TouchableOpacity>
      )}
      {!entries.length
        ? <View style={st.center}><Text style={st.errTitle}>Sem registros</Text><Text style={st.errMsg}>Use o botao de voz ou salve documentos pela aba Doc</Text></View>
        : <ScrollView style={st.tab}><ProntuarioTimeline entries={entries} patientName={patient.full_name||patient.name} /></ScrollView>
      }
    </View>
  );
}

// ─── ImagensTab ──────────────────────────────────────────────
export function ImagensTab({ patient }: { patient: PatientLite }) {
  const cid = useAuthStore().company?.id;
  const qc  = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['dental-images', cid, patient.id],
    queryFn:  () => request(`/companies/${cid}/dental/patients/${patient.id}/images`),
    enabled: !!cid && !!patient.id, staleTime: 30000,
  });
  const del = useMutation({
    mutationFn: (id: string) => request(`/companies/${cid}/dental/images/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dental-images', cid, patient.id] }),
    onError: (e: any) => Alert.alert('Erro', e?.message),
  });
  if (isLoading) return <View style={st.center}><ActivityIndicator color="#06B6D4" /></View>;
  const images = ((data as any)?.images||[]).map((i: any) => ({
    id:i.id,url:i.url,thumbnail_url:i.thumbnail_url||i.url,tooth_number:i.tooth_number,
    image_type:i.image_type,description:i.description,taken_at:i.taken_at,uploaded_at:i.created_at||i.uploaded_at,
  }));
  return (
    <>
      <ScrollView style={st.tab}>
        <ClinicalImages
          images={images}
          patientName={patient.full_name||patient.name}
          onUpload={() => setShowAdd(true)}
          onImagePress={(img: any) => Linking.openURL(img.url).catch(()=>{})}
          onDelete={(id: string) => Alert.alert('Excluir?','Acao irreversivel.',[
            {text:'Cancelar',style:'cancel'},
            {text:'Excluir',style:'destructive',onPress:()=>del.mutate(id)},
          ])}
        />
      </ScrollView>
      <AddClinicalImageModal visible={showAdd} patientId={patient.id} patientName={patient.full_name||patient.name} onClose={()=>setShowAdd(false)} onSaved={()=>qc.invalidateQueries({queryKey:['dental-images',cid,patient.id]})} />
    </>
  );
}

// ─── OrcamentosTab ───────────────────────────────────────────
export function OrcamentosTab({ patient }: { patient: PatientLite }) {
  const cid = useAuthStore().company?.id;
  const { data, isLoading } = useQuery({
    queryKey: ['dental-plans-patient', cid, patient.id],
    queryFn:  () => request(`/companies/${cid}/dental/treatment-plans?customer_id=${patient.id}`),
    enabled: !!cid && !!patient.id, staleTime: 30000,
  });
  if (isLoading) return <View style={st.center}><ActivityIndicator color="#06B6D4" /></View>;
  const plans = (data as any)?.plans || [];
  if (!plans.length) return <View style={st.center}><Text style={st.errTitle}>Sem orcamentos</Text></View>;
  return (
    <ScrollView style={st.tab}>
      {plans.map((p: any) => (
        <View key={p.id} style={st.planCard}>
          <View style={st.planRow}>
            <Text style={st.planNumber}>#{p.plan_number||p.id.slice(0,8)}</Text>
            <View style={[st.statusChip,{backgroundColor:planStatusBg(p.status)}]}>
              <Text style={[st.statusTxt,{color:planStatusColor(p.status)}]}>{planStatusLabel(p.status)}</Text>
            </View>
          </View>
          <Text style={st.planTotal}>R$ {formatBRL(parseFloat(p.total)||0)}</Text>
          <Text style={st.planMeta}>{parseInt(p.items_count)||0} procedimento(s)</Text>
          <Text style={st.planDate}>Criado em {formatDateBR(p.created_at)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── CobrancasTab ────────────────────────────────────────────
export function CobrancasTab({ patient }: { patient: PatientLite }) {
  const cid = useAuthStore().company?.id;
  const { data, isLoading } = useQuery({
    queryKey: ['dental-billing-patient', cid, patient.id],
    queryFn:  () => request(`/companies/${cid}/dental/billing/patient/${patient.id}`),
    enabled: !!cid && !!patient.id, staleTime: 30000,
  });
  if (isLoading) return <View style={st.center}><ActivityIndicator color="#06B6D4" /></View>;
  const installments = (data as any)?.installments || [];
  if (!installments.length) return <View style={st.center}><Text style={st.errTitle}>Sem parcelas</Text></View>;
  return (
    <ScrollView style={st.tab}>
      <View style={st.summaryRow}>
        {([['Em aberto','#F59E0B',(data as any)?.total_pending],['Vencido','#EF4444',(data as any)?.total_overdue],['Pago','#10B981',(data as any)?.total_paid]] as const).map(([l,c,v])=>(
          <View key={String(l)} style={st.summaryCard}>
            <Text style={st.summaryLabel}>{l}</Text>
            <Text style={[st.summaryValue,{color:String(c)}]}>R$ {formatBRL(parseFloat(String(v))||0)}</Text>
          </View>
        ))}
      </View>
      {installments.map((p: any)=>{
        const isPaid=p.status==='paid', days=parseInt(p.days_overdue)||0, isOvd=!isPaid&&days>0, amt=parseFloat(p.amount)||0;
        return (
          <View key={p.payment_id} style={[st.installCard,isOvd&&st.installCardOvd,isPaid&&st.installCardPaid]}>
            <View style={{flex:1}}>
              <Text style={st.installNum}>Parcela {p.installment_number}</Text>
              <Text style={st.installDate}>{isPaid?`Pago em ${formatDateBR(p.paid_at)}`:isOvd?`Venceu ha ${days}d`:`Vence em ${formatDateBR(p.due_date)}`}</Text>
            </View>
            <Text style={[st.installAmt,isPaid&&{color:'#10B981'},isOvd&&{color:'#EF4444'}]}>R$ {formatBRL(amt)}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── FichasTab ───────────────────────────────────────────────
export function FichasTab({ patient }: { patient: PatientLite }) {
  const cid = useAuthStore().company?.id;
  const qc  = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [initSpec, setInitSpec] = useState<string|undefined>(undefined);
  const { data, isLoading } = useQuery({
    queryKey: ['dental-specialty-forms', cid, patient.id],
    queryFn:  () => request(`/companies/${cid}/dental/patients/${patient.id}/specialty-forms`),
    enabled: !!cid && !!patient.id, staleTime: 30000,
  });
  if (isLoading) return <View style={st.center}><ActivityIndicator color="#06B6D4" /></View>;
  const forms = ((data as any)?.forms||[]).map((f: any) => ({
    id:f.id,patient_id:f.patient_id||f.customer_id,specialty:f.specialty,
    form_data:f.form_data||{},professional_id:f.professional_id,notes:f.notes,created_at:f.created_at,
  }));
  return (
    <>
      <ScrollView style={st.tab}>
        <FichaEspecialidade forms={forms} patientName={patient.full_name||patient.name}
          onAddForm={s=>{setInitSpec(s);setShowAdd(true);}} onViewForm={()=>{}} />
      </ScrollView>
      <AddSpecialtyFormModal visible={showAdd} patientId={patient.id} patientName={patient.full_name||patient.name}
        initialSpecialty={initSpec} onClose={()=>{setShowAdd(false);setInitSpec(undefined);}}
        onSaved={()=>qc.invalidateQueries({queryKey:['dental-specialty-forms',cid,patient.id]})} />
    </>
  );
}

// ─── Shared styles ───────────────────────────────────────────
const st = StyleSheet.create({
  tab:          { flex: 1, padding: 16 },
  center:       { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center' },
  errTitle:     { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errMsg:       { color: '#94A3B8', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  section:      { marginBottom: 20 },
  sectionTitle: { color: '#94A3B8', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  fieldRow:     { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  fieldLabel:   { color: '#64748B', fontSize: 11, marginBottom: 2 },
  fieldValue:   { color: '#E2E8F0', fontSize: 14, fontWeight: '500' },
  notes:        { color: '#CBD5E1', fontSize: 13, lineHeight: 20 },
  waBtn:        { marginTop: 12, backgroundColor: '#10B981', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' },
  waBtnText:    { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  infoBadge:    { marginBottom: 12, padding: 8, backgroundColor: 'rgba(6,182,212,0.08)', borderRadius: 6, borderWidth: 0.5, borderColor: 'rgba(6,182,212,0.2)' },
  infoBadgeText:{ color: '#06B6D4', fontSize: 11, fontWeight: '600' },
  savingOverlay:{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.7)', alignItems: 'center', justifyContent: 'center', gap: 12 },
  savingText:   { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  voiceBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#4C1D95', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, margin: 16, marginBottom: 8, alignSelf: 'flex-start' },
  voiceBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  planCard:     { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: '#334155' },
  planRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  planNumber:   { color: '#E2E8F0', fontSize: 13, fontWeight: '700' },
  statusChip:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusTxt:    { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  planTotal:    { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginVertical: 4 },
  planMeta:     { color: '#94A3B8', fontSize: 12 },
  planDate:     { color: '#64748B', fontSize: 11, marginTop: 4 },
  summaryRow:   { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryCard:  { flex: 1, backgroundColor: '#1E293B', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 0.5, borderColor: '#334155' },
  summaryLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  summaryValue: { fontSize: 15, fontWeight: '700' },
  installCard:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: '#334155', gap: 10 },
  installCardOvd: { borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.06)' },
  installCardPaid:{ opacity: 0.6 },
  installNum:   { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },
  installDate:  { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  installAmt:   { color: '#E2E8F0', fontSize: 15, fontWeight: '700' },
});
