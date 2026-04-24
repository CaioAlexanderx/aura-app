import { View, Text, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { webOnly } from "./types";

// Claude Design: conic-gradient ring spinning around the initial. Pure web CSS
// does the heavy lifting; native gets a clean violet circle.
export function Avatar({ name, size = 42 }: { name: string; size?: number }) {
  const inner = size - 4;
  const webRing = webOnly({
    background: "conic-gradient(from 0deg, #7c3aed, #8b5cf6, #4f5bd5, #7c3aed)",
    animation: "auraSpin 8s linear infinite",
  });
  return (
    <View
      style={[
        s.ring,
        { width: size, height: size, borderRadius: size / 2 },
        Platform.OS === "web" ? (webRing as any) : { backgroundColor: Colors.violet },
      ]}
    >
      <View
        style={[
          s.inner,
          {
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: Colors.bg2,
          },
        ]}
      >
        <Text style={[s.letter, { fontSize: Math.round(size * 0.36) }]}>
          {(name || "A").charAt(0).toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  ring: { alignItems: "center", justifyContent: "center", padding: 2 },
  inner: { alignItems: "center", justifyContent: "center" },
  letter: { fontWeight: "700", color: "#fff" },
});
