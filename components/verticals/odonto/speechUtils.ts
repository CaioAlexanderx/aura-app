// AURA. — speechUtils
// Helpers da Web Speech API + RecordingDot animado.
// Extraido de VoiceEvolution.tsx (decomposicao).

import { useRef, useEffect } from 'react';
import { Animated, StyleSheet } from 'react-native';

// ─── Web Speech API helpers ───────────────────────────────────
export function hasSpeechRecognition(): boolean {
  if (typeof window === 'undefined') return false;
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function createRecognition(): any {
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const rec = new SpeechRecognition();
  rec.lang = 'pt-BR';
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 1;
  return rec;
}

// ─── RecordingDot animado ─────────────────────────────────────
export function RecordingDot() {
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

  return <Animated.View style={[st.dot, { opacity }]} />;
}

const st = StyleSheet.create({
  dot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#EF4444' },
});
