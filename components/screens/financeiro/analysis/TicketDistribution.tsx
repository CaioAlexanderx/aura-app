import { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { fmtK } from "../types";
import { Card, SectionTitle, BAR_COLORS, cs } from "./shared";

var isWeb = Platform.OS === "web";

export function TicketDistribution({ data }: { data: any[] }) {
  if (data.length === 0) return null;
  var maxV = Math.max.apply(null, data.map(function(d) { return d.vendas; }).concat([1]));
  return <Card style={{ marginBottom: 16 }}>
    <SectionTitle title="Distribuicao de ticket" hint="Faixas de valor das vendas" />
    <View style={{ gap: 6, marginTop: 4 }}>
      {data.map(function(d, i) {
        var [h, sH] = useState(false);
        return <Pressable key={d.faixa} onHoverIn={isWeb ? function() { sH(true); } : undefined} onHoverOut={isWeb ? function() { sH(false); } : undefined}
          style={[cs.dowRow, h && { backgroundColor: Colors.bg4 }, isWeb && { transition: "background-color 0.15s ease" } as any]}>
          <Text style={[cs.dowLabel, { width: 90 }]}>{d.faixa}</Text>
          <View style={cs.dowBarBg}><View style={[cs.dowBarFill, { width: (d.vendas / maxV) * 100 + "%", backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }, isWeb && { transition: "width 0.5s ease" } as any]} /></View>
          <Text style={cs.dowVal}>{d.vendas}</Text>
          {h && <Text style={cs.dowTooltip}>{fmtK(d.faturamento)}</Text>}
        </Pressable>;
      })}
    </View>
  </Card>;
}
