import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { FoodTokensV2 } from "@/constants/food-tokens";
import { GlassCard } from "@/components/food/foundation/GlassCard";
import { ConicHeader } from "@/components/food/foundation/ConicHeader";
import type { HubStats } from "@/hooks/useFoodHub";

interface Props { stats?: HubStats }

function formatBRL(n?: number) {
  if (typeof n !== "number" || isNaN(n)) return "R$ 0,00";
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function HubKpiStrip({ stats }: Props) {
  const kpis = [
    { label: "Pedidos hoje",  value: String(stats?.today_orders ?? 0),       sub: "todos os canais",  color: FoodTokensV2.primary },
    { label: "Em aberto",      value: String(stats?.open_orders ?? 0),        sub: "aguardando ação",  color: FoodTokensV2.stPrep },
    { label: "Faturado hoje",  value: formatBRL(stats?.today_revenue),         sub: "bruto",            color: FoodTokensV2.violet },
    { label: "Em rota",        value: String(stats?.in_route ?? 0),            sub: "motoboys ativos",  color: FoodTokensV2.stRota },
  ];

  return (
    <View style={styles.row}>
      {kpis.map((k) => (
        <GlassCard key={k.label} hover style={styles.card} topAccent={k.color}>
          <ConicHeader color={k.color}>
            <View style={styles.cardInner}>
              <Text style={styles.label}>{k.label}</Text>
              <Text style={[styles.value, { color: FoodTokensV2.ink }]}>{k.value}</Text>
              <Text style={styles.sub}>{k.sub}</Text>
            </View>
          </ConicHeader>
        </GlassCard>
      ))}
      {typeof stats?.avg_prep_min === "number" && (
        <GlassCard hover style={styles.card} topAccent={FoodTokensV2.heat}>
          <ConicHeader color={FoodTokensV2.heat}>
            <View style={styles.cardInner}>
              <Text style={styles.label}>Prep médio</Text>
              <Text style={[styles.value, { color: FoodTokensV2.ink }]}>{stats.avg_prep_min}<Text style={styles.unit}> min</Text></Text>
              <Text style={styles.sub}>do pedido ao pronto</Text>
            </View>
          </ConicHeader>
        </GlassCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    ...(Platform.OS === "web" ? ({ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" } as any) : {}),
  },
  card: { flexGrow: 1, flexBasis: 200, minHeight: 110 },
  cardInner: { padding: 16, gap: 4 },
  label: {
    fontSize: 10, letterSpacing: 1.4, color: FoodTokensV2.ink3,
    textTransform: "uppercase", fontWeight: "700",
    fontFamily: Platform.OS === "web" ? "JetBrains Mono, monospace" : undefined,
  },
  value: { fontSize: 28, fontWeight: "800", letterSpacing: -0.8, marginTop: 4 },
  unit: { fontSize: 13, fontWeight: "600", color: FoodTokensV2.ink3 },
  sub: { fontSize: 11, color: FoodTokensV2.ink4, marginTop: 2 },
});
