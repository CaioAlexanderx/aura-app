import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// B-13: ProfissionalDaVez — Next available professional indicator

interface Props { professional: { id: string; name: string; color: string; current_appointments: number; queue_count: number } | null; }

export function ProfissionalDaVez({ professional }: Props) {
  if (!professional) return <View style={s.card}><Text style={s.empty}>Nenhum profissional disponivel no momento.</Text></View>;
  return (
    <View style={s.card}>
      <View style={[s.avatar, { backgroundColor: professional.color }]}><Text style={s.avatarT}>{professional.name.charAt(0)}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={s.label}>Proximo disponivel</Text>
        <Text style={s.name}>{professional.name}</Text>
        <Text style={s.info}>{professional.queue_count} na fila | {professional.current_appointments} atendendo</Text>
      </View>
      <Text style={s.arrow}>\u2192</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, backgroundColor: "rgba(245,158,11,0.06)", borderWidth: 0.5, borderColor: "rgba(245,158,11,0.2)" },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }, avatarT: { color: "#fff", fontSize: 16, fontWeight: "700" },
  label: { fontSize: 10, color: Colors.ink3 || "#888", textTransform: "uppercase", fontWeight: "600" }, name: { fontSize: 16, fontWeight: "700", color: Colors.ink || "#fff" },
  info: { fontSize: 11, color: Colors.ink2 || "#aaa", marginTop: 2 }, arrow: { fontSize: 20, color: "#F59E0B" },
  empty: { fontSize: 13, color: Colors.ink3 || "#888", textAlign: "center" },
});

export default ProfissionalDaVez;
