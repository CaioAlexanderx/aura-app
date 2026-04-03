import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// B-07: ProfissionalRanking — Employee of the month
// Shows ranked list of professionals with stats
// ============================================================

export interface RankedProfessional {
  id: string;
  name: string;
  color: string;
  appointments_count: number;
  revenue: number;
  rating?: number;
  commission_pct: number;
  type?: "clt" | "parceiro" | "autonomo";
}

interface Props {
  professionals: RankedProfessional[];
  period?: string;
  onProfessionalPress?: (proId: string) => void;
}

function fmt(v: number): string {
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function ProfissionalRanking({ professionals, period, onProfessionalPress }: Props) {
  const sorted = [...professionals].sort((a, b) => b.revenue - a.revenue);
  const best = sorted[0];

  return (
    <View style={s.container}>
      {/* Champion card */}
      {best && (
        <View style={s.championCard}>
          <View style={[s.championAvatar, { backgroundColor: best.color }]}>
            <Text style={s.championInitial}>{best.name.charAt(0)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.championLabel}>Profissional do mes{period ? ` \u2014 ${period}` : ""}</Text>
            <Text style={s.championName}>{best.name}</Text>
            <Text style={s.championStats}>
              {best.appointments_count} atendimentos \u2022 {fmt(best.revenue)} receita
              {best.rating ? ` \u2022 ${best.rating.toFixed(1)} avaliacao` : ""}
            </Text>
          </View>
          <Text style={s.star}>\u2605</Text>
        </View>
      )}

      {/* Full ranking */}
      <Text style={s.title}>Ranking completo</Text>
      {sorted.map((pro, i) => (
        <Pressable
          key={pro.id}
          onPress={() => onProfessionalPress?.(pro.id)}
          style={[s.row, i === 0 && s.rowFirst]}
        >
          <View style={s.posContainer}>
            <Text style={[s.pos, i === 0 && s.posGold, i === 1 && s.posSilver, i === 2 && s.posBronze]}>
              {i + 1}
            </Text>
          </View>
          <View style={[s.avatar, { backgroundColor: pro.color }]}>
            <Text style={s.avatarText}>{pro.name.charAt(0)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{pro.name}</Text>
            <Text style={s.stats}>
              {pro.appointments_count} atend. \u2022 {pro.commission_pct}% comissao
            </Text>
          </View>
          <View style={s.revenueCol}>
            <Text style={s.revenue}>{fmt(pro.revenue)}</Text>
            {pro.rating && <Text style={s.rating}>\u2605 {pro.rating.toFixed(1)}</Text>}
          </View>
        </Pressable>
      ))}

      {professionals.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyText}>Nenhum profissional com atendimentos no periodo.</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },
  championCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 16, borderRadius: 14,
    backgroundColor: Colors.bg2 || "#1a1a2e",
    borderWidth: 0.5, borderColor: "rgba(245,158,11,0.3)",
  },
  championAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  championInitial: { color: "#fff", fontSize: 20, fontWeight: "700" },
  championLabel: { fontSize: 11, color: Colors.ink3 || "#888", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  championName: { fontSize: 17, fontWeight: "700", color: Colors.ink || "#fff", marginTop: 2 },
  championStats: { fontSize: 12, color: Colors.ink2 || "#aaa", marginTop: 3 },
  star: { fontSize: 28, color: "#F59E0B" },
  title: { fontSize: 14, fontWeight: "600", color: Colors.ink || "#fff" },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, borderBottomWidth: 0.5,
    borderBottomColor: Colors.border || "#222",
  },
  rowFirst: { borderBottomColor: "rgba(245,158,11,0.15)" },
  posContainer: { width: 24, alignItems: "center" },
  pos: { fontSize: 14, fontWeight: "700", color: Colors.ink3 || "#888" },
  posGold: { color: "#F59E0B" },
  posSilver: { color: "#9CA3AF" },
  posBronze: { color: "#D97706" },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  name: { fontSize: 14, fontWeight: "600", color: Colors.ink || "#fff" },
  stats: { fontSize: 11, color: Colors.ink3 || "#888", marginTop: 1 },
  revenueCol: { alignItems: "flex-end" },
  revenue: { fontSize: 14, fontWeight: "600", color: "#10B981" },
  rating: { fontSize: 11, color: "#F59E0B", marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: 24 },
  emptyText: { fontSize: 13, color: Colors.ink3 || "#888" },
});

export default ProfissionalRanking;
