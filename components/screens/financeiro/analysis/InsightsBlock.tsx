import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { fmtK, fmt } from "../types";
import { Card, SectionTitle, PAL } from "./shared";

export function InsightsBlock({ insights, velocity, current, employees }: any) {
  if (!insights) return null;
  var items: { text: string; icon: string }[] = [];

  if (velocity?.projecao_mes > 0) items.push({ text: "Projecao para o mes: " + fmtK(velocity.projecao_mes) + ", baseado na velocidade de " + fmtK(velocity.media_dia_7d) + "/dia.", icon: "trend" });
  if (velocity?.tendencia_pct > 10) items.push({ text: "Vendas aceleraram " + velocity.tendencia_pct.toFixed(0) + "% na ultima semana. Aproveite o momento para aumentar estoque.", icon: "up" });
  if (velocity?.tendencia_pct < -10) items.push({ text: "Vendas desaceleraram " + Math.abs(velocity.tendencia_pct).toFixed(0) + "%. Considere promocoes ou acoes nas redes sociais.", icon: "down" });
  if (insights.melhor_dia_semana) items.push({ text: insights.melhor_dia_semana + " e seu melhor dia. Priorize equipe completa e estoque abastecido.", icon: "star" });
  if (insights.best_month) items.push({ text: "Melhor mes: " + insights.best_month.label + " com " + fmtK(insights.best_month.receita) + " em faturamento.", icon: "trophy" });
  if (employees?.length >= 2) items.push({ text: employees[0].name.split(" ")[0] + " lidera com " + employees[0].pct_total + "% do faturamento (" + employees[0].vendas + " vendas).", icon: "person" });
  if (insights.ticket_medio_geral > 0) items.push({ text: "Ticket medio geral: " + fmt(insights.ticket_medio_geral) + ". Para aumentar, sugira combos ou produtos complementares.", icon: "money" });
  if (current?.margem_pct > 0 && current.margem_pct < 15) items.push({ text: "Margem de " + current.margem_pct + "% esta apertada. Revise custos fixos e negocie com fornecedores.", icon: "alert" });

  if (items.length === 0) return null;
  return <Card style={{ marginBottom: 16, borderColor: PAL.violet + "33" }}>
    <SectionTitle title="Insights e sugestoes" hint="Baseado nos seus dados reais" />
    {items.map(function(item, i) {
      return <View key={i} style={s.insightRow}>
        <View style={s.insightDot} />
        <Text style={s.insightText}>{item.text}</Text>
      </View>;
    })}
  </Card>;
}

var s = StyleSheet.create({
  insightRow: { flexDirection: "row", gap: 10, marginTop: 8, alignItems: "flex-start" },
  insightDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: PAL.violet, marginTop: 7, flexShrink: 0 },
  insightText: { fontSize: 12, color: Colors.ink3, lineHeight: 20, flex: 1 },
});
