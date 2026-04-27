// AURA. — TissGuidesTab
// Tab "Guias" + GuideFormModal (form poliformico 4 tipos TISS).
// Extraido de TissDashboard.tsx (decomposicao).

import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, ActivityIndicator, Alert, Modal, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/services/api';
import { Icon } from '@/components/Icon';
import type { Guide, Insurance } from './tissTypes';
import { GUIDE_TYPE_LABELS, STATUS_COLORS, formatBRL, formatDateBR } from './tissTypes';

// ─── StatusBadge (shared) ────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_COLORS[status] || STATUS_COLORS.rascunho;
  return (
    <View style={[st.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[st.badgeText, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── GuidesTab ────────────────────────────────────────────────
interface GuidesTabProps {
  cid: string;
  onCreate: () => void;
  onEdit: (g: Guide) => void;
  initialPatientId?: string;
}

export function TissGuidesTab({ cid, onCreate, onEdit, initialPatientId }: GuidesTabProps) {
  const [filter, setFilter] = useState('all');
  const params       = filter === 'all' ? '' : `?status=${filter}`;
  const customerParam = initialPatientId
    ? (params ? `&customer_id=${initialPatientId}` : `?customer_id=${initialPatientId}`)
    : '';

  const { data, isLoading } = useQuery({
    queryKey: ['tiss-guides', cid, filter, initialPatientId],
    queryFn: () => request<{ guides: Guide[]; stats: any[] }>(`/companies/${cid}/dental/tiss/guides${params}${customerParam}`),
    enabled: !!cid,
  });
  const items = data?.guides || [];

  return (
    <View style={{ flex: 1 }}>
      {/* Filtros */}
      <View style={{ padding: 12, paddingBottom: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['all', 'rascunho', 'enviada', 'paga', 'glosada'].map(f => (
            <Pressable key={f} onPress={() => setFilter(f)} style={[st.chip, filter === f && st.chipActive]}>
              <Text style={[st.chipText, filter === f && st.chipTextActive]}>
                {f === 'all' ? 'Todas' : STATUS_COLORS[f]?.label || f}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={st.actionsRow}>
        <Pressable onPress={onCreate} style={[st.btn, st.btnPrimary]}>
          <Icon name="plus" size={14} color="#fff" />
          <Text style={st.btnPrimaryText}>Nova guia</Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingTop: 0 }}>
        {isLoading ? (
          <ActivityIndicator color="#06B6D4" style={{ marginTop: 24 }} />
        ) : items.length === 0 ? (
          <View style={st.empty}>
            <Icon name="file" size={32} color="#475569" />
            <Text style={st.emptyTitle}>Nenhuma guia</Text>
            <Text style={st.emptySub}>Clique em "Nova guia" pra comecar.</Text>
          </View>
        ) : items.map(g => (
          <Pressable key={g.id} onPress={() => onEdit(g)} style={st.card}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Text style={st.cardTitle}>{g.guide_number}</Text>
                <StatusBadge status={g.status} />
              </View>
              <Text style={st.cardSub}>{GUIDE_TYPE_LABELS[g.guide_type]} • {g.patient_full_name || g.patient_name}</Text>
              <Text style={st.cardMeta}>{g.insurance_name} • {formatDateBR(g.service_date)} • R$ {formatBRL(g.total_value)}</Text>
              {Number(g.paid_value || 0)    > 0 && <Text style={[st.cardMeta, { color: '#10B981' }]}>Pago: R$ {formatBRL(g.paid_value!)}</Text>}
              {Number(g.glossed_value || 0) > 0 && <Text style={[st.cardMeta, { color: '#EF4444' }]}>Glosado: R$ {formatBRL(g.glossed_value!)}</Text>}
            </View>
            <Icon name="chevron_right" size={16} color="#475569" />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── GuideFormModal ───────────────────────────────────────────
interface ProcedureRow { tuss_code: string; description: string; unit_value: string; quantity: string; tooth?: string; }

interface GuideFormProps {
  visible: boolean; cid: string; guide: Guide | null;
  initialPatientId?: string; initialPatientName?: string; onClose: () => void;
}

export function TissGuideFormModal({ visible, cid, guide, initialPatientId, initialPatientName, onClose }: GuideFormProps) {
  const qc = useQueryClient();
  const [guideType,          setGuideType]          = useState<'consulta'|'sp_sadt'|'honorario'|'internacao'>('sp_sadt');
  const [insuranceId,        setInsuranceId]        = useState('');
  const [patientId,          setPatientId]          = useState(initialPatientId || '');
  const [patientName]                               = useState(initialPatientName || '');
  const [cardId,             setCardId]             = useState('');
  const [serviceDate,        setServiceDate]        = useState(new Date().toISOString().substring(0, 10));
  const [authNumber,         setAuthNumber]         = useState('');
  const [authPassword,       setAuthPassword]       = useState('');
  const [professionalCro,    setProfessionalCro]    = useState('');
  const [cidCode,            setCidCode]            = useState('');
  const [clinicalIndication, setClinicalIndication] = useState('');
  const [procedures,         setProcedures]         = useState<ProcedureRow[]>([{ tuss_code:'', description:'', unit_value:'', quantity:'1' }]);

  const { data: insData }   = useQuery({ queryKey:['tiss-insurance',cid], queryFn:()=>request<{insurance:Insurance[]}>(`/companies/${cid}/dental/tiss/insurance`), enabled:!!cid&&visible });
  const { data: cardsData } = useQuery({ queryKey:['tiss-cards',cid,patientId], queryFn:()=>request<{cards:any[]}>(`/companies/${cid}/dental/tiss/patients/${patientId}/cards`), enabled:!!cid&&!!patientId&&visible });

  const createMut = useMutation({
    mutationFn: () => {
      const body: any = {
        customer_id: patientId, insurance_id: insuranceId, patient_insurance_id: cardId || null,
        guide_type: guideType, service_date: serviceDate, professional_cro: professionalCro,
        professional_council_uf: 'SP', professional_cbo: '223208',
        auth_number: authNumber || null, auth_password: authPassword || null,
        procedures: procedures.filter(p => p.tuss_code && p.unit_value).map(p => ({
          tuss_code: p.tuss_code, description: p.description,
          unit_value: parseFloat(p.unit_value) || 0, value: parseFloat(p.unit_value) || 0,
          quantity: parseInt(p.quantity) || 1, tooth: p.tooth || null, table_id: '22',
        })),
      };
      if (guideType === 'internacao') {
        body.cid_code = cidCode; body.clinical_indication = clinicalIndication;
        body.hospital_admission_at = new Date(serviceDate).toISOString(); body.hospital_regime = 'hospitalar';
      }
      return request(`/companies/${cid}/dental/tiss/guides`, { method: 'POST', body });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tiss-guides', cid] }); Alert.alert('Guia criada', 'Guia salva como rascunho.'); onClose(); },
    onError: (e: any) => Alert.alert('Erro', e?.body?.error || 'Nao foi possivel criar.'),
  });

  function addProcedure() { setProcedures([...procedures, { tuss_code:'', description:'', unit_value:'', quantity:'1' }]); }
  function updateProc(idx: number, key: keyof ProcedureRow, val: string) { const n=[...procedures]; n[idx]={...n[idx],[key]:val}; setProcedures(n); }
  function removeProc(idx: number) { setProcedures(procedures.filter((_,i)=>i!==idx)); }

  const totalValue = procedures.reduce((s,p)=>s+(parseFloat(p.unit_value)||0)*(parseInt(p.quantity)||1),0);
  const canSubmit  = !!patientId && !!insuranceId && !!professionalCro && procedures.some(p=>p.tuss_code&&p.unit_value);
  const insurances = insData?.insurance || [];
  const cards      = cardsData?.cards   || [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={st.modal}>
        <View style={st.header}>
          <Pressable onPress={onClose} hitSlop={10}><Icon name="x" size={20} color="#94A3B8" /></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={st.headerTitle}>{guide ? `Guia ${guide.guide_number}` : 'Nova guia TISS'}</Text>
            <Text style={st.headerSub}>R$ {formatBRL(totalValue)}</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 80 }}>
          {/* Tipo */}
          <Text style={st.label}>Tipo de guia *</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {(['consulta','sp_sadt','honorario','internacao'] as const).map(t=>(
              <Pressable key={t} onPress={()=>setGuideType(t)} style={[st.chip, guideType===t && st.chipActive]}>
                <Text style={[st.chipText, guideType===t && st.chipTextActive]}>{GUIDE_TYPE_LABELS[t]}</Text>
              </Pressable>
            ))}
          </View>

          {/* Convenio */}
          <Text style={st.label}>Convenio *</Text>
          {insurances.length===0
            ? <Text style={[st.cardMeta,{color:'#F59E0B',marginBottom:8}]}>Cadastre um convenio primeiro.</Text>
            : insurances.map(i=>(
              <Pressable key={i.id} onPress={()=>setInsuranceId(i.id)} style={[st.card, insuranceId===i.id && st.cardSelected]}>
                <Text style={st.cardTitle}>{i.name}</Text>
                {i.ans_code && <Text style={st.cardMeta}>ANS: {i.ans_code}</Text>}
              </Pressable>
            ))
          }

          {/* Paciente */}
          <Text style={st.label}>Paciente *</Text>
          {patientName
            ? <View style={[st.card, st.cardSelected]}><Text style={st.cardTitle}>{patientName}</Text></View>
            : <Text style={st.cardMeta}>Abra esta tela a partir do prontuario do paciente.</Text>
          }

          {/* Carteirinha */}
          {patientId && cards.length>0 && (
            <>
              <Text style={st.label}>Carteirinha</Text>
              {cards.map(c=>(
                <Pressable key={c.id} onPress={()=>setCardId(c.id)} style={[st.card, cardId===c.id && st.cardSelected]}>
                  <Text style={st.cardTitle}>{c.card_number}</Text>
                  <Text style={st.cardMeta}>{c.insurance_name}{c.plan_name && ` • ${c.plan_name}`}</Text>
                </Pressable>
              ))}
            </>
          )}

          {/* Campos comuns */}
          <Text style={st.label}>CRO do profissional *</Text>
          <TextInput value={professionalCro} onChangeText={setProfessionalCro} style={st.input} placeholder="Ex: 12345" placeholderTextColor="#475569" />
          <Text style={st.label}>Data do atendimento *</Text>
          <TextInput value={serviceDate} onChangeText={setServiceDate} style={st.input} placeholder="YYYY-MM-DD" placeholderTextColor="#475569" />
          <Text style={st.label}>Numero de autorizacao</Text>
          <TextInput value={authNumber} onChangeText={setAuthNumber} style={st.input} />
          <Text style={st.label}>Senha de autorizacao</Text>
          <TextInput value={authPassword} onChangeText={setAuthPassword} style={st.input} />

          {/* Internacao */}
          {guideType==='internacao' && (
            <>
              <Text style={st.label}>CID-10 *</Text>
              <TextInput value={cidCode} onChangeText={setCidCode} style={st.input} placeholder="Ex: K02.9" placeholderTextColor="#475569" />
              <Text style={st.label}>Indicacao clinica *</Text>
              <TextInput value={clinicalIndication} onChangeText={setClinicalIndication} style={[st.input,{minHeight:70}]} multiline />
            </>
          )}

          {/* Procedimentos */}
          <Text style={[st.label, { marginTop: 16 }]}>Procedimentos *</Text>
          {procedures.map((p,idx)=>(
            <View key={idx} style={[st.card, { gap: 6, flexDirection: 'column', alignItems: 'stretch' }]}>
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                <Text style={st.cardSub}>Procedimento {idx+1}</Text>
                {procedures.length>1 && <Pressable onPress={()=>removeProc(idx)} hitSlop={10}><Icon name="trash" size={14} color="#EF4444" /></Pressable>}
              </View>
              <TextInput value={p.tuss_code}    onChangeText={v=>updateProc(idx,'tuss_code',v)}   style={st.input} placeholder="Codigo TUSS" placeholderTextColor="#475569" />
              <TextInput value={p.description}  onChangeText={v=>updateProc(idx,'description',v)} style={st.input} placeholder="Descricao"   placeholderTextColor="#475569" />
              <View style={{ flexDirection:'row', gap:6 }}>
                <TextInput value={p.unit_value} onChangeText={v=>updateProc(idx,'unit_value',v)} style={[st.input,{flex:1}]} placeholder="Valor unit." placeholderTextColor="#475569" keyboardType="decimal-pad" />
                <TextInput value={p.quantity}   onChangeText={v=>updateProc(idx,'quantity',v)}   style={[st.input,{width:70}]} placeholder="Qtd" placeholderTextColor="#475569" keyboardType="numeric" />
                <TextInput value={p.tooth||''}  onChangeText={v=>updateProc(idx,'tooth',v)}      style={[st.input,{width:70}]} placeholder="Dente" placeholderTextColor="#475569" />
              </View>
            </View>
          ))}

          <Pressable onPress={addProcedure} style={[st.btn, st.btnGhost, { flex:0, marginTop:4, paddingHorizontal:14 }]}>
            <Icon name="plus" size={14} color="#a78bfa" />
            <Text style={st.btnGhostText}>Adicionar procedimento</Text>
          </Pressable>

          <Pressable
            onPress={()=>createMut.mutate()}
            disabled={!canSubmit || createMut.isPending}
            style={[st.btn, st.btnPrimary, { flex:0, marginTop:20 }, !canSubmit && { opacity:0.5 }]}
          >
            {createMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.btnPrimaryText}>Salvar guia</Text>}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  modal:        { flex: 1, backgroundColor: '#0F172A' },
  header:       { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:14, paddingTop: Platform.OS==='ios'?14:22, paddingBottom:10, borderBottomWidth:1, borderBottomColor:'#1E293B' },
  headerTitle:  { color:'#FFFFFF', fontSize:16, fontWeight:'700' },
  headerSub:    { color:'#94A3B8', fontSize:11, marginTop:1 },
  actionsRow:   { flexDirection:'row', gap:8, padding:12 },
  btn:          { flex:1, paddingVertical:11, borderRadius:10, alignItems:'center', justifyContent:'center', flexDirection:'row', gap:6 },
  btnPrimary:   { backgroundColor:'#7c3aed' },
  btnPrimaryText:{ color:'#fff', fontSize:13, fontWeight:'700' },
  btnGhost:     { backgroundColor:'#1E293B', borderWidth:0.5, borderColor:'#334155' },
  btnGhostText: { color:'#a78bfa', fontSize:13, fontWeight:'600' },
  card:         { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:'#1E293B', borderRadius:10, padding:12, marginBottom:8, borderWidth:0.5, borderColor:'#334155' },
  cardSelected: { backgroundColor:'rgba(167,139,250,0.12)', borderColor:'rgba(167,139,250,0.5)' },
  cardTitle:    { color:'#E2E8F0', fontSize:13, fontWeight:'600' },
  cardSub:      { color:'#CBD5E1', fontSize:12, marginTop:2 },
  cardMeta:     { color:'#94A3B8', fontSize:11, marginTop:2 },
  badge:        { paddingHorizontal:7, paddingVertical:2, borderRadius:6 },
  badgeText:    { fontSize:9, fontWeight:'700', textTransform:'uppercase', letterSpacing:0.4 },
  empty:        { padding:32, alignItems:'center', gap:8 },
  emptyTitle:   { color:'#FFFFFF', fontSize:15, fontWeight:'700', textAlign:'center' },
  emptySub:     { color:'#94A3B8', fontSize:12, textAlign:'center', maxWidth:320, lineHeight:18 },
  label:        { color:'#a78bfa', fontSize:11, fontWeight:'700', textTransform:'uppercase', letterSpacing:0.6, marginTop:14, marginBottom:6 },
  input:        { backgroundColor:'#1E293B', borderRadius:8, padding:10, borderWidth:0.5, borderColor:'#334155', color:'#E2E8F0', fontSize:13, marginBottom:6 } as any,
  chip:         { paddingHorizontal:10, paddingVertical:6, borderRadius:14, backgroundColor:'#1E293B', borderWidth:0.5, borderColor:'#334155', marginRight:6 },
  chipActive:   { backgroundColor:'#7c3aed', borderColor:'#a78bfa' },
  chipText:     { color:'#CBD5E1', fontSize:11, fontWeight:'500' },
  chipTextActive:{ color:'#fff', fontWeight:'700' },
});
