// ============================================================
// AURA. — VoiceEvolution (GAP-02)
// Componente de transcrição de evolução clínica por voz.
//
// Dois modos de operação:
//   1. ÁUDIO (expo-av): grava → envia → Whisper → Claude estrutura
//   2. TEXTO (fallback): digita/dita via teclado → Claude estrutura
//
// Integra na tab Prontuário do PatientHub via botão "🎙️ Voz".
// ============================================================

import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, Animated, Platform,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { request } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import type { PatientLite } from '@/components/verticals/odonto/PatientHub';

// ─── expo-av import condicional (pode nao estar instalado) ────
let Audio: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Audio = require('expo-av').Audio;
} catch {
  // expo-av nao disponivel — usa modo texto
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface Props {
  patient: PatientLite;
  onSaved?: (entryId: string, content: string) => void;
  onClose?: () => void;
}

type Mode = 'idle' | 'recording' | 'processing' | 'review' | 'saving' | 'saved';

// ─────────────────────────────────────────────────────────────
// Animated recording indicator
// ─────────────────────────────────────────────────────────────
function RecordingDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1,   duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View style={[st.recordDot, { opacity }]} />
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export function VoiceEvolution({ patient, onSaved, onClose }: Props) {
  const cid = useAuthStore().company?.id ?? '';
  const [mode, setMode]           = useState<Mode>('idle');
  const [textMode, setTextMode]   = useState(!Audio); // fallback automático
  const [rawText, setRawText]     = useState('');
  const [structured, setStructured] = useState('');
  const [recordingSec, setRecordingSec] = useState(0);
  const [errorMsg, setErrorMsg]   = useState('');

  const recordingRef   = useRef<any>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Mutação texto → estrutura ──────────────────────────────
  const structureMut = useMutation({
    mutationFn: (text: string) =>
      request(`/companies/${cid}/dental/transcribe/text`, {
        method: 'POST',
        body: {
          raw_text:     text,
          patient_name: patient.full_name || patient.name,
          patient_id:   patient.id,
        },
      }),
    onSuccess: (data: any) => {
      setStructured(data.structured || '');
      setMode('review');
    },
    onError: (err: any) => {
      setErrorMsg(err?.message || 'Erro ao estruturar o texto.');
      setMode('idle');
    },
  });

  // ── Mutação áudio → estrutura ──────────────────────────────
  const audioMut = useMutation({
    mutationFn: (base64: string) =>
      request(`/companies/${cid}/dental/transcribe/audio`, {
        method: 'POST',
        body: {
          audio_base64: base64,
          mime_type:    'audio/m4a',
          patient_name: patient.full_name || patient.name,
          patient_id:   patient.id,
        },
      }),
    onSuccess: (data: any) => {
      setRawText(data.raw_transcription || '');
      setStructured(data.structured || '');
      setMode('review');
    },
    onError: (err: any) => {
      // Fallback: se Whisper nao configurado, sugere modo texto
      if (err?.message?.includes('OPENAI_API_KEY')) {
        Alert.alert(
          'Transcrição de áudio indisponível',
          'A chave da API de transcrição não está configurada. Use o modo de texto para ditar pelo teclado.',
          [{ text: 'Usar modo texto', onPress: () => { setTextMode(true); setMode('idle'); } }]
        );
      } else {
        setErrorMsg(err?.message || 'Erro ao transcrever o áudio.');
        setMode('idle');
      }
    },
  });

  // ── Mutação salvar no prontuário ───────────────────────────
  const saveMut = useMutation({
    mutationFn: () =>
      request(`/companies/${cid}/dental/transcribe/text`, {
        method: 'POST',
        body: {
          raw_text:     structured,
          patient_name: patient.full_name || patient.name,
          patient_id:   patient.id,
          save:         true,
        },
      }),
    onSuccess: (data: any) => {
      setMode('saved');
      onSaved?.(data.entry_id, structured);
    },
    onError: (err: any) => {
      setErrorMsg(err?.message || 'Erro ao salvar no prontuário.');
    },
  });

  // ── Gravação de áudio ──────────────────────────────────────
  async function startRecording() {
    if (!Audio) { setTextMode(true); return; }
    setErrorMsg('');
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setMode('recording');
      setRecordingSec(0);
      timerRef.current = setInterval(() => setRecordingSec(s => s + 1), 1000);
    } catch (err: any) {
      setErrorMsg('Não foi possível acessar o microfone: ' + err.message);
    }
  }

  async function stopRecording() {
    if (!recordingRef.current) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setMode('processing');

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error('URI do áudio não encontrada');

      // Lê o arquivo e converte para base64
      const { FileSystem } = await import('expo-file-system');
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      audioMut.mutate(base64);
    } catch (err: any) {
      setErrorMsg('Erro ao processar áudio: ' + err.message);
      setMode('idle');
    }
  }

  function handleStructureText() {
    if (!rawText.trim() || rawText.trim().length < 5) {
      setErrorMsg('Digite ao menos algumas palavras antes de estruturar.');
      return;
    }
    setErrorMsg('');
    setMode('processing');
    structureMut.mutate(rawText);
  }

  function reset() {
    setMode('idle');
    setRawText('');
    setStructured('');
    setErrorMsg('');
    setRecordingSec(0);
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <View style={st.container}>
      {/* Header */}
      <View style={st.header}>
        <View>
          <Text style={st.title}>🎙️ Evolução por Voz</Text>
          <Text style={st.subtitle}>{patient.full_name || patient.name}</Text>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={st.closeBtn}>
            <Text style={st.closeBtnText}>Fechar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Modo toggle */}
      {mode === 'idle' && Audio && (
        <View style={st.modeRow}>
          <TouchableOpacity
            onPress={() => setTextMode(false)}
            style={[st.modeChip, !textMode && st.modeChipActive]}
          >
            <Text style={[st.modeChipText, !textMode && st.modeChipTextActive]}>🎙️ Microfone</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTextMode(true)}
            style={[st.modeChip, textMode && st.modeChipActive]}
          >
            <Text style={[st.modeChipText, textMode && st.modeChipTextActive]}>⌨️ Teclado</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={st.body} keyboardShouldPersistTaps="handled">

        {/* IDLE — modo microfone */}
        {mode === 'idle' && !textMode && (
          <View style={st.centered}>
            <TouchableOpacity onPress={startRecording} style={st.micButton} activeOpacity={0.8}>
              <Text style={st.micIcon}>🎙️</Text>
            </TouchableOpacity>
            <Text style={st.micHint}>Toque para iniciar a gravação</Text>
            <Text style={st.micHint2}>Descreva o atendimento em voz alta</Text>
          </View>
        )}

        {/* IDLE — modo texto */}
        {mode === 'idle' && textMode && (
          <View style={st.textModeWrap}>
            <Text style={st.textModeLabel}>
              {Audio
                ? 'Use o microfone do teclado (🎤) ou digite a evolução:'
                : 'Digite ou dite a evolução pelo microfone do teclado (🎤):'}
            </Text>
            <TextInput
              style={st.textArea}
              placeholder="Ex: Paciente compareceu para retorno. Foi realizada aplicação de resina composta no dente 36 face oclusal. Paciente sem queixas. Retorno em 30 dias para avaliação..."
              placeholderTextColor="#475569"
              multiline
              textAlignVertical="top"
              value={rawText}
              onChangeText={setRawText}
              autoFocus
            />
            <TouchableOpacity
              onPress={handleStructureText}
              disabled={rawText.trim().length < 5}
              style={[st.primaryBtn, rawText.trim().length < 5 && { opacity: 0.4 }]}
            >
              <Text style={st.primaryBtnText}>✨ Estruturar com IA</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* RECORDING */}
        {mode === 'recording' && (
          <View style={st.centered}>
            <RecordingDot />
            <Text style={st.recordingLabel}>Gravando...</Text>
            <Text style={st.recordingTime}>
              {String(Math.floor(recordingSec / 60)).padStart(2, '0')}:
              {String(recordingSec % 60).padStart(2, '0')}
            </Text>
            <Text style={st.recordingHint}>Descreva o atendimento em voz alta</Text>
            <TouchableOpacity onPress={stopRecording} style={st.stopBtn}>
              <Text style={st.stopBtnText}>⏹ Parar e transcrever</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* PROCESSING */}
        {mode === 'processing' && (
          <View style={st.centered}>
            <ActivityIndicator color="#8B5CF6" size="large" />
            <Text style={st.processingLabel}>
              {audioMut.isPending ? 'Transcrevendo áudio...' : 'Estruturando com IA...'}
            </Text>
            <Text style={st.processingHint}>Isso leva alguns segundos</Text>
          </View>
        )}

        {/* REVIEW */}
        {mode === 'review' && (
          <View style={st.reviewWrap}>
            {rawText ? (
              <View style={st.rawBlock}>
                <Text style={st.rawLabel}>📝 Transcrição original</Text>
                <Text style={st.rawText}>{rawText}</Text>
              </View>
            ) : null}

            <View style={st.structuredBlock}>
              <View style={st.structuredHeader}>
                <Text style={st.structuredLabel}>✨ Evolução estruturada pela IA</Text>
                <TouchableOpacity onPress={() => {/* edição livre */}}>
                  <Text style={st.editHint}>Editável</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={st.structuredArea}
                value={structured}
                onChangeText={setStructured}
                multiline
                textAlignVertical="top"
                placeholder="Evolução estruturada aparecerá aqui..."
                placeholderTextColor="#475569"
              />
            </View>

            <View style={st.reviewBtns}>
              <TouchableOpacity
                onPress={() => saveMut.mutate()}
                disabled={saveMut.isPending || !structured.trim()}
                style={[st.primaryBtn, { flex: 1 }, (saveMut.isPending || !structured.trim()) && { opacity: 0.5 }]}
              >
                {saveMut.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={st.primaryBtnText}>💾 Salvar no Prontuário</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity onPress={reset} style={st.secondaryBtn}>
                <Text style={st.secondaryBtnText}>↩ Refazer</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* SAVED */}
        {mode === 'saved' && (
          <View style={st.centered}>
            <Text style={st.savedIcon}>✅</Text>
            <Text style={st.savedTitle}>Evolução salva!</Text>
            <Text style={st.savedHint}>Registrada no prontuário do paciente.</Text>
            <TouchableOpacity onPress={reset} style={[st.primaryBtn, { marginTop: 20 }]}>
              <Text style={st.primaryBtnText}>+ Nova evolução</Text>
            </TouchableOpacity>
            {onClose && (
              <TouchableOpacity onPress={onClose} style={[st.secondaryBtn, { marginTop: 8 }]}>
                <Text style={st.secondaryBtnText}>Fechar</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Erro */}
        {!!errorMsg && (
          <View style={st.errorBox}>
            <Text style={st.errorText}>⚠️ {errorMsg}</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0F172A' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  title:       { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  subtitle:    { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  closeBtn:    { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#1E293B', borderRadius: 8 },
  closeBtnText:{ color: '#94A3B8', fontSize: 12, fontWeight: '600' },

  modeRow:     { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 0 },
  modeChip:    { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  modeChipActive:     { backgroundColor: '#4C1D95', borderColor: '#8B5CF6' },
  modeChipText:       { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  modeChipTextActive: { color: '#FFFFFF' },

  body: { flex: 1, padding: 16 },
  centered: { alignItems: 'center', paddingVertical: 40, gap: 12 },

  // Mic
  micButton:   { width: 100, height: 100, borderRadius: 50, backgroundColor: '#4C1D95', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#8B5CF6' },
  micIcon:     { fontSize: 44 },
  micHint:     { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  micHint2:    { color: '#64748B', fontSize: 12 },

  // Recording
  recordDot:   { width: 24, height: 24, borderRadius: 12, backgroundColor: '#EF4444' },
  recordingLabel:  { color: '#EF4444', fontSize: 18, fontWeight: '700' },
  recordingTime:   { color: '#FFFFFF', fontSize: 36, fontWeight: '700', fontVariant: ['tabular-nums'] },
  recordingHint:   { color: '#64748B', fontSize: 12 },
  stopBtn:         { marginTop: 8, backgroundColor: '#EF4444', paddingHorizontal: 28, paddingVertical: 13, borderRadius: 10 },
  stopBtnText:     { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Processing
  processingLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginTop: 12 },
  processingHint:  { color: '#64748B', fontSize: 12 },

  // Text mode
  textModeWrap:  { gap: 12 },
  textModeLabel: { color: '#94A3B8', fontSize: 13 },
  textArea:      { backgroundColor: '#1E293B', borderRadius: 10, borderWidth: 1, borderColor: '#334155', padding: 14, color: '#FFFFFF', fontSize: 14, minHeight: 140 },

  // Review
  reviewWrap:    { gap: 14 },
  rawBlock:      { backgroundColor: '#1E293B', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#334155' },
  rawLabel:      { color: '#64748B', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  rawText:       { color: '#94A3B8', fontSize: 12, lineHeight: 18 },
  structuredBlock:{ backgroundColor: '#1E293B', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#8B5CF6' },
  structuredHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  structuredLabel: { color: '#A78BFA', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  editHint:        { color: '#475569', fontSize: 10 },
  structuredArea:  { color: '#FFFFFF', fontSize: 13, lineHeight: 22, minHeight: 180 },
  reviewBtns:    { flexDirection: 'row', gap: 8 },

  // Saved
  savedIcon:   { fontSize: 56 },
  savedTitle:  { color: '#10B981', fontSize: 20, fontWeight: '700' },
  savedHint:   { color: '#94A3B8', fontSize: 13 },

  // Buttons
  primaryBtn:     { backgroundColor: '#8B5CF6', borderRadius: 10, paddingVertical: 13, paddingHorizontal: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  secondaryBtn:   { backgroundColor: '#1E293B', borderRadius: 10, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  secondaryBtnText:{ color: '#94A3B8', fontSize: 13, fontWeight: '600' },

  // Error
  errorBox:  { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', marginTop: 8 },
  errorText: { color: '#EF4444', fontSize: 12 },
});

export default VoiceEvolution;
