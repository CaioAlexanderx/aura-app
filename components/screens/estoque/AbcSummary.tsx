import { View, Text, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import type { Product } from "./types";
import { DonutChart } from "@/components/screens/financeiro/TabResumo";

const ABC_COLORS = ["#10b981", "#fbbf24", "#6b7280"];
const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function AbcBadge({ abc }: { abc: "A" | "B" | "C" }) {
  const colors = { A: Colors.green, B: Colors.amber, C: Colors.ink3 };
  const bgs = { A: Colors.greenD, B: Colors.amberD, C: "rgba(255,255,255,0.05)" };
  return <View style={[s.badge, { backgroundColor: bgs[abc] }]}><Text style={[s.badgeText, { color: colors[abc] }]}>{abc}</Text></View>;
}

export function AbcSummary({ products }: { products: Product[] }) {
  const groups = { A: products.filter(p => p.abc === "A"), B: products.filter(p => p.abc === "B"), C: products.filter(p => p.abc === "C") };
  const total30d = products.reduce((s, p) => s + p.sold30d, 0);
  const totalRevenue = products.reduce((s, p) => s + p.price * p.sold30d, 0);
  const clrs = { A: Colors.green, B: Colors.amber, C: Colors.ink3 };
  const labels = { A: "Alta rotatividade", B: "Rotatividade media", C: "Baixa rotatividade" };

  // P-04: Donut chart data
  const donutItems = (["A", "B", "C"] as const)
    .map(g => ({ category: `Curva ${g}`, amount: groups[g].reduce((s, p) => s + p.price * p.sold30d, 0) }))
    .filter(d => d.amount > 0);

  return (
    <View style={{ gap: 16 }}>
      {/* P-04: Donut overview */}
      {donutItems.length > 0 && totalRevenue > 0 && (
        <View style={s.donutCard}>
          <Text style={s.donutTitle}>Distribuicao por curva</Text>
          <View style={s.donutRow}>
            <DonutChart items={donutItems} total={totalRevenue} colorFn={(i) => ABC_COLORS[i % ABC_COLORS.length]} />
            <View style={s.donutLegend}>
              {donutItems.map((d, i) => {
                const pct = totalRevenue > 0 ? Math.round((d.amount / totalRevenue) * 100) : 0;
                return (
                  <View key={d.category} style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: ABC_COLORS[i] }]} />
                    <View style={{ flex: 1 }}><Text style={s.legendLabel}>{d.category}</Text><Text style={s.legendValue}>{fmt(d.amount)} ({pct}%)</Text></View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {(["A", "B", "C"] as const).map(grade => {
        const items = groups[grade];
        const sold = items.reduce((s, p) => s + p.sold30d, 0);
        const rev = items.reduce((s, p) => s + p.price * p.sold30d, 0);
        const pctSold = total30d > 0 ? (sold / total30d * 100).toFixed(0) : "0";
        const pctRev = totalRevenue > 0 ? (rev / totalRevenue * 100).toFixed(0) : "0";
        return (
          <View key={grade} style={s.group}>
            <View style={s.header}><AbcBadge abc={grade} /><View style={{ flex: 1 }}><Text style={s.title}>Curva {grade} - {items.length} produtos</Text><Text style={s.hint}>{labels[grade]}</Text></View></View>
            <View style={{ gap: 8 }}>
              {[{ l: "Vendas", p: pctSold }, { l: "Receita", p: pctRev }].map(b => (
                <View key={b.l} style={s.barRow}><Text style={s.barLabel}>{b.l}</Text><View style={s.track}><View style={[s.fill, { width: `${b.p}%`, backgroundColor: clrs[grade] }]} /></View><Text style={[s.pct, { color: clrs[grade] }]}>{b.p}%</Text></View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  badge: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 12, fontWeight: "800" },
  group: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  title: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  hint: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { fontSize: 10, color: Colors.ink3, width: 50 },
  track: { flex: 1, height: 8, backgroundColor: Colors.bg4, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  pct: { fontSize: 11, fontWeight: "700", width: 36, textAlign: "right" },
  donutCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
  donutTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700", marginBottom: 14 },
  donutRow: { flexDirection: "row", alignItems: "center", gap: 24 },
  donutLegend: { flex: 1, gap: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  legendValue: { fontSize: 11, color: Colors.ink3 },
});

export default AbcSummary;
