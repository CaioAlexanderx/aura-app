import { View, Text, StyleSheet } from "react-native";
import { useVerticalTheme } from "@/hooks/useVerticalTheme";

// ============================================================
// VER-02b: VerticalContextBar
// Shows "Modo Odontologia" banner when a vertical module is active
// Sits at the top of the screen content area
// ============================================================

interface Props {
  subtitle?: string; // e.g. "Clinica Sorriso — Dr. Marcos CRO-SP 12345"
}

export function VerticalContextBar({ subtitle }: Props) {
  const theme = useVerticalTheme();

  if (!theme.isVerticalActive) return null;

  return (
    <View style={[s.bar, { backgroundColor: theme.accentDark, borderBottomColor: theme.accent }]}>
      <View style={[s.dot, { backgroundColor: theme.accent }]} />
      <Text style={[s.label, { color: theme.accentText }]}>
        Modo {theme.moduleName}
      </Text>
      {subtitle ? (
        <Text style={[s.sub, { color: theme.accentText }]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
  sub: {
    fontSize: 11,
    marginLeft: "auto",
    opacity: 0.7,
  },
});
