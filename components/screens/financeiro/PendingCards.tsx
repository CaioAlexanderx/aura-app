import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type { Transaction } from "./types";
import { fmt } from "./types";

type Props = { transactions: Transaction[] };

export function PendingCards({ transactions }: Props) {
  var pending = useMemo(function() {
    var receivable = { count: 0, total: 0 };
    var payable = { count: 0, total: 0 };
    transactions.forEach(function(t) {
      if (t.status !== "pending") return;
      if (t.type === "income") { receivable.count++; receivable.total += t.amount; }
      else { payable.count++; payable.total += t.amount; }
    });
    return { receivable: receivable, payable: payable };
  }, [transactions]);

  if (pending.receivable.count === 0 && pending.payable.count === 0) return null;

  return (
    <View style={s.container}>
      <Text style={s.sectionTitle}>Pendentes</Text>
      <View style={s.row}>
        {pending.receivable.count > 0 && (
          <View style={[s.card, s.cardReceivable]}>
            <View style={s.cardIcon}>
              <Icon name="trending_up" size={16} color={Colors.green} />
            </View>
            <View style={s.cardContent}>
              <Text style={s.cardLabel}>A receber</Text>
              <Text style={[s.cardValue, { color: Colors.green }]}>{fmt(pending.receivable.total)}</Text>
              <Text style={s.cardCount}>{pending.receivable.count} lancamento{pending.receivable.count > 1 ? "s" : ""}</Text>
            </View>
          </View>
        )}
        {pending.payable.count > 0 && (
          <View style={[s.card, s.cardPayable]}>
            <View style={s.cardIcon}>
              <Icon name="trending_down" size={16} color={Colors.red} />
            </View>
            <View style={s.cardContent}>
              <Text style={s.cardLabel}>A pagar</Text>
              <Text style={[s.cardValue, { color: Colors.red }]}>{fmt(pending.payable.total)}</Text>
              <Text style={s.cardCount}>{pending.payable.count} lancamento{pending.payable.count > 1 ? "s" : ""}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

var s = StyleSheet.create({
  container: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700", marginBottom: 10 },
  row: { flexDirection: "row", gap: 12 },
  card: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 16, borderWidth: 1 },
  cardReceivable: { backgroundColor: Colors.greenD, borderColor: Colors.green + "33" },
  cardPayable: { backgroundColor: Colors.redD, borderColor: Colors.red + "33" },
  cardIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  cardContent: { flex: 1 },
  cardLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 },
  cardValue: { fontSize: 18, fontWeight: "800", marginTop: 2 },
  cardCount: { fontSize: 10, color: Colors.ink3, marginTop: 2 },
});

export default PendingCards;
