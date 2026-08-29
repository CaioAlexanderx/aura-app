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
      {/* 29/08/2026 — QA de coerencia: este card dizia so "Receita" e a tela
          de Vendas dizia "Receita" pra outro numero (819,40 x 639,50 no mesmo
          mes). Sao coisas diferentes e agora o rotulo diz qual: aqui e o
          dinheiro que ENTROU no caixa (mesma base do "Entrou" do Financeiro),
          incluindo pedidos do Canal Digital e lancamentos manuais; em /vendas
          e "Receita de vendas", so o que saiu pelo Caixa. */}
      <KPICard
        ic="dollar" iconColor={Colors.green}
        label="Receita total" value={fmtK(d.revenue)}
        hint="Vendas + Canal Digital + lançamentos"
        hintLong={"Receita total: todas as entradas confirmadas do mês — vendas do Caixa, pedidos do Canal Digital e lançamentos manuais. É o mesmo número do \"Entrou\" no Financeiro. A tela de Vendas mostra só a parte que passou pelo Caixa."}
        delta={d.revenueDelta ? `${Math.abs(d.revenueDelta)}%` : undefined}
        deltaUp={d.revenueDelta > 0}
        spark={d.sparkRevenue}
        onPress={() => onNavigate("/financeiro")}
      />
      <KPICard
        ic="trending_down" iconColor={Colors.red}
        label="Despesas" value={fmtK(d.expenses)}
        hint="Saídas confirmadas do mês"
        delta={d.expensesDelta ? `${Math.abs(d.expensesDelta)}%` : undefined}
        deltaUp={false}
        spark={d.sparkExpenses}
        onPress={() => onNavigate("/financeiro")}
      />
      <KPICard
        ic="bag" iconColor={Colors.violet3}
        label="Vendas hoje" value={fmt(d.salesToday)}
        hint="Total vendido hoje"
        spark={d.sparkNet}
        onPress={() => onNavigate("/pdv")}
      />
      <KPICard
        ic="receipt" iconColor={Colors.amber}
        label="Ticket médio" value={fmt(d.avgTicket)}
        hint="Média por venda no mês"
        onPress={() => onNavigate("/financeiro")}
      />
      <KPICard
        ic="user_plus" iconColor={Colors.violet3}
        label="Clientes novos" value={fmtInt(d.newCustomers)}
        hint="Novos clientes neste mês"
        onPress={() => onNavigate("/clientes")}
      />
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5, marginBottom: 24 },
});
