import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { HoverCard } from "@/components/HoverCard";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";

// VER-03e: Audit trail / Logs

const MOCK_LOGS = [
  { id: "1", user: "Caio", action: "module_activated", detail: "Module odonto activated for Clinica Sorriso", ip: "177.x.x.x", time: "03/04 14:30" },
  { id: "2", user: "Caio", action: "register", detail: "New account: marcos@barbearia.com", ip: "177.x.x.x", time: "03/04 14:15" },
  { id: "3", user: "Caio", action: "treatment_plan_created", detail: "Plan ORC-2026-001 for patient Maria — R$ 4541", ip: "177.x.x.x", time: "03/04 13:50" },
  { id: "4", user: "Caio", action: "cash_opened", detail: "Caixa aberto com R$ 200", ip: "177.x.x.x", time: "03/04 08:00" },
  { id: "5", user: "Sistema", action: "login", detail: "Login: caio@getaura.com.br", ip: "177.x.x.x", time: "03/04 07:55" },
  { id: "6", user: "Sistema", action: "login_failed", detail: "Failed login for teste@test.com", ip: "189.x.x.x", time: "02/04 23:10" },
  { id: "7", user: "Caio", action: "cash_closed", detail: "Caixa fechado. Esperado: R$ 1207, Informado: R$ 1200, Dif: R$ -7", ip: "177.x.x.x", time: "02/04 20:00" },
  { id: "8", user: "Caio", action: "logout", detail: "User logged out", ip: "177.x.x.x", time: "02/04 20:05" },
];

const ACTION_COLORS: Record<string, string> = {
  module_activated: "#10B981",
  register: "#7C3AED",
  login: "#06B6D4",
  login_failed: "#EF4444",
  logout: "#9CA3AF",
  treatment_plan_created: "#F59E0B",
  cash_opened: "#10B981",
  cash_closed: "#F59E0B",
};

export function LogsAdmin() {
  const [filter, setFilter] = useState("");
  const filtered = filter
    ? MOCK_LOGS.filter(l => l.action.includes(filter.toLowerCase()) || l.detail.toLowerCase().includes(filter.toLowerCase()))
    : MOCK_LOGS;

  return (
    <View style={s.container}>
      <TextInput
        value={filter}
        onChangeText={setFilter}
        placeholder="Filtrar por acao ou detalhe..."
        placeholderTextColor={Colors.ink3}
        style={s.search}
      />

      <HoverCard style={s.card}>
        <Text style={s.title}>Audit log ({filtered.length} registros)</Text>
        <View style={s.tableH}>
          <Text style={[s.th, { width: 100 }]}>Hora</Text>
          <Text style={[s.th, { width: 60 }]}>User</Text>
          <Text style={[s.th, { width: 120 }]}>Acao</Text>
          <Text style={[s.th, { flex: 1 }]}>Detalhe</Text>
          <Text style={[s.th, { width: 80 }]}>IP</Text>
        </View>
        {filtered.map(l => {
          const color = ACTION_COLORS[l.action] || Colors.ink3;
          return (
            <View key={l.id} style={s.tr}>
              <Text style={[s.td, { width: 100, color: Colors.ink3 }]}>{l.time}</Text>
              <Text style={[s.td, { width: 60, fontWeight: "600" }]}>{l.user}</Text>
              <View style={{ width: 120 }}>
                <View style={[s.actionBadge, { backgroundColor: color + "18" }]}>
                  <Text style={[s.actionBadgeT, { color }]}>{l.action.replace(/_/g, " ")}</Text>
                </View>
              </View>
              <Text style={[s.td, { flex: 1 }]} numberOfLines={2}>{l.detail}</Text>
              <Text style={[s.td, { width: 80, color: Colors.ink3, fontSize: 10 }]}>{l.ip}</Text>
            </View>
          );
        })}
      </HoverCard>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },
  search: { backgroundColor: Colors.bg3, borderRadius: 10, padding: 12, fontSize: 13, color: Colors.ink, borderWidth: 1, borderColor: Colors.border },
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
  title: { fontSize: 15, fontWeight: "700", color: Colors.ink, marginBottom: 14 },
  tableH: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8, alignItems: "center" },
  th: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", fontWeight: "600" },
  tr: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border, gap: 8, alignItems: "center" },
  td: { fontSize: 12, color: Colors.ink },
  actionBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: "flex-start" },
  actionBadgeT: { fontSize: 9, fontWeight: "600" },
});
