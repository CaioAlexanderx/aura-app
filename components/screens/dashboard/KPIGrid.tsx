import { View, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { KPICard } from "./KPICard";
import { fmtK, fmt } from "./types";

type Props = {
  d: any;
  onNavigate: (path: string) => void;
};

// P0 #9 fix: removed redundant "LUCRO LIQUIDO" KPI (already shown in HeroCard)
export function KPIGrid({ d, onNavigate }: Props) {
  return (
    <View style={s.grid}>
      <KPICard
        ic="dollar" iconColor={Colors.green}
        label="RECEITA DO MES" value={fmtK(d.revenue)}
        delta={d.revenueDelta ? `${d.revenueDelta}% vs anterior` : undefined}
        deltaUp={d.revenueDelta > 0} large
        spark={d.sparkRevenue}
        onPress={() => onNavigate("/financeiro")}
      />
      <KPICard
        ic="trending_down" iconColor={Colors.red}
        label="DESPESAS" value={fmtK(d.expenses)}
        delta={d.expensesDelta ? `${d.expensesDelta}% vs anterior` : undefined}
        deltaUp={false}
        spark={d.sparkExpenses}
        onPress={() => onNavigate("/financeiro")}
      />
      <KPICard ic="bag" iconColor={Colors.violet3} label="VENDAS HOJE" value={fmt(d.salesToday)} onPress={() => onNavigate("/pdv")} />
      <KPICard ic="receipt" iconColor={Colors.amber} label="TICKET MEDIO" value={fmt(d.avgTicket)} onPress={() => onNavigate("/financeiro")} />
      <KPICard ic="user_plus" iconColor={Colors.violet3} label="CLIENTES NOVOS" value={String(d.newCustomers)} onPress={() => onNavigate("/clientes")} />
    </View>
  );
}
const s = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5, marginBottom: 28 },
});
