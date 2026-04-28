// ============================================================
// VoiceTranscription — captura e transcreve voz em tempo real
//
// PR32 #6 (2026-04-28): primeira versao real de IA voz.
//
// Stack: Web Speech API nativa (navegador). Zero custo, sem backend.
// Suporte: Chrome/Edge/Safari. Firefox nao suporta - mostra fallback.
//
// Modo continuous + interimResults: texto aparece sendo digitado em
// tempo real conforme o dentista fala. Idioma pt-BR fixo.
//
// Uso pretendido:
//  - ConsultaShell -> VoicePanel "Anotar via voz" abre este modal
//  - Dentista descreve procedimento falando
//  - Confirma -> texto vai pro prontuario / evolucao
//
// Limitacoes conhecidas:
//  - Firefox: SpeechRecognition nao implementado, mostra warning
//  - Mobile: depende do browser; iOS Safari 14.5+ funciona
//  - Sem microfone: erro de permissao - mostra fallback de digitacao
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Modal, View, Text, Pressable, TextInput, StyleSheet, Platform, Animated } from "react-native";
import { DentalColors } from "@/constants/dental-tokens";
import { toast } from "@/components/Toast";

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Recebe o texto transcrito quando user confirma. */
  onTranscript: (text: string) => void;
  title?: string;
  hint?: string;
}

const isWeb = Platform.OS === "web";

