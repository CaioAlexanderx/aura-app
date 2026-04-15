import { View, Text, ScrollView, Platform } from "react-native";
import { fmtK } from "../types";
import { Card, SectionTitle, HoverBar, PAL, cs, CHART_H } from "./shared";

export function MonthlyChart({ data }: { data: any[] }) {
  if (data.length === 0) return null;
  var maxVal = Math.max.apply(null, data.map(function(d) { return Math.max(d.receita, d.despesa); }).concat([1]));
  return <Card style={{ marginBottom: 16 }}>
    <SectionTitle title="Receita vs Despesa" hint="Evolucao por periodo" />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", alignItems: "flex-end", gap: 6, paddingVertical: 8, minHeight: CHART_H + 30 }}>
      {data.map(function(d, i) {
        return <View key={i} style={{ alignItems: "center", gap: 4, width: 56 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: CHART_H }}>
            <HoverBar height={d.receita} maxH={maxVal} value={fmtK(d.receita)} label="" color={PAL.violet} width={20} showValue />
            <HoverBar height={d.despesa} maxH={maxVal} value={fmtK(d.despesa)} label="" color={PAL.red + "88"} width={20} />
          </View>
          <Text style={cs.chartLabel}>{d.label}</Text>
        </View>;
      })}
    </ScrollView>
    <View style={cs.legendRow}>
      <View style={cs.legendItem}><View style={[cs.legendDot, { backgroundColor: PAL.violet }]} /><Text style={cs.legendText}>Receita</Text></View>
      <View style={cs.legendItem}><View style={[cs.legendDot, { backgroundColor: PAL.red, opacity: 0.5 }]} /><Text style={cs.legendText}>Despesa</Text></View>
    </View>
  </Card>;
}
