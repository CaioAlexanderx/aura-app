import { View, StyleSheet, Platform } from "react-native";

// Orbs radiais cherry + violet sutis no fundo das telas food.
// Só web — em native fica solid bg.
export function OrbBackground() {
  if (Platform.OS !== "web") return null;
  return (
    <>
      <View style={[styles.orb, styles.cherry]} />
      <View style={[styles.orb, styles.violet]} />
      <View style={[styles.orb, styles.heat]} />
    </>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: "fixed" as any,
    pointerEvents: "none",
    filter: "blur(80px)" as any,
    zIndex: 0,
  },
  cherry: {
    top: -240,
    left: -180,
    width: 760,
    height: 760,
    background: "radial-gradient(circle, rgba(239,68,68,0.16) 0%, transparent 65%)" as any,
  },
  violet: {
    bottom: -280,
    right: -200,
    width: 820,
    height: 820,
    background: "radial-gradient(circle, rgba(124,58,237,0.14) 0%, transparent 65%)" as any,
  },
  heat: {
    top: "40%" as any,
    left: "50%" as any,
    transform: [{ translateX: -300 }, { translateY: -300 }] as any,
    width: 600,
    height: 600,
    background: "radial-gradient(circle, rgba(252,211,77,0.06) 0%, transparent 60%)" as any,
  },
});
