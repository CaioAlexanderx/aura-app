import { View, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { KPICard } from "./KPICard";
import { fmtK, fmt, fmtInt, IS_WIDE } from "./types";

type Props = {
  d: any;
  onNavigate: (path: string) => void;
};

export function KPIGrid({ d, onNavigate }: Props) {
  return (
    <View style={s.grid}>
      <KPICard
        ic="dollar" iconColor={Colors.green}
        label="Receita" value={fmtK(d.revenue)}
        delta={d.revenueDelta ? `${Math.abs(d.revenueDelta)}%` : undefined}
        deltaUp={d.revenueDelta > 0}
        spark={d.sparkRevenue}
        onPress={() => onNavigate("/financeiro")}
      />
      <KPICard
        ic="trending_down" iconColor={Colors.red}
        label="Despesas" value={fmtK(d.expenses)}
        delta={d.expensesDelta ? `${Math.abs(d.expensesDelta)}%` : undefined}
        deltaUp={false}
        spark={d.sparkExpenses}
        onPress={() => onNavigate("/financeiro")}
      />
      <KPICard
        ic="bag" iconColor={Colors.violet3}
        label="Vendas hoje" value={fmt(d.salesToday)}
        spark={d.sparkNet}
        onPress={() => onNavigate("/pdv")}
      />
      <KPICard
        ic="receipt" iconColor={Colors.amber}
        label="Ticket medio" value={fmt(d.avgTicket)}
        onPress={() => onNavigate("/financeiro")}
      />
      <KPICard
        ic="user_plus" iconColor={Colors.violet3}
        label="Clientes novos" value={fmtInt(d.newCustomers)}
        onPress={() => onNavigate("/clientes")}
      />
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5, marginBottom: 24 },
});
