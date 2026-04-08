import { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { EmptyState } from "@/components/EmptyState";
import type { Transaction, DreData } from "./types";
import { fmt } from "./types";

type Props = { transactions: Transaction[]; dreApi: DreData | null };

function CategoryBar({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <View style={s.catRow}>
      <View style={s.catInfo}>
        <Text style={s.catLabel}>{label}</Text>
        <Text style={[s.catAmount, { color }]}>{fmt(amount)}</Text>
      </View>
      <View style={s.catBarTrack}>
        <View style={[s.catBarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[s.catPct, { color }]}>{pct}%</Text>
    </View>
  );
}

function KpiCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiValue, color ? { color } : {}]}>{value}</Text>
      {sub && <Text style={s.kpiSub}>{sub}</Text>}
    </View>
  );
}

export function TabResumo({ transactions, dreApi }: Props) {
  // Compute from transactions if API DRE not available
  const computed = useMemo(() => {
    if (transactions.length === 0) return null;

    const incomeMap: Record<string, number> = {};
    const expenseMap: Record<string, number> = {};
    let totalIncome = 0, totalExpenses = 0;

    transactions.forEach(t => {
      if (t.type === "income") {
        incomeMap[t.category] = (incomeMap[t.category] || 0) + t.amount;
        totalIncome += t.amount;
      } else {
        expenseMap[t.category] = (expenseMap[t.category] || 0) + t.amount;
        totalExpenses += t.amount;
      }
    });

    const incomeItems = Object.entries(incomeMap).sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount }));
    const expenseItems = Object.entries(expenseMap).sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount }));
    const netProfit = totalIncome - totalExpenses;
    const marginPct = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;
    const incomeCount = transactions.filter(t => t.type === "income").length;
    const avgTicket = incomeCount > 0 ? totalIncome / incomeCount : 0;

    return { incomeItems, expenseItems, totalIncome, totalExpenses, netProfit, marginPct, avgTicket, txCount: transactions.length, incomeCount };
  }, [transactions]);

  if (!computed) return <EmptyState icon="receipt" iconColor={Colors.violet3} title="Analise financeira" subtitle="Registre receitas e despesas para visualizar a analise completa com indicadores e comparativos." />;

  const { incomeItems, expenseItems, totalIncome, totalExpenses, netProfit, marginPct, avgTicket, txCount, incomeCount } = computed;

  return (
    <View>
      {/* KPI Row */}
      <View style={s.kpiRow}>
        <KpiCard label="MARGEM" value={`${marginPct}%`} color={marginPct >= 20 ? Colors.green : marginPct >= 0 ? Colors.amber : Colors.red} sub={marginPct >= 30 ? "Saudavel" : marginPct >= 10 ? "Atencao" : "Critico"} />
        <KpiCard label="TICKET MEDIO" value={fmt(avgTicket)} sub={`${incomeCount} vendas`} />
        <KpiCard label="RESULTADO" value={fmt(netProfit)} color={netProfit >= 0 ? Colors.green : Colors.red} sub={netProfit >= 0 ? "Lucro" : "Prejuizo"} />
      </View>

      {/* Resultado card */}
      <View style={s.resultCard}>
        <View style={s.resultRow}>
          <View style={{ flex: 1 }}><Text style={s.resultLabel}>Receitas</Text><Text style={[s.resultValue, { color: Colors.green }]}>{fmt(totalIncome)}</Text></View>
          <Text style={s.resultOp}>-</Text>
          <View style={{ flex: 1 }}><Text style={s.resultLabel}>Despesas</Text><Text style={[s.resultValue, { color: Colors.red }]}>{fmt(totalExpenses)}</Text></View>
          <Text style={s.resultOp}>=</Text>
          <View style={{ flex: 1 }}><Text style={s.resultLabel}>Resultado</Text><Text style={[s.resultValue, { color: netProfit >= 0 ? Colors.green : Colors.red }]}>{fmt(netProfit)}</Text></View>
        </View>
      </View>

      {/* Income breakdown */}
      {incomeItems.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Receitas por categoria</Text>
          <View style={s.sectionCard}>
            {incomeItems.map(item => <CategoryBar key={item.category} label={item.category} amount={item.amount} total={totalIncome} color={Colors.green} />)}
          </View>
        </View>
      )}

      {/* Expense breakdown */}
      {expenseItems.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Despesas por categoria</Text>
          <View style={s.sectionCard}>
            {expenseItems.map(item => <CategoryBar key={item.category} label={item.category} amount={item.amount} total={totalExpenses} color={Colors.red} />)}
          </View>
        </View>
      )}

      <View style={s.disclaimer}><Text style={s.disclaimerText}>Dados calculados a partir dos lancamentos registrados. Valores estimativos para apoio a decisao.</Text></View>
    </View>
  );
}

const s = StyleSheet.create({
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  kpi: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  kpiLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  kpiValue: { fontSize: 20, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  kpiSub: { fontSize: 10, color: Colors.ink3, marginTop: 4 },
  resultCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 20 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, textAlign: "center" },
  resultValue: { fontSize: 16, fontWeight: "800", textAlign: "center" },
  resultOp: { fontSize: 20, color: Colors.ink3, fontWeight: "300" },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700", marginBottom: 10 },
  sectionCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  catRow: { gap: 6 },
  catInfo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  catLabel: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  catAmount: { fontSize: 13, fontWeight: "600" },
  catBarTrack: { height: 8, backgroundColor: Colors.bg4, borderRadius: 4, overflow: "hidden" },
  catBarFill: { height: 8, borderRadius: 4 },
  catPct: { fontSize: 11, fontWeight: "700", textAlign: "right" },
  disclaimer: { padding: 12, backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  disclaimerText: { fontSize: 10, color: Colors.ink3, textAlign: "center", fontStyle: "italic" },
});

export default TabResumo;
