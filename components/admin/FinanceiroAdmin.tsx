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
  const totalCosts = apiDash?.costs?.current_month || 0;
  const grossMargin = apiDash?.gross_margin?.estimated || 0;

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
          <Text style={[s.big, { color: Colors.amber }]}>{fmt(totalCosts)}</Text>
          <Text style={s.hint}>Total de custos no mes atual</Text>
        </HoverCard>
        <HoverCard style={[s.card, { flex: 1 }]}>
          <Text style={s.ct}>Margem bruta</Text>
          <Text style={[s.big, { color: grossMargin >= 0 ? Colors.green : Colors.red }]}>{fmt(grossMargin)}</Text>
          <Text style={s.hint}>Receita - custos</Text>
        </HoverCard>
      </View>
      <HoverCard style={s.card}>
        <Text style={s.ct}>Projecao anual</Text>
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
  hint: { fontSize: 12, color: Colors.ink3 },
});
