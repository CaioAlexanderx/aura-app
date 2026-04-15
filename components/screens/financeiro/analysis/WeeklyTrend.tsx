import { View, Text, ScrollView, Platform } from "react-native";
import { fmtK } from "../types";
import { Card, SectionTitle, HoverBar, PAL, CHART_H } from "./shared";

export function WeeklyTrend({ data }: { data: any[] }) {
  if (data.length < 3) return null;
  var maxF = Math.max.apply(null, data.map(function(d) { return d.faturamento; }).concat([1]));
  return <Card style={{ marginBottom: 16 }}>
    <SectionTitle title="Tendencia semanal" hint="Faturamento por semana" />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", alignItems: "flex-end", gap: 4, paddingVertical: 8, minHeight: CHART_H - 30 }}>
      {data.map(function(w, i) {
        return <HoverBar key={i} height={w.faturamento} maxH={maxF} value={fmtK(w.faturamento) + " (" + w.vendas + " vendas)"} label={w.semana} color={PAL.violet} width={48} showValue />;
      })}
    </ScrollView>
  </Card>;
}
