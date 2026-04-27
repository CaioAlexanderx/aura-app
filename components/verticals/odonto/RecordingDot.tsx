import { useRef, useEffect } from 'react';
import { Animated, StyleSheet } from 'react-native';

// AURA. — RecordingDot
// Indicador animado de gravacao (pulsa entre opacity 1 e 0.15).
// Extraido de speechUtils.ts (split em 2026-04-26) pra permitir manter
// os helpers Web Speech como .ts puro — .ts nao aceita JSX inline.

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

export default RecordingDot;
