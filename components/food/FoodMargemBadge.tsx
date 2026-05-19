import { View, Text } from "react-native";
import { FoodColors } from "@/constants/food-tokens";
import { getMarginLevel } from "@/hooks/useFoodMenu";

// ============================================================
// FoodMargemBadge — badge visual de margem do prato.
// Semáforo: verde >=40%, amber 20-40%, vermelho <20%, cinza sem ficha.
// ============================================================

const COLORS = {
  green: { bg: "rgba(16,185,129,0.15)",  border: FoodColors.green,  text: FoodColors.green },
  amber: { bg: "rgba(245,158,11,0.15)",  border: FoodColors.amber,  text: FoodColors.amber },
  red:   { bg: "rgba(239,68,68,0.15)",   border: FoodColors.red,    text: FoodColors.red },
  gray:  { bg: "rgba(148,163,184,0.1)",  border: FoodColors.border, text: FoodColors.ink3 },
};

export function FoodMargemBadge({
  marginPct,
  size = "md",
}: {
  marginPct: number | null | undefined;
  size?: "sm" | "md";
}) {
  const level = getMarginLevel(marginPct);
  const c = COLORS[level];
  const text = marginPct == null || isNaN(Number(marginPct))
    ? "—"
    : (Number(marginPct) >= 0 ? "+" : "") + Number(marginPct).toFixed(0) + "%";
  const fontSize = size === "sm" ? 11 : 13;
  const padH = size === "sm" ? 6 : 8;
  const padV = size === "sm" ? 2 : 4;

  return (
    <View style={{
      backgroundColor: c.bg,
      borderColor: c.border,
      borderWidth: 1,
      paddingHorizontal: padH,
      paddingVertical: padV,
      borderRadius: 999,
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.border }} />
      <Text style={{ color: c.text, fontSize, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

export default FoodMargemBadge;
