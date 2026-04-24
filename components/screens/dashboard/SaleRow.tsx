import { View, Text, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { fmt, webOnly } from "./types";

export function SaleRow({ customer, amount, time, method, type }: {
  customer: string; amount: number; time: string; method?: string; type?: string;
}) {
  const isExpense = type === "expense";
  const isPending = type === "pending";
  const color = isExpense ? Colors.red : isPending ? Colors.amber : Colors.green;
  const icon = isExpense ? "trending_down" : isPending ? "clock" : "trending_up";
  const prefix = isExpense ? "- " : isPending ? "~ " : "+ ";
  const glow = isExpense ? "rgba(248,113,113,0.3)" : isPending ? "rgba(251,191,36,0.3)" : "rgba(52,211,153,0.3)";

  const webChip = webOnly({
    background: `color-mix(in srgb, ${color} 14%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} 26%, transparent)`,
    position: "relative",
    overflow: "hidden",
  });
  const webSpin = webOnly({
    content: "",
    position: "absolute", inset: 0 as any,
    background: `conic-gradient(from 0deg, transparent 0deg, ${color} 50deg, transparent 120deg)`,
    opacity: 0.3, animation: "auraSpin 3s linear infinite",
  });

  return (
    <View style={s.row}>
      <View style={[s.chip, Platform.OS === "web" ? (webChip as any) : { backgroundColor: color + "22", borderColor: color + "44" }]}>
        {Platform.OS === "web" && <span style={webSpin as any} />}
        <View style={{ zIndex: 2 }}>
          <Icon name={icon as any} size={14} color={color} />
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.nm} numberOfLines={1}>{customer}</Text>
        <Text style={s.tm}>
          {(method || "").toString().toUpperCase()}{method ? "  -  " : ""}{time}
        </Text>
      </View>
      <Text
        style={[s.am, {
          color,
          textShadowColor: Platform.OS === "web" ? glow : undefined,
          textShadowRadius: Platform.OS === "web" ? 10 : 0,
        }]}
      >
        {prefix}{fmt(amount).replace("R$ ", "R$ ")}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, paddingHorizontal: 6, borderRadius: 10,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)",
  },
  chip: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  nm: { fontSize: 13, color: Colors.ink, fontWeight: "600", letterSpacing: -0.1 },
  tm: { fontSize: 10, color: Colors.ink3, letterSpacing: 0.4, marginTop: 2, fontFamily: (Platform.OS === "web" ? "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace" : undefined) },
  am: { fontSize: 13, fontWeight: "700", letterSpacing: -0.2, textAlign: "right", fontFamily: (Platform.OS === "web" ? "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace" : undefined) },
});
