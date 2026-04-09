import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import type { HistoryItem } from "./types";
import { fmt } from "./types";

// TODO: Wire to GET /companies/:id/payroll/history when backend supports it
export function PayrollHistory() {
  return (
    <View style={s.empty}>
      <Text style={{ fontSize: 32, marginBottom: 8 }}>📊</Text>
      <Text style={s.emptyTitle}>Historico de folha</Text>
      <Text style={s.emptyDesc}>O historico sera gerado automaticamente a partir da primeira folha processada.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 32, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  emptyDesc: { fontSize: 13, color: Colors.ink3, textAlign: "center", maxWidth: 300 },
});

export default PayrollHistory;
