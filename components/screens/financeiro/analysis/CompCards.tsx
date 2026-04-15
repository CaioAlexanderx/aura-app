import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { fmtK } from "../types";
import { PAL } from "./shared";

var isWeb = Platform.OS === "web";

export function CompCards({ current, previous }: any) {
  function Comp({ label, cur, prev, money, color }: any) {
    money = money !== false;
    var diff = prev > 0 ? ((cur - prev) / prev * 100) : 0;
    var up = diff >= 0;
    var [h, sH] = useState(false);
    return <Pressable onHoverIn={isWeb ? function() { sH(true); } : undefined} onHoverOut={isWeb ? function() { sH(false); } : undefined}
      style={[s.compCard, h && { borderColor: Colors.border2, transform: [{ scale: 1.03 }] }, isWeb && { transition: "all 0.2s ease" } as any]}>
      <Text style={s.compLabel}>{label}</Text>
      <Text style={[s.compValue, color && { color }]}>{money ? fmtK(cur) : cur}</Text>
      {prev > 0 && <View style={[s.badge, { backgroundColor: up ? Colors.greenD : Colors.redD }]}><Text style={[s.badgeText, { color: up ? PAL.green : PAL.red }]}>{up ? "+" : ""}{diff.toFixed(1)}%</Text></View>}
      {prev > 0 && <Text style={s.compHint}>vs anterior</Text>}
    </Pressable>;
  }
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}>
    <Comp label="Receita" cur={current.receita} prev={previous.receita} color={PAL.green} />
    <Comp label="Despesas" cur={current.despesa} prev={previous.despesa} color={PAL.red} />
    <Comp label="Vendas" cur={current.vendas} prev={previous.vendas} money={false} />
    <Comp label="Ticket medio" cur={current.avg_ticket} prev={previous.avg_ticket} />
  </ScrollView>;
}

var s = StyleSheet.create({
  compCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, minWidth: 125, alignItems: "center", gap: 4 },
  compLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "600" },
  compValue: { fontSize: 17, fontWeight: "800", color: Colors.ink },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  compHint: { fontSize: 8, color: Colors.ink3, marginTop: 1 },
});
