import { View, Text } from "react-native";
import { fmtK, fmt } from "../types";
import { Card, SectionTitle, PAL, cs } from "./shared";

export function InsightsBlock({ insights, velocity, current, employees }: any) {
  if (!insights) return null;
  var items: string[] = [];
  if (velocity?.projecao_mes > 0) items.push("Projecao para o mes: " + fmtK(velocity.projecao_mes) + " baseado na velocidade de " + fmtK(velocity.media_dia_7d) + "/dia.");
  if (velocity?.tendencia_pct > 10) items.push("Velocidade de vendas acelerou " + velocity.tendencia_pct.toFixed(0) + "% na ultima semana em relacao a media de 30 dias.");
  if (velocity?.tendencia_pct < -10) items.push("Velocidade de vendas caiu " + Math.abs(velocity.tendencia_pct).toFixed(0) + "%. Avaliar acoes de marketing ou promocoes.");
  if (insights.melhor_dia_semana) items.push(insights.melhor_dia_semana + " e o melhor dia de vendas. Reforce equipe e estoque.");
  if (insights.best_month) items.push("Melhor mes: " + insights.best_month.label + " com " + fmtK(insights.best_month.receita) + ".");
  if (employees?.length >= 2) items.push(employees[0].name + " lidera com " + employees[0].pct_total + "% do faturamento (" + employees[0].vendas + " vendas).");
  if (insights.ticket_medio_geral > 0) items.push("Ticket medio geral: " + fmt(insights.ticket_medio_geral) + ".");
  if (current?.margem_pct > 0 && current.margem_pct < 15) items.push("Margem de " + current.margem_pct + "% esta apertada. Revisar custos.");
  if (items.length === 0) return null;
  return <Card style={{ marginBottom: 16, borderColor: PAL.violet + "33" }}>
    <SectionTitle title="Insights automaticos" />
    {items.map(function(t, i) { return <View key={i} style={cs2.insightRow}><View style={cs2.insightDot} /><Text style={cs2.insightText}>{t}</Text></View>; })}
  </Card>;
}

import { StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
var cs2 = StyleSheet.create({
  insightRow: { flexDirection: "row", gap: 10, marginTop: 8, alignItems: "flex-start" },
  insightDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: PAL.violet, marginTop: 7, flexShrink: 0 },
  insightText: { fontSize: 12, color: Colors.ink3, lineHeight: 20, flex: 1 },
});
