import { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { fmtK, fmt } from "../types";
import { Card, SectionTitle, PAL, cs } from "./shared";

var isWeb = Platform.OS === "web";

export function DayOfWeekChart({ data, insights }: { data: any[]; insights: any }) {
  if (data.length === 0) return null;
  var maxFat = Math.max.apply(null, data.map(function(d) { return d.faturamento; }).concat([1]));
  return <Card style={{ marginBottom: 16 }}>
    <SectionTitle title="Vendas por dia da semana" hint={insights.melhor_dia_semana ? "Melhor dia: " + insights.melhor_dia_semana + " | Mais fraco: " + insights.pior_dia_semana : undefined} />
    <View style={{ gap: 6, marginTop: 4 }}>
      {data.map(function(d) {
        var pct = (d.faturamento / maxFat) * 100;
        var isTop = d.label === insights.melhor_dia_semana;
        var [h, sH] = useState(false);
        return <Pressable key={d.dow} onHoverIn={isWeb ? function() { sH(true); } : undefined} onHoverOut={isWeb ? function() { sH(false); } : undefined}
          style={[cs.dowRow, h && { backgroundColor: Colors.bg4 }, isWeb && { transition: "background-color 0.15s ease" } as any]}>
          <Text style={[cs.dowLabel, isTop && { color: PAL.violet3, fontWeight: "700" }]}>{d.label}</Text>
          <View style={cs.dowBarBg}>
            <View style={[cs.dowBarFill, { width: pct + "%", backgroundColor: isTop ? PAL.violet : PAL.violet2 + "55" }, isWeb && { transition: "width 0.5s ease" } as any]} />
          </View>
          <Text style={cs.dowVal}>{d.vendas}</Text>
          <Text style={[cs.dowVal, { color: PAL.green, minWidth: 70, textAlign: "right" }]}>{fmtK(d.faturamento)}</Text>
          {h && <Text style={cs.dowTooltip}>Ticket: {fmt(d.ticket_medio)}</Text>}
        </Pressable>;
      })}
    </View>
  </Card>;
}
