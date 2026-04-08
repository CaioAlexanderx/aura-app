import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { EmptyState } from "@/components/EmptyState";
import type { WithdrawalData } from "./types";
import { fmt } from "./types";

function WaterfallRow({ label, value, isTotal, isHighlight, color }: { label: string; value: number; isTotal?: boolean; isHighlight?: boolean; color?: string }) {
  const [h, sH] = useState(false);
  const w = Platform.OS === "web";
  return (
    <Pressable onHoverIn={w ? () => sH(true) : undefined} onHoverOut={w ? () => sH(false) : undefined}
      style={[s.row, isTotal && s.totalRow, isHighlight && s.highlightRow, h && { backgroundColor: Colors.bg4 }, w && { transition: "background-color 0.15s ease" } as any]}>
      <Text style={[s.label, isTotal && s.totalLabel, isHighlight && s.highlightLabel]}>{label}</Text>
      <Text style={[s.value, isTotal && s.totalValue, color ? { color } : {}]}>{fmt(value)}</Text>
    </Pressable>
  );
}

export function TabRetirada({ data }: { data: WithdrawalData | null }) {
  if (!data) return (
    <EmptyState icon="trending_up" iconColor={Colors.green} title="Minha Retirada" subtitle="A analise de retirada sera calculada automaticamente com base nas suas receitas, despesas e impostos. O pro-labore e fundamental para manter o Fator R e se enquadrar no Anexo III do Simples Nacional." />
  );

  return (
    <View>
      <View style={s.summaryRow}>
        {[["RETIRADA SUGERIDA", data.suggestedWithdrawal, Colors.green], ["PRO-LABORE", data.proLabore, undefined], ["FATOR R", data.fatorR, undefined]].map(([l, v, c]) =>
          <View key={l as string} style={s.card}><Text style={s.cardLabel}>{l as string}</Text><Text style={[s.cardValue, c ? { color: c as string } : {}]}>{(l as string) === "FATOR R" ? v + "%" : fmt(v as number)}</Text></View>
        )}
      </View>
      <View style={s.listCard}>
        <WaterfallRow label="(+) Receita bruta" value={data.grossRevenue} color={Colors.green} />
        <WaterfallRow label="(-) Impostos (DAS)" value={data.taxes} color={Colors.red} />
        <WaterfallRow label="(-) Custos fixos" value={data.fixedCosts} color={Colors.red} />
        <WaterfallRow label="(-) Custos variaveis" value={data.variableCosts} color={Colors.red} />
        <WaterfallRow label="= Lucro operacional" value={data.operationalProfit} isTotal />
        <WaterfallRow label="(-) Pro-labore" value={data.proLabore} color={Colors.amber} />
        <WaterfallRow label="= Lucro liquido" value={data.netProfit} isTotal />
        <WaterfallRow label="Retirada sugerida" value={data.suggestedWithdrawal} isHighlight color={Colors.green} />
      </View>
      <View style={s.infoCard}>
        <Text style={s.infoIcon}>!</Text>
        <Text style={s.infoText}>A retirada sugerida considera o Fator R ({data.fatorR}%) para manter o enquadramento no Anexo III do Simples Nacional. Valores estimativos para apoio a decisao.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  summaryRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: 20 },
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, flex: 1, minWidth: 140, margin: 4 },
  cardLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  cardValue: { fontSize: 20, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, borderRadius: 6 },
  totalRow: { backgroundColor: Colors.bg4, borderBottomWidth: 0, borderRadius: 10, marginTop: 4 },
  highlightRow: { backgroundColor: Colors.violetD, borderBottomWidth: 0, borderRadius: 10, marginTop: 4, borderWidth: 1, borderColor: Colors.border2 },
  label: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  totalLabel: { color: Colors.ink, fontWeight: "600" },
  highlightLabel: { color: Colors.ink, fontWeight: "700" },
  value: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  totalValue: { fontSize: 16, fontWeight: "800" },
  infoCard: { flexDirection: "row", gap: 8, backgroundColor: Colors.amberD, borderRadius: 12, padding: 14, marginBottom: 20 },
  infoIcon: { fontSize: 14, color: Colors.amber, fontWeight: "700" },
  infoText: { fontSize: 11, color: Colors.amber, flex: 1, lineHeight: 16 },
});

export default TabRetirada;