// Detecta SpeechRecognition no objeto window (varia por vendor).
function getSR(): any {
  if (!isWeb || typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function VoiceTranscription({ visible, onClose, onTranscript, title, hint }: Props) {
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recogRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse loop pro indicador de gravacao
  useEffect(() => {
    if (!recording) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 750, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [recording, pulseAnim]);

  // Detecta suporte ao abrir
  useEffect(() => {
    if (!visible) return;
    const SR = getSR();
    if (!SR) {
      setSupported(false);
      setError("Seu navegador nao suporta reconhecimento de voz. Use Chrome, Edge ou Safari.");
      return;
    }
    setSupported(true);
    setError(null);
    setFinalText("");
    setInterimText("");
  }, [visible]);

  // Cleanup ao fechar
  useEffect(() => {
    if (!visible) {
      stopRecording();
    }
  }, [visible]);

  function startRecording() {
    const SR = getSR();
    if (!SR) {
      setError("Reconhecimento de voz nao suportado neste navegador.");
      return;
    }
    try {
      const r = new SR();
      r.lang = "pt-BR";
      r.continuous = true;
      r.interimResults = true;
      r.maxAlternatives = 1;

      r.onresult = (event: any) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }
        if (final) {
          setFinalText((prev) => (prev ? prev + " " : "") + final.trim());
        }
        setInterimText(interim);
      };

      r.onerror = (e: any) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setError("Permissao do microfone negada. Habilite nas configuracoes do navegador.");
        } else if (e.error === "no-speech") {
          // ignora silencios curtos - nao mostra erro
        } else if (e.error === "audio-capture") {
          setError("Microfone nao detectado.");
        } else {
          setError("Erro: " + e.error);
        }
        setRecording(false);
      };

      r.onend = () => {
        // Se parou sozinho e ainda esta marcado como recording, reinicia
        // (workaround: continuous=true ainda para apos silencio em alguns browsers)
        if (recogRef.current === r && recording) {
          try { r.start(); } catch {}
        }
      };

      recogRef.current = r;
      r.start();
      setRecording(true);
      setError(null);
    } catch (e: any) {
      setError("Erro ao iniciar: " + (e?.message || "desconhecido"));
      setRecording(false);
    }
  }

  function stopRecording() {
    const r = recogRef.current;
    recogRef.current = null;
    if (r) {
      try { r.onend = null; r.stop(); } catch {}
    }
    setRecording(false);
    setInterimText("");
  }

  function handleClose() {
    stopRecording();
    setFinalText("");
    setInterimText("");
    onClose();
  }

  function handleConfirm() {
    stopRecording();
    const text = finalText.trim();
    if (!text) {
      toast.error("Nada foi transcrito ainda");
      return;
    }
    onTranscript(text);
    toast.success("Transcricao adicionada");
    setFinalText("");
    setInterimText("");
    onClose();
  }

  function handleClear() {
    setFinalText("");
    setInterimText("");
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={s.backdrop}>
        <View style={s.modal}>
          <View style={s.header}>
            <View>
              <Text style={s.title}>{title || "Transcricao por voz"}</Text>
              <Text style={s.hint}>{hint || "Fale livremente. O texto aparecera abaixo em tempo real."}</Text>
            </View>
            <Pressable onPress={handleClose} style={s.closeBtn}>
              <Text style={{ color: DentalColors.ink2, fontSize: 16 }}>✕</Text>
            </Pressable>
          </View>

          {!supported ? (
            <View style={s.errorBox}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>🎙</Text>
              <Text style={s.errorText}>{error}</Text>
              <Text style={s.fallbackHint}>Voce pode digitar manualmente abaixo:</Text>
              <TextInput
                style={[s.transcriptBox, { minHeight: 120 }]}
                value={finalText}
                onChangeText={setFinalText}
                multiline
                placeholder="Digite o texto..."
                placeholderTextColor={DentalColors.ink3}
              />
            </View>
          ) : (
            <>
              {/* Indicador de gravacao */}
              <View style={s.statusBox}>
                {recording ? (
                  <View style={s.statusRow}>
                    <Animated.View style={[s.recDot, { opacity: pulseAnim }]} />
                    <Text style={s.statusText}>Ouvindo...</Text>
                  </View>
                ) : finalText ? (
                  <Text style={[s.statusText, { color: DentalColors.green }]}>✓ Pausado</Text>
                ) : (
                  <Text style={[s.statusText, { color: DentalColors.ink3 }]}>Pronto pra gravar</Text>
                )}
              </View>

              {/* Transcript */}
              <View style={s.transcriptBox}>
                {finalText ? (
                  <Text style={s.transcriptText}>{finalText}</Text>
                ) : null}
                {interimText ? (
                  <Text style={[s.transcriptText, { color: DentalColors.ink3, fontStyle: "italic" }]}>
                    {finalText ? " " : ""}{interimText}
                  </Text>
                ) : null}
                {!finalText && !interimText && (
                  <Text style={s.transcriptPlaceholder}>
                    {recording ? "Comece a falar..." : "Clique em 'Iniciar gravacao' pra comecar"}
                  </Text>
                )}
              </View>

              {error && <Text style={s.errorInline}>⚠ {error}</Text>}
            </>
          )}

          {/* Actions */}
          <View style={s.footer}>
            {finalText && (
              <Pressable onPress={handleClear} style={s.btnGhost}>
                <Text style={s.btnGhostText}>↻ Limpar</Text>
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            {supported && !recording && (
              <Pressable onPress={startRecording} style={s.btnRecord}>
                <Text style={s.btnRecordText}>🎙 {finalText ? "Continuar" : "Iniciar"} gravacao</Text>
              </Pressable>
            )}
            {supported && recording && (
              <Pressable onPress={stopRecording} style={s.btnStop}>
                <Text style={s.btnStopText}>⏸ Pausar</Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleConfirm}
              disabled={!finalText.trim()}
              style={[s.btnConfirm, !finalText.trim() && { opacity: 0.4 }]}
            >
              <Text style={s.btnConfirmText}>✓ Adicionar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { width: "100%", maxWidth: 600, backgroundColor: DentalColors.bg2, borderRadius: 16, borderWidth: 1, borderColor: DentalColors.border, overflow: "hidden" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 16, borderBottomWidth: 1, borderBottomColor: DentalColors.border, gap: 12 },
  title: { fontSize: 16, fontWeight: "800", color: DentalColors.ink },
  hint: { fontSize: 11, color: DentalColors.ink3, marginTop: 4 },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },

  statusBox: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: DentalColors.red },
  statusText: { fontSize: 12, fontWeight: "700", color: DentalColors.red, letterSpacing: 0.4 },

  transcriptBox: {
    margin: 16, marginTop: 4,
    padding: 14, minHeight: 140,
    backgroundColor: DentalColors.bg, borderRadius: 12,
    borderWidth: 1, borderColor: DentalColors.border,
  } as any,
  transcriptText: { fontSize: 14, color: DentalColors.ink, lineHeight: 22 },
  transcriptPlaceholder: { fontSize: 12, color: DentalColors.ink3, fontStyle: "italic", textAlign: "center", paddingVertical: 24 },

  errorBox: { padding: 24, alignItems: "center", gap: 8 },
  errorText: { fontSize: 13, color: DentalColors.amber, textAlign: "center", lineHeight: 18 },
  errorInline: { fontSize: 11, color: DentalColors.amber, paddingHorizontal: 16, paddingBottom: 8, textAlign: "center" },
  fallbackHint: { fontSize: 11, color: DentalColors.ink3, marginTop: 8 },

  footer: { flexDirection: "row", gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: DentalColors.border, alignItems: "center", flexWrap: "wrap" },
  btnGhost: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: DentalColors.border },
  btnGhostText: { color: DentalColors.ink2, fontSize: 11, fontWeight: "600" },
  btnRecord: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 9, backgroundColor: DentalColors.red, borderWidth: 1, borderColor: DentalColors.red },
  btnRecordText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  btnStop: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 9, backgroundColor: DentalColors.amber, borderWidth: 1, borderColor: DentalColors.amber },
  btnStopText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  btnConfirm: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 9, backgroundColor: DentalColors.cyan, borderWidth: 1, borderColor: DentalColors.cyan },
  btnConfirmText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});

export default VoiceTranscription;
