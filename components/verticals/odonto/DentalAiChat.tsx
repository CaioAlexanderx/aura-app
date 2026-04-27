// AURA. — DentalAiChat — orchestrator
// IA Odonto: gerencia estado (lista | chat | gated) + queries.
// Decomposicao: DentalAiConvList + DentalAiChatView

import { useEffect, useState } from 'react';
import {
  Modal, View, Text, Pressable,
  StyleSheet, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { Icon } from '@/components/Icon';
import { DentalAiConvList } from './DentalAiConvList';
import { DentalAiChatView } from './DentalAiChatView';

interface Conversation {
  id: string;
  user_id: string | null;
  patient_id: string | null;
  patient_name?: string;
  title: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
}

interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
}

interface Props {
  visible:            boolean;
  onClose:            () => void;
  initialPatientId?:  string;
  initialPatientName?: string;
}

export function DentalAiChat({ visible, onClose, initialPatientId, initialPatientName }: Props) {
  const cid = useAuthStore().company?.id;
  const qc  = useQueryClient();

  const [activeCvid,      setActiveCvid]      = useState<string | null>(null);
  const [input,           setInput]           = useState('');
  const [pendingMessage,  setPendingMessage]  = useState<string | null>(null);
  const [gated,           setGated]           = useState<{ error: string; hint?: string } | null>(null);

  useEffect(() => {
    if (!visible) { setActiveCvid(null); setInput(''); setPendingMessage(null); setGated(null); }
  }, [visible]);

  // ── Queries ──────────────────────────────────────────────
  const listQuery = useQuery({
    queryKey: ['dental-ai-conv-list', cid],
    queryFn: async () => {
      try {
        return await request<{ conversations: Conversation[] }>(`/companies/${cid}/dental/ai/conversations`, { retry: 0 });
      } catch (err: any) {
        if (err?.status === 403) { setGated({ error: err.body?.error || 'Acesso negado', hint: err.body?.upgrade_hint }); return { conversations: [] }; }
        throw err;
      }
    },
    enabled: !!cid && visible,
    staleTime: 10000,
  });

  const chatQuery = useQuery({
    queryKey: ['dental-ai-conv', activeCvid],
    queryFn: () => request<{ conversation: Conversation; messages: Message[] }>(`/companies/${cid}/dental/ai/conversations/${activeCvid}`, { retry: 0 }),
    enabled: !!cid && !!activeCvid,
    staleTime: 0,
  });

  const createMut = useMutation({
    mutationFn: (params: { patient_id?: string | null; title?: string | null }) =>
      request<{ conversation: Conversation }>(`/companies/${cid}/dental/ai/conversations`, { method: 'POST', body: params, retry: 0 }),
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ['dental-ai-conv-list', cid] }); setActiveCvid(data.conversation.id); },
    onError: (err: any) => {
      if (err?.status === 403) { setGated({ error: err.body?.error || 'Acesso negado', hint: err.body?.upgrade_hint }); }
      else { Alert.alert('Erro', err?.body?.error || 'Nao foi possivel criar a conversa.'); }
    },
  });

  const sendMut = useMutation({
    mutationFn: (text: string) =>
      request<{ message: Message }>(`/companies/${cid}/dental/ai/conversations/${activeCvid}/messages`, { method: 'POST', body: { message: text }, retry: 0 }),
    onSuccess: () => { setPendingMessage(null); qc.invalidateQueries({ queryKey: ['dental-ai-conv', activeCvid] }); qc.invalidateQueries({ queryKey: ['dental-ai-conv-list', cid] }); },
    onError: (err: any) => { setPendingMessage(null); Alert.alert('Erro', err?.body?.error || 'A IA nao respondeu. Tente novamente.'); },
  });

  const archiveMut = useMutation({
    mutationFn: (cvid: string) => request(`/companies/${cid}/dental/ai/conversations/${cvid}`, { method: 'DELETE', retry: 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dental-ai-conv-list', cid] }); if (activeCvid) setActiveCvid(null); },
  });

  // Auto-abre conversa do paciente
  useEffect(() => {
    if (visible && cid && initialPatientId && !activeCvid && !createMut.isPending && !gated) {
      const existing = listQuery.data?.conversations.find(c => c.patient_id === initialPatientId);
      if (existing) { setActiveCvid(existing.id); }
      else if (listQuery.data) { createMut.mutate({ patient_id: initialPatientId, title: null }); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, cid, initialPatientId, listQuery.data?.conversations.length]);

  function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || !activeCvid || sendMut.isPending) return;
    setPendingMessage(msg);
    setInput('');
    sendMut.mutate(msg);
  }

  if (!cid) return null;

  // ── Gated ────────────────────────────────────────────────
  if (gated) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={st.modal}>
          <View style={st.headerSimple}>
            <Pressable onPress={onClose} hitSlop={10}><Icon name="x" size={20} color="#94A3B8" /></Pressable>
            <Text style={st.headerTitle}>IA Odonto</Text>
            <View style={{ width: 20 }} />
          </View>
          <View style={st.gatedWrap}>
            <View style={st.gatedIconBox}><Icon name="lock" size={28} color="#a78bfa" /></View>
            <Text style={st.gatedTitle}>Recurso Premium</Text>
            <Text style={st.gatedMsg}>{gated.error}</Text>
            {gated.hint && <Text style={st.gatedHint}>{gated.hint}</Text>}
            <View style={st.gatedFeatures}>
              <Text style={st.gatedFeatureTitle}>Com a IA Odonto voce pode:</Text>
              {['Conversar com IA que conhece cada paciente','Receber alertas de alergias automaticamente','Gerar scripts personalizados de WhatsApp','Analisar funil, recall e cobranca em uma conversa'].map(f => (
                <Text key={f} style={st.gatedFeatureItem}>• {f}</Text>
              ))}
            </View>
            <Pressable onPress={onClose} style={[st.btn, { marginTop: 24 }]}><Text style={st.btnText}>Entendi</Text></Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Chat ativo ───────────────────────────────────────────
  if (activeCvid && chatQuery.data) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <DentalAiChatView
          conversation={chatQuery.data.conversation}
          messages={chatQuery.data.messages || []}
          pendingMessage={pendingMessage}
          input={input}
          isSending={sendMut.isPending}
          onChangeInput={setInput}
          onSend={handleSend}
          onArchive={() => archiveMut.mutate(activeCvid)}
          onBack={() => setActiveCvid(null)}
        />
      </Modal>
    );
  }

  // ── Lista ────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={st.modal}>
        <View style={st.header}>
          <Pressable onPress={onClose} hitSlop={10}><Icon name="x" size={20} color="#94A3B8" /></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={st.headerTitle}>IA Odonto</Text>
            <Text style={st.headerSub}>Conversas salvas com sua clinica</Text>
          </View>
          <Pressable onPress={() => createMut.mutate({ patient_id: null, title: null })} hitSlop={10} style={st.newBtn}>
            {createMut.isPending ? <ActivityIndicator color="#a78bfa" size="small" /> : (
              <><Icon name="plus" size={14} color="#a78bfa" /><Text style={st.newBtnText}>Nova</Text></>
            )}
          </Pressable>
        </View>
        <DentalAiConvList
          conversations={listQuery.data?.conversations || []}
          isLoading={listQuery.isLoading || createMut.isPending}
          onSelect={setActiveCvid}
          onNewConversation={() => createMut.mutate({ patient_id: null, title: null })}
        />
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  modal:         { flex: 1, backgroundColor: '#0F172A' },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingTop: Platform.OS === 'ios' ? 12 : 18, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  headerSimple:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: Platform.OS === 'ios' ? 12 : 18, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  headerTitle:   { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  headerSub:     { color: '#94A3B8', fontSize: 11, marginTop: 1 },
  newBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(167,139,250,0.15)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)' },
  newBtnText:    { color: '#a78bfa', fontSize: 12, fontWeight: '700' },
  btn:           { backgroundColor: '#7c3aed', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center' },
  btnText:       { color: '#fff', fontSize: 13, fontWeight: '700' },
  gatedWrap:     { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  gatedIconBox:  { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(167,139,250,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(167,139,250,0.4)', marginBottom: 16 },
  gatedTitle:    { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  gatedMsg:      { color: '#E2E8F0', fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 320 },
  gatedHint:     { color: '#94A3B8', fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 10, maxWidth: 320, fontStyle: 'italic' },
  gatedFeatures: { marginTop: 24, padding: 14, backgroundColor: '#1E293B', borderRadius: 10, borderWidth: 0.5, borderColor: '#334155', width: '100%', maxWidth: 360 },
  gatedFeatureTitle:{ color: '#a78bfa', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  gatedFeatureItem: { color: '#CBD5E1', fontSize: 12, lineHeight: 20 },
});

export default DentalAiChat;
