import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import type { Transaction } from "./types";
import { fmt } from "./types";

// TIMEZONE FIX: due_date eh uma string 'YYYY-MM-DD' (date-only).
// new Date('2026-04-16') em JS interpreta como UTC midnight.
// No browser em SP (UTC-3) isso vira 15/04 21:00 local -> exibia D-1.
// Solucao: renderizar due_date em timezone UTC pra preservar o dia.
// created_at e timestamptz - renderizar em America/Sao_Paulo.
function formatDate(item: Transaction): string {
  const due = (item as any).due_date;
  if (due) {
    try {
      return new Date(due).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        timeZone: "UTC",
      });
    } catch {}
  }
  const created = (item as any).created_at;
  if (created) {
    try {
      return new Date(created).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        timeZone: "America/Sao_Paulo",
      });
    } catch {}
  }
  return item.date || "---";
}

export function TransactionRow({ item, onDelete }: { item: Transaction; onDelete?: (id: string) => void }) {
  const [h, sH] = useState(false);
  const w = Platform.OS === "web";
  const isIncome = item.type === "income";
  const sourceLabel = item.source === "pdv" ? "PDV" : item.source === "folha" ? "Folha" : item.source === "lote" ? "Lote" : "";
  const dateStr = formatDate(item);
  const isPending = item.status === "pending";

  return (
    <Pressable onHoverIn={w ? () => sH(true) : undefined} onHoverOut={w ? () => sH(false) : undefined}
      style={[s.row, h && { backgroundColor: Colors.bg4 }, w && { transition: "background-color 0.15s ease" } as any]}>
      <View style={s.left}>
        <View style={[s.dot, { backgroundColor: isIncome ? Colors.green : Colors.red }]} />
        <View style={{ flex: 1 }}>
          <Text style={s.desc} numberOfLines={1}>{item.desc}</Text>
          <Text style={s.meta}>
            {dateStr} / {item.category}{sourceLabel ? " / " + sourceLabel : ""}{isPending ? " / Pendente" : ""}
          </Text>
        </View>
      </View>
      <View style={s.right}>
        <Text style={[s.amount, { color: isIncome ? Colors.green : Colors.red }]}>
          {isIncome ? "+" : "-"}{fmt(item.amount)}
        </Text>
        {onDelete && <Pressable onPress={() => onDelete(item.id)} style={s.deleteBtn} hitSlop={8}><Text style={s.deleteText}>x</Text></Pressable>}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  desc: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  meta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  amount: { fontSize: 14, fontWeight: "600" },
  deleteBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.redD, alignItems: "center", justifyContent: "center" },
  deleteText: { fontSize: 11, color: Colors.red, fontWeight: "700" },
});

export default TransactionRow;
