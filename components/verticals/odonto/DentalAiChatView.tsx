// AURA. — DentalAiChatView
// Vista de chat ativo: bubbles, quick actions, input bar.
// Extraido de DentalAiChat.tsx (decomposicao).

import { useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable,
  StyleSheet, ActivityIndicator, Platform, Alert, KeyboardAvoidingView,
} from 'react-native';
import { Icon } from '@/components/Icon';

interface Conversation {
  id: string;
  patient_name?: string;
  title: string | null;
}

interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface Props {
  conversation:   Conversation;
  messages:       Message[];
  pendingMessage: string | null;
  input:          string;
  isSending:      boolean;
  onChangeInput:  (v: string) => void;
  onSend:         (text?: string) => void;
  onArchive:      () => void;
  onBack:         () => void;
}

const QUICK_ACTIONS = [
  { id: 'confirm',  label: 'Confirmar agenda de hoje', prompt: 'Como devo abordar a confirmacao das consultas de hoje? Quais sao os horarios e o status de cada uma?' },
  { id: 'cobranca', label: 'Cobrar parcelas vencidas',  prompt: 'Tenho parcelas vencidas. Me ajude a montar uma regua de cobranca respeitosa, com tres mensagens em escalada.' },
  { id: 'recall',   label: 'Recall de pacientes inativos', prompt: 'Quero fazer uma campanha de recall pra pacientes que nao voltam ha mais de 5 meses. Sugira mensagens e estrategia.' },
  { id: 'whats',    label: 'Sugerir mensagem WhatsApp',  prompt: 'Me ajude a escrever uma mensagem profissional pra mandar pelo WhatsApp.' },
];

export function DentalAiChatView({ conversation, messages, pendingMessage, input, isSending, onChangeInput, onSend, onArchive, onBack }: Props) {
  const scrollRef = useRef<ScrollView | null>(null);
  const isEmpty = messages.length === 0 && !pendingMessage;

  return (
    <KeyboardAvoidingView style={st.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={st.header}>
        <Pressable onPress={onBack} hitSlop={10} style={st.backBtn}>
          <Icon name="arrow_left" size={18} color="#a78bfa" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle} numberOfLines={1}>
            {conversation.title || (conversation.patient_name ? `IA - ${conversation.patient_name}` : 'Nova conversa')}
          </Text>
          {conversation.patient_name && <Text style={st.headerSub}>Contexto: {conversation.patient_name}</Text>}
        </View>
        <Pressable onPress={() => Alert.alert('Arquivar conversa?','A conversa sera ocultada da lista mas o historico sera mantido.',[{text:'Cancelar',style:'cancel'},{text:'Arquivar',style:'destructive',onPress:onArchive}])} hitSlop={10}>
          <Icon name="archive" size={18} color="#94A3B8" />
        </Pressable>
      </View>

      {/* Mensagens */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={st.chatContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {isEmpty && (
          <View style={st.empty}>
            <View style={st.iconBox}><Icon name="sparkles" size={28} color="#a78bfa" /></View>
            <Text style={st.emptyTitle}>
              {conversation.patient_name
                ? `Eu ja sei tudo sobre ${conversation.patient_name.split(' ')[0]}`
                : 'Como posso ajudar hoje?'}
            </Text>
            <Text style={st.emptySub}>
              {conversation.patient_name
                ? 'Anamnese, odontograma, planos e parcelas ja estao no contexto.'
                : 'Pergunte sobre agenda, cobranca, recall ou peca scripts de WhatsApp.'}
            </Text>
            <View style={st.quickActions}>
              {QUICK_ACTIONS.map(qa => (
                <Pressable key={qa.id} onPress={() => onSend(qa.prompt)} style={st.quickChip}>
                  <Text style={st.quickChipText}>{qa.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {messages.map((m, i) => (
          <View key={m.id || i} style={[st.bubbleRow, m.role === 'user' && st.bubbleRowUser]}>
            <View style={[st.bubble, m.role === 'user' ? st.bubbleUser : st.bubbleAssistant]}>
              <Text style={[st.bubbleText, m.role === 'user' && st.bubbleTextUser]}>{m.content}</Text>
            </View>
          </View>
        ))}

        {pendingMessage && (
          <>
            <View style={[st.bubbleRow, st.bubbleRowUser]}>
              <View style={[st.bubble, st.bubbleUser, { opacity: 0.7 }]}>
                <Text style={[st.bubbleText, st.bubbleTextUser]}>{pendingMessage}</Text>
              </View>
            </View>
            <View style={st.bubbleRow}>
              <View style={[st.bubble, st.bubbleAssistant]}>
                <View style={st.typingDots}>
                  <View style={st.dot} /><View style={st.dot} /><View style={st.dot} />
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Input */}
      <View style={st.inputBar}>
        <TextInput
          value={input}
          onChangeText={onChangeInput}
          placeholder="Pergunte algo..."
          placeholderTextColor="#64748B"
          style={st.inputField}
          multiline
          maxLength={4000}
          editable={!isSending}
        />
        <Pressable
          onPress={() => onSend()}
          disabled={!input.trim() || isSending}
          style={[st.sendBtn, (!input.trim() || isSending) && { opacity: 0.4 }]}
        >
          {isSending
            ? <ActivityIndicator color="#fff" size="small" />
            : <Icon name="arrow_right" size={18} color="#fff" />
          }
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#0F172A' },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingTop: Platform.OS === 'ios' ? 12 : 18, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  backBtn:      { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(167,139,250,0.12)' },
  headerTitle:  { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  headerSub:    { color: '#94A3B8', fontSize: 11, marginTop: 1 },
  chatContent:  { padding: 14, gap: 8, paddingBottom: 20 },
  empty:        { padding: 24, alignItems: 'center', gap: 10 },
  iconBox:      { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(167,139,250,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', marginBottom: 4 },
  emptyTitle:   { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySub:     { color: '#94A3B8', fontSize: 12, textAlign: 'center', lineHeight: 18, maxWidth: 320 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 16 },
  quickChip:    { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: '#1E293B', borderWidth: 0.5, borderColor: '#334155' },
  quickChipText:{ color: '#CBD5E1', fontSize: 11, fontWeight: '500' },
  bubbleRow:    { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleRowUser:{ justifyContent: 'flex-end' },
  bubble:       { maxWidth: '85%', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14 },
  bubbleAssistant:{ backgroundColor: '#1E293B', borderWidth: 0.5, borderColor: '#334155', borderTopLeftRadius: 4 },
  bubbleUser:   { backgroundColor: '#7c3aed', borderTopRightRadius: 4 },
  bubbleText:   { color: '#E2E8F0', fontSize: 13, lineHeight: 19 },
  bubbleTextUser:{ color: '#FFFFFF' },
  typingDots:   { flexDirection: 'row', gap: 4, paddingVertical: 4 },
  dot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: '#a78bfa', opacity: 0.7 },
  inputBar:     { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, paddingBottom: Platform.OS === 'ios' ? 22 : 14, backgroundColor: '#1E293B', borderTopWidth: 1, borderTopColor: '#334155' },
  inputField:   { flex: 1, color: '#E2E8F0', fontSize: 13, backgroundColor: '#0F172A', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 0.5, borderColor: '#334155', maxHeight: 120 } as any,
  sendBtn:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7c3aed' },
});
