import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/api";
import { IS_WIDE, fmt } from "@/constants/helpers";
import { HoverCard } from "@/components/HoverCard";
import { useAuthStore } from "@/stores/auth";

export function FinanceiroAdmin() {
  const { token, isStaff } = useAuthStore();
  const { data: apiDash } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => adminApi.dashboard(),
    enabled: !!token && isStaff,
    staleTime: 30000,
  });

  const mrrEstimated = apiDash?.mrr?.estimated || 0;
  // null = mês sem custo lançado (backend t2-21): nunca mostrar como R$ 0
  const semCusto = !!apiDash && (apiDash.costs?.current_month == null || apiDash.gross_margin?.estimated == null);
  const totalCosts = apiDash?.costs?.current_month ?? 0;
  const grossMargin = apiDash?.gross_margin?.estimated ?? 0;

  return (
    <View>
      <View style={{ flexDirection: IS_WIDE ? "row" : "column", gap: 12 }}>
        <HoverCard style={[s.card, { flex: 1 }]}>
          <Text style={s.ct}>Receita recorrente</Text>
          <Text style={[s.big, { color: Colors.green }]}>{fmt(mrrEstimated)}</Text>
          <Text style={s.hint}>MRR estimado baseado nos planos ativos</Text>
        </HoverCard>
        <HoverCard style={[s.card, { flex: 1 }]}>
          <Text style={s.ct}>Custos operacionais</Text>
          <Text style={[s.big, semCusto ? s.bigMuted : { color: Colors.amber }]}>{semCusto ? "sem custo lançado" : fmt(totalCosts)}</Text>
          <Text style={s.hint}>{semCusto ? "Lance os custos do mês em Painel, Lançar custo do mês" : "Total de custos no mês atual"}</Text>
        </HoverCard>
        <HoverCard style={[s.card, { flex: 1 }]}>
          <Text style={s.ct}>Margem bruta</Text>
          <Text style={[s.big, semCusto ? s.bigMuted : { color: grossMargin >= 0 ? Colors.green : Colors.red }]}>{semCusto ? "sem custo lançado" : fmt(grossMargin)}</Text>
          <Text style={s.hint}>{semCusto ? "Sem custo não há margem" : "Receita do snapshot - custos"}</Text>
        </HoverCard>
      </View>
      <HoverCard style={s.card}>
        <Text style={s.ct}>Projeção anual</Text>
        <Text style={[s.big, { color: Colors.violet3 }]}>{fmt(mrrEstimated * 12)}</Text>
        <Text style={s.hint}>Baseado no MRR atual de {fmt(mrrEstimated)}</Text>
      </HoverCard>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  ct: { fontSize: 15, fontWeight: "700", color: Colors.ink, marginBottom: 14 },
  big: { fontSize: 28, fontWeight: "800", marginBottom: 4 },
  bigMuted: { fontSize: 16, fontWeight: "700", color: Colors.ink3, paddingVertical: 6 },
  hint: { fontSize: 12, color: Colors.ink3 },
});
