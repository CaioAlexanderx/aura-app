import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { fmt } from "./types";

export function SaleRow({ customer, amount, time, method, type }: {
  customer: string; amount: number; time: string; method?: string; type?: string;
}) {
  const isExpense = type === "expense";
  const color = isExpense ? Colors.red : Colors.green;
  const icon = isExpense ? "trending_down" : "trending_up";
  const prefix = isExpense ? "-" : "+";
  return (
    <View style={s.row}>
      <View style={s.left}>
        <View style={[s.iconWrap, { backgroundColor: color + "18" }]}>
          <Icon name={icon as any} size={14} color={color} />
        </View>
        <View>
          <Text style={s.nm}>{customer}</Text>
          <Text style={s.tm}>{time}{method ? (" / " + method) : ""}</Text>
        </View>
      </View>
      <Text style={[s.am, { color }]}>{prefix}{fmt(amount)}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  left: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  nm: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  tm: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  am: { fontSize: 13, fontWeight: "600" },
});
