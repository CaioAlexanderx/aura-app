import { useRef } from "react";
import { Pressable, Text, View, StyleSheet, Platform, Animated } from "react-native";
import { StudioGradient } from "@/components/studio/StudioGradient";
import { Icon } from "@/components/Icon";
import { StudioColors, StudioGradients } from "@/constants/studio-tokens";

type Props = {
  onPress: () => void;
  icon?: string;
  label?: string;          // se passado, FAB extendido (pill)
  position?: { bottom?: number; right?: number; left?: number; top?: number };
  accessibilityLabel?: string;
};

export function StudioFab({
  onPress, icon = "plus", label,
  position = { bottom: 24, right: 24 },
  accessibilityLabel,
}: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  function handlePressIn() {
    Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true, friction: 5 }).start();
  }
  function handlePressOut() {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 4 }).start();
    // Pulse on release
    pulseAnim.setValue(0);
    Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }

  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });

  const isExtended = !!label;

  return (
    <View style={[s.wrap, position]}>
      {/* Ripple visual */}
      <Animated.View
        pointerEvents="none"
        style={[
          s.pulse,
          isExtended && s.pulseExtended,
          {
            backgroundColor: StudioColors.accent,
            opacity: pulseOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, Platform.OS === "web" && (s.shadowWeb as any)]}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel || label || "Ação"}
        >
          {/* StudioGradient (zero-deps): CSS linear-gradient no web, cor sólida central no native.
              Substitui o caminho antigo que ramificava Platform.OS web (CSS) vs native (LinearGradient
              de expo-linear-gradient, que NÃO está no package.json — quebrava build CF Workers). */}
          <StudioGradient
            colors={StudioGradients.brand as unknown as string[]}
            direction="135deg"
            style={[s.fab, isExtended && s.fabExtended]}
          >
            <Icon name={icon as any} size={isExtended ? 18 : 22} color="#fff" />
            {isExtended && <Text style={s.fabLabel}>{label}</Text>}
          </StudioGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute" as any, zIndex: 100 },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: "center", justifyContent: "center",
  },
  fabExtended: {
    flexDirection: "row",
    width: "auto" as any,
    paddingHorizontal: 20,
    gap: 8,
  },
  fabLabel: { color: "#fff", fontSize: 14, fontWeight: "800" },
  pulse: {
    position: "absolute" as any,
    width: 56, height: 56, borderRadius: 28,
  },
  pulseExtended: { width: "auto" as any, height: 56, paddingHorizontal: 20, alignSelf: "stretch" },
  shadowWeb: {
    boxShadow: "0 12px 32px -8px rgba(236,72,153,0.45), 0 4px 12px -2px rgba(30,58,138,0.3)",
    borderRadius: 28,
  },
});

export default StudioFab;
