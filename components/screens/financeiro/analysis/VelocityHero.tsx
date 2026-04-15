import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { fmtK, fmt } from "../types";
import { Card, PAL } from "./shared";

export function VelocityHero({ velocity, current, previous }: any) {
  var trend = velocity.tendencia_pct;
  var tColor = trend >= 0 ? PAL.green : PAL.red;
  var marginColor = current.margem_pct >= 20 ? PAL.green : current.margem_pct >= 10 ? PAL.amber : PAL.red;
  return (
    <Card style={{ marginBottom: 16, padding: 22 }}>
      <View style={s.heroRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.heroLabel}>FATURAMENTO DO PERIODO</Text>
          <Text style={[s.heroValue, { color: PAL.green }]}>{fmtK(current.receita)}</Text>
          {velocity.projecao_mes > 0 && <Text style={s.heroSub}>Projecao: {fmtK(velocity.projecao_mes)}</Text>}
        </View>
        <View style={s.velBox}>
          <Text style={s.velLabel}>VELOCIDADE</Text>
          <Text style={[s.velValue, { color: tColor }]}>{fmtK(velocity.media_dia_7d)}/dia</Text>
          <View style={[s.trendBadge, { backgroundColor: trend >= 0 ? Colors.greenD : Colors.redD }]}>
            <Text style={[s.trendText, { color: tColor }]}>{trend >= 0 ? "+" : ""}{trend.toFixed(0)}%</Text>
          </View>
        </View>
      </View>
      <View style={s.heroStrip}>
        <View style={s.stripItem}><Text style={s.stripLabel}>Vendas/dia</Text><Text style={s.stripVal}>{velocity.vendas_por_dia}</Text></View>
        <View style={s.stripItem}><Text style={s.stripLabel}>Ticket medio</Text><Text style={s.stripVal}>{fmt(current.avg_ticket)}</Text></View>
        <View style={s.stripItem}><Text style={s.stripLabel}>Resultado</Text><Text style={[s.stripVal, { color: current.resultado >= 0 ? PAL.green : PAL.red }]}>{current.resultado >= 0 ? "+" : ""}{fmtK(current.resultado)}</Text></View>
        <View style={s.stripItem}><Text style={s.stripLabel}>Margem</Text><Text style={[s.stripVal, { color: marginColor }]}>{current.margem_pct}%</Text></View>
      </View>
    </Card>
  );
}

var s = StyleSheet.create({
  heroRow: { flexDirection: "row", gap: 16 },
  heroLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "600", letterSpacing: 0.8, marginBottom: 4 },
  heroValue: { fontSize: 30, fontWeight: "800", letterSpacing: -1 },
  heroSub: { fontSize: 11, color: Colors.ink3, marginTop: 4 },
  velBox: { alignItems: "flex-end", justifyContent: "center" },
  velLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "600", letterSpacing: 0.8, marginBottom: 2 },
  velValue: { fontSize: 18, fontWeight: "800" },
  trendBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  trendText: { fontSize: 11, fontWeight: "700" },
  heroStrip: { flexDirection: "row", marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  stripItem: { flex: 1, alignItems: "center" },
  stripLabel: { fontSize: 9, color: Colors.ink3, letterSpacing: 0.4, marginBottom: 3 },
  stripVal: { fontSize: 14, fontWeight: "700", color: Colors.ink },
});
