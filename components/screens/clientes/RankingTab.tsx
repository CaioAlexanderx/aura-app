import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import type { Customer } from "./types";
import { fmt, getStatus } from "./types";

function Tag({ tag }: { tag: string }) {
  const m: Record<string, { b: string; f: string }> = {
    VIP: { b: Colors.violetD, f: Colors.violet3 }, Frequente: { b: Colors.greenD, f: Colors.green },
    Novo: { b: Colors.amberD, f: Colors.amber }, Inativo: { b: Colors.redD, f: Colors.red },
  };
  const c = m[tag] || { b: Colors.bg4, f: Colors.ink3 };
  return <View style={{ borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: c.b }}><Text style={{ fontSize: 9, fontWeight: "600", color: c.f }}>{tag}</Text></View>;
}

export function RankingTab({ customers }: { customers: Customer[] }) {
  const [metric, setMetric] = useState<"ltv" | "visits">("ltv");
  const ranked = [...customers].sort((a, b) => metric === "ltv" ? b.totalSpent - a.totalSpent : b.visits - a.visits);
  const medals: Record<number, string> = { 1: Colors.amber, 2: Colors.ink3, 3: "#cd7f32" };

  return (
    <View>
      <View style={s.toggleRow}>
        {(["ltv", "visits"] as const).map(m => (
          <Pressable key={m} onPress={() => setMetric(m)} style={[s.toggle, metric === m && s.toggleActive]}>
            <Text style={[s.toggleText, metric === m && s.toggleTextActive]}>{m === "ltv" ? "Por faturamento" : "Por frequencia"}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.listCard}>
        {ranked.map((c, i) => {
          const col = medals[i + 1];
          const tags = getStatus(c);
          return (
            <View key={c.id} style={s.row}>
              <View style={[s.rankBadge, col ? { backgroundColor: col + "22" } : {}]}>
                <Text style={[s.rankText, col ? { color: col } : {}]}>{i + 1}</Text>
              </View>
              <View style={s.avatar}><Text style={s.avatarText}>{c.name.charAt(0)}</Text></View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.name}>{c.name}</Text>
                <View style={{ flexDirection: "row", gap: 4 }}>{tags.slice(0, 2).map(t => <Tag key={t} tag={t} />)}</View>
              </View>
              <Text style={s.value}>{metric === "ltv" ? fmt(c.totalSpent) : `${c.visits} visitas`}</Text>
            </View>
          );
        })}
        {ranked.length === 0 && <View style={s.empty}><Text style={s.emptyText}>Cadastre clientes para ver o ranking</Text></View>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  toggleRow: { flexDirection: "row", gap: 6, marginBottom: 16 },
  toggle: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  toggleActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  toggleText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  toggleTextActive: { color: Colors.violet3, fontWeight: "600" },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rankBadge: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg4 },
  rankText: { fontSize: 13, fontWeight: "800", color: Colors.ink3 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 12, fontWeight: "700", color: Colors.violet3 },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  value: { fontSize: 14, color: Colors.green, fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 13, color: Colors.ink3 },
});

export default RankingTab;
