import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import type { HistoryItem } from "./types";
import { fmt, MOCK_HISTORY } from "./types";

export function PayrollHistory() {
  return (
    <View>
      {MOCK_HISTORY.map(h => (
        <View key={h.id} style={s.row}>
          <View style={s.left}>
            <View style={s.check}><Text style={s.checkText}>OK</Text></View>
            <View style={s.info}><Text style={s.month}>{h.month}</Text><Text style={s.meta}>{h.employees} funcionarios . pago em {h.paidAt}</Text></View>
          </View>
          <View style={s.right}>
            <Text style={s.total}>{fmt(h.total)}</Text>
            <Text style={s.liquid}>Liquido: {fmt(h.liquid)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, flexWrap: "wrap", gap: 8 },
  left: { flexDirection: "row", alignItems: "center", gap: 12 },
  check: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center" },
  checkText: { fontSize: 9, fontWeight: "800", color: Colors.green },
  info: { gap: 2 },
  month: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  meta: { fontSize: 11, color: Colors.ink3 },
  right: { alignItems: "flex-end", gap: 4, flexShrink: 0 },
  total: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  liquid: { fontSize: 11, color: Colors.green },
});

export default PayrollHistory;
