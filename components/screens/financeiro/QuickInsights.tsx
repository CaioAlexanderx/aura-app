import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import type { Transaction } from "./types";
import { fmt } from "./types";

type Props = { transactions: Transaction[]; income: number; expenses: number };

export function QuickInsights({ transactions, income, expenses }: Props) {
  const insights: { text: string; color: string; icon: string }[] = [];
  const balance = income - expenses;

  if (transactions.length === 0) {
    insights.push({ text: "Comece lancando suas receitas e despesas para receber insights personalizados.", color: Colors.violet3, icon: "i" });
    return <InsightCards insights={insights} />;
  }

  // Insight 1: Balance health
  if (balance > 0 && income > 0) {
    const margin = Math.round((balance / income) * 100);
    if (margin >= 30) {
      insights.push({ text: `Margem de ${margin}% — seu negocio esta gerando sobra saudavel para investir ou reservar.`, color: Colors.green, icon: "+" });
    } else if (margin >= 10) {
      insights.push({ text: `Margem de ${margin}% — razoavel, mas fique de olho nas despesas para nao comprimir.`, color: Colors.amber, icon: "!" });
    } else {
      insights.push({ text: `Margem de apenas ${margin}% — suas despesas estao muito proximas da receita.`, color: Colors.red, icon: "!" });
    }
  } else if (balance <= 0) {
    insights.push({ text: `Despesas superaram receitas em ${fmt(Math.abs(balance))}. Revise custos ou aumente vendas.`, color: Colors.red, icon: "!" });
  }

  // Insight 2: Top category
  const catMap: Record<string, number> = {};
  transactions.filter(t => t.type === "expense").forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
  if (topCat && expenses > 0) {
    const pct = Math.round((topCat[1] / expenses) * 100);
    insights.push({ text: `"${topCat[0]}" representa ${pct}% das suas despesas (${fmt(topCat[1])}).`, color: Colors.amber, icon: "$" });
  }

  // Insight 3: Transaction volume
  const incomeCount = transactions.filter(t => t.type === "income").length;
  const expenseCount = transactions.filter(t => t.type === "expense").length;
  if (incomeCount > 0 && expenseCount > 0) {
    insights.push({ text: `${incomeCount} entradas e ${expenseCount} saidas registradas. Ticket medio de entrada: ${fmt(income / incomeCount)}.`, color: Colors.violet3, icon: "#" });
  } else if (incomeCount > 0) {
    insights.push({ text: `${incomeCount} receitas registradas, nenhuma despesa. Lembre-se de registrar custos para ter uma visao real.`, color: Colors.amber, icon: "!" });
  }

  return <InsightCards insights={insights} />;
}

function InsightCards({ insights }: { insights: { text: string; color: string; icon: string }[] }) {
  return (
    <View style={s.container}>
      <Text style={s.title}>Insights</Text>
      {insights.map((ins, i) => (
        <View key={i} style={s.card}>
          <View style={[s.iconWrap, { backgroundColor: ins.color + "18" }]}>
            <Text style={[s.icon, { color: ins.color }]}>{ins.icon}</Text>
          </View>
          <Text style={s.text}>{ins.text}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 8, marginBottom: 20 },
  title: { fontSize: 14, color: Colors.ink, fontWeight: "700", marginBottom: 4 },
  card: { flexDirection: "row", gap: 12, backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "flex-start" },
  iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  icon: { fontSize: 14, fontWeight: "800" },
  text: { fontSize: 12, color: Colors.ink3, lineHeight: 18, flex: 1 },
});

export default QuickInsights;
