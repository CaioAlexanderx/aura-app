import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { EmptyState } from "@/components/EmptyState";
import type { DreData } from "./types";
import { fmt } from "./types";

function DreSection({ title, items, color, total, totalLabel }: { title: string; items: { category: string; amount: number }[]; color: string; total: number; totalLabel: string }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {items.map(item => <View key={item.category} style={s.row}><Text style={s.cat}>{item.category}</Text><Text style={[s.amt, { color }]}>{fmt(item.amount)}</Text></View>)}
      <View style={s.totalRow}><Text style={s.totalLabel}>{totalLabel}</Text><Text style={[s.totalAmt, { color }]}>{fmt(total)}</Text></View>
    </View>
  );
}

export function TabResumo({ data }: { data: DreData | null }) {
  if (!data) return <EmptyState icon="receipt" iconColor={Colors.violet3} title="Resumo financeiro (DRE)" subtitle="O resumo sera gerado automaticamente conforme voce registrar receitas e despesas." />;

  return (
    <View>
      <View style={s.summaryRow}>
        {[["RECEITA", data.totalIncome, Colors.green], ["DESPESAS", data.totalExpenses, Colors.red], ["LUCRO", data.netProfit, data.netProfit >= 0 ? Colors.green : Colors.red], ["MARGEM", data.marginPct, undefined]].map(([l, v, c]) =>
          <View key={l as string} style={s.card}><Text style={s.cardLabel}>{l as string}</Text><Text style={[s.cardValue, c ? { color: c as string } : {}]}>{typeof v === "number" && (l as string) !== "MARGEM" ? fmt(v as number) : v + "%"}</Text></View>
        )}
      </View>
      <View style={s.listCard}>
        <Text style={s.periodLabel}>{data.period}</Text>
        <DreSection title="Receitas" items={data.income} color={Colors.green} total={data.totalIncome} totalLabel="Total receitas" />
        <DreSection title="Despesas" items={data.expenses} color={Colors.red} total={data.totalExpenses} totalLabel="Total despesas" />
        <View style={s.profitRow}><Text style={s.profitLabel}>Resultado liquido</Text><Text style={[s.profitValue, { color: data.netProfit >= 0 ? Colors.green : Colors.red }]}>{fmt(data.netProfit)}</Text></View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  summaryRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: 20 },
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, flex: 1, minWidth: 140, margin: 4 },
  cardLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  cardValue: { fontSize: 20, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  periodLabel: { fontSize: 11, color: Colors.violet3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16, paddingHorizontal: 10 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 12, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, paddingHorizontal: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cat: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  amt: { fontSize: 13, fontWeight: "600" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 10, backgroundColor: Colors.bg4, borderRadius: 8, marginTop: 4 },
  totalLabel: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  totalAmt: { fontSize: 14, fontWeight: "800" },
  profitRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 14, backgroundColor: Colors.violetD, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: Colors.border2 },
  profitLabel: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  profitValue: { fontSize: 18, fontWeight: "800" },
});

export default TabResumo;
