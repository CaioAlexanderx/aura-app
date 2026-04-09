import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// TODO: Wire to GET /companies/:id/employees/ranking when backend supports it
export function SalesRanking() {
  return (
    <View style={s.empty}>
      <Text style={{ fontSize: 32, marginBottom: 8 }}>🏆</Text>
      <Text style={s.emptyTitle}>Ranking de vendas</Text>
      <Text style={s.emptyDesc}>O ranking sera gerado automaticamente quando funcionarios forem vinculados a vendas no PDV.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 32, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  emptyDesc: { fontSize: 13, color: Colors.ink3, textAlign: "center", maxWidth: 300 },
});

export default SalesRanking;
