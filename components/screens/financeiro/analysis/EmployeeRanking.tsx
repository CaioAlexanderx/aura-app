import { useState } from "react";
import { View, Text, Pressable, Platform, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { fmtK, fmt } from "../types";
import { Card, SectionTitle, PAL, EMP_COLORS } from "./shared";

var isWeb = Platform.OS === "web";

export function EmployeeRanking({ employees }: { employees: any[] }) {
  if (employees.length === 0) return null;
  return <Card style={{ marginBottom: 16 }}>
    <SectionTitle title="Desempenho por vendedor(a)" />
    {employees.map(function(e, i) {
      var [h, sH] = useState(false);
      return <Pressable key={e.name} onHoverIn={isWeb ? function() { sH(true); } : undefined} onHoverOut={isWeb ? function() { sH(false); } : undefined}
        style={[s.empRow, h && { backgroundColor: Colors.bg4 }, i < employees.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border }, isWeb && { transition: "background-color 0.15s ease" } as any]}>
        <View style={[s.empRank, i === 0 && { backgroundColor: Colors.amberD, borderColor: Colors.amber + "33" }]}>
          <Text style={[s.empRankText, i === 0 && { color: Colors.amber }]}>{i + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.empName}>{e.name}</Text>
          <Text style={s.empMeta}>{e.vendas} vendas | Ticket: {fmt(e.ticket_medio)}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={s.empRev}>{fmtK(e.faturamento)}</Text>
          <View style={s.pctBar}><View style={[s.pctBarFill, { width: e.pct_total + "%", backgroundColor: EMP_COLORS[i % EMP_COLORS.length] }, isWeb && { transition: "width 0.4s ease" } as any]} /></View>
          <Text style={s.empPct}>{e.pct_total}%</Text>
        </View>
      </Pressable>;
    })}
  </Card>;
}

var s = StyleSheet.create({
  empRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 10 },
  empRank: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  empRankText: { fontSize: 11, fontWeight: "700", color: Colors.violet3 },
  empName: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  empMeta: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  empRev: { fontSize: 14, color: PAL.green, fontWeight: "700" },
  empPct: { fontSize: 9, color: Colors.ink3, marginTop: 2 },
  pctBar: { width: 60, height: 5, borderRadius: 3, backgroundColor: Colors.bg4, marginTop: 3, overflow: "hidden" },
  pctBarFill: { height: 5, borderRadius: 3 },
});
