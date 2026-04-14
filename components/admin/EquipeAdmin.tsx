import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { HoverCard } from "@/components/HoverCard";
import { ListSkeleton } from "@/components/ListSkeleton";

const API = "https://aura-backend-production-f805.up.railway.app/api/v1";

const PROFILE_COLORS: Record<string, string> = {
  admin: "#7C3AED",
  analyst: "#06B6D4",
  support: "#10B981",
  finance: "#F59E0B",
};

const PROFILE_LABELS: Record<string, string> = {
  admin: "Admin",
  analyst: "Analista",
  support: "Suporte",
  finance: "Financeiro",
};

export function EquipeAdmin() {
  const { token, isStaff } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-team"],
    queryFn: async () => {
      const res = await fetch(`${API}/admin/team`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    enabled: !!token && isStaff,
    staleTime: 30000,
  });

  if (isLoading) return <ListSkeleton rows={2} showCards />;

  const team = data?.team || [];

  return (
    <View style={s.container}>
      <HoverCard style={s.card}>
        <Text style={s.title}>Equipe Aura</Text>
        {team.length === 0 && <Text style={s.empty}>Nenhum membro cadastrado</Text>}
        {team.map((m: any) => {
          const color = PROFILE_COLORS[m.profile] || Colors.ink3;
          const label = PROFILE_LABELS[m.profile] || m.profile;
          return (
            <View key={m.id} style={s.memberRow}>
              <View style={[s.avatar, { backgroundColor: color }]}>
                <Text style={s.avatarT}>{(m.name || m.email || "?").charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.memberName}>{m.name || m.email}</Text>
                <Text style={s.memberRole}>{label}{m.notes ? ` — ${m.notes}` : ""}</Text>
              </View>
              <View style={[s.statusDot, { backgroundColor: m.is_active ? Colors.green : Colors.red }]} />
            </View>
          );
        })}
        <Text style={s.hint}>Adicione analistas conforme a base de clientes crescer. Cada analista gerencia ate 30 clientes.</Text>
      </HoverCard>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 16 },
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
  title: { fontSize: 15, fontWeight: "700", color: Colors.ink, marginBottom: 14 },
  empty: { fontSize: 13, color: Colors.ink3, textAlign: "center", paddingVertical: 20 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarT: { color: "#fff", fontSize: 16, fontWeight: "700" },
  memberName: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  memberRole: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  hint: { fontSize: 12, color: Colors.ink3, marginTop: 12, lineHeight: 18 },
});
