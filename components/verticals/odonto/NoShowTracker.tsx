import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// D-10: NoShowTracker — Patient no-show tracking + policy
// Shows patients with repeated no-shows and configurable policy
// ============================================================

export interface NoShowPatient {
  id: string;
  full_name: string;
  phone?: string;
  no_show_count: number;
  last_no_show?: string;
  total_appointments: number;
  no_show_rate: number;
}

interface Props {
  patients: NoShowPatient[];
  maxNoShows?: number;
  onContactPatient?: (patientId: string) => void;
  onBlockPatient?: (patientId: string) => void;
  onViewHistory?: (patientId: string) => void;
}

export function NoShowTracker({ patients, maxNoShows = 3, onContactPatient, onBlockPatient, onViewHistory }: Props) {
  const sorted = [...patients].sort((a, b) => b.no_show_count - a.no_show_count);
  const critical = sorted.filter(p => p.no_show_count >= maxNoShows);
  const warning = sorted.filter(p => p.no_show_count >= 2 && p.no_show_count < maxNoShows);
  const totalNoShows = sorted.reduce((s, p) => s + p.no_show_count, 0);
  const avgRate = sorted.length > 0 ? Math.round(sorted.reduce((s, p) => s + p.no_show_rate, 0) / sorted.length) : 0;

  return (
    <View style={s.container}>
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#EF4444" }]}>{totalNoShows}</Text><Text style={s.kpiLbl}>Faltas total</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#EF4444" }]}>{critical.length}</Text><Text style={s.kpiLbl}>Criticos ({maxNoShows}+ faltas)</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#F59E0B" }]}>{warning.length}</Text><Text style={s.kpiLbl}>Atencao</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: Colors.ink || "#fff" }]}>{avgRate}%</Text><Text style={s.kpiLbl}>Taxa media</Text></View>
      </View>

      {/* Policy note */}
      <View style={s.policyCard}>
        <Text style={s.policyTitle}>Politica de faltas</Text>
        <Text style={s.policyText}>Pacientes com {maxNoShows}+ faltas sao sinalizados automaticamente. Considere exigir deposito antecipado ou entrar em contato antes da consulta.</Text>
      </View>

      {sorted.filter(p => p.no_show_count > 0).map(p => {
        const isCritical = p.no_show_count >= maxNoShows;
        const color = isCritical ? "#EF4444" : p.no_show_count >= 2 ? "#F59E0B" : "#9CA3AF";
        return (
          <View key={p.id} style={[s.card, { borderLeftColor: color }]}>
            <View style={{ flex: 1 }}>
              <View style={s.nameRow}>
                <Text style={s.name}>{p.full_name}</Text>
                {isCritical && <View style={s.critBadge}><Text style={s.critText}>Critico</Text></View>}
              </View>
              <Text style={s.stats}>
                {p.no_show_count} falta(s) de {p.total_appointments} consultas ({p.no_show_rate}%)
              </Text>
              {p.last_no_show && <Text style={s.lastDate}>Ultima falta: {new Date(p.last_no_show).toLocaleDateString("pt-BR")}</Text>}
            </View>
            <View style={s.actions}>
              {onContactPatient && <Pressable onPress={() => onContactPatient(p.id)} style={s.actionBtn}><Text style={s.actionText}>Contatar</Text></Pressable>}
              {onViewHistory && <Pressable onPress={() => onViewHistory(p.id)} style={s.actionBtn}><Text style={s.actionText}>Historico</Text></Pressable>}
            </View>
          </View>
        );
      })}

      {sorted.filter(p => p.no_show_count > 0).length === 0 && (
        <View style={s.empty}><Text style={s.emptyText}>Nenhum paciente com faltas registradas.</Text></View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },
  kpiRow: { flexDirection: "row", gap: 8 },
  kpi: { flex: 1, backgroundColor: Colors.bg2 || "#1a1a2e", borderRadius: 10, padding: 10, alignItems: "center" },
  kpiVal: { fontSize: 18, fontWeight: "700" },
  kpiLbl: { fontSize: 9, color: Colors.ink3 || "#888", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  policyCard: { padding: 12, borderRadius: 10, backgroundColor: "rgba(245,158,11,0.06)", borderWidth: 0.5, borderColor: "rgba(245,158,11,0.2)", gap: 4 },
  policyTitle: { fontSize: 12, fontWeight: "600", color: "#F59E0B" },
  policyText: { fontSize: 11, color: Colors.ink2 || "#aaa", lineHeight: 16 },
  card: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderRadius: 10, borderLeftWidth: 3,
    backgroundColor: Colors.bg2 || "#1a1a2e",
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 14, fontWeight: "600", color: Colors.ink || "#fff" },
  critBadge: { backgroundColor: "rgba(239,68,68,0.12)", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  critText: { fontSize: 9, fontWeight: "600", color: "#EF4444" },
  stats: { fontSize: 12, color: Colors.ink2 || "#aaa", marginTop: 2 },
  lastDate: { fontSize: 10, color: Colors.ink3 || "#888", marginTop: 2 },
  actions: { gap: 4 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 0.5, borderColor: "#06B6D4" },
  actionText: { fontSize: 10, fontWeight: "600", color: "#06B6D4" },
  empty: { alignItems: "center", paddingVertical: 24 },
  emptyText: { fontSize: 13, color: Colors.ink3 || "#888" },
});

export default NoShowTracker;
