import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// TreatmentPlanFunnel (extracted from TreatmentPlanCard.tsx)
// Shows a visual funnel bar of treatment plan statuses
// ============================================================

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  rascunho:       { label: "Rascunho",       bg: "rgba(156,163,175,0.12)", color: "#6B7280" },
  enviado:        { label: "Enviado",        bg: "rgba(6,182,212,0.12)",   color: "#06B6D4" },
  negociando:     { label: "Negociando",     bg: "rgba(245,158,11,0.12)",  color: "#F59E0B" },
  aprovado:       { label: "Aprovado",       bg: "rgba(16,185,129,0.12)",  color: "#10B981" },
  em_tratamento:  { label: "Em tratamento",  bg: "rgba(124,58,237,0.12)",  color: "#7C3AED" },
  concluido:      { label: "Concluido",      bg: "rgba(16,185,129,0.12)",  color: "#10B981" },
  recusado:       { label: "Recusado",       bg: "rgba(239,68,68,0.12)",   color: "#EF4444" },
  cancelado:      { label: "Cancelado",      bg: "rgba(239,68,68,0.12)",   color: "#EF4444" },
};

export interface FunnelData {
  status: string;
  count: number;
  total_value: number;
}

export function TreatmentPlanFunnel({ data }: { data: FunnelData[] }) {
  const order = ["enviado", "negociando", "aprovado", "em_tratamento", "concluido", "recusado"];
  const sorted = order.map(s => data.find(d => d.status === s)).filter(Boolean) as FunnelData[];
  const maxCount = Math.max(...sorted.map(d => d.count), 1);

  return (
    <View style={s.container}>
      <Text style={s.title}>Funil de orcamentos</Text>
      <View style={s.barRow}>
        {sorted.map(d => {
          const info = STATUS_MAP[d.status] || STATUS_MAP.rascunho;
          return (
            <View key={d.status} style={[s.segment, { flex: d.count / maxCount }]}>
              <View style={[s.bar, { backgroundColor: info.color }]} />
            </View>
          );
        })}
      </View>
      <View style={s.labels}>
        {sorted.map(d => {
          const info = STATUS_MAP[d.status] || STATUS_MAP.rascunho;
          return (
            <Text key={d.status} style={s.label}>
              <Text style={{ color: info.color, fontWeight: "600" }}>{d.count}</Text>
              {" "}{info.label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

var s = StyleSheet.create({
  container: { gap: 8 },
  title: { fontSize: 14, fontWeight: "600", color: Colors.ink || "#fff" },
  barRow: { flexDirection: "row", gap: 3, height: 6 },
  segment: { overflow: "hidden" },
  bar: { height: 6, borderRadius: 3 },
  labels: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  label: { fontSize: 11, color: Colors.ink2 || "#aaa" },
});

export default TreatmentPlanFunnel;
