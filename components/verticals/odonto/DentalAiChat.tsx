// ============================================================
// AURA. — W2-05: IA Odonto (chat persistente, Expansao only)
//
// Componente full-screen com 2 modos:
//   list  -> lista de conversas + botao "Nova conversa"
//   chat  -> conversa aberta com bubbles + input
//
// Estado de erro:
//   gated -> 403 do BE (plano nao Expansao OU vertical nao odonto)
//            Mostra upgrade card com hint do BE.
//
// Endpoints (BE W2-05):
//   GET    /companies/:cid/dental/ai/conversations
//   POST   /companies/:cid/dental/ai/conversations
//   GET    /companies/:cid/dental/ai/conversations/:cvid
//   POST   /companies/:cid/dental/ai/conversations/:cvid/messages
//   PATCH  /companies/:cid/dental/ai/conversations/:cvid
//   DELETE /companies/:cid/dental/ai/conversations/:cvid
//
// Quick actions iniciais (chips no chat vazio):
//   1. "Confirmar agenda de hoje"
//   2. "Cobrar parcelas vencidas"
//   3. "Recall de pacientes inativos"
//   4. "Sugerir mensagem WhatsApp"
//
// Quando criada vinculada a paciente, IA recebe contexto clinico
// completo (anamnese, odontograma, planos, parcelas) automaticamente.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable, Modal,
  StyleSheet, ActivityIndicator, Platform, Alert, KeyboardAvoidingView,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { Icon } from '@/components/Icon';

// ── Types ─────────────────────────────────────────────────

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
  pending?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Paciente pre-selecionado quando abre — cria conversa vinculada */
  initialPatientId?: string;
  initialPatientName?: string;
}

const QUICK_ACTIONS = [
  { id: 'confirm', label: 'Confirmar agenda de hoje',
    prompt: 'Como devo abordar a confirmacao das consultas de hoje? Quais sao os horarios e o status de cada uma?' },
  { id: 'cobranca', label: 'Cobrar parcelas vencidas',
    prompt: 'Tenho parcelas vencidas. Me ajude a montar uma regua de cobranca respeitosa, com tres mensagens em escalada.' },
  { id: 'recall', label: 'Recall de pacientes inativos',
    prompt: 'Quero fazer uma campanha de recall pra pacientes que nao voltam ha mais de 5 meses. Sugira mensagens e estrategia.' },
  { id: 'whats', label: 'Sugerir mensagem WhatsApp',
    prompt: 'Me ajude a escrever uma mensagem profissional pra mandar pelo WhatsApp.' },
];

// ──────────────────────────────────────────────────────────

