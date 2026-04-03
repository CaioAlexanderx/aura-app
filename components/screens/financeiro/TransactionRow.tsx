// Extracted from financeiro.tsx — FE-03 refactor
import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, TextInput, Platform } from "react-native";
import { Colors } from "@/constants/colors";

// Props type (customize as needed)
interface TransactionRowProps {
  [key: string]: any;
}

export function TransactionRow({ item }: { item: typeof MOCK_TRANSACTIONS[0] }) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  const isIncome = item.type === "income";
  return (
    <Pressable
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[
        tr.row,
        hovered && { backgroundColor: Colors.bg4 },
        isWeb && { transition: "background-color 0.15s ease" } as any,
      ]}
    >
      <View style={tr.left}>
        <View style={[tr.dot, { backgroundColor: isIncome ? Colors.green : Colors.red }]} />
        <View>
          <Text style={tr.desc}>{item.desc}</Text>
          <Text style={tr.meta}>{item.date} / {item.category}{item.source && item.source !== "manual" ? " / " + (item.source === "pdv" ? "PDV" : item.source === "folha" ? "Folha" : item.source === "estoque" ? "Estoque" : item.source === "lote" ? "Lote" : "") : ""}{item.status === "pending" ? " / Pendente" : ""}</Text>
        </View>
      </View>
      <Text style={[tr.amount, { color: isIncome ? Colors.green : Colors.red }]}>
        {isIncome ? "+" : "-"}{fmt(item.amount)}
      </Text>
    </Pressable>
  );
}

const tr = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  desc: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  meta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  amount: { fontSize: 14, fontWeight: "600" },
});
