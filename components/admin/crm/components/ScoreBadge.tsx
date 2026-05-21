// ─── ScoreBadge ──────────────────────────────────────────────────────────────
// Badge do dynamic_score com cor por faixa.
// Usado em LeadCard, LeadDetailView e KanbanColumn.
// ============================================================================

import { Text, View, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { scoreColor, scoreLabel } from "../shared/constants";

type Props = {
  score: number;
  variant?: "full" | "compact" | "dot";
};

export function ScoreBadge({ score, variant = "compact" }: Props) {
  const color = scoreColor(score);
  const label = scoreLabel(score);

  if (variant === "dot") {
    return <View style={[s.dot, { backgroundColor: color }]} />;
  }

  if (variant === "compact") {
    return (
      <Text style={[s.compact, { color }]}>
        {score}/100
      </Text>
    );
  }

  // full
  return (
    <View style={[s.full, { backgroundColor: color + "18", borderColor: color + "44" }]}>
      <Text style={[s.fullScore, { color }]}>{score}</Text>
      <Text style={[s.fullLabel, { color }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4 },
  compact: { fontSize: 10, fontWeight: "700" },
  full: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  fullScore: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  fullLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },
});
