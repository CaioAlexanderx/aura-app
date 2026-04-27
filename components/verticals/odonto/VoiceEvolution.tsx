// AURA. — VoiceEvolution — orchestrator
// Transcrição de evolução clínica por voz (Web Speech API nativa).
// Decomposicao: speechUtils (helpers + RecordingDot) + VoiceReviewPanel

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { request } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { hasSpeechRecognition, createRecognition, RecordingDot } from './speechUtils';
import { VoiceReviewPanel } from './VoiceReviewPanel';
import type { PatientLite } from './PatientHub';

type Mode = 'idle' | 'recording' | 'processing' | 'review' | 'saved';

interface Props {
  patient:   PatientLite;
  onSaved?:  (entryId: string, content: string) => void;
  onClose?:  () => void;
}

export function VoiceEvolution({ patient, onSaved, onClose }: Props) {
  const cid = useAuthStore().company?.id ?? '';
  const [sttSupported]  = useState(() => hasSpeechRecognition());
  const [mode,           setMode]           = useState<Mode>('idle');
  const [liveText,       setLiveText]       = useState('');
  const [finalText,      setFinalText]      = useState('');
  const [structured,     setStructured]     = useState('');
  const [errorMsg,       setErrorMsg]       = useState('');
  const [recordingSec,   setRecordingSec]   = useState(0);
  const [textFallback,   setTextFallback]   = useState(false);

  const recRef   = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      recRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = useCallback(() => {
    setErrorMsg(''); setLiveText(''); setFinalText('');
    const rec = createRecognition();
    if (!rec) { setTextFallback(true); return; }

    let accumulated = '';
    rec.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) { accumulated += t + ' '; }
        else { interim = t; }
      }
      setFinalText(accumulated);
      setLiveText(interim);
    };
    rec.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      setErrorMsg(`Erro no reconhecimento: ${event.error}`);
      stopRecording();
    };
    rec.onend = () => {
      if (recRef.current && mode === 'recording') { try { rec.start(); } catch {} }
    };
    rec.start();
    recRef.current = rec;
    setMode('recording');
    setRecordingSec(0);
    timerRef.current = setInterval(() => setRecordingSec(s => s + 1), 1000);
  }, [mode]);

  const stopRecording = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setMode('processing');
  }, []);

  useEffect(() => {
    if (mode !== 'processing') return;
    const text = finalText.trim() || liveText.trim();
    if (!text || text.length < 5) {
      setErrorMsg('Nenhum texto captado. Fale mais próximo ao microfone.');
      setMode('idle');
      return;
    }
    structureMut.mutate(text);
  }, [mode]);

  const structureMut = useMutation({
    mutationFn: (text: string) =>
      request(`/companies/${cid}/dental/transcribe/text`, {
        method: 'POST',
        body: { raw_text: text, patient_name: patient.full_name || patient.name, patient_id: patient.id },
      }),
    onSuccess: (data: any) => { setStructured(data.structured || ''); setMode('review'); },
    onError:   (err: any)  => { setErrorMsg(err?.message || 'Erro ao estruturar com IA.'); setMode('idle'); },
  });

  const saveMut = useMutation({
    mutationFn: () =>
      request(`/companies/${cid}/dental/transcribe/text`, {
        method: 'POST',
        body: { raw_text: structured, patient_name: patient.full_name || patient.name, patient_id: patient.id, save: true },
      }),
    onSuccess: (data: any) => { setMode('saved'); onSaved?.(data.entry_id, structured); },
    onError:   (err: any)  => setErrorMsg(err?.message || 'Erro ao salvar.'),
  });

  function handleStructureManual() {
    const text = finalText.trim();
    if (text.length < 5) { setErrorMsg('Digite ao menos algumas palavras.'); return; }
    setErrorMsg('');
    setMode('processing');
    structureMut.mutate(text);
  }

  function reset() {
    recRef.current?.stop();
    recRef.current = null;
    setMode('idle'); setLiveText(''); setFinalText('');
    setStructured(''); setErrorMsg(''); setRecordingSec(0);
  }

  return (
    <View style={st.container}>
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

      <ScrollView style={st.body} keyboardShouldPersistTaps="handled">
        {/* IDLE */}
        {mode === 'idle' && (
          <>
            {sttSupported && !textFallback ? (
              <View style={st.centered}>
                <TouchableOpacity onPress={startRecording} style={st.micButton} activeOpacity={0.8}>
                  <Text style={st.micIcon}>🎙️</Text>
                </TouchableOpacity>
                <Text style={st.micHint}>Toque para falar</Text>
                <Text style={st.micHint2}>Descreva o atendimento em voz alta em português</Text>
                <TouchableOpacity onPress={() => setTextFallback(true)} style={st.switchBtn}>
                  <Text style={st.switchBtnText}>⌨️ Preferir digitar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={st.textWrap}>
                {!sttSupported && (
                  <View style={st.infoBox}>
                    <Text style={st.infoText}>ℹ️ Seu navegador não suporta reconhecimento de voz. Use o microfone do teclado 🎤 ou digite abaixo.</Text>
                  </View>
                )}
                <Text style={st.textLabel}>{sttSupported ? 'Digite ou use o 🎤 do teclado:' : 'Escreva a evolução:'}</Text>
                <TextInput
                  style={st.textArea}
                  placeholder="Ex: Paciente retornou para revisão. Realizado polimento e aplicação de flúor..."
                  placeholderTextColor="#475569"
                  multiline textAlignVertical="top"
                  value={finalText} onChangeText={setFinalText} autoFocus
                />
                <View style={st.rowBtns}>
                  <TouchableOpacity onPress={handleStructureManual} disabled={finalText.trim().length < 5} style={[st.primaryBtn, { flex: 1 }, finalText.trim().length < 5 && { opacity: 0.4 }]}>
                    <Text style={st.primaryBtnText}>✨ Estruturar com IA</Text>
                  </TouchableOpacity>
                  {sttSupported && (
                    <TouchableOpacity onPress={() => setTextFallback(false)} style={st.secondaryBtn}>
                      <Text style={st.secondaryBtnText}>🎙️</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </>
        )}

        {/* RECORDING */}
        {mode === 'recording' && (
          <View style={st.centered}>
            <RecordingDot />
            <Text style={st.recLabel}>Ouvindo...</Text>
            <Text style={st.recTimer}>
              {String(Math.floor(recordingSec / 60)).padStart(2,'0')}:{String(recordingSec % 60).padStart(2,'0')}
            </Text>
            <View style={st.liveBox}>
              <Text style={st.liveConfirmed}>{finalText}</Text>
              {!!liveText && <Text style={st.liveInterim}>{liveText}</Text>}
              {!finalText && !liveText && <Text style={st.livePlaceholder}>Fale agora... o texto aparecerá aqui</Text>}
            </View>
            <TouchableOpacity onPress={stopRecording} style={st.stopBtn}>
              <Text style={st.stopBtnText}>⏹ Parar e estruturar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* PROCESSING */}
        {mode === 'processing' && (
          <View style={st.centered}>
            <ActivityIndicator color="#8B5CF6" size="large" />
            <Text style={st.procLabel}>Estruturando com IA...</Text>
            <Text style={st.procHint}>Claude está organizando a evolução clínica</Text>
          </View>
        )}

        {/* REVIEW */}
        {mode === 'review' && (
          <VoiceReviewPanel
            rawText={(finalText + ' ' + liveText).trim()}
            structured={structured}
            isSaving={saveMut.isPending}
            onChangeStructured={setStructured}
            onSave={() => saveMut.mutate()}
            onReset={reset}
          />
        )}

        {/* SAVED */}
        {mode === 'saved' && (
          <View style={st.centered}>
            <Text style={{ fontSize: 56 }}>✅</Text>
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

        {!!errorMsg && (
          <View style={st.errorBox}><Text style={st.errorText}>⚠️ {errorMsg}</Text></View>
        )}
        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  title:     { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  subtitle:  { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  closeBtn:  { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#1E293B', borderRadius: 8 },
  closeBtnText:{ color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  body:      { flex: 1, padding: 16 },
  centered:  { alignItems: 'center', paddingVertical: 32, gap: 12 },
  micButton: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#4C1D95', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#8B5CF6' },
  micIcon:   { fontSize: 44 },
  micHint:   { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  micHint2:  { color: '#64748B', fontSize: 12, textAlign: 'center', paddingHorizontal: 32 },
  switchBtn: { marginTop: 4, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#1E293B', borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  switchBtnText:{ color: '#64748B', fontSize: 12 },
  textWrap:  { gap: 12 },
  textLabel: { color: '#94A3B8', fontSize: 13 },
  textArea:  { backgroundColor: '#1E293B', borderRadius: 10, borderWidth: 1, borderColor: '#334155', padding: 14, color: '#FFFFFF', fontSize: 14, minHeight: 140 },
  infoBox:   { backgroundColor: '#1E293B', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#334155' },
  infoText:  { color: '#94A3B8', fontSize: 12, lineHeight: 18 },
  recLabel:  { color: '#EF4444', fontSize: 18, fontWeight: '700' },
  recTimer:  { color: '#FFFFFF', fontSize: 40, fontWeight: '700' },
  liveBox:   { width: '100%', minHeight: 80, backgroundColor: '#1E293B', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#334155' },
  liveConfirmed:{ color: '#FFFFFF', fontSize: 14, lineHeight: 22 },
  liveInterim:  { color: '#94A3B8', fontSize: 14, fontStyle: 'italic', lineHeight: 22 },
  livePlaceholder:{ color: '#475569', fontSize: 13, fontStyle: 'italic' },
  stopBtn:   { backgroundColor: '#EF4444', paddingHorizontal: 28, paddingVertical: 13, borderRadius: 10, marginTop: 4 },
  stopBtnText:{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  procLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginTop: 12 },
  procHint:  { color: '#64748B', fontSize: 12 },
  savedTitle:{ color: '#10B981', fontSize: 20, fontWeight: '700' },
  savedHint: { color: '#94A3B8', fontSize: 13 },
  rowBtns:   { flexDirection: 'row', gap: 8 },
  primaryBtn:{ backgroundColor: '#8B5CF6', borderRadius: 10, paddingVertical: 13, paddingHorizontal: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  primaryBtnText:{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  secondaryBtn:{ backgroundColor: '#1E293B', borderRadius: 10, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  secondaryBtnText:{ color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  errorBox:  { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', marginTop: 8 },
  errorText: { color: '#EF4444', fontSize: 12 },
});

export default VoiceEvolution;
