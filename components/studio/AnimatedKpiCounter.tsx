import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { StudioColors } from "@/constants/studio-tokens";

type Props = {
  value: number;
  label?: string;
  fontSize?: number;
  color?: string;
  prefix?: string;
  suffix?: string;
  format?: (n: number) => string;
};

export function AnimatedKpiCounter({
  value, label, fontSize = 22, color, prefix = "", suffix = "", format,
}: Props) {
  const [display, setDisplay] = useState(value);
  const prevValue = useRef(value);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const badgeAnim = useRef(new Animated.Value(0)).current;
  const [showBadge, setShowBadge] = useState(false);

  useEffect(() => {
    if (value === prevValue.current) return;
    const oldV = prevValue.current;
    const newV = value;
    prevValue.current = newV;

    // Tween número
    let frame: any;
    const start = Date.now();
    const duration = 600;
    function tick() {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = oldV + (newV - oldV) * eased;
      setDisplay(current);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else setDisplay(newV);
    }
    tick();

    if (newV > oldV) {
      // Pulse bg
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      ]).start();

      // Badge +N
      setShowBadge(true);
      badgeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(badgeAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.delay(800),
        Animated.timing(badgeAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => setShowBadge(false));
    }

    return () => { if (frame) cancelAnimationFrame(frame); };
  }, [value, pulseAnim, badgeAnim]);

  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] });
  const badgeTranslateY = badgeAnim.interpolate({ inputRange: [0, 1], outputRange: [10, -20] });
  const delta = value - prevValue.current; // 0 após effect run

  const formatted = format
    ? format(display)
    : Math.round(display).toLocaleString("pt-BR");

  return (
    <View style={s.wrap}>
      <Animated.View
        style={[s.pulse, { backgroundColor: StudioColors.success, opacity: pulseOpacity }]}
        pointerEvents="none"
      />
      <Text style={[s.value, { fontSize, color: color || StudioColors.ink }]}>
        {prefix}{formatted}{suffix}
      </Text>
      {label && <Text style={s.label}>{label}</Text>}
      {showBadge && (
        <Animated.View
          style={[
            s.badge,
            {
              opacity: badgeAnim,
              transform: [{ translateY: badgeTranslateY }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={s.badgeTxt}>+{Math.max(1, value - (prevValue.current - delta))}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "relative", alignItems: "center" },
  pulse: { position: "absolute" as any, inset: -8, borderRadius: 12 },
  value: { fontWeight: "900", letterSpacing: -0.5 },
  label: { fontSize: 11, color: StudioColors.ink3, marginTop: 2, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  badge: {
    position: "absolute" as any, top: -8, right: -16,
    backgroundColor: StudioColors.accent, borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  badgeTxt: { color: "#fff", fontSize: 10, fontWeight: "800" },
});

export default AnimatedKpiCounter;
