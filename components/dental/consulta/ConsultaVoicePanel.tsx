// ============================================================
// ConsultaVoicePanel — captura de voz Web Speech + comandos.
//
// Reusa speechUtils + RecordingDot existentes. Mostra status,
// transcript ao vivo, botoes de comando manual (marcar dente,
// anotar, prescrever).
//
// Comandos sao puramente client-side. Quando IA backend chegar
// (PR18+), o transcript sera enviado pra resumo automatico.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { DentalColors } from "@/constants/dental-tokens";
import { hasSpeechRecognition, createRecognition, RecordingDot } from "@/components/verticals/odonto/speechUtils";
import type { VoiceSegment } from "@/lib/dentalConsultaTypes";

type CommandKind = "marcar" | "anotar" | "prescrever";

interface Props {
  transcript: VoiceSegment[];
  onAppendSegment: (s: VoiceSegment) => void;
  onCommand: (kind: CommandKind, text?: string) => void;
}

function newId(): string {
  return Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

export function ConsultaVoicePanel({ transcript, onAppendSegment, onCommand }: Props) {
  const supported = typeof window !== "undefined" && hasSpeechRecognition();
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => () => {
    try { recRef.current?.stop?.(); } catch { /* ignore */ }
  }, []);

  function startListening() {
    if (!supported || listening) return;
    const rec = createRecognition();
    if (!rec) return;
    rec.onresult = (event: any) => {
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t + " ";
      }
      const finalTxt = final.trim();
      if (!finalTxt) return;
      onAppendSegment({ id: newId(), text: finalTxt, ts: new Date().toISOString() });
      const lower = finalTxt.toLowerCase();
      if (/aura,?\s*marcar/.test(lower)) onCommand("marcar", finalTxt);
      else if (/aura,?\s*anotar/.test(lower)) onCommand("anotar", finalTxt);
      else if (/aura,?\s*prescrever|aura,?\s*receit/.test(lower)) onCommand("prescrever", finalTxt);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  function stopListening() {
    try { recRef.current?.stop?.(); } catch { /* ignore */ }
    setListening(false);
  }

  return (
    <View style={{ flex: 1, padding: 12, backgroundColor: DentalColors.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {listening ? <RecordingDot /> : <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: DentalColors.ink3 }} />}
          <Text style={{ fontSize: 9, fontWeight: "700", color: listening ? DentalColors.red : DentalColors.ink3, letterSpacing: 0.5 }}>
            {listening ? "🎙 Aura ouvindo" : supported ? "🎙 Microfone parado" : "Microfone nao suportado"}
          </Text>
        </View>
        <Text style={{
          fontSize: 8, color: DentalColors.ink3,
          backgroundColor: DentalColors.surface,
          paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5,
          borderWidth: 1, borderColor: DentalColors.border,
        }}>
          "Aura, ..."
        </Text>
      </View>

      <ScrollView
        style={{
          flex: 1, backgroundColor: DentalColors.bg2,
          borderWidth: 1, borderColor: DentalColors.border,
          borderRadius: 8, padding: 8,
        }}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {transcript.length === 0 ? (
          <Text style={{ fontSize: 10, color: DentalColors.ink3, fontStyle: "italic" }}>
            {supported
              ? 'Aperte "Iniciar microfone" e diga frases naturais. Use "Aura, marcar/anotar/prescrever ..." pra comandos.'
              : "Web Speech API nao disponivel neste navegador. Use Chrome ou Edge para captura por voz."}
          </Text>
        ) : (
          transcript.slice(-30).map((s) => (
            <Text key={s.id} style={{
              fontSize: 11, color: s.isCommand ? DentalColors.violet : DentalColors.ink2,
              fontWeight: s.isCommand ? "700" : "400",
              backgroundColor: s.isCommand ? "rgba(124,58,237,0.10)" : "transparent",
              padding: s.isCommand ? 4 : 0, borderRadius: 4,
              marginBottom: 4, lineHeight: 16,
            }}>
              {s.isCommand ? "🎙 " : ""}
              <Text style={{ fontSize: 9, color: DentalColors.ink3, fontWeight: "600" }}>
                [{new Date(s.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}] {" "}
              </Text>
              {s.text}
            </Text>
          ))
        )}
      </ScrollView>

      <View style={{ flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        {supported ? (
          <Pressable
            onPress={listening ? stopListening : startListening}
            style={[btnVoice, { backgroundColor: listening ? DentalColors.red : DentalColors.cyan, borderColor: "transparent" }]}>
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
              {listening ? "■ Parar microfone" : "▶ Iniciar microfone"}
            </Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => onCommand("marcar")} style={btnVoiceGhost}>
          <Text style={{ color: DentalColors.ink, fontSize: 10, fontWeight: "600" }}>🦷 Marcar dente</Text>
        </Pressable>
        <Pressable onPress={() => onCommand("anotar")} style={btnVoiceGhost}>
          <Text style={{ color: DentalColors.ink, fontSize: 10, fontWeight: "600" }}>📝 Anotar</Text>
        </Pressable>
        <Pressable onPress={() => onCommand("prescrever")} style={btnVoiceGhost}>
          <Text style={{ color: DentalColors.ink, fontSize: 10, fontWeight: "600" }}>💊 Prescrever</Text>
        </Pressable>
      </View>
    </View>
  );
}

const btnVoice = {
  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6,
  borderWidth: 1, borderColor: DentalColors.border,
};
const btnVoiceGhost = {
  paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6,
  backgroundColor: DentalColors.surface,
  borderWidth: 1, borderColor: DentalColors.border,
};
