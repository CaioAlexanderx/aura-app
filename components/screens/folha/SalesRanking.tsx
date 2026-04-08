import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import type { RankingItem } from "./types";
import { fmt, MOCK_RANKING } from "./types";

export function SalesRanking() {
  const medals = ["1", "2", "3"];
  return (
    <View>
      <View style={s.header}>
        <Text style={s.ht}>Ranking de vendas - {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</Text>
        <Text style={s.hs}>Baseado nas vendas registradas no Caixa (PDV)</Text>
      </View>
      {MOCK_RANKING.map((emp, idx) => {
        const isTop = idx === 0;
        return (
          <View key={emp.empId} style={[s.card, isTop && s.cardTop]}>
            <View style={s.row}>
              <View style={[s.pos, isTop && s.posTop]}><Text style={[s.posText, isTop && { color: "#fff" }]}>{medals[idx] || idx + 1}</Text></View>
              <View style={s.info}><Text style={s.name}>{emp.name}</Text><Text style={s.role}>{emp.role}</Text></View>
              <View style={s.stats}><Text style={[s.revenue, isTop && { color: Colors.green }]}>{fmt(emp.revenue)}</Text><Text style={s.salesCount}>{emp.sales} vendas</Text></View>
            </View>
            <View style={s.metrics}>
              <View style={s.metric}><Text style={s.ml}>Ticket medio</Text><Text style={s.mv}>{fmt(emp.avgTicket)}</Text></View>
              <View style={s.metric}><Text style={s.ml}>Mais vendido</Text><Text style={s.mv}>{emp.topProduct}</Text></View>
              <View style={s.metric}><Text style={s.ml}>Tendencia</Text><Text style={[s.mv, { color: emp.trend === "up" ? Colors.green : Colors.red }]}>{emp.trend === "up" ? "Subindo" : "Caindo"}</Text></View>
            </View>
          </View>
        );
      })}
      <View style={s.note}><Text style={s.noteText}>Ranking atualizado automaticamente com base nas vendas do Caixa</Text></View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 16 },
  ht: { fontSize: 16, color: Colors.ink, fontWeight: "700" },
  hs: { fontSize: 12, color: Colors.ink3, marginTop: 4 },
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  cardTop: { borderColor: Colors.violet, borderWidth: 1.5, backgroundColor: Colors.violetD },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  pos: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  posTop: { backgroundColor: Colors.violet },
  posText: { fontSize: 16, fontWeight: "800", color: Colors.ink },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  role: { fontSize: 11, color: Colors.ink3 },
  stats: { alignItems: "flex-end", gap: 2 },
  revenue: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  salesCount: { fontSize: 11, color: Colors.ink3 },
  metrics: { flexDirection: "row", gap: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border, flexWrap: "wrap" },
  metric: { flex: 1, minWidth: 90, gap: 2 },
  ml: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  mv: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  note: { paddingVertical: 12, paddingHorizontal: 4 },
  noteText: { fontSize: 11, color: Colors.ink3, fontStyle: "italic" },
});

export default SalesRanking;