export function DentalAiChat({
  visible, onClose, initialPatientId, initialPatientName,
}: Props) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();

  const [activeCvid, setActiveCvid] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [gated, setGated] = useState<{ error: string; hint?: string } | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  // ── Reset ao fechar ──
  useEffect(() => {
    if (!visible) {
      setActiveCvid(null);
      setInput('');
      setPendingMessage(null);
      setGated(null);
    }
  }, [visible]);

  // ── Lista de conversas ──
  const listQuery = useQuery({
    queryKey: ['dental-ai-conv-list', cid],
    queryFn: async () => {
      try {
        return await request<{ conversations: Conversation[] }>(
          `/companies/${cid}/dental/ai/conversations`,
          { retry: 0 }
        );
      } catch (err: any) {
        if (err?.status === 403) {
          setGated({
            error: err.body?.error || 'Acesso negado',
            hint:  err.body?.upgrade_hint,
          });
          return { conversations: [] };
        }
        throw err;
      }
    },
    enabled: !!cid && visible,
    staleTime: 10000,
  });

  // ── Conversa ativa (mensagens) ──
  const chatQuery = useQuery({
    queryKey: ['dental-ai-conv', activeCvid],
    queryFn: () =>
      request<{ conversation: Conversation; messages: Message[] }>(
        `/companies/${cid}/dental/ai/conversations/${activeCvid}`,
        { retry: 0 }
      ),
    enabled: !!cid && !!activeCvid,
    staleTime: 0,
  });

  // ── Cria conversa ──
  const createMut = useMutation({
    mutationFn: (params: { patient_id?: string | null; title?: string | null }) =>
      request<{ conversation: Conversation }>(
        `/companies/${cid}/dental/ai/conversations`,
        { method: 'POST', body: params, retry: 0 }
      ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['dental-ai-conv-list', cid] });
      setActiveCvid(data.conversation.id);
    },
    onError: (err: any) => {
      if (err?.status === 403) {
        setGated({ error: err.body?.error || 'Acesso negado', hint: err.body?.upgrade_hint });
      } else {
        Alert.alert('Erro', err?.body?.error || err?.message || 'Nao foi possivel criar a conversa.');
      }
    },
  });

  // ── Envia mensagem ──
  const sendMut = useMutation({
    mutationFn: (text: string) =>
      request<{ message: Message }>(
        `/companies/${cid}/dental/ai/conversations/${activeCvid}/messages`,
        { method: 'POST', body: { message: text }, retry: 0 }
      ),
    onSuccess: () => {
      setPendingMessage(null);
      qc.invalidateQueries({ queryKey: ['dental-ai-conv', activeCvid] });
      qc.invalidateQueries({ queryKey: ['dental-ai-conv-list', cid] });
      // Scroll pro final
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    },
    onError: (err: any) => {
      setPendingMessage(null);
      Alert.alert('Erro', err?.body?.error || 'A IA nao respondeu. Tente novamente.');
    },
  });

  // ── Archive ──
  const archiveMut = useMutation({
    mutationFn: (cvid: string) =>
      request(`/companies/${cid}/dental/ai/conversations/${cvid}`, {
        method: 'DELETE', retry: 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dental-ai-conv-list', cid] });
      if (activeCvid) setActiveCvid(null);
    },
  });

  // ── Auto-cria conversa se initialPatientId fornecido ──
  useEffect(() => {
    if (visible && cid && initialPatientId && !activeCvid && !createMut.isPending && !gated) {
      // Se ja existe conversa pra esse paciente, abre. Senao cria.
      const existing = listQuery.data?.conversations.find(c => c.patient_id === initialPatientId);
      if (existing) {
        setActiveCvid(existing.id);
      } else if (listQuery.data) {
        createMut.mutate({ patient_id: initialPatientId, title: null });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, cid, initialPatientId, listQuery.data?.conversations.length]);

  // ── Helpers ──
  function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || !activeCvid || sendMut.isPending) return;
    setPendingMessage(msg);
    setInput('');
    sendMut.mutate(msg);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }

  function handleNewConversation() {
    createMut.mutate({ patient_id: null, title: null });
  }

  function formatRelative(iso: string): string {
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin} min`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} h`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay} dia${diffDay > 1 ? 's' : ''}`;
    return date.toLocaleDateString('pt-BR');
  }

  // ──────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────

  if (!cid) return null;

  // Estado: gated (403)
  if (gated) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={s.modal}>
          <View style={s.headerSimple}>
            <Pressable onPress={onClose} hitSlop={10}>
              <Icon name="x" size={20} color="#94A3B8" />
            </Pressable>
            <Text style={s.headerTitle}>IA Odonto</Text>
            <View style={{ width: 20 }} />
          </View>
          <View style={s.gatedWrap}>
            <View style={s.gatedIconBox}>
              <Icon name="lock" size={28} color="#a78bfa" />
            </View>
            <Text style={s.gatedTitle}>Recurso Premium</Text>
            <Text style={s.gatedMsg}>{gated.error}</Text>
            {gated.hint && <Text style={s.gatedHint}>{gated.hint}</Text>}
            <View style={s.gatedFeatures}>
              <Text style={s.gatedFeatureTitle}>Com a IA Odonto voce pode:</Text>
              <Text style={s.gatedFeatureItem}>• Conversar com IA que conhece cada paciente</Text>
              <Text style={s.gatedFeatureItem}>• Receber alertas de alergias automaticamente</Text>
              <Text style={s.gatedFeatureItem}>• Gerar scripts personalizados de WhatsApp</Text>
              <Text style={s.gatedFeatureItem}>• Analisar funil, recall e cobranca em uma conversa</Text>
            </View>
            <Pressable onPress={onClose} style={[s.btn, s.btnPrimary, { marginTop: 24 }]}>
              <Text style={s.btnPrimaryText}>Entendi</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Modo chat ──
  if (activeCvid && chatQuery.data) {
    const conv = chatQuery.data.conversation;
    const messages = chatQuery.data.messages || [];
    const isEmpty = messages.length === 0 && !pendingMessage;

    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <KeyboardAvoidingView
          style={s.modal}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={s.header}>
            <Pressable onPress={() => setActiveCvid(null)} hitSlop={10} style={s.headerBack}>
              <Icon name="arrow_left" size={18} color="#a78bfa" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle} numberOfLines={1}>
                {conv.title || (conv.patient_name ? `IA - ${conv.patient_name}` : 'Nova conversa')}
              </Text>
              {conv.patient_name && (
                <Text style={s.headerSub} numberOfLines={1}>
                  Contexto: {conv.patient_name}
                </Text>
              )}
            </View>
            <Pressable
              onPress={() => Alert.alert(
                'Arquivar conversa?',
                'A conversa sera ocultada da lista mas o historico sera mantido.',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Arquivar', style: 'destructive',
                    onPress: () => archiveMut.mutate(activeCvid) },
                ]
              )}
              hitSlop={10}
            >
              <Icon name="archive" size={18} color="#94A3B8" />
            </Pressable>
          </View>

          {/* Mensagens */}
          <ScrollView
            ref={scrollRef}
            style={s.chat}
            contentContainerStyle={s.chatContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {isEmpty && (
              <View style={s.emptyChat}>
                <View style={s.emptyIconBox}>
                  <Icon name="sparkles" size={28} color="#a78bfa" />
                </View>
                <Text style={s.emptyTitle}>
                  {conv.patient_name
                    ? `Eu ja sei tudo sobre ${conv.patient_name.split(' ')[0]}`
                    : 'Como posso ajudar hoje?'}
                </Text>
                <Text style={s.emptySub}>
                  {conv.patient_name
                    ? 'Anamnese, odontograma, planos e parcelas ja estao no contexto. Pergunte o que quiser.'
                    : 'Pergunte sobre agenda, cobranca, recall ou peca scripts de WhatsApp.'}
                </Text>
                <View style={s.quickActions}>
                  {QUICK_ACTIONS.map(qa => (
                    <Pressable
                      key={qa.id}
                      onPress={() => handleSend(qa.prompt)}
                      style={s.quickChip}
                    >
                      <Text style={s.quickChipText}>{qa.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {messages.map((m, i) => (
              <View
                key={m.id || i}
                style={[s.bubbleRow, m.role === 'user' && s.bubbleRowUser]}
              >
                <View
                  style={[
                    s.bubble,
                    m.role === 'user' ? s.bubbleUser : s.bubbleAssistant,
                  ]}
                >
                  <Text style={[
                    s.bubbleText,
                    m.role === 'user' && s.bubbleTextUser,
                  ]}>
                    {m.content}
                  </Text>
                </View>
              </View>
            ))}

            {pendingMessage && (
              <>
                <View style={[s.bubbleRow, s.bubbleRowUser]}>
                  <View style={[s.bubble, s.bubbleUser, { opacity: 0.7 }]}>
                    <Text style={[s.bubbleText, s.bubbleTextUser]}>{pendingMessage}</Text>
                  </View>
                </View>
                <View style={s.bubbleRow}>
                  <View style={[s.bubble, s.bubbleAssistant]}>
                    <View style={s.typingDots}>
                      <View style={[s.dot, { animationDelay: '0s' as any }]} />
                      <View style={[s.dot, { animationDelay: '0.2s' as any }]} />
                      <View style={[s.dot, { animationDelay: '0.4s' as any }]} />
                    </View>
                  </View>
                </View>
              </>
            )}
          </ScrollView>

          {/* Input */}
          <View style={s.inputBar}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Pergunte algo..."
              placeholderTextColor="#64748B"
              style={s.inputField}
              multiline
              maxLength={4000}
              editable={!sendMut.isPending}
            />
            <Pressable
              onPress={() => handleSend()}
              disabled={!input.trim() || sendMut.isPending}
              style={[
                s.sendBtn,
                (!input.trim() || sendMut.isPending) && { opacity: 0.4 },
              ]}
            >
              {sendMut.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Icon name="arrow_right" size={18} color="#fff" />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  // ── Modo lista ──
  const conversations = listQuery.data?.conversations || [];
  const isLoading = listQuery.isLoading || createMut.isPending;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.modal}>
        <View style={s.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Icon name="x" size={20} color="#94A3B8" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>IA Odonto</Text>
            <Text style={s.headerSub}>Conversas salvas com sua clinica</Text>
          </View>
          <Pressable onPress={handleNewConversation} hitSlop={10} style={s.headerNewBtn}>
            <Icon name="plus" size={14} color="#a78bfa" />
            <Text style={s.headerNewBtnText}>Nova</Text>
          </Pressable>
        </View>

        <ScrollView style={s.list} contentContainerStyle={s.listContent}>
          {isLoading && (
            <View style={s.center}>
              <ActivityIndicator color="#a78bfa" size="large" />
            </View>
          )}

          {!isLoading && conversations.length === 0 && (
            <View style={s.emptyList}>
              <View style={s.emptyIconBox}>
                <Icon name="sparkles" size={28} color="#a78bfa" />
              </View>
              <Text style={s.emptyTitle}>Comece sua primeira conversa</Text>
              <Text style={s.emptySub}>
                A IA Odonto ja conhece sua clinica. Faca uma pergunta sobre
                agenda, cobranca ou peca um script de WhatsApp.
              </Text>
              <Pressable
                onPress={handleNewConversation}
                style={[s.btn, s.btnPrimary, { marginTop: 20 }]}
              >
                <Icon name="plus" size={14} color="#fff" />
                <Text style={s.btnPrimaryText}>Nova conversa</Text>
              </Pressable>
            </View>
          )}

          {!isLoading && conversations.map(c => (
            <Pressable
              key={c.id}
              onPress={() => setActiveCvid(c.id)}
              style={s.convCard}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.convTitle} numberOfLines={1}>
                  {c.title || 'Conversa sem titulo'}
                </Text>
                {c.patient_name ? (
                  <View style={s.convPatientPill}>
                    <Icon name="user" size={10} color="#06B6D4" />
                    <Text style={s.convPatientText}>{c.patient_name}</Text>
                  </View>
                ) : null}
                <Text style={s.convMeta}>
                  {c.message_count} mensagem{c.message_count !== 1 ? 's' : ''} • {formatRelative(c.updated_at)}
                </Text>
              </View>
              <Icon name="chevron_right" size={16} color="#475569" />
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────

const s = StyleSheet.create({
  modal: { flex: 1, backgroundColor: '#0F172A' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingTop: Platform.OS === 'ios' ? 12 : 18,
    paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  headerSimple: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: Platform.OS === 'ios' ? 12 : 18,
    paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  headerBack: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(167,139,250,0.12)',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  headerSub: { color: '#94A3B8', fontSize: 11, marginTop: 1 },
  headerNewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)',
  },
  headerNewBtnText: { color: '#a78bfa', fontSize: 12, fontWeight: '700' },

  // Lista
  list: { flex: 1 },
  listContent: { padding: 14, gap: 8 },
  convCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, backgroundColor: '#1E293B', borderRadius: 10,
    borderWidth: 0.5, borderColor: '#334155',
  },
  convTitle: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },
  convPatientPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', marginTop: 4,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: 'rgba(6,182,212,0.12)',
  },
  convPatientText: { color: '#06B6D4', fontSize: 10, fontWeight: '600' },
  convMeta: { color: '#64748B', fontSize: 11, marginTop: 4 },

  // Estados vazios
  center: { padding: 32, alignItems: 'center' },
  emptyList: { padding: 32, alignItems: 'center', gap: 8 },
  emptyChat: { padding: 24, alignItems: 'center', gap: 10 },
  emptyIconBox: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(167,139,250,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)',
    marginBottom: 4,
  },
  emptyTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySub: { color: '#94A3B8', fontSize: 12, textAlign: 'center', lineHeight: 18, maxWidth: 320 },
  quickActions: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    justifyContent: 'center', marginTop: 16,
  },
  quickChip: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14,
    backgroundColor: '#1E293B', borderWidth: 0.5, borderColor: '#334155',
  },
  quickChipText: { color: '#CBD5E1', fontSize: 11, fontWeight: '500' },

  // Chat
  chat: { flex: 1 },
  chatContent: { padding: 14, gap: 8, paddingBottom: 20 },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '85%', paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 14,
  },
  bubbleAssistant: {
    backgroundColor: '#1E293B', borderWidth: 0.5, borderColor: '#334155',
    borderTopLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: '#7c3aed',
    borderTopRightRadius: 4,
  },
  bubbleText: { color: '#E2E8F0', fontSize: 13, lineHeight: 19 },
  bubbleTextUser: { color: '#FFFFFF' },
  typingDots: {
    flexDirection: 'row', gap: 4, paddingVertical: 4,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#a78bfa',
    opacity: 0.7,
  },

  // Input
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 10, paddingBottom: Platform.OS === 'ios' ? 22 : 14,
    backgroundColor: '#1E293B',
    borderTopWidth: 1, borderTopColor: '#334155',
  },
  inputField: {
    flex: 1, color: '#E2E8F0', fontSize: 13,
    backgroundColor: '#0F172A', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 0.5, borderColor: '#334155',
    maxHeight: 120,
  } as any,
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#7c3aed',
  },

  // Botoes genericos
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10,
  },
  btnPrimary: { backgroundColor: '#7c3aed' },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Gated state
  gatedWrap: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  gatedIconBox: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(167,139,250,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.4)',
    marginBottom: 16,
  },
  gatedTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  gatedMsg: { color: '#E2E8F0', fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 320 },
  gatedHint: {
    color: '#94A3B8', fontSize: 12, textAlign: 'center', lineHeight: 17,
    marginTop: 10, maxWidth: 320, fontStyle: 'italic',
  },
  gatedFeatures: {
    marginTop: 24, padding: 14,
    backgroundColor: '#1E293B', borderRadius: 10,
    borderWidth: 0.5, borderColor: '#334155',
    width: '100%', maxWidth: 360,
  },
  gatedFeatureTitle: {
    color: '#a78bfa', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  gatedFeatureItem: { color: '#CBD5E1', fontSize: 12, lineHeight: 20 },
});

export default DentalAiChat;
