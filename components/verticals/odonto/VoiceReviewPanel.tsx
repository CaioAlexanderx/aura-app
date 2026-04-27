// AURA. — VoiceReviewPanel
// Painel de revisao da evolucao clínica estruturada pela IA.
// Extraido de VoiceEvolution.tsx (decomposicao).

import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

interface Props {
  rawText:    string;
  structured: string;
  isSaving:   boolean;
  onChangeStructured: (v: string) => void;
  onSave:     () => void;
  onReset:    () => void;
}

export function VoiceReviewPanel({ rawText, structured, isSaving, onChangeStructured, onSave, onReset }: Props) {
  return (
    <View style={st.wrap}>
      {/* Ditado original */}
      {!!rawText && (
        <View style={st.rawBlock}>
          <Text style={st.rawLabel}>📝 Ditado original</Text>
          <Text style={st.rawText}>{rawText.trim()}</Text>
        </View>
      )}

      {/* Evolução estruturada */}
      <View style={st.structBlock}>
        <View style={st.structHeader}>
          <Text style={st.structLabel}>✨ Evolução estruturada</Text>
          <Text style={st.structHint}>Editável antes de salvar</Text>
        </View>
        <TextInput
          style={st.structArea}
          value={structured}
          onChangeText={onChangeStructured}
          multiline
          textAlignVertical="top"
          placeholder="Evolução clínica estruturada..."
          placeholderTextColor="#475569"
        />
      </View>

      {/* Ações */}
      <View style={st.rowBtns}>
        <TouchableOpacity
          onPress={onSave}
          disabled={isSaving || !structured.trim()}
          style={[st.primaryBtn, { flex: 1 }, (isSaving || !structured.trim()) && { opacity: 0.5 }]}
        >
          {isSaving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={st.primaryBtnText}>💾 Salvar no Prontuário</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity onPress={onReset} style={st.secondaryBtn}>
          <Text style={st.secondaryBtnText}>↩ Refazer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap:         { gap: 14 },
  rawBlock:     { backgroundColor: '#1E293B', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#334155' },
  rawLabel:     { color: '#64748B', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  rawText:      { color: '#94A3B8', fontSize: 12, lineHeight: 18 },
  structBlock:  { backgroundColor: '#1E293B', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#8B5CF6' },
  structHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  structLabel:  { color: '#A78BFA', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  structHint:   { color: '#475569', fontSize: 10 },
  structArea:   { color: '#FFFFFF', fontSize: 13, lineHeight: 22, minHeight: 180 },
  rowBtns:      { flexDirection: 'row', gap: 8 },
  primaryBtn:   { backgroundColor: '#8B5CF6', borderRadius: 10, paddingVertical: 13, paddingHorizontal: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  primaryBtnText:{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  secondaryBtn: { backgroundColor: '#1E293B', borderRadius: 10, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  secondaryBtnText:{ color: '#94A3B8', fontSize: 13, fontWeight: '600' },
});
