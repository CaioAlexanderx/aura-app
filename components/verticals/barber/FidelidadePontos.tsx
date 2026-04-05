import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// B-19: FidelidadePontos — Loyalty points program

export interface LoyaltyConfig { is_active: boolean; points_per_real: number; redemption_rate: number; welcome_points: number; birthday_bonus: number; referral_points: number; expiry_months: number; }
export interface LoyaltyEntry { id: string; points: number; type: string; description: string; created_at: string; }
export interface LeaderboardEntry { customer_id: string; customer_name: string; balance: number; }

interface Props { config: LoyaltyConfig | null; balance?: number; totalEarned?: number; totalRedeemed?: number; history?: LoyaltyEntry[]; leaderboard?: LeaderboardEntry[]; customerName?: string; onConfigure?: () => void; onEarn?: () => void; onRedeem?: () => void; }

const TYPE_COLORS: Record<string, string> = { earn: "#10B981", redeem: "#EF4444", bonus: "#F59E0B", welcome: "#06B6D4", birthday: "#EC4899", referral: "#7C3AED" };

export function FidelidadePontos({ config, balance = 0, totalEarned = 0, totalRedeemed = 0, history = [], leaderboard = [], customerName, onConfigure, onEarn, onRedeem }: Props) {
  const discountValue = config ? Math.round(balance / (config.redemption_rate || 100) * 100) / 100 : 0;
  return (
    <View style={s.container}>
      {!config?.is_active && (
        <View style={s.setupBox}>
          <Text style={s.setupTitle}>Programa de fidelidade</Text>
          <Text style={s.setupText}>Ative o programa de pontos para recompensar clientes fieis. Configure quantos pontos por R$1 gasto e quantos pontos valem R$1 de desconto.</Text>
          {onConfigure && <Pressable onPress={onConfigure} style={s.setupBtn}><Text style={s.setupBtnT}>Configurar</Text></Pressable>}
        </View>
      )}
      {config?.is_active && (
        <>
          <View style={s.kpiRow}>
            <View style={s.kpi}><Text style={[s.kpiVal, { color: "#F59E0B" }]}>{balance}</Text><Text style={s.kpiLbl}>Saldo pontos{customerName ? " " + customerName : ""}</Text></View>
            <View style={s.kpi}><Text style={[s.kpiVal, { color: "#10B981" }]}>R$ {discountValue}</Text><Text style={s.kpiLbl}>Valor em desconto</Text></View>
            <View style={s.kpi}><Text style={[s.kpiVal, { color: "#06B6D4" }]}>{totalEarned}</Text><Text style={s.kpiLbl}>Total ganhos</Text></View>
            <View style={s.kpi}><Text style={[s.kpiVal, { color: "#EF4444" }]}>{totalRedeemed}</Text><Text style={s.kpiLbl}>Total resgatados</Text></View>
          </View>
          <View style={s.rulesRow}>
            <Text style={s.ruleChip}>{config.points_per_real} pt/R$1</Text>
            <Text style={s.ruleChip}>{config.redemption_rate} pts = R$1</Text>
            {config.welcome_points > 0 && <Text style={s.ruleChip}>Boas-vindas: {config.welcome_points} pts</Text>}
            {config.birthday_bonus > 0 && <Text style={s.ruleChip}>Aniversario: {config.birthday_bonus} pts</Text>}
            <Text style={s.ruleChip}>Validade: {config.expiry_months} meses</Text>
          </View>
          <View style={s.actionsRow}>
            {onEarn && <Pressable onPress={onEarn} style={[s.actBtn, { borderColor: "#10B981" }]}><Text style={[s.actBtnT, { color: "#10B981" }]}>+ Creditar pontos</Text></Pressable>}
            {onRedeem && balance > 0 && <Pressable onPress={onRedeem} style={[s.actBtn, { borderColor: "#F59E0B" }]}><Text style={[s.actBtnT, { color: "#F59E0B" }]}>Resgatar</Text></Pressable>}
          </View>
          {history.length > 0 && <Text style={s.subTitle}>Historico</Text>}
          {history.map(e => (
            <View key={e.id} style={s.histRow}>
              <View style={[s.histDot, { backgroundColor: TYPE_COLORS[e.type] || "#888" }]} />
              <Text style={s.histDate}>{new Date(e.created_at).toLocaleDateString("pt-BR")}</Text>
              <Text style={s.histDesc}>{e.description}</Text>
              <Text style={[s.histPts, { color: e.points >= 0 ? "#10B981" : "#EF4444" }]}>{e.points >= 0 ? "+" : ""}{e.points}</Text>
            </View>
          ))}
          {leaderboard.length > 0 && (
            <View style={s.lbSection}><Text style={s.subTitle}>Ranking fidelidade</Text>
              {leaderboard.map((lb, i) => (
                <View key={lb.customer_id} style={s.lbRow}>
                  <Text style={s.lbPos}>{i + 1}</Text>
                  <Text style={s.lbName}>{lb.customer_name}</Text>
                  <Text style={s.lbPts}>{lb.balance} pts</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },
  setupBox: { padding: 16, borderRadius: 12, backgroundColor: "rgba(245,158,11,0.06)", borderWidth: 0.5, borderColor: "rgba(245,158,11,0.2)", gap: 8 },
  setupTitle: { fontSize: 15, fontWeight: "700", color: "#F59E0B" }, setupText: { fontSize: 12, color: Colors.ink2, lineHeight: 18 },
  setupBtn: { backgroundColor: "#F59E0B", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, alignSelf: "flex-start" }, setupBtnT: { color: "#fff", fontSize: 12, fontWeight: "600" },
  kpiRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  kpi: { flex: 1, minWidth: 80, backgroundColor: Colors.bg3, borderRadius: 10, padding: 10, alignItems: "center", borderWidth: 1, borderColor: Colors.border, gap: 2 },
  kpiVal: { fontSize: 18, fontWeight: "800" }, kpiLbl: { fontSize: 8, color: Colors.ink3, textTransform: "uppercase" },
  rulesRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" }, ruleChip: { fontSize: 10, color: "#F59E0B", backgroundColor: "rgba(245,158,11,0.08)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, fontWeight: "600" },
  actionsRow: { flexDirection: "row", gap: 8 }, actBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 0.5 }, actBtnT: { fontSize: 12, fontWeight: "600" },
  subTitle: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  histRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  histDot: { width: 6, height: 6, borderRadius: 3 }, histDate: { fontSize: 10, color: Colors.ink3, width: 55 }, histDesc: { fontSize: 11, color: Colors.ink, flex: 1 }, histPts: { fontSize: 13, fontWeight: "600" },
  lbSection: { gap: 4 }, lbRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  lbPos: { fontSize: 12, fontWeight: "700", color: "#F59E0B", width: 20 }, lbName: { fontSize: 13, color: Colors.ink, flex: 1 }, lbPts: { fontSize: 12, fontWeight: "600", color: "#F59E0B" },
});

export default FidelidadePontos;
