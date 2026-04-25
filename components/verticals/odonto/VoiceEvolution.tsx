// ============================================================
// AURA. — VoiceEvolution (GAP-02 v2 — Device STT)
// Componente de transcrição de evolução clínica por voz.
//
// Motor: Web Speech API nativa do browser (gratuita, zero custo)
//   - Chrome Android: suporte completo + streaming em tempo real
//   - Safari iOS: suporte completo via webkitSpeechRecognition
//   - Firefox: fallback para modo texto
//
// Fluxo:
//   1. Toca 🎙️ → SpeechRecognition.start() em pt-BR
//   2. Texto aparece em tempo real enquanto fala (interimResults)
//   3. Toca ⏹ → envia texto bruto ao backend
//   4. Backend: Claude estrutura em evolução clínica
//   5. Dentista revisa e edita → salva no prontuário
//
// Sem expo-av. Sem OpenAI. Zero custo por transcrição.
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Animated,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { request } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import type { PatientLite } from '@/components/verticals/odonto/PatientHub';

// ─────────────────────────────────────────────────────────────
// Web Speech API helpers
// ─────────────────────────────────────────────────────────────

// Detecta suporte (false no Node/SSR e no Firefox)
function hasSpeechRecognition(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
}

function createRecognition(): any {
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const rec = new SpeechRecognition();
  rec.lang = 'pt-BR';
  rec.interimResults = true;   // texto em tempo real
  rec.continuous = true;       // nao para automaticamente
  rec.maxAlternatives = 1;
  return rec;
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface Props {
  patient: PatientLite;
  onSaved?: (entryId: string, content: string) => void;
  onClose?: () => void;
}

type Mode = 'idle' | 'recording' | 'processing' | 'review' | 'saved';

// ─────────────────────────────────────────────────────────────
// Animated recording dot
// ─────────────────────────────────────────────────────────────
function RecordingDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.15, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1,    duration: 500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return <Animated.View style={[st.recordDot, { opacity }]} />;
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export function VoiceEvolution({ patient, onSaved, onClose }: Props) {
  const cid = useAuthStore().company?.id ?? '';

  // Detecta suporte SSR-safe (só avalia no browser)
  const [sttSupported] = useState(() => hasSpeechRecognition());

  const [mode, setMode]               = useState<Mode>('idle');
  const [liveText, setLiveText]       = useState('');   // texto em tempo real (interim)
  const [finalText, setFinalText]     = useState('');   // texto confirmado
  const [structured, setStructured]   = useState('');
  const [errorMsg, setErrorMsg]       = useState('');
  const [recordingSec, setRecordingSec] = useState(0);
  const [textFallback, setTextFallback] = useState(false); // modo manual

  const recRef    = useRef<any>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Limpa reconhecimento ao desmontar ─────────────────────
  useEffect(() => {
    return () => {
      recRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Iniciar gravação ───────────────────────────────────────
  const startRecording = useCallback(() => {
    setErrorMsg('');
    setLiveText('');
    setFinalText('');

    const rec = createRecognition();
    if (!rec) { setTextFallback(true); return; }

    let accumulated = '';  // acumula resultado final entre pausas

    rec.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          accumulated += t + ' ';
        } else {
          interim = t;
        }
      }
      setFinalText(accumulated);
      setLiveText(interim);
    };

    rec.onerror = (event: any) => {
      if (event.error === 'no-speech') return;   // silêncio — nao é erro
      if (event.error === 'aborted') return;     // parado manualmente
      console.warn('[STT] error:', event.error);
      setErrorMsg(`Erro no reconhecimento de voz: ${event.error}`);
      stopRecording();
    };

    // iOS Safari para automaticamente — reinicia se ainda estiver gravando
    rec.onend = () => {
      if (recRef.current && mode === 'recording') {
        try { rec.start(); } catch { /* já parou manualmente */ }
      }
    };

    rec.start();
    recRef.current = rec;
    setMode('recording');
    setRecordingSec(0);
    timerRef.current = setInterval(() => setRecordingSec(s => s + 1), 1000);
  }, [mode]);

  // ── Parar gravação ─────────────────────────────────────────
  const stopRecording = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    // Pega o texto acumulado do state
    setMode('processing');
  }, []);

  // Quando mode muda para 'processing', dispara estruturação
  useEffect(() => {
    if (mode !== 'processing') return;
    const text = finalText.trim() || liveText.trim();
    if (!text || text.length < 5) {
      setErrorMsg('Nenhum texto captado. Fale mais próximo ao microfone e tente novamente.');
      setMode('idle');
      return;
    }
    structureMut.mutate(text);
  }, [mode]);

  // ── Claude: estrutura texto → evolução clínica ─────────────
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
      setErrorMsg(err?.message || 'Erro ao estruturar com IA.');
      setMode('idle');
    },
  });

  // ── Salvar no prontuário ───────────────────────────────────
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
    onError: (err: any) => setErrorMsg(err?.message || 'Erro ao salvar.'),
  });

  // ── Texto manual: estruturar ───────────────────────────────
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
    setMode('idle');
    setLiveText('');
    setFinalText('');
    setStructured('');
    setErrorMsg('');
    setRecordingSec(0);
  }

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────
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

      <ScrollView style={st.body} keyboardShouldPersistTaps="handled">

        {/* ── IDLE ─────────────────────────────────────────── */}
        {mode === 'idle' && (
          <>
            {sttSupported && !textFallback ? (
              /* Modo voz */
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
              /* Modo texto manual */
              <View style={st.textWrap}>
                {!sttSupported && (
                  <View style={st.infoBox}>
                    <Text style={st.infoText}>
                      ℹ️ Seu navegador não suporta reconhecimento de voz automático.
                      Use o microfone do teclado (🎤) ou digite a evolução abaixo.
                    </Text>
                  </View>
                )}
                <Text style={st.textLabel}>
                  {sttSupported ? 'Digite ou use o 🎤 do teclado:' : 'Escreva a evolução:'}
                </Text>
                <TextInput
                  style={st.textArea}
                  placeholder="Ex: Paciente retornou para revisão. Realizado polimento e aplicação de flúor. Sem queixas. Retorno em 6 meses..."
                  placeholderTextColor="#475569"
                  multiline
                  textAlignVertical="top"
                  value={finalText}
                  onChangeText={setFinalText}
                  autoFocus
                />
                <View style={st.rowBtns}>
                  <TouchableOpacity
                    onPress={handleStructureManual}
                    disabled={finalText.trim().length < 5}
                    style={[st.primaryBtn, { flex: 1 }, finalText.trim().length < 5 && { opacity: 0.4 }]}
                  >
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

        {/* ── RECORDING ────────────────────────────────────── */}
        {mode === 'recording' && (
          <View style={st.centered}>
            <RecordingDot />
            <Text style={st.recLabel}>Ouvindo...</Text>
            <Text style={st.recTimer}>
              {String(Math.floor(recordingSec / 60)).padStart(2, '0')}:
              {String(recordingSec % 60).padStart(2, '0')}
            </Text>

            {/* Texto em tempo real */}
            <View style={st.liveBox}>
              <Text style={st.liveConfirmed}>{finalText}</Text>
              {!!liveText && (
                <Text style={st.liveInterim}>{liveText}</Text>
              )}
              {!finalText && !liveText && (
                <Text style={st.livePlaceholder}>Fale agora... o texto aparecerá aqui</Text>
              )}
            </View>

            <TouchableOpacity onPress={stopRecording} style={st.stopBtn}>
              <Text style={st.stopBtnText}>⏹ Parar e estruturar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── PROCESSING ───────────────────────────────────── */}
        {mode === 'processing' && (
          <View style={st.centered}>
            <ActivityIndicator color="#8B5CF6" size="large" />
            <Text style={st.procLabel}>Estruturando com IA...</Text>
            <Text style={st.procHint}>Claude está organizando a evolução clínica</Text>
          </View>
        )}

        {/* ── REVIEW ───────────────────────────────────────── */}
        {mode === 'review' && (
          <View style={st.reviewWrap}>
            {/* Original ditado */}
            {!!(finalText || liveText) && (
              <View style={st.rawBlock}>
                <Text style={st.rawLabel}>📝 Ditado original</Text>
                <Text style={st.rawText}>{(finalText + ' ' + liveText).trim()}</Text>
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
                onChangeText={setStructured}
                multiline
                textAlignVertical="top"
                placeholder="Evolução clínica estruturada..."
                placeholderTextColor="#475569"
              />
            </View>

            <View style={st.rowBtns}>
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

        {/* ── SAVED ────────────────────────────────────────── */}
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

        {/* Erro */}
        {!!errorMsg && (
          <View style={st.errorBox}>
            <Text style={st.errorText}>⚠️ {errorMsg}</Text>
          </View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0F172A' },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  title:      { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  subtitle:   { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  closeBtn:   { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#1E293B', borderRadius: 8 },
  closeBtnText:{ color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  body:       { flex: 1, padding: 16 },
  centered:   { alignItems: 'center', paddingVertical: 32, gap: 12 },

  // Mic idle
  micButton:  { width: 100, height: 100, borderRadius: 50, backgroundColor: '#4C1D95', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#8B5CF6' },
  micIcon:    { fontSize: 44 },
  micHint:    { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  micHint2:   { color: '#64748B', fontSize: 12, textAlign: 'center', paddingHorizontal: 32 },
  switchBtn:  { marginTop: 4, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#1E293B', borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  switchBtnText:{ color: '#64748B', fontSize: 12 },

  // Text fallback
  textWrap:   { gap: 12 },
  textLabel:  { color: '#94A3B8', fontSize: 13 },
  textArea:   { backgroundColor: '#1E293B', borderRadius: 10, borderWidth: 1, borderColor: '#334155', padding: 14, color: '#FFFFFF', fontSize: 14, minHeight: 140 },
  infoBox:    { backgroundColor: '#1E293B', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#334155' },
  infoText:   { color: '#94A3B8', fontSize: 12, lineHeight: 18 },

  // Recording
  recordDot:   { width: 22, height: 22, borderRadius: 11, backgroundColor: '#EF4444' },
  recLabel:    { color: '#EF4444', fontSize: 18, fontWeight: '700' },
  recTimer:    { color: '#FFFFFF', fontSize: 40, fontWeight: '700' },
  liveBox:     { width: '100%', minHeight: 80, backgroundColor: '#1E293B', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#334155', marginHorizontal: 0 },
  liveConfirmed:{ color: '#FFFFFF', fontSize: 14, lineHeight: 22 },
  liveInterim: { color: '#94A3B8', fontSize: 14, fontStyle: 'italic', lineHeight: 22 },
  livePlaceholder:{ color: '#475569', fontSize: 13, fontStyle: 'italic' },
  stopBtn:     { backgroundColor: '#EF4444', paddingHorizontal: 28, paddingVertical: 13, borderRadius: 10, marginTop: 4 },
  stopBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Processing
  procLabel:   { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginTop: 12 },
  procHint:    { color: '#64748B', fontSize: 12 },

  // Review
  reviewWrap:  { gap: 14 },
  rawBlock:    { backgroundColor: '#1E293B', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#334155' },
  rawLabel:    { color: '#64748B', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  rawText:     { color: '#94A3B8', fontSize: 12, lineHeight: 18 },
  structBlock: { backgroundColor: '#1E293B', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#8B5CF6' },
  structHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  structLabel: { color: '#A78BFA', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  structHint:  { color: '#475569', fontSize: 10 },
  structArea:  { color: '#FFFFFF', fontSize: 13, lineHeight: 22, minHeight: 180 },

  // Saved
  savedTitle:  { color: '#10B981', fontSize: 20, fontWeight: '700' },
  savedHint:   { color: '#94A3B8', fontSize: 13 },

  // Shared
  rowBtns:     { flexDirection: 'row', gap: 8 },
  primaryBtn:  { backgroundColor: '#8B5CF6', borderRadius: 10, paddingVertical: 13, paddingHorizontal: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  primaryBtnText:{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  secondaryBtn:{ backgroundColor: '#1E293B', borderRadius: 10, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  secondaryBtnText:{ color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  errorBox:    { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', marginTop: 8 },
  errorText:   { color: '#EF4444', fontSize: 12 },
});

export default VoiceEvolution;
