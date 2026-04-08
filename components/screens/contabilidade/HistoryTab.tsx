import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

const HISTORY = [
  { id: "c1", name: "DAS-MEI", month: "Mar/26", date: "18/03", amount: 76.90 },
  { id: "c2", name: "FGTS", month: "Mar/26", date: "05/03", amount: 320 },
  { id: "c3", name: "DAS-MEI", month: "Fev/26", date: "18/02", amount: 76.90 },
  { id: "c4", name: "FGTS", month: "Fev/26", date: "06/02", amount: 320 },
  { id: "c5", name: "DAS-MEI", month: "Jan/26", date: "19/01", amount: 76.90 },
];

const STREAK = { current: 3, best: 5, total: 12 };
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export function HistoryTab() {
  return (
    <View>
      {/* Streak */}
      <View style={s.streakCard}>
        <Text style={s.streakTitle}>Sequencia de conformidade</Text>
        <View style={s.months}>
          {MONTHS.map((m, i) => {
            const active = i < STREAK.current;
            return (
              <View key={m} style={s.monthItem}>
                <View style={[s.monthCircle, active && s.monthCircleActive]}>
                  <Text style={[s.monthIcon, active && s.monthIconActive]}>{active ? "OK" : "?"}</Text>
                </View>
                <Text style={[s.monthLabel, active && { color: Colors.green }]}>{m}</Text>
              </View>
            );
          })}
        </View>
        <View style={s.streakRow}>
          {[[STREAK.current, "Atual", Colors.green], [STREAK.best, "Recorde", Colors.amber], [STREAK.total, "Total", Colors.green]].map(([v, l, c]) => (
            <View key={l as string} style={s.streakStat}>
              <Text style={[s.streakVal, { color: c as string }]}>{v}</Text>
              <Text style={s.streakLabel}>{l}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* History */}
      <Text style={s.histTitle}>Concluidas recentemente</Text>
      <View style={s.histCard}>
        {HISTORY.map(h => (
          <View key={h.id} style={s.histRow}>
            <View style={s.histDot}><Text style={s.histDotText}>OK</Text></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.histName}>{h.name}</Text>
              <Text style={s.histMeta}>{h.month} - {h.date}</Text>
            </View>
            <Text style={s.histAmount}>{fmt(h.amount)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  streakCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 24 },
  streakTitle: { fontSize: 16, color: Colors.ink, fontWeight: "700", marginBottom: 16, textAlign: "center" },
  months: { flexDirection: "row", justifyContent: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" },
  monthItem: { alignItems: "center", gap: 6 },
  monthCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colors.border },
  monthCircleActive: { backgroundColor: Colors.greenD, borderColor: Colors.green },
  monthIcon: { fontSize: 11, fontWeight: "800", color: Colors.ink3 },
  monthIconActive: { color: Colors.green },
  monthLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "600" },
  streakRow: { flexDirection: "row", gap: 12 },
  streakStat: { flex: 1, alignItems: "center", backgroundColor: Colors.bg4, borderRadius: 10, padding: 12 },
  streakVal: { fontSize: 22, fontWeight: "800" },
  streakLabel: { fontSize: 10, color: Colors.ink3, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  histTitle: { fontSize: 15, color: Colors.ink, fontWeight: "700", marginBottom: 12 },
  histCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  histRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  histDot: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center" },
  histDotText: { fontSize: 9, fontWeight: "800", color: Colors.green },
  histName: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  histMeta: { fontSize: 11, color: Colors.ink3 },
  histAmount: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
});

export default HistoryTab;
