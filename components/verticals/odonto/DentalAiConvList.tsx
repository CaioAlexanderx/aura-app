// AURA. — DentalAiConvList
// Lista de conversas da IA Odonto + empty state.
// Extraido de DentalAiChat.tsx (decomposicao).

import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Icon } from '@/components/Icon';

interface Conversation {
  id: string;
  patient_id: string | null;
  patient_name?: string;
  title: string | null;
  message_count: number;
  updated_at: string;
}

interface Props {
  conversations:     Conversation[];
  isLoading:         boolean;
  onSelect:          (id: string) => void;
  onNewConversation: () => void;
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} dia${diffDay > 1 ? 's' : ''}`;
  return date.toLocaleDateString('pt-BR');
}

export function DentalAiConvList({ conversations, isLoading, onSelect, onNewConversation }: Props) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={st.listContent}>
      {isLoading && (
        <View style={st.center}><ActivityIndicator color="#a78bfa" size="large" /></View>
      )}

      {!isLoading && conversations.length === 0 && (
        <View style={st.empty}>
          <View style={st.iconBox}>
            <Icon name="sparkles" size={28} color="#a78bfa" />
          </View>
          <Text style={st.emptyTitle}>Comece sua primeira conversa</Text>
          <Text style={st.emptySub}>
            A IA Odonto ja conhece sua clinica. Faca uma pergunta sobre agenda, cobranca ou peca um script de WhatsApp.
          </Text>
          <Pressable onPress={onNewConversation} style={[st.btn, st.btnPrimary, { marginTop: 20 }]}>
            <Icon name="plus" size={14} color="#fff" />
            <Text style={st.btnPrimaryText}>Nova conversa</Text>
          </Pressable>
        </View>
      )}

      {!isLoading && conversations.map(c => (
        <Pressable key={c.id} onPress={() => onSelect(c.id)} style={st.card}>
          <View style={{ flex: 1 }}>
            <Text style={st.cardTitle} numberOfLines={1}>{c.title || 'Conversa sem titulo'}</Text>
            {c.patient_name && (
              <View style={st.patientPill}>
                <Icon name="user" size={10} color="#06B6D4" />
                <Text style={st.patientText}>{c.patient_name}</Text>
              </View>
            )}
            <Text style={st.cardMeta}>
              {c.message_count} mensagem{c.message_count !== 1 ? 's' : ''} • {formatRelative(c.updated_at)}
            </Text>
          </View>
          <Icon name="chevron_right" size={16} color="#475569" />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  listContent:  { padding: 14, gap: 8 },
  center:       { padding: 32, alignItems: 'center' },
  empty:        { padding: 32, alignItems: 'center', gap: 8 },
  iconBox:      { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(167,139,250,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', marginBottom: 4 },
  emptyTitle:   { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySub:     { color: '#94A3B8', fontSize: 12, textAlign: 'center', lineHeight: 18, maxWidth: 320 },
  card:         { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#1E293B', borderRadius: 10, borderWidth: 0.5, borderColor: '#334155' },
  cardTitle:    { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },
  patientPill:  { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(6,182,212,0.12)' },
  patientText:  { color: '#06B6D4', fontSize: 10, fontWeight: '600' },
  cardMeta:     { color: '#64748B', fontSize: 11, marginTop: 4 },
  btn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
  btnPrimary:   { backgroundColor: '#7c3aed' },
  btnPrimaryText:{ color: '#fff', fontSize: 13, fontWeight: '700' },
});
