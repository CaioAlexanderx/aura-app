import { View, Text, StyleSheet, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { HoverCard } from "@/components/HoverCard";

// VER-03b: Team management (Aura analysts)

const TEAM = [
  { id: "1", name: "Caio Pantoja", role: "Fundador / Admin", clients: 7, ticketsOpen: 2, color: "#7C3AED" },
];

const ACTIVITY = [
  { action: "Ativou modulo odonto", client: "Clinica Sorriso", time: "Hoje 14:30", type: "module" },
  { action: "Respondeu ticket", client: "Barbearia do Marcos", time: "Hoje 11:15", type: "support" },
  { action: "Criou access code PROMO10", client: "", time: "Ontem 16:00", type: "config" },
  { action: "Aplicou migration 025", client: "", time: "Ontem 14:20", type: "infra" },
  { action: "Upgrade plano", client: "Pet Love Jacarei", time: "02/04 10:00", type: "billing" },
];

export function EquipeAdmin() {
  return (
    <View style={s.container}>
      <HoverCard style={s.card}>
        <Text style={s.title}>Equipe Aura</Text>
        {TEAM.map(m => (
          <View key={m.id} style={s.memberRow}>
            <View style={[s.avatar, { backgroundColor: m.color }]}><Text style={s.avatarT}>{m.name.charAt(0)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.memberName}>{m.name}</Text>
              <Text style={s.memberRole}>{m.role}</Text>
            </View>
            <View style={s.statCol}><Text style={s.statVal}>{m.clients}</Text><Text style={s.statLbl}>Clientes</Text></View>
            <View style={s.statCol}><Text style={[s.statVal, { color: m.ticketsOpen > 0 ? "#F59E0B" : "#10B981" }]}>{m.ticketsOpen}</Text><Text style={s.statLbl}>Tickets</Text></View>
          </View>
        ))}
        <Text style={s.hint}>Adicione analistas conforme a base de clientes crescer. Cada analista gerencia ate 30 clientes.</Text>
      </HoverCard>

      <HoverCard style={s.card}>
        <Text style={s.title}>Atividade recente</Text>
        {ACTIVITY.map((a, i) => (
          <View key={i} style={s.actRow}>
            <View style={[s.actDot, { backgroundColor: a.type === "support" ? "#06B6D4" : a.type === "module" ? "#10B981" : a.type === "billing" ? "#F59E0B" : "#7C3AED" }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.actAction}>{a.action}{a.client ? " — " + a.client : ""}</Text>
              <Text style={s.actTime}>{a.time}</Text>
            </View>
          </View>
        ))}
      </HoverCard>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 16 },
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
  title: { fontSize: 15, fontWeight: "700", color: Colors.ink, marginBottom: 14 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarT: { color: "#fff", fontSize: 16, fontWeight: "700" },
  memberName: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  memberRole: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  statCol: { alignItems: "center", minWidth: 50 },
  statVal: { fontSize: 18, fontWeight: "700", color: Colors.ink },
  statLbl: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase" },
  hint: { fontSize: 12, color: Colors.ink3, marginTop: 12, lineHeight: 18 },
  actRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  actDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  actAction: { fontSize: 13, fontWeight: "500", color: Colors.ink },
  actTime: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
});
