import { useState } from "react";
import { View, Text, Pressable, Platform, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { fmtK, fmt } from "../types";
import { Card, SectionTitle, PAL } from "./shared";

var isWeb = Platform.OS === "web";

export function TopCustomers({ data }: { data: any[] }) {
  if (data.length === 0) return null;
  return <Card style={{ marginBottom: 16 }}>
    <SectionTitle title="Clientes mais recorrentes" hint="2 ou mais compras no periodo" />
    {data.slice(0, 10).map(function(c, i) {
      var [h, sH] = useState(false);
      return <Pressable key={i} onHoverIn={isWeb ? function() { sH(true); } : undefined} onHoverOut={isWeb ? function() { sH(false); } : undefined}
        style={[s.custRow, h && { backgroundColor: Colors.bg4 }, i < Math.min(data.length, 10) - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border }, isWeb && { transition: "background-color 0.15s ease" } as any]}>
        <View style={{ flex: 1 }}><Text style={s.custName}>{c.cliente}</Text><Text style={s.custMeta}>{c.compras} compras | Ticket: {fmt(c.ticket_medio)}</Text></View>
        <Text style={s.custTotal}>{fmtK(c.total_gasto)}</Text>
      </Pressable>;
    })}
  </Card>;
}

var s = StyleSheet.create({
  custRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 4, gap: 8, borderRadius: 10 },
  custName: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  custMeta: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  custTotal: { fontSize: 13, color: PAL.green, fontWeight: "700" },
});
